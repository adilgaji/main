// Кадр «Тогда / сейчас» (или любое сравнение двух вещей): две половины кадра.
// В каждой половине — архивное изображение или фон с крупным значком; поверх — метка,
// заголовок и до трёх коротких строк. Правая половина открывается чуть позже левой.
import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop, type BackdropKind} from '../components/Backdrop';
import {Icon, ICON_WIDTH, type IconName} from '../components/Icons';
import {ShotFrame} from '../components/ShotFrame';
import {Appear} from '../components/TextBits';
import {alpha, CLAMP, EASE, ramp} from '../lib/anim';
import {LABEL_AREA} from '../lib/labels';
import {FRAME, SAFE, useStyle} from '../style';
import {toneColors, type Tone} from './SceneShot';

export type CompareSide = {
  /** Метка половины: «THEN · 480 BC», «NOW» */
  label: string;
  heading?: string;
  lines?: string[];
  /** Картинка на всю половину (только public domain / CC0) */
  src?: string;
  width?: number;
  height?: number;
  /** Точка картинки, которая должна остаться в кадре (доли 0…1) */
  focus?: {x: number; y: number};
  /** Приближение картинки (1 = половина кадра закрыта целиком) */
  zoom?: number;
  credit?: string;
  /** Если картинки нет: крупный значок на фоне */
  icon?: IconName;
  tone?: Tone;
  backdrop?: BackdropKind;
};

export type CompareShotProps = {
  frames: number;
  left: CompareSide;
  right: CompareSide;
  /** Когда открывается правая половина, секунды */
  revealAt?: number;
  seed?: number;
};

const W = FRAME.width;
const H = FRAME.height;
const HALF = W / 2;
const GUTTER = 44;

const resolveSrc = (src: string): string => (/^(https?:|file:|data:|\/)/.test(src) ? src : staticFile(src));

const SideArt: React.FC<{side: CompareSide; frames: number; seed: number; fallback: BackdropKind}> = ({side, frames, seed, fallback}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {palette: p} = useStyle();
  if (side.src && side.width && side.height) {
    const z0 = side.zoom ?? 1;
    const zoom = interpolate(frame, [0, frames], [z0, z0 * 1.1], {...CLAMP, easing: EASE.inOut});
    const base = Math.max(HALF / side.width, H / side.height);
    const w = side.width * base * zoom;
    const h = side.height * base * zoom;
    const f = side.focus ?? {x: 0.5, y: 0.5};
    const left = Math.min(0, Math.max(HALF - w, HALF / 2 - f.x * w));
    const top = Math.min(0, Math.max(H - h, H / 2 - f.y * h));
    return (
      <AbsoluteFill style={{backgroundColor: '#000'}}>
        <Img src={resolveSrc(side.src)} style={{position: 'absolute', left, top, width: w, height: h, maxWidth: 'none'}} />
        <AbsoluteFill style={{background: `linear-gradient(180deg, ${alpha(p.bg, 0.45)} 0%, ${alpha(p.bg, 0)} 26%, ${alpha(p.bg, 0)} 46%, ${alpha(p.bg, 0.82)} 76%)`}} />
      </AbsoluteFill>
    );
  }
  const icon = side.icon ?? 'scroll';
  const size = Math.min(350, (HALF - 260) / ((ICON_WIDTH[icon] ?? 100) / 100));
  const k = ramp(frame, 6, 22, EASE.out);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H}}>
        <Backdrop kind={side.backdrop ?? fallback} seed={seed} />
      </div>
      <svg width={HALF} height={H} style={{position: 'absolute', inset: 0}}>
        <ellipse cx={HALF / 2} cy={552} rx={240} ry={26} fill={alpha('#000000', 0.28)} />
        <Icon name={icon} x={HALF / 2} y={545 + (1 - k) * 40} size={size} colors={toneColors(p, side.tone ?? 'paper')} opacity={k} t={frame / fps} />
      </svg>
    </AbsoluteFill>
  );
};

const CompareArt: React.FC<CompareShotProps> = ({frames, left, right, revealAt = 1.1, seed = 1}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {palette: p} = useStyle();
  const open = ramp(frame, revealAt * fps, 0.7 * fps, EASE.inOut);
  const bar = ramp(frame, 0.3 * fps, 0.6 * fps, EASE.out);
  return (
    <AbsoluteFill style={{backgroundColor: p.bg}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: HALF, height: H, overflow: 'hidden'}}>
        <SideArt side={left} frames={frames} seed={seed} fallback="stone" />
      </div>
      <div style={{position: 'absolute', left: HALF, top: 0, width: HALF * open, height: H, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: HALF, height: H}}>
          <SideArt side={right} frames={frames} seed={seed + 11} fallback="dusk" />
        </div>
      </div>
      <div style={{position: 'absolute', left: HALF - 4, top: (H * (1 - bar)) / 2, width: 8, height: H * bar, backgroundColor: p.accent}} />
    </AbsoluteFill>
  );
};

const SideText: React.FC<{side: CompareSide; x: number; delay: number}> = ({side, x, delay}) => {
  const {palette: p, fonts, radius} = useStyle();
  const width = HALF - SAFE.left - GUTTER;
  const bottom = H - LABEL_AREA.bottom + (side.credit ? 52 : 0);
  return (
    <>
      <Appear delay={delay} rise={14} style={{position: 'absolute', left: x, top: SAFE.top}}>
        <div style={{display: 'inline-block', padding: '8px 22px 10px', borderRadius: radius, backgroundColor: p.accent, color: p.ink, fontFamily: fonts.body, fontWeight: 800, fontSize: 34, letterSpacing: 3}}>
          {side.label}
        </div>
      </Appear>
      {side.heading || side.lines?.length ? (
        <Appear delay={delay + 0.35} style={{position: 'absolute', left: x, bottom, width, padding: '18px 26px 22px', borderRadius: radius, backgroundColor: alpha(p.bg, 0.86), borderLeft: `8px solid ${p.accent}`}}>
          {side.heading ? <div style={{fontFamily: fonts.display, fontWeight: 800, fontSize: 58, lineHeight: 1.08, color: p.light}}>{side.heading}</div> : null}
          {(side.lines ?? []).slice(0, 3).map((line) => (
            <div key={line} style={{marginTop: 8, fontFamily: fonts.body, fontWeight: 600, fontSize: 36, lineHeight: 1.2, color: alpha(p.light, 0.9)}}>
              {line}
            </div>
          ))}
        </Appear>
      ) : null}
      {side.credit ? (
        <Appear delay={delay + 0.6} rise={0} style={{position: 'absolute', left: x, top: 742, maxWidth: width, padding: '4px 12px 6px', borderRadius: radius, backgroundColor: alpha(p.bg, 0.72), fontFamily: fonts.body, fontWeight: 600, fontSize: 24, color: alpha(p.light, 0.92), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
          {side.credit}
        </Appear>
      ) : null}
    </>
  );
};

const CompareText: React.FC<CompareShotProps> = ({left, right, revealAt = 1.1}) => (
  <AbsoluteFill>
    <SideText side={left} x={SAFE.left} delay={0.3} />
    <SideText side={right} x={HALF + GUTTER} delay={revealAt + 0.4} />
  </AbsoluteFill>
);

export const CompareShot: React.FC<CompareShotProps> = (props) => (
  <ShotFrame frames={props.frames} drift={null} art={<CompareArt {...props} />} text={<CompareText {...props} />} />
);
