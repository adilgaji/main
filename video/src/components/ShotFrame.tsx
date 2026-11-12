// Каркас любого кадра. Слои снизу вверх:
//   1. картинка (фон + содержимое) — к ней применяется обработка стиля и движение камеры;
//   2. зерно и затемнение краёв;
//   3. текст (заголовки, подписи, субтитры) — всегда чёткий, обработка его не касается.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {CLAMP, EASE} from '../lib/anim';
import {useStyle} from '../style';
import {Tiled} from './Tiled';

export type Drift = {
  /** Масштаб в начале и в конце кадра (1 = без увеличения) */
  from: number;
  to: number;
  /** Сдвиг в пикселях к концу кадра */
  dx?: number;
  dy?: number;
  /** Точка, вокруг которой идёт увеличение, например «50% 40%» */
  origin?: string;
};

const DriftLayer: React.FC<{frames: number; drift: Drift; children: React.ReactNode}> = ({frames, drift, children}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        transformOrigin: drift.origin ?? '50% 50%',
        scale: interpolate(frame, [0, frames], [drift.from, drift.to], {...CLAMP, easing: EASE.inOut}),
        translate: interpolate(frame, [0, frames], ['0px 0px', `${drift.dx ?? 0}px ${drift.dy ?? 0}px`], {
          ...CLAMP,
          easing: EASE.inOut,
        }),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const {treatment} = useStyle();
  if (treatment.grainOpacity <= 0) {
    return null;
  }
  // Зерно «пляшет»: раз в несколько кадров текстура сдвигается на случайное место.
  // Чем реже — тем меньше весит готовый файл (шум плохо сжимается).
  const step = Math.floor(frame / Math.max(1, treatment.grainEvery));
  return <Tiled file={treatment.grainTexture} size={512} offsetX={(step * 173) % 512} offsetY={(step * 311) % 512} opacity={treatment.grainOpacity} blend="overlay" />;
};

const Vignette: React.FC = () => {
  const {treatment} = useStyle();
  if (treatment.vignette <= 0) {
    return null;
  }
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 75% 75% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,${treatment.vignette}) 100%)`,
        pointerEvents: 'none',
      }}
    />
  );
};

export const ShotFrame: React.FC<{
  frames: number;
  art: React.ReactNode;
  text?: React.ReactNode;
  drift?: Drift | null;
}> = ({frames, art, text, drift}) => {
  const style = useStyle();
  return (
    <AbsoluteFill style={{backgroundColor: style.palette.bg, overflow: 'hidden'}}>
      <AbsoluteFill style={{filter: style.treatment.filter}}>
        {drift ? (
          <DriftLayer frames={frames} drift={drift}>
            {art}
          </DriftLayer>
        ) : (
          art
        )}
      </AbsoluteFill>
      <Vignette />
      <Grain />
      <AbsoluteFill>{text}</AbsoluteFill>
    </AbsoluteFill>
  );
};
