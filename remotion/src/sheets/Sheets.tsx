/**
 * Тестовые листы библиотеки визуала (1080x1920) + короткое демо анимации.
 */
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, FONT_FAMILY, SAFE, VIDEO, loadFonts} from '../style';
import {EMOTIONS, POSES, Stickman} from '../lib/Stickman';
import {BodyOutline} from '../lib/BodyOutline';
import {Brain, Heart, Muscle} from '../lib/Organs';
import {Cell, Molecule} from '../lib/CellAndMolecules';
import {BarChart, EvidenceBadge, FlowChain, ICONS, Icon, LineGraph, ProcessArrow} from '../lib/Diagram';

loadFonts();

/** Полупрозрачная разметка безопасной зоны YouTube Shorts. */
export const SafeZoneOverlay: React.FC = () => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: SAFE.top, background: 'rgba(255,107,107,0.10)'}} />
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: SAFE.bottom, background: 'rgba(255,107,107,0.10)'}} />
    <div style={{position: 'absolute', right: 0, top: SAFE.top, bottom: SAFE.bottom, width: SAFE.right, background: 'rgba(255,107,107,0.10)'}} />
    <div
      style={{
        position: 'absolute',
        left: SAFE.left,
        top: SAFE.top,
        width: VIDEO.width - SAFE.left - SAFE.right,
        height: VIDEO.height - SAFE.top - SAFE.bottom,
        border: '3px dashed rgba(255,107,107,0.6)',
      }}
    />
  </AbsoluteFill>
);

const Title: React.FC<{children: React.ReactNode; top?: number}> = ({children, top = SAFE.top + 10}) => (
  <div
    style={{
      position: 'absolute',
      top,
      left: SAFE.left,
      right: SAFE.right,
      textAlign: 'center',
      fontFamily: FONT_FAMILY,
      fontWeight: 900,
      fontSize: 64,
      color: COLORS.ink,
    }}
  >
    {children}
  </div>
);

const Label: React.FC<{children: React.ReactNode; size?: number; color?: string}> = ({children, size = 30, color = COLORS.muted}) => (
  <div style={{fontFamily: FONT_FAMILY, fontWeight: 700, fontSize: size, color, textAlign: 'center'}}>{children}</div>
);

const Bg: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{background: `radial-gradient(circle at 50% 40%, ${COLORS.bgGlow} 0%, ${COLORS.bg} 70%)`}}>{children}</AbsoluteFill>
);

