/**
 * Фон канала — направления, которые ОТЛИЧАЮТСЯ от логотипа (C · Pulse)
 * цветом, стилем и содержанием (без линии пульса и без бумажного фона).
 * 2560x1440; текст только в безопасной зоне 1546x423 по центру.
 */
import React from 'react';
import {AbsoluteFill, random} from 'remotion';
import './Wordmarks'; // шрифты
import {WmPulse} from './Wordmarks';

const W = 2560;
const H = 1440;
const SAFE = {x: (W - 1546) / 2, y: (H - 423) / 2, w: 1546, h: 423};
const inSafe = (x: number, y: number, pad = 120) =>
  x > SAFE.x - pad && x < SAFE.x + SAFE.w + pad && y > SAFE.y - pad / 2 && y < SAFE.y + SAFE.h + pad / 2;

const Text: React.FC<{name: React.ReactNode; tag: string; nameStyle: React.CSSProperties; tagStyle: React.CSSProperties}> = ({name, tag, nameStyle, tagStyle}) => (
  <div style={{position: 'absolute', left: SAFE.x, top: SAFE.y, width: SAFE.w, height: SAFE.h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center'}}>
    <div style={{whiteSpace: 'nowrap', lineHeight: 1, ...nameStyle}}>{name}</div>
    <div style={{whiteSpace: 'nowrap', ...tagStyle}}>{tag}</div>
  </div>
);

/* ============ 1. MICROSCOPE: бирюзовый мир клеток под микроскопом ============ */
export const BannerMicroscope: React.FC = () => {
  const cells = Array.from({length: 110}, (_, i) => {
    const x = random(`mx${i}`) * W;
    const y = random(`my${i}`) * H;
    const r = 60 + random(`mr${i}`) * 170;
    const blur = random(`mb${i}`) < 0.35 ? 10 + random(`mbb${i}`) * 18 : 0;
    const hue = random(`mh${i}`) < 0.5 ? '#7FE3D0' : random(`mh2${i}`) < 0.5 ? '#FFB4A2' : '#B9F3FF';
    return {x, y, r, blur, hue};
  }).filter((c) => !inSafe(c.x, c.y, c.r + 40));
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, #0F5A63 0%, #083740 55%, #04222A 100%)'}}>
      <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
        <defs>
          {[10, 16, 24].map((b) => (
            <filter key={b} id={`b${b}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={b} />
            </filter>
          ))}
        </defs>
        {cells.map((c, i) => {
          const f = c.blur ? `url(#b${c.blur < 14 ? 10 : c.blur < 20 ? 16 : 24})` : undefined;
          return (
            <g key={i} filter={f} opacity={c.blur ? 0.45 : 0.85}>
              <circle cx={c.x} cy={c.y} r={c.r} fill={c.hue} fillOpacity={0.12} stroke={c.hue} strokeWidth={6} strokeOpacity={0.8} />
              <circle cx={c.x + c.r * 0.15} cy={c.y - c.r * 0.1} r={c.r * 0.32} fill={c.hue} fillOpacity={0.35} />
              <circle cx={c.x + c.r * 0.22} cy={c.y - c.r * 0.16} r={c.r * 0.09} fill={c.hue} fillOpacity={0.8} />
            </g>
          );
        })}
      </svg>
      <Text
        name={<>All that <i>matters</i></>}
        tag="the tiny world inside your body, explained simply"
        nameStyle={{fontFamily: 'DM Serif Display', fontSize: 170, color: '#EFFFFB'}}
        tagStyle={{fontFamily: 'DM Serif Display', fontStyle: 'italic', fontSize: 52, color: '#9DE9DA'}}
      />
    </AbsoluteFill>
  );
};

/* ============ 2. BLUEPRINT: синий чертёж анатомии ============ */
const Draw: React.FC<{kind: 'heart' | 'brain' | 'body' | 'lungs'; x: number; y: number; s: number; label: string}> = ({kind, x, y, s, label}) => {
  const p = {fill: 'none', stroke: '#EAF2FF', strokeWidth: 4 / s, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  const shapes = {
    heart: (
      <g {...p}>
        <path d="M -30 -20 C -60 0, -50 50, -5 70 C 30 60, 55 20, 40 -15 C 30 -40, 5 -40, -5 -25 C -12 -40, -25 -38, -30 -20 Z" />
        <path d="M -12 -30 L -14 -62 M 8 -32 C 10 -60, 40 -62, 44 -40 M -30 -20 L -42 -48 M 0 -5 C 5 20, 15 40, 25 55" />
      </g>
    ),
    brain: (
      <g {...p}>
        <path d="M -60 10 C -72 -30, -40 -62, -5 -60 C 30 -66, 66 -40, 62 0 C 66 30, 40 50, 10 46 C -10 56, -45 50, -55 32 C -64 26, -64 18, -60 10 Z" />
        <path d="M -5 -60 C -15 -30, 10 -10, -5 20 M -40 -20 C -25 -25, -20 -5, -35 5 M 25 -35 C 40 -25, 35 -5, 20 0 M 20 25 C 30 15, 45 20, 48 30 M 10 46 C 14 60, 10 70, 4 78" />
      </g>
    ),
    lungs: (
      <g {...p}>
        <path d="M 0 -60 L 0 -10 M 0 -10 C -10 0, -18 0, -24 -6 M 0 -10 C 10 0, 18 0, 24 -6" />
        <path d="M -24 -40 C -60 -40, -66 30, -60 50 C -40 60, -20 50, -14 40 C -14 10, -14 -20, -24 -40 Z" />
        <path d="M 24 -40 C 60 -40, 66 30, 60 50 C 40 60, 20 50, 14 40 C 14 10, 14 -20, 24 -40 Z" />
      </g>
    ),
    body: (
      <g {...p}>
        <circle cx={0} cy={-70} r={16} />
        <path d="M -8 -54 L -8 -46 M 8 -54 L 8 -46 M -30 -42 Q 0 -50 30 -42 L 34 10 L 22 12 L 20 -20 M -30 -42 L -34 10 L -22 12 L -20 -20 M -20 -20 L -18 20 L -22 80 L -8 80 L 0 25 L 8 80 L 22 80 L 18 20 L 20 -20" />
      </g>
    ),
  };
  return (
    <g transform={`translate(${x} ${y})`}>
      <g transform={`scale(${s})`}>{shapes[kind]}</g>
      <circle cx={0} cy={0} r={95 * s} fill="none" stroke="#EAF2FF" strokeOpacity={0.35} strokeWidth={2} strokeDasharray="10 10" />
      <line x1={70 * s} y1={-70 * s} x2={130 * s} y2={-130 * s} stroke="#EAF2FF" strokeWidth={2} />
      <text x={136 * s} y={-136 * s} fill="#EAF2FF" fontFamily="Space Mono" fontSize={30}>{label}</text>
    </g>
  );
};

export const BannerBlueprint: React.FC = () => (
  <AbsoluteFill style={{background: '#1B4FD8'}}>
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      {Array.from({length: Math.ceil(W / 40)}, (_, i) => (
        <line key={`v${i}`} x1={i * 40} x2={i * 40} y1={0} y2={H} stroke="#FFFFFF" strokeOpacity={i % 5 === 0 ? 0.16 : 0.06} strokeWidth={2} />
      ))}
      {Array.from({length: Math.ceil(H / 40)}, (_, i) => (
        <line key={`h${i}`} y1={i * 40} y2={i * 40} x1={0} x2={W} stroke="#FFFFFF" strokeOpacity={i % 5 === 0 ? 0.16 : 0.06} strokeWidth={2} />
      ))}
      <Draw kind="brain" x={230} y={640} s={1.5} label="FIG. 01 — BRAIN" />
      <Draw kind="heart" x={2310} y={640} s={1.5} label="FIG. 02 — HEART" />
      <Draw kind="lungs" x={330} y={1150} s={1.4} label="FIG. 03 — LUNGS" />
      <Draw kind="body" x={2200} y={1150} s={1.5} label="FIG. 04 — YOU" />
    </svg>
    <Text
      name="ALL THAT MATTERS"
      tag="// a field guide to your own body"
      nameStyle={{fontFamily: 'Space Mono', fontWeight: 700, fontSize: 132, color: '#FFFFFF', letterSpacing: 6}}
      tagStyle={{fontFamily: 'Space Mono', fontSize: 46, color: '#BFD3FF'}}
    />
  </AbsoluteFill>
);

/* ============ 3. NEURONS: светящаяся сеть нейронов на тёмно-фиолетовом ============ */
export const BannerNeurons: React.FC = () => {
  const nodes = Array.from({length: 150}, (_, i) => ({x: random(`nx${i}`) * W, y: random(`ny${i}`) * H, r: 6 + random(`nr${i}`) * 14})).filter((n) => !inSafe(n.x, n.y, 60));
  const links: [number, number][] = [];
  nodes.forEach((a, i) => {
    const near = nodes
      .map((b, j) => ({j, d: Math.hypot(a.x - b.x, a.y - b.y)}))
      .filter((o) => o.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);
    near.forEach((o) => links.push([i, o.j]));
  });
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, #2A1450 0%, #160A2E 60%, #0B0618 100%)'}}>
      <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={8} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#glow)">
          {links.map(([i, j], k) => {
            const a = nodes[i];
            const b = nodes[j];
            const mx = (a.x + b.x) / 2 + (random(`lk${k}`) - 0.5) * 120;
            const my = (a.y + b.y) / 2 + (random(`lk2${k}`) - 0.5) * 120;
            return <path key={k} d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`} fill="none" stroke={k % 3 ? '#B07CFF' : '#4FE3FF'} strokeOpacity={0.55} strokeWidth={3} />;
          })}
          {nodes.map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={i % 4 ? '#E2CCFF' : '#7FF3FF'} />
          ))}
        </g>
      </svg>
      <Text
        name="ALL THAT MATTERS"
        tag="what's really happening inside you"
        nameStyle={{fontFamily: 'Anton', fontSize: 190, color: '#FFFFFF', letterSpacing: 8, textShadow: '0 0 40px #B07CFF88'}}
        tagStyle={{fontFamily: 'Space Mono', fontSize: 46, color: '#C9B4FF'}}
      />
    </AbsoluteFill>
  );
};

/* ============ 4. SOFT: мягкий градиент персик → сирень, «живые» размытые клетки ============ */
export const BannerSoft: React.FC = () => {
  const blobs = [
    {x: 260, y: 520, r: 360, c: '#FF9E80'},
    {x: 2330, y: 560, r: 400, c: '#B39DFF'},
    {x: 900, y: 1250, r: 330, c: '#FFC8A8'},
    {x: 1800, y: 180, r: 300, c: '#FFB3C7'},
    {x: 2200, y: 1300, r: 260, c: '#9FD8FF'},
    {x: 300, y: 1240, r: 240, c: '#C5B3FF'},
  ];
  return (
    <AbsoluteFill style={{background: 'linear-gradient(115deg, #FFE3D3 0%, #F6D6E8 50%, #DCD3FF 100%)'}}>
      <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
        <defs>
          <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={50} />
          </filter>
        </defs>
        <g filter="url(#soft)">
          {blobs.map((b, i) => (
            <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={b.c} opacity={0.75} />
          ))}
        </g>
        {blobs.slice(0, 4).map((b, i) => (
          <g key={i} opacity={0.5}>
            <circle cx={b.x} cy={b.y} r={b.r * 0.42} fill="none" stroke="#FFFFFF" strokeWidth={5} />
            <circle cx={b.x + 20} cy={b.y - 15} r={b.r * 0.13} fill="#FFFFFF" />
          </g>
        ))}
      </svg>
      <Text
        name={<>all that <i>matters</i></>}
        tag="your body, explained simply"
        nameStyle={{fontFamily: 'DM Serif Display', fontSize: 180, color: '#2B1B3D'}}
        tagStyle={{fontFamily: 'Space Mono', fontSize: 46, color: '#6B4E7A'}}
      />
    </AbsoluteFill>
  );
};

/* ---------- лист: как фон + логотип смотрятся вместе на странице канала ---------- */
const BANNERS: [string, string, React.FC][] = [
  ['1 · Microscope', 'бирюзовый мир клеток, классический шрифт', BannerMicroscope],
  ['2 · Blueprint', 'синий чертёж анатомии, «научная тетрадь»', BannerBlueprint],
  ['3 · Neurons', 'светящаяся сеть нейронов, ночь', BannerNeurons],
  ['4 · Soft', 'мягкий персик → сирень, живые клетки', BannerSoft],
];

const Crop: React.FC<{C: React.FC; cw: number; ch: number; scale: number}> = ({C, cw, ch, scale}) => (
  <div style={{width: cw * scale, height: ch * scale, overflow: 'hidden', borderRadius: 10, flexShrink: 0}}>
    <div style={{width: W, height: H, transform: `scale(${scale}) translate(${-(W - cw) / 2}px, ${-(H - ch) / 2}px)`, transformOrigin: '0 0', position: 'relative'}}>
      <C />
    </div>
  </div>
);
const Logo: React.FC<{d: number}> = ({d}) => (
  <div style={{width: d, height: d, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, boxShadow: '0 0 0 3px #fff'}}>
    <div style={{width: 800, height: 800, transform: `scale(${d / 800})`, transformOrigin: '0 0', position: 'relative'}}>
      <WmPulse />
    </div>
  </div>
);

export const Banner2Sheet: React.FC = () => (
  <AbsoluteFill style={{background: '#0F0F0F', padding: 40, display: 'flex', flexDirection: 'column', gap: 40}}>
    {BANNERS.map(([name, note, C]) => (
      <div key={name} style={{display: 'flex', gap: 36, alignItems: 'flex-start'}}>
        <div style={{width: 300, display: 'flex', flexDirection: 'column', gap: 8}}>
          <div style={{fontFamily: 'Archivo Black', fontSize: 30, color: '#fff'}}>{name}</div>
          <div style={{fontFamily: 'system-ui', fontSize: 18, color: '#aaa'}}>{note}</div>
          <div style={{fontFamily: 'system-ui', fontSize: 16, color: '#777', marginTop: 10}}>телефон:</div>
          <Crop C={C} cw={1546} ch={423} scale={0.19} />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 0}}>
          <div style={{fontFamily: 'system-ui', fontSize: 16, color: '#777', marginBottom: 8}}>страница канала на компьютере (фон + логотип)</div>
          <Crop C={C} cw={W} ch={423} scale={0.46} />
          <div style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 14}}>
            <Logo d={84} />
            <div style={{display: 'flex', flexDirection: 'column'}}>
              <span style={{fontFamily: 'system-ui', fontWeight: 700, fontSize: 26, color: '#fff'}}>All That Matters</span>
              <span style={{fontFamily: 'system-ui', fontSize: 16, color: '#aaa'}}>@allthatmatters · Shorts about your body</span>
            </div>
          </div>
        </div>
      </div>
    ))}
  </AbsoluteFill>
);
