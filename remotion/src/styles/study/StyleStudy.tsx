/**
 * Пробные кадры новых стилей (1080×1920): один сюжет — «Your heart slows down while you sleep» —
 * в 16 стилях, чтобы сравнивать только стиль. Композиция строго по центру:
 * заголовок сверху, крупный главный объект в центре, подпись ниже, всё внутри безопасной зоны.
 */
import React from 'react';
import {AbsoluteFill, Still, random, staticFile} from 'remotion';
import {loadFont} from '@remotion/fonts';
import '../../brand/Wordmarks';
import {loadFonts} from '../../style';

loadFonts();
for (const [family, file] of [
  ['Caveat', 'caveat-latin-700-normal'],
  ['Cinzel', 'cinzel-latin-900-normal'],
  ['Fredoka', 'fredoka-latin-700-normal'],
] as const) {
  loadFont({family, url: staticFile(`fonts/${file}.woff2`), weight: '700'});
}

const W = 1080;
const H = 1920;
const CX = 540;
const NOISE = staticFile('textures/noise.png');
const GRAIN = staticFile('textures/grain.png');

/* ---------------- общий сюжет ---------------- */
const HEAD = 'Your heart *slows down* while you sleep';
const CAPTION = ['WHILE', 'YOU', 'SLEEP'];

/** Заголовок: *слово* выделяется стилем hl. */
const Headline: React.FC<{base: React.CSSProperties; hl: React.CSSProperties; top?: number; text?: string}> = ({base, hl, top = 300, text = HEAD}) => (
  <div style={{position: 'absolute', left: 90, right: 90, top, textAlign: 'center', lineHeight: 1.12, ...base}}>
    {text.split(/(\*[^*]+\*)/).map((p, i) =>
      p.startsWith('*') ? (
        <span key={i} style={hl}>{p.slice(1, -1)}</span>
      ) : (
        <span key={i}>{p}</span>
      ),
    )}
  </div>
);
/** Подпись-субтитр: среднее слово «звучит сейчас». */
const Caption: React.FC<{base: React.CSSProperties; on: React.CSSProperties; top?: number}> = ({base, on, top = 1380}) => (
  <div style={{position: 'absolute', left: 0, right: 0, top, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 22, ...base}}>
    {CAPTION.map((w, i) => (
      <span key={w} style={i === 1 ? on : undefined}>{w}</span>
    ))}
  </div>
);

