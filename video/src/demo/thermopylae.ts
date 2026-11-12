// Содержимое тестовых кадров. Тема — Фермопилы, 480 год до н. э.
// Даже в образцах нет выдуманных фактов: числа и цитата взяты из Геродота
// («История», книга 7, перевод A. D. Godley, 1920 — общественное достояние),
// текст открыт на сайте Perseus Digital Library.
import type {MapShotProps} from '../shots/MapShot';

type Demo<T> = Omit<T, 'frames'>;

export const demoMap: Demo<MapShotProps> = {
  view: [19.6, 36.2, 29.6, 41.4],
  viewTo: [21.0, 36.6, 27.2, 41.2],
  title: 'Xerxes marches on Greece',
  subtitle: '480 BC · the route described by Herodotus',
  regions: [
    {
      label: 'Persian Empire',
      color: 'accent2',
      appearAt: 0.5,
      labelAt: [28.6, 39.5],
      polygon: [
        [26.0, 40.0], [26.7, 40.5], [27.6, 40.6], [29.0, 41.3], [38.0, 42.5], [38.0, 34.0],
        [29.0, 35.8], [27.9, 36.4], [27.2, 36.6], [27.0, 37.6], [26.2, 38.3], [26.6, 39.0], [26.0, 39.5],
      ],
    },
  ],
  routes: [
    {
      startAt: 1.2,
      duration: 3.6,
      color: 'accent2',
      points: [
        [28.04, 38.49], [27.3, 39.3], [26.6, 39.9], [26.41, 40.19], [26.35, 40.6], [26.0, 40.87],
        [24.9, 40.95], [23.9, 40.75], [22.95, 40.63], [22.5, 40.1], [22.42, 39.64], [22.45, 39.15], [22.54, 38.8],
      ],
    },
  ],
  places: [
    {name: 'Sardis', at: [28.04, 38.49], kind: 'capital', appearAt: 0.8, label: 'right'},
    {name: 'Hellespont', at: [26.41, 40.19], kind: 'city', appearAt: 2.0, label: 'top'},
    {name: 'Athens', at: [23.73, 37.98], kind: 'city', appearAt: 0.6, label: 'right'},
    {name: 'Sparta', at: [22.43, 37.07], kind: 'city', appearAt: 0.6, label: 'left'},
    {name: 'Thermopylae', at: [22.54, 38.8], kind: 'battle', appearAt: 4.6, label: 'left'},
  ],
  labels: [{text: 'AEGEAN SEA', at: [25.2, 37.6], kind: 'sea', size: 46}],
};
