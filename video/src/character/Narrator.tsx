// Персонаж-рассказчик, нарисованный кодом (вымышленный, не реальный человек).
// Позы задаются положением локтей и кистей, эмоции — бровями и ртом.
// Между позами персонаж переходит плавно; моргает и слегка покачивается сам.
import React from 'react';
import type {Palette} from '../style';

export type Pose = 'idle' | 'explain' | 'point' | 'think' | 'surprise' | 'welcome';
export type Emotion = 'neutral' | 'smile' | 'serious' | 'surprised' | 'concerned' | 'curious';

export const POSES: Pose[] = ['idle', 'explain', 'point', 'think', 'surprise', 'welcome'];
export const EMOTIONS: Emotion[] = ['neutral', 'smile', 'serious', 'surprised', 'concerned', 'curious'];

type Pt = [number, number];
type Rig = {le: Pt; lw: Pt; re: Pt; rw: Pt; tilt: number; hand: 'fist' | 'open' | 'point' | 'chin'};

const SHOULDER_L: Pt = [248, 668];
const SHOULDER_R: Pt = [552, 668];

const RIGS: Record<Pose, Rig> = {
  idle: {le: [205, 840], lw: [345, 915], re: [595, 840], rw: [455, 915], tilt: 0, hand: 'fist'},
  explain: {le: [205, 840], lw: [345, 915], re: [668, 800], rw: [742, 640], tilt: 2, hand: 'open'},
  point: {le: [205, 840], lw: [345, 915], re: [690, 690], rw: [820, 575], tilt: 4, hand: 'point'},
  think: {le: [240, 850], lw: [430, 870], re: [610, 850], rw: [486, 640], tilt: -6, hand: 'chin'},
  surprise: {le: [140, 780], lw: [96, 590], re: [660, 780], rw: [704, 590], tilt: 0, hand: 'open'},
  welcome: {le: [128, 812], lw: [52, 706], re: [672, 812], rw: [748, 706], tilt: -2, hand: 'open'},
};

type Face = {browL: [number, number]; browR: [number, number]; arch: number; mouth: 'smile' | 'flat' | 'firm' | 'frown' | 'o'; eye: number};
// brow: [сдвиг вверх-вниз, поворот в градусах]; eye — насколько открыты глаза
const FACES: Record<Emotion, Face> = {
  neutral: {browL: [0, 0], browR: [0, 0], arch: 10, mouth: 'flat', eye: 1},
  smile: {browL: [-5, -3], browR: [-5, 3], arch: 13, mouth: 'smile', eye: 0.92},
  serious: {browL: [9, 11], browR: [9, -11], arch: 5, mouth: 'firm', eye: 0.82},
  surprised: {browL: [-20, -4], browR: [-20, 4], arch: 20, mouth: 'o', eye: 1.18},
  concerned: {browL: [-4, -14], browR: [-4, 14], arch: 8, mouth: 'frown', eye: 1},
  curious: {browL: [3, 3], browR: [-18, 6], arch: 14, mouth: 'smile', eye: 1.04},
};

const mixPt = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const mixN = (a: number, b: number, t: number): number => a + (b - a) * t;

const mixRig = (a: Rig, b: Rig, t: number): Rig => ({
  le: mixPt(a.le, b.le, t),
  lw: mixPt(a.lw, b.lw, t),
  re: mixPt(a.re, b.re, t),
  rw: mixPt(a.rw, b.rw, t),
  tilt: mixN(a.tilt, b.tilt, t),
  hand: t < 0.5 ? a.hand : b.hand,
});

const mixFace = (a: Face, b: Face, t: number): Face => ({
  browL: [mixN(a.browL[0], b.browL[0], t), mixN(a.browL[1], b.browL[1], t)],
  browR: [mixN(a.browR[0], b.browR[0], t), mixN(a.browR[1], b.browR[1], t)],
  arch: mixN(a.arch, b.arch, t),
  mouth: t < 0.5 ? a.mouth : b.mouth,
  eye: mixN(a.eye, b.eye, t),
});

