/**
 * Стикмен-гид. 8 поз × 5 эмоций.
 * Поза задаётся углами суставов (0° = вниз, +90° = вправо, 180° = вверх),
 * поэтому позы можно плавно смешивать (blendPoses) для анимации.
 */
import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, STROKE} from '../style';

export type PoseName =
  | 'stand'
  | 'point'
  | 'wave'
  | 'think'
  | 'shrug'
  | 'run'
  | 'flex'
  | 'present';
export type Emotion = 'neutral' | 'happy' | 'surprised' | 'worried' | 'excited';

export const POSES: PoseName[] = ['stand', 'point', 'wave', 'think', 'shrug', 'run', 'flex', 'present'];
export const EMOTIONS: Emotion[] = ['neutral', 'happy', 'surprised', 'worried', 'excited'];

type Pose = {
  rUpper: number; rFore: number; lUpper: number; lFore: number;
  rThigh: number; rShin: number; lThigh: number; lShin: number;
  lean: number; // наклон корпуса
};

const P: Record<PoseName, Pose> = {
  stand: {rUpper: 14, rFore: 6, lUpper: -14, lFore: -6, rThigh: 8, rShin: 4, lThigh: -8, lShin: -4, lean: 0},
  point: {rUpper: 100, rFore: 104, lUpper: -14, lFore: -6, rThigh: 8, rShin: 4, lThigh: -8, lShin: -4, lean: 0},
  wave: {rUpper: 135, rFore: 170, lUpper: -14, lFore: -6, rThigh: 8, rShin: 4, lThigh: -8, lShin: -4, lean: 0},
  think: {rUpper: 122, rFore: -66, lUpper: -12, lFore: 55, rThigh: 8, rShin: 4, lThigh: -8, lShin: -4, lean: 0},
  shrug: {rUpper: 38, rFore: 105, lUpper: -38, lFore: -105, rThigh: 8, rShin: 4, lThigh: -8, lShin: -4, lean: 0},
  run: {rUpper: 45, rFore: 130, lUpper: -45, lFore: 20, rThigh: 50, rShin: -5, lThigh: -30, lShin: -75, lean: 12},
  flex: {rUpper: 95, rFore: 172, lUpper: -95, lFore: -172, rThigh: 14, rShin: 8, lThigh: -14, lShin: -8, lean: 0},
  present: {rUpper: 55, rFore: 75, lUpper: -55, lFore: -75, rThigh: 8, rShin: 4, lThigh: -8, lShin: -4, lean: 0},
};

export const blendPoses = (a: PoseName, b: PoseName, t: number): Pose => {
  const pa = P[a];
  const pb = P[b];
  const out = {} as Pose;
  (Object.keys(pa) as (keyof Pose)[]).forEach((k) => {
    out[k] = pa[k] + (pb[k] - pa[k]) * t;
  });
  return out;
};

// длины сегментов (в единицах viewBox)
const L = {upper: 62, fore: 58, thigh: 74, shin: 72};
const rad = (d: number) => (d * Math.PI) / 180;
const step = (x: number, y: number, ang: number, len: number) => [
  x + Math.sin(rad(ang)) * len,
  y + Math.cos(rad(ang)) * len,
] as const;

const Face: React.FC<{emotion: Emotion; blink: number}> = ({emotion, blink}) => {
  const c = COLORS.ink;
  const eyeY = -160;
  const eyeR = 5.5;
  const eyes = (r = eyeR) => (
    <>
      <ellipse cx={-14} cy={eyeY} rx={r} ry={r * blink} fill={c} />
      <ellipse cx={14} cy={eyeY} rx={r} ry={r * blink} fill={c} />
    </>
  );
  const sw = 5;
  switch (emotion) {
    case 'neutral':
      return (
        <g>
          {eyes()}
          <line x1={-11} y1={-136} x2={11} y2={-136} stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </g>
      );
    case 'happy':
      return (
        <g fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round">
          <path d="M -20 -158 Q -14 -166 -8 -158" />
          <path d="M 8 -158 Q 14 -166 20 -158" />
          <path d="M -15 -142 Q 0 -126 15 -142" />
        </g>
      );
    case 'surprised':
      return (
        <g>
          {eyes(7.5)}
          <g fill="none" stroke={c} strokeWidth={4} strokeLinecap="round">
            <path d="M -22 -176 Q -14 -182 -6 -177" />
            <path d="M 6 -177 Q 14 -182 22 -176" />
          </g>
          <ellipse cx={0} cy={-136} rx={7} ry={9} fill="none" stroke={c} strokeWidth={sw} />
        </g>
      );
    case 'worried':
      return (
        <g>
          {eyes()}
          <g fill="none" stroke={c} strokeWidth={4} strokeLinecap="round">
            <path d="M -22 -170 L -7 -175" />
            <path d="M 7 -175 L 22 -170" />
            <path d="M -14 -134 Q -7 -141 0 -134 Q 7 -127 14 -134" />
          </g>
        </g>
      );
    case 'excited':
      return (
        <g>
          {eyes(7)}
          <circle cx={-12} cy={-162} r={2.2} fill={COLORS.bg} />
          <circle cx={16} cy={-162} r={2.2} fill={COLORS.bg} />
          <path d="M -17 -144 Q 0 -144 17 -144 Q 14 -124 0 -124 Q -14 -124 -17 -144 Z" fill={c} />
        </g>
      );
  }
};

