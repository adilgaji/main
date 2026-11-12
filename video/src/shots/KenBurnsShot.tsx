// Кадр «Архивное изображение»: медленное движение камеры по картинке (Ken Burns),
// подпись и строка источника. Картинки — только public domain / CC0.
import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {ShotFrame} from '../components/ShotFrame';
import {Appear} from '../components/TextBits';
import {alpha, CLAMP, EASE} from '../lib/anim';
import {FRAME, SAFE, useStyle} from '../style';

/** Куда смотрит камера: точка картинки (доли 0…1) и увеличение (1 = картинка заполняет кадр). */
export type Focus = {x: number; y: number; zoom: number};

export type KenBurnsShotProps = {
  frames: number;
  /** Путь внутри public/ или полный адрес файла */
  src: string;
  /** Размер картинки в пикселях */
  width: number;
  height: number;
  from?: Focus;
  to?: Focus;
  title?: string;
  caption?: string;
  /** Источник и лицензия — показываются мелко */
  credit?: string;
};

const W = FRAME.width;
const H = FRAME.height;

const resolveSrc = (src: string): string => (/^(https?:|file:|data:|\/)/.test(src) ? src : staticFile(src));

const KenBurnsArt: React.FC<KenBurnsShotProps> = ({frames, src, width, height, from, to}) => {
  const frame = useCurrentFrame();
  const a = from ?? {x: 0.5, y: 0.5, zoom: 1.0};
  const b = to ?? {x: 0.5, y: 0.45, zoom: 1.18};
  const t = interpolate(frame, [0, frames], [0, 1], {...CLAMP, easing: EASE.inOut});
  const zoom = Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * t);
  const fx = a.x + (b.x - a.x) * t;
  const fy = a.y + (b.y - a.y) * t;
  // Базовый размер: картинка целиком закрывает кадр.
  const base = Math.max(W / width, H / height);
  const w = width * base;
  const h = height * base;
  // Точка внимания — в центре кадра; но пустых краёв быть не должно.
  const left = Math.min(0, Math.max(W - w * zoom, W / 2 - fx * w * zoom));
  const top = Math.min(0, Math.max(H - h * zoom, H / 2 - fy * h * zoom));
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <Img
        src={resolveSrc(src)}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: h,
          maxWidth: 'none',
          transformOrigin: '0 0',
          translate: `${left}px ${top}px`,
          scale: zoom,
        }}
      />
    </AbsoluteFill>
  );
};

const KenBurnsText: React.FC<KenBurnsShotProps> = ({title, caption, credit}) => {
  const {palette: p, fonts, radius} = useStyle();
  return (
    <AbsoluteFill>
      {title || caption ? (
        <Appear
          delay={0.4}
          style={{
            position: 'absolute',
            left: SAFE.left,
            top: SAFE.top,
            maxWidth: 980,
            padding: '20px 30px 24px',
            borderRadius: radius,
            backgroundColor: alpha(p.bg, 0.84),
            borderLeft: `8px solid ${p.accent}`,
          }}
        >
          {title ? <div style={{fontFamily: fonts.display, fontWeight: 800, fontSize: 60, lineHeight: 1.1, color: p.light}}>{title}</div> : null}
          {caption ? <div style={{marginTop: 10, fontFamily: fonts.body, fontWeight: 600, fontSize: 38, lineHeight: 1.2, color: alpha(p.light, 0.88)}}>{caption}</div> : null}
        </Appear>
      ) : null}
      {credit ? (
        <Appear
          delay={0.8}
          rise={0}
          style={{
            position: 'absolute',
            left: SAFE.left,
            top: 730,
            padding: '8px 18px 10px',
            borderRadius: radius,
            backgroundColor: alpha(p.bg, 0.72),
            fontFamily: fonts.body,
            fontWeight: 600,
            fontSize: 30,
            color: alpha(p.light, 0.92),
          }}
        >
          {credit}
        </Appear>
      ) : null}
    </AbsoluteFill>
  );
};

export const KenBurnsShot: React.FC<KenBurnsShotProps> = (props) => (
  <ShotFrame frames={props.frames} drift={null} art={<KenBurnsArt {...props} />} text={<KenBurnsText {...props} />} />
);