/* Сердце (упрощённая анатомия: желудочки, аорта, лёгочный ствол, полая вена). viewBox −160…160 × −170…170 */
const P = {
  vena: 'M -58 -150 L -58 -30',
  aorta: 'M -8 -40 C -8 -135, 72 -140, 78 -78 L 80 -50',
  aortaBranches: 'M 14 -112 L 10 -158 M 38 -126 L 40 -165 M 60 -118 L 72 -152',
  pulm: 'M 22 -36 C 30 -92, 98 -96, 116 -62',
  body: 'M -72 -48 C -124 -6, -112 84, -22 150 C 8 166, 32 150, 62 110 C 112 48, 116 -22, 70 -56 C 40 -76, 2 -66, -14 -50 C -34 -66, -56 -62, -72 -48 Z',
  groove: 'M 6 -46 C 0 20, 20 80, 40 128',
  atrium: 'M -72 -48 C -96 -40, -104 -10, -88 8',
};
type HeartProps = {
  size?: number; body: string; red: string; blue: string; line?: string; sw?: number; groove?: string;
  filter?: string; vesselW?: number; bodyOpacity?: number; extra?: React.ReactNode; style?: React.CSSProperties;
};
const Heart: React.FC<HeartProps> = ({size = 660, body, red, blue, line = 'none', sw = 0, groove, filter, vesselW = 1, bodyOpacity = 1, extra, style}) => (
  <svg viewBox="-160 -175 320 345" width={size} height={(size * 345) / 320} style={{overflow: 'visible', ...style}}>
    <g filter={filter}>
      <path d={P.vena} stroke={blue} strokeWidth={34 * vesselW} strokeLinecap="round" fill="none" />
      <path d={P.aortaBranches} stroke={red} strokeWidth={14 * vesselW} strokeLinecap="round" fill="none" />
      <path d={P.aorta} stroke={red} strokeWidth={38 * vesselW} strokeLinecap="round" fill="none" />
      <path d={P.pulm} stroke={blue} strokeWidth={28 * vesselW} strokeLinecap="round" fill="none" />
      {sw > 0 && (
        <g fill="none" stroke={line} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d={P.vena} strokeWidth={sw} />
        </g>
      )}
      <path d={P.body} fill={body} opacity={bodyOpacity} stroke={line} strokeWidth={sw} strokeLinejoin="round" />
      {groove && <path d={P.groove} stroke={groove} strokeWidth={Math.max(4, sw)} fill="none" strokeLinecap="round" />}
      {groove && <path d={P.atrium} stroke={groove} strokeWidth={Math.max(3, sw * 0.8)} fill="none" strokeLinecap="round" />}
      {extra}
    </g>
  </svg>
);
const Center: React.FC<{y?: number; children: React.ReactNode}> = ({y = 930, children}) => (
  <div style={{position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', transform: 'translateY(-50%)'}}>{children}</div>
);
const Tex: React.FC<{src?: string; op?: number; blend?: React.CSSProperties['mixBlendMode']; size?: number}> = ({src = GRAIN, op = 0.25, blend = 'multiply', size = 512}) => (
  <AbsoluteFill style={{backgroundImage: `url(${src})`, backgroundSize: size, opacity: op, mixBlendMode: blend}} />
);
const Stars: React.FC<{n?: number; color?: string; seed?: string; maxY?: number}> = ({n = 60, color = '#FFF7D6', seed = 's', maxY = 1700}) => (
  <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
    {Array.from({length: n}, (_, i) => (
      <circle key={i} cx={random(`${seed}x${i}`) * W} cy={random(`${seed}y${i}`) * maxY} r={1.5 + random(`${seed}r${i}`) * 3.5} fill={color} opacity={0.4 + random(`${seed}o${i}`) * 0.6} />
    ))}
  </svg>
);

/* ======================= 1. WATERCOLOUR ======================= */
const Watercolour: React.FC = () => (
  <AbsoluteFill style={{background: '#F7F1E5'}}>
    <svg width={0} height={0}>
      <filter id="wc" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={4} seed={3} />
        <feDisplacementMap in="SourceGraphic" scale={26} xChannelSelector="R" yChannelSelector="G" result="d" />
        <feGaussianBlur in="d" stdDeviation={1.6} result="b" />
        <feMorphology in="b" operator="erode" radius={3} result="e" />
        <feComposite in="b" in2="e" operator="out" result="edge" />
        <feColorMatrix in="edge" type="matrix" values="0.7 0 0 0 0  0 0.7 0 0 0  0 0 0.7 0 0  0 0 0 0.9 0" result="edgeDark" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="edgeDark" /></feMerge>
      </filter>
    </svg>
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      <g filter="url(#wc)" opacity={0.55}>
        <circle cx={540} cy={930} r={430} fill="#8FA7D6" />
        <circle cx={330} cy={1150} r={240} fill="#B9A6D9" />
        <circle cx={790} cy={700} r={200} fill="#9CC9C2" />
      </g>
      <g filter="url(#wc)">
        <circle cx={820} cy={560} r={70} fill="#F3D27A" />
      </g>
    </svg>
    <Center>
      <Heart body="#D9574F" red="#C8443F" blue="#5D7FB8" groove="#9E3530" filter="url(#wc)" bodyOpacity={0.88} />
    </Center>
    <Tex src={NOISE} op={0.35} />
    <Headline base={{fontFamily: 'DM Serif Display', fontSize: 92, color: '#2E2A33'}} hl={{background: 'rgba(243,190,90,0.55)', borderRadius: 30, padding: '0 14px', fontStyle: 'italic'}} />
    <Caption base={{fontFamily: 'DM Serif Display', fontSize: 78, color: '#2E2A33', fontStyle: 'italic'}} on={{color: '#B4423C'}} />
  </AbsoluteFill>
);

/* ======================= 2. ROMAN MOSAIC ======================= */
const TILE = 26;
const Mosaic: React.FC = () => (
  <AbsoluteFill style={{background: '#E9DFC9'}}>
    <svg width={0} height={0}>
      <filter id="mos" x={0} y={0} width="100%" height="100%">
        <feFlood x={TILE / 2 - 1} y={TILE / 2 - 1} width={2} height={2} floodColor="#000" />
        <feComposite width={TILE} height={TILE} />
        <feTile result="grid" />
        <feComposite in="SourceGraphic" in2="grid" operator="in" />
        <feMorphology operator="dilate" radius={TILE / 2} />
      </filter>
    </svg>
    <AbsoluteFill style={{filter: 'url(#mos)'}}>
      <svg width={W} height={H}>
        <rect width={W} height={H} fill="#E9DFC9" />
        <circle cx={540} cy={930} r={420} fill="#2E4E7E" />
        <circle cx={540} cy={930} r={360} fill="#3D6699" />
        <circle cx={540} cy={930} r={420} fill="none" stroke="#B5803B" strokeWidth={30} />
        {Array.from({length: 16}, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return <circle key={i} cx={540 + Math.cos(a) * 470} cy={930 + Math.sin(a) * 470} r={18} fill={i % 2 ? '#A4452E' : '#B5803B'} />;
        })}
        <g transform="translate(540 930) scale(1.95)">
          <path d={P.vena} stroke="#2A3F66" strokeWidth={34} strokeLinecap="round" fill="none" />
          <path d={P.aorta} stroke="#A4452E" strokeWidth={38} strokeLinecap="round" fill="none" />
          <path d={P.pulm} stroke="#6E8FBF" strokeWidth={28} strokeLinecap="round" fill="none" />
          <path d={P.body} fill="#B8543A" />
          <path d={P.groove} stroke="#7A2E20" strokeWidth={10} fill="none" />
          <circle cx={-40} cy={20} r={22} fill="#D98A5F" />
        </g>
      </svg>
    </AbsoluteFill>
    {/* швы между камешками + неровность цвета */}
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      <defs>
        <pattern id="grout" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          <rect width={TILE} height={TILE} fill="none" stroke="#E9DFC9" strokeWidth={4} />
        </pattern>
      </defs>
      {Array.from({length: Math.ceil(W / TILE) * Math.ceil(H / TILE)}, (_, i) => {
        const r = random(`t${i}`);
        if (r > 0.35) return null;
        const cols = Math.ceil(W / TILE);
        return <rect key={i} x={(i % cols) * TILE} y={Math.floor(i / cols) * TILE} width={TILE} height={TILE} fill={r < 0.17 ? '#000' : '#fff'} opacity={0.08} />;
      })}
      <rect width={W} height={H} fill="url(#grout)" />
      {/* меандр по краям */}
      {[60, 1800].map((y) => (
        <g key={y}>
          {Array.from({length: 18}, (_, i) => (
            <path key={i} d={`M ${i * 60} ${y + 40} L ${i * 60} ${y} L ${i * 60 + 45} ${y} L ${i * 60 + 45} ${y + 30} L ${i * 60 + 20} ${y + 30} L ${i * 60 + 20} ${y + 15}`} stroke="#2E4E7E" strokeWidth={9} fill="none" />
          ))}
        </g>
      ))}
    </svg>
    <Tex op={0.3} />
    <div style={{position: 'absolute', left: 110, right: 110, top: 250, height: 280, background: '#F4ECDA', border: '10px solid #2E4E7E', boxShadow: '0 0 0 8px #B5803B'}} />
    <Headline top={290} base={{fontFamily: 'Cinzel', fontSize: 70, color: '#2E2A26', letterSpacing: 2}} hl={{color: '#A4452E'}} text="YOUR HEART *SLOWS DOWN* WHILE YOU SLEEP" />
    <div style={{position: 'absolute', left: 170, right: 170, top: 1360, height: 130, background: '#2E4E7E', border: '8px solid #B5803B'}} />
    <Caption top={1385} base={{fontFamily: 'Cinzel', fontSize: 64, color: '#F4ECDA'}} on={{color: '#E3A94F'}} />
  </AbsoluteFill>
);

/* ======================= 3. SUMI-E INK ======================= */
const SumiE: React.FC = () => (
  <AbsoluteFill style={{background: '#F2ECDD'}}>
    <svg width={0} height={0}>
      <filter id="ink" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={3} seed={9} />
        <feDisplacementMap in="SourceGraphic" scale={14} xChannelSelector="R" yChannelSelector="G" result="d" />
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={2} result="dry" />
        <feColorMatrix in="dry" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.7" result="dryA" />
        <feComposite in="d" in2="dryA" operator="in" />
      </filter>
      <filter id="wash"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={3} seed={4} /><feDisplacementMap in="SourceGraphic" scale={40} xChannelSelector="R" yChannelSelector="G" /><feGaussianBlur stdDeviation={6} /></filter>
    </svg>
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      {/* энсо-луна */}
      <path d="M 900 640 A 95 95 0 1 1 820 555" stroke="#1C1C1C" strokeWidth={26} fill="none" strokeLinecap="round" filter="url(#ink)" opacity={0.85} />
      {/* ветка */}
      <path d="M 60 1640 C 260 1560, 420 1600, 620 1480 M 300 1590 C 330 1520, 380 1500, 420 1490" stroke="#1C1C1C" strokeWidth={18} fill="none" strokeLinecap="round" filter="url(#ink)" />
      <g filter="url(#wash)" opacity={0.18}><ellipse cx={540} cy={960} rx={380} ry={330} fill="#1C1C1C" /></g>
    </svg>
    <Center>
      <Heart body="rgba(28,28,28,0.18)" red="#1C1C1C" blue="#4A4A4A" line="#1C1C1C" sw={9} groove="#1C1C1C" filter="url(#ink)" vesselW={0.75} />
    </Center>
    <svg style={{position: 'absolute', left: 0, top: 0}} width={W} height={H}>
      <g filter="url(#ink)"><circle cx={600} cy={1010} r={34} fill="#C2362B" opacity={0.9} /></g>
    </svg>
    <Tex src={NOISE} op={0.3} />
    <div style={{position: 'absolute', right: 110, top: 1540, width: 120, height: 120, background: '#C2362B', color: '#F2ECDD', fontFamily: 'Cinzel', fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: 1, borderRadius: 8, transform: 'rotate(-3deg)'}}>ALL<br />THAT</div>
    <Headline base={{fontFamily: 'DM Serif Display', fontSize: 90, color: '#1C1C1C'}} hl={{color: '#C2362B', fontStyle: 'italic'}} />
    <Caption base={{fontFamily: 'DM Serif Display', fontSize: 78, color: '#1C1C1C'}} on={{color: '#C2362B'}} />
  </AbsoluteFill>
);

/* ======================= 4. IMPASTO OIL ======================= */
const Impasto: React.FC = () => (
  <AbsoluteFill style={{background: '#1E2B55'}}>
    <svg width={0} height={0}>
      <filter id="oil" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.06" numOctaves={3} seed={5} />
        <feDisplacementMap in="SourceGraphic" scale={30} xChannelSelector="R" yChannelSelector="G" result="paint" />
        <feTurbulence type="fractalNoise" baseFrequency="0.05 0.22" numOctaves={4} seed={11} result="bump" />
        <feDiffuseLighting in="bump" surfaceScale={5} lightingColor="#fff" result="light"><feDistantLight azimuth={225} elevation={42} /></feDiffuseLighting>
        <feComposite in="light" in2="paint" operator="in" result="lightIn" />
        <feBlend in="paint" in2="lightIn" mode="multiply" result="m" />
        <feComponentTransfer in="m"><feFuncR type="linear" slope={1.35} /><feFuncG type="linear" slope={1.35} /><feFuncB type="linear" slope={1.35} /></feComponentTransfer>
      </filter>
    </svg>
    <AbsoluteFill style={{filter: 'url(#oil)'}}>
      <svg width={W} height={H}>
        <rect width={W} height={H} fill="#1E2B55" />
        {Array.from({length: 9}, (_, i) => (
          <path key={i} d={`M -50 ${180 + i * 200} C 300 ${120 + i * 200}, 700 ${260 + i * 200}, 1130 ${170 + i * 200}`} stroke={['#2D3F78', '#24356A', '#3A4E8A', '#1A2650'][i % 4]} strokeWidth={150} fill="none" />
        ))}
        <circle cx={820} cy={560} r={95} fill="#F2C94C" />
        <circle cx={820} cy={560} r={150} fill="none" stroke="#E8B04A" strokeWidth={26} opacity={0.6} />
        <circle cx={540} cy={940} r={380} fill="#3A4E8A" />
        <g transform="translate(540 930) scale(2)">
          <path d={P.vena} stroke="#3B5FA8" strokeWidth={34} strokeLinecap="round" fill="none" />
          <path d={P.aorta} stroke="#C0392B" strokeWidth={38} strokeLinecap="round" fill="none" />
          <path d={P.pulm} stroke="#5B82C9" strokeWidth={28} strokeLinecap="round" fill="none" />
          <path d={P.body} fill="#C93D32" />
          <path d="M -60 -20 C -80 30, -60 90, -20 130" stroke="#E86A4E" strokeWidth={24} fill="none" />
          <path d={P.groove} stroke="#7B1F18" strokeWidth={10} fill="none" />
        </g>
      </svg>
    </AbsoluteFill>
    <div style={{position: 'absolute', left: 80, right: 80, top: 250, padding: '30px 20px', background: 'rgba(15,20,40,0.55)', borderRadius: 24}} />
    <Headline top={280} base={{fontFamily: 'DM Serif Display', fontSize: 88, color: '#F6EBD3'}} hl={{color: '#F2C94C', fontStyle: 'italic'}} />
    <Caption base={{fontFamily: 'Montserrat', fontWeight: 900, fontSize: 74, color: '#F6EBD3', textShadow: '0 6px 0 #10162E'}} on={{color: '#F2C94C'}} />
  </AbsoluteFill>
);

/* ======================= 5. NOCTURNE GOUACHE ======================= */
const Gouache: React.FC = () => (
  <AbsoluteFill style={{background: '#14213D'}}>
    <svg width={0} height={0}>
      <filter id="gch"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={7} /><feDisplacementMap in="SourceGraphic" scale={6} xChannelSelector="R" yChannelSelector="G" /></filter>
    </svg>
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H} filter="url(#gch)">
      <rect width={W} height={H} fill="#14213D" />
      <rect y={1250} width={W} height={700} fill="#1B2D4F" />
      {/* окно с луной */}
      <rect x={820} y={560} width={170} height={230} rx={85} fill="#22385F" />
      <circle cx={905} cy={640} r={40} fill="#F4D58D" />
      <circle cx={922} cy={628} r={37} fill="#22385F" />
      <path d="M 820 680 L 990 680 M 905 560 L 905 790" stroke="#14213D" strokeWidth={10} />
      {/* кровать */}
      <rect x={110} y={1210} width={860} height={130} rx={40} fill="#E07A5F" />
      <rect x={150} y={1150} width={240} height={90} rx={45} fill="#F2E9DC" />
      <rect x={90} y={1080} width={50} height={300} rx={20} fill="#3D5A80" />
      <circle cx={540} cy={900} r={330} fill="#F4D58D" opacity={0.12} />
    </svg>
    <Stars n={40} color="#F4D58D" seed="g" maxY={1150} />
    <Center y={900}>
      <Heart size={500} body="#E07A5F" red="#D1495B" blue="#7FA7D9" groove="#9C3848" filter="url(#gch)" />
    </Center>
    <Tex src={NOISE} op={0.25} blend="screen" />
    <Tex op={0.35} />
    <Headline base={{fontFamily: 'Fredoka', fontSize: 88, color: '#F2E9DC'}} hl={{color: '#F4D58D'}} />
    <Caption top={1440} base={{fontFamily: 'Fredoka', fontSize: 80, color: '#F2E9DC'}} on={{color: '#F4D58D'}} />
  </AbsoluteFill>
);

