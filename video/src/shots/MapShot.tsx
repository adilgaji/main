// Кадр «Карта»: суша и реки из Natural Earth, плавная камера, исторические области
// (нарисованы кодом и подписаны «approximate»), маршруты со стрелками, города и битвы.
import {evolvePath, getLength, getPointAtLength, getTangentAtLength} from '@remotion/paths';
import {geoGraticule, geoPath, type GeoPermissibleObjects, type GeoProjection} from 'd3-geo';
import React, {useId, useMemo} from 'react';
import {AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {feature, mesh} from 'topojson-client';
import type {GeometryCollection, Topology} from 'topojson-specification';
import {ShotFrame} from '../components/ShotFrame';
import {TitlePlate} from '../components/TextBits';
import {alpha, CLAMP, EASE, mix, ramp} from '../lib/anim';
import {useStaticJson} from '../lib/assets';
import {
  applyCamera,
  cameraFor,
  cameraTransform,
  fixWinding,
  makeProjection,
  mixCamera,
  pickDetail,
  projectedRect,
  repairPolygons,
  smoothPath,
  spanOf,
  unionBBox,
  visibleRect,
  type BBox,
  type Camera,
  type Detail,
  type LonLat,
} from '../lib/geo';
import {clampBox, insideArea, LABEL_AREA, textWidth, type Box} from '../lib/labels';
import {FRAME, useStyle, type Palette} from '../style';

export type MapRegion = {
  label: string;
  polygon: LonLat[];
  color?: 'accent' | 'accent2' | 'light';
  /** Исторические границы всегда приблизительны; false — только для современных */
  approximate?: boolean;
  /** Когда появляется, секунды от начала кадра */
  appearAt?: number;
  labelAt?: LonLat;
};

export type MapRoute = {
  points: LonLat[];
  label?: string;
  color?: 'accent' | 'accent2';
  startAt?: number;
  duration?: number;
  /** Пунктир — для морских путей */
  dashed?: boolean;
};

export type MapPlace = {
  name: string;
  at: LonLat;
  kind?: 'city' | 'battle' | 'capital';
  appearAt?: number;
  label?: 'right' | 'left' | 'top' | 'bottom';
};

export type MapLabel = {text: string; at: LonLat; kind?: 'sea' | 'land'; size?: number};

export type MapShotProps = {
  frames: number;
  /** Что показываем в начале */
  view: BBox;
  /** Куда камера приходит к концу (необязательно) */
  viewTo?: BBox;
  title?: string;
  subtitle?: string;
  regions?: MapRegion[];
  routes?: MapRoute[];
  places?: MapPlace[];
  labels?: MapLabel[];
  rivers?: boolean;
  modernBorders?: boolean;
  detail?: Detail;
};

const W = FRAME.width;
const H = FRAME.height;
/** Участок карты из раскадровки целиком помещается сюда: внутри полей, ниже заголовка и выше субтитров. */
const mapArea = (hasTitle: boolean) => {
  const top = hasTitle ? 275 : LABEL_AREA.top + 20;
  return {x: LABEL_AREA.left, y: top, w: LABEL_AREA.right - LABEL_AREA.left, h: LABEL_AREA.bottom - top};
};

type RiverRec = {n: string; r: number; c: LonLat[]};
type LakeRec = {n: string; r: number; c: LonLat[][]};

type Geo = {
  proj: GeoProjection;
  camA: Camera;
  camB: Camera;
  detail: Detail;
  clip: [[number, number], [number, number]];
  graticuleStep: number;
};

const useGeo = (view: BBox, viewTo: BBox | undefined, detail: Detail | undefined, hasTitle: boolean): Geo =>
  useMemo(() => {
    const MAP_AREA = mapArea(hasTitle);
    const fit = viewTo ? unionBBox(view, viewTo) : view;
    const proj = makeProjection(fit, W, H);
    const camA = cameraFor(projectedRect(proj, view), MAP_AREA);
    // Если второй вид не задан, камера всё равно медленно приближается — кадр «дышит».
    const camB = viewTo ? cameraFor(projectedRect(proj, viewTo), MAP_AREA) : {...camA, scale: camA.scale * 1.08};
    const ra = visibleRect(camA, W, H);
    const rb = visibleRect(camB, W, H);
    const pad = 0.14;
    const x0 = Math.min(ra.x, rb.x);
    const y0 = Math.min(ra.y, rb.y);
    const x1 = Math.max(ra.x + ra.w, rb.x + rb.w);
    const y1 = Math.max(ra.y + ra.h, rb.y + rb.h);
    const clip: Geo['clip'] = [
      [x0 - (x1 - x0) * pad, y0 - (y1 - y0) * pad],
      [x1 + (x1 - x0) * pad, y1 + (y1 - y0) * pad],
    ];
    proj.clipExtent(clip);
    const tight = viewTo && spanOf(viewTo).lon < spanOf(view).lon ? viewTo : view;
    const lonSpan = spanOf(fit).lon;
    const graticuleStep = lonSpan > 120 ? 20 : lonSpan > 50 ? 10 : lonSpan > 18 ? 5 : 2;
    return {proj, camA, camB, detail: detail ?? pickDetail(tight), clip, graticuleStep};
  }, [view, viewTo, detail, hasTitle]);

/** Положение камеры в текущем кадре: движение занимает середину кадра. */
const useCamera = (geo: Geo, frames: number): Camera => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [frames * 0.08, frames * 0.92], [0, 1], {...CLAMP, easing: EASE.inOut});
  return mixCamera(geo.camA, geo.camB, t);
};

