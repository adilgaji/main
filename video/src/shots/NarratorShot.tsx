// Кадр «Рассказчик»: крупный персонаж в кабинете с книгами и свиток с главной мыслью.
// Персонаж меняет позы и эмоции по ходу кадра, губы двигаются в такт словам.
import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Narrator, type Emotion, type Pose} from '../character/Narrator';
import {ShotFrame} from '../components/ShotFrame';
import {alpha, EASE, mix, ramp, rng} from '../lib/anim';
import {useCanvas} from '../lib/canvas';
import {useStyle, type Palette} from '../style';

export type NarratorBeat = {at: number; pose: Pose; emotion: Emotion};

export type NarratorShotProps = {
  frames: number;
  pose?: Pose;
  emotion?: Emotion;
  /** Смена поз по времени (секунды от начала кадра). Если задано — pose/emotion не нужны */
  beats?: NarratorBeat[];
  /** Когда звучат слова (секунды) — по ним двигаются губы */
  speech?: {start: number; end: number}[];
  /** Свиток справа: строка сверху, заголовок и пункты */
  board?: {kicker?: string; title: string; lines?: string[]};
  seed?: number;
};

/** Раскладка: в горизонтальном кадре свиток справа, в вертикальном — сверху, рассказчик внизу. */
const useLayout = () => {
  const c = useCanvas();
  return c.vertical
    ? {W: c.width, H: c.height, BOARD: {x: 80, y: 250, w: 840, h: 560}, room: {x: 40, y: 860}, floorY: c.height - 150, person: {left: 150, top: c.height - 1010}}
    : {W: c.width, H: c.height, BOARD: {x: 1000, y: 150, w: 790, h: 590}, room: {x: 0, y: 0}, floorY: 960, person: {left: 130, top: 78}};
};

/** Кабинет: стена, полки с книгами, тёплый свет лампы. */
const Study: React.FC<{palette: Palette; seed: number}> = React.memo(({palette: p, seed}) => {
  const books = useMemo(() => {
    const r = rng(seed * 101 + 7);
    const tones = [p.accent2, p.coat, p.accent, p.paperShade, p.coatShade, mix(p.accent2, p.ink, 0.45), mix(p.accent, p.ink, 0.5), mix(p.coat, p.light, 0.25)];
    const rows: {x: number; y: number; w: number; h: number; c: string; band: boolean; lean: number}[] = [];
    for (const rowY of [318, 566, 820]) {
      let x = 44;
      while (x < 940) {
        const w = 26 + r() * 34;
        const h = 150 + r() * 62;
        const gap = r() < 0.08 ? 46 : 0;
        rows.push({x, y: rowY - h, w, h, c: mix(tones[Math.floor(r() * tones.length)], p.bg, 0.3 + r() * 0.2), band: r() < 0.55, lean: r() < 0.07 ? 7 : 0});
        x += w + 4 + gap;
      }
    }
    return rows;
  }, [p, seed]);
  const {W, H, room, floorY} = useLayout();
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${mix(p.bgAlt, p.accent2, 0.12)} 0%, ${p.bg} 100%)`}} />
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <g transform={`translate(${room.x} ${room.y})`}>
        {/* ниша с полками */}
        <rect x={20} y={70} width={950} height={770} fill={mix(p.bg, '#000000', 0.35)} />
        {books.map((b, i) => (
          <g key={i} transform={`rotate(${b.lean} ${b.x} ${b.y + b.h})`}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={3} fill={b.c} />
            {b.band ? <rect x={b.x} y={b.y + b.h * 0.18} width={b.w} height={9} fill={alpha(p.accent, 0.55)} /> : null}
            <rect x={b.x} y={b.y} width={4} height={b.h} fill={alpha('#000000', 0.22)} />
          </g>
        ))}
        {[318, 566, 820].map((y) => (
          <rect key={y} x={20} y={y} width={950} height={22} fill={mix(p.coatShade, p.ink, 0.5)} />
        ))}
        <rect x={20} y={70} width={950} height={770} fill="none" stroke={mix(p.coatShade, p.ink, 0.5)} strokeWidth={22} />
        </g>
        {/* пол */}
        <rect x={0} y={floorY} width={W} height={H - floorY} fill={mix(p.bg, '#000000', 0.4)} />
      </svg>
      {/* тёплый свет слева сверху и тень на стене за свитком */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse 55% 60% at 22% 18%, ${alpha(p.accent, 0.3)} 0%, ${alpha(p.accent, 0)} 100%)`}} />
      <AbsoluteFill style={{background: `radial-gradient(ellipse 45% 55% at 74% 42%, ${alpha(p.light, 0.1)} 0%, ${alpha(p.light, 0)} 100%)`}} />
    </AbsoluteFill>
  );
});

