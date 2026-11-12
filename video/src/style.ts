// Единые палитры, шрифты и обработка картинки для всех стилей.
// Стиль — это НАБОР НАСТРОЕК (цвета, шрифты, текстура, фильтр), а не отдельная перерисовка кадров.
// Стиль меняет цвета, шрифты и обработку изображения, но НЕ меняет чёткость текста:
// заголовки, подписи и субтитры всегда рисуются отдельным слоем поверх обработки.
//
// Договорённости, которые держатся во ВСЕХ стилях (проверяет scripts/check-styles.mjs):
//   • фон кадра тёмный, светлый текст на нём читается;
//   • «бумага» (плашки, суша на карте) светлая, тёмные чернила на ней читаются;
//   • море на карте тёмное, суша светлая;
//   • субтитры — светлый текст на тёмной плашке, подсвеченное слово контрастно.
import {createContext, useContext, type CSSProperties} from 'react';
import meta from './styles.json';

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

/** Рисунок поверх картинки (под текстом): сетка, полутона, царапины плёнки, свет прожектора. */
export type Pattern = 'none' | 'isogrid' | 'halftone' | 'scratches' | 'spotlight';

export type Treatment = {
  /** CSS-фильтр для слоя с картинкой (сепия, контраст…) */
  filter: string;
  /** Цветная вуаль поверх картинки (под текстом) */
  tint: {color: string; opacity: number; blend: CSSProperties['mixBlendMode']} | null;
  /** Зерно: файл из public/textures и сила (0 — нет) */
  grainTexture: string;
  grainOpacity: number;
  /** Раз во сколько кадров зерно меняется (3 = десять раз в секунду; 100000 = не меняется) */
  grainEvery: number;
  /** Сила бумажной текстуры на фонах */
  paperOpacity: number;
  /** Затемнение по краям (0…1) */
  vignette: number;
  pattern: Pattern;
  /** Мерцание яркости, как у старой плёнки (0 — нет) */
  flicker: number;
};

/** Субтитры: светлый текст на тёмной плашке, подсвеченное слово — цветом. */
export type CaptionLook = {plate: string; plateOpacity: number; text: string; active: string};

export type StyleDef = {
  id: string;
  nameRu: string;
  taglineRu: string;
  palette: Palette;
  fonts: Fonts;
  /** Какие шрифты нужно загрузить (названия из fontFaces.ts) */
  families: string[];
  treatment: Treatment;
  captions: CaptionLook;
  /** Скругление плашек и толщина линий */
  radius: number;
  stroke: number;
};

// Названия семейств шрифтов (файлы описаны в fontFaces.ts)
export const FONT = {
  playfair: 'Playfair Display',
  sourceSans: 'Source Sans 3',
  inter: 'Inter',
  garamond: 'EB Garamond',
  fredoka: 'Fredoka',
  nunito: 'Nunito',
  bricolage: 'Bricolage Grotesque',
  oswald: 'Oswald',
  courier: 'Courier Prime',
  spaceGrotesk: 'Space Grotesk',
  sora: 'Sora',
  cormorant: 'Cormorant',
} as const;

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '"Segoe UI", Arial, sans-serif';
const MONO = '"Courier New", monospace';
const stack = (family: string, fallback: string): string => `"${family}", ${fallback}`;

/** Служебный шрифт для надписей владельцу (листы стилей, образцы): всегда Inter, всегда с кириллицей. */
export const FONT_SERVICE = stack(FONT.inter, SANS);

/** [семейство, запасной шрифт на случай, если файл не загрузился] */
type FontPick = readonly [family: string, fallback: string];
type Source = Omit<StyleDef, 'id' | 'nameRu' | 'taglineRu' | 'families' | 'fonts'> & {
  fonts: {display: FontPick; body: FontPick; caption: FontPick};
};

const make = (id: string, src: Source): StyleDef => {
  const m = meta.styles.find((s) => s.id === id);
  if (!m) {
    throw new Error(`Стиль «${id}» не записан в styles.json`);
  }
  const {fonts: f, ...rest} = src;
  const fonts: Fonts = {display: stack(...f.display), body: stack(...f.body), caption: stack(...f.caption)};
  const families = [...new Set([f.display[0], f.body[0], f.caption[0]])];
  return {id, nameRu: m.name_ru, taglineRu: m.tagline_ru, fonts, families, ...rest};
};

