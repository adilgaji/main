/**
 * Логотип-надпись «All That Matters» — 6 направлений в собственном стиле канала
 * (не повторяют стиль роликов). Аватар YouTube 800x800, показывается кругом.
 * Шрифты — OFL (см. sources.txt).
 */
import React from 'react';
import {AbsoluteFill, staticFile} from 'remotion';
import {loadFont} from '@remotion/fonts';

const FONTS = [
  ['Anton', 'anton-latin-400-normal', '400', 'normal'],
  ['DM Serif Display', 'dm-serif-display-latin-400-normal', '400', 'normal'],
  ['DM Serif Display', 'dm-serif-display-latin-400-italic', '400', 'italic'],
  ['Archivo Black', 'archivo-black-latin-400-normal', '400', 'normal'],
  ['Space Mono', 'space-mono-latin-700-normal', '700', 'normal'],
  ['Permanent Marker', 'permanent-marker-latin-400-normal', '400', 'normal'],
] as const;
for (const [family, file, weight, style] of FONTS) {
  loadFont({family, url: staticFile(`fonts/${file}.woff2`), weight, style});
}

const Fill: React.FC<{bg: string; children: React.ReactNode}> = ({bg, children}) => (
  <AbsoluteFill style={{background: bg, alignItems: 'center', justifyContent: 'center'}}>{children}</AbsoluteFill>
);

/* A. Коралловый плакат: высокий узкий шрифт, слова стопкой. Смело, заметно в ленте. */
export const WmCoral: React.FC = () => (
  <Fill bg="#FF5A4E">
    <div style={{fontFamily: 'Anton', color: '#FFF6EE', textTransform: 'uppercase', lineHeight: 1.0, textAlign: 'center', letterSpacing: 2}}>
      <div style={{fontSize: 140}}>ALL THAT</div>
      <div style={{fontSize: 196, marginTop: -6}}>MATTERS</div>
    </div>
  </Fill>
);

/* B. Журнальная классика: чёрный фон, кремовая антиква, точка в конце — живая клетка. */
export const WmSerif: React.FC = () => (
  <Fill bg="#111111">
    <div style={{fontFamily: 'DM Serif Display', color: '#F4EDE2', lineHeight: 0.95, textAlign: 'left', marginLeft: -10}}>
      <div style={{fontSize: 140}}>All that</div>
      <div style={{fontSize: 160, fontStyle: 'italic', display: 'flex', alignItems: 'baseline'}}>
        matters
        <svg width={56} height={56} viewBox="0 0 56 56" style={{marginLeft: 6}}>
          <circle cx={28} cy={28} r={26} fill="#FF5A4E" />
          <circle cx={32} cy={24} r={10} fill="#8E1F1A" />
        </svg>
      </div>
    </div>
  </Fill>
);

/* C. Пульс: светлый фон, тяжёлый гротеск, через надпись проходит линия ЭКГ. */
export const WmPulse: React.FC = () => (
  <Fill bg="#F2EFE8">
    <div style={{position: 'relative', fontFamily: 'Archivo Black', color: '#141414', textTransform: 'uppercase', textAlign: 'center', lineHeight: 0.95}}>
      <div style={{fontSize: 112}}>ALL THAT</div>
      <div style={{fontSize: 124, marginTop: 70}}>MATTERS</div>
      <svg style={{position: 'absolute', left: -60, top: 96}} width={760} height={90} viewBox="0 0 760 90">
        <path d="M 0 45 L 250 45 L 285 45 L 310 8 L 340 84 L 370 20 L 392 45 L 760 45" fill="none" stroke="#E5322D" strokeWidth={12} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  </Fill>
);

/* C2. Pulse на тёмно-синем: белый текст, ярко-красная линия пульса (пара к фону-чертежу). */
const PulseOn: React.FC<{bg: string}> = ({bg}) => (
  <Fill bg={bg}>
    <div style={{position: 'relative', fontFamily: 'Archivo Black', color: '#FFFFFF', textTransform: 'uppercase', textAlign: 'center', lineHeight: 0.95}}>
      <div style={{fontSize: 112}}>ALL THAT</div>
      <div style={{fontSize: 124, marginTop: 70}}>MATTERS</div>
      <svg style={{position: 'absolute', left: -60, top: 96}} width={760} height={90} viewBox="0 0 760 90">
        <path d="M 0 45 L 250 45 L 285 45 L 310 8 L 340 84 L 370 20 L 392 45 L 760 45" fill="none" stroke="#FF2B2B" strokeWidth={12} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  </Fill>
);
export const WmPulseNavy: React.FC = () => <PulseOn bg="#0B1C45" />;
export const WmPulseNavy2: React.FC = () => <PulseOn bg="#12307A" />;

