// Кадр «Сцена»: фон-среда (равнина, берег, проход между скалой и морем, море) и набор
// значков-силуэтов. Это иллюстрация, а не документ — в раскадровке её так и подписывают.
// Если на сцене есть подписи, привязанные к точкам, камера стоит на месте (иначе слои разъедутся).
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Icon, ICON_WIDTH, type IconColors, type IconName} from '../components/Icons';
import {ShotFrame} from '../components/ShotFrame';
import {Appear, SourceLine, TitlePlate} from '../components/TextBits';
import {alpha, EASE, mix, ramp, rng} from '../lib/anim';
import {clampBox, textWidth} from '../lib/labels';
import {FRAME, useStyle, type Palette} from '../style';

export type Tone = 'dark' | 'light' | 'accent' | 'accent2' | 'paper';
export type SceneSetting = 'plain' | 'coast' | 'pass' | 'sea';
export type SceneTime = 'day' | 'dusk' | 'night';

export type SceneItem = {
  icon: IconName;
  /** Точка, где предмет стоит на земле (пиксели кадра 1920x1080) */
  x: number;
  y: number;
  /** Высота в пикселях */
  size: number;
  /** Сколько одинаковых предметов в ряду и расстояние между ними */
  count?: number;
  gap?: number;
  /** Сколько рядов друг за другом (строй) */
  rows?: number;
  flip?: boolean;
  tone?: Tone;
  /** Когда появляется, секунды от начала кадра */
  appearAt?: number;
};

export type SceneLabel = {text: string; x: number; y: number; appearAt?: number};

export type SceneShotProps = {
  frames: number;
  setting: SceneSetting;
  time?: SceneTime;
  items: SceneItem[];
  labels?: SceneLabel[];
  title?: string;
  subtitle?: string;
  /** Мелкая строка: «Illustration, not to scale» и т. п. */
  note?: string;
  seed?: number;
};

const W = FRAME.width;
const H = FRAME.height;
const HORIZON = 520;

export const toneColors = (p: Palette, tone: Tone): IconColors => {
  switch (tone) {
    case 'accent':
      return {main: mix(p.bg, p.accent, 0.22), shade: mix(p.bg, '#000000', 0.25), hi: p.accent, line: mix(p.bg, p.accent, 0.5)};
    case 'accent2':
      return {main: mix(p.bg, p.accent2, 0.3), shade: mix(p.bg, '#000000', 0.25), hi: p.accent2, line: mix(p.bg, p.accent2, 0.55)};
    case 'light':
      return {main: p.light, shade: mix(p.light, p.bg, 0.4), hi: p.accent, line: p.light};
    case 'paper':
      return {main: p.paper, shade: p.paperShade, hi: p.accent, line: p.ink};
    default:
      return {main: mix(p.bg, '#000000', 0.15), shade: mix(p.bg, '#000000', 0.45), hi: mix(p.bg, p.light, 0.35), line: mix(p.bg, p.light, 0.25)};
  }
};

/** Левая граница моря на высоте y (для берега и прохода). */
const seaEdge = (setting: SceneSetting, y: number): number => {
  const k = (y - HORIZON) / (H - HORIZON);
  if (setting === 'coast') {
    return 1150 - 390 * k;
  }
  if (setting === 'pass') {
    return 860 + 640 * k;
  }
  return setting === 'sea' ? 0 : W + 100;
};

