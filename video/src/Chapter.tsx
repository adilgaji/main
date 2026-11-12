// Глава видео: кадры идут один за другим, поверх — озвучка и субтитры.
// Всё содержимое приходит снаружи (из раскадровки) в виде данных.
import {Audio} from '@remotion/media';
import React from 'react';
import {AbsoluteFill, Sequence, staticFile, type CalculateMetadataFunction} from 'remotion';
import {Captions, type CaptionWord} from './components/Captions';
import {useFontsReady} from './fonts';
import {Shot, type ShotSpec} from './shots';
import {FONT, FRAME, getStyle, StyleContext, type StyleDef} from './style';

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
