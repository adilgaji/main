// Субтитры: две строки внизу, крупно, с подсветкой слова, которое звучит сейчас.
// Время слов приходит из озвучки (Kokoro), поэтому подсветка совпадает с голосом.
import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {alpha} from '../lib/anim';
import {SAFE, useStyle} from '../style';

export type CaptionWord = {text: string; start: number; end: number};

type Page = {lines: number[][]; start: number; end: number};

const SENTENCE_END = /[.!?…]["”')]?$/;

/** Разбивает слова на «страницы» по две строки. */
export const buildPages = (words: CaptionWord[], maxChars: number): Page[] => {
  const pages: Page[] = [];
  let lines: number[][] = [[]];
  let lineLen = 0;

  const flush = () => {
    const idx = lines.flat();
    if (idx.length) {
      pages.push({lines: lines.filter((l) => l.length), start: words[idx[0]].start, end: words[idx[idx.length - 1]].end});
    }
    lines = [[]];
    lineLen = 0;
  };

  words.forEach((w, i) => {
    const add = w.text.length + (lineLen ? 1 : 0);
    if (lineLen + add > maxChars && lineLen > 0) {
      if (lines.length === 2) {
        flush();
      } else {
        lines.push([]);
        lineLen = 0;
      }
    }
    lines[lines.length - 1].push(i);
    lineLen += w.text.length + (lineLen ? 1 : 0);
    // Конец предложения — хорошее место, чтобы сменить страницу.
    const count = lines.flat().length;
    if (SENTENCE_END.test(w.text) && (lines.length === 2 || count >= 4)) {
      flush();
    }
  });
  flush();
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
  const {palette: p, fonts} = useStyle();
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
            backgroundColor: alpha('#0A0C10', 0.78),
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
              <span key={i} style={{color: active ? p.accent : '#FFFFFF'}}>
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
