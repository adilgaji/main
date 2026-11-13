/**
 * Главная композиция ролика: строго по подтверждённой раскадровке.
 * Кадр i показывается с shots[i].start до shots[i].end (секунды озвучки),
 * поверх — «караоке»-субтитры, под ними — голос.
 */
import React from 'react';
import {Audio} from '@remotion/media';
import {AbsoluteFill, CalculateMetadataFunction, Freeze, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, VIDEO, loadFonts} from './style';
import {KaraokeCaptions, Word} from './lib/Captions';
import {Shot, ShotCtx, ShotTransition} from './templates/shot';
import {GuideT, TEMPLATES} from './templates/Templates';
import {StyleId, applyTheme} from './styles/themes';
import {StyleOverlay, setFrame} from './styles/StyleLayer';
import {pickEnvs, setEnvSize} from './lib/Env';
import {FONT_FAMILY, COLORS as C, TYPE} from './style';

loadFonts();

export type ShortProps = {audio: string; words: Word[]; shots: Shot[]; total: number; music?: string | null; style?: StyleId};

export const calcShort: CalculateMetadataFunction<ShortProps> = ({props}) => ({
  durationInFrames: Math.max(1, Math.round((props.total || 10) * VIDEO.fps)),
});

/** Петля: последние кадры плавно превращаются в первый кадр ролика (endless loop). */
const LOOP_SEC = 0.5;
const LoopBack: React.FC<{children: React.ReactNode}> = ({children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const k = interpolate(frame, [0, LOOP_SEC * fps], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{opacity: k}}>{children}</AbsoluteFill>;
};

/** Короткий дисклеймер в конце ролика — маленькой строкой, петлю не ломает. */
const Disclaimer: React.FC = () => (
  <div style={{position: 'absolute', left: 0, right: 0, top: 1100, textAlign: 'center'}}>
    <span style={{fontFamily: FONT_FAMILY, fontWeight: 700, fontSize: 28, color: C.ink, background: C.bgSoft, opacity: 0.85, borderRadius: 999, padding: '6px 20px'}}>Educational, not medical advice</span>
  </div>
);

export const Short: React.FC<ShortProps> = ({audio, words, shots, music, style = 'classic'}) => {
  const {fps, durationInFrames} = useVideoConfig();
  applyTheme(style); // палитра стиля — до отрисовки всех кадров
  setEnvSize(VIDEO.width, VIDEO.height);
  setFrame(VIDEO.width, VIDEO.height, null);
  const envs = pickEnvs(shots);
  const first = shots[0];
  const FirstT = first ? TEMPLATES[first.template] ?? GuideT : null;
  const loopFrom = durationInFrames - Math.round(LOOP_SEC * fps);
  const last = shots[shots.length - 1];
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      {shots.map((s, i) => {
        const T = TEMPLATES[s.template] ?? GuideT;
        const from = Math.round(s.start * fps);
        const to = Math.round(s.end * fps);
        // первый кадр всегда без перехода — чтобы петля склеивалась с концом
        const shot = i === 0 ? {...s, transition: 'cut' as const} : s;
        return (
          <Sequence key={s.id} name={`${s.id}. ${s.template} · ${envs[i]}`} from={from} durationInFrames={Math.max(1, to - from)}>
            <ShotCtx.Provider value={{shot, words, style, env: envs[i]}}>
              <ShotTransition transition={shot.transition}>
                <T />
              </ShotTransition>
            </ShotCtx.Provider>
          </Sequence>
        );
      })}
      {FirstT && first && (
        <Sequence name="loop → начало" from={loopFrom} durationInFrames={durationInFrames - loopFrom}>
          <LoopBack>
            <Freeze frame={0}>
              <ShotCtx.Provider value={{shot: {...first, transition: 'cut'}, words, style, env: envs[0]}}>
                <FirstT />
              </ShotCtx.Provider>
            </Freeze>
          </LoopBack>
        </Sequence>
      )}
      {last && (
        <Sequence name="дисклеймер" from={Math.round(last.start * fps)} durationInFrames={Math.max(1, loopFrom - Math.round(last.start * fps))}>
          <StyleOverlay style={style}>
            <Disclaimer />
          </StyleOverlay>
        </Sequence>
      )}
      <StyleOverlay style={style}>
        <KaraokeCaptions words={words} />
      </StyleOverlay>
      <Audio src={staticFile(audio)} />
      {music ? <Audio src={staticFile(music)} volume={0.08} loop /> : null}
    </AbsoluteFill>
  );
};
