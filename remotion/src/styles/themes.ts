/**
 * Стили видео (16). Каждый стиль = палитра + шрифт + фон-«мир» (Backdrops.tsx) + обработка картинки (StyleLayer.tsx).
 * Схемы (органы, клетки, гид) одни и те же — меняется только «как это нарисовано».
 * Старые id стилей (classic, glass, pixel…) автоматически переводятся в новые — см. normalizeStyle.
 */
import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
import {COLORS} from '../style';

export const STYLE_IDS = [
  'watercolour', 'mosaic', 'sumie', 'impasto', 'gouache', 'botanical', 'papercut', 'nouveau',
  'golden', 'anime', 'xray', 'cosmic', 'comic', 'notebook', 'riso', 'glossy',
] as const;
export type StyleId = (typeof STYLE_IDS)[number];
export const DEFAULT_STYLE: StyleId = 'cosmic';

/** Старые стили → ближайшие новые (для старых роликов и сохранённого выбора на странице). */
const LEGACY: Record<string, StyleId> = {
  classic: 'cosmic', glass: 'mosaic', pixel: 'comic', paper: 'papercut', terminal: 'xray',
  isometric: 'glossy', thermal: 'xray', clay: 'glossy',
};
export const normalizeStyle = (id?: string | null): StyleId =>
  (STYLE_IDS as readonly string[]).includes(id ?? '') ? (id as StyleId) : LEGACY[id ?? ''] ?? DEFAULT_STYLE;

type Palette = Partial<Record<keyof typeof COLORS, string>>;
export type Theme = {name: string; ru: string; font: string; weight?: number; upper?: boolean; colors: Palette};

const DEFAULT = {...COLORS};

