/**
 * Фон-«мир» каждого стиля. В каждом кадре — своя вариация (seed = номер кадра):
 * меняются расположение, цвета и предметы, но мир остаётся узнаваемым.
 * Всё в относительных координатах: работает и в вертикальном (1080×1920), и в горизонтальном (1920×1080) кадре.
 * Главный объект кадра стоит в «фокусе» (focus()) — фон строится вокруг него, строго симметрично.
 */
import React from 'react';
import {AbsoluteFill, random} from 'remotion';
import {getSize} from '../lib/Env';
import type {StyleId} from './themes';

/** Точка, вокруг которой строится кадр (центр главного объекта). */
let FOCUS: null | {x: number; y: number; r: number} = null;
/** Задать фокус вручную (например, для горизонтальной обложки); null — по умолчанию. */
export const setFocus = (f: null | {x: number; y: number; r: number}) => {
  FOCUS = f;
};
export const focus = () => {
  if (FOCUS) return FOCUS;
  const {W, H} = getSize();
  return W > H ? {x: 672, y: 700, r: 520} : {x: W / 2, y: 900, r: 430};
};

type BP = {seed: string};
const rnd = (seed: string) => (k: string | number) => random(`${seed}·${k}`);
const pick = <T,>(r: number, arr: T[]) => arr[Math.floor(r * arr.length) % arr.length];
const Svg: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => {
  const {W, H} = getSize();
  return (
    <svg style={{position: 'absolute', inset: 0, ...style}} width={W} height={H}>
      {children}
    </svg>
  );
};
const Stars: React.FC<{seed: string; n?: number; color?: string; maxY?: number}> = ({seed, n = 60, color = '#FFF7D6', maxY}) => {
  const {W, H} = getSize();
  const r = rnd(seed);
  return (
    <>
      {Array.from({length: n}, (_, i) => (
        <circle key={i} cx={r(`x${i}`) * W} cy={r(`y${i}`) * (maxY ?? H)} r={1.5 + r(`r${i}`) * 3.5} fill={color} opacity={0.35 + r(`o${i}`) * 0.6} />
      ))}
    </>
  );
};

/* 1. Акварель: пятна-«заливки» вокруг центра (обработка — фильтр стиля) */
const Watercolour: React.FC<BP> = ({seed}) => {
  const {W, H} = getSize();
  const r = rnd(seed);
  const f = focus();
  const tones = ['#8FA7D6', '#B9A6D9', '#9CC9C2', '#F2B9A0', '#A9C98F', '#E8C27A'];
  return (
    <AbsoluteFill style={{background: '#F7F1E5'}}>
      <Svg>
        <circle cx={f.x} cy={f.y} r={f.r} fill={pick(r('c0'), tones)} opacity={0.55} />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={f.x + (r(`x${i}`) - 0.5) * W * 0.8} cy={f.y + (r(`y${i}`) - 0.5) * H * 0.6} r={f.r * (0.35 + r(`r${i}`) * 0.35)} fill={pick(r(`c${i + 1}`), tones)} opacity={0.45} />
        ))}
        <circle cx={W * (r('sx') < 0.5 ? 0.2 : 0.8)} cy={H * 0.28} r={60} fill="#F3D27A" opacity={0.8} />
      </Svg>
    </AbsoluteFill>
  );
};

