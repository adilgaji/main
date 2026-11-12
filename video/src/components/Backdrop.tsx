// Фоны-«среда». У каждого кадра свой фон; соседние кадры не должны совпадать,
// поэтому есть несколько видов, а зерно (seed) делает даже одинаковые виды разными.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {alpha, mix, rng} from '../lib/anim';
import {useStyle} from '../style';
import {Tiled} from './Tiled';

export type BackdropKind = 'ink' | 'parchment' | 'stone' | 'dusk' | 'vault';

export const BACKDROP_KINDS: BackdropKind[] = ['ink', 'parchment', 'stone', 'dusk', 'vault'];

const Texture: React.FC<{file: string; size: number; opacity: number; blend: string; seed: number}> = ({file, size, opacity, blend, seed}) => {
  const r = rng(seed);
  return <Tiled file={file} size={size} offsetX={Math.round(r() * size)} offsetY={Math.round(r() * size)} opacity={opacity} blend={blend as React.CSSProperties['mixBlendMode']} />;
};

export const Backdrop: React.FC<{kind: BackdropKind; seed?: number}> = ({kind, seed = 1}) => {
  const {palette: p, treatment} = useStyle();
  const r = rng(seed * 7919 + 13);
  const cx = Math.round(25 + r() * 50);
  const cy = Math.round(20 + r() * 45);
  const tex = treatment.paperOpacity;

  if (kind === 'parchment') {
    return (
      <AbsoluteFill>
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 90% 80% at ${cx}% ${cy}%, ${mix(p.paper, '#ffffff', 0.25)} 0%, ${p.paper} 45%, ${p.paperShade} 100%)`,
          }}
        />
        <Texture file="textures/paper.png" size={1024} opacity={tex * 1.1} blend="multiply" seed={seed} />
        <AbsoluteFill style={{boxShadow: `inset 0 0 260px ${alpha(mix(p.paperShade, p.ink, 0.45), 0.55)}`}} />
      </AbsoluteFill>
    );
  }
  if (kind === 'stone') {
    const top = mix(p.bg, p.lightSoft, 0.34);
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{background: `linear-gradient(${150 + Math.round(r() * 40)}deg, ${top} 0%, ${mix(p.bg, p.lightSoft, 0.12)} 55%, ${p.bg} 100%)`}} />
        <Texture file="textures/linen.png" size={512} opacity={tex * 0.8} blend="overlay" seed={seed} />
        <Texture file="textures/paper.png" size={1024} opacity={tex * 0.5} blend="overlay" seed={seed + 5} />
      </AbsoluteFill>
    );
  }
  if (kind === 'dusk') {
    return (
      <AbsoluteFill>
        <AbsoluteFill
          style={{
            background: `linear-gradient(180deg, ${mix(p.bg, p.accent2, 0.42)} 0%, ${mix(p.bg, p.accent2, 0.16)} 48%, ${p.bg} 100%)`,
          }}
        />
        <AbsoluteFill style={{background: `radial-gradient(ellipse 60% 45% at ${cx}% 8%, ${alpha(p.accent, 0.35)} 0%, ${alpha(p.accent, 0)} 100%)`}} />
        <Texture file="textures/paper.png" size={1024} opacity={tex * 0.6} blend="overlay" seed={seed} />
      </AbsoluteFill>
    );
  }
  if (kind === 'vault') {
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{background: `linear-gradient(180deg, ${p.bgAlt} 0%, ${p.bg} 100%)`}} />
        <AbsoluteFill style={{background: `radial-gradient(ellipse 55% 70% at ${cx}% 0%, ${alpha(p.light, 0.22)} 0%, ${alpha(p.light, 0)} 100%)`}} />
        <Texture file="textures/linen.png" size={512} opacity={tex * 0.6} blend="overlay" seed={seed} />
      </AbsoluteFill>
    );
  }
  // ink — тёмный фон с пятном света
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 85% 85% at ${cx}% ${cy}%, ${p.bgAlt} 0%, ${p.bg} 78%)`}} />
      <Texture file="textures/paper.png" size={1024} opacity={tex * 0.7} blend="overlay" seed={seed} />
    </AbsoluteFill>
  );
};
