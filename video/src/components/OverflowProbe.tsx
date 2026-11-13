// Проверка «текст не выходит за кадр» во время рендера.
// Раз в 15 кадров измеряет все видимые надписи; если какая-то выходит за край кадра,
// в журнал рендера пишется строка TEXT-OVERFLOW — её читает factory/render и проверки видео.
// Кадры в середине перехода (выезд, шторка) пропускаются: там текст уезжает за край нарочно.
import {useEffect} from 'react';
import {getRemotionEnvironment, useCurrentFrame, useVideoConfig} from 'remotion';

const MARGIN = 4;

const effectiveOpacity = (el: Element | null): number => {
  let o = 1;
  for (let e = el; e instanceof HTMLElement; e = e.parentElement) {
    o *= parseFloat(getComputedStyle(e).opacity || '1');
  }
  return o;
};

export const OverflowProbe: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  useEffect(() => {
    if (!getRemotionEnvironment().isRendering || frame % 15 !== 7) {
      return;
    }
    const bad: string[] = [];
    // Меряется сам текст (а не рамка блока): длинное слово может вылезти за свою рамку.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || !(node.textContent ?? '').trim() || el.closest('[data-moving]') || effectiveOpacity(el) < 0.3) {
        continue;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) {
        continue;
      }
      if (r.left < -MARGIN || r.top < -MARGIN || r.right > width + MARGIN || r.bottom > height + MARGIN) {
        bad.push(`«${(node.textContent ?? '').trim().slice(0, 40)}» ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
    }
    if (bad.length) {
      console.error(`TEXT-OVERFLOW frame=${frame} ${bad.slice(0, 3).join(' | ')}`);
    }
  }, [frame, width, height]);
  return null;
};
