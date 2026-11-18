import {
  FIELD_ORDER,
  isTrashed,
  flatten,
  normalize,
  parseIds,
  readResponses,
  writeResponses,
  json,
  csvEscape,
  formatDateMx,
  forwardToSheets,
} from "../_lib/survey.js";

function routePath(params) {
  const parts = params?.path;
  if (Array.isArray(parts)) return parts.join("/");
  return String(parts || "");
}

function authOk(request, body, env) {
  const url = new URL(request.url);
  const key = String(body?.key || url.searchParams.get("key") || "").trim();
  const expected = String(env.RESET_KEY || "yaavs-reset").trim();
  return Boolean(key && key === expected);
}

async function parseBody(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

function buildCsv(list) {
  const items = list
    .filter((r) => !isTrashed(r))
    .map(flatten)
    .sort((a, b) => {
      const ta = new Date(a.receivedAt || a.timestamp || 0).getTime();
      const tb = new Date(b.receivedAt || b.timestamp || 0).getTime();
      return tb - ta;
    });
  const headers = ["#", ...FIELD_ORDER.map(([, label]) => label)];
  const keys = FIELD_ORDER.map(([key]) => key);
  const lines = [headers.map(csvEscape).join(",")];
  items.forEach((row, idx) => {
    const values = [
      String(idx + 1),
      ...keys.map((k) => {
        if (k === "receivedAt") return formatDateMx(row.receivedAt || row.timestamp);
        return row[k] == null ? "" : String(row[k]);
      }),
    ];
    lines.push(values.map(csvEscape).join(","));
  });
  return "\uFEFF" + lines.join("\n");
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method.toUpperCase();
  const path = routePath(params);
  const sheetsConfigured = Boolean(String(env.SHEETS_WEBHOOK_URL || "").trim());

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    if (path === "health" && method === "GET") {
      const all = await readResponses(env);
      return json({
        ok: true,
        count: all.filter((r) => !isTrashed(r)).length,
        trashCount: all.filter((r) => isTrashed(r)).length,
        sheetsConfigured,
      });
    }

    if (path === "submit" && method === "POST") {
      const body = await parseBody(request);
      if (body?.website || body?.answers?.website) {
        return json({ ok: true, honeypot: true });
      }
      const entry = normalize(body);
      const list = await readResponses(env);
      list.unshift(entry);
      await writeResponses(env, list);
      const sheets = await forwardToSheets(env, entry);
      return json({ ok: true, id: entry.id, sheets }, 201);
    }

    if (path === "responses" && method === "GET") {
      const url = new URL(request.url);
      const includeTrash =
        String(url.searchParams.get("includeTrash") || "").trim() === "1" ||
        String(url.searchParams.get("includeTrash") || "").toLowerCase() === "true";
      const all = await readResponses(env);
      const source = includeTrash ? all : all.filter((r) => !isTrashed(r));
      const items = source.map(flatten);
      return json({
        ok: true,
        count: all.filter((r) => !isTrashed(r)).length,
        trashCount: all.filter((r) => isTrashed(r)).length,
        sheetsConfigured,
        responses: items,
        items,
      });
    }

    if (path === "trash" && method === "GET") {
      const items = (await readResponses(env))
        .filter(isTrashed)
        .map(flatten)
        .sort((a, b) => {
          const ta = new Date(a.deletedAt || a.receivedAt || 0).getTime();
          const tb = new Date(b.deletedAt || b.receivedAt || 0).getTime();
          return tb - ta;
        });
      return json({ ok: true, count: items.length, responses: items, items });
    }

    if (path === "trash" && method === "POST") {
      const body = await parseBody(request);
      const ids = new Set(parseIds(body));
      if (!ids.size) return json({ ok: false, error: "Falta el id de la respuesta." }, 400);
      const now = new Date().toISOString();
      let moved = 0;
      const list = (await readResponses(env)).map((entry) => {
        if (!ids.has(entry.id) || isTrashed(entry)) return entry;
        moved += 1;
        return { ...entry, deletedAt: now };
      });
      await writeResponses(env, list);
      return json({
        ok: true,
        moved,
        count: list.filter((r) => !isTrashed(r)).length,
        trashCount: list.filter((r) => isTrashed(r)).length,
      });
    }

    if (path === "restore" && method === "POST") {
      const body = await parseBody(request);
      const ids = new Set(parseIds(body));
      if (!ids.size) return json({ ok: false, error: "Falta el id de la respuesta." }, 400);
      let restored = 0;
      const list = (await readResponses(env)).map((entry) => {
        if (!ids.has(entry.id) || !isTrashed(entry)) return entry;
        restored += 1;
        const next = { ...entry };
        delete next.deletedAt;
        return next;
      });
      await writeResponses(env, list);
      return json({
        ok: true,
        restored,
        count: list.filter((r) => !isTrashed(r)).length,
        trashCount: list.filter((r) => isTrashed(r)).length,
      });
    }

    if (path === "trash/purge" && method === "POST") {
      const body = await parseBody(request);
      const ids = new Set(parseIds(body));
      if (!ids.size) return json({ ok: false, error: "Falta el id de la respuesta." }, 400);
      const before = await readResponses(env);
      const list = before.filter((entry) => !(ids.has(entry.id) && isTrashed(entry)));
      await writeResponses(env, list);
      return json({
        ok: true,
        purged: before.length - list.length,
        count: list.filter((r) => !isTrashed(r)).length,
        trashCount: list.filter((r) => isTrashed(r)).length,
      });
    }

    if (
      (path === "export.csv" ||
        path === "export.xlsx" ||
        path === "export" ||
        path === "descargar-excel") &&
      method === "GET"
    ) {
      if (path === "export") {
        return Response.redirect(new URL("/api/export.csv", request.url), 302);
      }
      const csv = buildCsv(await readResponses(env));
      const stamp = new Date().toISOString().slice(0, 10);
      const filename =
        path === "export.csv"
          ? "Encuesta_Satisfaccion_Activacion_YAAVS.csv"
          : `Encuesta_Satisfaccion_YAAVS_${stamp}.csv`;
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (path === "reset" && method === "POST") {
      const body = await parseBody(request);
      if (!authOk(request, body, env)) return json({ ok: false, error: "No autorizado" }, 403);
      await writeResponses(env, []);
      return json({ ok: true, count: 0 });
    }

    if (path === "import" && method === "POST") {
      const body = await parseBody(request);
      if (!authOk(request, body, env)) return json({ ok: false, error: "No autorizado" }, 403);
      const incoming = Array.isArray(body?.responses)
        ? body.responses
        : Array.isArray(body?.items)
          ? body.items
          : [];
      const mode = String(body?.mode || "merge").trim();
      const normalized = incoming.map((row) => {
        if (row && row.answers && typeof row.answers === "object") {
          const entry = normalize(row);
          if (row.deletedAt) entry.deletedAt = String(row.deletedAt);
          return entry;
        }
        const { id, receivedAt, timestamp, deletedAt, website, ...answers } = row || {};
        const entry = normalize({ id, receivedAt, timestamp, answers });
        if (deletedAt) entry.deletedAt = String(deletedAt);
        return entry;
      });
      let list = mode === "replace" ? [] : await readResponses(env);
      const byId = new Map(list.map((r) => [r.id, r]));
      normalized.forEach((entry) => byId.set(entry.id, entry));
      list = [...byId.values()].sort((a, b) => {
        const ta = new Date(a.receivedAt || a.timestamp || 0).getTime();
        const tb = new Date(b.receivedAt || b.timestamp || 0).getTime();
        return tb - ta;
      });
      await writeResponses(env, list);
      return json({ ok: true, count: list.length, imported: normalized.length, mode });
    }

    if (path === "sheets/sync" && method === "POST") {
      const body = await parseBody(request);
      if (!authOk(request, body, env)) return json({ ok: false, error: "No autorizado" }, 403);
      if (!sheetsConfigured) {
        return json({ ok: false, error: "SHEETS_WEBHOOK_URL no configurado" }, 400);
      }
      const onlyActive = String(body?.onlyActive || "1") !== "0";
      const all = await readResponses(env);
      const list = onlyActive ? all.filter((r) => !isTrashed(r)) : all;
      let ok = 0;
      let fail = 0;
      for (const entry of list) {
        const result = await forwardToSheets(env, entry);
        if (result && result.ok) ok += 1;
        else fail += 1;
      }
      return json({ ok: true, total: list.length, synced: ok, failed: fail, sheetsConfigured: true });
    }

    return json({ ok: false, error: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err?.message || err || "Error") }, 500);
  }
}
