// Загрузка данных из public/ с ожиданием: рендер не делает снимок кадра,
// пока данные карты не загрузились И не попали на экран.
// (Картинки и текстуры ставятся тегом <Img> — он ждёт загрузки сам.)
import {useEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';

const jsonCache = new Map<string, unknown>();
const jsonPending = new Map<string, Promise<unknown>>();

const fetchJson = (file: string): Promise<unknown> => {
  const existing = jsonPending.get(file);
  if (existing) {
    return existing;
  }
  const p = fetch(staticFile(file))
    .then((r) => {
      if (!r.ok) {
        throw new Error(`Не удалось загрузить ${file}: ${r.status}`);
      }
      return r.json();
    })
    .then((data) => {
      jsonCache.set(file, data);
      return data;
    });
  jsonPending.set(file, p);
  return p;
};

/**
 * Держит рендер на паузе, пока ready не станет true и React не перерисует кадр.
 * Пауза ставится сразу при первом вызове (а не в useEffect), иначе снимок кадра
 * может быть сделан раньше, чем начнётся загрузка.
 */
const useHold = (key: string, ready: boolean, label: string): void => {
  const hold = useRef<{key: string; handle: number} | null>(null);
  if (!ready && hold.current?.key !== key) {
    if (hold.current) {
      continueRender(hold.current.handle);
    }
    hold.current = {key, handle: delayRender(label)};
  }
  useEffect(() => {
    if (ready && hold.current) {
      continueRender(hold.current.handle);
      hold.current = null;
    }
  }, [ready, key]);
  useEffect(
    () => () => {
      if (hold.current) {
        continueRender(hold.current.handle);
        hold.current = null;
      }
    },
    [],
  );
};

/** Возвращает данные из public/<file> или null, пока они грузятся. */
export const useStaticJson = <T,>(file: string | null): T | null => {
  const [, bump] = useState(0);
  const data = file ? ((jsonCache.get(file) as T | undefined) ?? null) : null;
  useHold(file ?? '', file === null || data !== null, `Загрузка ${file}`);
  useEffect(() => {
    if (!file || jsonCache.has(file)) {
      return;
    }
    let alive = true;
    fetchJson(file)
      .then(() => {
        if (alive) {
          bump((n) => n + 1);
        }
      })
      .catch((err) => cancelRender(err));
    return () => {
      alive = false;
    };
  }, [file]);
  return data;
};
