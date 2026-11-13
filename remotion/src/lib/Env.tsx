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

export type EnvKind = 'muscle' | 'blood' | 'neural' | 'cells' | 'soft' | 'molecules' | 'bone' | 'air' | 'dna' | 'skin' | 'night' | 'grid' | 'abstract';
export const ENV_KINDS: EnvKind[] = ['muscle', 'blood', 'neural', 'cells', 'molecules', 'bone', 'air', 'dna', 'skin', 'night', 'grid', 'abstract', 'soft'];
let W: number = VIDEO.width;
let H: number = VIDEO.height;
/** Размер кадра для фонов (вертикальный Shorts или горизонтальное видео). */
export const getSize = () => ({W, H});
export const setEnvSize = (w: number, h: number) => {
  W = w;
  H = h;
};

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

/* ---------- новые среды ---------- */
const Molecules: React.FC<{seed: string}> = ({seed}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  return (
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      {Array.from({length: 16}, (_, i) => {
        const x = random(`${seed}mx${i}`) * W;
        const y = random(`${seed}my${i}`) * H;
        const s = 40 + random(`${seed}ms${i}`) * 50;
        const rot = random(`${seed}mr${i}`) * 360 + t * (i % 2 ? 6 : -6);
        const hex = Array.from({length: 6}, (_, k) => `${Math.cos((k * Math.PI) / 3) * s},${Math.sin((k * Math.PI) / 3) * s}`).join(' ');
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`} opacity={0.3}>
            <polygon points={hex} fill="none" stroke={i % 2 ? COLORS.hormone : COLORS.hormoneAlt} strokeWidth={7} />
            <line x1={s} y1={0} x2={s * 1.9} y2={-s * 0.5} stroke={COLORS.hormone} strokeWidth={7} />
            <circle cx={s * 2.05} cy={-s * 0.58} r={s * 0.22} fill={COLORS.blood} />
          </g>
        );
      })}
    </svg>
  );
};

const Bone: React.FC<{seed: string}> = ({seed}) => (
  <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
    <rect width={W} height={H} fill={COLORS.tendon} opacity={0.08} />
    {Array.from({length: 46}, (_, i) => {
      const x = random(`${seed}bx${i}`) * W;
      const y = random(`${seed}by${i}`) * H;
      const r = 30 + random(`${seed}br${i}`) * 70;
      return <ellipse key={i} cx={x} cy={y} rx={r} ry={r * (0.6 + random(`${seed}be${i}`) * 0.5)} fill="none" stroke={COLORS.tendon} strokeOpacity={0.28} strokeWidth={10 + random(`${seed}bw${i}`) * 10} />;
    })}
  </svg>
);

const Air: React.FC<{seed: string}> = ({seed}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const breathe = 1 + Math.sin((frame / fps) * 1.4) * 0.05;
  return (
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      {Array.from({length: 12}, (_, c) => {
        const cx = random(`${seed}ax${c}`) * W;
        const cy = random(`${seed}ay${c}`) * H;
        return (
          <g key={c} transform={`translate(${cx} ${cy}) scale(${breathe})`} opacity={0.3}>
            <path d={`M 0 0 L ${-60 + c * 3} ${-140}`} stroke={COLORS.lung} strokeWidth={10} />
            {Array.from({length: 7}, (_, k) => {
              const a = (k / 7) * Math.PI * 2;
              return <circle key={k} cx={Math.cos(a) * 52} cy={Math.sin(a) * 52} r={34} fill={COLORS.lung} fillOpacity={0.25} stroke={COLORS.lung} strokeWidth={5} />;
            })}
          </g>
        );
      })}
    </svg>
  );
};

const Dna: React.FC<{seed: string}> = ({seed}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const strands = [0, 1, 2].map((k) => ({x0: -200 + k * 520 + random(`${seed}dx${k}`) * 120}));
  return (
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      {strands.map((st, k) => (
        <g key={k} opacity={0.3} transform={`rotate(-25 ${st.x0} 960)`}>
          {Array.from({length: 40}, (_, i) => {
            const y = i * 52 - 100;
            const ph = i * 0.45 + t * 1.2 + k;
            const a = Math.sin(ph) * 90;
            return (
              <g key={i}>
                <line x1={st.x0 + a} y1={y} x2={st.x0 - a} y2={y} stroke={i % 2 ? COLORS.gland : COLORS.hormone} strokeWidth={8} />
                <circle cx={st.x0 + a} cy={y} r={10} fill={COLORS.cell} />
                <circle cx={st.x0 - a} cy={y} r={10} fill={COLORS.accent} />
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
};

const Skin: React.FC<{seed: string}> = ({seed}) => (
  <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
    {[0, 1, 2, 3, 4].map((k) => {
      const y0 = 200 + k * 360;
      let d = `M 0 ${y0}`;
      for (let x = 0; x <= W; x += 40) d += ` L ${x} ${y0 + Math.sin(x / 120 + k + random(`${seed}sk${k}`) * 3) * 40}`;
      d += ` L ${W} ${H} L 0 ${H} Z`;
      return <path key={k} d={d} fill={k % 2 ? COLORS.lung : COLORS.muscle} opacity={0.08 + k * 0.03} />;
    })}
  </svg>
);

const Night: React.FC<{seed: string}> = ({seed}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  return (
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      <rect width={W} height={H} fill="#000000" opacity={0.25} />
      {Array.from({length: 90}, (_, i) => (
        <circle key={i} cx={random(`${seed}sx${i}`) * W} cy={random(`${seed}sy${i}`) * H} r={2 + random(`${seed}sr${i}`) * 4} fill={COLORS.ink} opacity={0.25 + 0.35 * Math.abs(Math.sin(t * 1.5 + i))} />
      ))}
      <circle cx={820} cy={300} r={110} fill={COLORS.accent} opacity={0.25} />
      <circle cx={870} cy={270} r={100} fill={COLORS.bg} opacity={0.6} />
    </svg>
  );
};

const Grid: React.FC<{seed: string}> = ({seed}) => (
  <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
    {Array.from({length: 28}, (_, i) => (
      <line key={`v${i}`} x1={i * 40} x2={i * 40} y1={0} y2={H} stroke={COLORS.ink} strokeOpacity={i % 5 ? 0.04 : 0.1} strokeWidth={2} />
    ))}
    {Array.from({length: 49}, (_, i) => (
      <line key={`h${i}`} y1={i * 40} y2={i * 40} x1={0} x2={W} stroke={COLORS.ink} strokeOpacity={i % 5 ? 0.04 : 0.1} strokeWidth={2} />
    ))}
    {Array.from({length: 5}, (_, i) => {
      const x = random(`${seed}gx${i}`) * W;
      const y = random(`${seed}gy${i}`) * H;
      return <text key={i} x={x} y={y} fill={COLORS.ink} opacity={0.12} fontSize={36} fontFamily="Space Mono">{['n=13', 'p<0.05', '48h', 'Δ −18%', 'r=0.6'][i]}</text>;
    })}
  </svg>
);

const Abstract: React.FC<{seed: string}> = ({seed}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const cols = [COLORS.blood, COLORS.cell, COLORS.gland, COLORS.hormone, COLORS.accent];
  return (
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      {Array.from({length: 7}, (_, i) => {
        const x = random(`${seed}ox${i}`) * W + Math.sin(t * 0.4 + i) * 30;
        const y = random(`${seed}oy${i}`) * H + Math.cos(t * 0.3 + i) * 30;
        const r = 120 + random(`${seed}or${i}`) * 220;
        return <circle key={i} cx={x} cy={y} r={r} fill={cols[i % cols.length]} opacity={0.12} />;
      })}
      {Array.from({length: 6}, (_, i) => (
        <path key={`l${i}`} d={`M ${-50} ${300 + i * 260} C 300 ${200 + i * 260 + Math.sin(t + i) * 60}, 700 ${420 + i * 260}, ${W + 50} ${300 + i * 260}`} stroke={cols[(i + 2) % cols.length]} strokeOpacity={0.18} strokeWidth={6} fill="none" />
      ))}
    </svg>
  );
};

export const Env: React.FC<{kind?: EnvKind; seed?: string | number}> = ({kind = 'soft', seed: seedRaw = 0}) => {
  const seed = `s${seedRaw}`;
  // вариант раскладки: зеркало и сдвиг — один и тот же вид среды выглядит по-разному в разных кадрах
  const mirror = random(`${seed}mirror`) < 0.5 ? -1 : 1;
  return (
    <AbsoluteFill>
      <Glow />
      <AbsoluteFill style={{scale: `${mirror} 1`}}>
        {kind === 'muscle' && <Muscle />}
        {kind === 'blood' && <Blood />}
        {kind === 'neural' && <Neural />}
        {kind === 'cells' && <Cells />}
        {kind === 'molecules' && <Molecules seed={seed} />}
        {kind === 'bone' && <Bone seed={seed} />}
        {kind === 'air' && <Air seed={seed} />}
        {kind === 'dna' && <Dna seed={seed} />}
        {kind === 'skin' && <Skin seed={seed} />}
        {kind === 'night' && <Night seed={seed} />}
        {kind === 'grid' && <Grid seed={seed} />}
        {kind === 'abstract' && <Abstract seed={seed} />}
      </AbsoluteFill>
      <Particles n={kind === 'soft' ? 50 : 26} seed={seed} />
    </AbsoluteFill>
  );
};

/** Какая среда подходит органу/визуалу. */
export const envFor = (thing?: string): EnvKind => {
  if (!thing) return 'soft';
  if (/muscle|fiber/.test(thing)) return 'muscle';
  if (/heart|blood|vessel|adrenal/.test(thing)) return 'blood';
  if (/brain|nerve|hypothal|pituit/.test(thing)) return 'neural';
  if (/cell|molecule|hormone/.test(thing)) return 'cells';
  return 'soft';
};

/** Подходящие среды по словам кадра (по порядку предпочтения). */
const KEYWORDS: [RegExp, EnvKind][] = [
  [/muscl|fiber|lift|train|workout|gym|tear/, 'muscle'],
  [/heart|blood|vessel|pulse|pump|oxygen.?rich/, 'blood'],
  [/brain|nerve|neuron|think|stress|signal|mind|focus|mood/, 'neural'],
  [/hormone|adrenal|cortisol|testosterone|insulin|protein|molecule|chemical/, 'molecules'],
  [/cell|repair|crew|clean|immune/, 'cells'],
  [/bone|skeleton|calcium|joint/, 'bone'],
  [/breath|lung|air|oxygen/, 'air'],
  [/gene|dna|inherit/, 'dna'],
  [/skin|sun|sweat|heat|cold/, 'skin'],
  [/sleep|night|rest|dream|tired/, 'night'],
  [/research|study|data|science|percent|graph|myth|fact/, 'grid'],
];

/** Выбрать фон для каждого кадра: по смыслу кадра, соседние кадры — никогда одинаковые. */
export const pickEnvs = (shots: {id: number; template: string; text?: string; params?: any}[]): EnvKind[] => {
  const out: EnvKind[] = [];
  const pool: EnvKind[] = ['abstract', 'cells', 'molecules', 'grid', 'neural', 'soft', 'dna', 'blood'];
  const used = new Map<EnvKind, number>();
  shots.forEach((s, i) => {
    const prev = out[i - 1];
    const forced = s.params?.background as EnvKind | undefined;
    const text = `${s.text ?? ''} ${JSON.stringify(s.params ?? {})}`.toLowerCase();
    const cands = [...(forced ? [forced] : []), ...KEYWORDS.filter(([re]) => re.test(text)).map(([, k]) => k), ...pool];
    // меньше всего использованная из подходящих и не такая, как в соседнем кадре
    const ok = cands.filter((k) => k !== prev);
    const best = ok.slice(0, 4).sort((a, b) => (used.get(a) ?? 0) - (used.get(b) ?? 0))[0] ?? ok[0] ?? 'soft';
    out.push(best);
    used.set(best, (used.get(best) ?? 0) + 1);
  });
  return out;
};
