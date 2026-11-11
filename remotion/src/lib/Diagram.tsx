/**
 * Схемные элементы: стрелки процессов, графики, значок «доказано/миф», иконки.
 */
import React from 'react';
import {evolvePath} from '@remotion/paths';
import {COLORS, FONT_FAMILY} from '../style';
import {useSvgId} from './svgId';

/* ============================ СТРЕЛКИ ============================ */
/** Изогнутая стрелка от (x1,y1) к (x2,y2). progress 0..1 — «прорисовка». */
export const ProcessArrow: React.FC<{
  x1: number; y1: number; x2: number; y2: number;
  bend?: number; // изгиб (0 — прямая)
  progress?: number;
  color?: string;
  width?: number;
  dashed?: boolean;
}> = ({x1, y1, x2, y2, bend = 0, progress = 1, color = COLORS.accent, width = 10, dashed = false}) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / len) * bend;
  const cy = my + (dx / len) * bend;
  const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  const evo = evolvePath(Math.max(0.0001, progress), d);
  // направление наконечника — касательная в конце кривой
  const ang = (Math.atan2(y2 - cy, x2 - cx) * 180) / Math.PI;
  const head = width * 2.6;
  return (
    <g>
      <path
        d={d}
        stroke={color}
        strokeWidth={width}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={dashed && progress >= 1 ? `${width * 2} ${width * 1.6}` : evo.strokeDasharray}
        strokeDashoffset={dashed && progress >= 1 ? 0 : evo.strokeDashoffset}
      />
      {progress > 0.97 && (
        <path
          d={`M 0 0 L ${-head} ${-head * 0.6} L ${-head * 0.75} 0 L ${-head} ${head * 0.6} Z`}
          fill={color}
          transform={`translate(${x2} ${y2}) rotate(${ang})`}
        />
      )}
    </g>
  );
};

