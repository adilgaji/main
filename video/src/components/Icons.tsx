// Значки для кадров «Сцена» и «Тогда / сейчас»: простые силуэты, нарисованные кодом.
// Каждый значок рисуется в рамке высотой 100 единиц; ширина рамки у каждого своя.
// Точка привязки — середина нижнего края: предмет «стоит» на земле.
import React from 'react';

export const ICON_NAMES = [
  'hoplite', 'soldier', 'shield', 'helmet', 'spear', 'ship', 'tent', 'tree', 'column', 'temple',
  'wall', 'rock', 'fire', 'banner', 'pyramid', 'house', 'amphora', 'scroll', 'crown', 'coin',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

/** Ширина рамки значка (высота всегда 100). */
export const ICON_WIDTH: Record<IconName, number> = {
  hoplite: 60, soldier: 56, shield: 100, helmet: 96, spear: 16, ship: 190, tent: 120, tree: 46, column: 40, temple: 170,
  wall: 200, rock: 130, fire: 70, banner: 60, pyramid: 180, house: 130, amphora: 70, scroll: 120, crown: 120, coin: 100,
};

export type IconColors = {main: string; shade: string; hi: string; line: string};

type P = {c: IconColors; t: number};

const Hoplite: React.FC<P> = ({c}) => (
  <g>
    <line x1={12} y1={99} x2={17} y2={2} stroke={c.line} strokeWidth={2.2} strokeLinecap="round" />
    <path d="M17 2 l-3.2 9 h6.4 z" fill={c.line} />
    <rect x={22} y={70} width={6.5} height={28} rx={2} fill={c.shade} />
    <rect x={32} y={70} width={6.5} height={28} rx={2} fill={c.main} />
    <path d="M20 98 h10 v2 h-10z M31 98 h10 v2 h-10z" fill={c.shade} />
    <path d="M19 38 q11 -6 22 0 l3 36 h-28 z" fill={c.main} />
    <circle cx={30} cy={27} r={7.5} fill={c.main} />
    <path d="M21.5 27 a8.5 8.5 0 0 1 17 0 v5 h-4 v-4 h-9 v4 h-4 z" fill={c.shade} />
    <path d="M20 22 q10 -19 21 -1 q-10 -8 -21 1 z" fill={c.hi} />
    <circle cx={39} cy={55} r={18} fill={c.hi} stroke={c.shade} strokeWidth={2.4} />
    <circle cx={39} cy={55} r={11.5} fill="none" stroke={c.shade} strokeWidth={1.4} opacity={0.7} />
    <circle cx={39} cy={55} r={3.4} fill={c.shade} />
  </g>
);

const Soldier: React.FC<P> = ({c}) => (
  <g>
    <line x1={44} y1={99} x2={41} y2={10} stroke={c.line} strokeWidth={2} strokeLinecap="round" />
    <path d="M41 10 l-2.6 7 h5.2 z" fill={c.line} />
    <rect x={20} y={74} width={6} height={24} rx={2} fill={c.shade} />
    <rect x={29} y={74} width={6} height={24} rx={2} fill={c.main} />
    <path d="M17 40 q11 -6 21 0 l4 38 h-29 z" fill={c.main} />
    <path d="M14 78 h29 l1 4 h-31 z" fill={c.hi} />
    <circle cx={27.5} cy={29} r={7.2} fill={c.main} />
    <path d="M19.5 28 q1 -11 9 -11 q8 0 8 9 q3 6 0 12 l-3 -8 h-11 q-2 4 -3 -2 z" fill={c.shade} />
    <rect x={9} y={44} width={15} height={30} rx={3} fill={c.hi} stroke={c.shade} strokeWidth={1.8} />
    <path d="M9 52 h15 M9 59 h15 M9 66 h15" stroke={c.shade} strokeWidth={1.1} opacity={0.7} />
  </g>
);

const Shield: React.FC<P> = ({c}) => (
  <g>
    <circle cx={50} cy={50} r={48} fill={c.shade} />
    <circle cx={50} cy={50} r={43} fill={c.hi} />
    <circle cx={50} cy={50} r={31} fill="none" stroke={c.shade} strokeWidth={3} opacity={0.75} />
    <circle cx={50} cy={50} r={9} fill={c.shade} />
    <path d="M22 28 a36 36 0 0 1 30 -15" fill="none" stroke={c.line} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
  </g>
);

const Helmet: React.FC<P> = ({c}) => (
  <g>
    <path d="M10 44 q4 -40 40 -40 q36 0 38 40 q-30 -34 -78 0 z" fill={c.hi} />
    <path d="M22 100 v-46 q0 -40 28 -40 q28 0 28 40 v46 h-16 v-34 q-12 -10 -12 -18 h-12 v10 h-6 v42 z" fill={c.main} />
    <path d="M38 48 h30 q2 6 -4 12 h-26 z" fill={c.shade} />
    <path d="M22 54 q0 -40 28 -40" fill="none" stroke={c.line} strokeWidth={2.4} opacity={0.3} />
  </g>
);

const Spear: React.FC<P> = ({c}) => (
  <g>
    <line x1={8} y1={99} x2={8} y2={14} stroke={c.main} strokeWidth={3} strokeLinecap="round" />
    <path d="M8 0 l-5.5 16 h11 z" fill={c.hi} />
  </g>
);

const Ship: React.FC<P> = ({c, t}) => {
  const bob = Math.sin(t * 1.6) * 1.2;
  return (
    <g transform={`translate(0 ${bob})`}>
      {Array.from({length: 11}, (_, i) => (
        <line key={i} x1={38 + i * 10} y1={76} x2={32 + i * 10 + Math.sin(t * 2.4) * 2.5} y2={97} stroke={c.line} strokeWidth={1.3} opacity={0.75} />
      ))}
      <path d="M6 70 l16 4 h130 q18 0 26 -30 q4 22 -8 40 q-4 6 -14 6 h-112 q-26 0 -38 -20 z" fill={c.main} />
      <path d="M22 74 h130 q12 0 18 -10" fill="none" stroke={c.hi} strokeWidth={2.4} />
      <rect x={92} y={10} width={3} height={62} fill={c.shade} />
      <path d="M58 16 h72 q-6 22 0 42 h-72 q6 -20 0 -42 z" fill={c.hi} />
      <path d="M58 30 h72 M58 44 h72" stroke={c.shade} strokeWidth={1.4} opacity={0.5} />
      <circle cx={24} cy={78} r={2.6} fill={c.hi} />
    </g>
  );
};

const Tent: React.FC<P> = ({c}) => (
  <g>
    <path d="M60 8 l56 92 h-112 z" fill={c.main} />
    <path d="M60 8 l-16 92 h32 z" fill={c.shade} />
    <path d="M60 8 v-8" stroke={c.line} strokeWidth={2.4} />
    <path d="M60 0 l16 5 l-16 5 z" fill={c.hi} />
  </g>
);

const Tree: React.FC<P> = ({c}) => (
  <g>
    <rect x={20} y={78} width={6} height={22} fill={c.shade} />
    <path d="M23 2 q20 40 12 78 q-12 8 -24 0 q-8 -38 12 -78 z" fill={c.main} />
    <path d="M23 2 q8 40 4 82 q8 -2 8 -4 q8 -38 -12 -78 z" fill={c.shade} opacity={0.6} />
  </g>
);

const Column: React.FC<P> = ({c}) => (
  <g>
    <rect x={2} y={0} width={36} height={7} fill={c.hi} />
    <path d="M5 7 h30 l-3 7 h-24 z" fill={c.main} />
    <rect x={8} y={14} width={24} height={78} fill={c.main} />
    <path d="M14 14 v78 M20 14 v78 M26 14 v78" stroke={c.shade} strokeWidth={1.6} opacity={0.7} />
    <rect x={3} y={92} width={34} height={8} fill={c.shade} />
  </g>
);

const Temple: React.FC<P> = ({c}) => (
  <g>
    <path d="M85 2 l80 30 h-160 z" fill={c.main} />
    <path d="M85 11 l52 19 h-104 z" fill={c.shade} />
    <rect x={8} y={32} width={154} height={7} fill={c.hi} />
    {Array.from({length: 7}, (_, i) => (
      <g key={i}>
        <rect x={14 + i * 22.4} y={39} width={10} height={48} fill={c.main} />
        <line x1={19 + i * 22.4} y1={39} x2={19 + i * 22.4} y2={87} stroke={c.shade} strokeWidth={1.3} opacity={0.7} />
      </g>
    ))}
    <rect x={6} y={87} width={158} height={6} fill={c.main} />
    <rect x={0} y={93} width={170} height={7} fill={c.shade} />
  </g>
);

const Wall: React.FC<P> = ({c}) => (
  <g>
    <rect x={0} y={52} width={200} height={48} fill={c.main} />
    {[52, 68, 84].map((y, r) => (
      <g key={y} stroke={c.shade} strokeWidth={1.6} opacity={0.75}>
        <line x1={0} y1={y} x2={200} y2={y} />
        {Array.from({length: 7}, (_, i) => (
          <line key={i} x1={(r % 2 ? 16 : 30) + i * 30} y1={y} x2={(r % 2 ? 16 : 30) + i * 30} y2={y + 16} />
        ))}
      </g>
    ))}
    {Array.from({length: 7}, (_, i) => (
      <rect key={i} x={4 + i * 29} y={40} width={17} height={12} fill={c.main} />
    ))}
  </g>
);

const Rock: React.FC<P> = ({c}) => (
  <g>
    <path d="M4 100 l14 -46 l26 -30 l34 -12 l30 30 l18 58 z" fill={c.main} />
    <path d="M44 24 l34 -12 l30 30 l-34 6 z" fill={c.hi} opacity={0.55} />
    <path d="M74 48 l34 -6 l18 58 h-44 z" fill={c.shade} opacity={0.7} />
  </g>
);

const Fire: React.FC<P> = ({c, t}) => {
  const k = 1 + Math.sin(t * 11) * 0.07 + Math.sin(t * 17.3) * 0.05;
  return (
    <g>
      <g transform={`translate(35 88) scale(1 ${k}) translate(-35 -88)`}>
        <path d="M35 6 q26 34 16 60 q-6 22 -16 22 q-10 0 -16 -22 q-10 -26 16 -60 z" fill={c.hi} />
        <path d="M35 40 q12 18 7 32 q-3 14 -7 14 q-4 0 -7 -14 q-5 -14 7 -32 z" fill={c.line} opacity={0.85} />
      </g>
      <path d="M6 92 l56 -8 l2 8 l-56 8 z M8 84 l56 8 l-2 8 l-56 -8 z" fill={c.shade} />
    </g>
  );
};

const Banner: React.FC<P> = ({c, t}) => {
  const w = Math.sin(t * 3) * 4;
  return (
    <g>
      <rect x={8} y={0} width={3.4} height={100} fill={c.main} />
      <path d={`M11 4 q14 ${-4 + w} 26 2 t22 ${w * 0.6} v30 q-12 ${4 - w} -24 -2 t-24 ${-w * 0.5} z`} fill={c.hi} />
      <circle cx={9.7} cy={2} r={3.4} fill={c.hi} />
    </g>
  );
};

const Pyramid: React.FC<P> = ({c}) => (
  <g>
    <path d="M90 2 l88 98 h-176 z" fill={c.main} />
    <path d="M90 2 l88 98 h-60 z" fill={c.shade} opacity={0.75} />
  </g>
);

const House: React.FC<P> = ({c}) => (
  <g>
    <rect x={8} y={34} width={114} height={66} fill={c.main} />
    <rect x={2} y={26} width={126} height={10} fill={c.hi} />
    <rect x={54} y={58} width={22} height={42} fill={c.shade} />
    <rect x={20} y={50} width={16} height={14} fill={c.shade} />
    <rect x={94} y={50} width={16} height={14} fill={c.shade} />
  </g>
);

const Amphora: React.FC<P> = ({c}) => (
  <g>
    <path d="M24 12 q-18 4 -14 26 M46 12 q18 4 14 26" fill="none" stroke={c.shade} strokeWidth={4.5} strokeLinecap="round" />
    <path d="M26 2 h18 v6 q-3 4 -3 10 q22 8 22 34 q0 28 -22 42 h6 v6 h-24 v-6 h6 q-22 -14 -22 -42 q0 -26 22 -34 q0 -6 -3 -10 z" fill={c.main} />
    <path d="M8 46 h54 M9 60 h52" stroke={c.hi} strokeWidth={4} />
    <path d="M18 28 q-10 12 -8 30" fill="none" stroke={c.line} strokeWidth={2.4} opacity={0.3} />
  </g>
);

const Scroll: React.FC<P> = ({c}) => (
  <g>
    <rect x={14} y={22} width={92} height={60} fill={c.hi} />
    <path d="M26 36 h68 M26 46 h68 M26 56 h54 M26 66 h62" stroke={c.shade} strokeWidth={2.6} opacity={0.6} strokeLinecap="round" />
    <rect x={4} y={14} width={16} height={76} rx={8} fill={c.main} />
    <rect x={100} y={14} width={16} height={76} rx={8} fill={c.main} />
    <path d="M8 22 v60" stroke={c.shade} strokeWidth={2} opacity={0.6} />
    <path d="M112 22 v60" stroke={c.shade} strokeWidth={2} opacity={0.6} />
  </g>
);

const Crown: React.FC<P> = ({c}) => (
  <g>
    <path d="M8 84 l-4 -58 l30 30 l26 -46 l26 46 l30 -30 l-4 58 z" fill={c.hi} />
    <rect x={8} y={82} width={104} height={14} rx={3} fill={c.main} />
    <circle cx={60} cy={10} r={6} fill={c.main} />
    <circle cx={4} cy={26} r={5} fill={c.main} />
    <circle cx={116} cy={26} r={5} fill={c.main} />
    <path d="M24 89 h72" stroke={c.shade} strokeWidth={3} opacity={0.6} strokeLinecap="round" />
  </g>
);

const Coin: React.FC<P> = ({c}) => (
  <g>
    <circle cx={50} cy={50} r={48} fill={c.shade} />
    <circle cx={50} cy={50} r={42} fill={c.hi} />
    <circle cx={50} cy={50} r={34} fill="none" stroke={c.shade} strokeWidth={2.4} opacity={0.6} strokeDasharray="3 5" />
    <path d="M50 28 l6 15 l16 1 l-12 10 l4 16 l-14 -9 l-14 9 l4 -16 l-12 -10 l16 -1 z" fill={c.shade} opacity={0.7} />
  </g>
);

const DRAW: Record<IconName, React.FC<P>> = {
  hoplite: Hoplite, soldier: Soldier, shield: Shield, helmet: Helmet, spear: Spear, ship: Ship, tent: Tent, tree: Tree,
  column: Column, temple: Temple, wall: Wall, rock: Rock, fire: Fire, banner: Banner, pyramid: Pyramid, house: House,
  amphora: Amphora, scroll: Scroll, crown: Crown, coin: Coin,
};

/**
 * Значок внутри <svg>. (x, y) — точка, где предмет стоит на земле; size — высота в пикселях.
 * t — время кадра в секундах (для огня, флага, вёсел).
 */
export const Icon: React.FC<{name: IconName; x: number; y: number; size: number; colors: IconColors; flip?: boolean; t?: number; opacity?: number}> = ({
  name,
  x,
  y,
  size,
  colors,
  flip = false,
  t = 0,
  opacity = 1,
}) => {
  const Draw = DRAW[name] ?? Rock;
  const k = size / 100;
  const w = ICON_WIDTH[name] ?? 100;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -k : k} ${k}) translate(${-w / 2} -100)`} opacity={opacity}>
      <Draw c={colors} t={t} />
    </g>
  );
};