export const THEMES: Record<StyleId, Theme> = {
  watercolour: {
    name: 'Watercolour', ru: 'Акварель: мягкие прозрачные пятна на бумаге', font: 'DM Serif Display', weight: 400,
    colors: { accentText: '#B4423C',
      bg: '#F7F1E5', bgSoft: '#FFFBF2', bgGlow: '#EFE3CC', ink: '#2E2A33', muted: '#7D7468', accent: '#F3BE5A', accentInk: '#2E2208',
      bodyFill: '#EAD9C4', bodyEdge: '#C9AE8E', muscle: '#E0806A', muscleDark: '#B4583F', blood: '#D9574F', bloodDark: '#9E3530', vein: '#5D7FB8',
      brain: '#E7A0B8', brainDark: '#B9708C', gland: '#6FB7A0', glandDark: '#3F8A73', lung: '#F0B4A2', organ: '#D9A066',
      cell: '#7FB3E0', cellDark: '#4F86B8', nucleus: '#5470A8', mito: '#F0A35E', hormone: '#A58BD1', hormoneAlt: '#F3BE5A', nerve: '#E9B949', tendon: '#FFF2DF',
    },
  },
  mosaic: {
    name: 'Roman mosaic', ru: 'Римская мозаика: камешки, терракота, лазурь, меандр', font: 'Cinzel', weight: 900,
    colors: { accentText: '#A4452E',
      bg: '#E9DFC9', bgSoft: '#F4ECDA', bgGlow: '#D8C9A8', ink: '#2E2A26', muted: '#6E604E', accent: '#B5803B', accentInk: '#FFF6E2',
      bodyFill: '#D9B98F', bodyEdge: '#8C6A45', muscle: '#B8543A', muscleDark: '#7A2E20', blood: '#A4452E', bloodDark: '#6E2416', vein: '#2E4E7E',
      brain: '#C98C7A', brainDark: '#8F5A48', gland: '#5E8C6A', glandDark: '#3D5E46', lung: '#D98A5F', organ: '#B5803B',
      cell: '#6E8FBF', cellDark: '#2E4E7E', nucleus: '#2A3F66', mito: '#D98A5F', hormone: '#7A5A8C', hormoneAlt: '#E3A94F', nerve: '#E3A94F', tendon: '#F4ECDA',
    },
  },
  sumie: {
    name: 'Sumi-e ink', ru: 'Японская тушь: чёрные мазки кистью, красная печать', font: 'DM Serif Display', weight: 400,
    colors: { accentText: '#C2362B',
      bg: '#F2ECDD', bgSoft: '#FAF6EC', bgGlow: '#E4DCC8', ink: '#1C1C1C', muted: '#6B6559', accent: '#C2362B', accentInk: '#FAF6EC',
      bodyFill: '#D8D1C2', bodyEdge: '#3A3A3A', muscle: '#8A8378', muscleDark: '#3A3A3A', blood: '#C2362B', bloodDark: '#7A1F18', vein: '#4A4A4A',
      brain: '#A9A296', brainDark: '#4A4A4A', gland: '#7A7468', glandDark: '#3A3A3A', lung: '#B5AEA2', organ: '#8A8378',
      cell: '#9C968A', cellDark: '#4A4A4A', nucleus: '#2A2A2A', mito: '#C2362B', hormone: '#5A5A5A', hormoneAlt: '#C2362B', nerve: '#C2362B', tendon: '#FAF6EC',
      proven: '#3E7D4A', early: '#B8862B', myth: '#C2362B',
    },
  },
  impasto: {
    name: 'Impasto oil', ru: 'Масло густыми мазками: рельеф краски, насыщенный цвет', font: 'DM Serif Display', weight: 400,
    colors: { accentText: '#F2C94C',
      bg: '#1E2B55', bgSoft: '#2A3A6E', bgGlow: '#3A4E8A', ink: '#F6EBD3', muted: '#B9B2C9', accent: '#F2C94C', accentInk: '#1E2B55',
      bodyFill: '#C98E6B', bodyEdge: '#8C5A3C', muscle: '#D9573F', muscleDark: '#8C2E1F', blood: '#C93D32', bloodDark: '#7B1F18', vein: '#5B82C9',
      brain: '#E79AA8', brainDark: '#A85A6A', gland: '#4FA58A', glandDark: '#2E6B58', lung: '#E8A08C', organ: '#D9A066',
      cell: '#5BB0D9', cellDark: '#2E6F9E', nucleus: '#2A3F7A', mito: '#F2994A', hormone: '#9B6BD9', hormoneAlt: '#F2C94C', nerve: '#F2C94C', tendon: '#F6EBD3',
    },
  },
  gouache: {
    name: 'Nocturne gouache', ru: 'Ночная гуашь: матовые плоские краски, уютная ночь', font: 'Fredoka', weight: 700, upper: false,
    colors: { accentText: '#F4D58D',
      bg: '#14213D', bgSoft: '#22385F', bgGlow: '#2D4670', ink: '#F2E9DC', muted: '#A9B4C9', accent: '#F4D58D', accentInk: '#14213D',
      bodyFill: '#3D5A80', bodyEdge: '#5C7CA3', muscle: '#E07A5F', muscleDark: '#A9503A', blood: '#D1495B', bloodDark: '#9C3848', vein: '#7FA7D9',
      brain: '#E8A1B5', brainDark: '#B06A80', gland: '#81B29A', glandDark: '#4F7F68', lung: '#F2B4A0', organ: '#E0A458',
      cell: '#7FA7D9', cellDark: '#4E78AA', nucleus: '#2D4670', mito: '#F2A65A', hormone: '#B79CED', hormoneAlt: '#F4D58D', nerve: '#F4D58D', tendon: '#F2E9DC',
    },
  },
  botanical: {
    name: 'Botanical plate', ru: 'Старинный атлас: тонкие линии, штриховка, подписи', font: 'DM Serif Display', weight: 400, upper: false,
    colors: { accentText: '#9B3B2E',
      bg: '#EFE6D2', bgSoft: '#F7F0DF', bgGlow: '#E3D5B6', ink: '#2F2A22', muted: '#6E6350', accent: '#9B3B2E', accentInk: '#F7F0DF',
      bodyFill: '#E8D6B8', bodyEdge: '#2F2A22', muscle: '#D9907F', muscleDark: '#9B3B2E', blood: '#C26A5A', bloodDark: '#8A3A2E', vein: '#8EA6C8',
      brain: '#D9A6A6', brainDark: '#9B6060', gland: '#9DB58A', glandDark: '#5E7A4E', lung: '#E1A28F', organ: '#C9A36B',
      cell: '#A6BFD9', cellDark: '#5E7A99', nucleus: '#4E5E7A', mito: '#D9A06B', hormone: '#A68BB5', hormoneAlt: '#C9A36B', nerve: '#C9A36B', tendon: '#F7F0DF',
      proven: '#5E7A4E', early: '#B5863B', myth: '#9B3B2E',
    },
  },
  papercut: {
    name: 'Paper cut', ru: 'Слои цветной бумаги с тенями, объём как в диораме', font: 'Montserrat', weight: 900,
    colors: { accentText: '#F6E3A1',
      bg: '#1A2846', bgSoft: '#2E4A7A', bgGlow: '#5077AB', ink: '#F6EFE0', muted: '#B9C4D9', accent: '#F6E3A1', accentInk: '#1A2846',
      bodyFill: '#E8D3B5', bodyEdge: '#B99A72', muscle: '#E2606A', muscleDark: '#9E2F3C', blood: '#C9404D', bloodDark: '#8C2733', vein: '#5577A8',
      brain: '#EFA3B8', brainDark: '#B86A82', gland: '#81B29A', glandDark: '#4F7F68', lung: '#F2B4A0', organ: '#E0A458',
      cell: '#7D9ACB', cellDark: '#3E5C8A', nucleus: '#24375E', mito: '#F2A65A', hormone: '#9C89B8', hormoneAlt: '#F6E3A1', nerve: '#F6E3A1', tendon: '#FFF4E0',
    },
  },
  nouveau: {
    name: 'Art nouveau', ru: 'Модерн: арка, золотой ореол, плавные линии-лозы', font: 'Cinzel', weight: 900,
    colors: { accentText: '#A04536',
      bg: '#EADFC8', bgSoft: '#F3E6C4', bgGlow: '#9DAF95', ink: '#3B2F2A', muted: '#6E6050', accent: '#B8934A', accentInk: '#FFF8E8',
      bodyFill: '#D9BFA0', bodyEdge: '#3B2F2A', muscle: '#B4574A', muscleDark: '#7A3328', blood: '#A04536', bloodDark: '#6E2A20', vein: '#55708A',
      brain: '#C98C8C', brainDark: '#8F5A5A', gland: '#7A9A6E', glandDark: '#4E6A44', lung: '#D9A08C', organ: '#B8934A',
      cell: '#8AA6B5', cellDark: '#55708A', nucleus: '#3E5466', mito: '#C88C6E', hormone: '#8C6E9A', hormoneAlt: '#E8CF8F', nerve: '#E8CF8F', tendon: '#F3E6C4',
    },
  },
  golden: {
    name: 'Golden hour', ru: 'Закат: тёплый свет, длинные лучи, мягкое свечение', font: 'Montserrat', weight: 900,
    colors: { accentText: '#FFD27A',
      bg: '#3B2A5C', bgSoft: '#5A3A6E', bgGlow: '#A44A6B', ink: '#FFF4E0', muted: '#E8C9C0', accent: '#FFD27A', accentInk: '#3E2C2A',
      bodyFill: '#C97A6B', bodyEdge: '#FFB88A', muscle: '#F08A6B', muscleDark: '#B4523F', blood: '#E0533F', bloodDark: '#7A2234', vein: '#6A5B9C',
      brain: '#F2A7B8', brainDark: '#B86A82', gland: '#7FC9A0', glandDark: '#4F9A72', lung: '#FFB8A0', organ: '#F0A060',
      cell: '#8AB6E8', cellDark: '#5A7AB8', nucleus: '#4A3A7A', mito: '#FFB060', hormone: '#C79CF0', hormoneAlt: '#FFD27A', nerve: '#FFD27A', tendon: '#FFF1DC',
    },
  },
  anime: {
    name: 'Anime painting', ru: 'Уютная рисованная анимация: небо, облака, холмы', font: 'Fredoka', weight: 700,
    colors: { accentText: '#FFE36E',
      bg: '#3E8EDE', bgSoft: '#FFFFFF', bgGlow: '#CFE6F7', ink: '#1E3A5F', muted: '#5A7A9A', accent: '#FFE36E', accentInk: '#1E3A5F',
      bodyFill: '#F2C9A8', bodyEdge: '#B98A6B', muscle: '#F06C6C', muscleDark: '#B8404A', blood: '#E05252', bloodDark: '#A83A3A', vein: '#5C86D6',
      brain: '#F5A8C0', brainDark: '#C97890', gland: '#6FCF97', glandDark: '#3F9A6A', lung: '#FFB5A0', organ: '#F2B060',
      cell: '#6EC6F0', cellDark: '#3C8DB8', nucleus: '#3A5A9A', mito: '#FFA65C', hormone: '#B48CFF', hormoneAlt: '#FFE36E', nerve: '#FFE36E', tendon: '#FFF6E8',
    },
  },
  xray: {
    name: 'X-ray hologram', ru: 'Рентген-голограмма: светящееся «сканирование» тела', font: 'Archivo Black', weight: 400,
    colors: { accentText: '#5FF3FF',
      bg: '#050B16', bgSoft: '#0B1A2C', bgGlow: '#0E2A44', ink: '#E9FDFF', muted: '#7FB8C8', accent: '#5FF3FF', accentInk: '#050B16',
      bodyFill: '#0E3550', bodyEdge: '#5FF3FF', muscle: '#3FB8D8', muscleDark: '#1A7A99', blood: '#FF4D6D', bloodDark: '#B8304A', vein: '#5FA8FF',
      brain: '#9FE8FF', brainDark: '#3FA8C8', gland: '#5FFFC0', glandDark: '#2AB88A', lung: '#7FD8F0', organ: '#4FC8E8',
      cell: '#5FF3FF', cellDark: '#1A8AA8', nucleus: '#0E5A78', mito: '#FFB86B', hormone: '#C89CFF', hormoneAlt: '#FFE27A', nerve: '#FFE27A', tendon: '#B8F8FF',
      proven: '#5FFFA0', early: '#FFD05F', myth: '#FF4D6D',
    },
  },
  cosmic: {
    name: 'Flat cosmic', ru: 'Яркая плоская графика на фиолетовом «космосе»', font: 'Archivo Black', weight: 400,
    colors: { accentText: '#FFD166',
      bg: '#1B1446', bgSoft: '#2C1E6B', bgGlow: '#4D3AA8', ink: '#FFFFFF', muted: '#B8B0E8', accent: '#FFD166', accentInk: '#1B1446',
      bodyFill: '#5A48C0', bodyEdge: '#7A68E0', muscle: '#FF7A6E', muscleDark: '#C94A50', blood: '#FF3D57', bloodDark: '#D93250', vein: '#4CC9F0',
      brain: '#FF9EC4', brainDark: '#D9709A', gland: '#5BE0A8', glandDark: '#2FB07A', lung: '#FFB0A0', organ: '#FFB060',
      cell: '#4CC9F0', cellDark: '#2A8DB8', nucleus: '#3A2E9A', mito: '#FF9F1C', hormone: '#C89CFF', hormoneAlt: '#FFD166', nerve: '#FFD166', tendon: '#FFF1DC',
    },
  },
  comic: {
    name: 'Comic halftone', ru: 'Комикс: жирный контур, точки, лучи и «бах»-плашки', font: 'Anton', weight: 400,
    colors: { accentText: '#E63946',
      bg: '#FFD23F', bgSoft: '#FFFFFF', bgGlow: '#F28C28', ink: '#111111', muted: '#4A4A4A', accent: '#E63946', accentInk: '#FFFFFF',
      bodyFill: '#F5C9A0', bodyEdge: '#111111', muscle: '#F06C4E', muscleDark: '#B23A28', blood: '#E63946', bloodDark: '#A3121F', vein: '#3A86FF',
      brain: '#FF8FB8', brainDark: '#C9507A', gland: '#2EC4B6', glandDark: '#1A8A80', lung: '#FF9F8A', organ: '#FF9F1C',
      cell: '#3A86FF', cellDark: '#1A56C9', nucleus: '#1A2A80', mito: '#FF9F1C', hormone: '#9B5DE5', hormoneAlt: '#FFD23F', nerve: '#FFD23F', tendon: '#FFF6E0',
    },
  },
  notebook: {
    name: 'Notebook doodle', ru: 'Рисунок ручкой в тетради в линейку, стикеры', font: 'Caveat', weight: 700, upper: false,
    colors: { accentText: '#E63946',
      bg: '#FBFAF4', bgSoft: '#FFE97A', bgGlow: '#E8E4D8', ink: '#1E3A8A', muted: '#5A6A9A', accent: '#FFE97A', accentInk: '#1E3A8A',
      bodyFill: '#F4E4D4', bodyEdge: '#1E3A8A', muscle: '#F08A8A', muscleDark: '#C0505A', blood: '#E63946', bloodDark: '#A3121F', vein: '#4A6FD0',
      brain: '#F5A8C8', brainDark: '#C06A90', gland: '#7AD0A0', glandDark: '#3F9A6A', lung: '#F8B8A8', organ: '#F0B060',
      cell: '#8AB8F0', cellDark: '#4A78C0', nucleus: '#1E3A8A', mito: '#F8A860', hormone: '#B08CF0', hormoneAlt: '#FFE97A', nerve: '#F0C040', tendon: '#FFF6E8',
    },
  },
  riso: {
    name: 'Risograph', ru: 'Ризограф: печать двумя красками, зерно, сдвиг цвета', font: 'Archivo Black', weight: 400,
    colors: { accentText: '#FF48B0',
      bg: '#F5F0E6', bgSoft: '#FFFFFF', bgGlow: '#E8E0D0', ink: '#0078BF', muted: '#5A8AB0', accent: '#FF48B0', accentInk: '#FFFFFF',
      bodyFill: '#FFC2E2', bodyEdge: '#0078BF', muscle: '#FF48B0', muscleDark: '#C02A80', blood: '#FF48B0', bloodDark: '#C02A80', vein: '#0078BF',
      brain: '#FF8AC8', brainDark: '#C04A90', gland: '#00A99D', glandDark: '#007A70', lung: '#FF9AD0', organ: '#FFB000',
      cell: '#5AAAE0', cellDark: '#0078BF', nucleus: '#004E80', mito: '#FFB000', hormone: '#8A5AD0', hormoneAlt: '#FFB000', nerve: '#FFB000', tendon: '#FFF0F8',
      proven: '#00A99D', early: '#FFB000', myth: '#FF48B0',
    },
  },
  glossy: {
    name: 'Glossy 3D', ru: 'Объёмные блестящие «пластиковые» фигуры, студийный свет', font: 'Fredoka', weight: 700,
    colors: { accentText: '#E3343F',
      bg: '#C9D6E8', bgSoft: '#F4F7FB', bgGlow: '#E4ECF6', ink: '#1E2A44', muted: '#5A6A88', accent: '#E3343F', accentInk: '#FFFFFF',
      bodyFill: '#F2C4A8', bodyEdge: '#C99478', muscle: '#F06A5A', muscleDark: '#B23A30', blood: '#E3343F', bloodDark: '#8E1424', vein: '#3A6FE0',
      brain: '#FF9EBE', brainDark: '#D0608A', gland: '#3FCFA0', glandDark: '#1F9A72', lung: '#FFAA98', organ: '#F5A04A',
      cell: '#5AB8F0', cellDark: '#2A7AC0', nucleus: '#2A3F9A', mito: '#FF9F3A', hormone: '#A07CF0', hormoneAlt: '#FFC84A', nerve: '#FFC84A', tendon: '#FFF4E8',
    },
  },
};

