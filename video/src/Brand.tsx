// Оформление YouTube-канала: логотип (800x800, на YouTube виден кругом) и шапка (2560x1440).
// По 5 вариантов каждого; цвета и шрифты — основного стиля «Музей ночью» (золото на тёмном).
// Шапка: всё важное — в полосе 1546x423 по центру (её видно и на телефоне, и на компьютере).
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {Stage} from './Chapter';
import {Icon, type IconColors, type IconName} from './components/Icons';
import {Particles, Wordmark} from './Intro';
import {alpha, mix, rng} from './lib/anim';
import {Shot} from './shots';
import {FONT_SERVICE, useStyle, type Palette} from './style';

export const CHANNEL = 'True Tales of the Past';
export const TAGLINE = 'Pull up a chair — history has a story for you.';
export const LOGO = {width: 800, height: 800};
export const BANNER = {width: 2560, height: 1440};
/** Видно везде (телефон); на компьютере видна вся ширина этой полосы. */
export const BANNER_SAFE = {left: 507, top: 508, width: 1546, height: 423};
const BRAND_STYLE = 'museum';

export const LOGO_VARIANTS = ['Монограмма', 'Песочные часы', 'Книга и свеча', 'Сквозь века', 'Печать'];
export const BANNER_VARIANTS = ['Сквозь века', 'Ночной музей', 'Свиток', 'Карта', 'Руины под звёздами'];

const gold = (p: Palette): IconColors => ({main: p.accent, shade: mix(p.accent, '#000000', 0.4), hi: mix(p.accent, '#ffffff', 0.35), line: mix(p.accent, '#000000', 0.25)});
const dark = (p: Palette): IconColors => ({main: mix(p.bg, '#000000', 0.35), shade: mix(p.bg, '#000000', 0.6), hi: alpha(p.accent, 0.55), line: alpha(p.accent, 0.4)});

// ================================================================ логотипы

const Ring: React.FC<{p: Palette; r: number; w: number; o?: number}> = ({p, r, w, o = 1}) => <circle cx={400} cy={400} r={r} fill="none" stroke={p.accent} strokeWidth={w} opacity={o} />;

const Glow: React.FC<{color: string; at?: string; size?: string}> = ({color, at = '50% 45%', size = '60% 60%'}) => (
  <AbsoluteFill style={{background: `radial-gradient(ellipse ${size} at ${at}, ${color} 0%, rgba(0,0,0,0) 100%)`}} />
);

const Monogram: React.FC<{p: Palette; size: number; y: number; fill?: string}> = ({p, size, y, fill}) => {
  const {fonts} = useStyle();
  return (
    <text x={400} y={y} textAnchor="middle" fontFamily={fonts.display} fontWeight={700} fontSize={size} letterSpacing={-size * 0.09} fill={fill ?? p.accent}>
      TT
    </text>
  );
};

const LogoMonogram: React.FC<{p: Palette}> = ({p}) => {
  const {fonts} = useStyle();
  const arc = 'M 400 400 m -318 0 a 318 318 0 1 1 636 0 a 318 318 0 1 1 -636 0';
  return (
    <>
      <Glow color={alpha(mix(p.bgAlt, p.accent, 0.3), 0.9)} />
      <svg width={800} height={800} style={{position: 'absolute', inset: 0}}>
        <defs>
          <path id="ring-text" d={arc} />
        </defs>
        <Ring p={p} r={372} w={10} />
        <Ring p={p} r={354} w={2} />
        <Ring p={p} r={282} w={3} />
        <text fontFamily={fonts.body} fontWeight={700} fontSize={36} fill={p.accent}>
          <textPath href="#ring-text" startOffset="0" textLength={Math.round(2 * Math.PI * 318) - 30} lengthAdjust="spacing">
            TRUE TALES OF THE PAST ✦ TRUE TALES OF THE PAST ✦
          </textPath>
        </text>
        <Monogram p={p} size={330} y={515} />
        <path d="M400 168 l14 14 l-14 14 l-14 -14 z M400 604 l14 14 l-14 14 l-14 -14 z" fill={p.accent} />
      </svg>
    </>
  );
};

