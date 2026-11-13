/**
 * Фоны-локации: настоящие места, спокойные приглушённые цвета, минимализм.
 * Одна локация на ролик (класс, аудитория, лаборатория, спортзал, кухня, спальня),
 * в каждом кадре — своя вариация (декор, доска, свет, ракурс). Схема кадра «на доске».
 * Цвета берутся из палитры стиля (themes.ts) и приглушаются.
 */
import React from 'react';
import {AbsoluteFill, random} from 'remotion';
import {COLORS} from '../style';
import {getSize} from './Env';

export type LocationKind = 'classroom' | 'lecture' | 'lab' | 'gym' | 'kitchen' | 'bedroom';
export const LOCATIONS: LocationKind[] = ['classroom', 'lecture', 'lab', 'gym', 'kitchen', 'bedroom'];
export type BoardKind = 'chalk' | 'white' | 'screen';

/** Выбор локации по теме ролика. */
export const locationFor = (text: string): LocationKind => {
  const t = text.toLowerCase();
  if (/sleep|night|bed|dream|tired|insomnia/.test(t)) return 'bedroom';
  if (/food|eat|meal|protein|diet|sugar|digest|stomach|water|drink|coffee|caffeine/.test(t)) return 'kitchen';
  if (/muscle|train|workout|gym|lift|exercise|strength|run/.test(t)) return 'gym';
  if (/hormone|cell|dna|molecule|lab|test|blood/.test(t)) return 'lab';
  if (/brain|stress|nervous|focus|memory|learn|mood/.test(t)) return 'classroom';
  return 'classroom';
};

/** Какая доска в каждой локации (чередуется по вариациям). */
const BOARDS: Record<LocationKind, BoardKind[]> = {
  classroom: ['chalk', 'white', 'chalk'],
  lecture: ['screen', 'screen', 'white'],
  lab: ['white', 'screen', 'white'],
  gym: ['white', 'screen', 'white'],
  kitchen: ['chalk', 'white', 'chalk'],
  bedroom: ['screen', 'white', 'screen'],
};
export const boardFor = (loc: LocationKind, variant: number): BoardKind => BOARDS[loc][variant % BOARDS[loc].length];

