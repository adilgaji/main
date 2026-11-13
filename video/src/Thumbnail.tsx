// Обложка 1280x720: крупное изображение (или фон со значком) и короткий текст в 2–4 слова.
// Текст подбирается по размеру сам: самый крупный шрифт, при котором он помещается в 3 строки.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Stage} from './Chapter';
import {Backdrop} from './components/Backdrop';
import {Icon, ICON_WIDTH, type IconName} from './components/Icons';
import {alpha, mix} from './lib/anim';
import {CanvasContext, HORIZONTAL, type Canvas} from './lib/canvas';
import {textWidth} from './lib/labels';
import {useStyle} from './style';
import {toneColors} from './shots/SceneShot';

export const THUMB = {width: 1280, height: 720};

export type ThumbnailProps = {
  styleId?: string | null;
  /** Главный текст: 2–4 слова */
  text: string;
  /** Маленькая строка над текстом (год, место) */
  kicker?: string;
  image?: {src: string; width: number; height: number; focus?: {x: number; y: number}; zoom?: number} | null;
  /** Если картинки нет — крупный значок на фоне */
  icon?: IconName;
  /** С какой стороны текст */
  side?: 'left' | 'right';
  seed?: number;
};

const CANVAS: Canvas = {...HORIZONTAL, width: THUMB.width, height: THUMB.height, safe: {left: 56, right: 56, top: 48, bottom: 48}, area: {left: 56, right: 1224, top: 48, bottom: 672}};

const fitText = (text: string, family: string, maxW: number): {size: number; lines: string[]} => {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  for (const size of [168, 150, 136, 124, 112, 100, 90, 80, 72]) {
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && textWidth(next, family, size, 900) > maxW) {
        lines.push(cur);
        cur = w;
      } else {
        cur = next;
      }
    }
    lines.push(cur);
    if (lines.length <= 3 && lines.every((l) => textWidth(l, family, size, 900) <= maxW)) {
      return {size, lines};
    }
  }
  return {size: 72, lines: [words.join(' ')]};
};

const resolveSrc = (src: string): string => (/^(https?:|file:|data:|\/)/.test(src) ? src : staticFile(src));

const Inner: React.FC<ThumbnailProps> = ({text, kicker, image, icon = 'helmet', side = 'left', seed = 1}) => {
  const {palette: p, fonts, treatment} = useStyle();
  const {width: W, height: H} = THUMB;
  const textW = 640;
  const fit = fitText(text, fonts.display, textW);
  const left = side === 'left';
  let art: React.ReactNode;
  if (image) {
    const z = image.zoom ?? 1;
    const base = Math.max(W / image.width, H / image.height) * z;
    const w = image.width * base;
    const h = image.height * base;
    const f = image.focus ?? {x: 0.5, y: 0.45};
    // точка внимания — в середине свободной от текста половины
    const cx = left ? W * 0.72 : W * 0.28;
    const x = Math.min(0, Math.max(W - w, cx - f.x * w));
    const y = Math.min(0, Math.max(H - h, H / 2 - f.y * h));
    art = <Img src={resolveSrc(image.src)} style={{position: 'absolute', left: x, top: y, width: w, height: h, maxWidth: 'none', filter: treatment.filter}} />;
  } else {
    const size = Math.min(560, 520 / ((ICON_WIDTH[icon] ?? 100) / 100));
    art = (
      <>
        <Backdrop kind="dusk" seed={seed} />
        <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
          <Icon name={icon} x={left ? W * 0.74 : W * 0.26} y={H - 40} size={size} colors={toneColors(p, 'accent')} />
        </svg>
      </>
    );
  }
  const shade = left
    ? `linear-gradient(90deg, ${alpha(p.bg, 0.94)} 0%, ${alpha(p.bg, 0.8)} 42%, ${alpha(p.bg, 0)} 68%)`
    : `linear-gradient(270deg, ${alpha(p.bg, 0.94)} 0%, ${alpha(p.bg, 0.8)} 42%, ${alpha(p.bg, 0)} 68%)`;
  return (
    <AbsoluteFill style={{backgroundColor: p.bg, overflow: 'hidden'}}>
      {art}
      <AbsoluteFill style={{background: shade}} />
      <AbsoluteFill style={{boxShadow: `inset 0 0 0 10px ${p.accent}`}} />
      <div style={{position: 'absolute', top: 0, bottom: 0, [left ? 'left' : 'right']: 70, width: textW, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        {kicker ? (
          <div style={{alignSelf: 'flex-start', marginBottom: 18, padding: '6px 18px 8px', backgroundColor: p.accent, color: p.ink, fontFamily: fonts.body, fontWeight: 800, fontSize: 38, letterSpacing: 3}}>{kicker.toUpperCase()}</div>
        ) : null}
        {fit.lines.map((line) => (
          <div key={line} style={{fontFamily: fonts.display, fontWeight: 900, fontSize: fit.size, lineHeight: 0.98, color: p.light, whiteSpace: 'nowrap', textShadow: `0 6px 28px ${alpha('#000000', 0.75)}, 0 0 2px ${mix(p.bg, '#000000', 0.5)}`}}>
            {line}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const Thumbnail: React.FC<ThumbnailProps> = (props) => (
  <CanvasContext.Provider value={CANVAS}>
    <Stage styleId={props.styleId}>
      <Inner {...props} />
    </Stage>
  </CanvasContext.Provider>
);