/* 2. Мозаика: медальон, меандр (вся картинка потом «рассыпается» на камешки) */
const Meander: React.FC<{y: number; color: string}> = ({y, color}) => {
  const {W} = getSize();
  return (
    <g>
      {Array.from({length: Math.ceil(W / 60) + 1}, (_, i) => (
        <path key={i} d={`M ${i * 60} ${y + 40} L ${i * 60} ${y} L ${i * 60 + 45} ${y} L ${i * 60 + 45} ${y + 30} L ${i * 60 + 20} ${y + 30} L ${i * 60 + 20} ${y + 15}`} stroke={color} strokeWidth={10} fill="none" />
      ))}
    </g>
  );
};
const Mosaic: React.FC<BP> = ({seed}) => {
  const {H} = getSize();
  const r = rnd(seed);
  const f = focus();
  const pal = pick(r('p'), [
    ['#2E4E7E', '#3D6699', '#B5803B', '#A4452E'],
    ['#5E8C6A', '#7AA884', '#B5803B', '#A4452E'],
    ['#7A3A2E', '#A4452E', '#E3A94F', '#2E4E7E'],
  ]);
  return (
    <AbsoluteFill style={{background: '#E9DFC9'}}>
      <Svg>
        <circle cx={f.x} cy={f.y} r={f.r} fill={pal[0]} />
        <circle cx={f.x} cy={f.y} r={f.r * 0.85} fill={pal[1]} />
        <circle cx={f.x} cy={f.y} r={f.r} fill="none" stroke={pal[2]} strokeWidth={30} />
        {Array.from({length: 16}, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return <circle key={i} cx={f.x + Math.cos(a) * (f.r + 50)} cy={f.y + Math.sin(a) * (f.r + 50)} r={18} fill={i % 2 ? pal[3] : pal[2]} />;
        })}
        <Meander y={40} color={pal[0]} />
        <Meander y={H - 90} color={pal[0]} />
      </Svg>
    </AbsoluteFill>
  );
};

/* 3. Суми-э: рисовая бумага, энсо, ветка, горы тушью, красная печать */
const SumiE: React.FC<BP> = ({seed}) => {
  const {W, H} = getSize();
  const r = rnd(seed);
  const flip = r('f') < 0.5;
  const ink = '#1C1C1C';
  const items = [r('a') < 0.6, r('b') < 0.6, r('c') < 0.5];
  return (
    <AbsoluteFill style={{background: '#F2ECDD'}}>
      <Svg style={{transform: flip ? 'scaleX(-1)' : undefined}}>
        {items[0] && <path d={`M ${W * 0.86} ${H * 0.36} A ${W * 0.09} ${W * 0.09} 0 1 1 ${W * 0.78} ${H * 0.3}`} stroke={ink} strokeWidth={22} fill="none" strokeLinecap="round" opacity={0.8} />}
        {items[1] && (
          <path d={`M 0 ${H * 0.86} C ${W * 0.25} ${H * 0.81}, ${W * 0.4} ${H * 0.84}, ${W * 0.58} ${H * 0.77} M ${W * 0.28} ${H * 0.83} C ${W * 0.31} ${H * 0.79}, ${W * 0.35} ${H * 0.78}, ${W * 0.39} ${H * 0.775}`} stroke={ink} strokeWidth={16} fill="none" strokeLinecap="round" />
        )}
        {items[2] && (
          <g opacity={0.16}>
            <path d={`M 0 ${H * 0.95} L ${W * 0.22} ${H * 0.8} L ${W * 0.38} ${H * 0.9} L ${W * 0.62} ${H * 0.74} L ${W} ${H * 0.92} L ${W} ${H} L 0 ${H} Z`} fill={ink} />
          </g>
        )}
        <ellipse cx={focus().x} cy={focus().y} rx={focus().r * 0.95} ry={focus().r * 0.82} fill={ink} opacity={0.07} />
      </Svg>
      <div style={{position: 'absolute', right: W > H ? 640 : 200, bottom: W > H ? 60 : 470, width: 96, height: 96, background: '#C2362B', color: '#F2ECDD', fontFamily: 'Cinzel', fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: 1, borderRadius: 8, rotate: '-3deg', opacity: 0.9}}>
        ALL<br />THAT
      </div>
    </AbsoluteFill>
  );
};

/* 4. Импасто: густые полосы краски, светило, «вихри» (рельеф даёт фильтр стиля) */
const Impasto: React.FC<BP> = ({seed}) => {
  const {W, H} = getSize();
  const r = rnd(seed);
  const f = focus();
  const pal = pick(r('p'), [
    ['#1E2B55', '#2D3F78', '#24356A', '#3A4E8A', '#F2C94C'],
    ['#2E1F3E', '#4A2E5A', '#3A2448', '#6A3E6E', '#F2994A'],
    ['#1F3A34', '#2E5A4E', '#264A40', '#3E6E5E', '#E8D27A'],
  ]);
  const n = Math.ceil(H / 200) + 1;
  return (
    <AbsoluteFill style={{background: pal[0]}}>
      <Svg>
        {Array.from({length: n}, (_, i) => (
          <path key={i} d={`M -60 ${120 + i * 200} C ${W * 0.3} ${60 + i * 200 + r(`a${i}`) * 80}, ${W * 0.65} ${200 + i * 200}, ${W + 60} ${110 + i * 200}`} stroke={pal[1 + (i % 3)]} strokeWidth={150} fill="none" />
        ))}
        <circle cx={W * (r('sx') < 0.5 ? 0.22 : 0.78)} cy={H * 0.24} r={80} fill={pal[4]} />
        <circle cx={W * (r('sx') < 0.5 ? 0.22 : 0.78)} cy={H * 0.24} r={125} fill="none" stroke={pal[4]} strokeWidth={22} opacity={0.55} />
        <circle cx={f.x} cy={f.y} r={f.r * 0.92} fill={pal[3]} />
      </Svg>
    </AbsoluteFill>
  );
};

