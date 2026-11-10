/**
 * Контур тела человека (вид спереди, человек смотрит на зрителя:
 * левая сторона ЧЕЛОВЕКА = правая сторона ЭКРАНА).
 * Органы можно подсветить (highlight) — остальные приглушаются.
 * Расположение органов — по учебнику анатомии (упрощённо).
 */
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS} from '../style';

export type OrganKey =
  | 'brain'
  | 'hypothalamus'
  | 'pituitary'
  | 'thyroid'
  | 'lungs'
  | 'heart'
  | 'liver'
  | 'stomach'
  | 'kidneys'
  | 'adrenals'
  | 'testes'
  | 'muscles'
  | 'vessels';

export const ORGANS: OrganKey[] = [
  'brain', 'hypothalamus', 'pituitary', 'thyroid', 'lungs', 'heart', 'liver',
  'stomach', 'kidneys', 'adrenals', 'testes', 'muscles', 'vessels',
];

/** Центры органов в координатах viewBox (0 0 400 900) — для зума камеры. */
export const ORGAN_CENTER: Record<OrganKey, {x: number; y: number; zoom: number}> = {
  brain: {x: 200, y: 66, zoom: 4},
  hypothalamus: {x: 200, y: 84, zoom: 7},
  pituitary: {x: 200, y: 96, zoom: 7},
  thyroid: {x: 200, y: 160, zoom: 6},
  lungs: {x: 200, y: 262, zoom: 2.6},
  heart: {x: 214, y: 278, zoom: 4.5},
  liver: {x: 170, y: 345, zoom: 3.5},
  stomach: {x: 232, y: 352, zoom: 4},
  kidneys: {x: 200, y: 398, zoom: 3},
  adrenals: {x: 200, y: 372, zoom: 4.5},
  testes: {x: 200, y: 540, zoom: 5},
  muscles: {x: 200, y: 450, zoom: 1.4},
  vessels: {x: 200, y: 400, zoom: 1},
};

type Props = {
  highlight?: OrganKey[];
  /** показывать все органы (true) или только подсвеченные */
  showAll?: boolean;
  width?: number;
  pulse?: boolean;
  style?: React.CSSProperties;
};

