// «Холст» кадра: горизонтальный (видео 1920x1080) или вертикальный (Shorts 1080x1920).
// Кадры берут размеры, поля и область для надписей отсюда, а не из констант, поэтому
// карта, архивное изображение, цитата и рассказчик перестраиваются под вертикальный кадр.
import {createContext, useContext} from 'react';
import {LABEL_AREA} from './labels';
import {FRAME, SAFE} from '../style';

export type Area = {left: number; right: number; top: number; bottom: number};

export type Canvas = {
  width: number;
  height: number;
  vertical: boolean;
  /** Поля: всё важное — внутри */
  safe: Area;
  /** Где можно ставить надписи (внутри полей, выше субтитров) */
  area: Area;
  /** Строка источника (мелко, над субтитрами) */
  sourceTop: number;
  /** Субтитры: отступ снизу, длина строки в знаках, размер шрифта */
  captionBottom: number;
  captionChars: number;
  captionSize: number;
};

export const HORIZONTAL: Canvas = {
  width: FRAME.width,
  height: FRAME.height,
  vertical: false,
  safe: SAFE,
  area: LABEL_AREA,
  sourceTop: 742,
  captionBottom: SAFE.bottom,
  captionChars: 36,
  captionSize: 62,
};

// В Shorts низ и правый край закрыты кнопками и подписью ролика — поэтому поля там шире.
export const VERTICAL: Canvas = {
  width: 1080,
  height: 1920,
  vertical: true,
  safe: {left: 70, right: 150, top: 220, bottom: 470},
  area: {left: 70, right: 930, top: 220, bottom: 1170},
  sourceTop: 1110,
  captionBottom: 470,
  captionChars: 20,
  captionSize: 74,
};

export const CanvasContext = createContext<Canvas>(HORIZONTAL);
export const useCanvas = (): Canvas => useContext(CanvasContext);