const LogoHourglass: React.FC<{p: Palette}> = ({p}) => {
  const glass = alpha(p.light, 0.14);
  const sand = p.accent;
  return (
    <>
      <Glow color={alpha(mix(p.bg, p.accent2, 0.55), 0.95)} size="70% 70%" />
      <svg width={800} height={800} style={{position: 'absolute', inset: 0}}>
        <Ring p={p} r={372} w={8} />
        <Ring p={p} r={352} w={2} o={0.7} />
        {/* стекло */}
        <path d="M280 205 h240 q0 120 -95 190 q-15 5 0 10 q95 70 95 190 h-240 q0 -120 95 -190 q15 -5 0 -10 q-95 -70 -95 -190 z" fill={glass} stroke={p.light} strokeWidth={6} strokeLinejoin="round" />
        {/* песок: сверху меньше, струйка, горка снизу */}
        <path d="M318 300 h164 q-20 55 -73 92 q-9 6 -18 0 q-53 -37 -73 -92 z" fill={sand} />
        <rect x={397} y={395} width={6} height={180} fill={sand} />
        <path d="M300 590 q100 -95 200 0 z" fill={sand} />
        {/* рамка */}
        <rect x={240} y={175} width={320} height={34} rx={10} fill={p.accent} />
        <rect x={240} y={591} width={320} height={34} rx={10} fill={p.accent} />
        <rect x={252} y={209} width={14} height={382} rx={6} fill={mix(p.accent, '#000000', 0.25)} />
        <rect x={534} y={209} width={14} height={382} rx={6} fill={mix(p.accent, '#000000', 0.25)} />
      </svg>
    </>
  );
};

const LogoBook: React.FC<{p: Palette}> = ({p}) => {
  const page = p.paper;
  const edge = p.accent;
  const line = alpha(p.ink, 0.35);
  return (
    <>
      <Glow color={alpha(mix(p.accent, p.accent2, 0.3), 0.55)} at="50% 34%" size="45% 45%" />
      <svg width={800} height={800} style={{position: 'absolute', inset: 0}}>
        <Ring p={p} r={372} w={8} />
        {/* пламя свечи */}
        <ellipse cx={400} cy={262} rx={70} ry={70} fill={alpha(p.accent, 0.18)} />
        <path d="M400 168 q52 70 34 118 q-12 28 -34 28 q-22 0 -34 -28 q-18 -48 34 -118 z" fill={p.accent} />
        <path d="M400 228 q22 32 13 56 q-5 12 -13 12 q-8 0 -13 -12 q-9 -24 13 -56 z" fill={mix(p.accent, '#ffffff', 0.6)} />
        <rect x={386} y={312} width={28} height={70} rx={4} fill={p.light} />
        {/* раскрытая книга */}
        <path d="M400 430 q-120 -40 -250 -10 v200 q130 -30 250 10 z" fill={page} stroke={edge} strokeWidth={6} strokeLinejoin="round" />
        <path d="M400 430 q120 -40 250 -10 v200 q-130 -30 -250 10 z" fill={mix(page, p.paperShade, 0.35)} stroke={edge} strokeWidth={6} strokeLinejoin="round" />
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <path d={`M195 ${468 + k * 30} q90 -18 170 4`} stroke={line} strokeWidth={5} fill="none" />
            <path d={`M435 ${472 + k * 30} q80 -22 170 -4`} stroke={line} strokeWidth={5} fill="none" />
          </g>
        ))}
        <path d="M150 620 q130 -30 250 10 q120 -40 250 -10 v22 q-130 -26 -250 12 q-120 -38 -250 -12 z" fill={mix(p.accent, '#000000', 0.3)} />
      </svg>
    </>
  );
};

