// Готовит географические данные для карт из Natural Earth (public domain).
// Запуск:  node scripts/build-geo.mjs <папка с ne_*.geojson>
// Суша и границы стран берутся из npm-пакета world-atlas (те же данные Natural Earth).
// Результат кладётся в public/geo и хранится в репозитории, чтобы на ноутбуке
// ничего не нужно было скачивать.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const out = path.join(root, 'public', 'geo');
const src = process.argv[2];
if (!src) {
  console.error('Укажите папку с файлами ne_*.geojson');
  process.exit(1);
}
fs.mkdirSync(out, {recursive: true});

for (const f of ['land-110m', 'land-50m', 'land-10m', 'countries-110m', 'countries-50m']) {
  fs.copyFileSync(path.join(root, 'node_modules', 'world-atlas', `${f}.json`), path.join(out, `${f}.json`));
}

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const line = (coords, d) => {
  const res = [];
  let prev = null;
  for (const [x, y] of coords) {
    const p = [round(x, d), round(y, d)];
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) res.push(p);
    prev = p;
  }
  return res;
};

const rivers = (file, maxRank, d) => {
  const g = JSON.parse(fs.readFileSync(path.join(src, file), 'utf8'));
  const res = [];
  for (const f of g.features) {
    const p = f.properties;
    if (!f.geometry || (p.scalerank ?? 99) > maxRank) continue;
    const parts = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const c of parts) {
      const l = line(c, d);
      if (l.length > 1) res.push({n: p.name ?? '', r: p.scalerank ?? 9, c: l});
    }
  }
  return res;
};

const lakes = (file, maxRank, d) => {
  const g = JSON.parse(fs.readFileSync(path.join(src, file), 'utf8'));
  const res = [];
  for (const f of g.features) {
    const p = f.properties;
    if (!f.geometry || (p.scalerank ?? 99) > maxRank) continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      const rings = poly.map((r) => line(r, d)).filter((r) => r.length > 3);
      if (rings.length) res.push({n: p.name ?? '', r: p.scalerank ?? 9, c: rings});
    }
  }
  return res;
};

const write = (name, data) => {
  const file = path.join(out, name);
  fs.writeFileSync(file, JSON.stringify(data));
  console.log(name.padEnd(22), (fs.statSync(file).size / 1024).toFixed(0).padStart(6), 'КБ', Array.isArray(data) ? `${data.length} объектов` : '');
};

write('rivers-50m.json', rivers('ne_50m_rivers_lake_centerlines.geojson', 99, 2));
write('lakes-50m.json', lakes('ne_50m_lakes.geojson', 99, 2));
write('rivers-10m.json', rivers('ne_10m_rivers_lake_centerlines.geojson', 7, 3));
write('lakes-10m.json', lakes('ne_10m_lakes.geojson', 4, 3));
for (const f of fs.readdirSync(out)) console.log(' ', f, (fs.statSync(path.join(out, f)).size / 1024).toFixed(0), 'КБ');
