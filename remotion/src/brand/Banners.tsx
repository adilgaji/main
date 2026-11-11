/**
 * Баннер (фон) канала «All That Matters» в стиле логотипа C · Pulse.
 * Файл 2560x1440. Безопасная зона для ВСЕХ устройств — центр 1546x423:
 * название и подпись только там. Телефон видит только её, компьютер — полосу 2560x423, ТВ — всё.
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import './Wordmarks'; // регистрирует шрифты

const INK = '#141414';
const PAPER = '#F2EFE8';
const RED = '#E5322D';
const W = 2560;
const H = 1440;
const SAFE = {w: 1546, h: 423};

/** Линия ЭКГ на всю ширину; «удары» в заданных точках x. */
const ecg = (y: number, beats: number[], amp = 1, center = 0.42) => {
  let d = `M 0 ${y}`;
  // маленький удар в центре — его видно и на телефоне (как в логотипе)
  const all = [...beats.map((x) => [x, amp]), [W / 2, center]].sort((a, b) => a[0] - b[0]);
  for (const [x, a0] of all) {
    const amp = a0;
    d += ` L ${x - 60} ${y} L ${x - 35} ${y - 25 * amp} L ${x - 15} ${y} L ${x} ${y + 30 * amp} L ${x + 25} ${y - 120 * amp} L ${x + 55} ${y + 70 * amp} L ${x + 80} ${y} L ${x + 120} ${y - 30 * amp} L ${x + 160} ${y}`;
  }
  return d + ` L ${W} ${y}`;
};