// ---------------------------------------------------------------------------------- стили

/** 1. Документальный: тёмно-синий фон, золото, строгие шрифты. */
const documentary = make('documentary', {
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
  fonts: {display: [FONT.playfair, SERIF], body: [FONT.sourceSans, SANS], caption: [FONT.inter, SANS]},
  treatment: {filter: 'none', tint: null, grainTexture: 'textures/grain.png', grainOpacity: 0.16, grainEvery: 3, paperOpacity: 0.5, vignette: 0.55, pattern: 'none', flicker: 0},
  captions: {plate: '#0A0C10', plateOpacity: 0.78, text: '#FFFFFF', active: '#E0A93F'},
  radius: 10,
  stroke: 4,
});

/** 2. Пергамент и чернила: тёплая бумага, сепия, шрифт с засечками. */
const parchment = make('parchment', {
  palette: {
    bg: '#1E150D',
    bgAlt: '#3A2A1A',
    paper: '#EFDFB8',
    paperShade: '#D2BB8A',
    ink: '#2A1A0E',
    light: '#F5E9CC',
    lightSoft: '#BDAA84',
    accent: '#DC9F3E',
    accent2: '#9C3A22',
    sea: '#5E4B31',
    seaDeep: '#3B2D1C',
    land: '#E9D7A8',
    landEdge: '#7A5F38',
    river: '#5F7F85',
    skin: '#E3B488',
    skinShade: '#C48F66',
    hair: '#3B2616',
    coat: '#6B4528',
    coatShade: '#4B2F1B',
    shirt: '#F1E4C4',
  },
  fonts: {display: [FONT.garamond, SERIF], body: [FONT.garamond, SERIF], caption: [FONT.garamond, SERIF]},
  treatment: {
    filter: 'sepia(0.6) contrast(1.02) saturate(0.9) brightness(1.12)',
    tint: {color: '#E2C48B', opacity: 0.18, blend: 'multiply'},
    grainTexture: 'textures/grain.png',
    grainOpacity: 0.22,
    grainEvery: 4,
    paperOpacity: 1,
    vignette: 0.38,
    pattern: 'none',
    flicker: 0,
  },
  captions: {plate: '#1A110A', plateOpacity: 0.82, text: '#FFF6E0', active: '#F2B04C'},
  radius: 6,
  stroke: 4,
});

/** 3. Книжная иллюстрация: яркие тёплые цвета, округлый шрифт, полутона как в печати. */
const illustrated = make('illustrated', {
  palette: {
    bg: '#1B3A4B',
    bgAlt: '#2F6F6D',
    paper: '#FFF2D6',
    paperShade: '#F2D8A0',
    ink: '#2B2118',
    light: '#FFF7E6',
    lightSoft: '#CFE3D8',
    accent: '#FFC857',
    accent2: '#E4572E',
    sea: '#27678A',
    seaDeep: '#173F5A',
    land: '#F7E6B0',
    landEdge: '#B07A3C',
    river: '#5AB1D6',
    skin: '#F0B98D',
    skinShade: '#D79A6E',
    hair: '#5C3A21',
    coat: '#3E8E7E',
    coatShade: '#2B6B5F',
    shirt: '#FFF3DC',
  },
  fonts: {display: [FONT.fredoka, SANS], body: [FONT.nunito, SANS], caption: [FONT.nunito, SANS]},
  treatment: {
    filter: 'saturate(1.35) contrast(1.1) brightness(1.03)',
    tint: {color: '#FFB45C', opacity: 0.16, blend: 'soft-light'},
    grainTexture: 'textures/grain.png',
    grainOpacity: 0.08,
    grainEvery: 6,
    paperOpacity: 0.6,
    vignette: 0.28,
    pattern: 'halftone',
    flicker: 0,
  },
  captions: {plate: '#14303D', plateOpacity: 0.86, text: '#FFFFFF', active: '#FFD166'},
  radius: 24,
  stroke: 6,
});

