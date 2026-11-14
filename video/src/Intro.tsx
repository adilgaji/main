// Интро канала (после хука, около 6 с): название канала + озвучка одной фразой.
// Четыре варианта картинки; цвета и шрифты берутся из стиля видео, поэтому интро подходит к любому стилю.
// Время появления названия и остальных событий берётся из озвучки (слова со временем).
import {Audio} from '@remotion/media';
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, type CalculateMetadataFunction} from 'remotion';
import {Stage} from './Chapter';
import {Icon, type IconName} from './components/Icons';
import {ShotFrame} from './components/ShotFrame';
import {alpha, CLAMP, EASE, mix, ramp, rng} from './lib/anim';
import {textWidth} from './lib/labels';
import {FONT_SERVICE, FRAME, useStyle, type Palette} from './style';
import {toneColors} from './shots/SceneShot';

export type IntroVariant = 'book' | 'hearth' | 'museum' | 'ages';
export const INTRO_VARIANTS: {id: IntroVariant; nameRu: string}[] = [
  {id: 'book', nameRu: 'Старая книга'},
  {id: 'hearth', nameRu: 'У камина'},
  {id: 'museum', nameRu: 'Ночной музей'},
  {id: 'ages', nameRu: 'Сквозь века'},
];

export type IntroWord = {text: string; start: number; end: number};

export type IntroProps = {
  styleId?: string | null;
  variant: IntroVariant;
  /** Название канала, например «True Tales of the Past» */
  channel: string;
  /** Файл озвучки внутри public/ (null — без звука) */
  audio?: string | null;
  words?: IntroWord[];
  totalFrames?: number;
};

const W = FRAME.width;
const H = FRAME.height;
const TAIL = 0.7; // секунды после последнего слова

export const introFrames = (p: Pick<IntroProps, 'words' | 'totalFrames'>): number => {
  if (p.totalFrames) {
    return p.totalFrames;
  }
  const last = Math.max(4.6, ...(p.words ?? []).map((w) => w.end));
  return Math.ceil((last + TAIL) * FRAME.fps);
};

export const calculateIntroMetadata: CalculateMetadataFunction<IntroProps> = ({props}) => ({
  durationInFrames: introFrames(props),
  fps: FRAME.fps,
  width: W,
  height: H,
});

// ---------------------------------------------------------------- время событий из озвучки

