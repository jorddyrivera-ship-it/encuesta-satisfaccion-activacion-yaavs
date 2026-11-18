export const FIELD_ORDER = [
  ["clave", "Clave YAAVSER"],
  ["nombre", "Nombre YAAVSER"],
  ["fecha", "Fecha encuesta"],
  ["municipio", "Municipio / Estado"],
  ["receivedAt", "Fecha y hora envío"],
  ["surveyVersion", "Versión encuesta"],
  ["ventasDiaChips", "Día normal · Chips/Líneas (1-5)"],
  ["ventasDiaPortabilidad", "Día normal · Portabilidades (1-5)"],
  ["ventasDiaEsim", "Día normal · eSIM (1-5)"],
  ["ventasDiaPospago", "Día normal · Pospago (1-5)"],
  ["ayudaVisitas", "Ayudó a más visitas (1-5)"],
  ["ayudaVisitasPorque", "Ayudó visitas · ¿Por qué?"],
  ["oportunidadesVenta", "¿Generó oportunidades de venta?"],
  ["productosMasVentas", "Productos con más ventas"],
  ["ventasActLineaNueva", "Activación · Línea nueva"],
  ["ventasActPortabilidad", "Activación · Portabilidad"],
  ["ventasActEsim", "Activación · eSIM"],
  ["ventasActPospago", "Activación · Pospago"],
  ["ventasActOtroQty", "Activación · Otro (cant.)"],
  ["ventasActOtroTexto", "Activación · Otro (texto)"],
  ["imagenPromotoras", "Imagen promotoras (1-5)"],
  ["imagenPromotorasPorque", "Imagen promotoras · ¿Por qué?"],
  ["ejecucion", "Ejecución activación"],
  ["ejecucionPorque", "Ejecución · ¿Por qué?"],
  ["horarios", "¿Respetaron horarios?"],
  ["preferenciaYaavs", "Preferencia YAAVS (1-5)"],
  ["recomienda", "¿Recomendaría?"],
  ["gusto", "Lo que más gustó"],
  ["mejoras", "Qué mejorarías"],
  ["ventasTipos", "Ventas BTL (tipos) [v1]"],
  ["ventasEsim", "eSIM vendidas [v1]"],
  ["ventasSim", "SIM vendidas [v1]"],
  ["ventasPortabilidad", "Portabilidad [v1]"],
  ["ventasDescargas", "Descargas nuevas [v1]"],
  ["ventasTotal", "Total ventas BTL [v1]"],
  ["experiencia", "Experiencia (1-5) [v1]"],
  ["satisfaccion", "Satisfacción [v1]"],
  ["gustoOtro", "Gusto (otro) [v1]"],
  ["atencion", "Atención del equipo (1-5) [v1]"],
  ["expectativas", "Expectativas [v1]"],
  ["interesYaavs", "Interés en YAAVS [v1]"],
  ["comentarios", "Comentarios adicionales [v1]"],
];

const QTY_KEYS_V1 = ["ventasEsim", "ventasSim", "ventasPortabilidad", "ventasDescargas"];
const QTY_KEYS_V2 = [
  "ventasActLineaNueva",
  "ventasActPortabilidad",
  "ventasActEsim",
  "ventasActPospago",
  "ventasActOtroQty",
];
const QTY_KEYS = [...QTY_KEYS_V1, ...QTY_KEYS_V2];
const KV_KEY = "responses";

function clampSaleQty(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return Math.max(0, Math.min(25, Math.round(n)));
}

export function isTrashed(entry) {
  return Boolean(entry && entry.deletedAt);
}

export function flatten(entry) {
  const nested =
    entry && entry.answers && typeof entry.answers === "object" ? entry.answers : null;
  const a =
    nested && Object.keys(nested).length
      ? nested
      : entry && typeof entry === "object"
        ? entry
        : {};
  const out = {
    id: entry.id || "",
    receivedAt: entry.receivedAt || entry.timestamp || "",
    timestamp: entry.timestamp || entry.receivedAt || "",
    deletedAt: entry.deletedAt || "",
  };
  for (const [key] of FIELD_ORDER) {
    if (key === "receivedAt" || key === "id") continue;
    const v = a[key];
    if (Array.isArray(v)) out[key] = v.join(", ");
    else if (v == null) out[key] = "";
    else out[key] = String(v);
  }
  const totalV1 = QTY_KEYS_V1.reduce((sum, key) => sum + (Number(a[key]) || 0), 0);
  if (a.ventasTotal != null && a.ventasTotal !== "") out.ventasTotal = String(a.ventasTotal);
  else if (totalV1 > 0) out.ventasTotal = String(totalV1);
  else out.ventasTotal = out.ventasTotal || "";
  return out;
}

export function normalize(body) {
  const now = new Date().toISOString();
  const answers = body && typeof body.answers === "object" ? body.answers : body || {};
  const clean = { ...answers };
  delete clean.website;
  if (Array.isArray(clean.ventasTipos)) {
    clean.ventasTipos = clean.ventasTipos.map((v) => String(v || "").trim()).filter(Boolean);
  }
  if (Array.isArray(clean.productosMasVentas)) {
    clean.productosMasVentas = clean.productosMasVentas
      .map((v) => String(v || "").trim())
      .filter(Boolean);
  }
  QTY_KEYS.forEach((key) => {
    if (clean[key] == null || clean[key] === "") return;
    clean[key] = clampSaleQty(clean[key]);
  });
  if (QTY_KEYS_V1.some((k) => clean[k] != null && clean[k] !== "")) {
    clean.ventasTotal = QTY_KEYS_V1.reduce((sum, key) => sum + (Number(clean[key]) || 0), 0);
  }
  return {
    id: body?.id || `sat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: body?.receivedAt || body?.timestamp || now,
    timestamp: body?.timestamp || now,
    answers: clean,
  };
}

export function parseIds(body) {
  if (Array.isArray(body?.ids)) {
    return body.ids.map((id) => String(id || "").trim()).filter(Boolean);
  }
  const one = String(body?.id || "").trim();
  return one ? [one] : [];
}

export async function readResponses(env) {
  const raw = await env.ENCUESTA_SATISFACCION.get(KV_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export async function writeResponses(env, list) {
  await env.ENCUESTA_SATISFACCION.put(KV_KEY, JSON.stringify(list));
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function formatDateMx(raw) {
  const d = new Date(raw || 0);
  if (Number.isNaN(d.getTime())) return String(raw || "");
  return d.toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
}

export async function forwardToSheets(env, entry) {
  const url = String(env.SHEETS_WEBHOOK_URL || "").trim();
  if (!url) return { skipped: true };
  try {
    const flat = flatten(entry);
    const payload = JSON.stringify({
      ...flat,
      destino: "encuesta-satisfaccion",
      answers: entry.answers,
    });
    let res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      redirect: "manual",
    });
    let status = res.status;
    if (status >= 300 && status < 400) {
      const loc = res.headers.get("location");
      if (loc) {
        const follow = await fetch(loc, { method: "GET", redirect: "follow" });
        status = follow.ok ? 200 : follow.status;
      } else {
        status = 200;
      }
    }
    return { ok: status >= 200 && status < 300, status };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
