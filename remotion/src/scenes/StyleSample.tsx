/**
 * Пример кадра для выбора стиля: «ремонтная бригада» в мышечном волокне.
 * Новый принцип кадра: весь экран заполнен — крупный объект, «среда» вокруг
 * (ткань, капилляр, частицы), гид крупно и показывает на происходящее.
 */
import React from 'react';
import {AbsoluteFill, random} from 'remotion';
import {COLORS, FONT_FAMILY, loadFonts} from '../style';
import {MuscleFiber} from '../lib/MuscleFiber';
import {Stickman} from '../lib/Stickman';
import {Headline} from '../lib/Kit';
import {KaraokeCaptions, Word} from '../lib/Captions';
import {StyleLayer} from '../styles/StyleLayer';
import {STYLE_IDS, StyleId, THEMES, applyTheme} from '../styles/themes';

loadFonts();

/* Главное волокно: viewBox 800x400 → ширина 1180 */
const F = {left: -50, top: 430, w: 1180};
const k = F.w / 800;
const at = (x: number, y: number) => ({x: F.left + x * k, y: F.top + y * k});

/* «Среда»: соседние волокна, капилляр с эритроцитами, частицы. */
const Tissue: React.FC = () => (
  <AbsoluteFill>
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 45%, ${COLORS.bgGlow} 0%, ${COLORS.bg} 75%)`}} />
    {[
      {y: -40, s: 0.9, o: 0.4},
      {y: 120, s: 1.0, o: 0.5},
      {y: 1060, s: 1.05, o: 0.5},
      {y: 1300, s: 0.95, o: 0.42},
      {y: 1530, s: 1.0, o: 0.36},
    ].map((f, i) => (
      <div key={i} style={{position: 'absolute', left: -120 + (i % 2) * 60, top: f.y, opacity: f.o, filter: 'blur(2px)'}}>
        <MuscleFiber width={1320 * f.s} />
      </div>
    ))}
    <svg style={{position: 'absolute', inset: 0}} width={1080} height={1920}>
      {/* капилляр */}
      <path d="M -40 1180 C 260 1080, 520 1240, 760 1120 S 1080 1010, 1140 1060" stroke={COLORS.blood} strokeOpacity={0.35} strokeWidth={70} fill="none" strokeLinecap="round" />
      <path d="M -40 1180 C 260 1080, 520 1240, 760 1120 S 1080 1010, 1140 1060" stroke={COLORS.bloodDark} strokeOpacity={0.35} strokeWidth={8} fill="none" strokeDasharray="2 30" />
      {Array.from({length: 9}, (_, i) => {
        const t = i / 8;
        const x = -20 + t * 1120;
        const y = 1180 - Math.sin(t * Math.PI * 1.6) * 70 - t * 60;
        return <ellipse key={i} cx={x} cy={y} rx={22} ry={14} fill={COLORS.blood} opacity={0.75} transform={`rotate(${(random(`rb${i}`) - 0.5) * 60} ${x} ${y})`} />;
      })}
      {/* частицы */}
      {Array.from({length: 40}, (_, i) => (
        <circle key={i} cx={random(`px${i}`) * 1080} cy={random(`py${i}`) * 1920} r={3 + random(`pr${i}`) * 7} fill={i % 3 ? COLORS.hormoneAlt : COLORS.cell} opacity={0.35} />
      ))}
    </svg>
  </AbsoluteFill>
);

/* Схема: крупное волокно + бригада. */
const Diagram: React.FC = () => (
  <AbsoluteFill>
    <div style={{position: 'absolute', left: F.left, top: F.top}}>
      <MuscleFiber width={F.w} damage={1} macrophages={1} clearing={0.25} satellites={0.9} />
    </div>
  </AbsoluteFill>
);

/* Подписи со стрелками — в слое надписей (всегда чёткие в любом стиле). */
const Callouts: React.FC = () => {
  const mac = at(600, 310); // нижняя правая иммунная клетка
  const sat = at(640, 102); // верхняя правая клетка-ремонтник
  return (
    <AbsoluteFill>
      <svg style={{position: 'absolute', inset: 0}} width={1080} height={1920}>
        <g stroke={COLORS.ink} strokeWidth={5} fill="none" strokeLinecap="round">
          <path d={`M ${mac.x - 10} ${mac.y + 40} L ${mac.x - 40} ${mac.y + 150}`} />
          <path d={`M ${sat.x - 10} ${sat.y - 30} L ${sat.x - 40} ${sat.y - 100}`} />
        </g>
        <circle cx={mac.x - 10} cy={mac.y + 40} r={9} fill={COLORS.ink} />
        <circle cx={sat.x - 10} cy={sat.y - 30} r={9} fill={COLORS.ink} />
      </svg>
      <Label text="CLEANUP CELL" x={mac.x - 40} y={mac.y + 150} color={COLORS.hormone} />
      <Label text="REPAIR CELL" x={sat.x - 40} y={sat.y - 100} color={COLORS.proven} />
    </AbsoluteFill>
  );
};

const Label: React.FC<{text: string; x: number; y: number; color: string}> = ({text, x, y, color}) => (
  <div
    className="lbl"
    style={{
      position: 'absolute',
      left: x,
      top: y,
      translate: '-75% -50%',
      padding: '10px 22px',
      borderRadius: 999,
      background: COLORS.bgSoft,
      border: `5px solid ${color}`,
      fontFamily: FONT_FAMILY,
      fontWeight: 800,
      fontSize: 38,
      color: COLORS.ink,
      whiteSpace: 'nowrap',
    }}
  >
    {text}
  </div>
);

const WORDS: Word[] = [
  {text: 'They', startMs: 300, endMs: 600, timestampMs: null, confidence: null},
  {text: ' eat', startMs: 600, endMs: 1000, timestampMs: null, confidence: null, keyword: true},
  {text: ' debris', startMs: 1050, endMs: 1900, timestampMs: null, confidence: null},
];

export const StyleSample: React.FC<{style: StyleId}> = ({style}) => {
  applyTheme(style); // палитра до построения кадра
  return (
    <StyleLayer
      style={style}
      bg={<Tissue />}
      fg={<Diagram />}
      actor={
        <div style={{position: 'absolute', left: 20, top: 690}}>
          <Stickman pose="point" emotion="excited" size={470} alive={false} />
        </div>
      }
      ui={
        <>
          <Callouts />
          <Headline text="The *repair crew*" />
          <KaraokeCaptions words={WORDS} top={1150} />
        </>
      }
    />
  );
};

/* Лист из 9 образцов: текущий стиль + 8 новых. */
export const StyleSampleSheet: React.FC = () => (
  <AbsoluteFill style={{background: '#101010', padding: 30, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26}}>
    {STYLE_IDS.map((id, i) => (
      <div key={id} style={{display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center'}}>
        <div style={{width: 324, height: 576, overflow: 'hidden', borderRadius: 14}}>
          <div style={{width: 1080, height: 1920, transform: 'scale(0.3)', transformOrigin: '0 0', position: 'relative'}}>
            <StyleSample style={id} />
          </div>
        </div>
        <div style={{fontFamily: 'system-ui', fontWeight: 800, fontSize: 26, color: '#fff'}}>{i === 0 ? 'Classic (сейчас)' : `${i}. ${THEMES[id].name}`}</div>
        <div style={{fontFamily: 'system-ui', fontSize: 17, color: '#aaa', textAlign: 'center', width: 330}}>{THEMES[id].ru}</div>
      </div>
    ))}
  </AbsoluteFill>
);
