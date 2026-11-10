/**
 * Мышечное волокно крупным планом и его восстановление.
 * Анатомия (учебник гистологии): волокно — длинная многоядерная клетка,
 * ядра лежат по краю (под мембраной), поперечная исчерченность (саркомеры).
 * Клетки-сателлиты сидят на поверхности волокна (под базальной мембраной).
 * После повреждения: иммунные клетки (нейтрофилы, затем макрофаги) убирают
 * обломки → клетки-сателлиты активируются, делятся и сливаются с волокном →
 * синтез белка восстанавливает и утолщает волокно.
 */
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS} from '../style';
import {useSvgId} from './svgId';

export type FiberState = {
  damage?: number; // 0..1 видимость микроразрывов
  macrophages?: number; // 0..1 иммунные клетки подплыли
  clearing?: number; // 0..1 обломки убраны
  satellites?: number; // 0..1 клетки-сателлиты «проснулись» (светятся)
  fuse?: number; // 0..1 сателлиты слились с волокном
  protein?: number; // 0..1 поток белка
  thicken?: number; // 0..1 утолщение
};

const TEARS = [
  {x: 250, y: 170},
  {x: 380, y: 230},
  {x: 520, y: 160},
  {x: 600, y: 240},
];
const SATS = [
  {x: 300, y: 110},
  {x: 470, y: 290},
  {x: 640, y: 110},
];

export const MuscleFiber: React.FC<FiberState & {width?: number; style?: React.CSSProperties}> = ({
  damage = 0,
  macrophages = 0,
  clearing = 0,
  satellites = 0,
  fuse = 0,
  protein = 0,
  thicken = 0,
  width = 900,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const clipId = useSvgId('fiber');
  const h = 180 * (1 + 0.14 * thicken); // толщина волокна
  const top = 200 - h / 2;
  const bottom = 200 + h / 2;
  const tearVis = damage * (1 - clearing);

  return (
    <svg viewBox="0 0 800 400" width={width} height={(width * 400) / 800} style={{overflow: 'visible', ...style}}>
      <defs>
        <clipPath id={clipId}>
          <rect x={40} y={top} width={720} height={h} rx={h / 2} />
        </clipPath>
      </defs>
      {/* тело волокна */}
      <rect x={40} y={top} width={720} height={h} rx={h / 2} fill={COLORS.muscle} />
      {/* поперечная исчерченность (саркомеры) */}
      <g clipPath={`url(#${clipId})`}>
        {Array.from({length: 36}, (_, i) => (
          <rect key={i} x={50 + i * 20} y={top} width={8} height={h} fill={COLORS.muscleDark} opacity={0.55} />
        ))}
        {/* миофибриллы — продольные линии */}
        {[-2, -1, 0, 1, 2].map((k) => (
          <line key={k} x1={40} x2={760} y1={200 + (k * h) / 6} y2={200 + (k * h) / 6} stroke={COLORS.muscleDark} strokeWidth={2} opacity={0.4} />
        ))}
        {/* поток белка внутри волокна */}
        {protein > 0 &&
          Array.from({length: 14}, (_, i) => {
            const x = 40 + ((i * 53 + t * 140) % 720);
            const y = 200 + Math.sin(i * 2.1) * (h / 3);
            return (
              <g key={i} opacity={protein}>
                <circle cx={x} cy={y} r={7} fill={COLORS.hormoneAlt} />
                <circle cx={x + 12} cy={y + 3} r={5} fill={COLORS.proven} />
              </g>
            );
          })}
      </g>
      {/* блик мембраны */}
      <rect x={40} y={top} width={720} height={h} rx={h / 2} fill="none" stroke="#FFD9CC" strokeWidth={5} opacity={0.6} />
      {/* ядра по краю волокна */}
      {[140, 330, 560, 690].map((x, i) => (
        <ellipse key={i} cx={x} cy={i % 2 ? bottom - 16 : top + 16} rx={26} ry={9} fill={COLORS.nucleus} opacity={0.9} />
      ))}
      {/* микроразрывы */}
      <g stroke="#FFF4E8" strokeWidth={6} strokeLinecap="round" fill="none" opacity={tearVis}>
        {TEARS.map((p, i) => (
          <path key={i} d={`M ${p.x - 18} ${p.y - 10} L ${p.x - 6} ${p.y + 8} L ${p.x + 6} ${p.y - 8} L ${p.x + 18} ${p.y + 10}`} />
        ))}
      </g>
      {/* обломки */}
      {TEARS.map((p, i) => (
        <g key={i} opacity={damage * (1 - clearing)}>
          <circle cx={p.x + 30} cy={p.y - 34} r={6} fill="#C9C1B4" />
          <circle cx={p.x - 26} cy={p.y + 30} r={5} fill="#C9C1B4" />
        </g>
      ))}
      {/* макрофаги: подплывают к разрывам */}
      {TEARS.map((p, i) => {
        const dx = (1 - macrophages) * (i % 2 ? 260 : -260);
        const dy = (1 - macrophages) * (i % 2 ? 140 : -140);
        const wob = Math.sin(t * 4 + i) * 4;
        return (
          <g key={i} transform={`translate(${p.x + dx} ${p.y + (i % 2 ? 70 : -70) + dy})`} opacity={macrophages * (1 - clearing * 0.6)}>
            <path
              d={`M -30 0 C -32 -22, -10 -${30 + wob}, 6 -26 C 24 -30, ${34 + wob} -10, 30 6 C 34 24, 10 32, -6 28 C -24 ${32 - wob}, -28 16, -30 0 Z`}
              fill={COLORS.hormone}
              stroke="#E4D6FF"
              strokeWidth={3}
            />
            <circle cx={-2} cy={2} r={10} fill="#6B4FB8" />
          </g>
        );
      })}
      {/* клетки-сателлиты на поверхности волокна */}
      {SATS.map((p, i) => {
        const onTop = p.y < 200;
        const surfaceY = onTop ? top - 8 : bottom + 8;
        const cy = surfaceY + (onTop ? 1 : -1) * fuse * 40;
        return (
          <g key={i} opacity={satellites > 0 ? 1 - fuse * 0.85 : 0.0}>
            <ellipse cx={p.x} cy={cy} rx={30} ry={16} fill={COLORS.proven} opacity={0.25 + satellites * 0.4} style={{filter: `drop-shadow(0 0 ${satellites * 14}px ${COLORS.proven})`}} />
            <ellipse cx={p.x} cy={cy} rx={22} ry={11} fill={COLORS.gland} />
            <circle cx={p.x} cy={cy} r={6} fill={COLORS.glandDark} />
          </g>
        );
      })}
    </svg>
  );
};