/* ======================= 6. BOTANICAL PLATE ======================= */
const Botanical: React.FC = () => {
  const ink = '#2F2A22';
  const Label: React.FC<{x1: number; y1: number; x2: number; y2: number; t: string; right?: boolean}> = ({x1, y1, x2, y2, t, right}) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ink} strokeWidth={2} />
      <circle cx={x1} cy={y1} r={5} fill={ink} />
      <text x={x2 + (right ? 12 : -12)} y={y2 + 10} textAnchor={right ? 'start' : 'end'} fontFamily="DM Serif Display" fontStyle="italic" fontSize={36} fill={ink}>{t}</text>
    </g>
  );
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, #F3EAD3 0%, #E6D7B5 100%)'}}>
      <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
        <defs>
          <pattern id="hatch" width={9} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1={0} y1={0} x2={0} y2={9} stroke={ink} strokeWidth={2} /></pattern>
          <pattern id="hatch2" width={7} height={7} patternUnits="userSpaceOnUse" patternTransform="rotate(-40)"><line x1={0} y1={0} x2={0} y2={7} stroke={ink} strokeWidth={1.6} /></pattern>
        </defs>
        <rect x={50} y={180} width={980} height={1500} fill="none" stroke={ink} strokeWidth={4} />
        <rect x={64} y={194} width={952} height={1472} fill="none" stroke={ink} strokeWidth={1.5} />
        <text x={540} y={1620} textAnchor="middle" fontFamily="Cinzel" fontSize={34} fill={ink} letterSpacing={6}>PLATE IV · COR HUMANUM</text>
        <g transform="translate(540 980) scale(1.75)">
          <path d={P.vena} stroke="#8EA6C8" strokeWidth={34} strokeLinecap="round" fill="none" />
          <path d={P.aorta} stroke="#D9907F" strokeWidth={38} strokeLinecap="round" fill="none" />
          <path d={P.pulm} stroke="#8EA6C8" strokeWidth={28} strokeLinecap="round" fill="none" />
          <path d={P.body} fill="#E1A28F" />
          <path d={P.body} fill="url(#hatch)" opacity={0.45} />
          <path d="M 20 -40 C 80 -20, 100 60, 50 120 C 70 60, 60 0, 20 -40 Z" fill="url(#hatch2)" opacity={0.6} />
          <path d={P.body} fill="none" stroke={ink} strokeWidth={2.4} />
          <path d={P.groove} stroke={ink} strokeWidth={2} fill="none" />
          <path d={P.atrium} stroke={ink} strokeWidth={2} fill="none" />
        </g>
        <Label x1={640} y1={720} x2={830} y2={640} t="aorta" right />
        <Label x1={438} y1={760} x2={250} y2={700} t="vena cava" />
        <Label x1={470} y1={1120} x2={250} y2={1220} t="ventricle" />
        <Label x1={720} y1={840} x2={830} y2={900} t="pulmonary" right />
      </svg>
      <Tex src={NOISE} op={0.35} />
      <Headline top={250} base={{fontFamily: 'DM Serif Display', fontSize: 82, color: ink}} hl={{fontStyle: 'italic', color: '#9B3B2E'}} />
      <Caption top={1430} base={{fontFamily: 'DM Serif Display', fontSize: 72, color: ink, fontStyle: 'italic'}} on={{color: '#9B3B2E', textDecoration: 'underline'}} />
    </AbsoluteFill>
  );
};