export type StickmanProps = {
  pose?: PoseName;
  /** вторая поза для плавного перехода и доля перехода 0..1 */
  toPose?: PoseName;
  poseT?: number;
  emotion?: Emotion;
  size?: number; // высота в пикселях
  color?: string;
  /** включить «живые» микродвижения: дыхание, моргание, махание рукой */
  alive?: boolean;
  style?: React.CSSProperties;
};

export const Stickman: React.FC<StickmanProps> = ({
  pose = 'stand',
  toPose,
  poseT = 0,
  emotion = 'neutral',
  size = 420,
  color = COLORS.ink,
  alive = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = alive ? frame / fps : 0;
  const p = blendPoses(pose, toPose ?? pose, poseT);

  // микродвижения
  const breathe = Math.sin(t * 2.2) * 2.5;
  const wave = (toPose ?? pose) === 'wave' || pose === 'wave' ? Math.sin(t * 9) * 18 : 0;
  const runCycle = pose === 'run' && alive ? Math.sin(t * 10) : 0;
  // моргание раз в ~3.3 c
  const blinkPhase = (frame % Math.round(fps * 3.3)) / fps;
  const blink = alive ? interpolate(blinkPhase, [0, 0.06, 0.12], [1, 0.1, 1], {extrapolateRight: 'clamp'}) : 1;

  const hipX = 0;
  const hipY = 0;
  const neck = step(hipX, hipY, 180 + p.lean, 110 + breathe);
  const [nx, ny] = neck;
  const head = step(nx, ny, 180 + p.lean, 48);

  const rU = p.rUpper + runCycle * 30;
  const lU = p.lUpper - runCycle * 30;
  const rE = step(nx, ny + 6, rU, L.upper);
  const rH = step(rE[0], rE[1], p.rFore + wave + runCycle * 30, L.fore);
  const lE = step(nx, ny + 6, lU, L.upper);
  const lH = step(lE[0], lE[1], p.lFore - runCycle * 30, L.fore);
  const rK = step(hipX, hipY, p.rThigh - runCycle * 35, L.thigh);
  const rF = step(rK[0], rK[1], p.rShin - runCycle * 35, L.shin);
  const lK = step(hipX, hipY, p.lThigh + runCycle * 35, L.thigh);
  const lF = step(lK[0], lK[1], p.lShin + runCycle * 35, L.shin);

  const sw = STROKE.guide;
  const line = (a: readonly number[], b: readonly number[], c: readonly number[]) =>
    `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]} L ${c[0]} ${c[1]}`;

  // viewBox: ширина 400, высота 420 (от макушки до стоп)
  return (
    <svg
      viewBox="-200 -240 400 420"
      width={(size * 400) / 420}
      height={size}
      style={{overflow: 'visible', ...style}}
    >
      {/* контур цветом фона — гид виден и на тёмной, и на белой доске */}
      <g fill="none" stroke={COLORS.bg} strokeOpacity={0.85} strokeWidth={sw + 9} strokeLinecap="round" strokeLinejoin="round">
        <path d={line([hipX, hipY], rK, rF)} />
        <path d={line([hipX, hipY], lK, lF)} />
        <line x1={hipX} y1={hipY} x2={nx} y2={ny} />
        <path d={line([nx, ny + 6], rE, rH)} />
        <path d={line([nx, ny + 6], lE, lH)} />
      </g>
      <circle cx={head[0]} cy={head[1]} r={48} fill={COLORS.bg} opacity={0.85} />
      <g fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        {/* ноги */}
        <path d={line([hipX, hipY], rK, rF)} />
        <path d={line([hipX, hipY], lK, lF)} />
        <line x1={rF[0]} y1={rF[1]} x2={rF[0] + 16} y2={rF[1]} />
        <line x1={lF[0]} y1={lF[1]} x2={lF[0] - 16} y2={lF[1]} />
        {/* корпус */}
        <line x1={hipX} y1={hipY} x2={nx} y2={ny} />
        {/* руки */}
        <path d={line([nx, ny + 6], rE, rH)} />
        <path d={line([nx, ny + 6], lE, lH)} />
      </g>
      <circle cx={rH[0]} cy={rH[1]} r={8} fill={color} />
      <circle cx={lH[0]} cy={lH[1]} r={8} fill={color} />
      {/* голова: фирменная деталь — жёлтый «завиток» */}
      <g transform={`translate(${head[0]}, ${head[1] + 155})`}>
        <circle cx={0} cy={-155} r={42} fill={COLORS.bgSoft} stroke={color} strokeWidth={sw - 2} />
        <path d="M -6 -197 Q 4 -216 18 -206" fill="none" stroke={COLORS.accent} strokeWidth={8} strokeLinecap="round" />
        <Face emotion={emotion} blink={blink} />
      </g>
    </svg>
  );
};