const LogoAges: React.FC<{p: Palette}> = ({p}) => {
  const items: {icon: IconName; x: number; size: number}[] = [
    {icon: 'pyramid', x: 215, size: 90},
    {icon: 'temple', x: 400, size: 105},
    {icon: 'crown', x: 585, size: 85},
  ];
  return (
    <>
      <Glow color={alpha(mix(p.bgAlt, p.accent, 0.25), 0.9)} />
      <svg width={800} height={800} style={{position: 'absolute', inset: 0}}>
        <Ring p={p} r={372} w={8} />
        <Ring p={p} r={352} w={2} o={0.7} />
        <line x1={110} x2={690} y1={430} y2={430} stroke={p.accent} strokeWidth={8} strokeLinecap="round" />
        {items.map((it) => (
          <g key={it.icon}>
            <Icon name={it.icon} x={it.x} y={410} size={it.size} colors={gold(p)} />
            <circle cx={it.x} cy={430} r={14} fill={p.accent} />
          </g>
        ))}
        <Monogram p={p} size={200} y={650} fill={p.light} />
      </svg>
    </>
  );
};

const LogoSeal: React.FC<{p: Palette}> = ({p}) => {
  const r = rng(5);
  const pts = Array.from({length: 48}, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    const rad = 318 + (r() - 0.5) * 34;
    return `${400 + Math.cos(a) * rad},${400 + Math.sin(a) * rad}`;
  }).join(' ');
  const wax = mix(p.accent2, '#000000', 0.1);
  const waxDark = mix(p.accent2, '#000000', 0.45);
  const waxHi = mix(p.accent2, '#ffffff', 0.25);
  return (
    <>
      <Glow color={alpha(mix(p.bgAlt, p.accent2, 0.4), 0.8)} size="70% 70%" />
      <svg width={800} height={800} style={{position: 'absolute', inset: 0}}>
        <defs>
          <radialGradient id="wax" cx="40%" cy="35%" r="70%">
            <stop offset="0" stopColor={waxHi} />
            <stop offset="0.55" stopColor={wax} />
            <stop offset="1" stopColor={waxDark} />
          </radialGradient>
        </defs>
        <polygon points={pts} fill="url(#wax)" />
        <circle cx={400} cy={400} r={250} fill="none" stroke={waxDark} strokeWidth={14} />
        <circle cx={400} cy={403} r={250} fill="none" stroke={alpha(waxHi, 0.6)} strokeWidth={3} />
        <Monogram p={p} size={300} y={507} fill={waxHi} />
        <Monogram p={p} size={300} y={503} fill={waxDark} />
        <circle cx={400} cy={400} r={278} fill="none" stroke={alpha(p.accent, 0.8)} strokeWidth={4} strokeDasharray="4 14" />
      </svg>
    </>
  );
};

const LOGOS = [LogoMonogram, LogoHourglass, LogoBook, LogoAges, LogoSeal];

const LogoInner: React.FC<{variant: number}> = ({variant}) => {
  const {palette: p} = useStyle();
  const View = LOGOS[Math.min(LOGOS.length, Math.max(1, variant)) - 1];
  return (
    <AbsoluteFill style={{backgroundColor: p.bg}}>
      <View p={p} />
    </AbsoluteFill>
  );
};

export const Logo: React.FC<{variant: number}> = ({variant}) => (
  <Stage styleId={BRAND_STYLE}>
    <LogoInner variant={variant} />
  </Stage>
);

// ================================================================ шапки

const BW = BANNER.width;
const BH = BANNER.height;
const S = BANNER_SAFE;
const MID_Y = S.top + S.height / 2;

