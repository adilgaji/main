/**
 * Слой стиля: одна и та же сцена (фон / схема / гид / надписи) рисуется в выбранном стиле.
 * Обработка — только кодом: SVG-фильтры, наложения, палитра (themes.ts), фон-«мир» (Backdrops.tsx).
 *
 * Слоты: bg — фон (по умолчанию — мир стиля), fg — схема (органы, клетки), actor — гид,
 * ui — заголовок и подписи (всегда чёткие, без искажений).
 */
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {COLORS, VIDEO} from '../style';
import {StyleId, THEMES, applyTheme, normalizeStyle} from './themes';

let W: number = VIDEO.width;
let H: number = VIDEO.height;
/**
 * «Сцена»: шаблоны кадров спроектированы в координатах 1080x1920. В горизонтальном видео
 * сцена (схема, гид, надписи) вписывается в левую часть широкого кадра, а фон — на весь кадр.
 */
let STAGE: null | {x: number; y: number; scale: number} = null;
export const setFrame = (w: number, h: number, stage: null | {x: number; y: number; scale: number} = null) => {
  W = w;
  H = h;
  STAGE = stage;
};
const Stage: React.FC<{children: React.ReactNode}> = ({children}) =>
  STAGE ? (
    <AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(${STAGE.x}px, ${STAGE.y}px) scale(${STAGE.scale})`, width: VIDEO.width, height: VIDEO.height}}>
      {children}
    </AbsoluteFill>
  ) : (
    <>{children}</>
  );

/** Шумовая текстура для фильтров (готовая картинка — быстро; feTurbulence в каждом кадре — очень медленно). */
const NOISE = staticFile('textures/noise.png');
const GRAIN = staticFile('textures/grain.png');
const MOSAIC_TILE = 22;

/* ------------------------------- фильтры ------------------------------- */
const Outline: React.FC<{id: string; r: number; color: string}> = ({id, r, color}) => (
  <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
    <feMorphology in="SourceAlpha" operator="dilate" radius={r} result="d" />
    <feFlood floodColor={color} />
    <feComposite in2="d" operator="in" result="o" />
    <feMerge>
      <feMergeNode in="o" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);
const Wobble: React.FC<{id: string; scale: number; blur?: number}> = ({id, scale, blur = 0}) => (
  <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
    <feImage href={NOISE} x={0} y={0} width={W} height={H} preserveAspectRatio="none" result="n" />
    <feDisplacementMap in="SourceGraphic" in2="n" scale={scale} xChannelSelector="R" yChannelSelector="G" result="d" />
    {blur > 0 ? <feGaussianBlur in="d" stdDeviation={blur} /> : <feMerge><feMergeNode in="d" /></feMerge>}
  </filter>
);

export const Filters: React.FC<{style: StyleId}> = ({style}) => (
  <svg width={0} height={0} style={{position: 'absolute'}}>
    <defs>
      {style === 'watercolour' && (
        <filter id="st-wc" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feImage href={NOISE} x={0} y={0} width={W} height={H} preserveAspectRatio="none" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={24} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation={1.6} result="b" />
          <feImage href={GRAIN} x={0} y={0} width={W} height={H} preserveAspectRatio="none" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.9 0 0 0 1.35" result="ga" />
          <feComposite in="b" in2="ga" operator="in" result="g" />
          <feMorphology in="b" operator="erode" radius={3} result="inner" />
          <feComposite in="b" in2="inner" operator="out" result="edge" />
          <feColorMatrix in="edge" type="matrix" values="0.6 0 0 0 0  0 0.6 0 0 0  0 0 0.6 0 0  0 0 0 0.5 0" result="edgeDark" />
          <feMerge>
            <feMergeNode in="g" />
            <feMergeNode in="edgeDark" />
          </feMerge>
        </filter>
      )}
      {style === 'mosaic' && (
        <filter id="st-mos" x="0" y="0" width="100%" height="100%">
          <feFlood x={MOSAIC_TILE / 2 - 1} y={MOSAIC_TILE / 2 - 1} width={2} height={2} />
          <feComposite width={MOSAIC_TILE} height={MOSAIC_TILE} />
          <feTile result="a" />
          <feComposite in="SourceGraphic" in2="a" operator="in" />
          <feMorphology operator="dilate" radius={MOSAIC_TILE / 2} />
        </filter>
      )}
      {style === 'sumie' && <Wobble id="st-ink" scale={12} blur={0.5} />}
      {style === 'impasto' && (
        <filter id="st-oil" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage href={NOISE} x={0} y={0} width={W} height={H} preserveAspectRatio="none" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={26} xChannelSelector="R" yChannelSelector="G" result="paint" />
          <feImage href={GRAIN} x={0} y={0} width={W} height={H} preserveAspectRatio="none" result="g" />
          <feGaussianBlur in="g" stdDeviation="0.6 2.4" result="strokes" />
          <feDiffuseLighting in="strokes" surfaceScale={4} diffuseConstant={1.1} lightingColor="#ffffff" result="light">
            <feDistantLight azimuth={225} elevation={40} />
          </feDiffuseLighting>
          <feBlend in="paint" in2="light" mode="multiply" result="m" />
          <feComposite in="m" in2="paint" operator="in" result="mi" />
          <feComponentTransfer in="mi">
            <feFuncR type="linear" slope={1.3} />
            <feFuncG type="linear" slope={1.3} />
            <feFuncB type="linear" slope={1.3} />
          </feComponentTransfer>
        </filter>
      )}
      {style === 'gouache' && <Wobble id="st-gch" scale={6} />}
      {style === 'botanical' && (
        <filter id="st-bot" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="0.62 0.3 0.08 0 0.04  0.22 0.68 0.1 0 0.03  0.18 0.28 0.5 0 0.04  0 0 0 0.88 0" result="tint" />
          <feMorphology in="SourceAlpha" operator="dilate" radius={2} result="d" />
          <feFlood floodColor="#2F2A22" />
          <feComposite in2="d" operator="in" result="o" />
          <feMerge>
            <feMergeNode in="o" />
            <feMergeNode in="tint" />
          </feMerge>
        </filter>
      )}
      {style === 'nouveau' && <Outline id="st-nouv" r={4} color="#3B2F2A" />}
      {style === 'golden' && (
        <filter id="st-warm" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1.08 0.06 0 0 0.02  0.02 0.98 0 0 0  0 0 0.85 0 0  0 0 0 1 0" />
        </filter>
      )}
      {style === 'anime' && <Outline id="st-cel" r={3} color="#2A3A5A" />}
      {style === 'comic' && <Outline id="st-ink6" r={6} color="#111111" />}
      {style === 'notebook' && <Wobble id="st-pen" scale={5} />}
      {style === 'riso' && (
        <filter id="st-riso-blue" colorInterpolationFilters="sRGB">
          <feFlood floodColor="#0078BF" />
          <feComposite in2="SourceAlpha" operator="in" />
        </filter>
      )}
      {style === 'glossy' && (
        <filter id="st-gloss" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feImage href={NOISE} x={0} y={0} width={W} height={H} preserveAspectRatio="none" result="noise" />
          <feGaussianBlur in="SourceAlpha" stdDeviation={9} result="blurA" />
          <feComposite in="noise" in2="blurA" operator="arithmetic" k2={0.05} k3={1} result="height" />
          <feDiffuseLighting in="height" surfaceScale={9} diffuseConstant={1.1} lightingColor="#ffffff" result="diff">
            <feDistantLight azimuth={225} elevation={55} />
          </feDiffuseLighting>
          <feSpecularLighting in="height" surfaceScale={9} specularConstant={0.9} specularExponent={30} lightingColor="#ffffff" result="spec">
            <feDistantLight azimuth={225} elevation={60} />
          </feSpecularLighting>
          <feComposite in="SourceGraphic" in2="diff" operator="arithmetic" k1={0.92} result="lit" />
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
          <feComposite in="lit" in2="specIn" operator="arithmetic" k2={1} k3={0.45} result="out" />
          <feComposite in="out" in2="SourceAlpha" operator="in" />
        </filter>
      )}
    </defs>
  </svg>
);

/* ------------------------------- наложения ------------------------------- */
const Tex: React.FC<{src?: string; opacity: number; blend?: React.CSSProperties['mixBlendMode']}> = ({src = GRAIN, opacity, blend = 'multiply'}) => (
  <Img src={src} style={{position: 'absolute', inset: 0, width: W, height: H, opacity, mixBlendMode: blend, pointerEvents: 'none', objectFit: 'cover'}} />
);
const Grout: React.FC = () => (
  <svg style={{position: 'absolute', inset: 0, pointerEvents: 'none'}} width={W} height={H}>
    <defs>
      <pattern id="st-grout" width={MOSAIC_TILE} height={MOSAIC_TILE} patternUnits="userSpaceOnUse">
        <rect width={MOSAIC_TILE} height={MOSAIC_TILE} fill="none" stroke="#E9DFC9" strokeWidth={3.5} />
      </pattern>
    </defs>
    <rect width={W} height={H} fill="url(#st-grout)" />
  </svg>
);
const Preload: React.FC = () => (
  <>
    <Img src={NOISE} style={{position: 'absolute', width: 1, height: 1, opacity: 0}} />
    <Img src={GRAIN} style={{position: 'absolute', width: 1, height: 1, opacity: 0}} />
  </>
);

/* ------------------------------- шрифты ------------------------------- */
/** CSS стиля: шрифт + «два прохода» текста (схема без букв / буквы без схемы). */
export const styleCss = (raw: StyleId) => {
  const style = normalizeStyle(raw);
  const cls = `st-${style}`;
  const th = THEMES[style];
  const single = th.weight && th.weight < 700; // шрифт с одним начертанием — без «искусственного» жирного
  return (
    `.${cls}, .${cls} * { font-family: '${th.font}', 'Montserrat', sans-serif !important;${single ? ` font-weight: ${th.weight} !important;` : ''} }` +
    (th.upper === false ? ` .${cls} .hl, .${cls} .cap span { text-transform: none !important; }` : '') +
    (th.font === 'Caveat' ? ` .${cls} .hl { font-size: 1.18em; } .${cls} .cap span { font-size: 1.15em; }` : '') +
    ' .pass-shape .txt { visibility: hidden !important; } .pass-text .txt { visibility: visible !important; }'
  );
};

/** Обёртка для слоёв вне кадра (субтитры, дисклеймер): шрифт и цвета стиля. */
export const StyleOverlay: React.FC<{style: StyleId; children: React.ReactNode}> = ({style: raw, children}) => {
  const style = normalizeStyle(raw);
  applyTheme(style);
  return (
    <AbsoluteFill className={`st-${style}`}>
      <style>{styleCss(style)}</style>
      {children}
    </AbsoluteFill>
  );
};

/* ------------------------------- слой ------------------------------- */
export const StyleLayer: React.FC<{
  style: StyleId;
  bg: React.ReactNode;
  fg: React.ReactNode;
  actor?: React.ReactNode;
  ui?: React.ReactNode;
  seed?: string | number;
}> = ({style: raw, bg, fg: fgRaw, actor: actorRaw, ui: uiRaw}) => {
  const style = normalizeStyle(raw);
  applyTheme(style);
  const cls = `st-${style}`;
  const layer = (children: React.ReactNode, css: React.CSSProperties = {}) => <AbsoluteFill style={css}>{children}</AbsoluteFill>;
  // схема рисуется дважды: формы (под обработкой стиля) и буквы (чёткие, поверх)
  const fg = (
    <Stage>
      <AbsoluteFill className="pass-shape">{fgRaw}</AbsoluteFill>
    </Stage>
  );
  const fgText = (
    <Stage>
      <AbsoluteFill className="pass-text" style={{visibility: 'hidden'}}>
        {fgRaw}
      </AbsoluteFill>
    </Stage>
  );
  const actor = actorRaw ? <Stage>{actorRaw}</Stage> : null;
  const ui = uiRaw ? <Stage>{uiRaw}</Stage> : null;
  const shadow = (a = 0.28) => `drop-shadow(0 14px 12px rgba(0,0,0,${a}))`;

  let scene: React.ReactNode;
  switch (style) {
    case 'watercolour':
      scene = (
        <>
          {layer(bg, {filter: 'url(#st-wc)', opacity: 0.8})}
          {layer(fg, {filter: 'url(#st-wc)', mixBlendMode: 'multiply'})}
          {layer(actor, {filter: 'url(#st-wc)'})}
          <Tex src={NOISE} opacity={0.3} />
          {fgText}
        </>
      );
      break;
    case 'mosaic':
      scene = (
        <>
          {layer(
            <>
              {layer(bg)}
              {layer(fg)}
              {layer(actor)}
            </>,
            {filter: 'url(#st-mos)'},
          )}
          <Grout />
          <Tex opacity={0.25} />
          {fgText}
        </>
      );
      break;
    case 'sumie':
      scene = (
        <>
          {layer(bg)}
          {layer(fg, {filter: 'url(#st-ink)', mixBlendMode: 'multiply'})}
          {layer(actor, {filter: 'url(#st-ink)'})}
          <Tex src={NOISE} opacity={0.3} />
          {fgText}
        </>
      );
      break;
    case 'impasto':
      scene = (
        <>
          {layer(
            <>
              {layer(bg)}
              {layer(fg)}
              {layer(actor)}
            </>,
            {filter: 'url(#st-oil)'},
          )}
          {fgText}
        </>
      );
      break;
    case 'gouache':
      scene = (
        <>
          {layer(bg, {filter: 'url(#st-gch)'})}
          {layer(fg, {filter: 'url(#st-gch)'})}
          {layer(actor, {filter: 'url(#st-gch)'})}
          <Tex src={NOISE} opacity={0.22} blend="screen" />
          <Tex opacity={0.32} />
          {fgText}
        </>
      );
      break;
    case 'botanical':
      scene = (
        <>
          {layer(bg)}
          {layer(fg, {filter: 'url(#st-bot)', mixBlendMode: 'multiply'})}
          {layer(actor, {filter: 'url(#st-bot)'})}
          <Tex src={NOISE} opacity={0.32} />
          {fgText}
        </>
      );
      break;
    case 'papercut':
      scene = (
        <>
          {layer(bg)}
          {layer(fg, {filter: `${shadow(0.3)} drop-shadow(0 4px 0 rgba(0,0,0,0.18))`})}
          {layer(actor, {filter: shadow(0.3)})}
          <Tex opacity={0.38} />
          {fgText}
        </>
      );
      break;
    case 'nouveau':
      scene = (
        <>
          {layer(bg)}
          {layer(fg, {filter: 'url(#st-nouv)'})}
          {layer(actor)}
          <Tex src={NOISE} opacity={0.22} />
          {fgText}
        </>
      );
      break;
    case 'golden':
      scene = (
        <>
          {layer(bg)}
          {layer(fg, {filter: 'url(#st-warm) drop-shadow(0 0 36px rgba(255,190,120,0.55))'})}
          {layer(actor, {filter: 'drop-shadow(0 0 18px rgba(255,190,120,0.5))'})}
          <Tex src={NOISE} opacity={0.14} blend="soft-light" />
          {fgText}
        </>
      );
      break;
    case 'anime':
      scene = (
        <>
          {layer(bg)}
          {layer(fg, {filter: 'url(#st-cel) saturate(1.15)'})}
          {layer(actor)}
          {fgText}
        </>
      );
      break;
    case 'xray':
      scene = (
        <>
          {layer(bg)}
          {layer(fg, {filter: 'drop-shadow(0 0 10px rgba(95,243,255,0.75)) drop-shadow(0 0 26px rgba(95,243,255,0.35))', opacity: 0.92})}
          {layer(actor, {filter: 'drop-shadow(0 0 8px rgba(95,243,255,0.8))'})}
          {fgText}
        </>
      );
      break;
    case 'comic':
      scene = (
        <>
          {layer(bg)}
          {layer(fg, {filter: 'url(#st-ink6) drop-shadow(10px 10px 0 #111)'})}
          {layer(actor)}
          {fgText}
        </>
      );
      break;
    case 'notebook':
      scene = (
        <>
          {layer(bg)}
          {layer(fg, {filter: 'url(#st-pen)', mixBlendMode: 'multiply', opacity: 0.92})}
          {layer(actor, {filter: 'url(#st-pen)'})}
          {fgText}
        </>
      );
      break;
    case 'riso':
      scene = (
        <>
          {layer(bg)}
          {layer(fg, {filter: 'url(#st-riso-blue)', translate: '9px -6px', opacity: 0.35, mixBlendMode: 'multiply'})}
          {layer(fg)}
          {layer(actor, {mixBlendMode: 'multiply'})}
          <Tex opacity={0.5} />
          {fgText}
        </>
      );
      break;
    case 'glossy':
      scene = (
        <>
          {layer(bg)}
          {layer(fg, {filter: `url(#st-gloss) ${shadow(0.3)}`})}
          {layer(actor, {filter: shadow(0.25)})}
          {fgText}
        </>
      );
      break;
    default: // cosmic — чистая плоская графика с мягким свечением
      scene = (
        <>
          {layer(bg)}
          {layer(fg, {filter: 'drop-shadow(0 18px 0 rgba(0,0,0,0.14))'})}
          {layer(actor)}
          {fgText}
        </>
      );
  }
  return (
    <AbsoluteFill className={cls} style={{background: COLORS.bg}}>
      <style>{styleCss(style)}</style>
      <Filters style={style} />
      <Preload />
      {scene}
      {layer(ui)}
    </AbsoluteFill>
  );
};
