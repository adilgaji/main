/**
 * Логотипы канала «All That Matters» (аватар YouTube 800x800, показывается кругом).
 * Всё рисуется кодом в стиле канала (палитра и шрифт из style.ts).
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COLORS, FONT_FAMILY, loadFonts} from '../style';
import {BodyOutline} from '../lib/BodyOutline';
import {Heart} from '../lib/Organs';
import {Cell} from '../lib/CellAndMolecules';

loadFonts();

const Ground: React.FC<{children: React.ReactNode; tint?: string}> = ({children, tint = '#24406A'}) => (
  <AbsoluteFill style={{background: `radial-gradient(circle at 50% 42%, ${tint} 0%, ${COLORS.bg} 72%)`, alignItems: 'center', justifyContent: 'center'}}>
    {children}
  </AbsoluteFill>
);

/** Голова гида крупно (маскот канала). */
const GuideFace: React.FC<{size: number}> = ({size}) => (
  <svg viewBox="-120 -150 240 260" width={size} height={(size * 260) / 240}>
    <circle cx={0} cy={0} r={100} fill={COLORS.bgSoft} stroke={COLORS.ink} strokeWidth={16} />
    <path d="M -14 -100 Q 10 -150 46 -126" fill="none" stroke={COLORS.accent} strokeWidth={20} strokeLinecap="round" />
    <path d="M -46 -12 Q -32 -32 -18 -12" fill="none" stroke={COLORS.ink} strokeWidth={12} strokeLinecap="round" />
    <path d="M 18 -12 Q 32 -32 46 -12" fill="none" stroke={COLORS.ink} strokeWidth={12} strokeLinecap="round" />
    <path d="M -40 28 Q 0 68 40 28" fill="none" stroke={COLORS.ink} strokeWidth={12} strokeLinecap="round" />
  </svg>
);

/* 1. Маскот: голова гида с фирменным жёлтым завитком. */
export const LogoGuide: React.FC = () => (
  <Ground>
    <div style={{marginTop: 60}}>
      <GuideFace size={470} />
    </div>
  </Ground>
);

/* 2. Фирменный зум: силуэт тела + лупа, в которой видна клетка. */
export const LogoZoom: React.FC = () => (
  <Ground>
    <div style={{position: 'absolute', left: 170, top: 90, filter: 'brightness(1.9)'}}>
      <BodyOutline width={250} highlight={['heart']} pulse={false} showAll={false} />
    </div>
    <svg style={{position: 'absolute', left: 0, top: 0}} width={800} height={800}>
      <line x1={330} y1={330} x2={420} y2={390} stroke={COLORS.accent} strokeWidth={10} strokeDasharray="4 18" strokeLinecap="round" />
      <line x1={610} y1={610} x2={700} y2={700} stroke={COLORS.accent} strokeWidth={46} strokeLinecap="round" />
      <circle cx={520} cy={500} r={190} fill={COLORS.bg} stroke={COLORS.accent} strokeWidth={30} />
    </svg>
    <div style={{position: 'absolute', left: 520 - 150, top: 500 - 150, width: 300, height: 300, borderRadius: '50%', overflow: 'hidden'}}>
      <Cell size={300} receptors="membrane" />
    </div>
  </Ground>
);

/* 3. Сердце в жёлтом кольце (то, что важнее всего). */
export const LogoHeart: React.FC = () => (
  <Ground tint="#3A1F33">
    <svg style={{position: 'absolute', left: 0, top: 0}} width={800} height={800}>
      <circle cx={400} cy={400} r={300} fill="none" stroke={COLORS.accent} strokeWidth={34} />
    </svg>
    <div style={{marginTop: 30}}>
      <Heart size={400} beating={false} />
    </div>
  </Ground>
);

/* 4. Надпись: ALL THAT + MATTERS на жёлтой плашке (как ключевые слова в роликах). */
export const LogoWord: React.FC = () => (
  <Ground>
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, fontFamily: FONT_FAMILY, fontWeight: 900, textTransform: 'uppercase', lineHeight: 1}}>
      <div style={{fontSize: 96, color: COLORS.ink, letterSpacing: 2}}>ALL THAT</div>
      <div style={{fontSize: 104, color: COLORS.accentInk, background: COLORS.accent, borderRadius: 26, padding: '14px 30px 6px'}}>MATTERS</div>
    </div>
  </Ground>
);

/* 5. Гид + клетка-«атом»: маскот смотрит на вращающуюся молекулу материи. */
export const LogoGuideCell: React.FC = () => (
  <Ground>
    <div style={{position: 'absolute', left: 90, top: 230}}>
      <GuideFace size={360} />
    </div>
    <div style={{position: 'absolute', left: 430, top: 150, width: 300, height: 300}}>
      <Cell size={300} receptors="none" />
    </div>
  </Ground>
);

/** Лист сравнения: крупно + как кружок на YouTube (98 px) и в комментариях (40 px). */
const LOGOS: [string, React.FC][] = [
  ['1 · Guide', LogoGuide],
  ['2 · Zoom', LogoZoom],
  ['3 · Heart', LogoHeart],
  ['4 · Wordmark', LogoWord],
  ['5 · Guide + cell', LogoGuideCell],
];

const Circle: React.FC<{C: React.FC; d: number}> = ({C, d}) => (
  <div style={{width: d, height: d, borderRadius: '50%', overflow: 'hidden', flexShrink: 0}}>
    <div style={{width: 800, height: 800, transform: `scale(${d / 800})`, transformOrigin: '0 0', position: 'relative'}}>
      <C />
    </div>
  </div>
);

export const LogoSheet: React.FC = () => (
  <AbsoluteFill style={{background: '#F3F5F9', padding: 40, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 30, fontFamily: FONT_FAMILY}}>
    {LOGOS.map(([name, C]) => (
      <div key={name} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: 340}}>
        <div style={{fontWeight: 900, fontSize: 30, color: '#142033'}}>{name}</div>
        <Circle C={C} d={300} />
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <Circle C={C} d={98} />
          <Circle C={C} d={40} />
          <div style={{width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <Circle C={C} d={34} />
          </div>
        </div>
      </div>
    ))}
  </AbsoluteFill>
);
