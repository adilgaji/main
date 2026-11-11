/**
 * Клетка и молекулы гормонов.
 *
 * Важная биология (учебник физиологии, напр. Guyton & Hall):
 *  - стероидные гормоны (тестостерон, кортизол, эстрадиол) жирорастворимы,
 *    проходят через мембрану и связываются с рецептором ВНУТРИ клетки;
 *  - пептидные (инсулин, гормон роста) и большинство аминов (адреналин)
 *    связываются с рецептором НА МЕМБРАНЕ.
 * Поэтому у клетки есть режим receptors: 'membrane' | 'nuclear'.
 */
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS} from '../style';

/* ============================== КЛЕТКА ============================== */
export const Cell: React.FC<{
  size?: number;
  receptors?: 'membrane' | 'nuclear' | 'none';
  /** подсветить рецепторы (гормон связался) 0..1 */
  activated?: number;
  style?: React.CSSProperties;
}> = ({size = 420, receptors = 'membrane', activated = 0, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const wobble = Math.sin((frame / fps) * 2) * 3;
  const membrane = `M 200 ${28 + wobble} C 310 ${30 - wobble}, 372 110, 370 200 C 368 300, 300 ${372 + wobble}, 200 370 C 98 368, 30 300, 30 200 C 30 104, ${96 + wobble} 26, 200 ${28 + wobble} Z`;
  const recAngles = [-60, 10, 80, 150, 220];
  const recColor = activated > 0.5 ? COLORS.accent : COLORS.gland;
  return (
    <svg viewBox="0 0 400 400" width={size} height={size} style={{overflow: 'visible', ...style}}>
      {/* цитоплазма + двойная мембрана */}
      <path d={membrane} fill={COLORS.cell} fillOpacity={0.22} stroke={COLORS.cell} strokeWidth={10} />
      <path d={membrane} fill="none" stroke={COLORS.bg} strokeWidth={3} />
      {/* эндоплазматическая сеть */}
      <g stroke={COLORS.cellDark} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.9}>
        <path d="M 120 140 Q 110 200 130 250" />
        <path d="M 104 130 Q 90 200 112 266" />
        <path d="M 260 120 Q 280 130 290 160" />
      </g>
      {/* митохондрии */}
      {[
        {x: 270, y: 260, r: 20},
        {x: 110, y: 300, r: -30},
        {x: 290, y: 190, r: 70},
      ].map((m, i) => (
        <g key={i} transform={`translate(${m.x} ${m.y}) rotate(${m.r})`}>
          <rect x={-30} y={-14} width={60} height={28} rx={14} fill={COLORS.mito} />
          <path d="M -20 -8 L -14 8 L -6 -8 L 2 8 L 10 -8 L 18 8" stroke="#B9652A" strokeWidth={3} fill="none" />
        </g>
      ))}
      {/* ядро */}
      <circle cx={196} cy={196} r={66} fill={COLORS.nucleus} stroke={COLORS.cellDark} strokeWidth={6} />
      <circle cx={214} cy={182} r={18} fill={COLORS.cellDark} />
      {/* ДНК-«ниточки» */}
      <path d="M 156 214 Q 170 200 184 214 Q 198 228 212 214 Q 226 200 238 214" stroke={COLORS.cell} strokeWidth={3} fill="none" />
      {/* рецепторы */}
      {receptors === 'membrane' &&
        recAngles.map((a) => {
          const r = (a * Math.PI) / 180;
          const x = 200 + Math.cos(r) * 170;
          const y = 200 + Math.sin(r) * 170;
          return (
            <g key={a} transform={`translate(${x} ${y}) rotate(${a + 90})`}>
              <path d="M 0 10 L 0 -12 M 0 -12 L -10 -26 M 0 -12 L 10 -26" stroke={recColor} strokeWidth={7} strokeLinecap="round" fill="none" />
            </g>
          );
        })}
      {receptors === 'nuclear' && (
        <g>
          {[
            {x: 152, y: 120},
            {x: 262, y: 230},
          ].map((p, i) => (
            <path key={i} d={`M ${p.x - 14} ${p.y + 10} Q ${p.x} ${p.y - 18} ${p.x + 14} ${p.y + 10}`} stroke={recColor} strokeWidth={8} fill="none" strokeLinecap="round" />
          ))}
        </g>
      )}
    </svg>
  );
};

/* ============================== МОЛЕКУЛЫ ============================== */
export type MoleculeKind = 'steroid' | 'amine' | 'peptide';

const hex = (cx: number, cy: number, s: number) =>
  Array.from({length: 6}, (_, i) => {
    const a = ((60 * i - 90) * Math.PI) / 180; // «остриём вверх»
    return [cx + s * Math.cos(a), cy + s * Math.sin(a)] as const;
  });