/** Название и подпись; блок стоит серединой на высоте y (по умолчанию — середина полосы). */
const Title: React.FC<{y?: number; color?: string; accent?: string; tagline?: string | null; taglineColor?: string; size?: number; glow?: string}> = ({
  y = MID_Y,
  color,
  accent,
  tagline = TAGLINE,
  taglineColor,
  size = 132,
  glow,
}) => {
  const {palette: p, fonts} = useStyle();
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y, translate: '0 -50%', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <Wordmark channel={CHANNEL} t={99} start={0} maxWidth={1180} color={color ?? p.light} accent={accent ?? p.accent} size={size} glow={glow} />
      {tagline ? (
        <div style={{marginTop: 24, fontFamily: fonts.body, fontWeight: 600, fontSize: 40, color: taglineColor ?? p.lightSoft, letterSpacing: '0.02em', whiteSpace: 'nowrap'}}>{tagline}</div>
      ) : null}
    </div>
  );
};

const Dust: React.FC<{p: Palette; seed?: number; n?: number}> = ({p, seed = 3, n = 160}) => (
  <svg width={BW} height={BH} style={{position: 'absolute', inset: 0}}>
    <Particles t={2.7} n={n} seed={seed} box={[0, 0, BW, BH]} color={p.accent} rise={0.02} size={3} opacity={0.5} />
  </svg>
);

const BannerAges: React.FC<{p: Palette}> = ({p}) => {
  const lineY = 925;
  const items: {icon: IconName; x: number; size: number}[] = [
    {icon: 'pyramid', x: 230, size: 240},
    {icon: 'temple', x: 520, size: 230},
    {icon: 'ship', x: 2040, size: 230},
    {icon: 'crown', x: 2330, size: 170},
  ];
  return (
    <>
      <Glow color={alpha(mix(p.bgAlt, p.accent, 0.22), 0.95)} at="50% 50%" size="55% 45%" />
      <Dust p={p} />
      <svg width={BW} height={BH} style={{position: 'absolute', inset: 0}}>
        <line x1={0} x2={BW} y1={lineY} y2={lineY} stroke={p.accent} strokeWidth={6} />
        {Array.from({length: 65}, (_, i) => (
          <line key={i} x1={i * 40} x2={i * 40} y1={lineY - (i % 4 === 0 ? 18 : 8)} y2={lineY + (i % 4 === 0 ? 18 : 8)} stroke={p.accent} strokeWidth={3} opacity={0.6} />
        ))}
        {items.map((it) => (
          <g key={it.icon}>
            <Icon name={it.icon} x={it.x} y={lineY - 20} size={it.size} colors={gold(p)} />
            <circle cx={it.x} cy={lineY} r={13} fill={p.accent} />
          </g>
        ))}
      </svg>
      <Title glow={alpha(p.accent, 0.3)} />
    </>
  );
};