/* ======================= 7. PAPER CUT ======================= */
const PaperCut: React.FC = () => {
  const sh = 'drop-shadow(0 14px 10px rgba(0,0,0,0.28))';
  const waves = ['#24375E', '#2E4A7A', '#3C5E92', '#5077AB'];
  return (
    <AbsoluteFill style={{background: '#1A2846'}}>
      {waves.map((c, i) => (
        <svg key={c} style={{position: 'absolute', inset: 0, filter: sh}} width={W} height={H}>
          <path d={`M 0 ${1150 + i * 170} C 250 ${1060 + i * 170}, 500 ${1230 + i * 170}, 1080 ${1100 + i * 170} L 1080 1920 L 0 1920 Z`} fill={c} />
        </svg>
      ))}
      <svg style={{position: 'absolute', inset: 0, filter: sh}} width={W} height={H}>
        <circle cx={830} cy={560} r={80} fill="#F6E3A1" />
        <circle cx={540} cy={920} r={360} fill="#F1E4CF" />
      </svg>
      {[{s: 600, c: '#9E2F3C'}, {s: 560, c: '#C9404D'}, {s: 515, c: '#E2606A'}].map((l, i) => (
        <Center key={i} y={910 + i * 8}>
          <div style={{filter: sh}}>
            <Heart size={l.s} body={l.c} red={i === 0 ? '#8C2733' : l.c} blue={['#3E5C8A', '#5577A8', '#7D9ACB'][i]} />
          </div>
        </Center>
      ))}
      <Tex op={0.4} />
      <div style={{position: 'absolute', left: 90, right: 90, top: 250, height: 300, background: '#F1E4CF', boxShadow: '0 12px 16px rgba(0,0,0,0.3)', transform: 'rotate(-1.2deg)'}} />
      <Headline top={285} base={{fontFamily: 'Montserrat', fontWeight: 900, fontSize: 72, color: '#1A2846'}} hl={{color: '#C9404D'}} />
      <div style={{position: 'absolute', left: 170, right: 170, top: 1360, height: 120, background: '#F6E3A1', boxShadow: '0 10px 12px rgba(0,0,0,0.3)'}} />
      <Caption top={1372} base={{fontFamily: 'Montserrat', fontWeight: 900, fontSize: 76, color: '#1A2846'}} on={{color: '#C9404D'}} />
    </AbsoluteFill>
  );
};