/* 5. Ночная гуашь: комната ночью — окно с луной, кровать, лампа, растение, книги */
const Gouache: React.FC<BP> = ({seed}) => {
  const {W, H} = getSize();
  const r = rnd(seed);
  const wide = W > H;
  const floor = wide ? H * 0.82 : H * 0.7;
  const flip = r('f') < 0.5;
  const set = Math.floor(r('s') * 3);
  return (
    <AbsoluteFill style={{background: '#14213D'}}>
      <Svg style={{transform: flip ? 'scaleX(-1)' : undefined}}>
        <rect y={floor} width={W} height={H - floor} fill="#1B2D4F" />
        {/* окно с луной */}
        <rect x={W * 0.74} y={H * 0.27} width={170} height={230} rx={85} fill="#22385F" />
        <circle cx={W * 0.74 + 85} cy={H * 0.27 + 80} r={40} fill="#F4D58D" />
        <circle cx={W * 0.74 + 102} cy={H * 0.27 + 68} r={37} fill="#22385F" />
        <path d={`M ${W * 0.74} ${H * 0.27 + 120} L ${W * 0.74 + 170} ${H * 0.27 + 120} M ${W * 0.74 + 85} ${H * 0.27} L ${W * 0.74 + 85} ${H * 0.27 + 230}`} stroke="#14213D" strokeWidth={10} />
        {set === 0 && (
          <g>
            <rect x={W * 0.06} y={floor - 120} width={W * 0.4} height={110} rx={36} fill="#E07A5F" />
            <rect x={W * 0.08} y={floor - 170} width={W * 0.14} height={70} rx={35} fill="#F2E9DC" />
          </g>
        )}
        {set === 1 && (
          <g>
            <rect x={W * 0.12} y={floor - 260} width={18} height={260} fill="#3D5A80" />
            <path d={`M ${W * 0.12 - 70} ${floor - 260} L ${W * 0.12 + 88} ${floor - 260} L ${W * 0.12 + 50} ${floor - 340} L ${W * 0.12 - 32} ${floor - 340} Z`} fill="#F4D58D" />
            <circle cx={W * 0.12 + 9} cy={floor - 200} r={160} fill="#F4D58D" opacity={0.08} />
          </g>
        )}
        {set === 2 && (
          <g>
            <rect x={W * 0.1} y={floor - 90} width={110} height={90} rx={14} fill="#E07A5F" />
            {[-40, 0, 40].map((a, i) => (
              <ellipse key={i} cx={W * 0.1 + 55 + a} cy={floor - 150 - i * 10} rx={26} ry={70} fill="#81B29A" transform={`rotate(${a / 2} ${W * 0.1 + 55 + a} ${floor - 150})`} />
            ))}
          </g>
        )}
        <Stars seed={seed} n={36} color="#F4D58D" maxY={floor - 40} />
      </Svg>
    </AbsoluteFill>
  );
};