/* D. Лабораторная этикетка: «образец под микроскопом», моноширинный шрифт. */
export const WmLab: React.FC = () => (
  <Fill bg="#E9F0EC">
    <div style={{border: '10px solid #102A22', borderRadius: 18, padding: '34px 40px 26px', fontFamily: 'Space Mono', color: '#102A22', textTransform: 'uppercase', width: 600}}>
      <div style={{fontSize: 30, display: 'flex', justifyContent: 'space-between', borderBottom: '6px solid #102A22', paddingBottom: 12}}>
        <span>SPECIMEN</span>
        <span>№ 001</span>
      </div>
      <div style={{fontSize: 92, lineHeight: 1.0, marginTop: 22}}>ALL THAT</div>
      <div style={{fontSize: 104, lineHeight: 1.0, background: '#102A22', color: '#7CF0B4', padding: '4px 12px', marginTop: 8, display: 'inline-block'}}>MATTERS</div>
    </div>
  </Fill>
);

/* E. Молекула: насыщенный синий, белый гротеск, над надписью — молекула из трёх атомов («matter» = вещество). */
export const WmMolecule: React.FC = () => (
  <Fill bg="#2647F0">
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, fontFamily: 'Archivo Black', color: '#FFFFFF', textTransform: 'uppercase', lineHeight: 0.95}}>
      <svg width={240} height={130} viewBox="0 0 240 130">
        <g stroke="#FFFFFF" strokeWidth={12} strokeLinecap="round">
          <line x1={50} y1={90} x2={120} y2={40} />
          <line x1={120} y1={40} x2={190} y2={90} />
        </g>
        <circle cx={50} cy={90} r={30} fill="#FFD23F" />
        <circle cx={120} cy={40} r={36} fill="#FFFFFF" />
        <circle cx={190} cy={90} r={30} fill="#FF7AA8" />
      </svg>
      <div style={{fontSize: 96}}>ALL THAT</div>
      <div style={{fontSize: 108}}>MATTERS</div>
    </div>
  </Fill>
);

/* F. Рукописный: белый фон, маркер, слово matters выделено текстовыделителем — по-человечески, дружелюбно. */
export const WmMarker: React.FC = () => (
  <Fill bg="#FFFFFF">
    <div style={{fontFamily: 'Permanent Marker', color: '#151515', textAlign: 'center', lineHeight: 1.05, rotate: '-6deg'}}>
      <div style={{fontSize: 128}}>all that</div>
      <div style={{fontSize: 150, position: 'relative', display: 'inline-block'}}>
        <div style={{position: 'absolute', left: -20, right: -20, top: 70, height: 80, background: '#FFE14D', borderRadius: 14, rotate: '2deg', zIndex: 0}} />
        <span style={{position: 'relative'}}>matters</span>
      </div>
    </div>
  </Fill>
);

const ALL: [string, string, React.FC][] = [
  ['A · Coral poster', 'смелый, яркий в ленте', WmCoral],
  ['B · Editorial serif', 'дорого, спокойно', WmSerif],
  ['C · Pulse', 'тело + жизнь', WmPulse],
  ['D · Lab label', 'наука, «образец»', WmLab],
  ['E · Molecule', '«matter» = вещество', WmMolecule],
  ['F · Marker', 'по-человечески', WmMarker],
];

const Circle: React.FC<{C: React.FC; d: number}> = ({C, d}) => (
  <div style={{width: d, height: d, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, boxShadow: '0 0 0 1px #00000018'}}>
    <div style={{width: 800, height: 800, transform: `scale(${d / 800})`, transformOrigin: '0 0', position: 'relative'}}>
      <C />
    </div>
  </div>
);

export const WordmarkSheet: React.FC = () => (
  <AbsoluteFill style={{background: '#E8EAEE', padding: 36, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 30, fontFamily: 'Archivo Black'}}>
    {ALL.map(([name, note, C]) => (
      <div key={name} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
        <div style={{fontSize: 30, color: '#141414'}}>{name}</div>
        <div style={{fontFamily: 'system-ui, sans-serif', fontSize: 20, color: '#555'}}>{note}</div>
        <Circle C={C} d={320} />
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <Circle C={C} d={98} />
          <Circle C={C} d={40} />
          <div style={{background: '#0F0F0F', borderRadius: 10, padding: 8, display: 'flex', gap: 8, alignItems: 'center'}}>
            <Circle C={C} d={36} />
            <span style={{fontFamily: 'Space Mono', fontSize: 16, color: '#ddd'}}>dark mode</span>
          </div>
        </div>
      </div>
    ))}
  </AbsoluteFill>
);
