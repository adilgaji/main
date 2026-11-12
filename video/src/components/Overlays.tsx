// Слои обработки стиля: вуаль, рисунок (сетка, полутона, царапины, прожектор) и мерцание.
// Все лежат ПОД текстом: надписи остаются чёткими. Всё считается от номера кадра.
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {rng} from '../lib/anim';
import {FRAME, useStyle} from '../style';

export const Tint: React.FC = () => {
  const {treatment} = useStyle();
  const t = treatment.tint;
  if (!t || t.opacity <= 0) {
    return null;
  }
  return <AbsoluteFill style={{backgroundColor: t.color, opacity: t.opacity, mixBlendMode: t.blend, pointerEvents: 'none'}} />;
};

/** Изометрическая сетка: три семейства линий (вертикальные и под ±30°). */
const IsoGrid: React.FC = () => {
  const {palette: p} = useStyle();
  const {width: W, height: H} = FRAME;
  const edge = 64; // длина ребра треугольника сетки
  const gap = (edge * Math.sqrt(3)) / 2; // расстояние между вертикальными линиями
  const k = Math.tan(Math.PI / 6); // наклон диагоналей
  const lines: React.ReactNode[] = [];
  for (let x = 0; x <= W; x += gap) {
    lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} />);
  }
  // Расстояние по вертикали между соседними диагоналями = edge
  for (let c = -W * k; c <= H + W * k; c += edge) {
    lines.push(<line key={`a${c}`} x1={0} y1={c} x2={W} y2={c + W * k} />);
    lines.push(<line key={`b${c}`} x1={0} y1={c + W * k} x2={W} y2={c} />);
  }
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} stroke={p.accent} strokeOpacity={0.2} strokeWidth={2}>
        {lines}
      </svg>
    </AbsoluteFill>
  );
};

const Halftone: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundImage: 'radial-gradient(circle, rgba(20,10,0,0.9) 1.3px, rgba(20,10,0,0) 1.9px)',
      backgroundSize: '9px 9px',
      opacity: 0.2,
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }}
  />
);

const Spotlight: React.FC = () => {
  const {palette: p} = useStyle();
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 55% 70% at 50% -5%, ${p.light}2E 0%, ${p.light}00 100%)`,
        mixBlendMode: 'screen',
        pointerEvents: 'none',
      }}
    />
  );
};

/** Царапины и пылинки старой плёнки: каждые 2 кадра — новые, но всегда одни и те же при перерисовке. */
const Scratches: React.FC = () => {
  const frame = useCurrentFrame();
  const r = rng(Math.floor(frame / 2) * 7717 + 11);
  const {width: W, height: H} = FRAME;
  const scratches: React.ReactNode[] = [];
  const count = r() < 0.45 ? 0 : r() < 0.35 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const x = r() * W;
    const lean = (r() - 0.5) * 24;
    scratches.push(<line key={`s${i}`} x1={x} y1={0} x2={x + lean} y2={H} stroke="#FFFFFF" strokeOpacity={0.2 + r() * 0.2} strokeWidth={1 + r() * 1.6} />);
  }
  const specks: React.ReactNode[] = [];
  const dust = 4 + Math.floor(r() * 7);
  for (let i = 0; i < dust; i++) {
    const light = r() < 0.55;
    specks.push(<circle key={`d${i}`} cx={r() * W} cy={r() * H} r={1.2 + r() * 3.2} fill={light ? '#FFFFFF' : '#000000'} fillOpacity={0.35 + r() * 0.35} />);
  }
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {scratches}
        {specks}
      </svg>
    </AbsoluteFill>
  );
};

export const PatternLayer: React.FC = () => {
  const {treatment} = useStyle();
  switch (treatment.pattern) {
    case 'isogrid':
      return <IsoGrid />;
    case 'halftone':
      return <Halftone />;
    case 'spotlight':
      return <Spotlight />;
    case 'scratches':
      return <Scratches />;
    default:
      return null;
  }
};

/** Мерцание яркости, как у плёнки: каждые 2 кадра случайно темнее. */
export const Flicker: React.FC = () => {
  const frame = useCurrentFrame();
  const {treatment} = useStyle();
  if (treatment.flicker <= 0) {
    return null;
  }
  const r = rng(Math.floor(frame / 2) * 977 + 3);
  return <AbsoluteFill style={{backgroundColor: '#000000', opacity: treatment.flicker * (0.15 + 0.85 * r()), pointerEvents: 'none'}} />;
};