/* 6. Ботаническая таблица: старая бумага, двойная рамка, номер таблицы, веточки по углам */
const Botanical: React.FC<BP> = ({seed}) => {
  const {W, H} = getSize();
  const r = rnd(seed);
  const ink = '#2F2A22';
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][Math.floor(r('n') * 12)];
  const sprig = (x: number, y: number, s: number, rot: number) => (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} stroke={ink} strokeWidth={2.4} fill="none" opacity={0.75}>
      <path d="M 0 0 C 20 -40, 40 -80, 50 -140" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <path d={`M ${10 + i * 10} ${-30 - i * 28} C ${-20 + i * 8} ${-50 - i * 28}, ${-30 + i * 8} ${-70 - i * 28}, ${4 + i * 10} ${-60 - i * 28}`} />
          <path d={`M ${12 + i * 10} ${-34 - i * 28} C ${40 + i * 8} ${-46 - i * 28}, ${54 + i * 8} ${-70 - i * 28}, ${24 + i * 10} ${-66 - i * 28}`} />
        </g>
      ))}
    </g>
  );
  const m = W > H ? 40 : 50;
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, #F3EAD3 0%, #E6D7B5 100%)'}}>
      <Svg>
        <rect x={m} y={W > H ? 40 : 180} width={W - m * 2} height={H - (W > H ? 80 : 360)} fill="none" stroke={ink} strokeWidth={4} />
        <rect x={m + 14} y={(W > H ? 40 : 180) + 14} width={W - m * 2 - 28} height={H - (W > H ? 80 : 360) - 28} fill="none" stroke={ink} strokeWidth={1.5} />
        {sprig(m + 60, (W > H ? H - 70 : H - 220), 1, 20)}
        {sprig(W - m - 60, (W > H ? H - 70 : H - 220), 1, -20)}
        <text x={W > H ? 672 : W / 2} y={W > H ? H - 60 : H - 200} textAnchor="middle" fontFamily="Cinzel" fontSize={30} fill={ink} letterSpacing={6}>{`PLATE ${roman}`}</text>
      </Svg>
    </AbsoluteFill>
  );
};

/* 7. Бумажная аппликация: слои-волны с тенями, солнце или луна */
const PaperCut: React.FC<BP> = ({seed}) => {
  const {W, H} = getSize();
  const r = rnd(seed);
  const f = focus();
  const pal = pick(r('p'), [
    ['#1A2846', '#24375E', '#2E4A7A', '#3C5E92', '#5077AB'],
    ['#1E3A3A', '#24504A', '#2E6A5E', '#3E8474', '#5AA08C'],
    ['#3A1E3A', '#58284E', '#7A3A5E', '#9A5070', '#C07080'],
  ]);
  const sh = 'drop-shadow(0 14px 10px rgba(0,0,0,0.28))';
  const top = W > H ? H * 0.55 : H * 0.6;
  return (
    <AbsoluteFill style={{background: pal[0]}}>
      <Svg style={{filter: sh}}>
        <circle cx={W * (r('sx') < 0.5 ? 0.2 : 0.8)} cy={H * 0.28} r={70} fill="#F6E3A1" />
        <circle cx={f.x} cy={f.y} r={f.r * 0.85} fill="#F1E4CF" />
      </Svg>
      {[1, 2, 3, 4].map((i) => (
        <Svg key={i} style={{filter: sh}}>
          <path d={`M 0 ${top + i * (H * 0.09)} C ${W * 0.25} ${top + i * (H * 0.09) - 80 + r(`w${i}`) * 60}, ${W * 0.5} ${top + i * (H * 0.09) + 70}, ${W} ${top + i * (H * 0.09) - 40} L ${W} ${H} L 0 ${H} Z`} fill={pal[i]} />
        </Svg>
      ))}
    </AbsoluteFill>
  );
};

