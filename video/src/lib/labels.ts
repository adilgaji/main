// Размеры надписей и удержание их внутри безопасной зоны кадра.
// Вызывать только после загрузки шрифтов (кадр не рисуется, пока они не готовы).
import {measureText} from '@remotion/layout-utils';
import {CAPTION_ZONE, FRAME, SAFE} from '../style';

export const textWidth = (text: string, fontFamily: string, fontSize: number, fontWeight: number | string, letterSpacing = 0): number =>
  measureText({text, fontFamily, fontSize, fontWeight: String(fontWeight), letterSpacing: `${letterSpacing}px`}).width;

/** Область, где можно ставить надписи: внутри полей и выше полосы субтитров. */
export const LABEL_AREA = {
  left: SAFE.left,
  right: FRAME.width - SAFE.right,
  top: SAFE.top,
  bottom: CAPTION_ZONE.top - 16,
};

export type Box = {x: number; y: number; w: number; h: number};

export const insideArea = (b: Box, pad = 0): boolean =>
  b.x >= LABEL_AREA.left - pad && b.x + b.w <= LABEL_AREA.right + pad && b.y >= LABEL_AREA.top - pad && b.y + b.h <= LABEL_AREA.bottom + pad;

/** Сдвигает прямоугольник внутрь области. Возвращает null, если сдвиг больше maxShift. */
export const clampBox = (b: Box, maxShift: number): Box | null => {
  const x = Math.min(Math.max(b.x, LABEL_AREA.left), LABEL_AREA.right - b.w);
  const y = Math.min(Math.max(b.y, LABEL_AREA.top), LABEL_AREA.bottom - b.h);
  if (Math.abs(x - b.x) > maxShift || Math.abs(y - b.y) > maxShift) {
    return null;
  }
  return {x, y, w: b.w, h: b.h};
};
