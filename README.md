# Encuesta de Satisfacción – Activación YAAVS

Formulario web de la **Encuesta de Satisfacción 2.2**, con logo YAAVS y resultados en vivo.

## En vivo

- Encuesta: https://encuesta-satisfaccion-activacion-yaavs.onrender.com/
- Resultados: https://encuesta-satisfaccion-activacion-yaavs.onrender.com/resultados
- Dominio corto (cuando DNS apunte a Render): https://encuesta.directorio-btl.com/

Repo: https://github.com/jorddydylanriveralopez-blip/encuesta-satisfaccion-activacion-yaavs

## Local

```bash
cd "/Users/LBARRADAS/Desktop/Formularios Yaavs/Formulario 6 de Noemi"
npm install
npm start
```

- Encuesta: http://localhost:3000
- Resultados: http://localhost:3000/resultados
- CSV: http://localhost:3000/api/export.csv

## Deploy (Render)

```bash
git push origin main
```

Blueprint: `render.yaml` (servicio `encuesta-satisfaccion-activacion-yaavs`).

## Formulario hermano

El **Reporte de Resultados BTL** vive aparte en `Documents/reporte-btl-yaavs`.
