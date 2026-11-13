/**
 * Шаблоны кадров (типы из docs/STORYBOARD_SCHEMA.md).
 * Принцип «заполненного кадра»: фон-среда по теме (Env) + крупная схема + крупный гид + чёткие надписи.
 * Каждый кадр рисуется в выбранном стиле видео через StyleLayer (слоты bg / fg / actor / ui).
 * Безопасная зона: заголовок сверху (y≈250), схема в зоне y 330–1110, субтитры ниже (y≈1130–1390).
 */
import React from 'react';
import {COLORS, FONT_FAMILY, SAFE, TYPE, VIDEO} from '../style';
import {Chip, Headline} from '../lib/Kit';
import {Camera} from '../lib/Kit';
import {Stickman, PoseName, Emotion} from '../lib/Stickman';
import {BodyOutline, ORGAN_CENTER, OrganKey} from '../lib/BodyOutline';
import {Brain, Heart, Muscle} from '../lib/Organs';
import {Cell, Molecule, MoleculeKind} from '../lib/CellAndMolecules';
import {BarChart, EvidenceBadge, Evidence, FlowChain, Icon, IconName, LineGraph, ProcessArrow} from '../lib/Diagram';
import {MuscleFiber, FiberState} from '../lib/MuscleFiber';
import {Env, EnvKind, envFor} from '../lib/Env';
import {StyleLayer} from '../styles/StyleLayer';
import {Board, Location, LocationKind, boardFor} from '../lib/Scenes';
import {Breadcrumb, colorOf, ramp, useShot} from './shot';

const HEAD_TOP = SAFE.top + 30;
const CX = (SAFE.left + VIDEO.width - SAFE.right) / 2; // центр безопасной зоны по X (≈ 490)
const abs = (left: number, top: number, extra: React.CSSProperties = {}): React.CSSProperties => ({position: 'absolute', left, top, ...extra});

/** Кадр в стиле видео. */
const Frame: React.FC<{env: EnvKind; fg: React.ReactNode; actor?: React.ReactNode; ui?: React.ReactNode}> = ({env, fg, actor, ui}) => {
  const {style, env: picked, shot, location, variant} = useShot();
  // фон — настоящая локация (класс, аудитория, лаборатория…) в вариации этого кадра; схема — «на доске»
  if (location) {
    const loc = location as LocationKind;
    return (
      <StyleLayer
        style={style}
        seed={shot.id}
        bg={<Location kind={loc} variant={variant} />}
        fg={
          <>
            <Board kind={boardFor(loc, variant)} />
            {fg}
          </>
        }
        actor={actor}
        ui={ui}
      />
    );
  }
  return <StyleLayer style={style} seed={shot.id} bg={<Env kind={(picked as EnvKind) ?? env} seed={shot.id} />} fg={fg} actor={actor} ui={ui} />;
};

const Guide: React.FC<{left: number; top: number; size: number; pose?: string; emotion?: string; toPose?: string; poseT?: number}> = ({left, top, size, pose = 'point', emotion = 'happy', toPose, poseT}) => (
  <div style={abs(left, top)}>
    <Stickman pose={pose as PoseName} emotion={emotion as Emotion} size={size} toPose={toPose as PoseName | undefined} poseT={poseT} />
  </div>
);

/* ----------------------------- крупные визуалы ----------------------------- */
const Visual: React.FC<{kind: string; params?: any; k: number}> = ({kind, params = {}, k}) => {
  switch (kind) {
    case 'heart':
      return <Heart size={560} bpm={params.bpm ?? 75} />;
    case 'brain':
      return <Brain size={760} highlight={k > 0.3 ? params.highlight ?? [] : []} />;
    case 'muscle':
      return <Muscle width={900} damage={(params.damage ?? 0) * k} repair={(params.repair ?? 0) * k} flex={(params.flex ?? 0) * k} />;
    case 'cell':
      return <Cell size={660} receptors={params.receptors ?? 'membrane'} activated={k > 0.8 ? 1 : 0} />;
    case 'body':
      return <BodyOutline width={400} highlight={k > 0.2 ? params.highlight ?? [] : []} />;
    case 'molecule':
      return <Molecule kind={params.kind ?? 'steroid'} size={560} />;
    case 'icon':
      return <Icon name={params.name ?? 'flask'} size={420} />;
    default:
      return null;
  }
};