/** Монолинейные иконки органов (одна толщина линии — стиль бренда). */
const Organ: React.FC<{kind: 'heart' | 'brain' | 'muscle' | 'cell' | 'lungs'; x: number; y: number; s?: number; color?: string}> = ({kind, x, y, s = 1, color = INK}) => {
  const p = {fill: 'none', stroke: color, strokeWidth: 9 / s, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  const shapes = {
    heart: (
      <g {...p}>
        <path d="M -30 -20 C -60 0, -50 50, -5 70 C 30 60, 55 20, 40 -15 C 30 -40, 5 -40, -5 -25 C -12 -40, -25 -38, -30 -20 Z" />
        <path d="M -12 -30 L -14 -62 M 8 -32 C 10 -60, 40 -62, 44 -40 M -30 -20 L -42 -48" />
      </g>
    ),
    brain: (
      <g {...p}>
        <path d="M -60 10 C -72 -30, -40 -62, -5 -60 C 30 -66, 66 -40, 62 0 C 66 30, 40 50, 10 46 C -10 56, -45 50, -55 32 C -64 26, -64 18, -60 10 Z" />
        <path d="M -5 -60 C -15 -30, 10 -10, -5 20 M -40 -20 C -25 -25, -20 -5, -35 5 M 25 -35 C 40 -25, 35 -5, 20 0 M 20 25 C 30 15, 45 20, 48 30" />
      </g>
    ),
    muscle: (
      <g {...p}>
        <path d="M -70 40 C -40 40, -20 30, -5 0 C 5 -30, 20 -55, 40 -55 C 60 -55, 62 -30, 50 -20 C 70 -10, 70 20, 40 30 C 10 40, -20 60, -70 60" />
        <path d="M 0 5 C 15 -10, 35 -10, 45 0" />
      </g>
    ),
    cell: (
      <g {...p}>
        <circle r={62} />
        <circle cx={8} cy={-4} r={22} />
        <circle cx={14} cy={-10} r={5} fill={color} />
        <path d="M -40 30 L -24 30 M -38 -30 C -30 -38, -22 -38, -14 -30" />
      </g>
    ),
    lungs: (
      <g {...p}>
        <path d="M 0 -60 L 0 -10 M 0 -10 C -10 0, -18 0, -24 -6 M 0 -10 C 10 0, 18 0, 24 -6" />
        <path d="M -24 -40 C -60 -40, -66 30, -60 50 C -40 60, -20 50, -14 40 C -14 10, -14 -20, -24 -40 Z" />
        <path d="M 24 -40 C 60 -40, 66 30, 60 50 C 40 60, 20 50, 14 40 C 14 10, 14 -20, 24 -40 Z" />
      </g>
    ),
  };
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{shapes[kind]}</g>;
};

/* Вертикальная раскладка внутри безопасной зоны (y 508–931): название — пульс — подпись. */
const TITLE_Y = 560; // верх названия
const LINE_Y = 742; // линия пульса
const TAG_Y = 800; // верх подписи

const Title: React.FC<{color?: string; tagColor?: string; tagline: string}> = ({color = INK, tagColor = '#5B5B5B', tagline}) => (
  <>
    <div style={{position: 'absolute', left: 0, width: W, top: TITLE_Y, textAlign: 'center', whiteSpace: 'nowrap', fontFamily: 'Archivo Black', fontSize: 132, lineHeight: 1, color, textTransform: 'uppercase', letterSpacing: 2}}>
      ALL THAT MATTERS
    </div>
    <div style={{position: 'absolute', left: 0, width: W, top: TAG_Y, textAlign: 'center', whiteSpace: 'nowrap', fontFamily: 'Space Mono', fontSize: 46, color: tagColor, letterSpacing: 1}}>
      {tagline}
    </div>
  </>
);

/* 1. Классический: светлый фон, пульс на всю ширину между названием и подписью. */
export const BannerClassic: React.FC = () => (
  <AbsoluteFill style={{background: PAPER}}>
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      <path d={ecg(LINE_Y, [300, 2260], 0.9)} fill="none" stroke={RED} strokeWidth={13} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
    <Title tagline="your body, explained simply" />
  </AbsoluteFill>
);

/* 2. Пульс через органы: по краям (видно на компьютере и ТВ) — мозг, сердце, мышца, клетка; линия «бьётся» под каждым. */
export const BannerOrgans: React.FC = () => (
  <AbsoluteFill style={{background: PAPER}}>
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      <path d={ecg(LINE_Y, [150, 400, 2160, 2410], 0.75)} fill="none" stroke={RED} strokeWidth={12} strokeLinejoin="round" strokeLinecap="round" />
      <Organ kind="brain" x={170} y={600} s={1.0} />
      <Organ kind="heart" x={420} y={605} s={1.05} color={RED} />
      <Organ kind="muscle" x={2170} y={605} s={1.0} />
      <Organ kind="cell" x={2420} y={600} s={0.95} />
    </svg>
    <Title tagline="what's really happening inside you" />
  </AbsoluteFill>
);

/* 3. Тёмный: чёрный фон, кремовое название, красный пульс — контрастно на тёмной теме YouTube. */
export const BannerDark: React.FC = () => (
  <AbsoluteFill style={{background: '#121212'}}>
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      <path d={ecg(LINE_Y, [300, 2260], 0.9)} fill="none" stroke={RED} strokeWidth={13} strokeLinejoin="round" strokeLinecap="round" />
      <Organ kind="heart" x={300} y={600} s={1.0} color="#4A4A4A" />
      <Organ kind="brain" x={2260} y={600} s={1.0} color="#4A4A4A" />
    </svg>
    <Title color={PAPER} tagColor="#A8A8A8" tagline="your body, explained simply" />
  </AbsoluteFill>
);

/* ---------- лист предпросмотра: телевизор / компьютер / телефон ---------- */
const BANNERS: [string, React.FC][] = [
  ['1 · Classic', BannerClassic],
  ['2 · Pulse through organs', BannerOrgans],
  ['3 · Dark', BannerDark],
];

const Crop: React.FC<{C: React.FC; cw: number; ch: number; scale: number}> = ({C, cw, ch, scale}) => (
  <div style={{width: cw * scale, height: ch * scale, overflow: 'hidden', borderRadius: 8, boxShadow: '0 0 0 2px #00000022', flexShrink: 0}}>
    <div style={{width: W, height: H, transform: `scale(${scale}) translate(${-(W - cw) / 2}px, ${-(H - ch) / 2}px)`, transformOrigin: '0 0', position: 'relative'}}>
      <C />
    </div>
  </div>
);

export const BannerSheet: React.FC = () => (
  <AbsoluteFill style={{background: '#E8EAEE', padding: 40, display: 'flex', flexDirection: 'column', gap: 46, fontFamily: 'Archivo Black'}}>
    {BANNERS.map(([name, C]) => (
      <div key={name} style={{display: 'flex', gap: 40, alignItems: 'flex-start'}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
          <div style={{fontSize: 30}}>{name}</div>
          <div style={{fontFamily: 'system-ui', fontSize: 18, color: '#555'}}>телевизор — весь файл</div>
          <Crop C={C} cw={W} ch={H} scale={0.22} />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 8, marginTop: 44}}>
          <div style={{fontFamily: 'system-ui', fontSize: 18, color: '#555'}}>компьютер</div>
          <Crop C={C} cw={W} ch={423} scale={0.36} />
          <div style={{fontFamily: 'system-ui', fontSize: 18, color: '#555', marginTop: 14}}>телефон</div>
          <Crop C={C} cw={SAFE.w} ch={SAFE.h} scale={0.36} />
        </div>
      </div>
    ))}
  </AbsoluteFill>
);
