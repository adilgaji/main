/**
 * Шаблоны кадров. Каждый шаблон = тип из docs/STORYBOARD_SCHEMA.md.
 * Вся раскладка — внутри безопасной зоны: заголовок сверху (y≈250),
 * визуал в зоне y 420–1110, субтитры ниже (y≈1130–1390).
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COLORS, FONT_FAMILY, SAFE, TYPE, VIDEO} from '../style';
import {Background, Chip, Headline} from '../lib/Kit';
import {Stickman, PoseName, Emotion} from '../lib/Stickman';
import {BodyOutline, ORGAN_CENTER, OrganKey} from '../lib/BodyOutline';
import {Brain, Heart, Muscle} from '../lib/Organs';
import {Cell, Molecule, MoleculeKind} from '../lib/CellAndMolecules';
import {BarChart, EvidenceBadge, Evidence, FlowChain, Icon, IconName, LineGraph, ProcessArrow} from '../lib/Diagram';
import {MuscleFiber, FiberState} from '../lib/MuscleFiber';
import {Camera} from '../lib/Kit';
import {Breadcrumb, colorOf, ramp, useShot} from './shot';

const HEAD_TOP = SAFE.top + 30;
const CX = (SAFE.left + VIDEO.width - SAFE.right) / 2; // центр безопасной зоны по X (≈ 490)

/* ----------------------------- общие визуалы ----------------------------- */
const Visual: React.FC<{kind: string; params?: any; size: number; k: number}> = ({kind, params = {}, size, k}) => {
  switch (kind) {
    case 'heart':
      return <Heart size={size} bpm={params.bpm ?? 75} />;
    case 'brain':
      return <Brain size={size} highlight={k > 0.3 ? params.highlight ?? [] : []} />;
    case 'muscle':
      return (
        <Muscle
          width={size}
          damage={(params.damage ?? 0) * k}
          repair={(params.repair ?? 0) * k}
          flex={(params.flex ?? 0) * k}
        />
      );
    case 'cell':
      return <Cell size={size} receptors={params.receptors ?? 'membrane'} activated={k > 0.8 ? 1 : 0} />;
    case 'body':
      return <BodyOutline width={size * 0.45} highlight={k > 0.2 ? params.highlight ?? [] : []} />;
    case 'molecule':
      return <Molecule kind={params.kind ?? 'steroid'} size={size * 0.7} />;
    case 'icon':
      return <Icon name={params.name ?? 'flask'} size={size * 0.5} />;
    default:
      return null;
  }
};