/* --------------------------------- HOOK --------------------------------- */
export const HookT: React.FC = () => {
  const {t, dur, at, p} = useShot();
  const kw = (p.headline ?? '').match(/\*([^*]+)\*/)?.[1] ?? '';
  const k = ramp(t, Math.min(at(kw, 0.45), dur - 0.8), Math.min(at(kw, 0.45) + 1.2, dur));
  const zoom = 1 + ramp(t, 0, dur) * 0.06; // медленный наезд камеры
  const wide = p.visual === 'muscle';
  return (
    <Frame
      env={envFor(p.visual)}
      fg={
        <div style={abs(wide ? 90 : 250, 420, {width: wide ? 900 : 720, height: 660, display: 'flex', alignItems: 'center', justifyContent: 'center', scale: String(zoom)})}>
          <Visual kind={p.visual ?? 'heart'} params={p.visual_params} k={k} />
        </div>
      }
      actor={<Guide left={0} top={640} size={500} pose={p.pose ?? 'think'} emotion={p.emotion ?? 'surprised'} />}
      ui={<Headline text={p.headline ?? ''} top={HEAD_TOP} />}
    />
  );
};

/* --------------------------------- GUIDE -------------------------------- */
export const GuideT: React.FC = () => {
  const {t, dur, p} = useShot();
  const icons: IconName[] = p.icons ?? [];
  const spots = [
    {x: 700, y: 600},
    {x: 560, y: 820},
    {x: 760, y: 1010},
  ];
  return (
    <Frame
      env="soft"
      fg={
        <>
          {icons.map((n, i) => {
            const s = spots[i];
            const k = ramp(t, 0.2 + (i * dur) / 4, 0.55 + (i * dur) / 4);
            return (
              <div key={n} style={abs(s.x - 120, s.y - 120, {width: 240, height: 240, borderRadius: '50%', background: COLORS.bgSoft, border: `8px solid ${COLORS.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: k, scale: String(0.7 + 0.3 * k)})}>
                <Icon name={n} size={160} />
              </div>
            );
          })}
        </>
      }
      actor={<Guide left={10} top={430} size={680} pose={p.pose ?? 'present'} emotion={p.emotion ?? 'happy'} />}
      ui={<Headline text={p.headline ?? ''} top={HEAD_TOP} />}
    />
  );
};

/* ---------------------------------- BODY --------------------------------- */
const BODY = {left: 330, top: 300, width: 440};
const bodyPt = (o: OrganKey) => ({x: BODY.left + (ORGAN_CENTER[o].x * BODY.width) / 400, y: BODY.top + (ORGAN_CENTER[o].y * BODY.width) / 400});

export const BodyT: React.FC = () => {
  const {t, dur, at, p} = useShot();
  const hl: OrganKey[] = p.highlight ?? [];
  const labels: {organ: OrganKey; text: string}[] = p.labels ?? [];
  const when = (o: OrganKey, i: number) => {
    const lab = labels.find((l) => l.organ === o);
    return lab ? at(lab.text.split(' ')[0], (i + 0.2) / (hl.length + 0.5)) : (dur * (i + 0.2)) / (hl.length + 0.5);
  };
  const shown = hl.filter((o, i) => t >= when(o, i) - 0.1);
  const arrows: {from: OrganKey; to: OrganKey}[] = p.arrows ?? [];
  const env = envFor(hl[hl.length - 1]);
  return (
    <Frame
      env={env === 'soft' ? 'cells' : env}
      fg={
        <>
          <div style={abs(BODY.left, BODY.top)}>
            <BodyOutline width={BODY.width} highlight={shown} />
          </div>
          <svg style={abs(0, 0)} width={VIDEO.width} height={VIDEO.height}>
            {arrows.map((a, i) => {
              const f = bodyPt(a.from);
              const to = bodyPt(a.to);
              const s0 = when(a.from, hl.indexOf(a.from));
              return <ProcessArrow key={i} x1={f.x + 50} y1={f.y + 10} x2={to.x + 44} y2={to.y - 18} bend={-130} progress={ramp(t, s0 + 0.2, s0 + 1.2)} color={COLORS.nerve} width={11} />;
            })}
          </svg>
          {p.molecules &&
            [0, 1, 2, 3].map((i) => {
              const f = bodyPt(p.molecules.from);
              const to = bodyPt(p.molecules.to);
              const s0 = dur * 0.5 + i * 0.18;
              const k = ramp(t, s0, s0 + 1);
              return (
                <Molecule key={i} kind={p.molecules.kind as MoleculeKind} size={96} color={COLORS.hormoneAlt}
                  style={abs(f.x + (to.x - f.x) * k - 48 + i * 16, f.y + (to.y - f.y) * k - 48, {opacity: k > 0 ? 1 : 0})} />
              );
            })}
        </>
      }
      actor={p.pose ? <Guide left={-10} top={760} size={420} pose={p.pose} emotion="neutral" /> : undefined}
      ui={
        <>
          {labels.map((l, i) => {
            const pt = bodyPt(l.organ);
            const s0 = when(l.organ, hl.indexOf(l.organ));
            return t >= s0 - 0.1 ? <Chip key={i} text={l.text} x={i % 2 === 0 ? 270 : 720} y={Math.max(320, Math.min(1060, pt.y))} color={COLORS.accent} delay={s0} /> : null;
          })}
        </>
      }
    />
  );
};

/* ---------------------------------- ZOOM --------------------------------- */
export const ZoomT: React.FC = () => {
  const {t, dur, p} = useShot();
  const organ: 'heart' | 'brain' | 'muscles' = p.organ ?? 'heart';
  const end: 'cell' | 'fiber' = p.end ?? (organ === 'muscles' ? 'fiber' : 'cell');
  const o = organ === 'muscles' ? 'muscles' : organ;
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
    <Frame
      env={end === 'fiber' ? 'muscle' : envFor(organ)}
      fg={
        <>
          <div style={{opacity: 1 - organIn, position: 'absolute', inset: 0}}>
            <Camera x={bx} y={by} scale={organ === 'muscles' ? 3.2 : ORGAN_CENTER[o].zoom} progress={z1} centerY={720}>
              <div style={abs(BODY.left, BODY.top)}>
                <BodyOutline width={BODY.width} highlight={[o as OrganKey]} />
              </div>
            </Camera>
          </div>
          <div style={{opacity: organIn * (1 - endIn), position: 'absolute', inset: 0}}>
            <Camera x={CX + 60} y={720} scale={3} progress={z2} centerY={720}>
              <div style={abs(organ === 'muscles' ? 40 : CX - 380, organ === 'muscles' ? 560 : 400, {width: organ === 'muscles' ? 1000 : 760, display: 'flex', justifyContent: 'center'})}>
                {organ === 'heart' && <Heart size={600} bpm={80} />}
                {organ === 'brain' && <Brain size={760} />}
                {organ === 'muscles' && <Muscle width={1000} />}
              </div>
            </Camera>
          </div>
          <div style={{position: 'absolute', inset: 0, opacity: endIn, scale: String(0.7 + 0.3 * endIn)}}>
            {end === 'fiber' ? (
              <div style={abs(-50, 430)}>
                <MuscleFiber width={1180} damage={ramp(t, dur * 0.7, dur * 0.9)} />
              </div>
            ) : (
              <div style={abs(CX - 360, 380)}>
                <Cell size={720} receptors={p.receptors ?? 'membrane'} />
              </div>
            )}
          </div>
        </>
      }
      ui={
        <>
          <Breadcrumb items={['BODY', organName, end === 'fiber' ? 'FIBER' : 'CELL']} level={level} />
          {p.label && endIn > 0.6 && <Chip text={p.label} x={CX} y={1070} delay={dur * 0.65} />}
        </>
      }
    />
  );
};

/* ---------------------------------- ORGAN -------------------------------- */
export const OrganT: React.FC = () => {
  const {t, dur, p} = useShot();
  const k = ramp(t, 0.3, dur * 0.8);
  const from = p.from ?? {};
  const to = p.to ?? {};
  const v = (key: string, d = 0) => (from[key] ?? d) + ((to[key] ?? from[key] ?? d) - (from[key] ?? d)) * k;
  const zoom = 1 + ramp(t, 0, dur) * 0.05;
  return (
    <Frame
      env={envFor(p.organ)}
      fg={
        <div style={abs(0, p.organ === 'muscle' ? 560 : 390, {width: VIDEO.width, display: 'flex', justifyContent: 'center', scale: String(zoom)})}>
          {p.organ === 'heart' && <Heart size={640} bpm={v('bpm', 70)} />}
          {p.organ === 'brain' && <Brain size={860} highlight={k > 0.3 ? to.highlight ?? [] : from.highlight ?? []} />}
          {p.organ === 'muscle' && <Muscle width={1040} damage={v('damage')} repair={v('repair')} flex={v('flex')} />}
        </div>
      }
      actor={<Guide left={-10} top={820} size={360} pose="point" emotion="happy" />}
      ui={
        <>
          {p.headline && <Headline text={p.headline} top={HEAD_TOP} />}
          {(p.labels ?? []).slice(0, 1).map((l: string, i: number) => (
            <Chip key={i} text={l} x={CX + 80} y={1060} delay={dur * 0.4} />
          ))}
        </>
      }
    />
  );
};

/* ---------------------------------- FIBER -------------------------------- */
export const FiberT: React.FC = () => {
  const {t, dur, at, p} = useShot();
  const stage: string = p.stage ?? 'damage';
  const lab: string[] = p.labels ?? [];
  const key = stage === 'immune' ? at('cleanup', at('macrophages', 0.3) / dur) : stage === 'satellite' ? at('repair', at('satellite', 0.15) / dur) : stage === 'rebuild' ? at('protein', at('building', 0.15) / dur) : at('damage', at('tears', 0.4) / dur);
  const k = ramp(t, key, key + 1.4);
  let s: FiberState = {};
  if (stage === 'damage') s = {damage: k};
  if (stage === 'immune') s = {damage: 1, macrophages: k, clearing: ramp(t, key + 1.2, dur - 0.1)};
  if (stage === 'satellite') s = {damage: 0.2, clearing: 1, satellites: k};
  if (stage === 'rebuild') s = {satellites: 0, fuse: 1, protein: k, thicken: ramp(t, key + 0.5, dur)};
  return (
    <Frame
      env="muscle"
      fg={
        <div style={abs(-50, 430, {scale: String(1 + ramp(t, 0, dur) * 0.04)})}>
          <MuscleFiber width={1180} {...s} />
        </div>
      }
      actor={<Guide left={10} top={700} size={450} pose="point" emotion={stage === 'damage' ? 'surprised' : 'excited'} />}
      ui={
        <>
          {p.headline && <Headline text={p.headline} top={HEAD_TOP} />}
          {lab.slice(0, 1).map((l, i) => (t > key ? <Chip key={i} text={l} x={CX + 140} y={1070} color={stage === 'immune' ? COLORS.hormone : COLORS.proven} delay={key} /> : null))}
        </>
      }
    />
  );
};

/* ---------------------------------- CELL --------------------------------- */
export const CellT: React.FC = () => {
  const {t, dur, p} = useShot();
  const C = {x: CX + 30, y: 740, size: 720};
  const angles = [-60, 10, 80, 150, 220];
  const inside = p.receptors === 'nuclear';
  return (
    <Frame
      env="cells"
      fg={
        <>
          <div style={abs(C.x - C.size / 2, C.y - C.size / 2)}>
            <Cell size={C.size} receptors={p.receptors ?? 'membrane'} activated={t > dur * 0.6 ? 1 : 0} />
          </div>
          {angles.slice(0, inside ? 2 : 5).map((a, i) => {
            const r = (a * Math.PI) / 180;
            const k = ramp(t, 0.3 + i * 0.15, dur * 0.6 + i * 0.1);
            const endR = inside ? 140 : C.size / 2 + 46;
            const x = C.x + Math.cos(r) * (640 + (endR - 640) * k);
            const y = C.y + Math.sin(r) * (640 + (endR - 640) * k);
            return <Molecule key={i} kind={(p.molecule ?? 'amine') as MoleculeKind} size={130} color={COLORS.hormoneAlt} style={abs(x - 65, y - 65)} />;
          })}
        </>
      }
      actor={<Guide left={-20} top={820} size={340} pose="point" emotion="surprised" />}
      ui={
        <>
          {p.headline && <Headline text={p.headline} top={HEAD_TOP} />}
          {p.label && t > dur * 0.5 && <Chip text={p.label} x={CX + 120} y={1080} delay={dur * 0.5} />}
        </>
      }
    />
  );
};

/* ------------------------- карточка-подложка для графиков ------------------------- */
const Card: React.FC<{x: number; y: number; w: number; h: number; children?: React.ReactNode}> = ({x, y, w, h, children}) => (
  <div style={abs(x, y, {width: w, height: h, borderRadius: 40, background: COLORS.bgSoft, boxShadow: `0 0 0 6px ${COLORS.bgGlow}`})}>{children}</div>
);

/* ---------------------------------- GRAPH -------------------------------- */
export const GraphT: React.FC = () => {
  const {t, dur, p} = useShot();
  const prog = ramp(t, 0.2, dur * 0.85);
  const data: number[] = p.data ?? [0.2, 0.8, 0.5];
  const hi = p.highlight_index;
  const W = 900;
  const H = 700;
  return (
    <Frame
      env="soft"
      fg={
        <Card x={40} y={320} w={W + 40} h={H + 60}>
          <div style={abs(20, 30)}>
            <LineGraph width={W} height={H} title={p.title} data={data} xLabels={p.x_labels ?? []} yLabel={p.y_label} progress={prog} />
            {hi != null && prog > hi / (data.length - 1) && (
              <svg style={abs(0, 0)} width={W} height={H}>
                <circle cx={70 + (hi / (data.length - 1)) * (W - 130)} cy={(p.title ? 70 : 20) + (1 - data[hi]) * (H - (p.title ? 70 : 20) - 70)} r={22 + Math.sin(t * 6) * 5} fill={COLORS.accent} stroke={COLORS.bg} strokeWidth={6} />
              </svg>
            )}
          </div>
        </Card>
      }
    />
  );
};

/* ---------------------------------- BARS --------------------------------- */
export const BarsT: React.FC = () => {
  const {t, dur, p} = useShot();
  const bars = (p.bars ?? []).map((b: any, i: number) => ({...b, color: colorOf(b.color, COLORS.cell), value: b.value * ramp(t, 0.2 + (i * dur) / (p.bars.length + 1), 0.8 + (i * dur) / (p.bars.length + 1))}));
  return (
    <Frame
      env="soft"
      fg={
        <Card x={60} y={420} w={900} h={660}>
          <div style={abs(30, 20)}>
            <BarChart width={840} height={620} bars={bars} />
          </div>
        </Card>
      }
      ui={p.title && <Headline text={p.title} top={HEAD_TOP} size={74} />}
    />
  );
};

/* ---------------------------------- FLOW --------------------------------- */
export const FlowT: React.FC = () => {
  const {t, at, p} = useShot();
  const steps = p.steps ?? [];
  const times = steps.map((s: any, i: number) => at(s.label.split(' ')[0], (i * 0.85) / steps.length));
  const shown = times.filter((x: number) => t >= x - 0.15).length;
  const prog = Math.min(1, (shown - 1 + ramp(t, times[Math.max(0, shown - 1)] - 0.15, times[Math.max(0, shown - 1)] + 0.3)) / steps.length);
  return (
    <Frame
      env="cells"
      fg={
        <div style={abs(260, 340)}>
          <FlowChain width={660} progress={Math.max(0.01, prog)} steps={steps.map((s: any) => ({label: s.label, color: colorOf(s.color)}))} />
        </div>
      }
      actor={<Guide left={-40} top={640} size={460} pose="present" emotion="happy" />}
    />
  );
};

/* ---------------------------------- TIPS --------------------------------- */
export const TipsT: React.FC = () => {
  const {t, dur, at, p} = useShot();
  const items: {icon: IconName; text: string; evidence: Evidence}[] = p.items ?? [];
  return (
    <Frame
      env="soft"
      fg={
        <div style={abs(300, 470, {width: 620, display: 'flex', flexDirection: 'column', gap: 40})}>
          {items.map((it, i) => {
            const fb = (0.3 + i * 0.2) * dur;
            const s0 = Math.min(...it.text.split(' ').map((w) => at(w, 0.3 + i * 0.2)), fb + 0.001);
            const k = ramp(t, s0 - 0.1, s0 + 0.35);
            return (
              <div key={i} style={{opacity: k, translate: `${(1 - k) * 120}px 0px`, display: 'flex', alignItems: 'center', gap: 26, background: COLORS.bgSoft, borderRadius: 40, padding: '30px 34px', border: `6px solid ${COLORS.bgGlow}`}}>
                <Icon name={it.icon} size={170} />
                <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
                  <div className="txt tx" style={{fontFamily: FONT_FAMILY, fontWeight: 900, fontSize: 64, lineHeight: 1.05, color: COLORS.ink, textTransform: 'uppercase'}}>{it.text}</div>
                  <EvidenceBadge kind={it.evidence ?? 'proven'} scale={0.85} />
                </div>
              </div>
            );
          })}
        </div>
      }
      actor={<Guide left={-30} top={560} size={500} pose="present" emotion="happy" />}
      ui={p.headline && <Headline text={p.headline} top={HEAD_TOP} />}
    />
  );
};

/* ---------------------------------- MYTH --------------------------------- */
const MythCard: React.FC<{title: string; text: string; color: string; style?: React.CSSProperties; children?: React.ReactNode}> = ({title, text, color, style, children}) => (
  <div style={{position: 'absolute', width: 570, padding: '30px 38px', borderRadius: 36, background: COLORS.bgSoft, border: `7px solid ${color}`, ...style}}>
    <div className="txt mt" style={{fontFamily: FONT_FAMILY, fontWeight: 900, fontSize: 42, color, letterSpacing: 2}}>{title}</div>
    <div className="txt mx" style={{fontFamily: FONT_FAMILY, fontWeight: 800, fontSize: 58, color: COLORS.ink, lineHeight: 1.12, marginTop: 8}}>{text}</div>
    {children}
  </div>
);

export const MythT: React.FC = () => {
  const {t, dur, at, p} = useShot();
  const tMyth = Math.min(at('myth', 0.45), dur - 1.4);
  const stamp = ramp(t, tMyth - 0.05, tMyth + 0.25);
  const factIn = ramp(t, tMyth + 0.25, tMyth + 0.65);
  return (
    <Frame
      env="cells"
      fg={
        <>
          <MythCard title="CLAIM" text={p.myth ?? ''} color={COLORS.myth} style={{left: SAFE.left + 10, top: 320, paddingBottom: 60, opacity: ramp(t, 0, 0.3)}}>
            <div className="txt" style={{position: 'absolute', right: 26, bottom: -38, opacity: stamp, scale: String(1.8 - 0.8 * stamp), rotate: '-12deg', fontFamily: FONT_FAMILY, fontWeight: 900, fontSize: 72, color: COLORS.myth, background: COLORS.bgSoft, border: `8px solid ${COLORS.myth}`, borderRadius: 16, padding: '0 18px'}}>
              MYTH
            </div>
          </MythCard>
          <MythCard title="SCIENCE SAYS" text={p.fact ?? ''} color={COLORS.proven} style={{left: SAFE.left + 10, top: 680, opacity: factIn, translate: `0px ${(1 - factIn) * 60}px`}} />
        </>
      }
      actor={<Guide left={640} top={760} size={370} pose={p.pose ?? 'shrug'} emotion={t > tMyth ? 'happy' : 'worried'} />}
    />
  );
};

/* ---------------------------------- OUTRO -------------------------------- */
export const OutroT: React.FC = () => {
  const {t, p} = useShot();
  return (
    <Frame
      env="cells"
      fg={<div style={abs(CX - 330, 470, {width: 660, height: 660, borderRadius: '50%', background: COLORS.bgSoft, opacity: 0.85})} />}
      actor={<Guide left={CX - 330} top={480} size={660} pose={p.pose ?? 'wave'} emotion={p.emotion ?? 'happy'} />}
      ui={
        <>
          <Headline text={p.headline ?? ''} top={HEAD_TOP} delay={0.2} />
          <div style={abs(SAFE.left, 1060, {width: VIDEO.width - SAFE.left - SAFE.right, textAlign: 'center', opacity: ramp(t, 0.3, 0.8)})}>
            <span style={{fontFamily: FONT_FAMILY, fontWeight: 700, fontSize: TYPE.small, color: COLORS.ink, background: COLORS.bgSoft, borderRadius: 999, padding: '10px 28px'}}>Educational, not medical advice</span>
          </div>
        </>
      }
    />
  );
};

/* ---------------------------------- STEPS -------------------------------- */
/** Чек-лист по шагам: каждый пункт появляется, когда звучит его слово. */
export const StepsT: React.FC = () => {
  const {t, dur, at, p} = useShot();
  const steps: {icon: IconName; text: string}[] = p.steps ?? [];
  return (
    <Frame
      env="soft"
      fg={
        <div style={abs(110, 500, {width: 860, display: 'flex', flexDirection: 'column', gap: 26})}>
          {steps.map((st, i) => {
            const fb = (0.15 + (i * 0.75) / Math.max(1, steps.length)) * dur;
            const s0 = Math.min(...st.text.split(' ').map((w) => at(w, fb / dur)), fb + 0.001);
            const k = ramp(t, s0 - 0.1, s0 + 0.35);
            return (
              <div key={i} style={{opacity: 0.25 + 0.75 * k, translate: `${(1 - k) * 80}px 0px`, display: 'flex', alignItems: 'center', gap: 24, background: COLORS.bgSoft, borderRadius: 30, padding: '18px 26px', border: `5px solid ${k > 0.5 ? COLORS.proven : COLORS.bgGlow}`}}>
                <div className="txt" style={{width: 74, height: 74, borderRadius: '50%', background: COLORS.accent, color: COLORS.accentInk, fontFamily: FONT_FAMILY, fontWeight: 900, fontSize: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>{k > 0.5 ? '✓' : i + 1}</div>
                <Icon name={st.icon} size={96} />
                <div className="txt tx" style={{fontFamily: FONT_FAMILY, fontWeight: 900, fontSize: 54, lineHeight: 1.05, color: COLORS.ink, textTransform: 'uppercase'}}>{st.text}</div>
              </div>
            );
          })}
        </div>
      }
      ui={p.title && <Headline text={p.title} top={HEAD_TOP} />}
    />
  );
};

/* --------------------------------- DO / DON'T ----------------------------- */
export const DoDontT: React.FC = () => {
  const {t, dur, p} = useShot();
  const col = (items: string[], good: boolean, delay: number) => (
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 18, background: COLORS.bgSoft, borderRadius: 32, padding: 24, border: `7px solid ${good ? COLORS.proven : COLORS.myth}`, opacity: ramp(t, delay, delay + 0.4)}}>
      <div className="txt" style={{fontFamily: FONT_FAMILY, fontWeight: 900, fontSize: 52, color: good ? COLORS.proven : COLORS.myth, textAlign: 'center'}}>{good ? '✓ DO' : "✗ DON'T"}</div>
      {items.map((it, i) => (
        <div key={i} className="txt mx" style={{fontFamily: FONT_FAMILY, fontWeight: 800, fontSize: 40, lineHeight: 1.12, color: COLORS.ink, opacity: ramp(t, delay + 0.3 + i * 0.4, delay + 0.6 + i * 0.4)}}>{it}</div>
      ))}
    </div>
  );
  return (
    <Frame
      env="soft"
      fg={
        <div style={abs(90, 500, {width: 900, display: 'flex', gap: 24})}>
          {col(p.do ?? [], true, 0.1)}
          {col(p.dont ?? [], false, dur * 0.45)}
        </div>
      }
      ui={p.title && <Headline text={p.title} top={HEAD_TOP} />}
    />
  );
};

/* --------------------------------- CHAPTER ------------------------------- */
/** Титульный кадр главы (для длинных видео): большой номер и название. */
export const ChapterT: React.FC = () => {
  const {t, p} = useShot();
  const k = ramp(t, 0, 0.5);
  return (
    <Frame
      env="abstract"
      fg={
        <div style={abs(CX - 260, 430, {width: 520, height: 520, borderRadius: '50%', background: COLORS.bgSoft, border: `14px solid ${COLORS.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', scale: String(0.7 + 0.3 * k), opacity: k})}>
          <div className="txt" style={{fontFamily: FONT_FAMILY, fontWeight: 900, fontSize: 300, color: COLORS.ink, lineHeight: 1}}>{p.number ?? 1}</div>
        </div>
      }
      ui={<Headline text={p.title ?? ''} top={HEAD_TOP} />}
    />
  );
};

export const TEMPLATES: Record<string, React.FC> = {
  chapter: ChapterT,
  steps: StepsT,
  do_dont: DoDontT,
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
