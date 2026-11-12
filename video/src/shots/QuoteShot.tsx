// Кадр «Цитата из первоисточника»: бумажная плашка, крупный текст появляется по словам,
// внизу — автор, произведение и перевод.
import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop, type BackdropKind} from '../components/Backdrop';
import {ShotFrame} from '../components/ShotFrame';
import {alpha, EASE, mix, ramp} from '../lib/anim';
import {textWidth} from '../lib/labels';
import {FRAME, useStyle} from '../style';

export type QuoteShotProps = {
  frames: number;
  text: string;
  /** Кто сказал или написал */
  author: string;
  /** Произведение, место в нём, перевод */
  source?: string;
  /** Короткая строка над цитатой: что это за текст */
  kicker?: string;
  backdrop?: BackdropKind;
  seed?: number;
};

const PANEL = {x: 250, y: 150, w: 1420, h: 600};
const PAD = {x: 110, top: 110, bottom: 150};

/** Подбирает самый крупный размер шрифта, при котором текст помещается в плашку. */
const fitQuote = (text: string, fontFamily: string, maxW: number, maxH: number): {size: number; lines: string[][]} => {
  const words = text.split(/\s+/).filter(Boolean);
  for (const size of [92, 84, 76, 68, 62, 56, 50, 46, 42]) {
    const space = textWidth(' ', fontFamily, size, 600) || size * 0.25;
    const lines: string[][] = [[]];
    let cur = 0;
    for (const w of words) {
      const ww = textWidth(w, fontFamily, size, 600);
      if (cur > 0 && cur + space + ww > maxW) {
        lines.push([]);
        cur = 0;
      }
      lines[lines.length - 1].push(w);
      cur += (cur > 0 ? space : 0) + ww;
    }
    if (lines.length * size * 1.28 <= maxH) {
      return {size, lines};
    }
  }
  return {size: 42, lines: [words]};
};

const QuoteArt: React.FC<QuoteShotProps> = ({backdrop, seed}) => {
  const {palette: p, radius} = useStyle();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const k = ramp(frame, 0, 0.7 * fps, EASE.out);
  return (
    <AbsoluteFill>
      <Backdrop kind={backdrop ?? 'ink'} seed={seed ?? 5} />
      <div
        style={{
          position: 'absolute',
          left: PANEL.x,
          top: PANEL.y,
          width: PANEL.w,
          height: PANEL.h,
          borderRadius: radius * 1.6,
          background: `linear-gradient(160deg, ${mix(p.paper, '#ffffff', 0.18)} 0%, ${p.paper} 55%, ${p.paperShade} 100%)`,
          boxShadow: `0 30px 80px ${alpha('#000000', 0.55)}, inset 0 0 90px ${alpha(mix(p.paperShade, p.ink, 0.4), 0.35)}`,
          opacity: k,
          scale: 0.96 + 0.04 * k,
        }}
      />
      {/* большая открывающая кавычка */}
      <svg width={FRAME.width} height={FRAME.height} style={{position: 'absolute', inset: 0, opacity: k}}>
        <g transform={`translate(${PANEL.x + 96} ${PANEL.y - 30}) scale(1.35)`} fill={p.accent2}>
          <path d="M 0 60 C 0 26 18 6 48 0 L 54 14 C 38 20 30 30 30 44 L 52 44 L 52 92 L 0 92 Z" />
          <path d="M 70 60 C 70 26 88 6 118 0 L 124 14 C 108 20 100 30 100 44 L 122 44 L 122 92 L 70 92 Z" />
        </g>
        <line x1={PANEL.x + PAD.x} y1={PANEL.y + PANEL.h - 128} x2={PANEL.x + PAD.x + 150} y2={PANEL.y + PANEL.h - 128} stroke={p.accent2} strokeWidth={6} strokeLinecap="round" />
      </svg>
    </AbsoluteFill>
  );
};

const QuoteText: React.FC<QuoteShotProps> = ({frames, text, author, source, kicker}) => {
  const {palette: p, fonts} = useStyle();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const boxW = PANEL.w - PAD.x * 2;
  const boxH = PANEL.h - PAD.top - PAD.bottom;
  const fit = useMemo(() => fitQuote(text, fonts.display, boxW, boxH), [text, fonts.display, boxW, boxH]);
  const total = fit.lines.flat().length;
  // Слова проявляются одно за другим в первые 55 % кадра.
  const start = 0.6 * fps;
  const per = Math.max(2, (frames * 0.55 - start) / Math.max(1, total));
  let index = 0;
  return (
    <AbsoluteFill>
      {kicker ? (
        <div
          style={{
            position: 'absolute',
            left: PANEL.x + PAD.x + 180,
            top: PANEL.y + 50,
            fontFamily: fonts.body,
            fontWeight: 800,
            fontSize: 30,
            letterSpacing: 4,
            color: alpha(p.ink, 0.62),
            opacity: ramp(frame, 0.3 * fps, 0.5 * fps),
          }}
        >
          {kicker.toUpperCase()}
        </div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: PANEL.x + PAD.x,
          top: PANEL.y + PAD.top,
          width: boxW,
          height: boxH,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          fontFamily: fonts.display,
          fontWeight: 600,
          fontStyle: 'italic',
          fontSize: fit.size,
          lineHeight: 1.28,
          color: p.ink,
        }}
      >
        {fit.lines.map((line, li) => (
          <div key={li} style={{whiteSpace: 'nowrap'}}>
            {line.map((w, wi) => {
              const i = index++;
              return (
                <span key={wi} style={{opacity: ramp(frame, start + i * per, 0.35 * fps, EASE.soft)}}>
                  {wi > 0 ? ' ' : ''}
                  {w}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: PANEL.x + PAD.x,
          top: PANEL.y + PANEL.h - 112,
          width: boxW,
          opacity: ramp(frame, start + total * per, 0.6 * fps),
        }}
      >
        <div style={{fontFamily: fonts.body, fontWeight: 800, fontSize: 42, lineHeight: 1.1, color: p.ink}}>{author}</div>
        {source ? <div style={{marginTop: 4, fontFamily: fonts.body, fontWeight: 600, fontSize: 30, color: alpha(p.ink, 0.7)}}>{source}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

export const QuoteShot: React.FC<QuoteShotProps> = (props) => (
  <ShotFrame frames={props.frames} drift={null} art={<QuoteArt {...props} />} text={<QuoteText {...props} />} />
);
