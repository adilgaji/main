// Какие файлы шрифтов лежат в public/fonts. Только данные — без кода Remotion,
// чтобы их мог прочитать и скрипт проверки стилей (scripts/check-styles.mjs).

export const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
export const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
export const CYRILLIC = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';

export type FaceFile = {
  /** Имя файла в public/fonts */
  file: string;
  /** Диапазон начертаний. Везде «100 900»: даже если у шрифта меньше, браузер берёт ближайшее
   *  и не рисует «поддельный» жирный. */
  weight: string;
  style: 'normal' | 'italic';
  range: string;
};

const RANGES = [
  ['latin', LATIN],
  ['latin-ext', LATIN_EXT],
] as const;

/** Переменный шрифт (@fontsource-variable): один файл на все начертания. */
const variable = (slug: string, opts: {italic?: boolean; cyrillic?: boolean} = {}): FaceFile[] => {
  const out: FaceFile[] = [];
  const styles: ('normal' | 'italic')[] = opts.italic ? ['normal', 'italic'] : ['normal'];
  for (const style of styles) {
    for (const [subset, range] of RANGES) {
      out.push({file: `${slug}-${subset}-wght-${style}.woff2`, weight: '100 900', style, range});
    }
  }
  if (opts.cyrillic) {
    out.push({file: `${slug}-cyrillic-wght-normal.woff2`, weight: '100 900', style: 'normal', range: CYRILLIC});
  }
  return out;
};

/** Обычный шрифт с отдельными файлами для 400 и 700 (@fontsource). */
const fixed = (slug: string): FaceFile[] =>
  (['400', '700'] as const).flatMap((w) =>
    RANGES.map(([subset, range]) => ({file: `${slug}-${subset}-${w}-normal.woff2`, weight: w, style: 'normal' as const, range})),
  );

export const FONT_FILES: Record<string, FaceFile[]> = {
  'Playfair Display': variable('playfair-display', {italic: true}),
  'Source Sans 3': variable('source-sans-3'),
  // Inter — служебный шрифт: подписи на листах владельцу пишутся по-русски, поэтому с кириллицей
  Inter: variable('inter', {cyrillic: true}),
  'EB Garamond': variable('eb-garamond', {italic: true}),
  Fredoka: variable('fredoka'),
  Nunito: variable('nunito'),
  'Bricolage Grotesque': variable('bricolage-grotesque'),
  Oswald: variable('oswald'),
  'Courier Prime': fixed('courier-prime'),
  'Space Grotesk': variable('space-grotesk'),
  Sora: variable('sora'),
  Cormorant: variable('cormorant', {italic: true}),
};