let fontsDone = false;
const loadStyleFonts = () => {
  if (fontsDone) return;
  fontsDone = true;
  const extra: [string, string, string, string?][] = [
    ['Cinzel', 'cinzel-latin-900-normal', '900'],
    ['Fredoka', 'fredoka-latin-700-normal', '700'],
    ['Caveat', 'caveat-latin-700-normal', '700'],
    ['Space Mono', 'space-mono-latin-700-normal', '700'],
    ['Anton', 'anton-latin-400-normal', '400'],
    ['Archivo Black', 'archivo-black-latin-400-normal', '400'],
    ['DM Serif Display', 'dm-serif-display-latin-400-normal', '400'],
    ['DM Serif Display', 'dm-serif-display-latin-400-italic', '400', 'italic'],
  ];
  for (const [family, file, weight, style] of extra) loadFont({family, url: staticFile(`fonts/${file}.woff2`), weight, style: style ?? 'normal'});
};

/** Применить палитру стиля (до отрисовки кадра). Возвращает тему. */
export const applyTheme = (raw: string = DEFAULT_STYLE): Theme => {
  loadStyleFonts();
  const id = normalizeStyle(raw);
  Object.assign(COLORS as Record<string, string>, DEFAULT, THEMES[id].colors);
  return THEMES[id];
};