/* ======================= 8. ART NOUVEAU ======================= */
const Nouveau: React.FC = () => {
  const gold = '#B8934A';
  const ink = '#3B2F2A';
  return (
    <AbsoluteFill style={{background: '#EADFC8'}}>
      <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
        <path d="M 120 1700 L 120 900 A 420 420 0 0 1 960 900 L 960 1700 Z" fill="#9DAF95" stroke={ink} strokeWidth={10} />
        <path d="M 150 1680 L 150 910 A 390 390 0 0 1 930 910 L 930 1680 Z" fill="none" stroke={gold} strokeWidth={6} />
        {/* ореол */}
        <circle cx={540} cy={930} r={330} fill="#E8CF8F" stroke={ink} strokeWidth={8} />
        {Array.from({length: 36}, (_, i) => {
          const a = (i / 36) * Math.PI * 2;
          return <line key={i} x1={540 + Math.cos(a) * 250} y1={930 + Math.sin(a) * 250} x2={540 + Math.cos(a) * 325} y2={930 + Math.sin(a) * 325} stroke={gold} strokeWidth={6} />;
        })}
        <circle cx={540} cy={930} r={250} fill="#F3E6C4" stroke={ink} strokeWidth={6} />
        {/* «удар хлыста» — лозы */}
        {[1, -1].map((d) => (
          <g key={d} transform={`translate(540 0) scale(${d} 1) translate(-540 0)`}>
            <path d="M 150 1650 C 330 1560, 160 1380, 330 1290 C 470 1215, 380 1090, 250 1120" stroke={ink} strokeWidth={9} fill="none" strokeLinecap="round" />
            <path d="M 330 1290 C 360 1240, 420 1250, 410 1300 C 400 1340, 350 1330, 330 1290 Z" fill="#C88C6E" stroke={ink} strokeWidth={5} />
            <path d="M 250 1120 C 220 1080, 260 1040, 290 1070" stroke={ink} strokeWidth={7} fill="none" />
          </g>
        ))}
      </svg>
      <Center y={935}>
        <Heart size={440} body="#B4574A" red="#A04536" blue="#55708A" line={ink} sw={6} groove={ink} />
      </Center>
      <Tex src={NOISE} op={0.25} />
      <Headline top={230} base={{fontFamily: 'Cinzel', fontSize: 62, color: ink, letterSpacing: 2}} hl={{color: '#A04536'}} text="YOUR HEART *SLOWS DOWN* WHILE YOU SLEEP" />
      <div style={{position: 'absolute', left: 210, right: 210, top: 1390, height: 110, background: ink, borderRadius: 60, border: `5px solid ${gold}`}} />
      <Caption top={1405} base={{fontFamily: 'Cinzel', fontSize: 62, color: '#EADFC8'}} on={{color: '#E8CF8F'}} />
    </AbsoluteFill>
  );
};