const clean = (s: string): string => s.toLowerCase().replace(/[^a-z0-9']/g, '');

type Beats = {name: number; nameEnd: number; chair: number; story: number; end: number};

const beatsOf = (words: IntroWord[], channel: string, total: number): Beats => {
  const at = (w: string, fallback: number, edge: 'start' | 'end' = 'start'): number => {
    const found = words.find((x) => clean(x.text) === clean(w));
    return found ? found[edge] : fallback;
  };
  const parts = channel.split(/\s+/).filter(Boolean);
  const name = at(parts[0] ?? '', 0.85);
  const lastIdx = words.findIndex((x, i) => i > 0 && clean(x.text) === clean(parts[parts.length - 1] ?? '') && x.start >= name);
  const nameEnd = lastIdx >= 0 ? words[lastIdx].end : name + 1.4;
  const chair = at('chair', nameEnd + 0.6);
  return {name, nameEnd, chair, story: at('story', chair + 1.1), end: total};
};

// ---------------------------------------------------------------- название канала

/** «True Tales of the Past» → крупно «TRUE TALES», мельче «OF THE PAST». */
const splitName = (channel: string): [string, string] => {
  const m = channel.match(/^(.*?)\s+((?:of|from)\s+.*)$/i);
  return m ? [m[1], m[2]] : [channel, ''];
};

const Wordmark: React.FC<{channel: string; t: number; start: number; maxWidth: number; color: string; accent: string; size?: number; glow?: string}> = ({
  channel,
  t,
  start,
  maxWidth,
  color,
  accent,
  size = 150,
  glow,
}) => {
  const {fonts} = useStyle();
  const [big, small] = splitName(channel);
  const bigText = big.toUpperCase();
  const fit = Math.min(size, size * (maxWidth / Math.max(1, textWidth(bigText, fonts.display, size, 700) * 1.12)));
  const smallSize = Math.round(fit * 0.42);
  const letters = [...bigText];
  const dur = 0.9;
  const rule = ramp(t, start + 0.55, 0.6, EASE.out);
  const shadow = glow ? `0 0 ${Math.round(fit * 0.35)}px ${glow}, 0 4px 18px rgba(0,0,0,0.55)` : '0 4px 18px rgba(0,0,0,0.55)';
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{fontFamily: fonts.display, fontWeight: 700, fontSize: fit, lineHeight: 1, letterSpacing: '0.08em', color, whiteSpace: 'nowrap', textShadow: shadow}}>
        {letters.map((ch, i) => {
          const k = ramp(t, start + (i / Math.max(1, letters.length - 1)) * dur * 0.6, dur * 0.5, EASE.out);
          return (
            <span key={i} style={{display: 'inline-block', opacity: k, translate: `0px ${(1 - k) * fit * 0.25}px`, minWidth: ch === ' ' ? fit * 0.3 : undefined}}>
              {ch}
            </span>
          );
        })}
      </div>
      {small ? (
        <div style={{display: 'flex', alignItems: 'center', gap: smallSize * 0.6, marginTop: fit * 0.16}}>
          <div style={{width: fit * 1.3, height: 3, backgroundColor: accent, scale: `${rule} 1`, transformOrigin: '100% 50%'}} />
          <div
            style={{
              fontFamily: fonts.body,
              fontWeight: 700,
              fontSize: smallSize,
              letterSpacing: '0.32em',
              color: accent,
              whiteSpace: 'nowrap',
              opacity: ramp(t, start + 0.65, 0.5),
              textShadow: glow ? `0 0 ${smallSize}px ${glow}` : undefined,
            }}
          >
            {small.toUpperCase()}
          </div>
          <div style={{width: fit * 1.3, height: 3, backgroundColor: accent, scale: `${rule} 1`, transformOrigin: '0% 50%'}} />
        </div>
      ) : null}
    </div>
  );
};

const Center: React.FC<{x: number; y: number; children: React.ReactNode}> = ({x, y, children}) => (
  <div style={{position: 'absolute', left: x, top: y, translate: '-50% -50%'}}>{children}</div>
);

/** Медленный наезд камеры: одинаковый для картинки и текста, чтобы слои не разъехались. */
const Push: React.FC<{k: number; origin?: string; children: React.ReactNode}> = ({k, origin = '50% 55%', children}) => (
  <AbsoluteFill style={{scale: 1 + 0.06 * k, transformOrigin: origin}}>{children}</AbsoluteFill>
);

/** Пылинки / искры: детерминированные частицы. */
const Particles: React.FC<{t: number; n: number; seed: number; box: [number, number, number, number]; color: string; rise: number; size: number; opacity: number}> = ({
  t,
  n,
  seed,
  box,
  color,
  rise,
  size,
  opacity,
}) => {
  const r = rng(seed);
  const [x0, y0, x1, y1] = box;
  const items = Array.from({length: n}, () => ({x: r(), y: r(), s: 0.4 + r() * 0.8, ph: r() * 6.28, sp: 0.5 + r()}));
  return (
    <g>
      {items.map((p, i) => {
        const life = (p.y + t * p.sp * rise) % 1;
        const x = x0 + p.x * (x1 - x0) + Math.sin(t * 1.3 + p.ph) * 18;
        const y = y1 - life * (y1 - y0);
        const fade = Math.sin(life * Math.PI);
        return <circle key={i} cx={x} cy={y} r={size * p.s} fill={color} opacity={opacity * fade} />;
      })}
    </g>
  );
};

// ---------------------------------------------------------------- 1. Старая книга