// ---------------------------------------------------------------- неподвижная основа карты

const landCache = new Map<string, unknown>();

/** Суша нужной подробности с исправленными многоугольниками (считается один раз). */
const landGeometry = (land: Topology, detail: Detail): unknown => {
  const cached = landCache.get(detail);
  if (cached) {
    return cached;
  }
  const fc = feature(land, land.objects.land) as unknown as {type: string; features?: {geometry: {type: string; coordinates: unknown}}[]; geometry?: {type: string; coordinates: unknown}};
  const geoms = fc.features ? fc.features.map((f) => f.geometry) : fc.geometry ? [fc.geometry] : [];
  const fixed = repairPolygons(geoms);
  landCache.set(detail, fixed);
  return fixed;
};

const MapBase: React.FC<{
  geo: Geo;
  land: Topology | null;
  countries: Topology | null;
  rivers: RiverRec[] | null;
  lakes: LakeRec[] | null;
  palette: Palette;
  stroke: number;
  clipId: string;
}> = React.memo(({geo, land, countries, rivers, lakes, palette: p, stroke, clipId}) => {
  const paths = useMemo(() => {
    const path = geoPath(geo.proj);
    const out = {land: '', graticule: '', rivers: '', riversMajor: '', lakes: '', borders: ''};
    out.graticule = path(geoGraticule().step([geo.graticuleStep, geo.graticuleStep])()) ?? '';
    if (land) {
      out.land = path(landGeometry(land, geo.detail) as GeoPermissibleObjects) ?? '';
    }
    if (rivers) {
      const maxRank = geo.detail === '10m' ? 7 : 5;
      const minor = rivers.filter((r) => r.r > 3 && r.r <= maxRank).map((r) => r.c);
      const major = rivers.filter((r) => r.r <= 3).map((r) => r.c);
      out.rivers = path({type: 'MultiLineString', coordinates: minor}) ?? '';
      out.riversMajor = path({type: 'MultiLineString', coordinates: major}) ?? '';
    }
    if (lakes) {
      out.lakes = path({type: 'MultiPolygon', coordinates: lakes.map((l) => l.c.map((ring) => fixWinding(ring)))}) ?? '';
    }
    if (countries) {
      const obj = countries.objects.countries as GeometryCollection;
      out.borders = path(mesh(countries, obj, (a, b) => a !== b)) ?? '';
    }
    return out;
  }, [geo, land, countries, rivers, lakes]);

  const ne = {vectorEffect: 'non-scaling-stroke' as const};
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <path d={paths.land} />
        </clipPath>
      </defs>
      <path d={paths.graticule} fill="none" stroke={alpha(p.light, 0.1)} strokeWidth={1.5} {...ne} />
      {/* «мелководье» вокруг берега: три светлых ореола */}
      <path d={paths.land} fill="none" stroke={alpha(p.light, 0.07)} strokeWidth={46} strokeLinejoin="round" {...ne} />
      <path d={paths.land} fill="none" stroke={alpha(p.light, 0.09)} strokeWidth={24} strokeLinejoin="round" {...ne} />
      <path d={paths.land} fill="none" stroke={alpha(p.light, 0.14)} strokeWidth={9} strokeLinejoin="round" {...ne} />
      <path d={paths.land} fill={p.land} stroke={p.landEdge} strokeWidth={stroke * 0.6} strokeLinejoin="round" {...ne} />
      <path d={paths.lakes} fill={p.sea} stroke={p.landEdge} strokeWidth={stroke * 0.3} {...ne} />
      <path d={paths.rivers} fill="none" stroke={alpha(p.river, 0.75)} strokeWidth={stroke * 0.45} strokeLinecap="round" strokeLinejoin="round" {...ne} />
      <path d={paths.riversMajor} fill="none" stroke={p.river} strokeWidth={stroke * 0.8} strokeLinecap="round" strokeLinejoin="round" {...ne} />
      {paths.borders ? (
        <path d={paths.borders} fill="none" stroke={alpha(p.ink, 0.35)} strokeWidth={stroke * 0.4} strokeDasharray="2 7" strokeLinecap="round" {...ne} />
      ) : null}
    </>
  );
});