/* 8. Модерн: арка, ореол с лучами, лозы «удар хлыста» */
const Nouveau: React.FC<BP> = ({seed}) => {
  const {W, H} = getSize();
  const r = rnd(seed);
  const f = focus();
  const ink = '#3B2F2A';
  const gold = '#B8934A';
  const fill = pick(r('p'), ['#9DAF95', '#C9A0A0', '#8AA6B5', '#B5A88A']);
  const aw = Math.min(W * 0.78, 840);
  const ax = f.x - aw / 2;
  const top = f.y - f.r * 0.95;
  const bottom = W > H ? H - 30 : H - 220;
  return (
    <AbsoluteFill style={{background: '#EADFC8'}}>
      <Svg>
        <path d={`M ${ax} ${bottom} L ${ax} ${top + aw / 2} A ${aw / 2} ${aw / 2} 0 0 1 ${ax + aw} ${top + aw / 2} L ${ax + aw} ${bottom} Z`} fill={fill} stroke={ink} strokeWidth={10} />
        <circle cx={f.x} cy={f.y} r={f.r * 0.8} fill="#E8CF8F" stroke={ink} strokeWidth={8} />
        {Array.from({length: 36}, (_, i) => {
          const a = (i / 36) * Math.PI * 2;
          return <line key={i} x1={f.x + Math.cos(a) * f.r * 0.62} y1={f.y + Math.sin(a) * f.r * 0.62} x2={f.x + Math.cos(a) * f.r * 0.79} y2={f.y + Math.sin(a) * f.r * 0.79} stroke={gold} strokeWidth={6} />;
        })}
        <circle cx={f.x} cy={f.y} r={f.r * 0.62} fill="#F3E6C4" stroke={ink} strokeWidth={6} />
        {[1, -1].map((d) => (
          <g key={d} transform={`translate(${f.x} 0) scale(${d} 1)`}>
            <path d={`M ${-aw / 2 + 20} ${bottom - 40} C ${-aw / 2 + 190} ${bottom - 130}, ${-aw / 2 + 20} ${bottom - 300}, ${-aw / 2 + 190} ${bottom - 390}`} stroke={ink} strokeWidth={9} fill="none" strokeLinecap="round" />
            <path d={`M ${-aw / 2 + 190} ${bottom - 390} c 30 -50 90 -40 80 10 c -10 40 -60 30 -80 -10 z`} fill="#C88C6E" stroke={ink} strokeWidth={5} />
          </g>
        ))}
      </Svg>
    </AbsoluteFill>
  );
};

