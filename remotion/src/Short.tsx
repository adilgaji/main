/**
 * Главная композиция ролика: строго по подтверждённой раскадровке.
 * Кадр i показывается с shots[i].start до shots[i].end (секунды озвучки),
 * поверх — «караоке»-субтитры, под ними — голос.
 */
import React from 'react';
import {Audio} from '@remotion/media';
import {AbsoluteFill, CalculateMetadataFunction, Sequence, staticFile, useVideoConfig} from 'remotion';
import {COLORS, VIDEO, loadFonts} from './style';
import {KaraokeCaptions, Word} from './lib/Captions';
import {Shot, ShotCtx, ShotTransition} from './templates/shot';
import {GuideT, TEMPLATES} from './templates/Templates';
import {StyleId, applyTheme} from './styles/themes';
import {StyleOverlay} from './styles/StyleLayer';

loadFonts();

export type ShortProps = {audio: string; words: Word[]; shots: Shot[]; total: number; music?: string | null; style?: StyleId};

export const calcShort: CalculateMetadataFunction<ShortProps> = ({props}) => ({
  durationInFrames: Math.max(1, Math.round((props.total || 10) * VIDEO.fps)),
});

export const Short: React.FC<ShortProps> = ({audio, words, shots, music, style = 'classic'}) => {
  const {fps} = useVideoConfig();
  applyTheme(style); // палитра стиля — до отрисовки всех кадров
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      {shots.map((s) => {
        const T = TEMPLATES[s.template] ?? GuideT;
        const from = Math.round(s.start * fps);
        const to = Math.round(s.end * fps);
        return (
          <Sequence key={s.id} name={`${s.id}. ${s.template}`} from={from} durationInFrames={Math.max(1, to - from)}>
            <ShotCtx.Provider value={{shot: s, words, style}}>
              <ShotTransition transition={s.transition}>
                <T />
              </ShotTransition>
            </ShotCtx.Provider>
          </Sequence>
        );
      })}
      <StyleOverlay style={style}>
        <KaraokeCaptions words={words} />
      </StyleOverlay>
      <Audio src={staticFile(audio)} />
      {music ? <Audio src={staticFile(music)} volume={0.08} loop /> : null}
    </AbsoluteFill>
  );
};
