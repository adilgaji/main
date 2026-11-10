/**
 * «Караоке»-субтитры: крупно, по 1–3 слова на экране,
 * произносимое слово подсвечено и слегка «подпрыгивает»,
 * ключевые слова (keyword) получают жёлтую плашку.
 * Формат данных — Caption из @remotion/captions (+ поле keyword).
 */
import React from 'react';
import type {Caption} from '@remotion/captions';
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, FONT_FAMILY, SAFE, TYPE, VIDEO} from '../style';

export type Word = Caption & {keyword?: boolean};

/** Разбить слова на «страницы»: до 3 слов и до 16 символов, разрыв после знаков препинания. */
export const paginate = (words: Word[]): Word[][] => {
  const pages: Word[][] = [];
  let cur: Word[] = [];
  const len = (p: Word[]) => p.map((w) => w.text.trim()).join(' ').length;
  words.forEach((w, i) => {
    const next = [...cur, w];
    if (cur.length && (cur.length >= 3 || len(next) > 16)) {
      pages.push(cur);
      cur = [w];
    } else {
      cur = next;
    }
    const gapAfter = i < words.length - 1 ? words[i + 1].startMs - w.endMs : 0;
    if (/[.,!?;:]$/.test(w.text.trim()) || gapAfter > 350) {
      pages.push(cur);
      cur = [];
    }
  });
  if (cur.length) pages.push(cur);
  return pages;
};

export const KaraokeCaptions: React.FC<{words: Word[]; top?: number}> = ({words, top = 1130}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const pages = React.useMemo(() => paginate(words), [words]);

  // текущая страница: от начала первого слова до начала следующей страницы
  const idx = pages.findIndex((p, i) => ms >= p[0].startMs && (i === pages.length - 1 || ms < pages[i + 1][0].startMs));
  if (idx < 0) return null;
  const page = pages[idx];
  const lastEnd = page[page.length - 1].endMs;
  // страница исчезает, если после неё длинная пауза
  if (idx === pages.length - 1 && ms > lastEnd + 600) return null;

  const pageIn = interpolate(ms, [page[0].startMs, page[0].startMs + 120], [0.85, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: SAFE.left,
        width: VIDEO.width - SAFE.left - SAFE.right,
        minHeight: 260,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignContent: 'center',
        gap: '6px 22px',
        scale: String(pageIn),
      }}
    >
      {page.map((w, i) => {
        const active = ms >= w.startMs && ms < (page[i + 1]?.startMs ?? lastEnd + 400);
        const spoken = ms >= w.startMs;
        const pop = interpolate(ms, [w.startMs, w.startMs + 90, w.startMs + 220], [1, 1.12, 1.04], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const isKw = Boolean(w.keyword);
        return (
          <span
            key={i}
            style={{
              fontFamily: FONT_FAMILY,
              fontWeight: 900,
              fontSize: TYPE.caption,
              lineHeight: 1.15,
              textTransform: 'uppercase',
              color: isKw && spoken ? COLORS.accentInk : active ? COLORS.accent : COLORS.ink,
              background: isKw && spoken ? COLORS.accent : 'transparent',
              borderRadius: 16,
              padding: '0 12px',
              opacity: spoken ? 1 : 0.55,
              scale: active ? String(pop) : '1',
              WebkitTextStroke: isKw && spoken ? '0px' : `3px ${COLORS.bg}`,
              paintOrder: 'stroke fill',
              textShadow: isKw && spoken ? 'none' : `0 6px 0 ${COLORS.bg}, 0 0 24px rgba(0,0,0,0.6)`,
            }}
          >
            {w.text.trim()}
          </span>
        );
      })}
    </div>
  );
};
