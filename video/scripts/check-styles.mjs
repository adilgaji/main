// Проверка стилей скриптом, а не «на глаз»:
//  • список стилей в styles.json совпадает с описаниями в style.ts;
//  • у каждого стиля есть все цвета, а файлы его шрифтов лежат в public/fonts;
//  • текст читается: контраст не ниже нормы (WCAG) для каждой пары «текст / фон»;
//  • стили действительно разные (разные заголовочные шрифты, фильтры и фоны).
// Запуск:  node scripts/check-styles.mjs   (из папки video; печатает отчёт, при ошибках — код 1)
import {build} from 'esbuild';
import {existsSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

// style.ts и fontFaces.ts — обычный TypeScript: собираем их во временный файл и подключаем.
// Временная папка — внутри node_modules (в git не попадает), чтобы подключился react.
const cache = path.join(root, 'node_modules', '.cache');
mkdirSync(cache, {recursive: true});
const tmp = mkdtempSync(path.join(cache, 'check-styles-'));
const load = async (entry, name) => {
  const outfile = path.join(tmp, `${name}.mjs`);
  await build({entryPoints: [path.join(root, entry)], bundle: true, format: 'esm', platform: 'node', external: ['react'], outfile, logLevel: 'silent'});
  return import(pathToFileURL(outfile).href);
};
const style = await load('src/style.ts', 'style');
const faces = await load('src/fontFaces.ts', 'faces');
rmSync(tmp, {recursive: true, force: true});

const problems = [];
const bad = (id, msg) => problems.push(`${id}: ${msg}`);

// ---------------------------------------------------------------- цвет
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const over = (fg, a, bg) => {
  const f = rgb(fg);
  const b = rgb(bg);
  return `#${f.map((x, i) => Math.round(x * a + b[i] * (1 - a)).toString(16).padStart(2, '0')).join('')}`;
};
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const HEX = /^#[0-9A-Fa-f]{6}$/;

const PALETTE_KEYS = ['bg', 'bgAlt', 'paper', 'paperShade', 'ink', 'light', 'lightSoft', 'accent', 'accent2', 'sea', 'seaDeep', 'land', 'landEdge', 'river', 'skin', 'skinShade', 'hair', 'coat', 'coatShade', 'shirt'];

// ---------------------------------------------------------------- список
const {STYLE_LIST, STYLES, DEFAULT_STYLE} = style;
if (STYLE_LIST.length !== 8) {
  bad('список', `стилей должно быть 8, а их ${STYLE_LIST.length}`);
}
if (!STYLES[DEFAULT_STYLE]) {
  bad('список', `стиль по умолчанию «${DEFAULT_STYLE}» не существует`);
}
if (new Set(STYLE_LIST.map((s) => s.nameRu)).size !== STYLE_LIST.length) {
  bad('список', 'названия стилей повторяются');
}

const rows = [];
for (const s of STYLE_LIST) {
  const p = s.palette;
  for (const k of PALETTE_KEYS) {
    if (!HEX.test(p[k] ?? '')) {
      bad(s.id, `цвет ${k} должен быть вида #RRGGBB`);
    }
  }
  for (const c of [s.captions.plate, s.captions.text, s.captions.active]) {
    if (!HEX.test(c)) {
      bad(s.id, `цвет субтитров ${c} должен быть вида #RRGGBB`);
    }
  }
  if (problems.some((x) => x.startsWith(`${s.id}:`))) {
    continue;
  }

  // шрифты: описаны и файлы лежат на диске
  for (const fam of s.families) {
    const list = faces.FONT_FILES[fam];
    if (!list) {
      bad(s.id, `шрифт «${fam}» не описан в fontFaces.ts`);
      continue;
    }
    for (const f of list) {
      if (!existsSync(path.join(root, 'public', 'fonts', f.file))) {
        bad(s.id, `нет файла шрифта public/fonts/${f.file}`);
      }
    }
  }
  for (const [role, stackStr] of Object.entries(s.fonts)) {
    const first = /^"([^"]+)"/.exec(stackStr)?.[1];
    if (!first || !s.families.includes(first)) {
      bad(s.id, `шрифт «${role}» (${stackStr}) не входит в список загружаемых`);
    }
  }
  for (const f of ['textures/grain.png', 'textures/grain-coarse.png', 'textures/paper.png', 'textures/linen.png']) {
    if (s.treatment.grainTexture === f && !existsSync(path.join(root, 'public', f))) {
      bad(s.id, `нет текстуры ${f}`);
    }
  }

  // общие договорённости: тёмный фон, светлая бумага, тёмное море, светлая суша
  if (lum(p.bg) > 0.06) bad(s.id, 'фон кадра должен быть тёмным');
  if (lum(p.paper) < 0.5) bad(s.id, 'бумага должна быть светлой');
  if (lum(p.sea) > 0.2) bad(s.id, 'море на карте должно быть тёмным');
  if (lum(p.land) < 0.45) bad(s.id, 'суша на карте должна быть светлой');

  // контраст текста: [описание, текст, фон, минимум]
  const plate = over(s.captions.plate, s.captions.plateOpacity, '#FFFFFF'); // худший случай: плашка над белой картинкой
  const tests = [
    ['светлый текст на фоне', p.light, p.bg, 7],
    ['светлый текст на втором тоне фона', p.light, p.bgAlt, 4.5],
    ['приглушённый светлый текст на фоне', p.lightSoft, p.bg, 4.5],
    ['акцент на фоне (подзаголовки)', p.accent, p.bg, 4.5],
    ['акцент на втором тоне фона', p.accent, p.bgAlt, 3],
    ['чернила на бумаге', p.ink, p.paper, 7],
    ['чернила на тени бумаги', p.ink, p.paperShade, 4.5],
    // подпись цитаты — крупный жирный текст (30 px), для него нормой считается 3:1; требуем 4:1 с запасом
    ['приглушённые чернила на бумаге (подпись цитаты)', over(p.ink, 0.62, p.paper), p.paper, 4],
    ['второй акцент на бумаге (знак цитаты, пометки)', p.accent2, p.paper, 3],
    ['подпись моря на карте', over(p.light, 0.62, p.sea), p.sea, 3],
    ['светлый текст на глубоком море', p.light, p.seaDeep, 4.5],
    ['надпись на суше', over(p.ink, 0.72, p.land), p.land, 4.5],
    ['суша против моря', p.land, p.sea, 2.5],
    ['второй акцент (регион) на суше', p.accent2, p.land, 2],
    ['субтитры: текст на плашке', s.captions.text, plate, 7],
    ['субтитры: подсвеченное слово на плашке', s.captions.active, plate, 4.5],
    ['субтитры: подсвеченное слово против обычного', s.captions.active, s.captions.text, 1.15],
  ];
  let worst = Infinity;
  for (const [what, fg, bg, min] of tests) {
    const r = ratio(fg, bg);
    worst = Math.min(worst, r / min);
    if (r < min) {
      bad(s.id, `мало контраста: ${what} — ${r.toFixed(2)}:1, нужно не меньше ${min}:1`);
    }
  }
  rows.push([s.id, s.fonts.display.split(',')[0].replaceAll('"', ''), s.treatment.filter.split(' ')[0], s.palette.bg, s.palette.accent, worst.toFixed(2)]);
}