/* ------------------------------ ЛИСТ 1: ГИД ------------------------------ */
export const SheetGuide: React.FC<{showSafe?: boolean}> = ({showSafe = true}) => {
  const colW = (VIDEO.width - SAFE.left - SAFE.right) / 4;
  return (
    <Bg>
      <Title>GUIDE · 8 POSES</Title>
      {POSES.map((p, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        return (
          <div
            key={p}
            style={{position: 'absolute', left: SAFE.left + col * colW, top: 330 + row * 330, width: colW, display: 'flex', flexDirection: 'column', alignItems: 'center'}}
          >
            <Stickman pose={p} emotion="happy" size={250} alive={false} />
            <Label>{p}</Label>
          </div>
        );
      })}
      <Title top={1010}>5 EMOTIONS</Title>
      {EMOTIONS.map((e, i) => {
        const w = (VIDEO.width - SAFE.left - SAFE.right) / 5;
        return (
          <div key={e} style={{position: 'absolute', left: SAFE.left + i * w, top: 1100, width: w, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <div style={{width: w, height: 150, overflow: 'hidden', display: 'flex', justifyContent: 'center'}}>
              <Stickman pose="stand" emotion={e} size={520} alive={false} style={{flexShrink: 0, marginTop: -40}} />
            </div>
            <Label size={26}>{e}</Label>
          </div>
        );
      })}
      <div style={{position: 'absolute', top: 1310, left: SAFE.left, right: SAFE.right, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center'}}>
        {(['blood', 'vein', 'muscle', 'brain', 'gland', 'lung', 'organ', 'cell', 'mito', 'hormone', 'accent', 'proven', 'early', 'myth'] as const).map((k) => (
          <div key={k} style={{width: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2}}>
            <div style={{width: 44, height: 44, borderRadius: 22, background: COLORS[k]}} />
            <Label size={20}>{k}</Label>
          </div>
        ))}
      </div>
      {showSafe && <SafeZoneOverlay />}
    </Bg>
  );
};

/* --------------------------- ЛИСТ 2: АНАТОМИЯ --------------------------- */
const Cellbox: React.FC<{children: React.ReactNode; label: string; style?: React.CSSProperties}> = ({children, label, style}) => (
  <div style={{position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, ...style}}>
    {children}
    <Label>{label}</Label>
  </div>
);

export const SheetAnatomy: React.FC = () => (
  <Bg>
    <Title top={70}>BODY · ORGANS · CELLS</Title>
    <Cellbox label="body + glands" style={{left: 50, top: 180}}>
      <BodyOutline width={300} highlight={['heart', 'adrenals', 'pituitary', 'hypothalamus']} pulse={false} />
    </Cellbox>
    <Cellbox label="heart" style={{left: 420, top: 190}}>
      <Heart size={230} beating={false} />
    </Cellbox>
    <Cellbox label="brain" style={{left: 700, top: 230}}>
      <Brain size={300} highlight={['hypothalamus', 'pituitary']} />
    </Cellbox>
    <Cellbox label="muscle · micro-tears" style={{left: 450, top: 560}}>
      <Muscle width={540} damage={1} />
    </Cellbox>
    <Cellbox label="muscle · repair" style={{left: 450, top: 820}}>
      <Muscle width={540} damage={1} repair={1} flex={0.6} />
    </Cellbox>
    <Cellbox label="membrane receptors" style={{left: 90, top: 1110}}>
      <Cell size={360} receptors="membrane" />
    </Cellbox>
    <Cellbox label="receptors inside the cell" style={{left: 580, top: 1110}}>
      <Cell size={360} receptors="nuclear" activated={1} />
    </Cellbox>
    <div style={{position: 'absolute', left: 40, right: 40, top: 1580, display: 'flex', justifyContent: 'space-around'}}>
      <Molecule kind="steroid" size={260} label="steroid" spin={false} />
      <Molecule kind="amine" size={260} label="amine" color={COLORS.hormoneAlt} spin={false} />
      <Molecule kind="peptide" size={260} label="peptide" spin={false} />
    </div>
  </Bg>
);

/* ---------------------------- ЛИСТ 3: СХЕМЫ ---------------------------- */
export const SheetDiagrams: React.FC = () => (
  <Bg>
    <Title top={70}>ARROWS · CHARTS</Title>
    <div style={{position: 'absolute', left: 50, top: 180}}>
      <FlowChain width={520} steps={[{label: 'Brain', color: COLORS.brain}, {label: 'Adrenals', color: COLORS.gland}, {label: 'Adrenaline', color: COLORS.hormoneAlt}]} />
    </div>
    <svg style={{position: 'absolute', left: 620, top: 190}} width={400} height={500}>
      <ProcessArrow x1={30} y1={50} x2={360} y2={50} />
      <ProcessArrow x1={30} y1={160} x2={360} y2={200} bend={-80} color={COLORS.blood} />
      <ProcessArrow x1={30} y1={320} x2={360} y2={320} dashed color={COLORS.cell} />
      <ProcessArrow x1={30} y1={440} x2={360} y2={420} bend={60} color={COLORS.proven} progress={0.6} />
    </svg>
    <div style={{position: 'absolute', left: 90, top: 720}}>
      <LineGraph width={900} height={430} title="Cortisol across the day" data={[0.45, 0.95, 0.7, 0.5, 0.35, 0.2, 0.12]} xLabels={['6am', '9am', '12pm', '3pm', '6pm', '9pm', '12am']} />
    </div>
    <div style={{position: 'absolute', left: 60, top: 1200}}>
      <BarChart width={500} height={320} bars={[{label: '5h', value: 0.55, color: COLORS.myth}, {label: '7h', value: 0.8, color: COLORS.early}, {label: '9h', value: 0.95, color: COLORS.proven}]} />
    </div>
    <div style={{position: 'absolute', left: 620, top: 1240, display: 'flex', flexDirection: 'column', gap: 26}}>
      <EvidenceBadge kind="proven" scale={0.85} />
      <EvidenceBadge kind="early" scale={0.85} />
      <EvidenceBadge kind="myth" scale={0.85} />
    </div>
    <div style={{position: 'absolute', left: 40, right: 40, top: 1580, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 24}}>
      {ICONS.map((n) => (
        <div key={n} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', width: 170}}>
          <Icon name={n} size={90} />
          <Label size={24}>{n}</Label>
        </div>
      ))}
    </div>
  </Bg>
);

/* ------------------------- ДЕМО АНИМАЦИИ (6 сек) ------------------------- */
export const LibraryMotion: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loop = (sec: number) => (frame % (sec * fps)) / (sec * fps);
  const ease = {easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
  const t = loop(3);
  return (
    <Bg>
      <Title>LIBRARY IN MOTION</Title>
      <div style={{position: 'absolute', left: 90, top: 340}}>
        <Stickman pose="stand" toPose="point" poseT={interpolate(frame, [0.5 * fps, 1.2 * fps], [0, 1], ease)} emotion="excited" size={380} />
      </div>
      <div style={{position: 'absolute', left: 520, top: 360}}>
        <Heart size={300} bpm={80} />
      </div>
      <div style={{position: 'absolute', left: 90, top: 820}}>
        <Muscle width={420} damage={1} repair={interpolate(frame, [2 * fps, 4.5 * fps], [0, 1], ease)} flex={(Math.sin((frame / fps) * 3) + 1) / 2} />
      </div>
      <div style={{position: 'absolute', left: 560, top: 760}}>
        <Cell size={340} receptors="nuclear" activated={t > 0.6 ? 1 : 0} />
        <Molecule
          kind="steroid"
          size={110}
          style={{
            position: 'absolute',
            left: interpolate(t, [0, 0.6], [-160, 115], ease),
            top: interpolate(t, [0, 0.6], [-60, 60], ease),
          }}
        />
      </div>
      <div style={{position: 'absolute', left: 90, top: 1180}}>
        <LineGraph width={840} height={340} title="Muscle protein synthesis" data={[0.2, 0.6, 0.9, 0.75, 0.5, 0.3]} xLabels={['0h', '12h', '24h', '36h', '48h', '72h']} progress={interpolate(frame, [0.3 * fps, 3 * fps], [0, 1], ease)} />
      </div>
    </Bg>
  );
};
