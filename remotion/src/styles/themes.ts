/**
 * Стили видео. Каждый стиль = палитра + шрифт + обработка картинки (StyleLayer.tsx).
 * Схемы (органы, клетки, гид) одни и те же — меняется только «как это нарисовано».
 */
import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
import {COLORS} from '../style';

export type StyleId = 'classic' | 'glass' | 'pixel' | 'paper' | 'watercolour' | 'terminal' | 'isometric' | 'thermal' | 'clay';

export const STYLE_IDS: StyleId[] = ['classic', 'glass', 'pixel', 'paper', 'watercolour', 'terminal', 'isometric', 'thermal', 'clay'];

type Palette = Partial<Record<keyof typeof COLORS, string>>;
export type Theme = {name: string; ru: string; font: string; fontFile?: string; colors: Palette};

const DEFAULT = {...COLORS};

export const THEMES: Record<StyleId, Theme> = {
  classic: {name: 'Classic', ru: 'Текущий стиль', font: 'Montserrat', colors: {}},
  glass: {
    name: 'Glass mosaic',
    ru: 'Витраж: яркие «стёкла» в тёмной окантовке',
    font: 'Cinzel',
    fontFile: 'cinzel-latin-900-normal',
    colors: {
      bg: '#0E1424', bgSoft: '#1A2238', bgGlow: '#24305A', ink: '#FFF6E0', muted: '#B7B2C8', accent: '#F4C430', accentInk: '#1A1206',
      bodyFill: '#2E3D7A', muscle: '#E2582E', muscleDark: '#9E2F14', blood: '#D7263D', bloodDark: '#8C1426', vein: '#2E86DE',
      gland: '#1FA38A', glandDark: '#0F6B5A', hormone: '#8E44AD', cell: '#2FA4E7', cellDark: '#1A6FA8', nucleus: '#1B3A8C', mito: '#F39C12', tendon: '#F5E6C8',
    },
  },
  pixel: {
    name: 'Pixel explainer',
    ru: 'Пиксельная графика, как в ретро-игре',
    font: 'Press Start 2P',
    fontFile: 'press-start-2p-latin-400-normal',
    colors: {
      bg: '#1D2B53', bgSoft: '#29366F', bgGlow: '#3B4C8C', ink: '#FFF1E8', muted: '#C2C3C7', accent: '#FFEC27', accentInk: '#1D2B53',
      bodyFill: '#5F574F', muscle: '#FF77A8', muscleDark: '#BE4A7E', blood: '#FF004D', bloodDark: '#AB1A3E', vein: '#29ADFF',
      gland: '#00E436', glandDark: '#008751', hormone: '#83769C', cell: '#29ADFF', cellDark: '#1C6FB0', nucleus: '#7E2553', mito: '#FFA300', tendon: '#FFCCAA', proven: '#00E436',
    },
  },
  paper: {
    name: 'Paper-cut',
    ru: 'Вырезанные из цветной бумаги слои с тенями',
    font: 'Fredoka',
    fontFile: 'fredoka-latin-700-normal',
    colors: {
      bg: '#F3E6D3', bgSoft: '#EAD7BE', bgGlow: '#F7EEDF', ink: '#3D405B', muted: '#7A6F66', accent: '#F2B134', accentInk: '#3D2A0A',
      bodyFill: '#D9C3A5', muscle: '#E07A5F', muscleDark: '#B4533A', blood: '#C8553D', bloodDark: '#8F3423', vein: '#5B84B1',
      gland: '#81B29A', glandDark: '#4F7F68', hormone: '#9C89B8', cell: '#7EB6D9', cellDark: '#4E86AA', nucleus: '#3D5A80', mito: '#F2A65A', tendon: '#FFF4E0',
    },
  },
  watercolour: {
    name: 'Watercolour',
    ru: 'Акварель на бумаге: мягкие края, прозрачные краски',
    font: 'Caveat',
    fontFile: 'caveat-latin-700-normal',
    colors: {
      bg: '#FBF6EC', bgSoft: '#F3EADB', bgGlow: '#FFFDF8', ink: '#2E3A4B', muted: '#7D7468', accent: '#F2B84B', accentInk: '#2E2208',
      bodyFill: '#E9DCC8', muscle: '#E8846B', muscleDark: '#C05A43', blood: '#D9534F', bloodDark: '#A33A36', vein: '#6C8FD9',
      gland: '#6FB7A0', glandDark: '#3F8A73', hormone: '#A58BD1', cell: '#7FB3E0', cellDark: '#4F86B8', nucleus: '#5470A8', mito: '#F0A35E', tendon: '#FFF2DF',
    },
  },
  terminal: {
    name: 'Retro terminal',
    ru: 'Зелёный экран старого компьютера, мерцание строк',
    font: 'VT323',
    fontFile: 'vt323-latin-400-normal',
    colors: {bg: '#000000', bgSoft: '#0A0A0A', bgGlow: '#111111', ink: '#FFFFFF', accent: '#FFFFFF', accentInk: '#000000', bodyFill: '#3A3A3A'},
  },
  isometric: {
    name: 'Isometric',
    ru: 'Объёмные «макеты» под углом 30°, как в инфографике',
    font: 'Montserrat',
    colors: {
      bg: '#E8EEF7', bgSoft: '#D9E2F0', bgGlow: '#F6F9FD', ink: '#22223B', muted: '#6B6F8A', accent: '#FFB703', accentInk: '#22223B',
      bodyFill: '#B9C6E0', muscle: '#F28482', muscleDark: '#C95D5B', blood: '#E63946', vein: '#4D7CFE',
      gland: '#52B69A', hormone: '#9D8DF1', cell: '#5FA8D3', cellDark: '#3C7FA8', nucleus: '#3D5A99', mito: '#F7A072', tendon: '#FFF1DC',
    },
  },
  thermal: {
    name: 'Thermal cam',
    ru: 'Тепловизор: горячее — жёлто-белое, холодное — фиолетовое',
    font: 'Space Mono',
    colors: {
      // яркость = «температура»: активное — светлое, фон — тёмный
      bg: '#050505', bgSoft: '#1A1A1A', bgGlow: '#2A2A2A', ink: '#FFFFFF', accent: '#FFFFFF', accentInk: '#000000',
      bodyFill: '#3A3A3A', muscle: '#B0B0B0', muscleDark: '#7A7A7A', blood: '#D8D8D8', hormone: '#FFFFFF', gland: '#E8E8E8', cell: '#9A9A9A', nucleus: '#5A5A5A', tendon: '#8A8A8A',
    },
  },
  clay: {
    name: 'Claymation',
    ru: 'Пластилин: мягкие объёмные формы, блики и тени',
    font: 'Fredoka',
    fontFile: 'fredoka-latin-700-normal',
    colors: {
      bg: '#F4C9A0', bgSoft: '#EDB98A', bgGlow: '#F9DDBF', ink: '#3B2A20', muted: '#7A5A45', accent: '#FFD23F', accentInk: '#3B2A20',
      bodyFill: '#E0A47A', muscle: '#E4572E', muscleDark: '#B23A18', blood: '#D62839', bloodDark: '#9E1A27', vein: '#3A86FF',
      gland: '#2EC4B6', glandDark: '#1A8A80', hormone: '#9B5DE5', cell: '#4CC9F0', cellDark: '#2A8DB5', nucleus: '#3F37C9', mito: '#FF9F1C', tendon: '#FFF1D6',
    },
  },
};

let fontsDone = false;
const loadStyleFonts = () => {
  if (fontsDone) return;
  fontsDone = true;
  const extra: [string, string][] = [
    ['Cinzel', 'cinzel-latin-900-normal'],
    ['Press Start 2P', 'press-start-2p-latin-400-normal'],
    ['Fredoka', 'fredoka-latin-700-normal'],
    ['Caveat', 'caveat-latin-700-normal'],
    ['VT323', 'vt323-latin-400-normal'],
    ['Space Mono', 'space-mono-latin-700-normal'],
  ];
  for (const [family, file] of extra) loadFont({family, url: staticFile(`fonts/${file}.woff2`)});
};

/** Применить палитру стиля (до отрисовки кадра). Возвращает тему. */
export const applyTheme = (id: StyleId = 'classic'): Theme => {
  loadStyleFonts();
  Object.assign(COLORS as Record<string, string>, DEFAULT, THEMES[id].colors);
  return THEMES[id];
};
