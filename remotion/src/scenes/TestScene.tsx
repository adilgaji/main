/**
 * Этап 2: тестовая сцена ~10 c.
 * Текст: "Ever felt your heart *pound* before a big moment? Your brain tells your
 * *adrenal glands* to release *adrenaline*. It hits receptors on *heart cells*,
 * and your heart beats *faster*."
 * Смена кадров привязана к моментам, когда звучат слова (из words.json).
 */
import React from 'react';
import {Audio} from '@remotion/media';
import {AbsoluteFill, CalculateMetadataFunction, Easing, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, FONT_FAMILY, VIDEO, loadFonts} from '../style';
import {Background, Camera, Chip, Headline, useEnter} from '../lib/Kit';
import {KaraokeCaptions, Word} from '../lib/Captions';
import {BodyOutline, ORGAN_CENTER} from '../lib/BodyOutline';
import {Heart} from '../lib/Organs';
import {Cell, Molecule} from '../lib/CellAndMolecules';
import {ProcessArrow} from '../lib/Diagram';
import {Stickman} from '../lib/Stickman';

loadFonts();

export type TestSceneProps = {audio: string; words: Word[]};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/** Время (сек) начала n-го вхождения слова. */
const at = (words: Word[], word: string, nth = 0) => {
  const hits = words.filter((w) => norm(w.text) === word);
  const w = hits[nth] ?? hits[0];
  return w ? w.startMs / 1000 : 0;
};

export const calcTestScene: CalculateMetadataFunction<TestSceneProps> = ({props}) => {
  const last = props.words[props.words.length - 1];
  return {durationInFrames: Math.ceil(((last?.endMs ?? 9000) + 700) / 1000 * VIDEO.fps)};
};

const ease = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const, easing: Easing.bezier(0.45, 0, 0.2, 1)};

/* ---------- ТЕЛО (общий план) ---------- */
const BODY = {left: 350, top: 230, width: 380};
const k = BODY.width / 400;
const bodyPt = (o: keyof typeof ORGAN_CENTER) => ({x: BODY.left + ORGAN_CENTER[o].x * k, y: BODY.top + ORGAN_CENTER[o].y * k});

/* Кадр 1: хук */
const HookShot: React.FC = () => {
  const e1 = useEnter(0);
  const e2 = useEnter(0.15);
  return (
    <AbsoluteFill>
      <Background tint="#3A1F33" />
      <Headline text="Why your heart *pounds*" />
      <div style={{position: 'absolute', left: 80, top: 600, ...e1}}>
        <Stickman pose="shrug" emotion="worried" size={480} />
      </div>
      <div style={{position: 'absolute', left: 500, top: 620, ...e2}}>
        <Heart size={380} bpm={140} />
      </div>
    </AbsoluteFill>
  );
};

/* Кадры 2–3: мозг → надпочечники → адреналин, затем зум в сердце */
const BodyShot: React.FC<{tAdrenal: number; tAdrenaline: number; tZoom: number}> = ({tAdrenal, tAdrenaline, tZoom}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const brain = bodyPt('brain');
  const adr = bodyPt('adrenals');
  const heart = bodyPt('heart');
  const highlight = t < tAdrenal ? (['brain'] as const) : t < tAdrenaline ? (['brain', 'adrenals'] as const) : (['adrenals', 'heart'] as const);
  const zoom = interpolate(t, [tZoom, tZoom + 0.6], [0, 1], ease);
  const arrow = interpolate(t, [0.3, tAdrenal], [0, 1], ease);
  const enter = useEnter(0);
  return (
    <AbsoluteFill>
      <Background />
      <Camera x={heart.x} y={heart.y} scale={ORGAN_CENTER.heart.zoom} progress={zoom}>
        <div style={{position: 'absolute', left: BODY.left, top: BODY.top, ...enter}}>
          <BodyOutline width={BODY.width} highlight={[...highlight]} />
        </div>
        <svg style={{position: 'absolute', left: 0, top: 0}} width={VIDEO.width} height={VIDEO.height}>
          <ProcessArrow x1={brain.x + 50} y1={brain.y + 10} x2={adr.x + 40} y2={adr.y - 20} bend={-120} progress={arrow} color={COLORS.nerve} width={9} />
        </svg>
        {/* молекулы адреналина плывут от надпочечников к сердцу */}
        {t > tAdrenaline &&
          [0, 1, 2].map((i) => {
            const p = interpolate(t, [tAdrenaline + i * 0.18, tAdrenaline + 0.9 + i * 0.18], [0, 1], ease);
            return (
              <Molecule
                key={i}
                kind="amine"
                size={90}
                color={COLORS.hormoneAlt}
                style={{position: 'absolute', left: interpolate(p, [0, 1], [adr.x + 20 * i, heart.x + 30 - 20 * i]) - 45, top: interpolate(p, [0, 1], [adr.y, heart.y + 20]) - 45, opacity: p > 0 ? 1 - zoom : 0}}
              />
            );
          })}
        <div style={{opacity: 1 - zoom}}>
          <Chip text="BRAIN" x={760} y={brain.y} color={COLORS.brain} />
          {t > tAdrenal && <Chip text="ADRENAL GLANDS" x={290} y={adr.y - 50} color={COLORS.gland} delay={tAdrenal} />}
          {t > tAdrenaline && <Chip text="ADRENALINE" x={735} y={heart.y} color={COLORS.hormoneAlt} delay={tAdrenaline} />}
        </div>
      </Camera>
      <div style={{position: 'absolute', left: 40, top: 680, opacity: 1 - zoom}}>
        <Stickman pose="point" emotion="neutral" size={360} />
      </div>
    </AbsoluteFill>
  );
};