const SceneArt: React.FC<SceneShotProps> = ({setting, time = 'day', items, seed = 1}) => {
  const {palette: p} = useStyle();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const r = rng(seed * 104729 + 7);
  const dark = time === 'night' ? 0.62 : time === 'dusk' ? 0.28 : 0;

  const skyTop = time === 'day' ? mix(p.bgAlt, p.light, 0.2) : time === 'dusk' ? mix(p.bg, p.accent2, 0.25) : mix(p.bg, '#000000', 0.35);
  const skyLow = time === 'day' ? mix(p.paper, p.accent, 0.28) : time === 'dusk' ? mix(p.accent, p.accent2, 0.4) : p.bgAlt;
  const groundFar = mix(mix(p.land, p.paper, 0.3), p.bg, dark);
  const groundNear = mix(mix(p.land, p.bg, 0.42), p.bg, dark);
  const seaFar = mix(mix(p.sea, p.light, 0.28), p.bg, dark);
  const seaNear = mix(p.seaDeep, p.bg, dark * 0.6);
  const hill = mix(mix(skyLow, p.bg, 0.5), p.bg, dark * 0.5);
  const cliff = mix(mix(p.bg, p.landEdge, 0.32), p.bg, dark * 0.6);
  const cliffFace = mix(mix(p.bg, p.land, 0.55), p.bg, dark * 0.6);

  // дальние холмы: ломаная вдоль горизонта
  const ridge: string[] = [`0,${HORIZON}`];
  for (let x = 0; x <= W; x += 120) {
    ridge.push(`${x},${Math.round(HORIZON - 30 - r() * 110 - (setting === 'sea' ? 0 : 30))}`);
  }
  ridge.push(`${W},${HORIZON}`);
  const sunX = 380 + Math.round(r() * 1100);
  const stars = time === 'night' ? Array.from({length: 70}, () => [r() * W, r() * (HORIZON - 80), 1 + r() * 2.2, 0.3 + r() * 0.6]) : [];
  const hasSea = setting !== 'plain';
  const waves = hasSea
    ? Array.from({length: 46}, () => {
        const y = HORIZON + 24 + r() * (H - HORIZON - 40);
        const from = Math.max(0, seaEdge(setting, y) + 40);
        return [from + r() * Math.max(60, W - from - 80), y, 30 + r() * 70, r() * 6.28];
      })
    : [];

  const drawn = [...items].sort((a, b) => a.y - b.y);
  return (
    <AbsoluteFill>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id={`sky${seed}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={skyTop} />
            <stop offset="1" stopColor={skyLow} />
          </linearGradient>
          <linearGradient id={`gr${seed}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={groundFar} />
            <stop offset="1" stopColor={groundNear} />
          </linearGradient>
          <linearGradient id={`sea${seed}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={seaFar} />
            <stop offset="1" stopColor={seaNear} />
          </linearGradient>
          <radialGradient id={`sun${seed}`}>
            <stop offset="0" stopColor={alpha(time === 'night' ? p.light : p.accent, 0.55)} />
            <stop offset="1" stopColor={alpha(time === 'night' ? p.light : p.accent, 0)} />
          </radialGradient>
        </defs>
        <rect width={W} height={HORIZON + 4} fill={`url(#sky${seed})`} />
        {stars.map(([x, y, s, o], i) => (
          <circle key={i} cx={x} cy={y} r={s} fill={p.light} opacity={o * (0.7 + 0.3 * Math.sin(t * 2 + i))} />
        ))}
        <circle cx={sunX} cy={time === 'dusk' ? HORIZON - 30 : 190} r={time === 'night' ? 150 : 300} fill={`url(#sun${seed})`} />
        <circle cx={sunX} cy={time === 'dusk' ? HORIZON - 30 : 190} r={time === 'dusk' ? 105 : time === 'night' ? 44 : 66} fill={time === 'night' ? p.light : mix(p.accent, p.paper, 0.35)} />
        <polygon points={ridge.join(' ')} fill={hill} />
        {/* вода или земля до нижнего края */}
        <rect y={HORIZON} width={W} height={H - HORIZON} fill={hasSea ? `url(#sea${seed})` : `url(#gr${seed})`} />
        {waves.map(([x, y, len, ph], i) => {
          const dx = Math.sin(t * 1.3 + ph) * 14;
          const k = (y - HORIZON) / (H - HORIZON);
          return <line key={i} x1={x + dx} y1={y} x2={x + dx + len * (0.5 + k)} y2={y} stroke={alpha(p.light, 0.16 + 0.2 * k)} strokeWidth={2 + 3 * k} strokeLinecap="round" />;
        })}
        {setting === 'coast' ? (
          <g>
            <polygon points={`0,${HORIZON} 1150,${HORIZON} 760,${H} 0,${H}`} fill={`url(#gr${seed})`} />
            <line x1={1150} y1={HORIZON} x2={760} y2={H} stroke={alpha(p.light, 0.45)} strokeWidth={7} strokeLinecap="round" />
          </g>
        ) : null}
        {setting === 'pass' ? (
          <g>
            <polygon points={`700,${HORIZON} 860,${HORIZON} 1500,${H} 520,${H}`} fill={`url(#gr${seed})`} />
            <line x1={860} y1={HORIZON} x2={1500} y2={H} stroke={alpha(p.light, 0.45)} strokeWidth={7} strokeLinecap="round" />
            <polygon points={`0,0 430,0 560,150 520,300 700,${HORIZON} 520,${H} 0,${H}`} fill={cliff} />
            <polygon points={`430,0 560,150 520,300 700,${HORIZON} 520,${H} 360,${H} 540,${HORIZON} 400,300 440,150 330,0`} fill={cliffFace} opacity={0.55} />
            <path d={`M90 0 L170 260 L110 520 L210 ${H} M250 0 L300 330 L260 700`} fill="none" stroke={alpha('#000000', 0.22)} strokeWidth={6} />
          </g>
        ) : null}
        {setting === 'plain'
          ? Array.from({length: 16}, (_, i) => {
              const y = HORIZON + 40 + r() * (H - HORIZON - 60);
              const x = r() * W;
              return <line key={i} x1={x} y1={y} x2={x + 90 + r() * 200} y2={y} stroke={alpha(p.bg, 0.12)} strokeWidth={5} strokeLinecap="round" />;
            })
          : null}
        {drawn.map((it, i) => {
          const colors = toneColors(p, it.tone ?? 'dark');
          const count = Math.max(1, it.count ?? 1);
          const rows = Math.max(1, it.rows ?? 1);
          const gap = it.gap ?? (ICON_WIDTH[it.icon] ?? 100) * (it.size / 100) * 0.82;
          const start = it.appearAt ?? 0.2 + i * 0.25;
          const out: React.ReactNode[] = [];
          for (let row = rows - 1; row >= 0; row--) {
            const k = 1 - row * 0.07;
            for (let j = 0; j < count; j++) {
              const a = ramp(frame, (start + (j + row * 2) * 0.04) * fps, 0.5 * fps, EASE.out);
              const x = it.x + (j - (count - 1) / 2) * gap * k + (row % 2 ? gap * 0.5 * k : 0);
              const y = it.y - row * it.size * 0.17;
              out.push(<Icon key={`${row}-${j}`} name={it.icon} x={x} y={y + (1 - a) * 26} size={it.size * k} colors={colors} flip={it.flip} t={t + j * 0.37} opacity={a} />);
            }
          }
          return <g key={i}>{out}</g>;
        })}
      </svg>
    </AbsoluteFill>
  );
};

const SceneText: React.FC<SceneShotProps> = ({title, subtitle, note, labels = []}) => {
  const {palette: p, fonts, radius} = useStyle();
  const size = 34;
  return (
    <AbsoluteFill>
      {title ? <TitlePlate title={title} subtitle={subtitle} /> : null}
      {labels.map((l, i) => {
        const w = textWidth(l.text, fonts.body, size, 800) + 36;
        const box = clampBox({x: l.x - w / 2, y: l.y - 28, w, h: 56}, 400);
        if (!box) {
          return null;
        }
        return (
          <Appear
            key={i}
            delay={l.appearAt ?? 0.8 + i * 0.4}
            rise={12}
            style={{
              position: 'absolute',
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              borderRadius: radius,
              backgroundColor: alpha(p.bg, 0.86),
              border: `2px solid ${alpha(p.accent, 0.8)}`,
              color: p.light,
              fontFamily: fonts.body,
              fontWeight: 800,
              fontSize: size,
              lineHeight: '52px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {l.text}
          </Appear>
        );
      })}
      {note ? <SourceLine text={note} /> : null}
    </AbsoluteFill>
  );
};

export const SceneShot: React.FC<SceneShotProps> = (props) => (
  <ShotFrame
    frames={props.frames}
    drift={props.labels?.length ? null : {from: 1.0, to: 1.06, origin: '50% 62%'}}
    art={<SceneArt {...props} />}
    text={<SceneText {...props} />}
  />
);