/* ------------------------------ мелкие предметы ------------------------------ */
const line = () => COLORS.muted;
const Clock: React.FC<{x: number; y: number; r: number; h: number}> = ({x, y, r, h}) => {
  const a = (h / 12) * Math.PI * 2;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={COLORS.bgGlow} stroke={line()} strokeWidth={6} />
      <line x1={x} y1={y} x2={x + Math.sin(a) * r * 0.5} y2={y - Math.cos(a) * r * 0.5} stroke={line()} strokeWidth={6} strokeLinecap="round" />
      <line x1={x} y1={y} x2={x} y2={y - r * 0.75} stroke={line()} strokeWidth={4} strokeLinecap="round" />
    </g>
  );
};
const Window: React.FC<{x: number; y: number; w: number; h: number; night?: boolean}> = ({x, y, w, h, night}) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={10} fill={night ? '#1C2540' : COLORS.cell} opacity={night ? 0.9 : 0.22} />
    {night && <circle cx={x + w * 0.7} cy={y + h * 0.3} r={w * 0.12} fill={COLORS.accent} opacity={0.7} />}
    <rect x={x} y={y} width={w} height={h} rx={10} fill="none" stroke={line()} strokeWidth={10} />
    <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke={line()} strokeWidth={8} />
    <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke={line()} strokeWidth={8} />
    <rect x={x - 14} y={y + h} width={w + 28} height={16} rx={6} fill={line()} opacity={0.6} />
  </g>
);
const Poster: React.FC<{x: number; y: number; w: number; h: number; c: string}> = ({x, y, w, h, c}) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={8} fill={COLORS.bgGlow} stroke={line()} strokeWidth={5} />
    <circle cx={x + w / 2} cy={y + h * 0.35} r={Math.min(w, h) * 0.2} fill={c} opacity={0.55} />
    {[0, 1, 2].map((i) => (
      <line key={i} x1={x + w * 0.15} x2={x + w * 0.85} y1={y + h * (0.65 + i * 0.1)} y2={y + h * (0.65 + i * 0.1)} stroke={line()} strokeWidth={4} opacity={0.6} />
    ))}
  </g>
);
const Shelf: React.FC<{x: number; y: number; w: number; seed: string; jars?: boolean}> = ({x, y, w, seed, jars}) => {
  const cols = [COLORS.blood, COLORS.cell, COLORS.gland, COLORS.accent, COLORS.hormone];
  let cx = x + 10;
  const items: React.ReactNode[] = [];
  for (let i = 0; cx < x + w - 40; i++) {
    const bw = jars ? 46 : 22 + random(`${seed}b${i}`) * 22;
    const bh = jars ? 60 + random(`${seed}h${i}`) * 30 : 70 + random(`${seed}h${i}`) * 50;
    items.push(
      jars ? (
        <g key={i}>
          <rect x={cx} y={y - bh} width={bw} height={bh} rx={10} fill={cols[i % cols.length]} opacity={0.35} />
          <rect x={cx + 8} y={y - bh - 12} width={bw - 16} height={14} rx={4} fill={line()} opacity={0.6} />
        </g>
      ) : (
        <rect key={i} x={cx} y={y - bh} width={bw} height={bh} rx={3} fill={cols[i % cols.length]} opacity={0.45} />
      ),
    );
    cx += bw + (jars ? 24 : 6);
  }
  return (
    <g>
      {items}
      <rect x={x} y={y} width={w} height={14} rx={4} fill={line()} opacity={0.7} />
    </g>
  );
};
const Plant: React.FC<{x: number; y: number; s: number}> = ({x, y, s}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {[-50, -20, 10, 40].map((a, i) => (
      <ellipse key={i} cx={Math.sin((a * Math.PI) / 180) * 50} cy={-90 - (i % 2) * 30} rx={22} ry={60} fill={COLORS.gland} opacity={0.6} transform={`rotate(${a} ${Math.sin((a * Math.PI) / 180) * 50} ${-90 - (i % 2) * 30})`} />
    ))}
    <path d="M -45 -30 L 45 -30 L 34 40 L -34 40 Z" fill={COLORS.organ} opacity={0.75} />
  </g>
);
const Lamp: React.FC<{x: number; y: number}> = ({x, y}) => (
  <g>
    <line x1={x} y1={0} x2={x} y2={y - 40} stroke={line()} strokeWidth={5} />
    <path d={`M ${x - 70} ${y} L ${x + 70} ${y} L ${x + 34} ${y - 44} L ${x - 34} ${y - 44} Z`} fill={COLORS.bgGlow} stroke={line()} strokeWidth={5} />
    <ellipse cx={x} cy={y + 8} rx={60} ry={12} fill={COLORS.accent} opacity={0.35} />
  </g>
);

/* ------------------------------ доска (в слое схемы) ------------------------------ */
/** Доска/экран, на котором «нарисована» схема кадра. Координаты сцены 1080x1920. */
export const Board: React.FC<{kind: BoardKind}> = ({kind}) => {
  const box = {x: 70, y: 420, w: 940, h: 660};
  const surface = kind === 'chalk' ? '#2F4A3E' : kind === 'white' ? '#EEF1EE' : '#20242E';
  const frame = kind === 'screen' ? '#3A3F4D' : '#9C7A55';
  return (
    <div style={{position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: 18, background: surface, boxShadow: `0 0 0 16px ${frame}, 0 24px 40px rgba(0,0,0,0.25)`, opacity: 0.94}}>
      {kind === 'chalk' && (
        <>
          <div style={{position: 'absolute', inset: 0, borderRadius: 18, background: 'radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.07), transparent 60%)'}} />
          <div style={{position: 'absolute', left: 60, right: 60, bottom: -34, height: 18, borderRadius: 6, background: frame}} />
        </>
      )}
      {kind === 'white' && <div style={{position: 'absolute', left: 60, right: 60, bottom: -34, height: 18, borderRadius: 6, background: '#B9B9B9'}} />}
    </div>
  );
};

