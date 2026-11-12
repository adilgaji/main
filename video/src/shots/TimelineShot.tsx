// Кадр «Таймлайн»: шкала лет, события появляются, когда до них доходит бегунок,
// крупный счётчик года справа вверху.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop, type BackdropKind} from '../components/Backdrop';
import {ShotFrame} from '../components/ShotFrame';
import {TitlePlate} from '../components/TextBits';
import {alpha, CLAMP, EASE, formatYear, ramp} from '../lib/anim';
import {FRAME, SAFE, useStyle} from '../style';

export type TimelineEvent = {year: number; label: string; highlight?: boolean};
export type TimelineSpan = {from: number; to: number; label: string};

export type TimelineShotProps = {
  frames: number;
  /** Границы шкалы, годы. До нашей эры — отрицательные: 480 BC = -480 */
  from: number;
  to: number;
  title?: string;
  subtitle?: string;
  events: TimelineEvent[];
  spans?: TimelineSpan[];
  /** Бегунок идёт от playFrom до playTo (по умолчанию — через всю шкалу) */
  playFrom?: number;
  playTo?: number;
  backdrop?: BackdropKind;
  seed?: number;
};

const X0 = SAFE.left + 60;
const X1 = FRAME.width - SAFE.right - 60;
const TRACK_Y = 560;
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];

const usePlayhead = (p: TimelineShotProps): number => {
  const frame = useCurrentFrame();
  const a = p.playFrom ?? p.from;
  const b = p.playTo ?? p.to;
  return interpolate(frame, [p.frames * 0.1, p.frames * 0.86], [a, b], {...CLAMP, easing: EASE.inOut});
};

const xOf = (p: TimelineShotProps, year: number): number => X0 + ((year - p.from) / (p.to - p.from)) * (X1 - X0);

