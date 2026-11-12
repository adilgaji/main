// Кадр «Инфографика с числами». Три вида:
//   areas  — два числа как квадраты, площадь в точном масштабе (видно, во сколько раз больше);
//   bars   — полосы, можно с диапазоном «от — до» для оценок;
//   number — одно крупное число.
// У каждого числа может быть статус (факт / спорно / легенда / древнее утверждение) и источник.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop, type BackdropKind} from '../components/Backdrop';
import {ShotFrame} from '../components/ShotFrame';
import {SourceLine, StatusChip, TitlePlate, type ClaimStatus} from '../components/TextBits';
import {alpha, EASE, formatNumber, mix, ramp} from '../lib/anim';
import {FRAME, SAFE, useStyle} from '../style';

export type InfoItem = {
  label: string;
  value: number;
  /** Верхняя граница диапазона, если число — оценка «от value до valueTo» */
  valueTo?: number;
  note?: string;
  status?: ClaimStatus;
};

export type InfographicShotProps = {
  frames: number;
  variant: 'areas' | 'bars' | 'number';
  title?: string;
  subtitle?: string;
  items: InfoItem[];
  source?: string;
  backdrop?: BackdropKind;
  seed?: number;
};

const BIG = 420; // сторона большого квадрата
const BASE_Y = 720; // нижняя линия, на которой стоят квадраты

const sideOf = (v: number, max: number): number => BIG * Math.sqrt(v / max);

const useCount = (value: number, delaySec: number, durSec = 1.6): number => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return value * ramp(frame, delaySec * fps, durSec * fps, EASE.out);
};

// ---------------------------------------------------------------- areas

const AreasArt: React.FC<InfographicShotProps> = ({items}) => {
  const {palette: p} = useStyle();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const [small, big] = [...items].sort((a, b) => a.value - b.value);
  const max = big.value;
  const s = sideOf(small.value, max);
  const kSmall = ramp(frame, 0.5 * fps, 0.6 * fps, EASE.out);
  const kBig = ramp(frame, 1.6 * fps, 1.4 * fps, EASE.out);
  const bx = FRAME.width - SAFE.right - BIG - 40;
  const sx = SAFE.left + 40;
  const pulse = ((frame / fps) % 1.8) / 1.8;
  const cells = Math.max(2, Math.round(BIG / Math.max(s, 6)));
  return (
    <svg width={FRAME.width} height={FRAME.height} style={{position: 'absolute', inset: 0}}>
      <line x1={SAFE.left} y1={BASE_Y} x2={FRAME.width - SAFE.right} y2={BASE_Y} stroke={alpha(p.light, 0.35)} strokeWidth={3} />
      {/* маленький квадрат + кольцо-указатель */}
      <rect x={sx} y={BASE_Y - s * kSmall} width={s * kSmall} height={s * kSmall} fill={p.accent} />
      <circle cx={sx + s / 2} cy={BASE_Y - s / 2} r={46 + pulse * 26} fill="none" stroke={p.accent} strokeWidth={4} opacity={(1 - pulse) * kSmall} />
      {/* большой квадрат, разлинованный на клетки размером с маленький */}
      <g transform={`translate(${bx} ${BASE_Y - BIG * kBig})`}>
        <rect width={BIG * kBig} height={BIG * kBig} fill={mix(p.accent2, p.bg, 0.1)} />
        {kBig > 0.98
          ? Array.from({length: cells - 1}, (_, i) => {
              const c = ((i + 1) * BIG) / cells;
              return (
                <g key={i} stroke={alpha(p.bg, 0.28)} strokeWidth={1.5}>
                  <line x1={c} y1={0} x2={c} y2={BIG} />
                  <line x1={0} y1={c} x2={BIG} y2={c} />
                </g>
              );
            })
          : null}
        <rect width={BIG * kBig} height={BIG * kBig} fill="none" stroke={p.paper} strokeWidth={4} />
      </g>
    </svg>
  );
};

