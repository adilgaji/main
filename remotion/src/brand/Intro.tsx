/**
 * Интро канала «All That Matters» для длинных (горизонтальных) видео. 1920×1080, 9 с.
 * Текст (подтверждён): «All That Matters. The channel where you learn how your own body works,
 * and simple things you can do to feel better every day.» — озвучка public/brand/intro_voice.wav.
 * 4 варианта визуала; все тайминги привязаны к словам озвучки (intro_voice.timings.json).
 */
import React from 'react';
import {AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import './Wordmarks'; // шрифты Anton / Archivo Black / Space Mono / Permanent Marker
import {loadFonts} from '../style';
import {Icon, IconName} from '../lib/Diagram';
import {BodyOutline} from '../lib/BodyOutline';
import {Heart} from '../lib/Organs';
import {Stickman} from '../lib/Stickman';
import {Location} from '../lib/Scenes';
import {setEnvSize} from '../lib/Env';
import {applyTheme} from '../styles/themes';

loadFonts();

export const INTRO = {width: 1920, height: 1080, seconds: 9} as const;
export type IntroVariant = 'pulse' | 'blueprint' | 'zoom' | 'classroom';
export const INTRO_VARIANTS: IntroVariant[] = ['pulse', 'blueprint', 'zoom', 'classroom'];

// моменты озвучки (секунды)
const T = {name: 0.1, line1: 1.73, body: 3.7, line2: 4.58, better: 6.3, end: 8.2};

const useT = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return frame / fps;
};
const ease = Easing.bezier(0.22, 1, 0.36, 1);
const ramp = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});

const ECG = 'M 0 45 L 250 45 L 285 45 L 310 8 L 340 84 L 370 20 L 392 45 L 760 45';
const FIGS = {
  brain: [
    'M -60 10 C -72 -30, -40 -62, -5 -60 C 30 -66, 66 -40, 62 0 C 66 30, 40 50, 10 46 C -10 56, -45 50, -55 32 C -64 26, -64 18, -60 10 Z',
    'M -5 -60 C -15 -30, 10 -10, -5 20 M -40 -20 C -25 -25, -20 -5, -35 5 M 25 -35 C 40 -25, 35 -5, 20 0 M 20 25 C 30 15, 45 20, 48 30 M 10 46 C 14 60, 10 70, 4 78',
  ],
  heart: [
    'M -30 -20 C -60 0, -50 50, -5 70 C 30 60, 55 20, 40 -15 C 30 -40, 5 -40, -5 -25 C -12 -40, -25 -38, -30 -20 Z',
    'M -12 -30 L -14 -62 M 8 -32 C 10 -60, 40 -62, 44 -40 M -30 -20 L -42 -48 M 0 -5 C 5 20, 15 40, 25 55',
  ],
  lungs: [
    'M 0 -60 L 0 -10 M 0 -10 C -10 0, -18 0, -24 -6 M 0 -10 C 10 0, 18 0, 24 -6',
    'M -24 -40 C -60 -40, -66 30, -60 50 C -40 60, -20 50, -14 40 C -14 10, -14 -20, -24 -40 Z',
    'M 24 -40 C 60 -40, 66 30, 60 50 C 40 60, 20 50, 14 40 C 14 10, 14 -20, 24 -40 Z',
  ],
  body: [
    'M 0 -86 A 16 16 0 1 1 -0.1 -86 Z',
    'M -8 -54 L -8 -46 M 8 -54 L 8 -46 M -30 -42 Q 0 -50 30 -42 L 34 10 L 22 12 L 20 -20 M -30 -42 L -34 10 L -22 12 L -20 -20 M -20 -20 L -18 20 L -22 80 L -8 80 L 0 25 L 8 80 L 22 80 L 18 20 L 20 -20',
  ],
};
type Fig = keyof typeof FIGS;