/* Кадр 4: сердце → клетка (продолжение зума) */
const CellShot: React.FC<{tCells: number; dur: number}> = ({tCells, dur}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  // 0–0.55 c: крупный план сердца, приближаемся к стенке; затем клетка
  const heartZoom = interpolate(t, [0.05, 0.55], [0, 1], ease);
  const cellIn = interpolate(t, [0.45, 0.7], [0, 1], ease);
  const binds = [0, 1, 2, 3, 4];
  const angles = [-60, 10, 80, 150, 220];
  const C = {x: 540, y: 660, size: 660};
  return (
    <AbsoluteFill>
      <Background tint="#3A1F33" />
      <div style={{opacity: 1 - cellIn}}>
        <Camera x={640} y={760} scale={3.2} progress={heartZoom}>
          <div style={{position: 'absolute', left: 540 - 260, top: 400}}>
            <Heart size={520} bpm={90} />
          </div>
        </Camera>
      </div>
      <div style={{position: 'absolute', left: C.x - C.size / 2, top: C.y - C.size / 2, opacity: cellIn, scale: String(interpolate(cellIn, [0, 1], [0.6, 1]))}}>
        <Cell size={C.size} receptors="membrane" activated={t > tCells + 0.3 ? 1 : 0} />
      </div>
      {cellIn > 0.5 &&
        binds.map((i) => {
          const a = (angles[i] * Math.PI) / 180;
          const rx = C.x + Math.cos(a) * (C.size / 2) * 1.0;
          const ry = C.y + Math.sin(a) * (C.size / 2) * 1.0;
          const p = interpolate(t, [0.7 + i * 0.12, 1.3 + i * 0.12], [0, 1], ease);
          const fx = C.x + Math.cos(a) * 560;
          const fy = C.y + Math.sin(a) * 560;
          return (
            <Molecule key={i} kind="amine" size={110} color={COLORS.hormoneAlt} style={{position: 'absolute', left: interpolate(p, [0, 1], [fx, rx + Math.cos(a) * 50]) - 55, top: interpolate(p, [0, 1], [fy, ry + Math.sin(a) * 50]) - 55}} />
          );
        })}
      <Breadcrumb level={cellIn > 0.5 ? 2 : 1} />
      {t > 0.8 && <Chip text="RECEPTORS" x={540} y={1060} color={COLORS.accent} delay={0.8} />}
      
    </AbsoluteFill>
  );
};

/** Фирменная «навигация зума»: BODY › HEART › CELL */
const Breadcrumb: React.FC<{level: number}> = ({level}) => (
  <div style={{position: 'absolute', top: 240, left: 0, width: VIDEO.width - 100, display: 'flex', justifyContent: 'center', gap: 18, fontFamily: FONT_FAMILY, fontWeight: 900, fontSize: 46}}>
    {['BODY', 'HEART', 'CELL'].map((s, i) => (
      <React.Fragment key={s}>
        {i > 0 && <span style={{color: COLORS.muted}}>›</span>}
        <span style={{color: i === level ? COLORS.accentInk : i < level ? COLORS.ink : COLORS.muted, background: i === level ? COLORS.accent : 'transparent', borderRadius: 12, padding: '0 12px'}}>{s}</span>
      </React.Fragment>
    ))}
  </div>
);

/* Кадр 5: сердце бьётся чаще */
const FasterShot: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const bpm = interpolate(t, [0, 1.2], [80, 140], ease);
  const e = useEnter(0);
  return (
    <AbsoluteFill>
      <Background tint="#3A1F33" />
      <Headline text="Heart rate *up*" />
      <div style={{position: 'absolute', left: 120, top: 430, ...e}}>
        <Heart size={480} bpm={bpm} />
      </div>
      <svg style={{position: 'absolute', left: 760, top: 470}} width={150} height={420}>
        <ProcessArrow x1={75} y1={400} x2={75} y2={40} progress={interpolate(t, [0.1, 0.7], [0, 1], ease)} color={COLORS.blood} width={22} />
      </svg>
    </AbsoluteFill>
  );
};

export const TestScene: React.FC<TestSceneProps> = ({audio, words}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const tBrain = at(words, 'brain') - 0.2;
  const tAdrenal = at(words, 'adrenal');
  const tAdrenaline = at(words, 'adrenaline');
  const tHits = at(words, 'hits') - 0.15;
  const tCells = at(words, 'cells');
  const tAnd = at(words, 'and') - 0.1;
  const f = (s: number) => Math.round(s * fps);
  const zoomStart = tHits - 0.35;

  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      <Sequence name="Hook" durationInFrames={f(tBrain)}>
        <HookShot />
      </Sequence>
      <Sequence name="Body → zoom" from={f(tBrain)} durationInFrames={f(zoomStart + 0.6) - f(tBrain)}>
        <BodyShot tAdrenal={tAdrenal - tBrain} tAdrenaline={tAdrenaline - tBrain} tZoom={zoomStart - tBrain} />
      </Sequence>
      <Sequence name="Heart → cell" from={f(zoomStart + 0.6)} durationInFrames={f(tAnd) - f(zoomStart + 0.6)}>
        <CellShot tCells={tCells - (zoomStart + 0.6)} dur={tAnd - zoomStart} />
      </Sequence>
      <Sequence name="Faster" from={f(tAnd)} durationInFrames={durationInFrames - f(tAnd)}>
        <FasterShot />
      </Sequence>
      <KaraokeCaptions words={words} />
      <Audio src={staticFile(audio)} />
    </AbsoluteFill>
  );
};
