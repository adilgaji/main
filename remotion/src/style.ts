/**
 * ЕДИНЫЙ СТИЛЬ ВСЕХ РОЛИКОВ.
 * Меняйте цвета/размеры только здесь — всё остальное берёт значения отсюда.
 */
import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

export const VIDEO = {width: 1080, height: 1920, fps: 30} as const;

/**
 * Безопасная зона YouTube Shorts (в пикселях от края кадра 1080x1920).
 * Сверху — строка поиска/канал, снизу — название, подписка и описание,
 * справа — кнопки лайк/комментарии/поделиться.
 * Всё важное (текст, ключевые части схем) держим ВНУТРИ этой зоны.
 */
export const SAFE = {top: 220, bottom: 440, left: 70, right: 170} as const;
export const SAFE_BOX = {
  x: SAFE.left,
  y: SAFE.top,
  width: VIDEO.width - SAFE.left - SAFE.right,
  height: VIDEO.height - SAFE.top - SAFE.bottom,
} as const;

export const COLORS = {
  // фон
  bg: '#0E1A2B',
  bgSoft: '#15263D',
  bgGlow: '#1D3556',
  // линии и текст
  ink: '#F5F1E8',
  muted: '#8FA3BF',
  // выделение ключевых слов
  accent: '#FFC845',
  accentInk: '#0E1A2B',
  // тело
  bodyFill: '#2A4468',
  bodyEdge: '#3D5E8C',
  // органы и системы
  blood: '#E8505B', // артерии, сердце (кислородная кровь)
  bloodDark: '#A9323D',
  vein: '#5B7FE0', // вены (бедная кислородом кровь — условно синий)
  muscle: '#E9806E',
  muscleDark: '#B95A4A',
  tendon: '#F1DCC2',
  brain: '#F2A7C3',
  brainDark: '#C9789A',
  gland: '#7FD1AE', // железы (гипофиз, щитовидная, надпочечники, яички)
  glandDark: '#4FA585',
  lung: '#F6B8A8',
  organ: '#D9A066', // печень, почки и др.
  cell: '#6EC6F0',
  cellDark: '#3C8DB8',
  nucleus: '#2F5F8F',
  mito: '#FFA65C',
  hormone: '#B48CFF', // молекулы гормонов
  hormoneAlt: '#FFD166',
  nerve: '#FFE27A',
  // статус доказательности
  proven: '#5BD68A',
  early: '#FFB547',
  myth: '#FF6B6B',
} as const;

export const FONT_FAMILY = 'Montserrat';

export const TYPE = {
  headline: 96, // главный текст кадра
  sub: 60, // поясняющий текст
  label: 42, // подписи к схемам
  small: 34,
  caption: 78, // субтитры
} as const;

export const STROKE = {
  guide: 12, // толщина линий стикмена
  outline: 6,
  thin: 3,
} as const;

/** Подсветка ключевого слова: жёлтая «плашка». */
export const keywordStyle: React.CSSProperties = {
  background: COLORS.accent,
  color: COLORS.accentInk,
  borderRadius: 14,
  padding: '0 14px',
};

let fontsLoaded = false;
export const loadFonts = () => {
  if (fontsLoaded) return;
  fontsLoaded = true;
  for (const w of ['600', '800', '900']) {
    loadFont({
      family: FONT_FAMILY,
      url: staticFile(`fonts/montserrat-latin-${w}-normal.woff2`),
      weight: w,
    });
  }
};
