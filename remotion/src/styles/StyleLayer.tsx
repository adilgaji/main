/**
 * Слой стиля: одна и та же сцена (фон / схема / гид / надписи) рисуется в выбранном стиле.
 * Обработка — только кодом: SVG-фильтры, наложения, палитра (themes.ts).
 *
 * Слоты: bg — фон-«среда», fg — схема (органы, клетки), actor — гид (не поворачивается в изометрии),
 * ui — заголовок и субтитры (всегда читаемые).
 */
import React from 'react';
import {AbsoluteFill, Img, random, staticFile} from 'remotion';
import {Delaunay} from 'd3-delaunay';
import {COLORS, VIDEO} from '../style';
import {StyleId, THEMES, applyTheme} from './themes';

const W = VIDEO.width;
const H = VIDEO.height;

/* ------------------------------- фильтры ------------------------------- */
export const Filters: React.FC<{style: StyleId}> = ({style}) => (
  <svg width={0} height={0} style={{position: 'absolute'}}>
    <defs>
      {style === 'glass' && (
        <filter id="st-lead" x="-5%" y="-5%" width="110%" height="110%">
          <feMorphology in="SourceAlpha" operator="dilate" radius={5} result="d" />
          <feFlood floodColor="#0B0B12" />
          <feComposite in2="d" operator="in" result="o" />
          <feMerge>
            <feMergeNode in="o" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      )}
      {style === 'pixel' && (
        <filter id="st-pixel" x="0" y="0" width="100%" height="100%">
          <feFlood x={5} y={5} height={4} width={4} />
          <feComposite width={14} height={14} />
          <feTile result="a" />
          <feComposite in="SourceGraphic" in2="a" operator="in" />
          <feMorphology operator="dilate" radius={5} />
        </filter>
      )}
      {style === 'watercolour' && (
        <filter id="st-wc" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feImage href={NOISE} x={0} y={0} width={W} height={H} preserveAspectRatio="none" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={22} xChannelSelector="R" yChannelSelector="G" result="d" />
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
      {style === 'terminal' && (
        <filter id="st-term" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0.08 0.12 0.04 0 0  0.33 0.55 0.17 0 0.03  0.12 0.18 0.06 0 0  0 0 0 1 0" />
        </filter>
      )}
      {style === 'thermal' && (
        <filter id="st-thermal" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={2.2} />
          <feColorMatrix type="matrix" values="0.3 0.55 0.15 0 0  0.3 0.55 0.15 0 0  0.3 0.55 0.15 0 0  0 0 0 1 0" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0 0.22 0.62 0.93 1 1 1" />
            <feFuncG type="table" tableValues="0 0 0.02 0.25 0.6 0.88 1" />
            <feFuncB type="table" tableValues="0.08 0.42 0.55 0.25 0.05 0.25 0.92" />
          </feComponentTransfer>
        </filter>
      )}
      {style === 'clay' && (
        <filter id="st-clay" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feImage href={NOISE} x={0} y={0} width={W} height={H} preserveAspectRatio="none" result="noise" />
          <feGaussianBlur in="SourceAlpha" stdDeviation={9} result="blurA" />
          <feComposite in="noise" in2="blurA" operator="arithmetic" k2={0.12} k3={1} result="height" />
          <feDiffuseLighting in="height" surfaceScale={10} diffuseConstant={1.15} lightingColor="#ffffff" result="diff">
            <feDistantLight azimuth={225} elevation={52} />
          </feDiffuseLighting>
          <feSpecularLighting in="height" surfaceScale={10} specularConstant={0.55} specularExponent={22} lightingColor="#ffffff" result="spec">
            <feDistantLight azimuth={225} elevation={62} />
          </feSpecularLighting>
          <feComposite in="SourceGraphic" in2="diff" operator="arithmetic" k1={1.18} result="lit" />
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
          <feComposite in="lit" in2="specIn" operator="arithmetic" k2={1} k3={0.55} result="out" />
          <feComposite in="out" in2="SourceAlpha" operator="in" />
        </filter>
      )}
    </defs>
  </svg>
);

/* ------------------------------- наложения ------------------------------- */
const Grain: React.FC<{opacity: number; blend?: React.CSSProperties['mixBlendMode']}> = ({opacity, blend = 'multiply'}) => (
  <Img src={staticFile('textures/grain.png')} style={{position: 'absolute', inset: 0, width: W, height: H, opacity, mixBlendMode: blend, pointerEvents: 'none'}} />
);

/** Шумовая текстура для фильтров (готовая картинка — быстро; feTurbulence в каждом кадре — очень медленно). */
const NOISE = staticFile('textures/noise.png');
const GRAIN = staticFile('textures/grain.png');
const Preload: React.FC = () => (
  <>
    <Img src={NOISE} style={{position: 'absolute', width: 1, height: 1, opacity: 0}} />
    <Img src={GRAIN} style={{position: 'absolute', width: 1, height: 1, opacity: 0}} />
  </>
);

const GlassShards: React.FC = () => {
  const pts: [number, number][] = Array.from({length: 150}, (_, i) => [random(`gx${i}`) * W, random(`gy${i}`) * H]);
  const vor = Delaunay.from(pts).voronoi([0, 0, W, H]);
  return (
    <svg style={{position: 'absolute', inset: 0, pointerEvents: 'none'}} width={W} height={H}>
      {pts.map((_, i) => {
        const r = random(`gs${i}`);
        return (
          <path
            key={i}
            d={vor.renderCell(i)}
            fill={r < 0.5 ? '#FFFFFF' : '#000000'}
            fillOpacity={r < 0.5 ? 0.04 + r * 0.14 : 0.04 + (r - 0.5) * 0.18}
            stroke="#0B0B12"
            strokeWidth={6}
            strokeOpacity={0.9}
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
};

const Scanlines: React.FC = () => (
  <>
    <div style={{position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.38) 0px, rgba(0,0,0,0.38) 3px, transparent 3px, transparent 7px)', pointerEvents: 'none'}} />
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.75) 100%)', pointerEvents: 'none'}} />
  </>
);

const ThermalHud: React.FC = () => {
  const c = '#FFFFFF';
  const corner = (x: number, y: number, sx: number, sy: number) => (
    <path d={`M ${x} ${y + sy * 70} L ${x} ${y} L ${x + sx * 70} ${y}`} stroke={c} strokeWidth={6} fill="none" />
  );
  return (
    <svg style={{position: 'absolute', inset: 0, pointerEvents: 'none'}} width={W} height={H}>
      {corner(90, 240, 1, 1)}
      {corner(W - 190, 240, -1, 1)}
      {corner(90, H - 460, 1, -1)}
      {corner(W - 190, H - 460, -1, -1)}
      <g stroke={c} strokeWidth={4}>
        <line x1={490} y1={680} x2={490} y2={740} />
        <line x1={490} y1={800} x2={490} y2={860} />
        <line x1={400} y1={770} x2={460} y2={770} />
        <line x1={520} y1={770} x2={580} y2={770} />
      </g>
      <text x={600} y={760} fill={c} fontFamily="Space Mono" fontSize={40}>38.4°C</text>
      <defs>
        <linearGradient id="st-iron" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#140030" />
          <stop offset="0.3" stopColor="#8A0A6B" />
          <stop offset="0.55" stopColor="#E8471C" />
          <stop offset="0.8" stopColor="#FFC21A" />
          <stop offset="1" stopColor="#FFFBEA" />
        </linearGradient>
      </defs>
      <rect x={W - 230} y={560} width={26} height={420} fill="url(#st-iron)" stroke={c} strokeWidth={3} />
      <text x={W - 250} y={548} fill={c} fontFamily="Space Mono" fontSize={26} textAnchor="end">40°</text>
      <text x={W - 250} y={1000} fill={c} fontFamily="Space Mono" fontSize={26} textAnchor="end">30°</text>
      <circle cx={130} cy={210} r={11} fill="#FF3B30" />
      <text x={152} y={220} fill={c} fontFamily="Space Mono" fontSize={30}>REC  IR-CAM</text>
    </svg>
  );
};

const IsoGrid: React.FC = () => {
  const step = 70;
  const lines = [];
  for (let i = -40; i < 60; i++) {
    lines.push(<line key={`a${i}`} x1={i * step} y1={0} x2={i * step + H * 1.732} y2={H} />);
    lines.push(<line key={`b${i}`} x1={i * step} y1={0} x2={i * step - H * 1.732} y2={H} />);
  }
  return (
    <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
      <g stroke={COLORS.bodyFill} strokeOpacity={0.45} strokeWidth={2}>{lines}</g>
    </svg>
  );
};

const PaperStrips: React.FC = () => (
  <svg style={{position: 'absolute', inset: 0}} width={W} height={H}>
    {[
      {y: 260, c: COLORS.bgSoft},
      {y: 1320, c: COLORS.bgGlow},
      {y: 1560, c: COLORS.bgSoft},
    ].map((s, i) => {
      let d = `M 0 ${s.y}`;
      for (let x = 0; x <= W; x += 60) d += ` L ${x} ${s.y + Math.sin(x / 90 + i) * 26 + (random(`ps${i}${x}`) - 0.5) * 14}`;
      d += ` L ${W} ${H} L 0 ${H} Z`;
      return <path key={i} d={d} fill={s.c} style={{filter: 'drop-shadow(0 -8px 10px rgba(80,50,20,0.18))'}} />;
    })}
  </svg>
);

/* ------------------------------- слой ------------------------------- */
/** CSS стиля: шрифт + «два прохода» текста (схема без букв / буквы без схемы). */
export const styleCss = (style: StyleId) => {
  const cls = `st-${style}`;
  const font = THEMES[style].font;
  return (
    (style === 'classic' ? '' : `.${cls}, .${cls} * { font-family: '${font}', sans-serif !important; }`) +
    (style === 'pixel'
      ? ` .${cls} .lbl { font-size: 24px !important; } .${cls} .hl { font-size: 62px !important; line-height: 1.35 !important; }` +
        ` .${cls} svg text.txt { font-size: 22px !important; } .${cls} .mt { font-size: 26px !important; } .${cls} .mx { font-size: 32px !important; line-height: 1.4 !important; } .${cls} .tx { font-size: 34px !important; }`
      : '') +
    ' .pass-shape .txt { visibility: hidden !important; } .pass-text .txt { visibility: visible !important; }'
  );
};

/** Обёртка для слоёв вне кадра (субтитры): шрифт и цвет стиля. */
export const StyleOverlay: React.FC<{style: StyleId; children: React.ReactNode}> = ({style, children}) => {
  applyTheme(style);
  return (
    <AbsoluteFill className={`st-${style}`} style={style === 'terminal' ? {filter: 'url(#st-term) drop-shadow(0 0 6px #33FF77)'} : {}}>
      <style>{styleCss(style)}</style>
      <Filters style={style} />
      {children}
    </AbsoluteFill>
  );
};

export const StyleLayer: React.FC<{
  style: StyleId;
  bg: React.ReactNode;
  fg: React.ReactNode;
  actor?: React.ReactNode;
  ui?: React.ReactNode;
}> = ({style, bg, fg: fgRaw, actor, ui}) => {
  applyTheme(style);
  const cls = `st-${style}`;
  const layer = (children: React.ReactNode, css: React.CSSProperties = {}) => <AbsoluteFill style={css}>{children}</AbsoluteFill>;
  // схема рисуется дважды: формы (под обработкой стиля) и буквы (чёткие, поверх)
  const fg = <AbsoluteFill className="pass-shape">{fgRaw}</AbsoluteFill>;
  const fgText = <AbsoluteFill className="pass-text" style={{visibility: 'hidden'}}>{fgRaw}</AbsoluteFill>;

  let scene: React.ReactNode;
  switch (style) {
    case 'glass':
      scene = (
        <>
          {layer(bg, {filter: 'saturate(1.3)'})}
          {layer(fg, {filter: 'url(#st-lead)'})}
          {layer(actor, {filter: 'url(#st-lead)'})}
          <GlassShards />
          {fgText}
        </>
      );
      break;
    case 'pixel':
      scene = (
        <>
          {layer(
            <>
              {layer(bg)}
              {layer(fg)}
              {layer(actor)}
            </>,
            {filter: 'url(#st-pixel)'},
          )}
          {fgText}
        </>
      );
      break;
    case 'paper':
      scene = (
        <>
          {layer(bg, {opacity: 0.55})}
          <PaperStrips />
          {layer(fg, {filter: 'drop-shadow(0 6px 0 rgba(70,40,20,0.22)) drop-shadow(0 16px 18px rgba(70,40,20,0.22))'})}
          {layer(actor, {filter: 'drop-shadow(0 6px 0 rgba(70,40,20,0.25))'})}
          <Grain opacity={0.12} />
          {fgText}
        </>
      );
      break;
    case 'watercolour':
      scene = (
        <>
          {layer(bg, {filter: 'url(#st-wc)', opacity: 0.7})}
          {layer(fg, {filter: 'url(#st-wc)', mixBlendMode: 'multiply'})}
          {layer(actor, {filter: 'url(#st-wc)'})}
          <Grain opacity={0.18} />
          {fgText}
        </>
      );
      break;
    case 'terminal':
      return (
        <AbsoluteFill className={cls} style={{background: '#020804'}}>
          <style>{styleCss(style)}</style>
          <Filters style={style} />
          {layer(
            <>
              {layer(bg, {opacity: 0.6})}
              {layer(fg)}
              {fgText}
              {layer(actor)}
              {layer(ui)}
              <div style={{position: 'absolute', left: 80, top: 150, fontSize: 44, color: '#FFFFFF', letterSpacing: 2}}>{'> ALL_THAT_MATTERS.EXE  —  BIO.SCAN'}</div>
            </>,
            {filter: 'url(#st-term) drop-shadow(0 0 6px #33FF77) drop-shadow(0 0 16px #19A64A)'},
          )}
          <Scanlines />
        </AbsoluteFill>
      );
    case 'isometric':
      scene = (
        <>
          <IsoGrid />
          {layer(bg, {opacity: 0.35})}
          <AbsoluteFill style={{transform: 'translate(0px, 40px) rotate(-30deg) skewX(30deg) scaleY(0.864)', transformOrigin: '50% 45%'}}>
            {[10, 8, 6, 4, 2].map((d) => (
              <AbsoluteFill key={d} style={{translate: `${-d * 3}px ${d * 3}px`, filter: 'brightness(0.68) saturate(1.1)'}}>
                {fg}
              </AbsoluteFill>
            ))}
            <AbsoluteFill style={{filter: 'drop-shadow(-14px 14px 16px rgba(40,50,90,0.25))'}}>{fg}</AbsoluteFill>
            {fgText}
          </AbsoluteFill>
          {layer(actor)}
        </>
      );
      break;
    case 'thermal':
      scene = (
        <>
          {layer(
            <>
              {layer(bg)}
              {layer(fg)}
              {layer(actor)}
            </>,
            {filter: 'url(#st-thermal)'},
          )}
          <Grain opacity={0.1} blend="screen" />
          <ThermalHud />
          {fgText}
        </>
      );
      break;
    case 'clay':
      scene = (
        <>
          {layer(bg, {filter: 'blur(1px)', opacity: 0.8})}
          {layer(fg, {filter: 'url(#st-clay) drop-shadow(0 16px 14px rgba(90,40,10,0.35))'})}
          {layer(actor, {filter: 'drop-shadow(0 10px 10px rgba(90,40,10,0.35))'})}
          <Grain opacity={0.08} />
          {fgText}
        </>
      );
      break;
    default:
      scene = (
        <>
          {layer(bg)}
          {layer(fgRaw)}
          {layer(actor)}
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