/* 9. Золотой час: закатное небо, низкое солнце, лучи, холмы */
const Golden: React.FC<BP> = ({seed}) => {
  const {W, H} = getSize();
  const r = rnd(seed);
  const sky = pick(r('p'), [
    ['#3B2A5C', '#A44A6B', '#F08A4B', '#FFD08A'],
    ['#2A2F5C', '#6A4A8C', '#E07A6B', '#FFC08A'],
    ['#4A2A3C', '#C0504A', '#F5A04A', '#FFE0A0'],
  ]);
  const horizon = W > H ? H * 0.78 : H * 0.76;
  const sx = W * (0.3 + r('sx') * 0.4);
  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${sky[0]} 0%, ${sky[1]} 36%, ${sky[2]} 64%, ${sky[3]} ${(horizon / H) * 100}%)`}}>
      <Svg>
        <defs>
          <radialGradient id="bd-sun">
            <stop offset="0" stopColor="#FFF4C9" />
            <stop offset="0.25" stopColor="#FFD27A" stopOpacity={0.9} />
            <stop offset="1" stopColor="#FF9E57" stopOpacity={0} />
          </radialGradient>
        </defs>
        {Array.from({length: 12}, (_, i) => (
          <path key={i} d={`M ${sx} ${horizon} L ${-W * 0.3 + i * W * 0.15} 0 L ${-W * 0.25 + i * W * 0.15} 0 Z`} fill="#FFE7B0" opacity={0.07} />
        ))}
        <circle cx={sx} cy={horizon} r={W > H ? 420 : 520} fill="url(#bd-sun)" />
        <path d={`M 0 ${horizon} C ${W * 0.2} ${horizon - 50}, ${W * 0.35} ${horizon + 20}, ${W * 0.52} ${horizon - 10} C ${W * 0.7} ${horizon - 40}, ${W * 0.84} ${horizon + 10}, ${W} ${horizon - 30} L ${W} ${H} L 0 ${H} Z`} fill="#4A3030" />
        <path d={`M 0 ${horizon + 120} C ${W * 0.3} ${horizon + 60}, ${W * 0.6} ${horizon + 160}, ${W} ${horizon + 90} L ${W} ${H} L 0 ${H} Z`} fill="#2F2024" />
      </Svg>
    </AbsoluteFill>
  );
};

/* 10. Аниме-живопись: небо, кучевые облака, холмы, трава */
const Cloud: React.FC<{x: number; y: number; s: number; shade: string}> = ({x, y, s, shade}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {[[0, 0, 90], [80, -40, 110], [180, -10, 95], [260, 20, 70], [-80, 30, 60], [100, 40, 90]].map(([cx, cy, rr], i) => (
      <g key={i}>
        <circle cx={cx} cy={cy + 14} r={rr} fill={shade} />
        <circle cx={cx} cy={cy} r={rr} fill="#FFFFFF" />
      </g>
    ))}
  </g>
);
const Anime: React.FC<BP> = ({seed}) => {
  const {W, H} = getSize();
  const r = rnd(seed);
  const dusk = r('d') < 0.3;
  const hill = W > H ? H * 0.78 : H * 0.72;
  return (
    <AbsoluteFill style={{background: dusk ? 'linear-gradient(180deg, #5A6AC8 0%, #E89AB0 55%, #FFD8A8 75%)' : 'linear-gradient(180deg, #3E8EDE 0%, #7DB9F0 45%, #CFE6F7 75%)'}}>
      <Svg>
        {[0, 1, 2].map((i) => (
          <Cloud key={i} x={W * (0.05 + r(`cx${i}`) * 0.75)} y={H * (0.18 + i * 0.2 + r(`cy${i}`) * 0.08)} s={0.8 + r(`cs${i}`) * 0.7} shade={dusk ? '#E8B8D0' : '#B9CBE8'} />
        ))}
        <path d={`M 0 ${hill} C ${W * 0.25} ${hill - 90}, ${W * 0.5} ${hill - 50}, ${W * 0.72} ${hill - 100} C ${W * 0.85} ${hill - 130}, ${W * 0.95} ${hill - 110}, ${W} ${hill - 120} L ${W} ${H} L 0 ${H} Z`} fill={dusk ? '#6FA060' : '#7FBF5A'} />
        <path d={`M 0 ${hill + 120} C ${W * 0.3} ${hill + 60}, ${W * 0.6} ${hill + 140}, ${W} ${hill + 70} L ${W} ${H} L 0 ${H} Z`} fill={dusk ? '#4F8044' : '#5FA046'} />
        {Array.from({length: 60}, (_, i) => {
          const x = r(`gx${i}`) * W;
          const y = hill + 90 + r(`gy${i}`) * (H - hill - 90);
          return <path key={i} d={`M ${x} ${y} q 6 -30 14 -46`} stroke="#3F7F32" strokeWidth={5} fill="none" strokeLinecap="round" />;
        })}
      </Svg>
    </AbsoluteFill>
  );
};

/* 11. Рентген-голограмма: тёмный экран, сетка, силуэт тела, полоса сканирования */
const XRay: React.FC<BP> = ({seed}) => {
  const {W, H} = getSize();
  const r = rnd(seed);
  const c = '#5FF3FF';
  const f = focus();
  const scanY = H * (0.25 + r('s') * 0.5);
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at ${(f.x / W) * 100}% ${(f.y / H) * 100}%, #0E2A44 0%, #050B16 75%)`}}>
      <Svg>
        {Array.from({length: Math.ceil(W / 40)}, (_, i) => <line key={`v${i}`} x1={i * 40} x2={i * 40} y1={0} y2={H} stroke={c} strokeOpacity={0.06} />)}
        {Array.from({length: Math.ceil(H / 40)}, (_, i) => <line key={`h${i}`} y1={i * 40} y2={i * 40} x1={0} x2={W} stroke={c} strokeOpacity={0.06} />)}
        <g fill="none" stroke={c} strokeOpacity={0.22} strokeWidth={4} transform={`translate(${f.x - 540} ${f.y - 900})`}>
          <circle cx={540} cy={330} r={95} />
          <path d="M 470 420 L 470 460 C 330 480, 260 510, 250 600 L 220 1150 M 610 420 L 610 460 C 750 480, 820 510, 830 600 L 860 1150 M 330 600 L 340 1550 M 750 600 L 740 1550" />
        </g>
        <rect x={0} y={scanY} width={W} height={5} fill={c} opacity={0.3} />
        {[[0.08, 0.12], [0.92, 0.12]].map(([x, y], i) => (
          <path key={i} d={`M ${W * x + (i ? -60 : 60)} ${H * y} L ${W * x} ${H * y} L ${W * x} ${H * y + 60}`} stroke={c} strokeWidth={5} fill="none" opacity={0.6} />
        ))}
      </Svg>
      <div style={{position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(95,243,255,0.05) 0px, rgba(95,243,255,0.05) 2px, transparent 2px, transparent 6px)'}} />
    </AbsoluteFill>
  );
};

