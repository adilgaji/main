// Мелкие текстовые элементы, общие для всех кадров: плашка заголовка, строка источника,
// метка статуса («факт / спорно / легенда / миф»). Всё это живёт в чётком слое текста.
import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {alpha, CLAMP, EASE} from '../lib/anim';
import {SAFE, useStyle} from '../style';

/** Статус утверждения — так же, как в таблице фактов. */
export type ClaimStatus = 'fact' | 'disputed' | 'legend' | 'myth' | 'claim';

const STATUS_LABEL: Record<ClaimStatus, string> = {
  fact: 'ESTABLISHED FACT',
  disputed: 'HISTORIANS DISAGREE',
  legend: 'LEGEND',
  myth: 'MYTH',
  claim: 'ANCIENT CLAIM',
};

/** Появление: проявляется и чуть поднимается. delay — в секундах от начала кадра. */
export const Appear: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties; rise?: number}> = ({
  delay = 0,
  children,
  style,
  rise = 24,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div
      style={{
        ...style,
        opacity: interpolate(frame, [delay * fps, delay * fps + 0.5 * fps], [0, 1], {...CLAMP, easing: EASE.out}),
        translate: interpolate(frame, [delay * fps, delay * fps + 0.6 * fps], [`0px ${rise}px`, '0px 0px'], {
          ...CLAMP,
          easing: EASE.out,
        }),
      }}
    >
      {children}
    </div>
  );
};

/** Заголовок кадра в левом верхнем углу: короткая строка + пояснение. */
export const TitlePlate: React.FC<{title: string; subtitle?: string; delay?: number; onLight?: boolean}> = ({
  title,
  subtitle,
  delay = 0.1,
  onLight = false,
}) => {
  const {palette: p, fonts} = useStyle();
  return (
    <Appear delay={delay} style={{position: 'absolute', left: SAFE.left, top: SAFE.top, maxWidth: 1200}}>
      <div
        style={{
          fontFamily: fonts.display,
          fontWeight: 800,
          fontSize: 76,
          lineHeight: 1.05,
          color: onLight ? p.ink : p.light,
          textShadow: onLight ? 'none' : `0 3px 18px ${alpha('#000000', 0.55)}`,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            marginTop: 14,
            fontFamily: fonts.body,
            fontWeight: 600,
            fontSize: 40,
            letterSpacing: 1,
            color: onLight ? alpha(p.ink, 0.75) : p.accent,
            textShadow: onLight ? 'none' : `0 2px 12px ${alpha('#000000', 0.6)}`,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </Appear>
  );
};

export const StatusChip: React.FC<{status: ClaimStatus; style?: React.CSSProperties}> = ({status, style}) => {
  const {palette: p, fonts, radius} = useStyle();
  const strong = status === 'fact';
  return (
    <div
      style={{
        display: 'inline-block',
        padding: '8px 20px',
        borderRadius: radius,
        fontFamily: fonts.body,
        fontWeight: 800,
        fontSize: 30,
        letterSpacing: 3,
        color: strong ? p.ink : p.light,
        backgroundColor: strong ? p.accent : alpha(p.accent2, 0.95),
        ...style,
      }}
    >
      {STATUS_LABEL[status]}
    </div>
  );
};

/** Строка источника: мелко, над полосой субтитров. */
export const SourceLine: React.FC<{text: string; delay?: number; onLight?: boolean; align?: 'left' | 'right'}> = ({
  text,
  delay = 0.6,
  onLight = false,
  align = 'left',
}) => {
  const {palette: p, fonts} = useStyle();
  return (
    <Appear
      delay={delay}
      rise={0}
      style={{
        position: 'absolute',
        left: align === 'left' ? SAFE.left : undefined,
        right: align === 'right' ? SAFE.right : undefined,
        top: 742,
        maxWidth: 1300,
        fontFamily: fonts.body,
        fontWeight: 600,
        fontSize: 30,
        color: onLight ? alpha(p.ink, 0.7) : alpha(p.light, 0.78),
        textShadow: onLight ? 'none' : `0 2px 8px ${alpha('#000000', 0.7)}`,
      }}
    >
      {text}
    </Appear>
  );
};
