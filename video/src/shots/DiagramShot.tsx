// Кадр «Схема»: блоки и стрелки (ход битвы, причины и следствия, торговый путь, устройство города).
// Блоки стоят по сетке (столбец, строка); стрелки рисуются по мере появления блоков.
// Рамки и стрелки — в слое картинки, все надписи — в чётком слое текста на тех же местах,
// поэтому камера в этом кадре не двигается.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop, type BackdropKind} from '../components/Backdrop';
import {ShotFrame} from '../components/ShotFrame';
import {Appear, SourceLine, TitlePlate} from '../components/TextBits';
import {alpha, EASE, mix, ramp} from '../lib/anim';
import {LABEL_AREA, textWidth} from '../lib/labels';
import {FRAME, useStyle, type Palette} from '../style';

export type DiagramTone = 'paper' | 'accent' | 'accent2' | 'dark';

export type DiagramNode = {
  id: string;
  label: string;
  sub?: string;
  /** Место в сетке, с нуля */
  col: number;
  row: number;
  tone?: DiagramTone;
  appearAt?: number;
};

export type DiagramLink = {from: string; to: string; label?: string; dashed?: boolean; tone?: 'accent' | 'accent2' | 'light'; appearAt?: number};

export type DiagramShotProps = {
  frames: number;
  title?: string;
  subtitle?: string;
  nodes: DiagramNode[];
  links?: DiagramLink[];
  source?: string;
  backdrop?: BackdropKind;
  seed?: number;
};

type Placed = DiagramNode & {cx: number; cy: number; w: number; h: number; at: number};

const layout = (props: DiagramShotProps): Placed[] => {
  const cols = Math.max(1, ...props.nodes.map((n) => n.col + 1));
  const rows = Math.max(1, ...props.nodes.map((n) => n.row + 1));
  const top = props.title ? (props.subtitle ? 300 : 230) : LABEL_AREA.top;
  const bottom = LABEL_AREA.bottom - (props.source ? 56 : 0);
  const cellW = (LABEL_AREA.right - LABEL_AREA.left) / cols;
  const cellH = (bottom - top) / rows;
  const w = Math.min(520, cellW - 50);
  return props.nodes.map((n, i) => ({
    ...n,
    cx: LABEL_AREA.left + cellW * (n.col + 0.5),
    cy: top + cellH * (n.row + 0.5),
    w,
    h: Math.min(n.sub ? 196 : 140, cellH - 30),
    at: n.appearAt ?? 0.35 + i * 0.55,
  }));
};

const nodeColors = (p: Palette, tone: DiagramTone): {fill: string; edge: string; text: string; sub: string} => {
  switch (tone) {
    case 'accent':
      return {fill: p.accent, edge: mix(p.accent, p.bg, 0.35), text: p.ink, sub: alpha(p.ink, 0.8)};
    case 'accent2':
      return {fill: p.accent2, edge: mix(p.accent2, p.bg, 0.35), text: p.light, sub: alpha(p.light, 0.85)};
    case 'dark':
      return {fill: p.bgAlt, edge: p.accent, text: p.light, sub: alpha(p.light, 0.8)};
    default:
      return {fill: p.paper, edge: p.paperShade, text: p.ink, sub: alpha(p.ink, 0.75)};
  }
};

type Segment = {x1: number; y1: number; x2: number; y2: number; at: number; link: DiagramLink};

/** Отрезок стрелки: от края одного блока до края другого. */
const segments = (nodes: Placed[], links: DiagramLink[]): Segment[] => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Segment[] = [];
  for (const link of links) {
    const a = byId.get(link.from);
    const b = byId.get(link.to);
    if (!a || !b) {
      continue;
    }
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    const len = Math.hypot(dx, dy);
    if (len < 1) {
      continue;
    }
    const edge = (n: Placed): number => Math.min(dx === 0 ? Infinity : (n.w / 2 + 14) / Math.abs(dx), dy === 0 ? Infinity : (n.h / 2 + 14) / Math.abs(dy));
    const ta = edge(a);
    const tb = 1 - edge(b);
    if (tb <= ta) {
      continue;
    }
    out.push({x1: a.cx + dx * ta, y1: a.cy + dy * ta, x2: a.cx + dx * tb, y2: a.cy + dy * tb, at: link.appearAt ?? Math.max(a.at, b.at) + 0.25, link});
  }
  return out;
};