/** 4. Бумажная аппликация: фиолет и коралл, бумажная фактура, плоские цвета. */
const papercut = make('papercut', {
  palette: {
    bg: '#2B1B3D',
    bgAlt: '#4A2C6A',
    paper: '#FBF0E4',
    paperShade: '#EBD3BC',
    ink: '#2B1B3D',
    light: '#FFF6EC',
    lightSoft: '#D9C7E8',
    accent: '#FF8A5B',
    accent2: '#E04F6B',
    sea: '#4B3F8F',
    seaDeep: '#2D2563',
    land: '#FBE3C8',
    landEdge: '#C7704A',
    river: '#6FB8E8',
    skin: '#F2B793',
    skinShade: '#D99572',
    hair: '#3A2A4A',
    coat: '#E8604C',
    coatShade: '#B8483A',
    shirt: '#FFF1E0',
  },
  fonts: {display: [FONT.bricolage, SANS], body: [FONT.nunito, SANS], caption: [FONT.nunito, SANS]},
  treatment: {
    filter: 'saturate(1.3) contrast(1.12)',
    tint: {color: '#FF9E7A', opacity: 0.14, blend: 'soft-light'},
    grainTexture: 'textures/paper.png',
    grainOpacity: 0.3,
    grainEvery: 100000,
    paperOpacity: 0.9,
    vignette: 0.25,
    pattern: 'none',
    flicker: 0,
  },
  captions: {plate: '#1C1029', plateOpacity: 0.84, text: '#FFFFFF', active: '#FF9F76'},
  radius: 8,
  stroke: 5,
});

/** 5. Старая кинохроника: чёрно-белое, крупный шум, царапины, шрифт пишущей машинки. */
const newsreel = make('newsreel', {
  palette: {
    bg: '#0F0F0E',
    bgAlt: '#2B2A27',
    paper: '#E4DDC8',
    paperShade: '#C9BFA3',
    ink: '#151412',
    light: '#F1ECDD',
    lightSoft: '#B2AC9B',
    accent: '#FF6B60',
    accent2: '#B3261E',
    sea: '#2A2D2F',
    seaDeep: '#17191A',
    land: '#D8D2BF',
    landEdge: '#6E6A5C',
    river: '#8A9499',
    skin: '#D8B89A',
    skinShade: '#B99677',
    hair: '#2A2622',
    coat: '#4A4C4F',
    coatShade: '#313336',
    shirt: '#E8E3D3',
  },
  fonts: {display: [FONT.oswald, SANS], body: [FONT.courier, MONO], caption: [FONT.courier, MONO]},
  treatment: {
    filter: 'grayscale(1) contrast(1.3) brightness(0.96) sepia(0.15)',
    tint: null,
    grainTexture: 'textures/grain-coarse.png',
    grainOpacity: 0.38,
    grainEvery: 2,
    paperOpacity: 0.7,
    vignette: 0.85,
    pattern: 'scratches',
    flicker: 0.07,
  },
  captions: {plate: '#0A0A09', plateOpacity: 0.8, text: '#F6F1E1', active: '#FF8A7E'},
  radius: 2,
  stroke: 4,
});

/** 6. Карта-объяснялка: чистая плоская графика, синий и бирюза. */
const mapexplainer = make('mapexplainer', {
  palette: {
    bg: '#0B1E33',
    bgAlt: '#14385C',
    paper: '#F4F7FA',
    paperShade: '#DCE6EE',
    ink: '#0C2236',
    light: '#F2F8FD',
    lightSoft: '#A9BFD1',
    accent: '#38D2C6',
    accent2: '#E8552E',
    sea: '#17598A',
    seaDeep: '#0A2F4F',
    land: '#EAF1F6',
    landEdge: '#5C7C94',
    river: '#58B4E8',
    skin: '#EDBB96',
    skinShade: '#D29C76',
    hair: '#352A24',
    coat: '#1F6FB2',
    coatShade: '#17507F',
    shirt: '#F4F7FA',
  },
  fonts: {display: [FONT.spaceGrotesk, SANS], body: [FONT.inter, SANS], caption: [FONT.inter, SANS]},
  treatment: {
    filter: 'saturate(1.12) contrast(1.05)',
    tint: {color: '#4FA3FF', opacity: 0.14, blend: 'soft-light'},
    grainTexture: 'textures/grain.png',
    grainOpacity: 0.05,
    grainEvery: 6,
    paperOpacity: 0.25,
    vignette: 0.2,
    pattern: 'none',
    flicker: 0,
  },
  captions: {plate: '#06121F', plateOpacity: 0.8, text: '#FFFFFF', active: '#38D2C6'},
  radius: 14,
  stroke: 5,
});