const ItemText: React.FC<{item: InfoItem; delay: number; left: number; top: number; width: number; align?: 'left' | 'right'}> = ({item, delay, left, top, width, align = 'left'}) => {
  const {palette: p, fonts} = useStyle();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const v = useCount(item.value, delay);
  const vTo = useCount(item.valueTo ?? 0, delay);
  return (
    <div style={{position: 'absolute', left, top, width, textAlign: align, opacity: ramp(frame, delay * fps, 0.5 * fps)}}>
      <div style={{fontFamily: fonts.display, fontWeight: 800, fontSize: 104, lineHeight: 1, color: p.light, fontVariantNumeric: 'tabular-nums lining-nums', whiteSpace: 'nowrap', textShadow: `0 4px 22px ${alpha('#000000', 0.5)}`}}>
        {formatNumber(v)}
        {item.valueTo ? `–${formatNumber(vTo)}` : ''}
      </div>
      <div style={{marginTop: 12, fontFamily: fonts.body, fontWeight: 700, fontSize: 42, lineHeight: 1.15, color: p.accent}}>{item.label}</div>
      {item.note ? <div style={{marginTop: 6, fontFamily: fonts.body, fontWeight: 500, fontSize: 32, lineHeight: 1.2, color: alpha(p.light, 0.8)}}>{item.note}</div> : null}
      {item.status ? <StatusChip status={item.status} style={{marginTop: 16}} /> : null}
    </div>
  );
};

const AreasText: React.FC<InfographicShotProps> = ({items}) => {
  const {palette: p, fonts} = useStyle();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const [small, big] = [...items].sort((a, b) => a.value - b.value);
  const ratio = Math.round(big.value / small.value);
  const bx = FRAME.width - SAFE.right - BIG - 40;
  return (
    <>
      <ItemText item={small} delay={0.6} left={SAFE.left + 150} top={BASE_Y - 330} width={560} />
      <ItemText item={big} delay={1.8} left={bx - 640} top={BASE_Y - 330} width={600} align="right" />
      <div
        style={{
          position: 'absolute',
          left: bx,
          top: BASE_Y - BIG,
          width: BIG,
          height: BIG,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: fonts.display,
          fontWeight: 800,
          fontSize: 110,
          color: p.paper,
          textShadow: `0 4px 20px ${alpha('#000000', 0.5)}`,
          opacity: ramp(frame, 3.2 * fps, 0.6 * fps),
        }}
      >
        ×{formatNumber(ratio)}
      </div>
    </>
  );
};

// ---------------------------------------------------------------- bars

const BAR = {x: 660, w: 760, h: 64, rowH: 128, top: 300};

const BarsArt: React.FC<InfographicShotProps> = ({items}) => {
  const {palette: p, radius} = useStyle();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const max = Math.max(...items.map((i) => i.valueTo ?? i.value));
  return (
    <svg width={FRAME.width} height={FRAME.height} style={{position: 'absolute', inset: 0}}>
      {items.map((it, i) => {
        const k = ramp(frame, (0.5 + i * 0.5) * fps, 1.1 * fps, EASE.out);
        const y = BAR.top + i * BAR.rowH;
        const w = (it.value / max) * BAR.w * k;
        const wTo = ((it.valueTo ?? it.value) / max) * BAR.w * k;
        return (
          <g key={it.label}>
            <rect x={BAR.x} y={y} width={BAR.w} height={BAR.h} rx={radius} fill={alpha(p.light, 0.08)} />
            {it.valueTo ? <rect x={BAR.x} y={y} width={wTo} height={BAR.h} rx={radius} fill={alpha(i % 2 ? p.accent2 : p.accent, 0.4)} stroke={i % 2 ? p.accent2 : p.accent} strokeWidth={3} strokeDasharray="10 8" /> : null}
            <rect x={BAR.x} y={y} width={Math.max(w, 4)} height={BAR.h} rx={radius} fill={i % 2 ? p.accent2 : p.accent} />
          </g>
        );
      })}
    </svg>
  );
};

