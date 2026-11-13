// Глава видео: кадры идут один за другим, поверх — озвучка и субтитры.
// Всё содержимое приходит снаружи (из раскадровки) в виде данных.
import {Audio} from '@remotion/media';
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, type CalculateMetadataFunction} from 'remotion';
import {Captions, type CaptionWord} from './components/Captions';
import {OverflowProbe} from './components/OverflowProbe';
import {useFontsReady} from './fonts';
import {CLAMP, EASE} from './lib/anim';
import {Shot, type ShotSpec} from './shots';
import {FONT, FRAME, getStyle, StyleContext, type StyleDef} from './style';

/** Переход между кадрами. Длительность и вид задаёт сборщик главы (factory/storyboard.py). */
export type TransitionKind = 'cut' | 'fade' | 'slide' | 'wipe' | 'zoom' | 'dip';
export type Transition = {kind: TransitionKind; frames: number};

export type TimedShot = {
  /** Первый кадр и длительность в кадрах (от начала главы) — уже вместе с «нахлёстом» на переход */
  start: number;
  frames: number;
  shot: ShotSpec;
  /** Как кадр входит (первые enter.frames кадров) и как уходит (последние exit.frames кадров) */
  enter?: Transition | null;
  exit?: Transition | null;
};

/**
 * Переход: новый кадр лежит поверх старого и проявляется / выезжает / открывается шторкой.
 * «dip» — проявление из фона и уход в фон (начало и конец главы).
 */
export const TransitionLayer: React.FC<{item: TimedShot; children: React.ReactNode}> = ({item, children}) => {
  const frame = useCurrentFrame();
  let opacity = 1;
  let shiftX = 0;
  let scale = 1;
  let clip: string | undefined;
  const en = item.enter;
  if (en && en.frames > 0 && en.kind !== 'cut') {
    const k = interpolate(frame, [0, en.frames], [0, 1], {...CLAMP, easing: EASE.inOut});
    if (en.kind === 'slide') {
      shiftX += (1 - k) * 100;
    } else if (en.kind === 'wipe') {
      clip = `inset(0 ${(1 - k) * 100}% 0 0)`;
    } else {
      opacity *= k;
      if (en.kind === 'zoom') {
        scale *= 1.1 - 0.1 * k;
      }
    }
  }
  const ex = item.exit;
  if (ex && ex.frames > 0 && ex.kind !== 'cut') {
    const k = interpolate(frame, [item.frames - ex.frames, item.frames], [0, 1], {...CLAMP, easing: EASE.inOut});
    if (ex.kind === 'dip') {
      opacity *= 1 - k;
    } else if (ex.kind === 'slide') {
      shiftX -= k * 22;
    } else if (ex.kind === 'zoom') {
      scale *= 1 + 0.05 * k;
    }
  }
  return (
    <AbsoluteFill data-moving={shiftX !== 0 || scale !== 1 || clip ? '1' : undefined} style={{opacity, translate: `${shiftX}% 0px`, scale, clipPath: clip}}>
      {children}
    </AbsoluteFill>
  );
};

export type ChapterProps = {
  styleId?: string | null;
  /** Файл озвучки внутри public/ (или null — без звука) */
  audio?: string | null;
  /** Слова со временем (секунды от начала главы) — для субтитров */
  words?: CaptionWord[];
  shots: TimedShot[];
  captions?: boolean;
  totalFrames?: number;
};

const StageInner: React.FC<{style: StyleDef; families: string[]; children: React.ReactNode}> = ({style, families, children}) => {
  const ready = useFontsReady(families);
  return <AbsoluteFill style={{backgroundColor: style.palette.bg}}>{ready ? children : null}</AbsoluteFill>;
};

/**
 * Общая обёртка: стиль + ожидание шрифтов (только нужных стилю; служебный Inter — всегда).
 * extraFamilies — когда на одном кадре рисуется несколько стилей сразу (листы-образцы).
 */
export const Stage: React.FC<{styleId?: string | null; extraFamilies?: string[]; children: React.ReactNode}> = ({styleId, extraFamilies = [], children}) => {
  const style = getStyle(styleId);
  const families = [...new Set([...style.families, ...extraFamilies, FONT.inter])];
  return (
    <StyleContext.Provider value={style}>
      <StageInner key={style.id} style={style} families={families}>
        {children}
        <OverflowProbe />
      </StageInner>
    </StyleContext.Provider>
  );
};

export const chapterFrames = (props: ChapterProps): number =>
  props.totalFrames ?? Math.max(1, ...props.shots.map((s) => s.start + s.frames));

export const calculateChapterMetadata: CalculateMetadataFunction<ChapterProps> = ({props}) => ({
  durationInFrames: chapterFrames(props),
  fps: FRAME.fps,
  width: FRAME.width,
  height: FRAME.height,
});

export const Chapter: React.FC<ChapterProps> = ({styleId, audio, words, shots, captions = true}) => (
  <Stage styleId={styleId}>
    {shots.map((s, i) => (
      <Sequence key={i} from={s.start} durationInFrames={s.frames} name={`${i + 1}. ${s.shot.type}`}>
        <TransitionLayer item={s}>
          <Shot spec={s.shot} frames={s.frames} />
        </TransitionLayer>
      </Sequence>
    ))}
    {captions && words?.length ? (
      <AbsoluteFill>
        <Captions words={words} />
      </AbsoluteFill>
    ) : null}
    {audio ? <Audio src={staticFile(audio)} /> : null}
  </Stage>
);