/** 7. Изометрия — пресет: индиго и мята, фирменная изометрическая сетка (не настоящая 3D-перерисовка). */
const isometric = make('isometric', {
  palette: {
    bg: '#0E0F24',
    bgAlt: '#282B66',
    paper: '#EEF0FF',
    paperShade: '#CBD0F5',
    ink: '#14163A',
    light: '#F3F4FF',
    lightSoft: '#A9ADE0',
    accent: '#5EEAD4',
    accent2: '#E8437F',
    sea: '#3340A5',
    seaDeep: '#1B2266',
    land: '#E0E5FF',
    landEdge: '#6670CC',
    river: '#7FB3FF',
    skin: '#F0BE9B',
    skinShade: '#D49E7C',
    hair: '#2F2440',
    coat: '#5B63E0',
    coatShade: '#3F46B4',
    shirt: '#F2F3FF',
  },
  fonts: {display: [FONT.sora, SANS], body: [FONT.inter, SANS], caption: [FONT.inter, SANS]},
  treatment: {
    filter: 'saturate(1.25) contrast(1.08) hue-rotate(6deg)',
    tint: {color: '#7F86FF', opacity: 0.34, blend: 'soft-light'},
    grainTexture: 'textures/grain.png',
    grainOpacity: 0.03,
    grainEvery: 6,
    paperOpacity: 0.2,
    vignette: 0.3,
    pattern: 'isogrid',
    flicker: 0,
  },
  captions: {plate: '#0A0B1E', plateOpacity: 0.82, text: '#FFFFFF', active: '#5EEAD4'},
  radius: 3,
  stroke: 3,
});

/** 8. Музей ночью: тёмный зал, золото, свет прожектора. */
const museum = make('museum', {
  palette: {
    bg: '#0B0809',
    bgAlt: '#2B161B',
    paper: '#E9DEC4',
    paperShade: '#CDBE9B',
    ink: '#1A1209',
    light: '#F3E9D2',
    lightSoft: '#B5A78B',
    accent: '#D8B35C',
    accent2: '#A8404F',
    sea: '#2A1B26',
    seaDeep: '#150D14',
    land: '#D9CBA6',
    landEdge: '#7E6A3F',
    river: '#6F8C93',
    skin: '#E6B48C',
    skinShade: '#C99770',
    hair: '#2A1A14',
    coat: '#5A1F2C',
    coatShade: '#3E141E',
    shirt: '#F1E7D0',
  },
  fonts: {display: [FONT.cormorant, SERIF], body: [FONT.sourceSans, SANS], caption: [FONT.sourceSans, SANS]},
  treatment: {
    filter: 'contrast(1.15) brightness(0.88) saturate(0.9)',
    tint: {color: '#8F7A9E', opacity: 0.18, blend: 'multiply'},
    grainTexture: 'textures/grain.png',
    grainOpacity: 0.1,
    grainEvery: 4,
    paperOpacity: 0.35,
    vignette: 0.85,
    pattern: 'spotlight',
    flicker: 0,
  },
  captions: {plate: '#080506', plateOpacity: 0.84, text: '#F8F0DC', active: '#E6C16A'},
  radius: 2,
  stroke: 3,
});

const ALL: StyleDef[] = [documentary, parchment, illustrated, papercut, newsreel, mapexplainer, isometric, museum];

/** Стили в том порядке, в котором они показаны владельцу (1…8). */
export const STYLE_LIST: StyleDef[] = meta.styles.map((m) => {
  const s = ALL.find((x) => x.id === m.id);
  if (!s) {
    throw new Error(`Для стиля «${m.id}» из styles.json нет описания в style.ts`);
  }
  return s;
});

export const STYLES: Record<string, StyleDef> = Object.fromEntries(STYLE_LIST.map((s) => [s.id, s]));
export const DEFAULT_STYLE: string = meta.default;

export const getStyle = (id?: string | null): StyleDef => STYLES[id ?? DEFAULT_STYLE] ?? STYLES[DEFAULT_STYLE];

export const StyleContext = createContext<StyleDef>(documentary);
export const useStyle = (): StyleDef => useContext(StyleContext);

// Кадр и безопасная зона (1920x1080). Всё важное держим внутри неё.
export const FRAME = {width: 1920, height: 1080, fps: 30};
export const SAFE = {left: 120, right: 120, top: 90, bottom: 100};
/** Полоса субтитров внизу кадра: сюда не ставим другие надписи. */
export const CAPTION_ZONE = {top: 800, bottom: 1080 - SAFE.bottom};