const BookIntro: React.FC<{t: number; b: Beats; channel: string}> = ({t, b, channel}) => {
  const {palette: p} = useStyle();
  const open = ramp(t, 0.15, Math.max(0.5, b.name - 0.05), EASE.inOut);
  const push = ramp(t, 0, b.end, EASE.inOut);
  const flick = 0.82 + Math.sin(t * 13) * 0.07 + Math.sin(t * 7.7) * 0.05 + ramp(t, b.chair, 0.8) * 0.12;
  const pageW = 760;
  const pageH = 840;
  const cx = W / 2;
  const cy = 560;
  const slide = (1 - open) * (pageW / 2); // закрытая книга стоит по центру, открываясь — съезжает
  const leather = mix(p.bgAlt, p.accent2, 0.35);
  const picture = ramp(t, b.story - 0.2, 0.9);
  const art = (
    <Push k={push}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 60% 55% at 50% 52%, ${alpha(mix(p.bgAlt, p.accent, 0.35), flick)} 0%, ${p.bg} 75%)`}} />
      <AbsoluteFill style={{top: 860, background: `linear-gradient(180deg, ${alpha('#000000', 0)} 0%, ${alpha('#000000', 0.45)} 100%)`}} />
      <div style={{position: 'absolute', left: cx - pageW - slide, top: cy - pageH / 2, width: pageW * 2, height: pageH, perspective: 2600}}>
        {/* тень книги */}
        <div style={{position: 'absolute', left: pageW * (1 - open) - 10, right: -10, bottom: -34, height: 60, borderRadius: '50%', backgroundColor: alpha('#000000', 0.55), filter: 'blur(18px)'}} />
        {/* правая страница (под обложкой) */}
        <div style={{position: 'absolute', left: pageW, top: 0, width: pageW, height: pageH, background: `linear-gradient(90deg, ${p.paperShade} 0%, ${p.paper} 9%, ${p.paper} 92%, ${p.paperShade} 100%)`, borderRadius: '2px 10px 10px 2px', boxShadow: `inset 0 0 0 1px ${alpha(p.ink, 0.15)}, 6px 0 0 ${mix(p.paper, p.paperShade, 0.6)}, 11px 2px 0 ${p.paperShade}`}} />
        {/* обложка: спереди кожа, с обратной стороны — левая страница */}
        <div style={{position: 'absolute', left: pageW, top: 0, width: pageW, height: pageH, transformOrigin: '0% 50%', transformStyle: 'preserve-3d', rotate: `y ${-180 * open}deg`}}>
          <div
            style={{
              position: 'absolute',
              inset: -8,
              backfaceVisibility: 'hidden',
              borderRadius: '4px 14px 14px 4px',
              background: `linear-gradient(135deg, ${mix(leather, '#ffffff', 0.08)} 0%, ${leather} 45%, ${mix(leather, '#000000', 0.35)} 100%)`,
              boxShadow: `inset 0 0 0 18px ${mix(leather, '#000000', 0.2)}, inset 0 0 0 22px ${alpha(p.accent, 0.85)}, inset 0 0 0 26px ${mix(leather, '#000000', 0.2)}`,
            }}
          >
            <svg width={pageW + 16} height={pageH + 16} style={{position: 'absolute', inset: 0}}>
              <g transform={`translate(${(pageW + 16) / 2} ${(pageH + 16) / 2})`} fill="none" stroke={p.accent} strokeWidth={4} opacity={0.9}>
                <path d="M0 -150 L150 0 L0 150 L-150 0 Z" />
                <path d="M0 -100 L100 0 L0 100 L-100 0 Z" />
                <circle r={34} fill={p.accent} />
              </g>
            </svg>
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              rotate: 'y 180deg',
              borderRadius: '10px 2px 2px 10px',
              background: `linear-gradient(270deg, ${p.paperShade} 0%, ${p.paper} 9%, ${p.paper} 92%, ${p.paperShade} 100%)`,
              boxShadow: `inset 0 0 0 1px ${alpha(p.ink, 0.15)}`,
            }}
          >
            <svg width={pageW} height={pageH} style={{position: 'absolute', inset: 0, opacity: picture}}>
              <rect x={90} y={110} width={pageW - 180} height={pageH - 220} fill="none" stroke={alpha(p.ink, 0.55)} strokeWidth={3} />
              <Icon name="temple" x={pageW / 2} y={pageH - 190} size={300} colors={{main: alpha(p.ink, 0.12), shade: alpha(p.ink, 0.35), hi: alpha(p.ink, 0.7), line: alpha(p.ink, 0.8)}} />
            </svg>
          </div>
        </div>
      </div>
    </Push>
  );
  const text = (
    <Push k={push}>
      <Center x={cx + pageW / 2 + slide * 0} y={cy - 10}>
        <Wordmark channel={channel} t={t} start={b.name} maxWidth={pageW - 170} color={p.ink} accent={mix(p.accent, p.ink, 0.35)} size={120} />
      </Center>
    </Push>
  );
  return <ShotFrame frames={1} art={art} text={open > 0.98 || t > b.name ? text : null} />;
};

// ---------------------------------------------------------------- 2. У камина

const Armchair: React.FC<{p: Palette; x: number; y: number; s: number}> = ({p, x, y, s}) => {
  const body = mix(p.bg, '#000000', 0.35);
  const rim = alpha(p.accent, 0.7);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-170 -420 q0 -70 70 -80 h200 q70 10 70 80 v170 h-340 z" fill={body} stroke={rim} strokeWidth={5} />
      <path d="M-230 -260 q-30 0 -30 40 v160 h80 v-150 z M230 -260 q30 0 30 40 v160 h-80 v-150 z" fill={body} stroke={rim} strokeWidth={5} />
      <path d="M-200 -250 h400 q20 0 20 20 v120 h-440 v-120 q0 -20 20 -20 z" fill={body} stroke={rim} strokeWidth={5} />
      <path d="M-220 -110 h440 v40 h-440 z" fill={body} />
      <path d="M-200 -70 l-12 70 M200 -70 l12 70" stroke={body} strokeWidth={26} strokeLinecap="round" />
    </g>
  );
};

const HearthIntro: React.FC<{t: number; b: Beats; channel: string}> = ({t, b, channel}) => {
  const {palette: p} = useStyle();
  const push = ramp(t, 0, b.end, EASE.inOut);
  const pulse = 0.85 + Math.sin(t * 9) * 0.06 + Math.sin(t * 15.7) * 0.05;
  const chairIn = ramp(t, b.chair - 0.15, 0.9, EASE.out);
  const stone = mix(p.bg, p.light, 0.1);
  const stoneHi = mix(p.bg, p.light, 0.18);
  const fireC = {main: p.accent2, shade: mix(p.bg, '#000000', 0.4), hi: p.accent, line: mix(p.accent, '#ffffff', 0.4)};
  const art = (
    <Push k={push} origin="50% 70%">
      <AbsoluteFill style={{background: `radial-gradient(ellipse 55% 60% at 50% 82%, ${alpha(mix(p.accent2, p.accent, 0.5), 0.55 * pulse)} 0%, ${alpha(p.bgAlt, 0.6)} 45%, ${p.bg} 85%)`}} />
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        {/* камин */}
        <rect x={W / 2 - 560} y={460} width={1120} height={620} fill={stone} />
        <rect x={W / 2 - 620} y={420} width={1240} height={52} fill={stoneHi} />
        <rect x={W / 2 - 600} y={472} width={1200} height={16} fill={mix(stone, '#000000', 0.3)} />
        {Array.from({length: 7}, (_, i) => (
          <line key={i} x1={W / 2 - 560} x2={W / 2 + 560} y1={560 + i * 80} y2={560 + i * 80} stroke={mix(stone, '#000000', 0.25)} strokeWidth={3} />
        ))}
        <path d={`M${W / 2 - 340} 1080 V700 Q${W / 2} 520 ${W / 2 + 340} 700 V1080 Z`} fill={mix(p.bg, '#000000', 0.55)} />
        <ellipse cx={W / 2} cy={1010} rx={330} ry={90} fill={alpha(p.accent, 0.35 * pulse)} />
        <Icon name="fire" x={W / 2 - 120} y={1010} size={210} colors={fireC} t={t + 0.7} />
        <Icon name="fire" x={W / 2 + 120} y={1012} size={190} colors={fireC} t={t + 1.9} />
        <Icon name="fire" x={W / 2} y={1020} size={300} colors={fireC} t={t} />
        <Particles t={t} n={46} seed={7} box={[W / 2 - 300, 380, W / 2 + 300, 980]} color={mix(p.accent, '#ffffff', 0.3)} rise={0.35} size={4} opacity={0.9} />
        {/* кресло подъезжает на словах «Pull up a chair» */}
        <Armchair p={p} x={interpolate(chairIn, [0, 1], [-420, 170])} y={1120} s={0.85} />
        <Armchair p={p} x={interpolate(chairIn, [0, 1], [W + 420, W - 170])} y={1120} s={0.85} />
      </svg>
    </Push>
  );
  const text = (
    <Push k={push} origin="50% 70%">
      <Center x={W / 2} y={250}>
        <Wordmark channel={channel} t={t} start={b.name} maxWidth={1300} color={p.light} accent={p.accent} size={150} glow={alpha(p.accent, 0.45)} />
      </Center>
    </Push>
  );
  return <ShotFrame frames={1} art={art} text={text} />;
};

// ---------------------------------------------------------------- 3. Ночной музей

const EXHIBITS: {x: number; icon: IconName; size: number}[] = [
  {x: 230, icon: 'amphora', size: 230},
  {x: 560, icon: 'helmet', size: 170},
  {x: 1360, icon: 'crown', size: 150},
  {x: 1690, icon: 'scroll', size: 150},
];

const MuseumIntro: React.FC<{t: number; b: Beats; channel: string}> = ({t, b, channel}) => {
  const {palette: p} = useStyle();
  const push = ramp(t, 0, b.end, EASE.inOut);
  // луч прожектора проходит по залу и останавливается на табличке, когда звучит название
  const sweep = interpolate(t, [0, b.name - 0.1, b.name + 0.5], [80, 1840, W / 2], {...CLAMP, easing: EASE.inOut});
  const wide = ramp(t, b.name, 0.8);
  const beamW = 230 + 260 * wide;
  const floorY = 860;
  const lit = (x: number): number => Math.exp(-(((x - sweep) / (beamW * 0.9)) ** 2)) * (1 - wide * 0.55) + ramp(t, b.chair, 1.2) * 0.35;
  const art = (
    <Push k={push}>
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${mix(p.bg, p.bgAlt, 0.6)} 0%, ${p.bg} 70%)`}} />
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <rect x={0} y={floorY} width={W} height={H - floorY} fill={mix(p.bg, '#000000', 0.3)} />
        {Array.from({length: 9}, (_, i) => (
          <rect key={i} x={i * 240 - 20} y={120} width={36} height={floorY - 120} fill={alpha(mix(p.bgAlt, p.light, 0.05), 0.5)} />
        ))}
        <defs>
          <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.light} stopOpacity={0.05} />
            <stop offset="1" stopColor={p.light} stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <path d={`M${sweep - 40} -20 L${sweep + 40} -20 L${sweep + beamW} ${floorY + 40} L${sweep - beamW} ${floorY + 40} Z`} fill="url(#beam)" />
        <ellipse cx={sweep} cy={floorY + 40} rx={beamW * 1.05} ry={60} fill={alpha(p.light, 0.22)} />
        <Particles t={t} n={60} seed={11} box={[sweep - beamW * 0.8, 40, sweep + beamW * 0.8, floorY]} color={p.light} rise={0.06} size={2.6} opacity={0.7} />
        {EXHIBITS.map((e) => {
          const k = Math.min(1, lit(e.x));
          const c = {main: mix(mix(p.bg, '#000000', 0.2), p.lightSoft, k * 0.8), shade: mix(p.bg, '#000000', 0.4), hi: mix(p.bgAlt, p.accent, 0.3 + k * 0.7), line: mix(p.bgAlt, p.light, 0.2 + k * 0.6)};
          return (
            <g key={e.x}>
              <rect x={e.x - 120} y={floorY - 250} width={240} height={250 + 30} fill={mix(mix(p.bg, p.light, 0.08), p.light, k * 0.18)} />
              <rect x={e.x - 135} y={floorY - 270} width={270} height={24} fill={mix(mix(p.bg, p.light, 0.12), p.light, k * 0.22)} />
              <Icon name={e.icon} x={e.x} y={floorY - 270} size={e.size} colors={c} t={t} />
            </g>
          );
        })}
        {/* табличка в центре */}
        <rect x={W / 2 - 560} y={250} width={1120} height={430} rx={8} fill={mix(p.bg, '#000000', 0.25)} stroke={mix(p.bgAlt, p.accent, 0.4 + wide * 0.6)} strokeWidth={8} />
        <rect x={W / 2 - 530} y={280} width={1060} height={370} rx={4} fill="none" stroke={alpha(p.accent, 0.25 + wide * 0.5)} strokeWidth={2} />
        <rect x={W / 2 - 60} y={680} width={120} height={floorY - 680} fill={mix(p.bg, p.light, 0.08)} />
      </svg>
    </Push>
  );
  const text = (
    <Push k={push}>
      <Center x={W / 2} y={465}>
        <Wordmark channel={channel} t={t} start={b.name + 0.2} maxWidth={940} color={p.light} accent={p.accent} size={140} glow={alpha(p.accent, 0.3)} />
      </Center>
    </Push>
  );
  return <ShotFrame frames={1} art={art} text={text} />;
};

