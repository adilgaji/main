// Шрифты лежат в public/fonts (лицензия SIL OFL) и грузятся с диска:
// рендер не зависит от интернета. Грузятся только шрифты выбранного стиля.
import {loadFont} from '@remotion/fonts';
import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {FONT_FILES} from './fontFaces';

const jobs = new Map<string, Promise<void>>();
const done = new Set<string>();

const loadFamily = (family: string): Promise<void> => {
  const known = jobs.get(family);
  if (known) {
    return known;
  }
  const faces = FONT_FILES[family];
  if (!faces) {
    return Promise.reject(new Error(`Шрифт «${family}» не описан в fontFaces.ts`));
  }
  const job = Promise.all(
    faces.map((f) =>
      loadFont({family, url: staticFile(`fonts/${f.file}`), weight: f.weight, style: f.style, unicodeRange: f.range, display: 'block'}),
    ),
  ).then(() => {
    done.add(family);
  });
  jobs.set(family, job);
  return job;
};

/**
 * true, когда шрифты загружены. Пока false — кадр не рисуем: иначе текст измерится
 * запасным шрифтом и строки разобьются неправильно.
 */
export const useFontsReady = (families: string[]): boolean => {
  const key = [...new Set(families)].sort().join('|');
  const [ready, setReady] = useState(() => families.every((f) => done.has(f)));
  const [handle] = useState(() => (families.every((f) => done.has(f)) ? null : delayRender(`Загрузка шрифтов: ${key}`)));
  useEffect(() => {
    if (families.every((f) => done.has(f))) {
      setReady(true);
      if (handle !== null) {
        continueRender(handle);
      }
      return;
    }
    Promise.all(families.map(loadFamily))
      .then(() => {
        setReady(true);
        if (handle !== null) {
          continueRender(handle);
        }
      })
      .catch((err) => cancelRender(err));
    // key — то же, что families, но стабильное по значению
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, handle]);
  return ready;
};