const BannerMuseum: React.FC<{p: Palette}> = ({p}) => {
  const floor = S.top + S.height - 10;
  const exhibits: {icon: IconName; x: number; size: number}[] = [
    {icon: 'amphora', x: 250, size: 190},
    {icon: 'helmet', x: 540, size: 140},
    {icon: 'crown', x: 2020, size: 120},
    {icon: 'scroll', x: 2310, size: 120},
  ];
  const beam = (x: number, w: number, o: number, key: string) => (
    <path key={key} d={`M${x - 30} 0 L${x + 30} 0 L${x + w} ${floor} L${x - w} ${floor} Z`} fill={alpha(p.light, o)} />
  );
  return (
    <>
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${mix(p.bg, p.bgAlt, 0.7)} 0%, ${p.bg} 75%)`}} />
      <svg width={BW} height={BH} style={{position: 'absolute', inset: 0}}>
        {Array.from({length: 11}, (_, i) => (
          <rect key={i} x={i * 250 - 10} y={0} width={44} height={floor} fill={alpha(mix(p.bgAlt, p.light, 0.05), 0.5)} />
        ))}
        <rect x={0} y={floor} width={BW} height={BH - floor} fill={mix(p.bg, '#000000', 0.35)} />
        {exhibits.map((e) => beam(e.x, 170, 0.07, `b${e.x}`))}
        {beam(BW / 2, 760, 0.06, 'center')}
        {exhibits.map((e) => (
          <g key={e.icon}>
            <ellipse cx={e.x} cy={floor + 6} rx={190} ry={22} fill={alpha(p.light, 0.12)} />
            <rect x={e.x - 105} y={floor - 170} width={210} height={170} fill={mix(p.bg, p.light, 0.12)} />
            <rect x={e.x - 118} y={floor - 186} width={236} height={20} fill={mix(p.bg, p.light, 0.18)} />
            <Icon name={e.icon} x={e.x} y={floor - 186} size={e.size} colors={{main: mix(p.bg, p.lightSoft, 0.75), shade: mix(p.bg, '#000000', 0.4), hi: p.accent, line: mix(p.bgAlt, p.light, 0.7)}} />
          </g>
        ))}
        <rect x={BW / 2 - 640} y={S.top + 8} width={1280} height={S.height - 40} rx={8} fill={mix(p.bg, '#000000', 0.3)} stroke={p.accent} strokeWidth={8} />
        <rect x={BW / 2 - 612} y={S.top + 30} width={1224} height={S.height - 84} rx={4} fill="none" stroke={alpha(p.accent, 0.6)} strokeWidth={2} />
      </svg>
      <Title y={S.top + 8 + (S.height - 40) / 2} glow={alpha(p.accent, 0.25)} />
    </>
  );
};

const BannerScroll: React.FC<{p: Palette}> = ({p}) => {
  const x0 = 470;
  const x1 = BW - 470;
  const y0 = S.top + 20;
  const y1 = S.top + S.height - 20;
  const wood = mix(p.accent2, '#3a2412', 0.6);
  const roll = (x: number) => (
    <g key={x}>
      <rect x={x - 26} y={y0 - 70} width={52} height={y1 - y0 + 140} rx={18} fill={wood} />
      <rect x={x - 40} y={y0 - 34} width={80} height={y1 - y0 + 68} rx={34} fill={p.paperShade} />
      <rect x={x - 40} y={y0 - 34} width={30} height={y1 - y0 + 68} rx={14} fill={alpha('#000000', 0.15)} />
    </g>
  );
  const ink = {main: alpha(p.ink, 0.1), shade: alpha(p.ink, 0.3), hi: alpha(p.ink, 0.6), line: alpha(p.ink, 0.75)};
  return (
    <>
      <Glow color={alpha(mix(p.bgAlt, p.accent, 0.2), 0.9)} at="50% 50%" size="60% 50%" />
      <Dust p={p} seed={9} n={120} />
      <svg width={BW} height={BH} style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id="parch" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={p.paperShade} />
            <stop offset="0.06" stopColor={p.paper} />
            <stop offset="0.94" stopColor={p.paper} />
            <stop offset="1" stopColor={p.paperShade} />
          </linearGradient>
        </defs>
        <path d={`M${x0} ${y0} Q${BW / 2} ${y0 + 26} ${x1} ${y0} V${y1} Q${BW / 2} ${y1 - 26} ${x0} ${y1} Z`} fill="url(#parch)" />
        {roll(x0)}
        {roll(x1)}
        <Icon name="temple" x={x0 + 150} y={y1 - 70} size={150} colors={ink} />
        <Icon name="pyramid" x={x1 - 150} y={y1 - 70} size={150} colors={ink} />
      </svg>
      <Title color={p.ink} accent={mix(p.accent, p.ink, 0.45)} taglineColor={alpha(p.ink, 0.75)} />
    </>
  );
};

const BannerMap: React.FC<{p: Palette}> = ({p}) => (
  <>
    {/* карта (кадр 1920x1080) растянута до 2560x1440 — те же пропорции */}
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, scale: BW / 1920, transformOrigin: '0 0'}}>
      <Sequence from={-200}>
        <Shot spec={{type: 'map', view: [-12, 12, 62, 54]}} frames={210} />
      </Sequence>
    </div>
    <AbsoluteFill style={{background: `radial-gradient(ellipse 70% 60% at 50% 50%, ${alpha(p.bg, 0.25)} 0%, ${alpha(p.bg, 0.85)} 100%)`}} />
    <svg width={BW} height={BH} style={{position: 'absolute', inset: 0}}>
      <rect x={BW / 2 - 700} y={S.top + 14} width={1400} height={S.height - 40} rx={10} fill={alpha(p.bg, 0.86)} stroke={p.accent} strokeWidth={6} />
      <path d={`M${BW / 2 - 700} ${MID_Y} h-160 M${BW / 2 + 700} ${MID_Y} h160`} stroke={p.accent} strokeWidth={4} />
      <circle cx={BW / 2 - 870} cy={MID_Y} r={10} fill={p.accent} />
      <circle cx={BW / 2 + 870} cy={MID_Y} r={10} fill={p.accent} />
    </svg>
    <Title y={S.top + 14 + (S.height - 40) / 2} />
  </>
);

const BannerRuins: React.FC<{p: Palette}> = ({p}) => {
  const ground = S.top + S.height - 6;
  const r = rng(21);
  const stars = Array.from({length: 260}, () => ({x: r() * BW, y: r() * ground, s: 0.6 + r() * 2.2, o: 0.25 + r() * 0.7}));
  const sil = dark(p);
  const column = (x: number, h: number) => (
    <g key={x}>
      <rect x={x - 26} y={ground - h} width={52} height={h} fill={sil.main} />
      <rect x={x - 38} y={ground - h - 16} width={76} height={18} fill={sil.main} />
      <path d={`M${x - 26} ${ground - h} l14 -10 l12 8 l10 -12 l16 14`} fill={sil.main} />
    </g>
  );
  return (
    <>
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${mix(p.bg, '#0c1430', 0.55)} 0%, ${mix(p.bgAlt, p.accent2, 0.25)} 70%, ${p.bg} 100%)`}} />
      <svg width={BW} height={BH} style={{position: 'absolute', inset: 0}}>
        {stars.map((st, i) => (
          <circle key={i} cx={st.x} cy={st.y} r={st.s} fill={p.light} opacity={st.o} />
        ))}
        <circle cx={2120} cy={S.top + 120} r={190} fill={alpha(p.light, 0.06)} />
        <circle cx={2120} cy={S.top + 120} r={95} fill={mix(p.light, p.accent, 0.25)} />
        <rect x={0} y={ground} width={BW} height={BH - ground} fill={mix(p.bg, '#000000', 0.4)} />
        <Icon name="pyramid" x={260} y={ground} size={330} colors={sil} />
        {column(560, 260)}
        {column(650, 180)}
        {column(1940, 210)}
        <Icon name="temple" x={2290} y={ground} size={300} colors={sil} />
      </svg>
      <Title glow={alpha(p.accent, 0.35)} />
    </>
  );
};