// ---------------------------------------------------------------- 4. Сквозь века

const ERAS: {label: string; icon: IconName; size: number}[] = [
  {label: '3000 BC', icon: 'pyramid', size: 230},
  {label: '500 BC', icon: 'temple', size: 230},
  {label: 'AD 1', icon: 'helmet', size: 200},
  {label: 'AD 1000', icon: 'wall', size: 170},
  {label: 'AD 1500', icon: 'ship', size: 230},
  {label: 'AD 1800', icon: 'crown', size: 170},
];
const ERA_GAP = 620;

const AgesIntro: React.FC<{t: number; b: Beats; channel: string}> = ({t, b, channel}) => {
  const {palette: p, fonts} = useStyle();
  const fly = interpolate(t, [0.1, b.nameEnd + 0.6], [0, 1], {...CLAMP, easing: EASE.inOut});
  const offset = W / 2 - fly * ERA_GAP * (ERAS.length - 1);
  const settle = ramp(t, b.name, 0.8);
  const lineY = 840 + settle * 70;
  const dim = 1 - settle * 0.45;
  const art = (
    <AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 70% 70% at 50% 40%, ${mix(p.bgAlt, p.accent, 0.12)} 0%, ${p.bg} 80%)`}} />
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <line x1={0} x2={W} y1={lineY} y2={lineY} stroke={p.accent} strokeWidth={6} opacity={0.9} />
        {Array.from({length: 60}, (_, i) => {
          const x = ((offset + i * (ERA_GAP / 4)) % (W + ERA_GAP)) - ERA_GAP / 2;
          return <line key={i} x1={x} x2={x} y1={lineY - (i % 4 === 0 ? 22 : 10)} y2={lineY + (i % 4 === 0 ? 22 : 10)} stroke={p.accent} strokeWidth={3} opacity={0.6} />;
        })}
        {ERAS.map((e, i) => {
          const x = offset + i * ERA_GAP;
          const near = Math.max(0, 1 - Math.abs(x - W / 2) / 900);
          return (
            <g key={e.label} opacity={(0.35 + 0.65 * near) * dim}>
              <Icon name={e.icon} x={x} y={lineY - 90} size={e.size * (1 + 0.25 * near)} colors={toneColors(p, near > 0.6 ? 'accent' : 'dark')} t={t} />
              <circle cx={x} cy={lineY} r={14} fill={p.accent} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
  const text = (
    <AbsoluteFill>
      {ERAS.map((e, i) => {
        const x = offset + i * ERA_GAP;
        const near = Math.max(0, 1 - Math.abs(x - W / 2) / 900);
        if (x < -200 || x > W + 200) {
          return null;
        }
        return (
          <div key={e.label} data-moving="1" style={{position: 'absolute', left: x, top: lineY + 34, translate: '-50% 0', fontFamily: fonts.body, fontWeight: 800, fontSize: 44, letterSpacing: '0.08em', color: p.light, opacity: (0.4 + 0.6 * near) * dim, whiteSpace: 'nowrap'}}>
            {e.label}
          </div>
        );
      })}
      <Center x={W / 2} y={380}>
        <Wordmark channel={channel} t={t} start={b.name} maxWidth={1400} color={p.light} accent={p.accent} size={160} glow={alpha(p.accent, 0.35)} />
      </Center>
    </AbsoluteFill>
  );
  return <ShotFrame frames={1} art={art} text={text} />;
};

// ---------------------------------------------------------------- сборка

const VIEWS: Record<IntroVariant, React.FC<{t: number; b: Beats; channel: string}>> = {
  book: BookIntro,
  hearth: HearthIntro,
  museum: MuseumIntro,
  ages: AgesIntro,
};

const IntroBody: React.FC<IntroProps & {frames: number}> = ({variant, channel, words = [], frames}) => {
  const frame = useCurrentFrame();
  const t = frame / FRAME.fps;
  const total = frames / FRAME.fps;
  const b = beatsOf(words, channel, total);
  const View = VIEWS[variant] ?? BookIntro;
  // появление из фона и уход в фон (как у начала и конца главы)
  const opacity = interpolate(frame, [0, 8, frames - 12, frames], [0, 1, 1, 0], CLAMP);
  return (
    <AbsoluteFill style={{opacity}}>
      <View t={t} b={b} channel={channel} />
    </AbsoluteFill>
  );
};

export const Intro: React.FC<IntroProps> = (props) => {
  const frames = introFrames(props);
  return (
    <Stage styleId={props.styleId}>
      <IntroBody {...props} frames={frames} />
      {props.audio ? <Audio src={staticFile(props.audio)} /> : null}
    </Stage>
  );
};

// ---------------------------------------------------------------- лист вариантов для владельца

const SHEET_TIMES = [0.6, 2.4, 4.6];
export const INTRO_SHEET = {width: 1920, height: 1440};

export const IntroSheet: React.FC<{styleId?: string | null; channel: string; words?: IntroWord[]}> = ({styleId, channel, words = []}) => {
  const frames = introFrames({words});
  return (
    <Stage styleId={styleId}>
      <AbsoluteFill style={{backgroundColor: '#101114'}}>
        {INTRO_VARIANTS.map((v, row) =>
          SHEET_TIMES.map((sec, col) => (
            <div key={`${v.id}-${col}`} style={{position: 'absolute', left: col * 640, top: row * 360, width: 640, height: 360, overflow: 'hidden'}}>
              <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', scale: 1 / 3}}>
                <Sequence from={-Math.round(sec * FRAME.fps)}>
                  <IntroBody variant={v.id} channel={channel} words={words} frames={frames} />
                </Sequence>
              </div>
              <div style={{position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.9)'}} />
              {col === 0 ? (
                <div style={{position: 'absolute', left: 8, top: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 5px 5px', borderRadius: 24, backgroundColor: 'rgba(8,10,14,0.88)', fontFamily: FONT_SERVICE}}>
                  <div style={{width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', color: '#0A0C10', fontWeight: 800, fontSize: 19, lineHeight: '30px', textAlign: 'center'}}>{row + 1}</div>
                  <div style={{color: '#FFFFFF', fontWeight: 700, fontSize: 17}}>{v.nameRu}</div>
                </div>
              ) : null}
              <div style={{position: 'absolute', right: 8, bottom: 8, padding: '2px 8px', borderRadius: 8, backgroundColor: 'rgba(8,10,14,0.8)', color: '#FFFFFF', fontFamily: FONT_SERVICE, fontSize: 14}}>{sec.toFixed(1)} с</div>
            </div>
          )),
        )}
      </AbsoluteFill>
    </Stage>
  );
};
