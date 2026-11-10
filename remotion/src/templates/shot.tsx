/**
 * Общее для всех шаблонов кадра: данные кадра, слова кадра с местным временем,
 * помощники синхронизации анимации с голосом.
 */
import React, {createContext, useContext} from 'react';
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Word} from '../lib/Captions';
import {COLORS, FONT_FAMILY, VIDEO} from '../style';

export type Shot = {
  id: number;
  start: number;
  end: number;
  first_word: number;
  last_word: number;
  template: string;
  params: Record<string, any>;
  transition: 'cut' | 'zoom' | 'slide' | 'fade';
  text?: string;
};

type Ctx = {shot: Shot; words: Word[]};
export const ShotCtx = createContext<Ctx | null>(null);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Состояние кадра: время, длительность и момент произнесения слов. */
export const useShot = () => {
  const ctx = useContext(ShotCtx)!;
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const dur = ctx.shot.end - ctx.shot.start;
  const local = ctx.words
    .slice(ctx.shot.first_word, ctx.shot.last_word + 1)
    .map((w) => ({...w, s: w.startMs / 1000 - ctx.shot.start, e: w.endMs / 1000 - ctx.shot.start}));
  /**
   * Когда (сек от начала кадра) звучит слово/фраза. Если в этом кадре его нет —
   * возвращает долю длительности fallback (0..1).
   */
  const at = (phrase: string, fallback = 0.3) => {
    const target = phrase.split(/\s+/).map(norm).filter(Boolean);
    if (!target.length) return dur * fallback;
    for (let i = 0; i < local.length; i++) {
      if (norm(local[i].text).startsWith(target[0]) || target[0].startsWith(norm(local[i].text)) && norm(local[i].text).length > 3) {
        return Math.max(0, local[i].s);
      }
    }
    return dur * fallback;
  };
  return {t, dur, fps, shot: ctx.shot, words: local, at, p: ctx.shot.params};
};

const easeOpts = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const, easing: Easing.bezier(0.16, 1, 0.3, 1)};
/** Плавный переход 0→1 между моментами a и b (сек). */
export const ramp = (t: number, a: number, b: number) => interpolate(t, [a, Math.max(a + 0.01, b)], [0, 1], easeOpts);

/** Анимация входа кадра по типу перехода. */
export const ShotTransition: React.FC<{transition: Shot['transition']; children: React.ReactNode}> = ({transition, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const k = ramp(frame / fps, 0, 0.3);
  let style: React.CSSProperties = {};
  if (transition === 'fade') style = {opacity: k};
  if (transition === 'slide') style = {translate: `${(1 - k) * 160}px 0px`, opacity: 0.3 + 0.7 * k};
  if (transition === 'zoom') style = {scale: String(1.25 - 0.25 * k), opacity: 0.5 + 0.5 * k};
  return <div style={{position: 'absolute', inset: 0, ...style}}>{children}</div>;
};

/** Навигация фирменного зума: BODY › ORGAN › CELL */
export const Breadcrumb: React.FC<{items: string[]; level: number}> = ({items, level}) => (
  <div
    style={{
      position: 'absolute',
      top: 250,
      left: 70,
      width: VIDEO.width - 70 - 170,
      display: 'flex',
      justifyContent: 'center',
      gap: 16,
      fontFamily: FONT_FAMILY,
      fontWeight: 900,
      fontSize: 50,
    }}
  >
    {items.map((s, i) => (
      <React.Fragment key={s}>
        {i > 0 && <span style={{color: COLORS.muted}}>›</span>}
        <span
          style={{
            color: i === level ? COLORS.accentInk : i < level ? COLORS.ink : COLORS.muted,
            background: i === level ? COLORS.accent : 'transparent',
            borderRadius: 12,
            padding: '0 12px',
          }}
        >
          {s}
        </span>
      </React.Fragment>
    ))}
  </div>
);

/** Цвет по имени из палитры (для параметров раскадровки). */
export const colorOf = (name?: string, fallback: string = COLORS.cell) =>
  (name && (COLORS as Record<string, string>)[name]) || fallback;