/* --------------------------------- HOOK --------------------------------- */
export const HookT: React.FC = () => {
  const {t, dur, at, p} = useShot();
  // визуал «проявляется» к ключевому слову заголовка
  const kw = (p.headline ?? '').match(/\*([^*]+)\*/)?.[1] ?? '';
  const k = ramp(t, Math.min(at(kw, 0.45), dur - 0.8), Math.min(at(kw, 0.45) + 1.2, dur));
  return (
    <AbsoluteFill>
      <Background tint="#2C2240" />
      <Headline text={p.headline ?? ''} top={HEAD_TOP} />
      <div style={{position: 'absolute', left: SAFE.left - 20, top: 600}}>
        <Stickman pose={(p.pose ?? 'think') as PoseName} emotion={(p.emotion ?? 'surprised') as Emotion} size={420} />
      </div>
      <div style={{position: 'absolute', left: 370, top: 580, width: 560, height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <Visual kind={p.visual ?? 'heart'} params={p.visual_params} size={p.visual === 'muscle' ? 560 : 480} k={k} />
      </div>
    </AbsoluteFill>
  );
};

/* --------------------------------- GUIDE -------------------------------- */
export const GuideT: React.FC = () => {
  const {t, dur, p} = useShot();
  const icons: IconName[] = p.icons ?? [];
  return (
    <AbsoluteFill>
      <Background />
      <Headline text={p.headline ?? ''} top={HEAD_TOP} />
      <div style={{position: 'absolute', left: SAFE.left + 20, top: 540}}>
        <Stickman pose={(p.pose ?? 'present') as PoseName} emotion={(p.emotion ?? 'happy') as Emotion} size={500} />
      </div>
      <div style={{position: 'absolute', left: 560, top: 560, display: 'flex', flexDirection: 'column', gap: 40}}>
        {icons.map((n, i) => (
          <div key={n} style={{opacity: ramp(t, 0.2 + (i * dur) / 4, 0.5 + (i * dur) / 4)}}>
            <Icon name={n} size={150} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------- BODY --------------------------------- */
const BODY = {left: 330, top: 300, width: 360};
const bodyPt = (o: OrganKey) => ({x: BODY.left + (ORGAN_CENTER[o].x * BODY.width) / 400, y: BODY.top + (ORGAN_CENTER[o].y * BODY.width) / 400});

export const BodyT: React.FC = () => {
  const {t, dur, at, p} = useShot();
  const hl: OrganKey[] = p.highlight ?? [];
  // органы подсвечиваются по очереди: по слову из подписи или равномерно
  const labels: {organ: OrganKey; text: string}[] = p.labels ?? [];
  const when = (o: OrganKey, i: number) => {
    const lab = labels.find((l) => l.organ === o);
    return lab ? at(lab.text.split(' ')[0], (i + 0.2) / (hl.length + 0.5)) : (dur * (i + 0.2)) / (hl.length + 0.5);
  };
  const shown = hl.filter((o, i) => t >= when(o, i) - 0.1);
  const arrows: {from: OrganKey; to: OrganKey}[] = p.arrows ?? [];
  return (
    <AbsoluteFill>
      <Background />
      <div style={{position: 'absolute', left: BODY.left, top: BODY.top}}>
        <BodyOutline width={BODY.width} highlight={shown} />
      </div>
      <svg style={{position: 'absolute', inset: 0}} width={VIDEO.width} height={VIDEO.height}>
        {arrows.map((a, i) => {
          const f = bodyPt(a.from);
          const to = bodyPt(a.to);
          const s0 = when(a.from, hl.indexOf(a.from));
          return <ProcessArrow key={i} x1={f.x + 40} y1={f.y + 10} x2={to.x + 36} y2={to.y - 16} bend={-110} progress={ramp(t, s0 + 0.2, s0 + 1.2)} color={COLORS.nerve} width={9} />;
        })}
      </svg>
      {p.molecules &&
        [0, 1, 2].map((i) => {
          const f = bodyPt(p.molecules.from);
          const to = bodyPt(p.molecules.to);
          const s0 = dur * 0.55 + i * 0.2;
          const k = ramp(t, s0, s0 + 1);
          return (
            <Molecule key={i} kind={p.molecules.kind as MoleculeKind} size={80} color={COLORS.hormoneAlt}
              style={{position: 'absolute', left: f.x + (to.x - f.x) * k - 40 + i * 14, top: f.y + (to.y - f.y) * k - 40, opacity: k > 0 ? 1 : 0}} />
          );
        })}
      {labels.map((l, i) => {
        const pt = bodyPt(l.organ);
        const left = i % 2 === 0;
        const s0 = when(l.organ, hl.indexOf(l.organ));
        return t >= s0 - 0.1 ? <Chip key={i} text={l.text} x={left ? 250 : 750} y={Math.max(380, Math.min(1050, pt.y))} color={COLORS.accent} delay={s0} /> : null;
      })}
      {p.pose && (
        <div style={{position: 'absolute', left: 30, top: 720}}>
          <Stickman pose={p.pose as PoseName} emotion="neutral" size={320} />
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ---------------------------------- ZOOM --------------------------------- */
export const ZoomT: React.FC = () => {
  const {t, dur, p} = useShot();
  const organ: 'heart' | 'brain' | 'muscles' = p.organ ?? 'heart';
  const end: 'cell' | 'fiber' = p.end ?? (organ === 'muscles' ? 'fiber' : 'cell');
  const o = organ === 'muscles' ? 'muscles' : organ;
  // фазы: тело → орган (0–35%), орган крупно (35–60%), клетка/волокно (60–100%)
  const z1 = ramp(t, 0.1, dur * 0.35);
  const organIn = ramp(t, dur * 0.3, dur * 0.4);
  const z2 = ramp(t, dur * 0.42, dur * 0.62);
  const endIn = ramp(t, dur * 0.55, dur * 0.68);
  const level = endIn > 0.5 ? 2 : organIn > 0.5 ? 1 : 0;
  const target = organ === 'muscles' ? {x: 247, y: 620} : ORGAN_CENTER[o];
  const bx = BODY.left + (target.x * BODY.width) / 400;
  const by = BODY.top + (target.y * BODY.width) / 400;
  const organName = organ === 'muscles' ? 'MUSCLE' : organ.toUpperCase();
  return (
    <AbsoluteFill>
      <Background />
      {/* общий план: тело */}
      <div style={{opacity: 1 - organIn}}>
        <Camera x={bx} y={by} scale={organ === 'muscles' ? 3.2 : ORGAN_CENTER[o].zoom} progress={z1} centerY={720}>
          <div style={{position: 'absolute', left: BODY.left, top: BODY.top}}>
            <BodyOutline width={BODY.width} highlight={[o as OrganKey]} />
          </div>
        </Camera>
      </div>
      {/* орган крупно */}
      <div style={{opacity: organIn * (1 - endIn)}}>
        <Camera x={CX + 60} y={720} scale={3} progress={z2} centerY={720}>
          <div style={{position: 'absolute', left: CX - 330, top: organ === 'muscles' ? 590 : 450, width: 660, display: 'flex', justifyContent: 'center'}}>
            {organ === 'heart' && <Heart size={480} bpm={80} />}
            {organ === 'brain' && <Brain size={600} />}
            {organ === 'muscles' && <Muscle width={660} />}
          </div>
        </Camera>
      </div>
      {/* клетка / волокно */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: endIn, scale: String(0.7 + 0.3 * endIn)}}>
        {end === 'fiber' ? (
          <div style={{position: 'absolute', left: SAFE.left - 20, top: 520}}>
            <MuscleFiber width={880} damage={ramp(t, dur * 0.7, dur * 0.9)} />
          </div>
        ) : (
          <div style={{position: 'absolute', left: CX - 300, top: 420}}>
            <Cell size={600} receptors={p.receptors ?? 'membrane'} />
          </div>
        )}
      </div>
      <Breadcrumb items={['BODY', organName, end === 'fiber' ? 'FIBER' : 'CELL']} level={level} />
      {p.label && endIn > 0.6 && <Chip text={p.label} x={CX} y={1050} delay={dur * 0.65} />}
    </AbsoluteFill>
  );
};

/* ---------------------------------- ORGAN -------------------------------- */
export const OrganT: React.FC = () => {
  const {t, dur, p} = useShot();
  const k = ramp(t, 0.3, dur * 0.8);
  const from = p.from ?? {};
  const to = p.to ?? {};
  const v = (key: string, d = 0) => (from[key] ?? d) + ((to[key] ?? from[key] ?? d) - (from[key] ?? d)) * k;
  return (
    <AbsoluteFill>
      <Background tint={p.organ === 'heart' ? '#3A1F33' : COLORS.bgGlow} />
      {p.headline && <Headline text={p.headline} top={HEAD_TOP} />}
      <div style={{position: 'absolute', left: SAFE.left, width: VIDEO.width - SAFE.left - SAFE.right, top: 470, display: 'flex', justifyContent: 'center'}}>
        {p.organ === 'heart' && <Heart size={480} bpm={v('bpm', 70)} />}
        {p.organ === 'brain' && <Brain size={640} highlight={k > 0.3 ? to.highlight ?? [] : from.highlight ?? []} />}
        {p.organ === 'muscle' && <Muscle width={820} damage={v('damage')} repair={v('repair')} flex={v('flex')} />}
      </div>
      {(p.labels ?? []).map((l: string, i: number) => (
        <Chip key={i} text={l} x={CX} y={1000 + i * 0} delay={dur * 0.4} />
      ))}
    </AbsoluteFill>
  );
};

/* ---------------------------------- FIBER -------------------------------- */
export const FiberT: React.FC = () => {
  const {t, dur, at, p} = useShot();
  const stage: string = p.stage ?? 'damage';
  const lab: string[] = p.labels ?? [];
  // момент «главного слова» этапа — анимация стартует под голос
  const key = stage === 'immune' ? at('macrophages', 0.3) : stage === 'satellite' ? at('satellite', 0.15) : stage === 'rebuild' ? at('protein', 0.15) : at('damage', 0.4);
  const k = ramp(t, key, key + 1.4);
  let s: FiberState = {};
  if (stage === 'damage') s = {damage: k};
  if (stage === 'immune') s = {damage: 1, macrophages: k, clearing: ramp(t, key + 1.2, dur - 0.1)};
  if (stage === 'satellite') s = {damage: 0.2, clearing: 1, satellites: k};
  if (stage === 'rebuild') s = {satellites: 0, fuse: 1, protein: k, thicken: ramp(t, key + 0.5, dur)};
  return (
    <AbsoluteFill>
      <Background />
      {p.headline && <Headline text={p.headline} top={HEAD_TOP} />}
      <div style={{position: 'absolute', left: SAFE.left - 20, top: 520}}>
        <MuscleFiber width={880} {...s} />
      </div>
      {lab.map((l, i) => (t > key ? <Chip key={i} text={l} x={CX} y={1040} color={stage === 'immune' ? COLORS.hormone : COLORS.proven} delay={key} /> : null))}
    </AbsoluteFill>
  );
};

/* ---------------------------------- CELL --------------------------------- */
export const CellT: React.FC = () => {
  const {t, dur, p} = useShot();
  const C = {x: CX, y: 720, size: 600};
  const angles = [-60, 10, 80, 150, 220];
  const inside = p.receptors === 'nuclear';
  return (
    <AbsoluteFill>
      <Background />
      {p.headline && <Headline text={p.headline} top={HEAD_TOP} />}
      <div style={{position: 'absolute', left: C.x - C.size / 2, top: C.y - C.size / 2}}>
        <Cell size={C.size} receptors={p.receptors ?? 'membrane'} activated={t > dur * 0.6 ? 1 : 0} />
      </div>
      {angles.slice(0, inside ? 2 : 5).map((a, i) => {
        const r = (a * Math.PI) / 180;
        const k = ramp(t, 0.3 + i * 0.15, dur * 0.6 + i * 0.1);
        const endR = inside ? 120 : C.size / 2 + 40;
        const x = C.x + Math.cos(r) * (560 + (endR - 560) * k);
        const y = C.y + Math.sin(r) * (560 + (endR - 560) * k);
        return <Molecule key={i} kind={(p.molecule ?? 'amine') as MoleculeKind} size={110} color={COLORS.hormoneAlt} style={{position: 'absolute', left: x - 55, top: y - 55}} />;
      })}
      {p.label && t > dur * 0.5 && <Chip text={p.label} x={CX} y={1060} delay={dur * 0.5} />}
    </AbsoluteFill>
  );
};

/* ---------------------------------- GRAPH -------------------------------- */
export const GraphT: React.FC = () => {
  const {t, dur, p} = useShot();
  const prog = ramp(t, 0.2, dur * 0.85);
  const data: number[] = p.data ?? [0.2, 0.8, 0.5];
  const hi = p.highlight_index;
  const W = 860;
  const H = 560;
  return (
    <AbsoluteFill>
      <Background />
      <div style={{position: 'absolute', left: SAFE.left + 10, top: 340}}>
        <LineGraph width={W} height={H} title={p.title} data={data} xLabels={p.x_labels ?? []} yLabel={p.y_label} progress={prog} />
        {hi != null && prog > hi / (data.length - 1) && (
          <svg style={{position: 'absolute', left: 0, top: 0}} width={W} height={H}>
            <circle
              cx={70 + (hi / (data.length - 1)) * (W - 100)}
              cy={(p.title ? 70 : 20) + (1 - data[hi]) * (H - (p.title ? 70 : 20) - 70)}
              r={18 + Math.sin(t * 6) * 4}
              fill={COLORS.accent}
              stroke={COLORS.bg}
              strokeWidth={5}
            />
          </svg>
        )}
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------- BARS --------------------------------- */
export const BarsT: React.FC = () => {
  const {t, dur, p} = useShot();
  const bars = (p.bars ?? []).map((b: any, i: number) => ({...b, color: colorOf(b.color, COLORS.cell), value: b.value * ramp(t, 0.2 + (i * dur) / (p.bars.length + 1), 0.8 + (i * dur) / (p.bars.length + 1))}));
  return (
    <AbsoluteFill>
      <Background />
      {p.title && <Headline text={p.title} top={HEAD_TOP} size={70} />}
      <div style={{position: 'absolute', left: SAFE.left + 20, top: 440}}>
        <BarChart width={800} height={600} bars={bars} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------- FLOW --------------------------------- */
export const FlowT: React.FC = () => {
  const {t, dur, at, p} = useShot();
  const steps = p.steps ?? [];
  // каждый шаг появляется, когда звучит его первое слово (или равномерно)
  const times = steps.map((s: any, i: number) => at(s.label.split(' ')[0], (i * 0.85) / steps.length));
  const shown = times.filter((x: number) => t >= x - 0.15).length;
  const prog = Math.min(1, (shown - 1 + ramp(t, times[Math.max(0, shown - 1)] - 0.15, times[Math.max(0, shown - 1)] + 0.3)) / steps.length);
  return (
    <AbsoluteFill>
      <Background />
      <div style={{position: 'absolute', left: SAFE.left + 20, top: 360}}>
        <FlowChain width={800} progress={Math.max(0.01, prog)} steps={steps.map((s: any) => ({label: s.label, color: colorOf(s.color)}))} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------- TIPS --------------------------------- */
export const TipsT: React.FC = () => {
  const {t, dur, at, p} = useShot();
  const items: {icon: IconName; text: string; evidence: Evidence}[] = p.items ?? [];
  return (
    <AbsoluteFill>
      <Background />
      {p.headline && <Headline text={p.headline} top={HEAD_TOP} />}
      <div style={{position: 'absolute', left: SAFE.left, width: VIDEO.width - SAFE.left - SAFE.right, top: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36}}>
        {items.map((it, i) => {
          const s0 = at(it.text.split(' ')[0], 0.3 + i * 0.2);
          const k = ramp(t, s0 - 0.1, s0 + 0.35);
          return (
            <div key={i} style={{opacity: k, translate: `${(1 - k) * 120}px 0px`, display: 'flex', alignItems: 'center', gap: 30, background: COLORS.bgSoft, borderRadius: 36, padding: '26px 40px', border: `5px solid ${COLORS.bgGlow}`}}>
              <Icon name={it.icon} size={130} />
              <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
                <div style={{fontFamily: FONT_FAMILY, fontWeight: 900, fontSize: 64, color: COLORS.ink, textTransform: 'uppercase'}}>{it.text}</div>
                <EvidenceBadge kind={it.evidence ?? 'proven'} scale={0.8} />
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------- MYTH --------------------------------- */
const Card: React.FC<{title: string; text: string; color: string; style?: React.CSSProperties; children?: React.ReactNode}> = ({title, text, color, style, children}) => (
  <div style={{position: 'absolute', width: 560, padding: '26px 34px', borderRadius: 32, background: COLORS.bgSoft, border: `6px solid ${color}`, ...style}}>
    <div style={{fontFamily: FONT_FAMILY, fontWeight: 900, fontSize: 40, color, letterSpacing: 2}}>{title}</div>
    <div style={{fontFamily: FONT_FAMILY, fontWeight: 800, fontSize: 52, color: COLORS.ink, lineHeight: 1.15, marginTop: 8}}>{text}</div>
    {children}
  </div>
);

export const MythT: React.FC = () => {
  const {t, dur, at, p} = useShot();
  // штамп — на слове «myth», но не позже чем за 1.4 c до конца кадра,
  // чтобы карточка с фактом успела появиться и прочитаться
  const tMyth = Math.min(at('myth', 0.45), dur - 1.4);
  const stamp = ramp(t, tMyth - 0.05, tMyth + 0.25);
  const factIn = ramp(t, tMyth + 0.25, tMyth + 0.65);
  return (
    <AbsoluteFill>
      <Background tint="#3A1F2A" />
      <Card title="CLAIM" text={p.myth ?? ''} color={COLORS.myth} style={{left: SAFE.left + 30, top: 330, paddingBottom: 50, opacity: ramp(t, 0, 0.3)}}>
        <div
          style={{
            position: 'absolute',
            right: 24,
            bottom: -34,
            opacity: stamp,
            scale: String(1.8 - 0.8 * stamp),
            rotate: '-12deg',
            fontFamily: FONT_FAMILY,
            fontWeight: 900,
            fontSize: 64,
            color: COLORS.myth,
            border: `7px solid ${COLORS.myth}`,
            borderRadius: 14,
            padding: '0 16px',
          }}
        >
          MYTH
        </div>
      </Card>
      <Card title="SCIENCE SAYS" text={p.fact ?? ''} color={COLORS.proven} style={{left: SAFE.left + 30, top: 660, opacity: factIn, translate: `0px ${(1 - factIn) * 60}px`}} />
      <div style={{position: 'absolute', left: 640, top: 760}}>
        <Stickman pose={(p.pose ?? 'shrug') as PoseName} emotion={t > tMyth ? 'happy' : 'worried'} size={300} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------- OUTRO -------------------------------- */
export const OutroT: React.FC = () => {
  const {t, p} = useShot();
  return (
    <AbsoluteFill>
      <Background tint="#24304A" />
      <Headline text={p.headline ?? ''} top={HEAD_TOP} delay={0.2} />
      <div style={{position: 'absolute', left: 0, width: VIDEO.width - SAFE.right + SAFE.left, top: 560, display: 'flex', justifyContent: 'center'}}>
        <Stickman pose={(p.pose ?? 'wave') as PoseName} emotion={(p.emotion ?? 'happy') as Emotion} size={440} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: SAFE.left,
          width: VIDEO.width - SAFE.left - SAFE.right,
          top: 1050,
          textAlign: 'center',
          opacity: ramp(t, 0.3, 0.8),
        }}
      >
        <span style={{fontFamily: FONT_FAMILY, fontWeight: 700, fontSize: TYPE.small, color: COLORS.muted, background: COLORS.bgSoft, borderRadius: 999, padding: '10px 28px'}}>
          Educational, not medical advice
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const TEMPLATES: Record<string, React.FC> = {
  hook: HookT,
  guide: GuideT,
  body: BodyT,
  zoom: ZoomT,
  organ: OrganT,
  fiber: FiberT,
  cell: CellT,
  graph: GraphT,
  bars: BarsT,
  flow: FlowT,
  tips: TipsT,
  myth: MythT,
  outro: OutroT,
};
