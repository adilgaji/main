/**
 * Длинное горизонтальное видео 1920x1080 (6–7 минут) по раскадровке.
 * Слева — сцена: те же шаблоны кадров, что в Shorts (фон на весь кадр, схема и гид вписаны слева).
 * Справа — колонка: текущая глава, крупные «караоке»-субтитры, прогресс по главам.
 */
import React from 'react';
import {Audio} from '@remotion/media';
import {AbsoluteFill, CalculateMetadataFunction, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, FONT_FAMILY, loadFonts} from './style';
import {KaraokeCaptions, Word} from './lib/Captions';
import {Shot, ShotCtx, ShotTransition} from './templates/shot';
import {GuideT, TEMPLATES} from './templates/Templates';
import {StyleId, applyTheme} from './styles/themes';
import {StyleOverlay, setFrame} from './styles/StyleLayer';
import {pickEnvs, setEnvSize} from './lib/Env';

loadFonts();

export type Chapter = {title: string; start: number};
export type LongProps = {audio: string; words: Word[]; shots: Shot[]; total: number; chapters: Chapter[]; style?: StyleId};

export const LONG = {width: 1920, height: 1080};
// сцена 1080x1920 (зона y 220–1140) вписывается в левые ~1270 px кадра
const STAGE_SCALE = 1.17;
const STAGE = {x: 40, y: -220 * STAGE_SCALE, scale: STAGE_SCALE};
const PANEL = {x: 1330, y: 40, w: 550, h: 1000};

export const calcLong: CalculateMetadataFunction<LongProps> = ({props}) => ({
  durationInFrames: Math.max(1, Math.round((props.total || 10) * 30)),
});

const Panel: React.FC<{chapters: Chapter[]; total: number}> = ({chapters, total}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const idx = Math.max(0, chapters.findIndex((c, i) => t >= c.start && (i === chapters.length - 1 || t < chapters[i + 1].start)));
  const ch = chapters[idx];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h, borderRadius: 36, background: COLORS.bgSoft, opacity: 0.88, boxShadow: `0 0 0 4px ${COLORS.bgGlow}`}} />
      {ch && (
        <div style={{position: 'absolute', left: PANEL.x + 40, top: PANEL.y + 40, width: PANEL.w - 80, fontFamily: FONT_FAMILY}}>
          <div style={{fontWeight: 800, fontSize: 28, letterSpacing: 3, color: COLORS.accent}}>{`CHAPTER ${idx + 1} / ${chapters.length}`}</div>
          <div style={{fontWeight: 900, fontSize: 52, lineHeight: 1.08, color: COLORS.ink, marginTop: 10, textTransform: 'uppercase'}}>{ch.title}</div>
        </div>
      )}
      {/* прогресс по главам */}
      <div style={{position: 'absolute', left: PANEL.x + 40, top: PANEL.y + PANEL.h - 70, width: PANEL.w - 80, display: 'flex', gap: 8}}>
        {chapters.map((c, i) => {
          const end = chapters[i + 1]?.start ?? total;
          const k = Math.min(1, Math.max(0, (t - c.start) / Math.max(0.1, end - c.start)));
          return (
            <div key={i} style={{flex: end - c.start, height: 14, borderRadius: 7, background: COLORS.bgGlow, overflow: 'hidden'}}>
              <div style={{width: `${k * 100}%`, height: '100%', background: i === idx ? COLORS.accent : COLORS.muted}} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Long: React.FC<LongProps> = ({audio, words, shots, chapters, total, style = 'classic'}) => {
  const {fps} = useVideoConfig();
  applyTheme(style);
  setEnvSize(LONG.width, LONG.height);
  setFrame(LONG.width, LONG.height, STAGE);
  const envs = pickEnvs(shots);
  const last = shots[shots.length - 1];
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      {shots.map((s, i) => {
        const T = TEMPLATES[s.template] ?? GuideT;
        const from = Math.round(s.start * fps);
        const to = Math.round(s.end * fps);
        return (
          <Sequence key={s.id} name={`${s.id}. ${s.template} · ${envs[i]}`} from={from} durationInFrames={Math.max(1, to - from)}>
            <ShotCtx.Provider value={{shot: s, words, style, env: envs[i]}}>
              <ShotTransition transition={s.transition}>
                <T />
              </ShotTransition>
            </ShotCtx.Provider>
          </Sequence>
        );
      })}
      <StyleOverlay style={style}>
        <Panel chapters={chapters} total={total} />
        <KaraokeCaptions words={words} layout={{left: PANEL.x + 30, width: PANEL.w - 60, top: 330, minHeight: 520, fontSize: 64, maxWords: 6, maxChars: 30}} />
        {last && (
          <Sequence from={Math.round(last.start * fps)}>
            <div style={{position: 'absolute', left: PANEL.x, width: PANEL.w, top: PANEL.y + PANEL.h - 130, textAlign: 'center', fontFamily: FONT_FAMILY, fontWeight: 700, fontSize: 24, color: COLORS.muted}}>Educational, not medical advice</div>
          </Sequence>
        )}
      </StyleOverlay>
      <Audio src={staticFile(audio)} />
    </AbsoluteFill>
  );
};