const Arm: React.FC<{shoulder: Pt; elbow: Pt; wrist: Pt; hand: Rig['hand']; p: Palette; active: boolean}> = ({shoulder, elbow, wrist, hand, p, active}) => {
  const dx = wrist[0] - elbow[0];
  const dy = wrist[1] - elbow[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const hx = wrist[0] + ux * 30;
  const hy = wrist[1] + uy * 30;
  const angle = (Math.atan2(uy, ux) * 180) / Math.PI;
  const arm = `M ${shoulder[0]} ${shoulder[1]} L ${elbow[0]} ${elbow[1]} L ${wrist[0]} ${wrist[1]}`;
  const kind = active ? hand : 'fist';
  return (
    <g>
      <path d={arm} fill="none" stroke={p.coatShade} strokeWidth={92} strokeLinecap="round" strokeLinejoin="round" />
      <path d={arm} fill="none" stroke={p.coat} strokeWidth={80} strokeLinecap="round" strokeLinejoin="round" />
      {/* манжета */}
      <line x1={wrist[0] - ux * 6} y1={wrist[1] - uy * 6} x2={wrist[0] + ux * 12} y2={wrist[1] + uy * 12} stroke={p.shirt} strokeWidth={84} strokeLinecap="butt" />
      <g transform={`translate(${hx} ${hy}) rotate(${angle})`}>
        {kind === 'point' ? (
          <>
            <rect x={18} y={-13} width={66} height={24} rx={12} fill={p.skin} stroke={p.skinShade} strokeWidth={3} />
            <ellipse cx={8} cy={2} rx={36} ry={32} fill={p.skin} stroke={p.skinShade} strokeWidth={3} />
          </>
        ) : kind === 'open' ? (
          <>
            {[-26, -9, 8, 25].map((o) => (
              <rect key={o} x={18} y={o - 8} width={50} height={17} rx={8.5} fill={p.skin} stroke={p.skinShade} strokeWidth={3} />
            ))}
            <rect x={-6} y={-44} width={38} height={18} rx={9} fill={p.skin} stroke={p.skinShade} strokeWidth={3} transform="rotate(-38 -6 -30)" />
            <ellipse cx={8} cy={0} rx={34} ry={36} fill={p.skin} stroke={p.skinShade} strokeWidth={3} />
          </>
        ) : (
          <ellipse cx={8} cy={0} rx={38} ry={34} fill={p.skin} stroke={p.skinShade} strokeWidth={3} />
        )}
      </g>
    </g>
  );
};

const Mouth: React.FC<{kind: Face['mouth']; open: number}> = ({kind, open}) => {
  const dark = '#5A2620';
  if (open > 0.06) {
    // говорит: рот открывается, уголки зависят от эмоции
    const h = 8 + open * 30;
    const corner = kind === 'smile' ? -7 : kind === 'frown' ? 6 : 0;
    return (
      <g>
        <path d={`M -34 ${corner} Q 0 ${-6 + corner * 0.3} 34 ${corner} Q 0 ${h * 1.9} -34 ${corner} Z`} fill={dark} stroke="#3B1612" strokeWidth={4} strokeLinejoin="round" />
        <path d={`M -24 ${corner + 2} Q 0 ${corner + 6} 24 ${corner + 2} L 20 ${corner + 9} Q 0 ${corner + 12} -20 ${corner + 9} Z`} fill="#FBF6EC" />
      </g>
    );
  }
  if (kind === 'o') {
    return <ellipse cx={0} cy={6} rx={17} ry={23} fill={dark} stroke="#3B1612" strokeWidth={4} />;
  }
  const d =
    kind === 'smile'
      ? 'M -38 -6 Q 0 26 38 -6'
      : kind === 'frown'
        ? 'M -28 10 Q 0 -8 28 10'
        : kind === 'firm'
          ? 'M -26 2 L 26 2'
          : 'M -28 0 Q 0 9 28 0';
  return <path d={d} fill="none" stroke="#3B1612" strokeWidth={7} strokeLinecap="round" />;
};

export type NarratorProps = {
  palette: Palette;
  pose: Pose;
  emotion: Emotion;
  /** Предыдущая поза и эмоция — для плавного перехода; blend 0 → 1 */
  fromPose?: Pose;
  fromEmotion?: Emotion;
  blend?: number;
  /** Время в секундах: от него зависят моргание и покачивание */
  time: number;
  /** Насколько открыт рот: 0…1 */
  mouthOpen?: number;
  /** Куда смотрит: -1 влево … 1 вправо */
  gaze?: number;
};

/** Рисуется в поле 800 x 1000 (по пояс). */
export const Narrator: React.FC<NarratorProps> = ({palette: p, pose, emotion, fromPose, fromEmotion, blend = 1, time, mouthOpen = 0, gaze = 0}) => {
  const rig = mixRig(RIGS[fromPose ?? pose], RIGS[pose], blend);
  const face = mixFace(FACES[fromEmotion ?? emotion], FACES[emotion], blend);

  // Жизнь: дыхание, лёгкий наклон головы, моргание примерно раз в 3,4 с.
  const breathe = Math.sin(time * 1.7) * 3;
  const sway = Math.sin(time * 0.9) * 0.6;
  const headBob = Math.sin(time * 1.7 + 0.8) * 2.5;
  const cycle = (time + 0.7) % 3.4;
  const blink = cycle < 0.16 ? 1 - Math.abs(cycle - 0.08) / 0.08 : 0;
  const eyeOpen = Math.max(0.05, face.eye * (1 - blink));
  const look = gaze * 7 + Math.sin(time * 0.5) * 1.5;
  const handActive = true;

  const brow = (cx: number, b: [number, number], flip: number) => (
    <path
      d={`M -34 0 Q 0 ${-face.arch} 34 0`}
      fill="none"
      stroke={p.hair}
      strokeWidth={11}
      strokeLinecap="round"
      transform={`translate(${cx} ${322 + b[0]}) rotate(${b[1]}) scale(${flip} 1)`}
    />
  );
  const eye = (cx: number) => (
    <g transform={`translate(${cx} 388)`}>
      <ellipse rx={27} ry={29 * eyeOpen} fill="#FBF8F1" stroke={p.skinShade} strokeWidth={2.5} />
      {/* зрачок сжимается вместе с веком — так моргание выглядит естественно */}
      <g transform={`scale(1 ${Math.min(1, eyeOpen)})`}>
        <circle cx={look} cy={1} r={14.5} fill="#33241A" />
        <circle cx={look + 5} cy={-5} r={4.5} fill="#FFFFFF" />
      </g>
    </g>
  );

  return (
    <svg width={800} height={1000} viewBox="0 0 800 1000" style={{overflow: 'visible'}}>
      <g transform={`rotate(${sway} 400 1000)`}>
        {/* левая рука (дальняя от доски) — за корпусом */}
        <Arm shoulder={SHOULDER_L} elbow={rig.le} wrist={rig.lw} hand={rig.hand === 'point' || rig.hand === 'chin' ? 'fist' : rig.hand} p={p} active={pose === 'surprise' || pose === 'welcome'} />

        {/* корпус */}
        <g transform={`translate(0 ${breathe * 0.4})`}>
          <path d="M 176 1010 C 176 820, 196 700, 300 652 L 500 652 C 604 700, 624 820, 624 1010 Z" fill={p.coat} stroke={p.coatShade} strokeWidth={6} />
          <path d="M 340 652 L 400 800 L 460 652 Z" fill={p.shirt} />
          <path d="M 300 652 L 344 648 L 402 806 L 366 850 Z" fill={p.coatShade} />
          <path d="M 500 652 L 456 648 L 398 806 L 434 850 Z" fill={p.coatShade} />
          {[870, 930].map((y) => (
            <circle key={y} cx={400} cy={y} r={9} fill={p.coatShade} />
          ))}
        </g>

        {/* шея и шарф */}
        <rect x={346} y={530} width={108} height={140} rx={30} fill={p.skinShade} />
        <path d="M 318 626 C 360 664, 440 664, 482 626 L 492 676 C 444 712, 356 712, 308 676 Z" fill={p.accent2} />
        <path d="M 318 626 C 360 664, 440 664, 482 626" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={5} />

        {/* голова */}
        <g transform={`translate(0 ${headBob + 46}) rotate(${rig.tilt} 400 560)`}>
          <ellipse cx={272} cy={398} rx={24} ry={38} fill={p.skinShade} />
          <ellipse cx={528} cy={398} rx={24} ry={38} fill={p.skinShade} />
          <path d="M 276 350 C 276 216, 524 216, 524 350 L 524 420 C 524 520, 464 566, 400 566 C 336 566, 276 520, 276 420 Z" fill={p.skin} />
          {/* волосы: шапка с боковым пробором */}
          <path d="M 262 372 C 236 196, 560 176, 540 372 C 534 318, 508 286, 470 276 C 420 300, 330 298, 296 280 C 276 304, 266 332, 262 372 Z" fill={p.hair} />
          <path d="M 300 262 C 350 300, 430 296, 486 262" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={8} strokeLinecap="round" />
          {/* щёки */}
          <ellipse cx={318} cy={452} rx={24} ry={15} fill={p.accent2} opacity={0.16} />
          <ellipse cx={482} cy={452} rx={24} ry={15} fill={p.accent2} opacity={0.16} />
          {eye(346)}
          {eye(454)}
          {/* очки */}
          <g fill="rgba(255,255,255,0.07)" stroke={p.ink} strokeWidth={7}>
            <circle cx={346} cy={388} r={47} />
            <circle cx={454} cy={388} r={47} />
          </g>
          <path d="M 392 384 Q 400 374 408 384" fill="none" stroke={p.ink} strokeWidth={7} strokeLinecap="round" />
          <path d="M 299 380 L 268 370 M 501 380 L 532 370" fill="none" stroke={p.ink} strokeWidth={7} strokeLinecap="round" />
          {brow(346, face.browL, 1)}
          {brow(454, face.browR, -1)}
          <path d="M 400 402 C 392 430, 386 448, 398 454 L 412 454" fill="none" stroke={p.skinShade} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          <g transform="translate(400 498)">
            <Mouth kind={face.mouth} open={mouthOpen} />
          </g>
        </g>

        {/* правая рука (ближняя к доске) — поверх корпуса */}
        <Arm shoulder={SHOULDER_R} elbow={rig.re} wrist={rig.rw} hand={rig.hand === 'chin' ? 'fist' : rig.hand} p={p} active={handActive} />
      </g>
    </svg>
  );
};
