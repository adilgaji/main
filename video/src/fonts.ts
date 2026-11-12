// Шрифты лежат в public/fonts (лицензия SIL OFL) и грузятся с диска:
// рендер не зависит от интернета.
import {loadFont} from '@remotion/fonts';
import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {FONT_BODY, FONT_CAPTION, FONT_DISPLAY} from './style';

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

const CYRILLIC = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';

type Face = {family: string; file: string; weight: string; style?: string};

const FACES: Face[] = [
  {family: FONT_DISPLAY, file: 'playfair-display', weight: '400 900'},
  {family: FONT_DISPLAY, file: 'playfair-display', weight: '400 900', style: 'italic'},
  {family: FONT_BODY, file: 'source-sans-3', weight: '200 900'},
  {family: FONT_CAPTION, file: 'inter', weight: '100 900'},
];

let promise: Promise<void> | null = null;
let done = false;

const loadAll = (): Promise<void> => {
  if (promise) {
    return promise;
  }
  const jobs: Promise<void>[] = [];
  for (const f of FACES) {
    const style = f.style ?? 'normal';
    for (const [subset, range] of [
      ['latin', LATIN],
      ['latin-ext', LATIN_EXT],
    ] as const) {
      jobs.push(
        loadFont({
          family: f.family,
          url: staticFile(`fonts/${f.file}-${subset}-wght-${style}.woff2`),
          weight: f.weight,
          style,
          unicodeRange: range,
          display: 'block',
        }),
      );
    }
  }
  // Кириллица нужна только для служебных подписей (тестовые листы для владельца).
  jobs.push(
    loadFont({
      family: FONT_CAPTION,
      url: staticFile('fonts/inter-cyrillic-wght-normal.woff2'),
      weight: '100 900',
      unicodeRange: CYRILLIC,
      display: 'block',
    }),
  );
  promise = Promise.all(jobs).then(() => {
    done = true;
  });
  return promise;
};

/**
 * true, когда шрифты загружены. Пока false — кадр не рисуем: иначе текст измерится
 * запасным шрифтом и строки разобьются неправильно.
 */
export const useFontsReady = (): boolean => {
  const [ready, setReady] = useState(done);
  const [handle] = useState(() => (done ? null : delayRender('Загрузка шрифтов')));
  useEffect(() => {
    if (done) {
      setReady(true);
      if (handle !== null) {
        continueRender(handle);
      }
      return;
    }
    loadAll()
      .then(() => {
        setReady(true);
        if (handle !== null) {
          continueRender(handle);
        }
      })
      .catch((err) => cancelRender(err));
  }, [handle]);
  return ready;
};
