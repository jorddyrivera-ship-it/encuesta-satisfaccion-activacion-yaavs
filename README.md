# Encuesta de Satisfacción – Activación YAAVS

Formulario web de la **Encuesta de Satisfacción 2.2**, con logo YAAVS y resultados en vivo.

## En vivo (Cloudflare Pages)

- Encuesta: https://encuesta-satisfaccion-activacion.pages.dev/
- Resultados: https://encuesta-satisfaccion-activacion.pages.dev/resultados
- Dominio: https://encuesta.directorio-btl.com/ (SSL en provisión)

Repo: https://github.com/jorddydylanriveralopez-blip/encuesta-satisfaccion-activacion-yaavs

## Local

```bash
cd "/Users/LBARRADAS/Desktop/Formularios Yaavs/Formulario 6 de Noemi"
npm install
npm start
```

- Encuesta: http://localhost:3000
- Resultados: http://localhost:3000/resultados

## Deploy Cloudflare Pages

```bash
npx wrangler pages deploy public --project-name=encuesta-satisfaccion-activacion
```

Respuestas en KV `ENCUESTA_SATISFACCION`. API en `functions/api/`.

## Formulario hermano

El **Reporte de Resultados BTL** vive aparte en `Documents/reporte-btl-yaavs`.
