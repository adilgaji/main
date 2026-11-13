/**
 * Общие элементы кадра: фон, заголовок с ключевыми словами, плашка-подпись, «камера».
 */
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, FONT_FAMILY, SAFE, TYPE, VIDEO, keywordStyle} from '../style';

export const Background: React.FC<{tint?: string}> = ({tint = COLORS.bgGlow}) => (
  <AbsoluteFill style={{background: `radial-gradient(circle at 50% 38%, ${tint} 0%, ${COLORS.bg} 72%)`}} />
);

/** Плавное появление элемента (масштаб + прозрачность). */
export const useEnter = (delaySec = 0, durSec = 0.35) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opts = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const, easing: Easing.bezier(0.16, 1, 0.3, 1)};
  return {
    opacity: interpolate(frame, [delaySec * fps, (delaySec + durSec) * fps], [0, 1], opts),
    scale: String(interpolate(frame, [delaySec * fps, (delaySec + durSec) * fps], [0.8, 1], opts)),
  };
};

/** Заголовок кадра: *слово* выделяется жёлтой плашкой. Всегда внутри безопасной зоны. */
export const Headline: React.FC<{text: string; top?: number; size?: number; delay?: number}> = ({text, top = SAFE.top + 20, size = TYPE.headline, delay = 0}) => {
  const enter = useEnter(delay);
  const parts = text.split(/(\*[^*]+\*)/).filter(Boolean);
  return (
    <div
      className="hl"
      style={{
        position: 'absolute',
        top,
        left: SAFE.left,
        width: VIDEO.width - SAFE.left - SAFE.right,
        textAlign: 'center',
        fontFamily: FONT_FAMILY,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.12,
        color: COLORS.ink,
        textTransform: 'uppercase',
        // контур цветом фона: заголовок читается и на тёмной, и на белой доске
        textShadow: `0 0 6px ${COLORS.bg}, 0 0 14px ${COLORS.bg}, 0 5px 0 ${COLORS.bg}`,
        ...enter,
      }}
    >
      {parts.map((p, i) =>
        p.startsWith('*') ? (
          <span key={i} style={{...keywordStyle, textShadow: 'none'}}>
            {p.slice(1, -1)}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </div>
  );
};

/** Подпись-плашка к элементу схемы. */
export const Chip: React.FC<{text: string; x: number; y: number; color?: string; delay?: number}> = ({text, x, y, color = COLORS.accent, delay = 0}) => {
  const enter = useEnter(delay, 0.3);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        translate: '-50% -50%',
        padding: '10px 26px',
        borderRadius: 999,
        background: COLORS.bgSoft,
        border: `5px solid ${color}`,
        fontFamily: FONT_FAMILY,
        fontWeight: 800,
        fontSize: TYPE.label,
        color: COLORS.ink,
        whiteSpace: 'nowrap',
        ...enter,
      }}
    >
      {text}
    </div>
  );
};

/**
 * «Камера»: приближает точку (x, y) сцены к центру кадра с увеличением scale.
 * progress 0..1 — от общего плана к крупному.
 */
export const Camera: React.FC<{
  x: number;
  y: number;
  scale: number;
  progress: number;
  centerY?: number;
  children: React.ReactNode;
}> = ({x, y, scale, progress, centerY = 700, children}) => {
  const s = 1 + (scale - 1) * progress;
  const tx = (VIDEO.width / 2 - x) * progress;
  const ty = (centerY - y) * progress;
  return (
    <AbsoluteFill style={{transformOrigin: `${x}px ${y}px`, transform: `translate(${tx}px, ${ty}px) scale(${s})`}}>
      {children}
    </AbsoluteFill>
  );
};
