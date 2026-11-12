// Субтитры: две строки внизу, крупно, с подсветкой слова, которое звучит сейчас.
// Время слов приходит из озвучки (Kokoro), поэтому подсветка совпадает с голосом.
import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {alpha} from '../lib/anim';
import {SAFE, useStyle} from '../style';

export type CaptionWord = {text: string; start: number; end: number};

type Page = {lines: number[][]; start: number; end: number};

const SENTENCE_END = /[.!?…]["”')]?$/;

const lineLength = (words: CaptionWord[], idx: number[]): number => idx.reduce((n, i) => n + words[i].text.length, 0) + Math.max(0, idx.length - 1);

/** Делит одно предложение на строки примерно одинаковой длины (без «висячих» слов). */
const wrapBalanced = (words: CaptionWord[], idx: number[], maxChars: number): number[][] => {
  const total = lineLength(words, idx);
  let count = Math.max(1, Math.ceil(total / maxChars));
  for (; count <= idx.length; count++) {
    const target = total / count;
    const lines: number[][] = [[]];
    let len = 0;
    let ok = true;
    for (const i of idx) {
      const add = words[i].text.length + (len ? 1 : 0);
      const isLast = lines.length === count;
      // Переходим на новую строку, если слово не влезает или строка уже набрала свою долю.
      if (len > 0 && (len + add > maxChars || (!isLast && len + add / 2 > target))) {
        lines.push([]);
        len = 0;
      }
      lines[lines.length - 1].push(i);
      len += words[i].text.length + (len ? 1 : 0);
      if (len > maxChars && lines[lines.length - 1].length > 1) {
        ok = false;
      }
    }
    if (ok && lines.length <= count) {
      return lines;
    }
  }
  return idx.map((i) => [i]);
};

/**
 * Разбивает слова на «страницы» по две строки. Страница не пересекает границу предложения,
 * кроме случая, когда два коротких предложения вместе помещаются на одну страницу.
 */
export const buildPages = (words: CaptionWord[], maxChars: number): Page[] => {
  // 1. предложения
  const sentences: number[][] = [[]];
  words.forEach((w, i) => {
    sentences[sentences.length - 1].push(i);
    if (SENTENCE_END.test(w.text) && i < words.length - 1) {
      sentences.push([]);
    }
  });
  // 2. строки каждого предложения → страницы по две строки
  const groups: number[][][] = [];
  for (const sent of sentences) {
    if (!sent.length) {
      continue;
    }
    const lines = wrapBalanced(words, sent, maxChars);
    for (let i = 0; i < lines.length; i += 2) {
      groups.push(lines.slice(i, i + 2));
    }
  }
  // 3. короткие соседние страницы (по одной строке, без долгой паузы между ними) склеиваем
  const merged: number[][][] = [];
  for (const g of groups) {
    const prev = merged[merged.length - 1];
    if (prev && prev.length === 1 && g.length === 1) {
      const gap = words[g[0][0]].start - words[prev[0][prev[0].length - 1]].end;
      if (gap < 0.7) {
        prev.push(g[0]);
        continue;
      }
    }
    merged.push(g.map((l) => [...l]));
  }
  const pages: Page[] = merged.map((lines) => {
    const flat = lines.flat();
    return {lines, start: words[flat[0]].start, end: words[flat[flat.length - 1]].end};
  });
  // Страница остаётся на экране до начала следующей (но не дольше 1,2 с тишины).
  for (let i = 0; i < pages.length; i++) {
    const next = pages[i + 1];
    pages[i].end = next ? Math.min(next.start, pages[i].end + 1.2) : pages[i].end + 0.6;
  }
  return pages;
};

export const Captions: React.FC<{words: CaptionWord[]; maxChars?: number; fontSize?: number}> = ({
  words,
  maxChars = 36,
  fontSize = 62,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {captions: look, fonts} = useStyle();
  const pages = useMemo(() => buildPages(words, maxChars), [words, maxChars]);
  const t = frame / fps;
  const page = pages.find((pg) => t >= pg.start - 0.08 && t < pg.end);
  if (!page) {
    return null;
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE.left,
        right: SAFE.right,
        bottom: SAFE.bottom,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {page.lines.map((line) => (
        <div
          key={line[0]}
          style={{
            padding: '6px 26px 10px',
            borderRadius: 12,
            backgroundColor: alpha(look.plate, look.plateOpacity),
            fontFamily: fonts.caption,
            fontWeight: 800,
            fontSize,
            lineHeight: 1.18,
            whiteSpace: 'nowrap',
          }}
        >
          {line.map((i, k) => {
            const w = words[i];
            const active = t >= w.start - 0.03 && t < w.end;
            return (
              <span key={i} style={{color: active ? look.active : look.text}}>
                {k > 0 ? ' ' : ''}
                {w.text}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