const TimelineArt: React.FC<TimelineShotProps> = (props) => {
  const {palette: p, stroke} = useStyle();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const year = usePlayhead(props);
  const px = xOf(props, year);
  const range = props.to - props.from;
  const step = STEPS.find((s) => range / s <= 10) ?? 5000;
  const ticks: number[] = [];
  for (let y = Math.ceil(props.from / step) * step; y <= props.to; y += step) {
    ticks.push(y);
  }
  const grow = ramp(frame, 0, 0.9 * fps, EASE.out);
  return (
    <AbsoluteFill>
      <Backdrop kind={props.backdrop ?? 'vault'} seed={props.seed ?? 3} />
      <svg width={FRAME.width} height={FRAME.height} style={{position: 'absolute', inset: 0}}>
        {/* эпохи — цветные полосы под шкалой */}
        {(props.spans ?? []).map((s) => (
          <rect
            key={s.label}
            x={xOf(props, s.from)}
            y={TRACK_Y - 34}
            width={(xOf(props, s.to) - xOf(props, s.from)) * grow}
            height={68}
            rx={8}
            fill={alpha(p.accent2, 0.42)}
            stroke={alpha(p.accent2, 0.9)}
            strokeWidth={2}
          />
        ))}
        {/* шкала */}
        <line x1={X0 - 40} y1={TRACK_Y} x2={X0 - 40 + (X1 - X0 + 80) * grow} y2={TRACK_Y} stroke={alpha(p.light, 0.85)} strokeWidth={stroke * 1.5} strokeLinecap="round" />
        {ticks.map((t) => (
          <line key={t} x1={xOf(props, t)} y1={TRACK_Y - 16} x2={xOf(props, t)} y2={TRACK_Y + 16} stroke={alpha(p.light, 0.6 * grow)} strokeWidth={stroke * 0.75} />
        ))}
        {/* пройденная часть */}
        <line x1={xOf(props, props.playFrom ?? props.from)} y1={TRACK_Y} x2={px} y2={TRACK_Y} stroke={p.accent} strokeWidth={stroke * 2.5} strokeLinecap="round" />
        {/* события */}
        {props.events.map((e, i) => {
          const x = xOf(props, e.year);
          const k = ramp(frame, 0, 1, EASE.out) * (year >= e.year - range * 0.004 ? ramp(year, e.year - range * 0.004, range * 0.03) : 0);
          const up = i % 2 === 0;
          const len = 96;
          return (
            <g key={e.label} opacity={k}>
              <line x1={x} y1={TRACK_Y} x2={x} y2={TRACK_Y + (up ? -len : len) * k} stroke={e.highlight ? p.accent : alpha(p.light, 0.8)} strokeWidth={stroke} />
              <circle cx={x} cy={TRACK_Y} r={(e.highlight ? 20 : 14) * (0.5 + 0.5 * k)} fill={e.highlight ? p.accent2 : p.bg} stroke={e.highlight ? p.paper : p.accent} strokeWidth={5} />
            </g>
          );
        })}
        {/* бегунок */}
        <g transform={`translate(${px} ${TRACK_Y})`}>
          <path d="M 0 -30 L 15 -52 L -15 -52 Z" fill={p.accent} />
          <line x1={0} y1={-30} x2={0} y2={30} stroke={p.accent} strokeWidth={4} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

const TimelineText: React.FC<TimelineShotProps> = (props) => {
  const {palette: p, fonts, radius} = useStyle();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const year = usePlayhead(props);
  const range = props.to - props.from;
  const step = STEPS.find((s) => range / s <= 10) ?? 5000;
  const ticks: number[] = [];
  for (let y = Math.ceil(props.from / step) * step; y <= props.to; y += step) {
    ticks.push(y);
  }
  const cardW = 380;
  return (
    <AbsoluteFill>
      {props.title ? <TitlePlate title={props.title} subtitle={props.subtitle} /> : null}

      {/* крупный счётчик года */}
      <div
        style={{
          position: 'absolute',
          right: SAFE.right,
          top: SAFE.top - 6,
          textAlign: 'right',
          fontFamily: fonts.display,
          fontWeight: 800,
          fontSize: 150,
          lineHeight: 1,
          color: p.accent,
          fontVariantNumeric: 'tabular-nums lining-nums',
          textShadow: `0 4px 26px ${alpha('#000000', 0.55)}`,
          opacity: ramp(frame, 0.2 * fps, 0.6 * fps),
        }}
      >
        {formatYear(year)}
      </div>

      {ticks.map((t, i) =>
        (ticks.length > 7 && i % 2 === 1) || props.events.some((e) => Math.abs(xOf(props, e.year) - xOf(props, t)) < 70) ? null : (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: xOf(props, t),
              top: TRACK_Y + 26,
              translate: '-50% 0',
              fontFamily: fonts.body,
              fontWeight: 600,
              fontSize: 28,
              color: alpha(p.light, 0.6),
              opacity: ramp(frame, 0.4 * fps, 0.6 * fps),
              whiteSpace: 'nowrap',
            }}
          >
            {formatYear(t)}
          </div>
        ),
      )}

      {(props.spans ?? []).map((s) => (
        <div
          key={s.label}
          style={{
            position: 'absolute',
            left: (xOf(props, s.from) + xOf(props, s.to)) / 2,
            top: TRACK_Y,
            translate: '-50% -50%',
            fontFamily: fonts.body,
            fontWeight: 800,
            fontSize: 30,
            letterSpacing: 4,
            color: p.light,
            whiteSpace: 'nowrap',
            opacity: ramp(frame, 0.7 * fps, 0.6 * fps) * 0.95,
            textShadow: `0 2px 8px ${alpha('#000000', 0.7)}`,
          }}
        >
          {s.label.toUpperCase()}
        </div>
      ))}

      {props.events.map((e, i) => {
        const x = xOf(props, e.year);
        const k = year >= e.year - range * 0.004 ? ramp(year, e.year - range * 0.004, range * 0.03) : 0;
        const up = i % 2 === 0;
        const left = Math.min(Math.max(x - cardW / 2, SAFE.left), FRAME.width - SAFE.right - cardW);
        return (
          <div
            key={e.label}
            style={{
              position: 'absolute',
              left,
              width: cardW,
              ...(up ? {bottom: FRAME.height - (TRACK_Y - 104)} : {top: TRACK_Y + 104}),
              opacity: k,
              translate: `0px ${(1 - k) * (up ? 18 : -18)}px`,
              padding: '14px 20px 16px',
              borderRadius: radius,
              backgroundColor: e.highlight ? p.paper : alpha(p.bg, 0.82),
              border: `3px solid ${e.highlight ? p.accent2 : alpha(p.light, 0.35)}`,
              boxShadow: `0 10px 30px ${alpha('#000000', 0.45)}`,
            }}
          >
            <div style={{fontFamily: fonts.display, fontWeight: 800, fontSize: 46, lineHeight: 1.05, color: e.highlight ? p.accent2 : p.accent}}>{formatYear(e.year)}</div>
            <div style={{marginTop: 6, fontFamily: fonts.body, fontWeight: 600, fontSize: 34, lineHeight: 1.15, color: e.highlight ? p.ink : p.light}}>{e.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const TimelineShot: React.FC<TimelineShotProps> = (props) => (
  <ShotFrame frames={props.frames} drift={null} art={<TimelineArt {...props} />} text={<TimelineText {...props} />} />
);