/* ------------------------------ комнаты (фон на весь кадр) ------------------------------ */
export const Location: React.FC<{kind: LocationKind; variant: number}> = ({kind, variant}) => {
  const {W, H} = getSize();
  const seed = `${kind}${variant}`;
  const wide = W > H;
  const floorY = wide ? H * 0.8 : H * 0.66;
  const flip = variant % 2 === 1; // зеркальный ракурс
  const hour = [9, 11, 2, 4, 7, 10][variant % 6];
  const warm = variant % 3 === 2; // вечерний свет
  const night = kind === 'bedroom' && variant % 2 === 0;
  // точки для декора (слева/справа от доски; в горизонтальном кадре — справа, за панелью)
  const sideX = wide ? W * 0.75 : flip ? W * 0.72 : W * 0.08;
  const sideX2 = wide ? W * 0.88 : flip ? W * 0.08 : W * 0.72;
  const topY = wide ? H * 0.12 : H * 0.02;

  return (
    <AbsoluteFill style={{filter: 'saturate(0.7)'}}>
      {/* стена и пол */}
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${COLORS.bgGlow} 0%, ${COLORS.bgSoft} ${(floorY / H) * 100}%, ${COLORS.bg} ${(floorY / H) * 100}%, ${COLORS.bg} 100%)`}} />
      <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
        {/* плинтус и доски пола */}
        <rect x={0} y={floorY - 10} width={W} height={14} fill={line()} opacity={0.5} />
        {Array.from({length: 8}, (_, i) => (
          <line key={i} x1={(i / 8) * W * 1.6 - W * 0.3} y1={floorY} x2={(i / 8) * W * 2 - W * 0.5} y2={H} stroke={line()} strokeOpacity={0.12} strokeWidth={4} />
        ))}
        {/* потолочные лампы */}
        {(kind === 'classroom' || kind === 'lab' || kind === 'lecture' || kind === 'gym') &&
          [0.25, 0.75].map((f, i) => <Lamp key={i} x={W * f} y={wide ? H * 0.08 : 110} />)}

        {kind === 'classroom' && (
          <>
            <Clock x={sideX + 70} y={topY + 120} r={56} h={hour} />
            <Poster x={sideX} y={topY + 220} w={150} h={200} c={COLORS.cell} />
            {variant % 3 !== 1 ? <Window x={sideX2} y={topY + 60} w={wide ? 200 : 260} h={wide ? 260 : 220} /> : <Plant x={sideX2 + 120} y={floorY - 40} s={1.4} />}
            {/* парты */}
            {Array.from({length: wide ? 4 : 3}, (_, i) => (
              <g key={i} opacity={0.75}>
                <path d={`M ${W * (0.05 + i * 0.32)} ${floorY + 70} L ${W * (0.3 + i * 0.32)} ${floorY + 70} L ${W * (0.32 + i * 0.32)} ${floorY + 110} L ${W * (0.03 + i * 0.32)} ${floorY + 110} Z`} fill={COLORS.organ} opacity={0.55} />
                <rect x={W * (0.06 + i * 0.32)} y={floorY + 110} width={12} height={90} fill={line()} />
                <rect x={W * (0.28 + i * 0.32)} y={floorY + 110} width={12} height={90} fill={line()} />
              </g>
            ))}
          </>
        )}

        {kind === 'lecture' && (
          <>
            {Array.from({length: 4}, (_, r) => (
              <path key={r} d={`M ${-100} ${floorY + 60 + r * 90} Q ${W / 2} ${floorY + 10 + r * 90} ${W + 100} ${floorY + 60 + r * 90}`} stroke={COLORS.organ} strokeOpacity={0.5} strokeWidth={46} fill="none" />
            ))}
            {Array.from({length: 18}, (_, i) => (
              <circle key={i} cx={(i / 18) * W + 30} cy={floorY + 20 + (i % 3) * 90} r={20} fill={line()} opacity={0.35} />
            ))}
            <Poster x={sideX} y={topY + 120} w={140} h={180} c={COLORS.hormone} />
          </>
        )}

        {kind === 'lab' && (
          <>
            <Shelf x={sideX - 20} y={topY + 260} w={240} seed={`${seed}a`} jars />
            <Shelf x={sideX2 - 20} y={topY + 200} w={240} seed={`${seed}b`} jars />
            {/* стол с колбами и микроскопом */}
            <rect x={0} y={floorY + 40} width={W} height={34} fill={COLORS.organ} opacity={0.5} />
            {[0.15, 0.45, 0.8].map((f, i) => (
              <g key={i} transform={`translate(${W * f} ${floorY + 40})`} opacity={0.8}>
                <path d="M -18 -110 L 18 -110 L 18 -70 L 46 -10 L -46 -10 L -18 -70 Z" fill={[COLORS.cell, COLORS.gland, COLORS.hormone][i]} opacity={0.5} stroke={line()} strokeWidth={4} />
              </g>
            ))}
            <g transform={`translate(${flip ? W * 0.12 : W * 0.88} ${floorY + 40})`} stroke={line()} strokeWidth={10} fill="none" strokeLinecap="round">
              <path d="M -50 0 L 50 0 M 0 0 L 0 -40 Q 30 -90 -10 -150 M -30 -150 L 10 -150 M -20 -60 L 20 -60" />
            </g>
          </>
        )}

        {kind === 'gym' && (
          <>
            {/* стойка с гантелями */}
            <rect x={0} y={floorY - 150} width={W} height={12} fill={line()} opacity={0.6} />
            {Array.from({length: wide ? 10 : 6}, (_, i) => (
              <g key={i} transform={`translate(${60 + i * (W / (wide ? 10 : 6))} ${floorY - 170})`} opacity={0.75}>
                <rect x={-32} y={-18} width={16} height={36} rx={4} fill={line()} />
                <rect x={16} y={-18} width={16} height={36} rx={4} fill={line()} />
                <rect x={-16} y={-5} width={32} height={10} fill={line()} />
              </g>
            ))}
            {/* зеркало */}
            <rect x={sideX} y={topY + 80} width={wide ? 260 : 220} height={wide ? 360 : 330} rx={12} fill={COLORS.cell} opacity={0.12} stroke={line()} strokeWidth={6} />
            <g transform={`translate(${sideX2 + 90} ${floorY + 60})`} opacity={0.75}>
              <circle r={54} fill={line()} />
              <path d="M -30 -50 Q 0 -100 30 -50" stroke={line()} strokeWidth={16} fill="none" />
            </g>
          </>
        )}

        {kind === 'kitchen' && (
          <>
            {/* верхние шкафы */}
            {Array.from({length: wide ? 6 : 3}, (_, i) => (
              <rect key={i} x={20 + i * (W / (wide ? 6 : 3))} y={topY} width={W / (wide ? 6 : 3) - 30} height={wide ? 170 : 220} rx={10} fill={COLORS.bgGlow} stroke={line()} strokeWidth={5} />
            ))}
            {/* столешница */}
            <rect x={0} y={floorY - 40} width={W} height={40} fill={COLORS.organ} opacity={0.6} />
            <rect x={0} y={floorY} width={W} height={H - floorY} fill={COLORS.bgSoft} opacity={0.6} />
            <g transform={`translate(${flip ? W * 0.82 : W * 0.15} ${floorY - 40})`}>
              <path d="M -80 0 Q 0 -70 80 0 Z" fill={COLORS.bgGlow} stroke={line()} strokeWidth={5} />
              <circle cx={-30} cy={-34} r={24} fill={COLORS.blood} opacity={0.7} />
              <circle cx={12} cy={-40} r={22} fill={COLORS.gland} opacity={0.7} />
              <circle cx={44} cy={-28} r={20} fill={COLORS.accent} opacity={0.7} />
            </g>
            <Plant x={flip ? W * 0.15 : W * 0.85} y={floorY - 70} s={0.9} />
          </>
        )}

        {kind === 'bedroom' && (
          <>
            <Window x={sideX2} y={topY + 80} w={wide ? 220 : 260} h={wide ? 280 : 300} night={night} />
            {/* кровать */}
            <g opacity={0.85}>
              <rect x={flip ? W * 0.45 : -40} y={floorY - 40} width={W * 0.6} height={120} rx={20} fill={COLORS.cell} opacity={0.35} />
              <rect x={flip ? W * 0.45 : -40} y={floorY - 140} width={40} height={220} rx={10} fill={COLORS.organ} opacity={0.6} />
              <rect x={flip ? W * 0.5 : 20} y={floorY - 70} width={180} height={50} rx={22} fill={COLORS.bgGlow} />
            </g>
            {/* ночник */}
            <g transform={`translate(${flip ? W * 0.3 : W * 0.68} ${floorY - 10})`}>
              <rect x={-40} y={-80} width={80} height={80} rx={6} fill={COLORS.organ} opacity={0.6} />
              <path d="M -30 -150 L 30 -150 L 44 -100 L -44 -100 Z" fill={COLORS.accent} opacity={night ? 0.8 : 0.4} />
              <rect x={-4} y={-100} width={8} height={22} fill={line()} />
            </g>
            <Clock x={sideX + 70} y={topY + 150} r={50} h={hour} />
          </>
        )}
      </svg>
      {/* свет: утро/день/вечер и мягкая виньетка — фон не спорит со схемой */}
      <AbsoluteFill style={{background: warm ? 'rgba(255,170,90,0.06)' : night ? 'rgba(20,30,70,0.18)' : 'transparent'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.22) 100%)'}} />
    </AbsoluteFill>
  );
};

/** Вариации по кадрам: соседние кадры никогда не одинаковые. */
export const pickVariants = (n: number): number[] => Array.from({length: n}, (_, i) => (i * 7 + Math.floor(i / 6)) % 6);