// ---------------------------------------------------------------- области (исторические границы)

const regionColor = (p: Palette, c: MapRegion['color']): string => (c === 'accent' ? p.accent : c === 'light' ? p.light : p.accent2);

const RegionShapes: React.FC<{geo: Geo; regions: MapRegion[]; palette: Palette; stroke: number; clipId: string}> = ({geo, regions, palette: p, stroke, clipId}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const shapes = useMemo(() => {
    const path = geoPath(geo.proj);
    return regions.map((r) => path({type: 'Polygon', coordinates: [fixWinding(r.polygon)]}) ?? '');
  }, [geo, regions]);
  return (
    <>
      {regions.map((r, i) => {
        const k = ramp(frame, (r.appearAt ?? 0.4) * fps, 0.9 * fps, EASE.soft);
        const color = regionColor(p, r.color);
        return (
          <g key={r.label} opacity={k} clipPath={`url(#${clipId})`}>
            <path d={shapes[i]} fill={alpha(color, 0.3)} />
            <path
              d={shapes[i]}
              fill="none"
              stroke={mix(color, p.ink, 0.25)}
              strokeWidth={stroke}
              strokeDasharray={r.approximate === false ? undefined : '14 10'}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------- маршруты и значки (в координатах экрана)

const toScreen = (geo: Geo, cam: Camera, at: LonLat): [number, number] => {
  const b = geo.proj(at) ?? [0, 0];
  return applyCamera(cam, b);
};

const Routes: React.FC<{geo: Geo; frames: number; routes: MapRoute[]; palette: Palette; stroke: number}> = ({geo, frames, routes, palette: p, stroke}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cam = useCamera(geo, frames);
  return (
    <>
      {routes.map((r, i) => {
        const d = smoothPath(r.points.map((pt) => toScreen(geo, cam, pt)));
        if (!d) {
          return null;
        }
        const progress = ramp(frame, (r.startAt ?? 0.8) * fps, (r.duration ?? 3) * fps, EASE.inOut);
        if (progress <= 0) {
          return null;
        }
        const len = getLength(d);
        const {strokeDasharray, strokeDashoffset} = evolvePath(progress, d);
        const tip = getPointAtLength(d, len * progress);
        const tan = getTangentAtLength(d, Math.max(0.01, len * progress - 0.01));
        if (!tip || !tan) {
          return null;
        }
        const angle = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
        const color = r.color === 'accent' ? p.accent : p.accent2;
        const width = stroke * 2.4;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={alpha(p.ink, 0.55)} strokeWidth={width + 6} strokeLinecap="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
            <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
            {r.dashed ? (
              <path d={d} fill="none" stroke={alpha(p.paper, 0.9)} strokeWidth={width * 0.35} strokeDasharray="4 16" strokeLinecap="round" opacity={progress >= 1 ? 1 : 0} />
            ) : null}
            <g transform={`translate(${tip.x} ${tip.y}) rotate(${angle})`}>
              <path d="M 30 0 L -16 -22 L -6 0 L -16 22 Z" fill={color} stroke={alpha(p.ink, 0.6)} strokeWidth={3} strokeLinejoin="round" />
            </g>
          </g>
        );
      })}
    </>
  );
};

const PlaceMarker: React.FC<{kind: MapPlace['kind']; palette: Palette}> = ({kind, palette: p}) => {
  if (kind === 'battle') {
    return (
      <g>
        <circle r={27} fill={p.accent2} stroke={p.paper} strokeWidth={4} />
        <g stroke={p.paper} strokeWidth={5} strokeLinecap="round">
          <line x1={-12} y1={-12} x2={12} y2={12} />
          <line x1={12} y1={-12} x2={-12} y2={12} />
        </g>
      </g>
    );
  }
  if (kind === 'capital') {
    return (
      <g>
        <rect x={-15} y={-15} width={30} height={30} fill={p.accent} stroke={p.ink} strokeWidth={4} transform="rotate(45)" />
        <circle r={5} fill={p.ink} />
      </g>
    );
  }
  return (
    <g>
      <circle r={13} fill={p.paper} stroke={p.ink} strokeWidth={4.5} />
      <circle r={4.5} fill={p.ink} />
    </g>
  );
};

const Places: React.FC<{geo: Geo; frames: number; places: MapPlace[]; palette: Palette}> = ({geo, frames, places, palette: p}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cam = useCamera(geo, frames);
  return (
    <>
      {places.map((pl) => {
        const [x, y] = toScreen(geo, cam, pl.at);
        const start = (pl.appearAt ?? 0.5) * fps;
        const k = ramp(frame, start, 0.5 * fps, EASE.out);
        const pulse = pl.kind === 'battle' ? interpolate((frame - start) % (1.6 * fps), [0, 1.6 * fps], [0, 1], CLAMP) : 0;
        return (
          <g key={pl.name} transform={`translate(${x} ${y})`} opacity={k}>
            {pl.kind === 'battle' && frame > start ? <circle r={27 + pulse * 46} fill="none" stroke={p.accent2} strokeWidth={5} opacity={1 - pulse} /> : null}
            <g transform={`scale(${0.4 + 0.6 * k})`}>
              <PlaceMarker kind={pl.kind} palette={p} />
            </g>
          </g>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------- подписи (чёткий слой текста)

const halo = (color: string, width = 8): React.CSSProperties => ({
  WebkitTextStroke: `${width}px ${color}`,
  paintOrder: 'stroke fill',
});

const MapText: React.FC<{geo: Geo; frames: number} & Pick<MapShotProps, 'regions' | 'places' | 'labels' | 'routes'>> = ({
  geo,
  frames,
  regions = [],
  places = [],
  labels = [],
  routes = [],
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {palette: p, fonts} = useStyle();
  const cam = useCamera(geo, frames);
  const centroids = useMemo(() => {
    const path = geoPath(geo.proj);
    return regions.map((r) => (r.labelAt ? (geo.proj(r.labelAt) ?? [0, 0]) : path.centroid({type: 'Polygon', coordinates: [fixWinding(r.polygon)]})));
  }, [geo, regions]);
  const boxStyle = (b: Box): React.CSSProperties => ({position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap'});

  return (
    <AbsoluteFill>
      {labels.map((l) => {
        const [x, y] = toScreen(geo, cam, l.at);
        const sea = (l.kind ?? 'sea') === 'sea';
        const size = l.size ?? 44;
        const spacing = sea ? 10 : 6;
        const w = textWidth(l.text, fonts.display, size, 500, spacing) + 20;
        const box = clampBox({x: x - w / 2, y: y - size * 0.7, w, h: size * 1.4}, 260);
        if (!box) {
          return null;
        }
        return (
          <div
            key={l.text}
            style={{
              ...boxStyle(box),
              fontFamily: fonts.display,
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: size,
              letterSpacing: spacing,
              color: sea ? alpha(p.light, 0.62) : alpha(p.ink, 0.6),
              opacity: ramp(frame, 0.2 * fps, 0.8 * fps),
            }}
          >
            {l.text}
          </div>
        );
      })}

      {regions.map((r, i) => {
        const [x, y] = applyCamera(cam, centroids[i] as [number, number]);
        const text = r.label.toUpperCase();
        const w = Math.max(textWidth(text, fonts.body, 46, 800, 7), 330) + 30;
        const h = r.approximate === false ? 64 : 104;
        const box = clampBox({x: x - w / 2, y: y - h / 2, w, h}, 520);
        if (!box) {
          return null;
        }
        return (
          <div
            key={r.label}
            style={{
              ...boxStyle(box),
              flexDirection: 'column',
              opacity: ramp(frame, ((r.appearAt ?? 0.4) + 0.3) * fps, 0.7 * fps),
            }}
          >
            <div style={{fontFamily: fonts.body, fontWeight: 800, fontSize: 46, letterSpacing: 7, lineHeight: 1.15, color: p.ink, ...halo(alpha(p.paper, 0.9), 8)}}>{text}</div>
            {r.approximate === false ? null : (
              <div style={{fontFamily: fonts.display, fontStyle: 'italic', fontWeight: 600, fontSize: 30, lineHeight: 1.2, color: alpha(p.ink, 0.9), ...halo(alpha(p.paper, 0.9), 6)}}>
                borders approximate
              </div>
            )}
          </div>
        );
      })}

      {places.map((pl) => {
        const [x, y] = toScreen(geo, cam, pl.at);
        if (x < 0 || x > W || y < 0 || y > H) {
          return null;
        }
        const battle = pl.kind === 'battle';
        const size = battle ? 46 : 38;
        const weight = battle ? 800 : 700;
        const w = textWidth(pl.name, fonts.body, size, weight) + 16;
        const h = size * 1.3;
        const off = battle ? 42 : 24;
        const boxes: Record<string, Box> = {
          right: {x: x + off, y: y - h / 2, w, h},
          left: {x: x - off - w, y: y - h / 2, w, h},
          top: {x: x - w / 2, y: y - off - h, w, h},
          bottom: {x: x - w / 2, y: y + off, w, h},
        };
        const preferred = pl.label ?? 'right';
        const order = [preferred, preferred === 'right' ? 'left' : preferred === 'left' ? 'right' : preferred === 'top' ? 'bottom' : 'top', 'top', 'bottom', 'right', 'left'];
        const side = order.find((sd) => insideArea(boxes[sd]));
        const box = side ? boxes[side] : clampBox(boxes[preferred], 90);
        if (!box) {
          return null;
        }
        return (
          <div
            key={pl.name}
            style={{
              ...boxStyle(box),
              fontFamily: fonts.body,
              fontWeight: weight,
              fontSize: size,
              color: battle ? p.light : p.ink,
              ...halo(battle ? p.accent2 : p.paper, battle ? 10 : 9),
              opacity: ramp(frame, ((pl.appearAt ?? 0.5) + 0.15) * fps, 0.5 * fps),
            }}
          >
            {pl.name}
          </div>
        );
      })}

      {routes.map((r, i) => {
        if (!r.label) {
          return null;
        }
        const mid = r.points[Math.floor(r.points.length / 2)];
        const [x, y] = toScreen(geo, cam, mid);
        const w = textWidth(r.label, fonts.body, 36, 800) + 16;
        const box = clampBox({x: x - w / 2, y: y - 100, w, h: 48}, 200);
        if (!box) {
          return null;
        }
        const start = ((r.startAt ?? 0.8) + (r.duration ?? 3) * 0.45) * fps;
        return (
          <div
            key={i}
            style={{
              ...boxStyle(box),
              fontFamily: fonts.body,
              fontWeight: 800,
              fontSize: 36,
              color: p.light,
              ...halo(alpha(p.ink, 0.85), 8),
              opacity: ramp(frame, start, 0.5 * fps),
            }}
          >
            {r.label}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- сам кадр

const MapArt: React.FC<MapShotProps & {geo: Geo}> = ({geo, frames, regions = [], routes = [], places = [], rivers = true, modernBorders = false}) => {
  const {palette: p, stroke, treatment} = useStyle();
  const cam = useCamera(geo, frames);
  const clipId = `land-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const land = useStaticJson<Topology>(`geo/land-${geo.detail}.json`);
  const riverRes = geo.detail === '110m' ? null : geo.detail;
  const riverData = useStaticJson<RiverRec[]>(rivers && riverRes ? `geo/rivers-${riverRes}.json` : null);
  const lakeData = useStaticJson<LakeRec[]>(rivers && riverRes ? `geo/lakes-${riverRes}.json` : null);
  const countries = useStaticJson<Topology>(modernBorders ? `geo/countries-${geo.detail === '110m' ? '110m' : '50m'}.json` : null);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 80% 80% at 45% 40%, ${p.sea} 0%, ${p.seaDeep} 100%)`}} />
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
        <g transform={cameraTransform(cam)}>
          <MapBase geo={geo} land={land} countries={countries} rivers={riverData} lakes={lakeData} palette={p} stroke={stroke} clipId={clipId} />
          <RegionShapes geo={geo} regions={regions} palette={p} stroke={stroke} clipId={clipId} />
        </g>
      </svg>
      <AbsoluteFill
        style={{
          backgroundImage: `url(${staticFile('textures/paper.png')})`,
          backgroundSize: '1024px 1024px',
          mixBlendMode: 'multiply',
          opacity: treatment.paperOpacity * 0.9,
        }}
      />
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
        <Routes geo={geo} frames={frames} routes={routes} palette={p} stroke={stroke} />
        <Places geo={geo} frames={frames} places={places} palette={p} />
      </svg>
    </AbsoluteFill>
  );
};

export const MapShot: React.FC<MapShotProps> = (props) => {
  const geo = useGeo(props.view, props.viewTo, props.detail, Boolean(props.title));
  const {palette: p} = useStyle();
  return (
    <ShotFrame
      frames={props.frames}
      drift={null}
      art={<MapArt {...props} geo={geo} />}
      text={
        <>
          {props.title ? (
            <div style={{position: 'absolute', left: 0, top: 0, width: W, height: 380, background: `linear-gradient(180deg, ${alpha(p.bg, 0.85)} 0%, ${alpha(p.bg, 0.6)} 50%, ${alpha(p.bg, 0)} 100%)`}} />
          ) : null}
          <MapText geo={geo} frames={props.frames} regions={props.regions} places={props.places} labels={props.labels} routes={props.routes} />
          {props.title ? <TitlePlate title={props.title} subtitle={props.subtitle} /> : null}
        </>
      }
    />
  );
};
