// Текстура, уложенная плиткой на весь кадр.
// По правилам Remotion картинки ставятся тегом <Img>, а не через CSS background-image:
// <Img> сам задерживает снимок кадра, пока файл не загрузился, и текстура не «мигает».
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {useCanvas} from '../lib/canvas';

export const Tiled: React.FC<{
  /** Файл внутри public/ */
  file: string;
  /** Размер плитки в пикселях */
  size: number;
  /** Сдвиг узора (для разных фонов и «живого» зерна) */
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
  blend?: React.CSSProperties['mixBlendMode'];
}> = ({file, size, offsetX = 0, offsetY = 0, opacity = 1, blend}) => {
  const ox = ((offsetX % size) + size) % size;
  const oy = ((offsetY % size) + size) % size;
  const {width, height} = useCanvas();
  const cols = Math.ceil(width / size) + 1;
  const rows = Math.ceil(height / size) + 1;
  const src = staticFile(file);
  const tiles: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push(<Img key={`${r}-${c}`} src={src} style={{position: 'absolute', left: c * size, top: r * size, width: size, height: size, maxWidth: 'none'}} />);
    }
  }
  // Плитки стоят неподвижно, сдвигается только общий контейнер: так кадр считается быстрее.
  return (
    <AbsoluteFill style={{overflow: 'hidden', opacity, mixBlendMode: blend, pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: cols * size, height: rows * size, translate: `${-ox}px ${-oy}px`}}>{tiles}</div>
    </AbsoluteFill>
  );
};