/* ======================= 9. GOLDEN HOUR ======================= */
const Golden: React.FC = () => (
  <AbsoluteFill style={{background: 'linear-gradient(180deg, #3B2A5C 0%, #A44A6B 34%, #F08A4B 62%, #FFD08A 76%, #6B4A3A 77%, #3E2C2A 100%)'}}>
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      <defs>
        <radialGradient id="sun"><stop offset="0" stopColor="#FFF4C9" /><stop offset="0.25" stopColor="#FFD27A" stopOpacity={0.9} /><stop offset="1" stopColor="#FF9E57" stopOpacity={0} /></radialGradient>
        <linearGradient id="rim" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE2A0" /><stop offset="0.5" stopColor="#E0533F" /><stop offset="1" stopColor="#7A2234" /></linearGradient>
      </defs>
      {Array.from({length: 10}, (_, i) => (
        <path key={i} d={`M 540 1470 L ${-300 + i * 190} 0 L ${-240 + i * 190} 0 Z`} fill="#FFE7B0" opacity={0.07} />
      ))}
      <circle cx={540} cy={1470} r={520} fill="url(#sun)" />
      <path d="M 0 1480 C 200 1420, 380 1500, 560 1460 C 760 1420, 900 1480, 1080 1440 L 1080 1920 L 0 1920 Z" fill="#4A3030" />
      <path d="M 0 1600 C 300 1540, 600 1640, 1080 1570 L 1080 1920 L 0 1920 Z" fill="#2F2024" />
      {[[300, 520, 30], [760, 360, 18], [880, 640, 46]].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#FFE7B0" opacity={0.18} />
      ))}
    </svg>
    <Center y={900}>
      <Heart size={600} body="url(#rim)" red="#C8443F" blue="#6A5B9C" groove="#7A2234" style={{filter: 'drop-shadow(0 0 40px rgba(255,190,120,0.65))'}} />
    </Center>
    <Tex src={NOISE} op={0.15} blend="soft-light" />
    <Headline base={{fontFamily: 'Montserrat', fontWeight: 900, fontSize: 86, color: '#FFF4E0', textShadow: '0 6px 24px rgba(80,20,40,0.6)'}} hl={{color: '#FFD27A'}} />
    <Caption base={{fontFamily: 'Montserrat', fontWeight: 900, fontSize: 76, color: '#FFF4E0', textShadow: '0 5px 0 #3E2C2A'}} on={{color: '#3E2C2A', background: '#FFD27A', borderRadius: 14, padding: '0 14px', textShadow: 'none'}} />
  </AbsoluteFill>
);

/* ======================= 10. ANIME PAINTING (уютная рисованная анимация, без копирования студий) ======================= */
const Cloud: React.FC<{x: number; y: number; s: number}> = ({x, y, s}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {[[0, 0, 90], [80, -40, 110], [180, -10, 95], [260, 20, 70], [-80, 30, 60], [100, 40, 90]].map(([cx, cy, r], i) => (
      <g key={i}>
        <circle cx={cx} cy={cy + 14} r={r} fill="#B9CBE8" />
        <circle cx={cx} cy={cy} r={r} fill="#FFFFFF" />
      </g>
    ))}
  </g>
);
const Anime: React.FC = () => (
  <AbsoluteFill style={{background: 'linear-gradient(180deg, #3E8EDE 0%, #7DB9F0 45%, #CFE6F7 70%)'}}>
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      <Cloud x={160} y={720} s={1.3} />
      <Cloud x={780} y={700} s={0.9} />
      <Cloud x={620} y={1180} s={1.6} />
      <path d="M 0 1380 C 250 1290, 520 1330, 760 1280 C 900 1250, 1000 1270, 1080 1260 L 1080 1920 L 0 1920 Z" fill="#7FBF5A" />
      <path d="M 0 1500 C 300 1440, 600 1520, 1080 1450 L 1080 1920 L 0 1920 Z" fill="#5FA046" />
      {Array.from({length: 70}, (_, i) => {
        const x = random(`gx${i}`) * W;
        const y = 1470 + random(`gy${i}`) * 400;
        return <path key={i} d={`M ${x} ${y} q 6 -30 14 -46`} stroke="#3F7F32" strokeWidth={5} fill="none" strokeLinecap="round" />;
      })}
    </svg>
    <Center y={900}>
      <Heart size={560} body="#F06C6C" red="#E05252" blue="#5C86D6" groove="#B8404A" line="#5A2A3A" sw={5}
        extra={<>
          <path d="M -72 -48 C -124 -6, -112 84, -22 150 C -60 100, -80 20, -40 -40 Z" fill="#C94D5A" opacity={0.6} />
          <ellipse cx={50} cy={-10} rx={22} ry={40} fill="#FFFFFF" opacity={0.75} transform="rotate(25 50 -10)" />
        </>} />
    </Center>
    <Headline base={{fontFamily: 'Fredoka', fontSize: 90, color: '#FFFFFF', textShadow: '0 5px 0 #2E5E9E, 0 0 30px rgba(30,60,120,0.4)'}} hl={{color: '#FFE36E'}} />
    <Caption top={1560} base={{fontFamily: 'Fredoka', fontSize: 80, color: '#FFFFFF', textShadow: '0 5px 0 #2F6B28'}} on={{color: '#FFE36E'}} />
  </AbsoluteFill>
);

/* ======================= 11. X-RAY HOLOGRAM (моё) ======================= */
const XRay: React.FC = () => {
  const c = '#5FF3FF';
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 48%, #0E2A44 0%, #050B16 75%)'}}>
      <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
        {Array.from({length: 28}, (_, i) => <line key={`v${i}`} x1={i * 40} x2={i * 40} y1={0} y2={H} stroke={c} strokeOpacity={0.06} />)}
        {Array.from({length: 49}, (_, i) => <line key={`h${i}`} y1={i * 40} y2={i * 40} x1={0} x2={W} stroke={c} strokeOpacity={0.06} />)}
        {/* силуэт тела */}
        <g fill="none" stroke={c} strokeOpacity={0.35} strokeWidth={4}>
          <circle cx={540} cy={430} r={95} />
          <path d="M 470 520 L 470 560 C 330 580, 260 610, 250 700 L 220 1250 M 610 520 L 610 560 C 750 580, 820 610, 830 700 L 860 1250 M 330 700 L 340 1650 M 750 700 L 740 1650" />
        </g>
        {/* ЭКГ */}
        <path d="M 120 1320 L 380 1320 L 420 1320 L 450 1260 L 490 1390 L 530 1280 L 560 1320 L 960 1320" stroke="#FF4D6D" strokeWidth={6} fill="none" style={{filter: 'drop-shadow(0 0 8px #FF4D6D)'}} />
        <rect x={0} y={860} width={W} height={6} fill={c} opacity={0.35} />
      </svg>
      <Center y={900}>
        <Heart size={480} body="rgba(95,243,255,0.14)" red="rgba(255,77,109,0.5)" blue="rgba(95,243,255,0.35)" line={c} sw={3} groove={c} style={{filter: `drop-shadow(0 0 14px ${c})`}} />
      </Center>
      <div style={{position: 'absolute', left: 110, top: 640, fontFamily: 'Space Mono', fontSize: 30, color: c, lineHeight: 1.5}}>SCAN 03<br />HEART<br />NIGHT MODE</div>
      <div style={{position: 'absolute', right: 110, top: 640, fontFamily: 'Space Mono', fontSize: 30, color: '#FF4D6D', textAlign: 'right', lineHeight: 1.5}}>BPM ↓<br />SLOWER<br />CALMER</div>
      <Headline base={{fontFamily: 'Archivo Black', fontSize: 82, color: '#E9FDFF', textShadow: `0 0 18px ${c}`}} hl={{color: c}} />
      <Caption top={1420} base={{fontFamily: 'Space Mono', fontWeight: 700, fontSize: 70, color: '#E9FDFF'}} on={{color: '#050B16', background: c, padding: '0 10px'}} />
    </AbsoluteFill>
  );
};