const DiagramArt: React.FC<DiagramShotProps> = (props) => {
  const {palette: p, stroke, radius} = useStyle();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const nodes = layout(props);
  const segs = segments(nodes, props.links ?? []);
  const lineColor = (tone?: string): string => (tone === 'accent2' ? p.accent2 : tone === 'light' ? p.light : p.accent);
  return (
    <AbsoluteFill>
      <Backdrop kind={props.backdrop ?? 'ink'} seed={props.seed ?? 3} />
      <svg width={FRAME.width} height={FRAME.height} style={{position: 'absolute', inset: 0}}>
        {segs.map((s, i) => {
          const k = ramp(frame, s.at * fps, 0.6 * fps, EASE.inOut);
          if (k <= 0) {
            return null;
          }
          const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
          const head = 26;
          const ex = s.x1 + (s.x2 - s.x1) * k;
          const ey = s.y1 + (s.y2 - s.y1) * k;
          const color = lineColor(s.link.tone);
          return (
            <g key={i}>
              <line x1={s.x1} y1={s.y1} x2={ex - Math.cos(ang) * head * 0.7} y2={ey - Math.sin(ang) * head * 0.7} stroke={color} strokeWidth={stroke + 4} strokeLinecap="round" strokeDasharray={s.link.dashed ? '4 18' : undefined} />
              <polygon points={`0,0 ${-head},${-head * 0.5} ${-head},${head * 0.5}`} fill={color} transform={`translate(${ex} ${ey}) rotate(${(ang * 180) / Math.PI})`} />
            </g>
          );
        })}
        {nodes.map((n) => {
          const k = ramp(frame, n.at * fps, 0.45 * fps, EASE.out);
          const c = nodeColors(p, n.tone ?? 'paper');
          const s = 0.9 + 0.1 * k;
          return (
            <g key={n.id} opacity={k} transform={`translate(${n.cx} ${n.cy + (1 - k) * 18}) scale(${s})`}>
              <rect x={-n.w / 2 + 6} y={-n.h / 2 + 10} width={n.w} height={n.h} rx={radius} fill={alpha('#000000', 0.3)} />
              <rect x={-n.w / 2} y={-n.h / 2} width={n.w} height={n.h} rx={radius} fill={c.fill} stroke={c.edge} strokeWidth={stroke} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** Самый крупный размер шрифта, при котором строка помещается по ширине. */
const fit = (text: string, family: string, weight: number, max: number, sizes: number[]): number =>
  sizes.find((s) => textWidth(text, family, s, weight) <= max) ?? sizes[sizes.length - 1];

const DiagramText: React.FC<DiagramShotProps> = (props) => {
  const {palette: p, fonts, radius} = useStyle();
  const nodes = layout(props);
  const segs = segments(nodes, props.links ?? []);
  return (
    <AbsoluteFill>
      {props.title ? <TitlePlate title={props.title} subtitle={props.subtitle} /> : null}
      {nodes.map((n) => {
        const c = nodeColors(p, n.tone ?? 'paper');
        const size = fit(n.label, fonts.display, 800, n.w - 40, [54, 50, 46, 42, 38, 34, 30]);
        const subSize = n.sub ? fit(n.sub, fonts.body, 600, n.w - 36, [36, 33, 30, 27, 24]) : 0;
        return (
          <Appear
            key={n.id}
            delay={n.at + 0.1}
            rise={10}
            style={{position: 'absolute', left: n.cx - n.w / 2, top: n.cy - n.h / 2, width: n.w, height: n.h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 16px'}}
          >
            <div style={{fontFamily: fonts.display, fontWeight: 800, fontSize: size, lineHeight: 1.1, color: c.text}}>{n.label}</div>
            {n.sub ? <div style={{marginTop: 6, fontFamily: fonts.body, fontWeight: 600, fontSize: subSize, lineHeight: 1.15, color: c.sub}}>{n.sub}</div> : null}
          </Appear>
        );
      })}
      {segs.map((s, i) => {
        if (!s.link.label) {
          return null;
        }
        const w = textWidth(s.link.label, fonts.body, 28, 700) + 28;
        return (
          <Appear
            key={i}
            delay={s.at + 0.4}
            rise={0}
            style={{position: 'absolute', left: (s.x1 + s.x2) / 2 - w / 2, top: (s.y1 + s.y2) / 2 - 22, width: w, height: 44, borderRadius: radius, backgroundColor: alpha(p.bg, 0.92), color: p.light, fontFamily: fonts.body, fontWeight: 700, fontSize: 28, lineHeight: '42px', textAlign: 'center', whiteSpace: 'nowrap'}}
          >
            {s.link.label}
          </Appear>
        );
      })}
      {props.source ? <SourceLine text={props.source} /> : null}
    </AbsoluteFill>
  );
};

export const DiagramShot: React.FC<DiagramShotProps> = (props) => (
  <ShotFrame frames={props.frames} drift={null} art={<DiagramArt {...props} />} text={<DiagramText {...props} />} />
);