export const BodyOutline: React.FC<Props> = ({highlight = [], showAll = true, width = 400, pulse = true, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const hl = new Set(highlight);
  const anyHl = hl.size > 0;
  const beat = pulse ? (Math.sin((frame / fps) * Math.PI * 2 * 1.2) + 1) / 2 : 0;

  const vis = (k: OrganKey) => {
    if (hl.has(k)) return 1;
    if (!showAll) return 0;
    return anyHl ? 0.28 : 0.9;
  };
  const glow = (k: OrganKey) => (hl.has(k) ? {filter: `drop-shadow(0 0 ${6 + beat * 6}px ${COLORS.accent})`} : {});

  const body = COLORS.bodyFill;
  const limb = (d: string, w: number) => (
    <path d={d} stroke={body} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  );

  return (
    <svg viewBox="0 0 400 900" width={width} height={(width * 900) / 400} style={{overflow: 'visible', ...style}}>
      {/* ---------- силуэт ---------- */}
      <g style={{filter: `drop-shadow(0 0 2px ${COLORS.bodyEdge})`}}>
        <ellipse cx={200} cy={74} rx={50} ry={60} fill={body} />
        <rect x={180} y={120} width={40} height={50} fill={body} />
        {/* торс */}
        <path
          d="M 120 182 Q 200 160 280 182 Q 300 190 298 230 L 284 330 Q 276 380 288 440 Q 292 500 260 525 L 140 525 Q 108 500 112 440 Q 124 380 116 330 L 102 230 Q 100 190 120 182 Z"
          fill={body}
        />
        {/* руки */}
        {limb('M 290 200 Q 318 280 322 350 Q 328 430 336 500', 44)}
        {limb('M 110 200 Q 82 280 78 350 Q 72 430 64 500', 44)}
        <ellipse cx={338} cy={522} rx={20} ry={28} fill={body} />
        <ellipse cx={62} cy={522} rx={20} ry={28} fill={body} />
        {/* ноги */}
        {limb('M 240 500 Q 250 620 244 700 Q 240 790 246 850', 62)}
        {limb('M 160 500 Q 150 620 156 700 Q 160 790 154 850', 62)}
        <ellipse cx={258} cy={872} rx={36} ry={16} fill={body} />
        <ellipse cx={142} cy={872} rx={36} ry={16} fill={body} />
      </g>

      {/* ---------- мышцы (бицепс, грудные, квадрицепс) ---------- */}
      <g opacity={vis('muscles')} style={glow('muscles')} fill={COLORS.muscle}>
        <ellipse cx={314} cy={290} rx={15} ry={42} transform="rotate(-14 314 290)" />
        <ellipse cx={86} cy={290} rx={15} ry={42} transform="rotate(14 86 290)" />
        <ellipse cx={247} cy={620} rx={22} ry={70} transform="rotate(-4 247 620)" />
        <ellipse cx={153} cy={620} rx={22} ry={70} transform="rotate(4 153 620)" />
      </g>

      {/* ---------- сосуды ---------- */}
      <g opacity={vis('vessels') * 0.8} style={glow('vessels')} fill="none" strokeLinecap="round">
        <path d="M 206 255 L 206 470 L 240 520 L 246 840 M 206 470 L 160 520 L 154 840" stroke={COLORS.blood} strokeWidth={5} />
        <path d="M 206 230 Q 260 210 316 300 L 334 500 M 200 230 Q 140 210 84 300 L 66 500" stroke={COLORS.blood} strokeWidth={4} />
        <path d="M 200 230 L 196 120" stroke={COLORS.blood} strokeWidth={4} />
      </g>

      {/* ---------- мозг, гипоталамус, гипофиз ---------- */}
      <g opacity={vis('brain')} style={glow('brain')}>
        <ellipse cx={200} cy={62} rx={38} ry={33} fill={COLORS.brain} />
        <path d="M 200 32 L 200 92 M 178 50 Q 186 58 178 66 M 222 50 Q 214 58 222 66" stroke={COLORS.brainDark} strokeWidth={3} fill="none" />
      </g>
      <g opacity={vis('hypothalamus')} style={glow('hypothalamus')}>
        <circle cx={200} cy={84} r={6} fill={COLORS.gland} stroke={COLORS.glandDark} strokeWidth={2} />
      </g>
      <g opacity={vis('pituitary')} style={glow('pituitary')}>
        <line x1={200} y1={89} x2={200} y2={95} stroke={COLORS.glandDark} strokeWidth={2} />
        <circle cx={200} cy={98} r={4.5} fill={COLORS.gland} />
      </g>

      {/* ---------- щитовидная железа (бабочка на шее) ---------- */}
      <g opacity={vis('thyroid')} style={glow('thyroid')} fill={COLORS.gland}>
        <ellipse cx={191} cy={160} rx={8} ry={12} />
        <ellipse cx={209} cy={160} rx={8} ry={12} />
        <rect x={190} y={161} width={20} height={6} rx={3} />
      </g>

      {/* ---------- лёгкие ---------- */}
      <g opacity={vis('lungs')} style={glow('lungs')} fill={COLORS.lung}>
        <path d="M 192 205 Q 150 200 140 260 Q 132 320 150 330 Q 180 335 192 320 Z" />
        <path d="M 208 205 Q 250 200 260 260 Q 268 320 250 330 Q 226 335 214 322 Q 230 300 222 286 Q 214 270 208 262 Z" />
      </g>

      {/* ---------- печень (справа у человека = слева на экране) ---------- */}
      <g opacity={vis('liver')} style={glow('liver')}>
        <path d="M 132 330 Q 180 320 228 336 Q 220 368 190 372 Q 150 378 136 362 Z" fill={COLORS.organ} />
      </g>

      {/* ---------- желудок (слева у человека = справа на экране) ---------- */}
      <g opacity={vis('stomach')} style={glow('stomach')}>
        <path d="M 230 330 Q 262 330 262 360 Q 260 392 228 386 Q 214 382 222 370 Q 240 366 236 350 Z" fill="#E8B4A0" />
      </g>

      {/* ---------- почки и надпочечники ---------- */}
      <g opacity={vis('kidneys')} style={glow('kidneys')} fill={COLORS.organ}>
        <path d="M 162 382 Q 150 384 150 402 Q 150 422 164 422 Q 172 420 170 410 Q 166 402 172 394 Q 174 384 162 382 Z" />
        <path d="M 238 382 Q 250 384 250 402 Q 250 422 236 422 Q 228 420 230 410 Q 234 402 228 394 Q 226 384 238 382 Z" />
      </g>
      <g opacity={vis('adrenals')} style={glow('adrenals')} fill={COLORS.gland}>
        <path d="M 152 380 L 162 366 L 172 380 Z" />
        <path d="M 228 380 L 238 366 L 248 380 Z" />
      </g>

      {/* ---------- сердце (смещено влево у человека = вправо на экране) ---------- */}
      <g
        opacity={vis('heart')}
        style={glow('heart')}
        transform={`translate(214 278) scale(${1 + beat * 0.08}) translate(-214 -278)`}
      >
        <path d="M 200 258 Q 190 272 204 292 Q 216 306 232 300 Q 244 284 232 264 Q 222 250 212 256 Q 206 252 200 258 Z" fill={COLORS.blood} />
        <path d="M 210 258 Q 208 244 220 242" stroke={COLORS.bloodDark} strokeWidth={5} fill="none" strokeLinecap="round" />
      </g>

      {/* ---------- яички ---------- */}
      <g opacity={vis('testes')} style={glow('testes')} fill={COLORS.gland}>
        <ellipse cx={193} cy={540} rx={7} ry={10} />
        <ellipse cx={207} cy={542} rx={7} ry={10} />
      </g>
    </svg>
  );
};
