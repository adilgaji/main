// Единые палитры, шрифты и обработка картинки для всех стилей.
// Стиль меняет цвета, шрифты и обработку изображения, но НЕ меняет чёткость текста:
// заголовки, подписи и субтитры всегда рисуются отдельным слоем поверх обработки.
import {createContext, useContext} from 'react';

export type Palette = {
  /** Тёмный фон кадра */
  bg: string;
  /** Второй тон фона (для градиента) */
  bgAlt: string;
  /** Светлая «бумага» — плашки, свитки, карта суши */
  paper: string;
  paperShade: string;
  /** Текст на бумаге */
  ink: string;
  /** Текст на тёмном фоне */
  light: string;
  lightSoft: string;
  /** Главный акцент (золото) и второй акцент (маршруты, выделения) */
  accent: string;
  accent2: string;
  /** Карта */
  sea: string;
  seaDeep: string;
  land: string;
  landEdge: string;
  river: string;
  /** Персонаж */
  skin: string;
  skinShade: string;
  hair: string;
  coat: string;
  coatShade: string;
  shirt: string;
};

export type Fonts = {
  /** Заголовки */
  display: string;
  /** Подписи, пояснения */
  body: string;
  /** Субтитры */
  caption: string;
};

export type Treatment = {
  /** CSS-фильтр для слоя с картинкой (сепия, контраст…) */
  filter: string;
  /** Зерно: файл из public/textures и сила (0 — нет) */
  grainTexture: string;
  grainOpacity: number;
  /** Сила бумажной текстуры на фонах */
  paperOpacity: number;
  /** Затемнение по краям (0…1) */
  vignette: number;
};

export type StyleDef = {
  id: string;
  nameRu: string;
  palette: Palette;
  fonts: Fonts;
  treatment: Treatment;
  /** Скругление плашек и толщина линий */
  radius: number;
  stroke: number;
};

export const FONT_DISPLAY = 'Playfair Display';
export const FONT_BODY = 'Source Sans 3';
export const FONT_CAPTION = 'Inter';

const documentary: StyleDef = {
  id: 'documentary',
  nameRu: 'Документальный',
  palette: {
    bg: '#12171F',
    bgAlt: '#243140',
    paper: '#EFE4CB',
    paperShade: '#D9C9A3',
    ink: '#1B1A17',
    light: '#F6EFDD',
    lightSoft: '#B9B4A3',
    accent: '#E0A93F',
    accent2: '#C24B32',
    sea: '#2A4B63',
    seaDeep: '#172C3D',
    land: '#E3D5B0',
    landEdge: '#8C7B55',
    river: '#3F6E8C',
    skin: '#E9B98F',
    skinShade: '#CF9A70',
    hair: '#4A3728',
    coat: '#31506B',
    coatShade: '#223A50',
    shirt: '#F3EAD6',
  },
  fonts: {
    display: `"${FONT_DISPLAY}", Georgia, serif`,
    body: `"${FONT_BODY}", "Segoe UI", Arial, sans-serif`,
    caption: `"${FONT_CAPTION}", "Segoe UI", Arial, sans-serif`,
  },
  treatment: {
    filter: 'none',
    grainTexture: 'textures/grain.png',
    grainOpacity: 0.22,
    paperOpacity: 0.5,
    vignette: 0.55,
  },
  radius: 10,
  stroke: 4,
};

export const STYLES: Record<string, StyleDef> = {documentary};
export const DEFAULT_STYLE = 'documentary';

export const getStyle = (id?: string | null): StyleDef => STYLES[id ?? DEFAULT_STYLE] ?? STYLES[DEFAULT_STYLE];

export const StyleContext = createContext<StyleDef>(documentary);
export const useStyle = (): StyleDef => useContext(StyleContext);

// Кадр и безопасная зона (1920x1080). Всё важное держим внутри неё.
export const FRAME = {width: 1920, height: 1080, fps: 30};
export const SAFE = {left: 120, right: 120, top: 90, bottom: 100};
/** Полоса субтитров внизу кадра: сюда не ставим другие надписи. */
export const CAPTION_ZONE = {top: 800, bottom: 1080 - SAFE.bottom};