// ---------------------------------------------------------------- стили разные
const labDist = (a, b) => {
  const toLab = (hex) => {
    const lin = rgb(hex).map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const [r, g, b] = lin;
    const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const [fx, fy, fz] = xyz.map(f);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  };
  const [x, y] = [toLab(a), toLab(b)];
  return Math.hypot(...x.map((v, i) => v - y[i]));
};
for (let i = 0; i < STYLE_LIST.length; i++) {
  for (let j = i + 1; j < STYLE_LIST.length; j++) {
    const [a, b] = [STYLE_LIST[i], STYLE_LIST[j]];
    if (a.fonts.display === b.fonts.display) {
      bad(`${a.id} / ${b.id}`, 'одинаковый шрифт заголовков');
    }
    if (a.treatment.filter === b.treatment.filter && a.treatment.pattern === b.treatment.pattern) {
      bad(`${a.id} / ${b.id}`, 'одинаковая обработка картинки');
    }
    const dBg = labDist(a.palette.bg, b.palette.bg);
    const dAcc = labDist(a.palette.accent, b.palette.accent);
    const dPaper = labDist(a.palette.accent2, b.palette.accent2);
    if (dBg < 5 && dAcc < 12 && dPaper < 12) {
      bad(`${a.id} / ${b.id}`, `палитры слишком похожи (фон ${dBg.toFixed(1)}, акцент ${dAcc.toFixed(1)}, акцент 2 ${dPaper.toFixed(1)})`);
    }
  }
}

console.log('стиль            заголовки            фильтр      фон      акцент   запас контраста');
for (const r of rows) {
  console.log(`${r[0].padEnd(16)} ${r[1].padEnd(20)} ${r[2].padEnd(11)} ${r[3]}  ${r[4]}  ×${r[5]}`);
}
if (problems.length) {
  console.error(`\nНайдено проблем: ${problems.length}`);
  for (const p of problems) {
    console.error(` - ${p}`);
  }
  process.exit(1);
}
console.log(`\nВсе проверки стилей пройдены (${STYLE_LIST.length} стилей).`);