const BANNERS = [BannerAges, BannerMuseum, BannerScroll, BannerMap, BannerRuins];

const BannerInner: React.FC<{variant: number}> = ({variant}) => {
  const {palette: p} = useStyle();
  const View = BANNERS[Math.min(BANNERS.length, Math.max(1, variant)) - 1];
  return (
    <AbsoluteFill style={{backgroundColor: p.bg, overflow: 'hidden'}}>
      <View p={p} />
    </AbsoluteFill>
  );
};

export const Banner: React.FC<{variant: number}> = ({variant}) => (
  <Stage styleId={BRAND_STYLE}>
    <BannerInner variant={variant} />
  </Stage>
);

// ================================================================ листы для выбора

const Chip: React.FC<{n: number; text: string}> = ({n, text}) => (
  <div style={{display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 16px 7px 6px', borderRadius: 30, backgroundColor: 'rgba(8,10,14,0.9)', fontFamily: FONT_SERVICE}}>
    <div style={{width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', color: '#0A0C10', fontWeight: 800, fontSize: 22, lineHeight: '36px', textAlign: 'center'}}>{n}</div>
    <div style={{color: '#FFFFFF', fontWeight: 700, fontSize: 22}}>{text}</div>
  </div>
);

const Round: React.FC<{size: number; variant: number}> = ({size, variant}) => (
  <div style={{width: size, height: size, borderRadius: size / 2, overflow: 'hidden', position: 'relative', flex: 'none'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: 800, height: 800, scale: size / 800, transformOrigin: '0 0'}}>
      <LogoInner variant={variant} />
    </div>
  </div>
);

export const LOGO_SHEET = {width: 2000, height: 760};

export const LogoSheet: React.FC = () => (
  <Stage styleId={BRAND_STYLE}>
    <AbsoluteFill style={{backgroundColor: '#E9E6E1'}}>
      {LOGO_VARIANTS.map((name, i) => (
        <div key={name} style={{position: 'absolute', left: i * 400, top: 0, width: 400, height: LOGO_SHEET.height, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, paddingTop: 30}}>
          <Chip n={i + 1} text={name} />
          <Round size={330} variant={i + 1} />
          <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
            <Round size={98} variant={i + 1} />
            <Round size={40} variant={i + 1} />
          </div>
          <div style={{fontFamily: FONT_SERVICE, fontSize: 18, color: '#555A62'}}>так на YouTube: 98 и 40 точек</div>
        </div>
      ))}
    </AbsoluteFill>
  </Stage>
);

export const BANNER_SHEET = {width: 2560, height: 2160};
const K = 0.5;

export const BannerSheet: React.FC = () => (
  <Stage styleId={BRAND_STYLE}>
    <AbsoluteFill style={{backgroundColor: '#101114'}}>
      {BANNER_VARIANTS.map((name, i) => (
        <div key={name} style={{position: 'absolute', left: (i % 2) * 1280, top: Math.floor(i / 2) * 720, width: 1280, height: 720, overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: 0, top: 0, width: BW, height: BH, scale: K, transformOrigin: '0 0'}}>
            <BannerInner variant={i + 1} />
          </div>
          {/* полоса, которую видно на компьютере, и середина — на телефоне */}
          <div style={{position: 'absolute', left: 0, right: 0, top: S.top * K, height: S.height * K, borderTop: '2px dashed rgba(255,255,255,0.55)', borderBottom: '2px dashed rgba(255,255,255,0.55)'}} />
          <div style={{position: 'absolute', left: S.left * K, top: S.top * K, width: S.width * K, height: S.height * K, border: '3px solid rgba(120,220,140,0.85)'}} />
          <div style={{position: 'absolute', left: 14, top: 14}}>
            <Chip n={i + 1} text={name} />
          </div>
          <div style={{position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.9)'}} />
        </div>
      ))}
      <div style={{position: 'absolute', left: 1280, top: 1440, width: 1280, height: 720, padding: '70px 80px', fontFamily: FONT_SERVICE, color: '#F2F2F2'}}>
        <div style={{fontWeight: 800, fontSize: 54}}>Шапка канала</div>
        <div style={{marginTop: 24, fontSize: 30, lineHeight: 1.45, color: '#C9CED6'}}>
          Файл 2560×1440. YouTube показывает его по-разному:
          <br />— <b style={{color: '#8CE09C'}}>зелёная рамка</b> — видно везде, даже на телефоне;
          <br />— между <b>пунктирными линиями</b> — видно на компьютере (вся ширина);
          <br />— весь кадр целиком — только на телевизоре.
          <br />
          <br />Ответьте номером 1–5.
        </div>
      </div>
    </AbsoluteFill>
  </Stage>
);