/** Цепочка процесса: «мозг → надпочечники → адреналин». */
export const FlowChain: React.FC<{
  steps: {label: string; color?: string}[];
  width?: number;
  progress?: number; // 0..1 — сколько цепочки показано
  vertical?: boolean;
}> = ({steps, width = 900, progress = 1, vertical = true}) => {
  const n = steps.length;
  const gap = vertical ? 190 : width / n;
  const h = vertical ? gap * (n - 1) + 120 : 160;
  return (
    <svg viewBox={`0 0 ${width} ${h}`} width={width} height={h} style={{overflow: 'visible'}}>
      {steps.map((s, i) => {
        const shown = Math.min(1, Math.max(0, progress * n - i));
        const x = vertical ? width / 2 : gap * i + gap / 2;
        const y = vertical ? 60 + gap * i : 80;
        const col = s.color ?? COLORS.cell;
        const bw = Math.min(600, (vertical ? width : gap) - 20);
        return (
          <g key={i} opacity={shown}>
            {i > 0 && (
              <ProcessArrow
                x1={vertical ? x : x - gap + bw / 2 + 10}
                y1={vertical ? y - gap + 60 : y}
                x2={vertical ? x : x - bw / 2 - 10}
                y2={vertical ? y - 62 : y}
                progress={shown}
                width={9}
              />
            )}
            <rect x={x - bw / 2} y={y - 50} width={bw} height={100} rx={50} fill={COLORS.bgSoft} stroke={col} strokeWidth={6} />
            <text className="txt" x={x} y={y + 16} textAnchor="middle" fontFamily={FONT_FAMILY} fontWeight={800} fontSize={46} fill={COLORS.ink}>
              {s.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/* ============================ ГРАФИКИ ============================ */
export const LineGraph: React.FC<{
  data: number[]; // значения 0..1
  xLabels?: string[];
  yLabel?: string;
  title?: string;
  progress?: number;
  width?: number;
  height?: number;
  color?: string;
}> = ({data, xLabels = [], yLabel, title, progress = 1, width = 800, height = 500, color = COLORS.accent}) => {
  const clipId = useSvgId('graph');
  const pad = {l: 70, r: 60, t: title ? 70 : 20, b: 70};
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const pts = data.map((v, i) => [pad.l + (i / (data.length - 1)) * W, pad.t + (1 - v) * H] as const);
  // сглаженная кривая (Catmull-Rom → Безье)
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }
  const evo = evolvePath(Math.max(0.0001, progress), d);
  const area = `${d} L ${pts[pts.length - 1][0]} ${pad.t + H} L ${pts[0][0]} ${pad.t + H} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={pad.l + W * progress} height={height} />
        </clipPath>
      </defs>
      {title && (
        <text className="txt" x={width / 2} y={46} textAnchor="middle" fontFamily={FONT_FAMILY} fontWeight={800} fontSize={40} fill={COLORS.ink}>
          {title}
        </text>
      )}
      {/* сетка и оси */}
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={pad.l} x2={pad.l + W} y1={pad.t + H * g} y2={pad.t + H * g} stroke={COLORS.bgGlow} strokeWidth={2} />
      ))}
      <path d={`M ${pad.l} ${pad.t} L ${pad.l} ${pad.t + H} L ${pad.l + W} ${pad.t + H}`} stroke={COLORS.muted} strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d={area} fill={color} opacity={0.15} clipPath={`url(#${clipId})`} />
      <path d={d} stroke={color} strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray={evo.strokeDasharray} strokeDashoffset={evo.strokeDashoffset} />
      {xLabels.map((l, i) => (
        <text className="txt"
          key={i}
          x={pad.l + (i / Math.max(1, xLabels.length - 1)) * W}
          y={pad.t + H + 50}
          textAnchor="middle"
          fontFamily={FONT_FAMILY}
          fontWeight={600}
          fontSize={30}
          fill={COLORS.muted}
        >
          {l}
        </text>
      ))}
      {yLabel && (
        <text className="txt" x={24} y={pad.t + H / 2} textAnchor="middle" fontFamily={FONT_FAMILY} fontWeight={600} fontSize={30} fill={COLORS.muted} transform={`rotate(-90 24 ${pad.t + H / 2})`}>
          {yLabel}
        </text>
      )}
    </svg>
  );
};

export const BarChart: React.FC<{
  bars: {label: string; value: number; color?: string}[]; // value 0..1
  progress?: number;
  width?: number;
  height?: number;
}> = ({bars, progress = 1, width = 800, height = 480}) => {
  const base = height - 70;
  const bw = (width - 80) / bars.length;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <line x1={40} x2={width - 40} y1={base} y2={base} stroke={COLORS.muted} strokeWidth={5} strokeLinecap="round" />
      {bars.map((b, i) => {
        const h = (base - 30) * b.value * progress;
        const x = 40 + bw * i + bw * 0.18;
        return (
          <g key={i}>
            <rect x={x} y={base - h} width={bw * 0.64} height={h} rx={14} fill={b.color ?? COLORS.cell} />
            <text className="txt" x={x + bw * 0.32} y={base + 50} textAnchor="middle" fontFamily={FONT_FAMILY} fontWeight={700} fontSize={32} fill={COLORS.ink}>
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/* ===================== ЗНАЧОК ДОКАЗАТЕЛЬНОСТИ ===================== */
export type Evidence = 'proven' | 'early' | 'myth';
const EV = {
  proven: {text: 'PROVEN', color: COLORS.proven},
  early: {text: 'EARLY DATA', color: COLORS.early},
  myth: {text: 'MYTH', color: COLORS.myth},
};
export const EvidenceBadge: React.FC<{kind: Evidence; scale?: number}> = ({kind, scale = 1}) => {
  const e = EV[kind];
  return (
    <div
      className="txt"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 14 * scale,
        padding: `${10 * scale}px ${26 * scale}px ${10 * scale}px ${14 * scale}px`,
        borderRadius: 999,
        background: COLORS.bgSoft,
        border: `${5 * scale}px solid ${e.color}`,
        fontFamily: FONT_FAMILY,
        fontWeight: 900,
        fontSize: 38 * scale,
        color: e.color,
        letterSpacing: 1,
      }}
    >
      <svg width={44 * scale} height={44 * scale} viewBox="0 0 44 44">
        <circle cx={22} cy={22} r={20} fill={e.color} />
        {kind === 'proven' && <path d="M 12 23 L 19 30 L 32 15" stroke={COLORS.bg} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        {kind === 'early' && <path d="M 22 11 L 22 25 M 22 32 L 22 33" stroke={COLORS.bg} strokeWidth={5} strokeLinecap="round" />}
        {kind === 'myth' && <path d="M 14 14 L 30 30 M 30 14 L 14 30" stroke={COLORS.bg} strokeWidth={5} strokeLinecap="round" />}
      </svg>
      {e.text}
    </div>
  );
};

/* ============================== ИКОНКИ ============================== */
export type IconName = 'sleep' | 'food' | 'exercise' | 'stress' | 'weight' | 'clock' | 'water' | 'sun' | 'flask' | 'alcohol';
export const ICONS: IconName[] = ['sleep', 'food', 'exercise', 'stress', 'weight', 'clock', 'water', 'sun', 'flask', 'alcohol'];

export const Icon: React.FC<{name: IconName; size?: number; color?: string}> = ({name, size = 120, color = COLORS.ink}) => {
  const sw = 7;
  const common = {stroke: color, strokeWidth: sw, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  const body: Record<IconName, React.ReactNode> = {
    sleep: (
      <g>
        <path d="M 62 20 A 32 32 0 1 0 82 74 A 26 26 0 1 1 62 20 Z" fill={COLORS.accent} stroke="none" />
        <path d="M 66 22 L 84 22 L 66 40 L 84 40" {...common} strokeWidth={5} />
      </g>
    ),
    food: (
      <g>
        <path d="M 50 34 C 30 20, 14 40, 18 60 C 22 84, 40 90, 50 84 C 60 90, 78 84, 82 60 C 86 40, 70 20, 50 34 Z" fill={COLORS.proven} stroke="none" />
        <path d="M 50 34 Q 52 20 60 14" {...common} />
      </g>
    ),
    exercise: (
      <g {...common}>
        <line x1={24} y1={50} x2={76} y2={50} />
        <rect x={12} y={32} width={12} height={36} rx={4} fill={color} />
        <rect x={76} y={32} width={12} height={36} rx={4} fill={color} />
        <line x1={6} y1={50} x2={12} y2={50} />
        <line x1={88} y1={50} x2={94} y2={50} />
      </g>
    ),
    stress: <path d="M 56 8 L 26 54 L 48 54 L 40 92 L 74 40 L 52 40 Z" fill={COLORS.early} stroke="none" />,
    weight: (
      <g {...common}>
        <path d="M 20 86 L 28 34 L 72 34 L 80 86 Z" />
        <circle cx={50} cy={22} r={10} />
        <path d="M 40 62 L 50 50" />
      </g>
    ),
    clock: (
      <g {...common}>
        <circle cx={50} cy={50} r={36} />
        <path d="M 50 28 L 50 50 L 66 60" />
      </g>
    ),
    water: <path d="M 50 12 C 66 36, 76 50, 76 64 A 26 26 0 0 1 24 64 C 24 50, 34 36, 50 12 Z" fill={COLORS.cell} stroke="none" />,
    sun: (
      <g {...common} stroke={COLORS.accent}>
        <circle cx={50} cy={50} r={18} fill={COLORS.accent} />
        {Array.from({length: 8}, (_, i) => {
          const a = (i * Math.PI) / 4;
          return <line key={i} x1={50 + Math.cos(a) * 28} y1={50 + Math.sin(a) * 28} x2={50 + Math.cos(a) * 40} y2={50 + Math.sin(a) * 40} />;
        })}
      </g>
    ),
    flask: (
      <g {...common}>
        <path d="M 38 12 L 62 12 M 42 12 L 42 40 L 20 84 L 80 84 L 58 40 L 58 12" />
        <path d="M 30 66 L 70 66 L 78 82 L 22 82 Z" fill={COLORS.hormone} stroke="none" />
      </g>
    ),
    alcohol: (
      <g {...common}>
        <path d="M 28 14 L 72 14 Q 72 54 50 56 Q 28 54 28 14 Z" />
        <path d="M 31 32 L 69 32 Q 66 52 50 52 Q 34 52 31 32 Z" fill={COLORS.blood} stroke="none" />
        <path d="M 50 56 L 50 84 M 34 86 L 66 86" />
      </g>
    ),
  };
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{overflow: 'visible'}}>
      {body[name]}
    </svg>
  );
};
