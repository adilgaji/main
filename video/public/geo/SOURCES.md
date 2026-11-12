# Данные карт

Все файлы — Natural Earth (https://www.naturalearthdata.com), общественное достояние.

- `land-*.json`, `countries-*.json` — из npm-пакета `world-atlas` (те же данные Natural Earth в формате TopoJSON)
- `rivers-*.json`, `lakes-*.json` — из репозитория `nvkelso/natural-earth-vector` (GeoJSON),
  уменьшены скриптом `scripts/build-geo.mjs`

Современная география используется только как подложка. Исторические границы рисуются кодом
и всегда подписываются «approximate».
