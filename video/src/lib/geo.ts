// География для карт. Данные — Natural Earth (public domain), лежат в public/geo.
// Здесь проекция, «камера» карты и помощники для линий и многоугольников.
import {geoArea, geoMercator, geoNaturalEarth1, type GeoProjection} from 'd3-geo';

/** [долгота, широта] в градусах */
export type LonLat = [number, number];
/** [запад, юг, восток, север] в градусах */
export type BBox = [number, number, number, number];
export type Detail = '110m' | '50m' | '10m';

export const spanOf = (b: BBox): {lon: number; lat: number} => ({lon: b[2] - b[0], lat: b[3] - b[1]});

export const unionBBox = (a: BBox, b: BBox): BBox => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[2], b[2]),
  Math.max(a[3], b[3]),
];

/** Насколько подробные данные нужны: чем ближе вид, тем подробнее берег. */
export const pickDetail = (tightest: BBox): Detail => {
  const s = spanOf(tightest);
  const span = Math.max(s.lon, s.lat * 1.6);
  if (span > 110) {
    return '110m';
  }
  if (span > 34) {
    return '50m';
  }
  return '10m';
};

const corners = (b: BBox): LonLat[] => {
  const [w, s, e, n] = b;
  const mx = (w + e) / 2;
  const my = (s + n) / 2;
  return [
    [w, s], [mx, s], [e, s], [e, my], [e, n], [mx, n], [w, n], [w, my],
  ];
};

/** Проекция, в которой область fit целиком помещается в кадр width x height. */
export const makeProjection = (fit: BBox, width: number, height: number): GeoProjection => {
  const s = spanOf(fit);
  const world = s.lon > 150 || fit[3] > 78 || fit[1] < -70;
  const proj = world ? geoNaturalEarth1() : geoMercator();
  proj.fitExtent(
    [
      [0, 0],
      [width, height],
    ],
    {type: 'MultiPoint', coordinates: corners(fit)},
  );
  return proj;
};

export type Rect = {x: number; y: number; w: number; h: number};

/** Прямоугольник области на плоскости проекции (в «базовых» пикселях). */
export const projectedRect = (proj: GeoProjection, b: BBox): Rect => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of corners(b)) {
    const p = proj(c);
    if (!p) {
      continue;
    }
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  return {x: minX, y: minY, w: maxX - minX, h: maxY - minY};
};

/**
 * Положение камеры: точка карты (cx, cy в базовых пикселях), которая попадает в точку
 * экрана (ax, ay), и увеличение. Точка экрана — центр области, свободной от субтитров.
 */
export type Camera = {cx: number; cy: number; scale: number; ax: number; ay: number};

/** Область экрана, в которую должен целиком поместиться показываемый участок карты. */
export type ScreenArea = {x: number; y: number; w: number; h: number};

export const cameraFor = (rect: Rect, area: ScreenArea): Camera => ({
  cx: rect.x + rect.w / 2,
  cy: rect.y + rect.h / 2,
  scale: Math.min(area.w / rect.w, area.h / rect.h),
  ax: area.x + area.w / 2,
  ay: area.y + area.h / 2,
});

/** Плавный переход камеры: центр — линейно, увеличение — в логарифме (ощущается ровным). */
export const mixCamera = (a: Camera, b: Camera, t: number): Camera => ({
  cx: a.cx + (b.cx - a.cx) * t,
  cy: a.cy + (b.cy - a.cy) * t,
  scale: Math.exp(Math.log(a.scale) + (Math.log(b.scale) - Math.log(a.scale)) * t),
  ax: a.ax + (b.ax - a.ax) * t,
  ay: a.ay + (b.ay - a.ay) * t,
});

export const applyCamera = (cam: Camera, p: [number, number]): [number, number] => [
  (p[0] - cam.cx) * cam.scale + cam.ax,
  (p[1] - cam.cy) * cam.scale + cam.ay,
];

export const cameraTransform = (cam: Camera): string =>
  `translate(${cam.ax - cam.cx * cam.scale} ${cam.ay - cam.cy * cam.scale}) scale(${cam.scale})`;

/** Видимый прямоугольник камеры в базовых пикселях (для кадра width x height). */
export const visibleRect = (cam: Camera, width: number, height: number): Rect => ({
  x: cam.cx - cam.ax / cam.scale,
  y: cam.cy - cam.ay / cam.scale,
  w: width / cam.scale,
  h: height / cam.scale,
});

/**
 * d3 считает «внутренностью» многоугольника то, что справа по ходу обхода.
 * Если обход не тот, заливается весь земной шар кроме фигуры — исправляем.
 */
export const fixWinding = (ring: LonLat[]): LonLat[] => {
  const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring : [...ring, ring[0]];
  const area = geoArea({type: 'Polygon', coordinates: [closed]});
  return area > 2 * Math.PI ? [...closed].reverse() : closed;
};

/** Гладкая кривая через точки (Catmull-Rom → кривые Безье). */
export const smoothPath = (pts: [number, number][], tension = 0.5): string => {
  if (pts.length < 2) {
    return '';
  }
  if (pts.length === 2) {
    return `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]}`;
  }
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1: [number, number] = [p1[0] + ((p2[0] - p0[0]) * tension) / 3, p1[1] + ((p2[1] - p0[1]) * tension) / 3];
    const c2: [number, number] = [p2[0] - ((p3[0] - p1[0]) * tension) / 3, p2[1] - ((p3[1] - p1[1]) * tension) / 3];
    d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)}, ${c2[0].toFixed(2)} ${c2[1].toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
};

type Position = number[];
type PolygonCoords = Position[][];

/**
 * В подробных данных Natural Earth (10m) несколько многоугольников записаны с обратным
 * обходом. Для d3 такой многоугольник — «весь земной шар кроме островка», и суша заливает
 * всю карту. Находим их по площади (больше полусферы) и разворачиваем.
 */
export const repairPolygons = (geometries: {type: string; coordinates: unknown}[]): {type: 'MultiPolygon'; coordinates: PolygonCoords[]} => {
  const out: PolygonCoords[] = [];
  for (const g of geometries) {
    const polys = (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []) as PolygonCoords[];
    for (const poly of polys) {
      const inverted = geoArea({type: 'Polygon', coordinates: poly}) > 2 * Math.PI;
      out.push(inverted ? poly.map((ring) => [...ring].reverse()) : poly);
    }
  }
  return {type: 'MultiPolygon', coordinates: out};
};