const Scroll: React.FC<{palette: Palette; radius: number}> = ({palette: p, radius}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const k = ramp(frame, 0.2 * fps, 0.8 * fps, EASE.out);
  const {BOARD} = useLayout();
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: BOARD.x,
          top: BOARD.y,
          width: BOARD.w,
          height: BOARD.h * k,
          borderRadius: `0 0 ${radius}px ${radius}px`,
          background: `linear-gradient(170deg, ${mix(p.paper, '#ffffff', 0.2)} 0%, ${p.paper} 50%, ${p.paperShade} 100%)`,
          boxShadow: `0 26px 60px ${alpha('#000000', 0.55)}, inset 0 0 70px ${alpha(mix(p.paperShade, p.ink, 0.4), 0.3)}`,
        }}
      />
      {/* планка, на которой висит свиток */}
      <div style={{position: 'absolute', left: BOARD.x - 26, top: BOARD.y - 20, width: BOARD.w + 52, height: 34, borderRadius: 17, background: `linear-gradient(180deg, ${mix(p.accent, p.ink, 0.25)} 0%, ${mix(p.accent, p.ink, 0.6)} 100%)`, boxShadow: `0 8px 18px ${alpha('#000000', 0.5)}`}} />
    </>
  );
};

/** Текущая и предыдущая поза + доля перехода между ними. */
const useBeat = (props: NarratorShotProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beats = props.beats?.length ? props.beats : [{at: 0, pose: props.pose ?? 'explain', emotion: props.emotion ?? 'smile'}];
  const t = frame / fps;
  let i = 0;
  for (let k = 0; k < beats.length; k++) {
    if (t >= beats[k].at) {
      i = k;
    }
  }
  const cur = beats[i];
  const prev = beats[Math.max(0, i - 1)];
  const blend = i === 0 ? 1 : ramp(frame, cur.at * fps, 0.45 * fps, EASE.inOut);
  return {cur, prev, blend, t};
};

const mouthAt = (t: number, speech: NarratorShotProps['speech']): number => {
  if (!speech) {
    return 0;
  }
  const w = speech.find((s) => t >= s.start && t < s.end);
  if (!w) {
    return 0;
  }
  // Внутри слова рот открывается и закрывается примерно 5 раз в секунду.
  const local = t - w.start;
  const edge = Math.min(1, local / 0.05, (w.end - t) / 0.05);
  return Math.max(0, edge) * (0.3 + 0.7 * Math.abs(Math.sin(local * Math.PI * 5.2 + 0.6)));
};

const NarratorArt: React.FC<NarratorShotProps> = (props) => {
  const {palette: p, radius} = useStyle();
  const {cur, prev, blend, t} = useBeat(props);
  const {person} = useLayout();
  return (
    <AbsoluteFill>
      <Study palette={p} seed={props.seed ?? 4} />
      {props.board ? <Scroll palette={p} radius={radius} /> : null}
      <div style={{position: 'absolute', left: person.left, top: person.top, width: 800, height: 1000, transformOrigin: '50% 100%', scale: 1.02}}>
        <Narrator
          palette={p}
          pose={cur.pose}
          emotion={cur.emotion}
          fromPose={prev.pose}
          fromEmotion={prev.emotion}
          blend={blend}
          time={t}
          mouthOpen={mouthAt(t, props.speech)}
          gaze={props.board ? 0.5 : 0}
        />
      </div>
    </AbsoluteFill>
  );
};

const NarratorText: React.FC<NarratorShotProps> = ({board}) => {
  const {palette: p, fonts} = useStyle();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {BOARD} = useLayout();
  if (!board) {
    return null;
  }
  return (
    <div style={{position: 'absolute', left: BOARD.x + 64, top: BOARD.y + 30, width: BOARD.w - 128, height: BOARD.h - 60, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
      {board.kicker ? (
        <div style={{fontFamily: fonts.body, fontWeight: 800, fontSize: 30, letterSpacing: 4, color: p.accent2, opacity: ramp(frame, 0.8 * fps, 0.5 * fps)}}>{board.kicker.toUpperCase()}</div>
      ) : null}
      <div style={{marginTop: 14, fontFamily: fonts.display, fontWeight: 800, fontSize: 72, lineHeight: 1.08, color: p.ink, opacity: ramp(frame, 1.0 * fps, 0.6 * fps)}}>{board.title}</div>
      {(board.lines ?? []).map((line, i) => (
        <div
          key={line}
          style={{
            marginTop: i === 0 ? 30 : 16,
            display: 'flex',
            gap: 18,
            alignItems: 'baseline',
            fontFamily: fonts.body,
            fontWeight: 600,
            fontSize: 40,
            lineHeight: 1.18,
            color: alpha(p.ink, 0.88),
            opacity: ramp(frame, (1.8 + i * 0.9) * fps, 0.5 * fps),
          }}
        >
          <span style={{color: p.accent2, fontWeight: 800}}>•</span>
          <span>{line}</span>
        </div>
      ))}
    </div>
  );
};

export const NarratorShot: React.FC<NarratorShotProps> = (props) => (
  <ShotFrame frames={props.frames} drift={null} art={<NarratorArt {...props} />} text={<NarratorText {...props} />} />
);
