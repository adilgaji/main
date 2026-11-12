// Общие помощники анимации. Вся анимация считается от номера кадра
// (никаких CSS-переходов), поэтому рендер всегда одинаковый.
import {Easing, interpolate} from 'remotion';

export const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const EASE = {
  /** Быстрый старт, мягкая остановка */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** Плавно в обе стороны — для движения камеры */
  inOut: Easing.bezier(0.45, 0, 0.55, 1),
  soft: Easing.bezier(0.33, 1, 0.68, 1),
};

/** 0 → 1 начиная с кадра start за dur кадров. */
export const ramp = (frame: number, start: number, dur: number, easing: (t: number) => number = EASE.out): number =>
  interpolate(frame, [start, start + Math.max(1, dur)], [0, 1], {...CLAMP, easing});

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Генератор случайных чисел с зерном: одно и то же зерно — одна и та же картинка. */
export const rng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** Добавляет прозрачность к цвету вида #RRGGBB. */
export const alpha = (hex: string, a: number): string => {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/** Смешивает два цвета #RRGGBB. t = 0 — первый, 1 — второй. */
export const mix = (c1: string, c2: string, t: number): string => {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [a, b] = [p(c1), p(c2)];
  const v = a.map((x, i) => Math.round(lerp(x, b[i], t)));
  return `#${v.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
};

/** Число с разделителями: 2641610 → 2,641,610 */
export const formatNumber = (n: number): string => Math.round(n).toLocaleString('en-US');

/** Год для экрана: -480 → «480 BC», 1066 → «1066», 79 → «AD 79». */
export const formatYear = (y: number): string => {
  const r = Math.round(y);
  if (r < 0) {
    return `${-r} BC`;
  }
  if (r === 0) {
    return '1 BC';
  }
  return r < 1000 ? `AD ${r}` : `${r}`;
};