/* 12. Плоский космос: фиолетовый градиент, звёзды, планеты, орбита */
const Cosmic: React.FC<BP> = ({seed}) => {
  const {W, H} = getSize();
  const r = rnd(seed);
  const f = focus();
  const planets = ['#FF8FB1', '#FFD166', '#4CC9F0', '#5BE0A8', '#FF9F1C'];
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #1B1446 0%, #2C1E6B 55%, #43288F 100%)'}}>
      <Svg>
        <Stars seed={seed} n={70} color="#FFFFFF" />
        <circle cx={f.x} cy={f.y} r={f.r * 0.93} fill="#3B2C8A" />
        <circle cx={f.x} cy={f.y} r={f.r * 0.75} fill="#4D3AA8" />
        <ellipse cx={f.x} cy={f.y} rx={f.r * 1.15} ry={f.r * 0.3} fill="none" stroke="#7A68E0" strokeWidth={4} opacity={0.6} transform={`rotate(${-20 + r('o') * 40} ${f.x} ${f.y})`} />
        {[0, 1].map((i) => {
          const x = W * (i === 0 ? 0.08 + r('p0') * 0.15 : 0.77 + r('p1') * 0.15);
          const y = H * (i === 0 ? 0.84 + r('q0') * 0.06 : 0.76 + r('q1') * 0.06); // внизу, ниже субтитров — не мешают тексту
          const rr = 40 + r(`s${i}`) * 70;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={rr} fill={pick(r(`c${i}`), planets)} />
              <circle cx={x + rr * 0.25} cy={y + rr * 0.25} r={rr} fill="#000" opacity={0.15} clipPath="none" />
            </g>
          );
        })}
      </Svg>
    </AbsoluteFill>
  );
};

/* 13. Комикс: яркий фон, лучи с растровыми точками, рамка панели */
const Comic: React.FC<BP> = ({seed}) => {
  const {W, H} = getSize();
  const r = rnd(seed);
  const f = focus();
  const [bg, dot] = pick(r('p'), [
    ['#FFD23F', '#F28C28'],
    ['#7FDBFF', '#3A86FF'],
    ['#FF8FB8', '#E63946'],
    ['#B8F28C', '#2EC4B6'],
  ]);
  const R = Math.max(W, H) * 1.2;
  return (
    <AbsoluteFill style={{background: bg}}>
      <Svg>
        <defs>
          <pattern id={`bd-dots-${seed}`} width={22} height={22} patternUnits="userSpaceOnUse">
            <circle cx={11} cy={11} r={5} fill={dot} />
          </pattern>
        </defs>
        {Array.from({length: 24}, (_, i) => {
          const a = (i / 24) * Math.PI * 2 + r('a') * 0.3;
          const b = ((i + 0.5) / 24) * Math.PI * 2 + r('a') * 0.3;
          return i % 2 ? <path key={i} d={`M ${f.x} ${f.y} L ${f.x + Math.cos(a) * R} ${f.y + Math.sin(a) * R} L ${f.x + Math.cos(b) * R} ${f.y + Math.sin(b) * R} Z`} fill={`url(#bd-dots-${seed})`} /> : null;
        })}
        <rect x={14} y={14} width={W - 28} height={H - 28} fill="none" stroke="#111" strokeWidth={14} />
      </Svg>
    </AbsoluteFill>
  );
};

