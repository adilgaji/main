/**
 * Фоны-«среды»: кадр никогда не пустой. Каждая среда — живой фон по теме кадра.
 *  muscle — мышечная ткань и капилляр; blood — сосуд с эритроцитами;
 *  neural — сеть нейронов; cells — много клеток; soft — мягкий фон с частицами (графики, списки).
 * Цвета — из текущей палитры (стиль видео).
 */
import React from 'react';
import {AbsoluteFill, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, VIDEO} from '../style';
import {MuscleFiber} from './MuscleFiber';

export type EnvKind = 'muscle' | 'blood' | 'neural' | 'cells' | 'soft';
const W = VIDEO.width;
const H = VIDEO.height;

const Glow: React.FC = () => (
  <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 42%, ${COLORS.bgGlow} 0%, ${COLORS.bg} 78%)`}} />
);

const Particles: React.FC<{n?: number; seed?: string}> = ({n = 40, seed = 'p'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  return (
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      {Array.from({length: n}, (_, i) => {
        const x = random(`${seed}x${i}`) * W;
        const y = (random(`${seed}y${i}`) * H - t * (8 + random(`${seed}v${i}`) * 18) + H) % H;
        return <circle key={i} cx={x} cy={y} r={3 + random(`${seed}r${i}`) * 7} fill={i % 3 ? COLORS.hormoneAlt : COLORS.cell} opacity={0.3} />;
      })}
    </svg>
  );
};

const Muscle: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const drift = (frame / fps) * 6;
  return (
    <AbsoluteFill>
      {[
        {y: -40, s: 0.9, o: 0.4},
        {y: 160, s: 1.0, o: 0.45},
        {y: 1060, s: 1.05, o: 0.5},
        {y: 1300, s: 0.95, o: 0.42},
        {y: 1530, s: 1.0, o: 0.36},
      ].map((f, i) => (
        <div key={i} style={{position: 'absolute', left: -120 + (i % 2) * 60 - drift * (i % 2 ? 1 : -1), top: f.y, opacity: f.o * 0.85}}>
          <MuscleFiber width={1320 * f.s} />
        </div>
      ))}
      <Capillary y={1180} />
    </AbsoluteFill>
  );
};

const Capillary: React.FC<{y: number}> = ({y}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const d = `M -40 ${y} C 260 ${y - 100}, 520 ${y + 60}, 760 ${y - 60} S 1080 ${y - 170}, 1140 ${y - 120}`;
  return (
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      <path d={d} stroke={COLORS.blood} strokeOpacity={0.33} strokeWidth={70} fill="none" strokeLinecap="round" />
      {Array.from({length: 10}, (_, i) => {
        const u = ((i / 10 + t * 0.06) % 1);
        const x = -20 + u * 1120;
        const yy = y - Math.sin(u * Math.PI * 1.6) * 70 - u * 60;
        return <ellipse key={i} cx={x} cy={yy} rx={22} ry={14} fill={COLORS.blood} opacity={0.7} transform={`rotate(${(random(`rb${i}`) - 0.5) * 60} ${x} ${yy})`} />;
      })}
    </svg>
  );
};

const Blood: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  return (
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      {/* стенки сосуда по диагонали */}
      <path d={`M -200 200 L ${W + 200} 900 L ${W + 200} 1500 L -200 800 Z`} fill={COLORS.blood} opacity={0.14} />
      <path d={`M -200 200 L ${W + 200} 900`} stroke={COLORS.bloodDark} strokeOpacity={0.4} strokeWidth={14} />
      <path d={`M -200 800 L ${W + 200} 1500`} stroke={COLORS.bloodDark} strokeOpacity={0.4} strokeWidth={14} />
      {Array.from({length: 26}, (_, i) => {
        const u = (random(`bu${i}`) + t * (0.04 + random(`bs${i}`) * 0.03)) % 1;
        const v = random(`bv${i}`);
        const x = -150 + u * (W + 300);
        const y = 260 + u * 650 + v * 520;
        const r = 26 + random(`br${i}`) * 16;
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${random(`ba${i}`) * 180})`} opacity={0.55}>
            <ellipse rx={r} ry={r * 0.62} fill={COLORS.blood} />
            <ellipse rx={r * 0.45} ry={r * 0.25} fill={COLORS.bloodDark} opacity={0.5} />
          </g>
        );
      })}
    </svg>
  );
};

const Neural: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const nodes = Array.from({length: 34}, (_, i) => ({x: random(`nx${i}`) * W, y: random(`ny${i}`) * H}));
  return (
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      {nodes.map((a, i) => {
        const b = nodes[(i * 7 + 3) % nodes.length];
        const c = nodes[(i * 11 + 5) % nodes.length];
        const pulse = ((t * 0.6 + random(`np${i}`)) % 1);
        return (
          <g key={i}>
            <path d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2 + 60} ${(a.y + b.y) / 2 - 60} ${b.x} ${b.y}`} stroke={COLORS.nerve} strokeOpacity={0.22} strokeWidth={4} fill="none" />
            <path d={`M ${a.x} ${a.y} L ${c.x} ${c.y}`} stroke={COLORS.brain} strokeOpacity={0.14} strokeWidth={3} />
            <circle cx={a.x + (b.x - a.x) * pulse} cy={a.y + (b.y - a.y) * pulse} r={7} fill={COLORS.nerve} opacity={0.5} />
            <circle cx={a.x} cy={a.y} r={12} fill={COLORS.brain} opacity={0.4} />
          </g>
        );
      })}
    </svg>
  );
};

const Cells: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  return (
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      {Array.from({length: 22}, (_, i) => {
        const x = random(`cx${i}`) * W + Math.sin(t * 0.5 + i) * 10;
        const y = random(`cy${i}`) * H + Math.cos(t * 0.4 + i) * 10;
        const r = 50 + random(`cr${i}`) * 110;
        return (
          <g key={i} opacity={0.32}>
            <circle cx={x} cy={y} r={r} fill={COLORS.cell} fillOpacity={0.18} stroke={COLORS.cell} strokeWidth={6} />
            <circle cx={x + r * 0.15} cy={y - r * 0.1} r={r * 0.32} fill={COLORS.nucleus} fillOpacity={0.6} />
          </g>
        );
      })}
    </svg>
  );
};

export const Env: React.FC<{kind?: EnvKind}> = ({kind = 'soft'}) => (
  <AbsoluteFill>
    <Glow />
    {kind === 'muscle' && <Muscle />}
    {kind === 'blood' && <Blood />}
    {kind === 'neural' && <Neural />}
    {kind === 'cells' && <Cells />}
    <Particles n={kind === 'soft' ? 50 : 30} />
  </AbsoluteFill>
);

/** Какая среда подходит органу/визуалу. */
export const envFor = (thing?: string): EnvKind => {
  if (!thing) return 'soft';
  if (/muscle|fiber/.test(thing)) return 'muscle';
  if (/heart|blood|vessel|adrenal/.test(thing)) return 'blood';
  if (/brain|nerve|hypothal|pituit/.test(thing)) return 'neural';
  if (/cell|molecule|hormone/.test(thing)) return 'cells';
  return 'soft';
};