/* ======================= 12. FLAT COSMIC EXPLAINER (моё) ======================= */
const Cosmic: React.FC = () => (
  <AbsoluteFill style={{background: 'linear-gradient(180deg, #1B1446 0%, #2C1E6B 55%, #43288F 100%)'}}>
    <Stars n={70} color="#FFFFFF" seed="c" />
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      <circle cx={540} cy={930} r={400} fill="#3B2C8A" />
      <circle cx={540} cy={930} r={320} fill="#4D3AA8" />
      <circle cx={180} cy={1500} r={150} fill="#FF8FB1" />
      <circle cx={180} cy={1500} r={150} fill="#000" opacity={0.15} transform="translate(20 20)" />
      <circle cx={920} cy={1200} r={60} fill="#FFD166" />
      {/* длинная тень */}
      <path d="M 400 1080 L 900 1580 L 1080 1580 L 1080 1300 L 700 920 Z" fill="#000" opacity={0.12} />
    </svg>
    <Center y={910}>
      <Heart size={540} body="#FF5A6E" red="#FF3D57" blue="#4CC9F0" groove="#D93250"
        extra={<path d="M -50 -30 C -80 10, -70 60, -40 100" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={12} fill="none" strokeLinecap="round" />} />
    </Center>
    <Headline base={{fontFamily: 'Archivo Black', fontSize: 84, color: '#FFFFFF'}} hl={{color: '#FFD166'}} />
    <Caption top={1400} base={{fontFamily: 'Archivo Black', fontSize: 74, color: '#FFFFFF'}} on={{color: '#1B1446', background: '#FFD166', borderRadius: 14, padding: '0 14px'}} />
  </AbsoluteFill>
);

/* ======================= 13. COMIC HALFTONE (моё) ======================= */
const Comic: React.FC = () => (
  <AbsoluteFill style={{background: '#FFD23F'}}>
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      <defs>
        <pattern id="dots" width={22} height={22} patternUnits="userSpaceOnUse"><circle cx={11} cy={11} r={5} fill="#F28C28" /></pattern>
        <pattern id="redDots" width={14} height={14} patternUnits="userSpaceOnUse"><circle cx={7} cy={7} r={4} fill="#A3121F" /></pattern>
      </defs>
      {Array.from({length: 24}, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const b = ((i + 0.5) / 24) * Math.PI * 2;
        return <path key={i} d={`M 540 930 L ${540 + Math.cos(a) * 1500} ${930 + Math.sin(a) * 1500} L ${540 + Math.cos(b) * 1500} ${930 + Math.sin(b) * 1500} Z`} fill={i % 2 ? 'url(#dots)' : 'none'} />;
      })}
      {/* «бах»-плашка */}
      <path d="M 540 560 L 600 640 L 700 600 L 690 700 L 800 730 L 710 790 L 780 880 L 670 870 L 650 970 L 580 900 L 520 990 L 480 900 L 380 950 L 400 850 L 290 820 L 390 760 L 320 670 L 430 690 L 450 590 Z" fill="#FFFFFF" stroke="#111" strokeWidth={10} transform="translate(0 30) scale(1.55) translate(-191 -330)" />
    </svg>
    <Center y={930}>
      <Heart size={560} body="#E63946" red="#D62839" blue="#3A86FF" line="#111" sw={7} groove="#111"
        extra={<path d={P.body} fill="url(#redDots)" opacity={0.35} transform="translate(8 8)" clipPath="none" />} />
    </Center>
    {/* пузырь */}
    <div style={{position: 'absolute', left: 620, top: 600, padding: '18px 28px', background: '#fff', border: '7px solid #111', borderRadius: 40, fontFamily: 'Anton', fontSize: 52, color: '#111', transform: 'rotate(6deg)'}}>THUMP… thump…</div>
    <div style={{position: 'absolute', left: 80, right: 80, top: 250, padding: 24, height: 250, background: '#fff', border: '8px solid #111', boxShadow: '14px 14px 0 #111'}} />
    <Headline top={270} base={{fontFamily: 'Anton', fontSize: 92, color: '#111', textTransform: 'uppercase'}} hl={{color: '#E63946'}} />
    <Caption top={1420} base={{fontFamily: 'Anton', fontSize: 92, color: '#111', WebkitTextStroke: '0px'}} on={{color: '#fff', background: '#E63946', padding: '0 12px', border: '6px solid #111'}} />
  </AbsoluteFill>
);