/* 14. Тетрадь: линейка, поля, дырки, каракули ручкой по краям */
const Notebook: React.FC<BP> = ({seed}) => {
  const {W, H} = getSize();
  const r = rnd(seed);
  const pen = '#1E3A8A';
  const doodles = [
    (x: number, y: number) => <path d={`M ${x} ${y} l 12 28 l 30 4 l -22 20 l 6 30 l -26 -16 l -26 16 l 6 -30 l -22 -20 l 30 -4 z`} />,
    (x: number, y: number) => <path d={`M ${x} ${y} c 30 -30 60 30 90 0 c 30 -30 60 30 90 0`} />,
    (x: number, y: number) => <path d={`M ${x} ${y} l 80 40 m 0 0 l -30 4 m 30 -4 l -14 -26`} />,
    (x: number, y: number) => <circle cx={x + 40} cy={y + 40} r={40} />,
    (x: number, y: number) => <path d={`M ${x} ${y + 40} c 10 -40 50 -40 60 0 c 10 -40 50 -40 60 0 c -10 30 -40 50 -60 70 c -20 -20 -50 -40 -60 -70 z`} />,
  ];
  const spots = W > H ? [[0.08, 0.15], [1.08, 0.88], [0.62, 0.1]] : [[0.12, 0.2], [0.78, 0.62], [0.12, 0.78]];
  return (
    <AbsoluteFill style={{background: '#FBFAF4'}}>
      <Svg>
        {Array.from({length: Math.ceil(H / 52)}, (_, i) => <line key={i} x1={0} x2={W} y1={120 + i * 52} y2={120 + i * 52} stroke="#9CC3E8" strokeWidth={2} />)}
        <line x1={110} x2={110} y1={0} y2={H} stroke="#F08080" strokeWidth={3} />
        {[0.15, 0.5, 0.85].map((y) => <circle key={y} cx={50} cy={H * y} r={22} fill="#E8E4D8" />)}
        <g fill="none" stroke={pen} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={0.7}>
          {spots.map(([x, y], i) => (
            <g key={i}>{doodles[Math.floor(r(`d${i}`) * doodles.length)](Math.min(W - 200, W * x), H * y)}</g>
          ))}
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

/* 15. Ризограф: растровый круг синей краской, розовые фигуры, всё «наложением» */
const Riso: React.FC<BP> = ({seed}) => {
  const {W, H} = getSize();
  const r = rnd(seed);
  const f = focus();
  const pink = '#FF48B0';
  const blue = '#0078BF';
  return (
    <AbsoluteFill style={{background: '#F5F0E6'}}>
      <Svg>
        <defs>
          <pattern id={`bd-ht-${seed}`} width={12} height={12} patternUnits="userSpaceOnUse" patternTransform={`rotate(${15 + r('a') * 30})`}>
            <circle cx={6} cy={6} r={3.4} fill={blue} />
          </pattern>
        </defs>
        <g style={{mixBlendMode: 'multiply'}}>
          <circle cx={f.x} cy={f.y} r={f.r * 0.95} fill={`url(#bd-ht-${seed})`} opacity={0.7} />
          <circle cx={W * (r('x') < 0.5 ? 0.15 : 0.85)} cy={H * (0.62 + r('y') * 0.1)} r={80 + r('r') * 40} fill={pink} opacity={0.85} />
          <rect x={W * (r('x2') < 0.5 ? 0.06 : 0.7)} y={H * 0.16} width={W * 0.22} height={40} fill={pink} opacity={0.7} transform={`rotate(${-8 + r('rt') * 16} ${W * 0.2} ${H * 0.16})`} />
        </g>
      </Svg>
    </AbsoluteFill>
  );
};

/* 16. Глянцевый 3D: студийный фон, мягкая тень «на полу» */
const Glossy: React.FC<BP> = ({seed}) => {
  const {H} = getSize();
  const r = rnd(seed);
  const f = focus();
  const [a, b, c] = pick(r('p'), [
    ['#F4F7FB', '#C9D6E8', '#A9BBD4'],
    ['#FFF4EC', '#F5D6C4', '#E4B8A0'],
    ['#F0FBF6', '#C8E8DA', '#A0D0BC'],
    ['#F6F2FF', '#D8CCF2', '#B8A8E0'],
  ]);
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at ${50}% 40%, ${a} 0%, ${b} 70%, ${c} 100%)`}}>
      <Svg>
        <ellipse cx={f.x} cy={Math.min(H - 60, f.y + f.r * 0.95)} rx={f.r * 0.75} ry={f.r * 0.12} fill="#4A5A75" opacity={0.25} style={{filter: 'blur(14px)'}} />
      </Svg>
    </AbsoluteFill>
  );
};

const MAP: Record<StyleId, React.FC<BP>> = {
  watercolour: Watercolour, mosaic: Mosaic, sumie: SumiE, impasto: Impasto, gouache: Gouache, botanical: Botanical,
  papercut: PaperCut, nouveau: Nouveau, golden: Golden, anime: Anime, xray: XRay, cosmic: Cosmic,
  comic: Comic, notebook: Notebook, riso: Riso, glossy: Glossy,
};

export const Backdrop: React.FC<{style: StyleId; seed?: string | number}> = ({style, seed = 0}) => {
  const B = MAP[style] ?? Cosmic;
  return <B seed={`${style}${seed}`} />;
};
