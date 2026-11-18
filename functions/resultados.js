export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  url.pathname = "/resultados.html";
  return context.env.ASSETS.fetch(url);
}