/* ======================= 14. NOTEBOOK DOODLE (моё) ======================= */
const Notebook: React.FC = () => {
  const pen = '#1E3A8A';
  return (
    <AbsoluteFill style={{background: '#FBFAF4'}}>
      <svg width={0} height={0}>
        <filter id="pen"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves={2} seed={3} /><feDisplacementMap in="SourceGraphic" scale={5} xChannelSelector="R" yChannelSelector="G" /></filter>
      </svg>
      <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
        {Array.from({length: 40}, (_, i) => <line key={i} x1={0} x2={W} y1={160 + i * 52} y2={160 + i * 52} stroke="#9CC3E8" strokeWidth={2} />)}
        <line x1={110} x2={110} y1={0} y2={H} stroke="#F08080" strokeWidth={3} />
        {[300, 960, 1620].map((y) => <circle key={y} cx={50} cy={y} r={22} fill="#E8E4D8" />)}
        <g filter="url(#pen)" fill="none" stroke={pen} strokeWidth={5} strokeLinecap="round">
          <path d="M 760 1180 C 820 1150, 880 1200, 930 1170" />
          <text x={800} y={1250} fontFamily="Caveat" fontSize={48} fill={pen} stroke="none">≈ 10% slower!</text>
          <path d="M 790 1220 C 760 1190, 720 1150, 700 1100 M 700 1100 L 690 1130 M 700 1100 L 725 1115" />
        </g>
      </svg>
      <Center y={920}>
        <div style={{filter: 'url(#pen)'}}>
          <Heart size={540} body="rgba(230,57,70,0.28)" red="rgba(230,57,70,0.35)" blue="rgba(30,58,138,0.25)" line={pen} sw={4} groove={pen} />
        </div>
      </Center>
      <div style={{position: 'absolute', left: 300, top: 1350, width: 480, height: 200, background: '#FFE97A', boxShadow: '0 10px 18px rgba(0,0,0,0.18)', transform: 'rotate(-3deg)'}} />
      <Headline top={270} base={{fontFamily: 'Caveat', fontSize: 104, color: pen}} hl={{background: 'linear-gradient(transparent 55%, #FFE97A 55%)'}} />
      <Caption top={1395} base={{fontFamily: 'Caveat', fontSize: 92, color: '#222', transform: 'rotate(-3deg)'}} on={{color: '#E63946', textDecoration: 'underline'}} />
    </AbsoluteFill>
  );
};

/* ======================= 15. RISOGRAPH (моё) ======================= */
const Riso: React.FC = () => {
  const pink = '#FF48B0';
  const blue = '#0078BF';
  return (
    <AbsoluteFill style={{background: '#F5F0E6'}}>
      <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
        <defs>
          <pattern id="ht" width={12} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(20)"><circle cx={6} cy={6} r={3.4} fill={blue} /></pattern>
        </defs>
        <g style={{mixBlendMode: 'multiply'}}>
          <circle cx={540} cy={930} r={400} fill="url(#ht)" opacity={0.75} />
          <rect x={90} y={1300} width={900} height={330} fill={pink} opacity={0.85} />
          <circle cx={910} cy={1210} r={80} fill={pink} />
        </g>
      </svg>
      <Center y={920}>
        <div style={{position: 'relative', mixBlendMode: 'multiply'}}>
          <Heart size={540} body={pink} red={pink} blue={blue} />
          <div style={{position: 'absolute', left: 12, top: -8, mixBlendMode: 'multiply'}}>
            <Heart size={540} body="none" red="none" blue="none" line={blue} sw={5} groove={blue} />
          </div>
        </div>
      </Center>
      <Tex op={0.5} />
      <Headline base={{fontFamily: 'Archivo Black', fontSize: 86, color: blue, mixBlendMode: 'multiply'}} hl={{color: pink}} />
      <Caption top={1420} base={{fontFamily: 'Archivo Black', fontSize: 84, color: '#F5F0E6'}} on={{color: blue}} />
    </AbsoluteFill>
  );
};

/* ======================= 16. GLOSSY 3D (моё) ======================= */
const Glossy: React.FC = () => (
  <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 40%, #F4F7FB 0%, #C9D6E8 70%, #A9BBD4 100%)'}}>
    <svg width={0} height={0}>
      <defs>
        <radialGradient id="gb" cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#FF8A8A" /><stop offset="0.45" stopColor="#E3343F" /><stop offset="1" stopColor="#8E1424" /></radialGradient>
        <linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF6B6B" /><stop offset="1" stopColor="#A5162A" /></linearGradient>
        <linearGradient id="gv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8FB8FF" /><stop offset="1" stopColor="#2F5BBF" /></linearGradient>
      </defs>
    </svg>
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      <ellipse cx={540} cy={1290} rx={300} ry={50} fill="#4A5A75" opacity={0.3} style={{filter: 'blur(14px)'}} />
    </svg>
    <Center y={900}>
      <Heart size={580} body="url(#gb)" red="url(#gr)" blue="url(#gv)" groove="#7E1020"
        extra={<>
          <ellipse cx={-40} cy={-10} rx={34} ry={60} fill="#FFFFFF" opacity={0.55} transform="rotate(20 -40 -10)" />
          <ellipse cx={-20} cy={60} rx={12} ry={22} fill="#FFFFFF" opacity={0.35} />
        </>} />
    </Center>
    <Headline base={{fontFamily: 'Fredoka', fontSize: 92, color: '#1E2A44'}} hl={{color: '#E3343F'}} />
    <Caption top={1420} base={{fontFamily: 'Fredoka', fontSize: 82, color: '#1E2A44'}} on={{color: '#FFFFFF', background: '#E3343F', borderRadius: 40, padding: '0 22px'}} />
  </AbsoluteFill>
);

export const STUDY: [string, string, React.FC][] = [
  ['watercolour', 'Watercolour', Watercolour],
  ['mosaic', 'Roman mosaic', Mosaic],
  ['sumie', 'Sumi-e ink', SumiE],
  ['impasto', 'Impasto oil', Impasto],
  ['gouache', 'Nocturne gouache', Gouache],
  ['botanical', 'Botanical plate', Botanical],
  ['papercut', 'Paper cut', PaperCut],
  ['nouveau', 'Art nouveau', Nouveau],
  ['golden', 'Golden hour', Golden],
  ['anime', 'Anime painting', Anime],
  ['xray', 'X-ray hologram', XRay],
  ['cosmic', 'Flat cosmic', Cosmic],
  ['comic', 'Comic halftone', Comic],
  ['notebook', 'Notebook doodle', Notebook],
  ['riso', 'Risograph', Riso],
  ['glossy', 'Glossy 3D', Glossy],
];

export const StudyStills: React.FC = () => (
  <>
    {STUDY.map(([id, , C]) => (
      <Still key={id} id={`Study-${id}`} component={C} width={W} height={H} />
    ))}
  </>
);