const poly = (pts: readonly (readonly [number, number])[]) => `M ${pts.map((p) => p.join(' ')).join(' L ')} Z`;

/** Стероидный скелет: 3 шестиугольника + пятиугольник (кольца A, B, C, D). */
const steroidPaths = (s: number) => {
  const w = s * Math.sqrt(3);
  const A = hex(0, 0, s);
  const B = hex(w, 0, s);
  const C = hex(w * 1.5, -1.5 * s, s);
  // кольцо D делит правое вертикальное ребро кольца C
  const c1 = C[1]; // верх-право
  const c2 = C[2]; // низ-право
  const mid = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
  const pentR = s / (2 * Math.sin(Math.PI / 5));
  const apothem = pentR * Math.cos(Math.PI / 5);
  const center = [mid[0] + apothem, mid[1]];
  const D = Array.from({length: 5}, (_, i) => {
    const a = Math.PI + (i * 2 * Math.PI) / 5 + Math.PI / 5;
    return [center[0] + pentR * Math.cos(a), center[1] + pentR * Math.sin(a)] as const;
  });
  return {rings: [A, B, C].map(poly).concat(poly(D)), dEnd: D, aStart: A[4], cTop: C[0]};
};

export const Molecule: React.FC<{
  kind?: MoleculeKind;
  size?: number;
  color?: string;
  label?: string;
  spin?: boolean;
  style?: React.CSSProperties;
}> = ({kind = 'steroid', size = 200, color = COLORS.hormone, label, spin = true, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rot = spin ? Math.sin((frame / fps) * 1.5) * 8 : 0;
  const sw = 7;

  let content: React.ReactNode = null;
  if (kind === 'steroid') {
    const s = 30;
    const {rings, dEnd, aStart, cTop} = steroidPaths(s);
    content = (
      <g transform="translate(-48 18)">
        {rings.map((d, i) => (
          <path key={i} d={d} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        ))}
        {/* боковые группы (=O на кольце A, -OH на кольце D, метильная группа) */}
        <line x1={aStart[0]} y1={aStart[1]} x2={aStart[0] - 22} y2={aStart[1] + 12} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <circle cx={aStart[0] - 30} cy={aStart[1] + 16} r={9} fill={COLORS.blood} />
        <line x1={dEnd[2][0]} y1={dEnd[2][1]} x2={dEnd[2][0] + 18} y2={dEnd[2][1] - 16} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <circle cx={dEnd[2][0] + 25} cy={dEnd[2][1] - 22} r={9} fill={COLORS.blood} />
        <line x1={cTop[0]} y1={cTop[1]} x2={cTop[0]} y2={cTop[1] - 24} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      </g>
    );
  } else if (kind === 'amine') {
    const ring = hex(-30, 0, 34);
    content = (
      <g>
        <path d={poly(ring)} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        <circle cx={-30} cy={0} r={18} fill="none" stroke={color} strokeWidth={4} />
        {/* две OH-группы (катехол) */}
        <line x1={ring[5][0]} y1={ring[5][1]} x2={ring[5][0] - 18} y2={ring[5][1] - 14} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <circle cx={ring[5][0] - 26} cy={ring[5][1] - 20} r={9} fill={COLORS.blood} />
        <line x1={ring[4][0]} y1={ring[4][1]} x2={ring[4][0] - 20} y2={ring[4][1] + 10} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <circle cx={ring[4][0] - 28} cy={ring[4][1] + 14} r={9} fill={COLORS.blood} />
        {/* боковая цепь с азотом */}
        <path d={`M ${ring[1][0]} ${ring[1][1]} L 30 -18 L 52 0 L 74 -18`} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={80} cy={-22} r={10} fill={COLORS.vein} />
      </g>
    );
  } else {
    const beads = [COLORS.hormone, COLORS.hormoneAlt, COLORS.gland, COLORS.hormone, COLORS.cell, COLORS.hormoneAlt, COLORS.hormone];
    content = (
      <g>
        <path d="M -84 10 Q -60 -30 -36 0 Q -12 30 12 0 Q 36 -30 60 0 Q 72 14 84 4" stroke={COLORS.muted} strokeWidth={4} fill="none" />
        {beads.map((c, i) => {
          const x = -84 + i * 28;
          const y = Math.sin(i * 1.3) * 18;
          return <circle key={i} cx={x} cy={y} r={14} fill={c} stroke={COLORS.bg} strokeWidth={3} />;
        })}
      </g>
    );
  }

  return (
    <svg viewBox="-110 -110 220 220" width={size} height={size} style={{overflow: 'visible', ...style}}>
      <g transform={`rotate(${rot})`}>{content}</g>
      {label && (
        <text className="txt" x={0} y={100} textAnchor="middle" fontFamily="Montserrat" fontWeight={800} fontSize={26} fill={COLORS.ink}>
          {label}
        </text>
      )}
    </svg>
  );
};
