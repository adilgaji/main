// Глава видео: кадры идут один за другим, поверх — озвучка и субтитры.
// Всё содержимое приходит снаружи (из раскадровки) в виде данных.
import {Audio} from '@remotion/media';
import React from 'react';
import {AbsoluteFill, Sequence, staticFile, type CalculateMetadataFunction} from 'remotion';
import {Captions, type CaptionWord} from './components/Captions';
import {useFontsReady} from './fonts';
import {Shot, type ShotSpec} from './shots';
import {FRAME, getStyle, StyleContext} from './style';

export type TimedShot = {
  /** Первый кадр и длительность в кадрах (от начала главы) */
  start: number;
  frames: number;
  shot: ShotSpec;
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

/** Общая обёртка: стиль + ожидание шрифтов. */
export const Stage: React.FC<{styleId?: string | null; children: React.ReactNode}> = ({styleId, children}) => {
  const ready = useFontsReady();
  const style = getStyle(styleId);
  return (
    <StyleContext.Provider value={style}>
      <AbsoluteFill style={{backgroundColor: style.palette.bg}}>{ready ? children : null}</AbsoluteFill>
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
        <Shot spec={s.shot} frames={s.frames} />
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
