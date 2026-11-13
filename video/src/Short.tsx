// Short: вертикальный ролик 1080x1920 из тех же кадров, что и видео.
// Карта, архивное изображение, цитата и рассказчик перестраиваются под вертикальный холст;
// остальные кадры (таймлайн, инфографика, схема, сцена, сравнение) идут в рамке 16:9,
// над ними — название Short, под ними — крупные субтитры.
import {Audio} from '@remotion/media';
import React from 'react';
import {AbsoluteFill, Sequence, staticFile, type CalculateMetadataFunction} from 'remotion';
import {Stage, TransitionLayer, type TimedShot} from './Chapter';
import {Backdrop} from './components/Backdrop';
import {Captions, type CaptionWord} from './components/Captions';
import {Appear} from './components/TextBits';
import {alpha} from './lib/anim';
import {CanvasContext, HORIZONTAL, VERTICAL} from './lib/canvas';
import {Shot, type ShotSpec} from './shots';
import {FRAME, useStyle} from './style';

export type ShortProps = {
  styleId?: string | null;
  /** Название Short — над кадрами «в рамке» */
  title: string;
  audio?: string | null;
  words?: CaptionWord[];
  shots: TimedShot[];
  totalFrames?: number;
};

/** Эти кадры умеют перестраиваться под вертикальный холст. */
export const NATIVE_VERTICAL = new Set<ShotSpec['type']>(['map', 'kenburns', 'quote', 'narrator']);

const BOX_W = VERTICAL.width;
const BOX_H = Math.round((BOX_W * FRAME.height) / FRAME.width);
const BOX_TOP = 520;

const Framed: React.FC<{spec: ShotSpec; frames: number; title: string; seed: number}> = ({spec, frames, title, seed}) => {
  const {palette: p, fonts} = useStyle();
  return (
    <AbsoluteFill>
      <Backdrop kind={seed % 2 ? 'vault' : 'ink'} seed={seed} />
      <Appear delay={0.1} rise={16} style={{position: 'absolute', left: VERTICAL.safe.left, right: VERTICAL.safe.right, top: VERTICAL.safe.top, height: BOX_TOP - VERTICAL.safe.top - 40, display: 'flex', alignItems: 'flex-end'}}>
        <div style={{fontFamily: fonts.display, fontWeight: 800, fontSize: 66, lineHeight: 1.08, color: p.light, textShadow: `0 3px 16px ${alpha('#000000', 0.6)}`}}>{title}</div>
      </Appear>
      <div style={{position: 'absolute', left: 0, top: BOX_TOP - 6, width: BOX_W, height: BOX_H + 12, backgroundColor: p.accent}} />
      <div style={{position: 'absolute', left: 0, top: BOX_TOP, width: BOX_W, height: BOX_H, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: FRAME.width, height: FRAME.height, transformOrigin: '0 0', scale: BOX_W / FRAME.width}}>
          <CanvasContext.Provider value={HORIZONTAL}>
            <AbsoluteFill>
              <Shot spec={spec} frames={frames} />
            </AbsoluteFill>
          </CanvasContext.Provider>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const shortFrames = (props: ShortProps): number => props.totalFrames ?? Math.max(1, ...props.shots.map((s) => s.start + s.frames));

export const calculateShortMetadata: CalculateMetadataFunction<ShortProps> = ({props}) => ({
  durationInFrames: shortFrames(props),
  fps: FRAME.fps,
  width: VERTICAL.width,
  height: VERTICAL.height,
});

export const Short: React.FC<ShortProps> = ({styleId, title, audio, words, shots}) => (
  <CanvasContext.Provider value={VERTICAL}>
    <Stage styleId={styleId}>
      {shots.map((s, i) => (
        <Sequence key={i} from={s.start} durationInFrames={s.frames} name={`${i + 1}. ${s.shot.type}`}>
          <TransitionLayer item={s}>
            {NATIVE_VERTICAL.has(s.shot.type) ? <Shot spec={s.shot} frames={s.frames} /> : <Framed spec={s.shot} frames={s.frames} title={title} seed={i + 3} />}
          </TransitionLayer>
        </Sequence>
      ))}
      {words?.length ? (
        <AbsoluteFill>
          <Captions words={words} />
        </AbsoluteFill>
      ) : null}
      {audio ? <Audio src={staticFile(audio)} /> : null}
    </Stage>
  </CanvasContext.Provider>
);