/** Линейный рисунок, который «рисуется» пером: progress 0..1. */
const DrawFig: React.FC<{kind: Fig; x: number; y: number; s: number; p: number; color: string; width?: number}> = ({kind, x, y, s, p, color, width = 4}) => (
  <g opacity={p > 0.01 ? 1 : 0} transform={`translate(${x} ${y}) scale(${s})`}>
    {FIGS[kind].map((d, i) => (
      <path key={i} d={d} pathLength={1} fill="none" stroke={color} strokeWidth={width / s} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - p} />
    ))}
  </g>
);

const VoiceTrack: React.FC = () => <Audio src={staticFile('brand/intro_voice.wav')} />;
const fadeOut = (t: number) => 1 - ramp(t, INTRO.seconds - 0.35, INTRO.seconds);

/* ======================= 1. PULSE — как логотип канала ======================= */
const IntroPulse: React.FC = () => {
  const t = useT();
  const draw = ramp(t, 0, 1.0);
  const nameIn = ramp(t, 0.25, 1.0);
  const lift = ramp(t, T.line1 - 0.15, T.line1 + 0.45);
  const line1 = ramp(t, T.line1, T.line1 + 0.5);
  const line2 = ramp(t, T.line2, T.line2 + 0.5);
  // красная «искра» бежит по линии, как на мониторе
  const run = ((t - 1.0) / 2.2) % 1;
  const icons: IconName[] = ['sleep', 'food', 'exercise', 'water'];
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, #13296A 0%, #0B1C45 70%)', opacity: fadeOut(t)}}>
      <AbsoluteFill style={{transform: `translateY(${-lift * 200}px) scale(${1 - lift * 0.28})`}}>
        <svg style={{position: 'absolute', left: 0, top: 540 - 70}} width={1920} height={140} viewBox="0 0 1920 140">
          <path d="M 0 70 L 700 70 L 760 70 L 800 12 L 850 132 L 900 30 L 935 70 L 1920 70" pathLength={1} fill="none" stroke="#FF2B2B" strokeWidth={16} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - draw} />
          {t > 1.0 && (
            <path d="M 0 70 L 700 70 L 760 70 L 800 12 L 850 132 L 900 30 L 935 70 L 1920 70" pathLength={1} fill="none" stroke="#FFD1D1" strokeWidth={20} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="0.04 0.96" strokeDashoffset={-run} opacity={0.9} />
          )}
        </svg>
        <div style={{position: 'absolute', left: 0, right: 0, top: 290, textAlign: 'center', fontFamily: 'Archivo Black', color: '#FFFFFF', fontSize: 170, lineHeight: 1, opacity: nameIn, transform: `translateY(${(1 - nameIn) * 40}px)`}}>ALL THAT</div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 640, textAlign: 'center', fontFamily: 'Archivo Black', color: '#FFFFFF', fontSize: 190, lineHeight: 1, opacity: nameIn, transform: `translateY(${(1 - nameIn) * -40}px)`}}>MATTERS</div>
      </AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: 720, textAlign: 'center', fontFamily: 'Montserrat', fontWeight: 800, fontSize: 64, color: '#FFFFFF', opacity: line1 * (1 - line2), transform: `translateY(${(1 - line1) * 30}px)`}}>
        Learn how <span style={{color: '#FF5A5A'}}>your own body</span> works
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 690, textAlign: 'center', opacity: line2, transform: `translateY(${(1 - line2) * 30}px)`}}>
        <div style={{display: 'flex', justifyContent: 'center', gap: 70, marginBottom: 26}}>
          {icons.map((n, i) => {
            const k = ramp(t, T.line2 + 0.25 + i * 0.3, T.line2 + 0.6 + i * 0.3);
            return (
              <div key={n} style={{width: 120, height: 120, borderRadius: 60, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${k})`}}>
                <Icon name={n} size={88} color="#0B1C45" />
              </div>
            );
          })}
        </div>
        <div style={{fontFamily: 'Montserrat', fontWeight: 800, fontSize: 60, color: '#FFFFFF'}}>
          Simple things to <span style={{color: '#FF5A5A'}}>feel better</span>, every day
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ======================= 2. BLUEPRINT — как фон канала ======================= */
const typed = (text: string, t: number, start: number, cps = 26) => text.slice(0, Math.max(0, Math.floor((t - start) * cps)));
const IntroBlueprint: React.FC = () => {
  const t = useT();
  const grid = ramp(t, 0, 0.8);
  const figs: {kind: Fig; x: number; y: number; label: string; at: number}[] = [
    {kind: 'brain', x: 300, y: 270, label: 'FIG. 01 — BRAIN', at: T.line1 + 0.2},
    {kind: 'heart', x: 1620, y: 270, label: 'FIG. 02 — HEART', at: T.line1 + 0.9},
    {kind: 'lungs', x: 300, y: 840, label: 'FIG. 03 — LUNGS', at: T.line1 + 1.6},
    {kind: 'body', x: 1620, y: 840, label: 'FIG. 04 — YOU', at: T.body},
  ];
  const cursor = Math.floor(t * 2.5) % 2 === 0;
  const l1 = typed('// learn how your own body works', t, T.line1);
  const l2 = typed('// + simple things to feel better, every day', t, T.line2);
  return (
    <AbsoluteFill style={{background: '#1B4FD8', opacity: fadeOut(t)}}>
      <svg style={{position: 'absolute', inset: 0}} width={1920} height={1080}>
        {Array.from({length: 49}, (_, i) => (
          <line key={`v${i}`} x1={i * 40} x2={i * 40} y1={0} y2={1080 * grid} stroke="#FFFFFF" strokeOpacity={i % 5 === 0 ? 0.16 : 0.06} strokeWidth={2} />
        ))}
        {Array.from({length: 28}, (_, i) => (
          <line key={`h${i}`} y1={i * 40} y2={i * 40} x1={0} x2={1920 * grid} stroke="#FFFFFF" strokeOpacity={i % 5 === 0 ? 0.16 : 0.06} strokeWidth={2} />
        ))}
        {figs.map((f) => {
          const p = ramp(t, f.at, f.at + 1.1);
          const lab = ramp(t, f.at + 0.6, f.at + 1.0);
          const s = 1.5;
          const left = f.x < 960;
          const dy = f.y > 540 ? -1 : 1; // нижние подписи — под рисунком
          return (
            <g key={f.kind}>
              <DrawFig kind={f.kind} x={f.x} y={f.y} s={s} p={p} color="#EAF2FF" />
              <circle cx={f.x} cy={f.y} r={95 * s} fill="none" stroke="#EAF2FF" strokeOpacity={0.35 * p} opacity={p > 0.01 ? 1 : 0} strokeWidth={2} strokeDasharray="10 10" transform={`rotate(${t * 12} ${f.x} ${f.y})`} />
              <g opacity={lab}>
                <line x1={f.x + (left ? 100 : -100)} y1={f.y - 100 * dy} x2={f.x + (left ? 170 : -170)} y2={f.y - 170 * dy} stroke="#EAF2FF" strokeWidth={2} />
                <text x={f.x + (left ? 178 : -178)} y={f.y - 178 * dy + (dy < 0 ? 24 : 0)} textAnchor={left ? 'start' : 'end'} fill="#EAF2FF" fontFamily="Space Mono" fontSize={30}>{f.label}</text>
              </g>
            </g>
          );
        })}
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, top: 400, textAlign: 'center', fontFamily: 'Space Mono', fontWeight: 700, fontSize: 120, color: '#FFFFFF', letterSpacing: 6, whiteSpace: 'pre'}}>
        {typed('ALL THAT MATTERS', t, T.name, 16)}
        <span style={{opacity: t < T.line1 && cursor ? 1 : 0}}>_</span>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 580, textAlign: 'center', fontFamily: 'Space Mono', fontSize: 44, color: '#BFD3FF', whiteSpace: 'pre'}}>
        {l1 || ' '}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 650, textAlign: 'center', fontFamily: 'Space Mono', fontSize: 44, color: '#FFFFFF', whiteSpace: 'pre'}}>
        {l2 || ' '}
        <span style={{opacity: t > T.line2 && cursor ? 1 : 0}}>_</span>
      </div>
    </AbsoluteFill>
  );
};

/* ======================= 3. ZOOM — фирменный зум тело → сердце ======================= */
const IntroZoom: React.FC = () => {
  const t = useT();
  const nameIn = ramp(t, 0.1, 0.9);
  const toCorner = ramp(t, T.line1 - 0.2, T.line1 + 0.4);
  const bodyIn = ramp(t, T.line1, T.line1 + 0.6);
  const zoom = ramp(t, 2.6, 4.2);
  const back = ramp(t, T.line2 - 0.1, T.line2 + 0.5);
  const z = zoom * (1 - back);
  const habits: {n: IconName; label: string; x: number; y: number}[] = [
    {n: 'sleep', label: 'SLEEP', x: 560, y: 330},
    {n: 'food', label: 'FOOD', x: 1360, y: 330},
    {n: 'exercise', label: 'MOVE', x: 560, y: 760},
    {n: 'water', label: 'WATER', x: 1360, y: 760},
  ];
  const outro = ramp(t, 7.4, 8.0);
  const ink = '#141414';
  return (
    <AbsoluteFill style={{background: '#F2EFE8', opacity: fadeOut(t)}}>
      {/* тело и сердце */}
      <AbsoluteFill style={{opacity: bodyIn * (1 - outro)}}>
        <div style={{position: 'absolute', left: 960 - 170, top: 110, width: 340, transformOrigin: `${(214 / 400) * 340}px ${(278 / 400) * 340}px`, transform: `scale(${1 + z * 3.2})`, opacity: 1 - ramp(z, 0.55, 0.8)}}>
          <BodyOutline width={340} highlight={['heart']} />
        </div>
        <div style={{position: 'absolute', left: 960 - 260, top: 200, opacity: ramp(z, 0.6, 0.9), transform: `scale(${0.7 + z * 0.3})`}}>
          <Heart size={520} bpm={80} />
        </div>
      </AbsoluteFill>
      {/* привычки вокруг тела */}
      {habits.map((h, i) => {
        const k = ramp(t, T.line2 + 0.3 + i * 0.35, T.line2 + 0.7 + i * 0.35) * (1 - outro);
        return (
          <div key={h.n} style={{position: 'absolute', left: h.x - 90, top: h.y - 90, width: 180, textAlign: 'center', transform: `scale(${k})`}}>
            <div style={{width: 180, height: 180, borderRadius: 90, background: '#FFFFFF', boxShadow: `0 0 0 8px ${ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <Icon name={h.n} size={120} color={ink} />
            </div>
            <div style={{marginTop: 18, fontFamily: 'Archivo Black', fontSize: 34, color: ink}}>{h.label}</div>
          </div>
        );
      })}
      {/* подписи */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 70, textAlign: 'center', fontFamily: 'Montserrat', fontWeight: 800, fontSize: 56, color: ink}}>
        <span style={{opacity: ramp(t, T.line1, T.line1 + 0.4) * (1 - back), position: 'absolute', left: 0, right: 0}}>
          How <span style={{background: '#FFD23F', padding: '0 12px'}}>your own body</span> works
        </span>
        <span style={{opacity: back * (1 - outro), position: 'absolute', left: 0, right: 0}}>
          Simple things to <span style={{background: '#FFD23F', padding: '0 12px'}}>feel better</span>, every day
        </span>
      </div>
      {/* название: в центре → в угол → снова в центр в конце */}
      {(() => {
        const c = toCorner * (1 - outro);
        const scale = 1 - c * 0.62;
        const x = interpolate(c, [0, 1], [960, 250]);
        const y = interpolate(c, [0, 1], [540, 110]);
        return (
          <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${scale})`, opacity: nameIn, textAlign: 'center', fontFamily: 'Archivo Black', color: ink, lineHeight: 0.95}}>
            <div style={{fontSize: 150, whiteSpace: 'nowrap'}}>ALL THAT</div>
            <svg width={900} height={100} viewBox="0 0 760 90" style={{display: 'block', margin: '0 auto'}}>
              <path d={ECG} pathLength={1} fill="none" stroke="#E5322D" strokeWidth={12} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - ramp(t, 0, 0.9)} />
            </svg>
            <div style={{fontSize: 166, whiteSpace: 'nowrap'}}>MATTERS</div>
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};

/* ======================= 4. CLASSROOM — как в самих видео ======================= */
const IntroClassroom: React.FC = () => {
  const t = useT();
  setEnvSize(1920, 1080);
  const board = {x: 120, y: 110, w: 1180, h: 680};
  const chalk = '#F4F1E6';
  const write = (a: number, b: number) => `inset(0 ${100 - ramp(t, a, b) * 100}% 0 0)`;
  const pose = t < T.line1 ? 'wave' : t < T.line2 ? 'point' : 'present';
  return (
    <AbsoluteFill style={{opacity: fadeOut(t)}}>
      <Location kind="classroom" variant={0} />
      <div style={{position: 'absolute', left: board.x, top: board.y, width: board.w, height: board.h, borderRadius: 18, background: '#2F4A3E', boxShadow: '0 0 0 18px #9C7A55, 0 30px 50px rgba(0,0,0,0.25)'}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: 18, background: 'radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.08), transparent 60%)'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 70, textAlign: 'center', fontFamily: 'Permanent Marker', fontSize: 118, color: chalk, clipPath: write(0.1, 1.3), whiteSpace: 'nowrap'}}>All That Matters</div>
        <svg style={{position: 'absolute', left: 170, top: 250}} width={840} height={40}>
          <path d="M 10 25 C 200 8, 600 34, 830 14" pathLength={1} fill="none" stroke="#FFD23F" strokeWidth={9} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - ramp(t, 1.2, 1.6)} />
        </svg>
        <svg style={{position: 'absolute', left: 90, top: 330}} width={150} height={150} viewBox="-100 -100 200 200">
          <DrawFig kind="heart" x={0} y={0} s={1.1} p={ramp(t, T.line1, T.line1 + 1)} color={chalk} width={6} />
        </svg>
        <div style={{position: 'absolute', left: 260, top: 360, fontFamily: 'Permanent Marker', fontSize: 64, color: chalk, clipPath: write(T.line1, T.line1 + 1.6), whiteSpace: 'nowrap'}}>how your own body works</div>
        <svg style={{position: 'absolute', left: 120, top: 520}} width={110} height={110} viewBox="0 0 110 110">
          <path d="M 15 60 L 45 88 L 98 18" pathLength={1} fill="none" stroke="#7CF0B4" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - ramp(t, T.line2, T.line2 + 0.5)} />
        </svg>
        <div style={{position: 'absolute', left: 260, top: 520, fontFamily: 'Permanent Marker', fontSize: 64, color: chalk, clipPath: write(T.line2, T.line2 + 2.2), whiteSpace: 'nowrap'}}>simple things to feel better</div>
      </div>
      <div style={{position: 'absolute', left: 1360, top: 260}}>
        <Stickman pose={pose as 'wave'} emotion={t < T.line2 ? 'happy' : 'excited'} size={700} />
      </div>
    </AbsoluteFill>
  );
};

export const Intro: React.FC<{variant: IntroVariant; withVoice?: boolean}> = ({variant, withVoice = true}) => {
  applyTheme(variant === 'classroom' ? 'paper' : 'classic');
  const V = {pulse: IntroPulse, blueprint: IntroBlueprint, zoom: IntroZoom, classroom: IntroClassroom}[variant];
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <V />
      {withVoice && <VoiceTrack />}
    </AbsoluteFill>
  );
};