const BarRowText: React.FC<{item: InfoItem; index: number}> = ({item, index}) => {
  const {palette: p, fonts} = useStyle();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const delay = 0.5 + index * 0.5;
  const v = useCount(item.value, delay, 1.1);
  const vTo = useCount(item.valueTo ?? 0, delay, 1.1);
  const y = BAR.top + index * BAR.rowH;
  return (
    <div style={{opacity: ramp(frame, delay * fps, 0.4 * fps)}}>
      <div style={{position: 'absolute', left: SAFE.left, top: y - 4, width: BAR.x - SAFE.left - 30, textAlign: 'right'}}>
        <div style={{fontFamily: fonts.body, fontWeight: 700, fontSize: 40, lineHeight: 1.1, color: p.light}}>{item.label}</div>
        {item.note ? <div style={{fontFamily: fonts.body, fontWeight: 500, fontSize: 28, lineHeight: 1.15, color: alpha(p.light, 0.72)}}>{item.note}</div> : null}
      </div>
      <div style={{position: 'absolute', left: BAR.x + BAR.w + 28, top: y + 2, fontFamily: fonts.display, fontWeight: 800, fontSize: 54, lineHeight: 1.1, color: p.light, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums lining-nums'}}>
        {formatNumber(v)}
        {item.valueTo ? `–${formatNumber(vTo)}` : ''}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- number

const NumberText: React.FC<InfographicShotProps> = ({items}) => {
  const {palette: p, fonts} = useStyle();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const it = items[0];
  const v = useCount(it.value, 0.4, 1.8);
  const vTo = useCount(it.valueTo ?? 0, 0.4, 1.8);
  return (
    <div style={{position: 'absolute', left: SAFE.left, right: SAFE.right, top: 270, textAlign: 'center', opacity: ramp(frame, 0.3 * fps, 0.5 * fps)}}>
      <div style={{fontFamily: fonts.display, fontWeight: 800, fontSize: it.valueTo ? 190 : 250, lineHeight: 1, color: p.accent, fontVariantNumeric: 'tabular-nums lining-nums', whiteSpace: 'nowrap', textShadow: `0 6px 30px ${alpha('#000000', 0.55)}`}}>
        {formatNumber(v)}
        {it.valueTo ? `–${formatNumber(vTo)}` : ''}
      </div>
      <div style={{marginTop: 26, fontFamily: fonts.body, fontWeight: 700, fontSize: 56, lineHeight: 1.15, color: p.light}}>{it.label}</div>
      {it.note ? <div style={{marginTop: 10, fontFamily: fonts.body, fontWeight: 500, fontSize: 38, color: alpha(p.light, 0.8)}}>{it.note}</div> : null}
      {it.status ? <StatusChip status={it.status} style={{marginTop: 22}} /> : null}
    </div>
  );
};

// ---------------------------------------------------------------- кадр

export const InfographicShot: React.FC<InfographicShotProps> = (props) => {
  const {variant, backdrop, seed, title, subtitle, source, items} = props;
  return (
    <ShotFrame
      frames={props.frames}
      drift={null}
      art={
        <AbsoluteFill>
          <Backdrop kind={backdrop ?? 'dusk'} seed={seed ?? 7} />
          {variant === 'areas' && items.length >= 2 ? <AreasArt {...props} /> : null}
          {variant === 'bars' || (variant === 'areas' && items.length < 2) ? <BarsArt {...props} /> : null}
        </AbsoluteFill>
      }
      text={
        <AbsoluteFill>
          {title ? <TitlePlate title={title} subtitle={subtitle} /> : null}
          {variant === 'areas' && items.length >= 2 ? <AreasText {...props} /> : null}
          {variant === 'bars' ? items.map((it, i) => <BarRowText key={it.label} item={it} index={i} />) : null}
          {variant === 'number' ? <NumberText {...props} /> : null}
          {source ? <SourceLine text={source} delay={1.2} /> : null}
        </AbsoluteFill>
      }
    />
  );
};
