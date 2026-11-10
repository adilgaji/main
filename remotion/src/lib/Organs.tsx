/**
 * Крупные планы органов: сердце, мозг, мышца.
 * Упрощённо, но без противоречий учебнику анатомии.
 */
import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS} from '../style';
import {useSvgId} from './svgId';

/* =====================================================================
 * СЕРДЦЕ — вид спереди. Верхушка (apex) смотрит вниз и влево у человека
 * (вправо на экране). Дуга аорты уходит влево у человека, от неё вверх —
 * три ветви. Верхняя полая вена (синяя) входит в правое предсердие.
 * ===================================================================== */
export const Heart: React.FC<{size?: number; bpm?: number; beating?: boolean; style?: React.CSSProperties}> = ({
  size = 300,
  bpm = 70,
  beating = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const phase = beating ? ((frame / fps) * (bpm / 60)) % 1 : 0.5;
  // короткое сокращение («тук») и расслабление
  const squeeze = beating ? interpolate(phase, [0, 0.12, 0.3, 1], [0, 1, 0, 0]) : 0;
  const s = 1 - squeeze * 0.07;

  return (
    <svg viewBox="0 0 240 270" width={size} height={(size * 270) / 240} style={{overflow: 'visible', ...style}}>
      {/* верхняя полая вена */}
      <rect x={58} y={18} width={28} height={100} rx={12} fill={COLORS.vein} />
      {/* дуга аорты + ветви */}
      <g stroke={COLORS.blood} strokeLinecap="round" fill="none">
        <path d="M 120 26 L 116 4 M 140 22 L 140 0 M 158 28 L 164 6" strokeWidth={12} />
        <path d="M 104 112 L 104 62 C 104 20, 170 14, 176 58 L 176 96" strokeWidth={28} />
      </g>
      <g transform={`translate(125 160) scale(${s}) translate(-125 -160)`}>
        {/* тело сердца */}
        <path
          d="M 62 108 C 28 132, 34 196, 82 228 C 112 250, 152 258, 186 250 C 210 228, 220 170, 198 126 C 182 96, 142 88, 116 98 C 96 88, 72 94, 62 108 Z"
          fill={COLORS.blood}
        />
        {/* правое предсердие (более тёмное, слева на экране) */}
        <path d="M 62 108 C 40 124, 40 160, 62 176 C 78 168, 84 130, 76 108 Z" fill={COLORS.bloodDark} opacity={0.7} />
        {/* межжелудочковая борозда с коронарной артерией */}
        <path d="M 132 112 C 142 160, 160 206, 184 248" stroke={COLORS.bloodDark} strokeWidth={6} fill="none" strokeLinecap="round" />
        <path d="M 150 140 C 170 150, 184 170, 194 190" stroke="#FFD1A6" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.8} />
        {/* блик */}
        <path d="M 78 140 Q 74 170 92 196" stroke="#FFFFFF" strokeWidth={6} opacity={0.25} fill="none" strokeLinecap="round" />
      </g>
      {/* лёгочный ствол (бедная кислородом кровь — синий) */}
      <path d="M 136 118 C 140 86, 176 78, 206 92" stroke={COLORS.vein} strokeWidth={22} fill="none" strokeLinecap="round" />
    </svg>
  );
};

/* =====================================================================
 * МОЗГ — вид сбоку (лоб слева). Зоны: префронтальная кора, миндалина,
 * гипоталамус, гипофиз (висит на ножке под гипоталамусом), мозжечок, ствол.
 * ===================================================================== */
export type BrainRegion = 'prefrontal' | 'amygdala' | 'hypothalamus' | 'pituitary' | 'cerebellum' | 'brainstem';

export const Brain: React.FC<{size?: number; highlight?: BrainRegion[]; style?: React.CSSProperties}> = ({
  size = 360,
  highlight = [],
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const glowAmt = 6 + ((Math.sin((frame / fps) * Math.PI * 2) + 1) / 2) * 10;
  const clipId = useSvgId('cerebrum');
  const hl = new Set(highlight);
  const on = (r: BrainRegion) => hl.has(r);
  const glow = (r: BrainRegion) => (on(r) ? {filter: `drop-shadow(0 0 ${glowAmt}px ${COLORS.accent})`} : {});

  return (
    <svg viewBox="0 0 320 260" width={size} height={(size * 260) / 320} style={{overflow: 'visible', ...style}}>
      <defs>
        <clipPath id={clipId}>
          <path d="M 40 130 C 20 70, 80 18, 160 20 C 240 22, 296 62, 292 128 C 290 160, 268 176, 240 172 C 210 168, 190 178, 170 180 C 140 182, 110 186, 80 176 C 56 168, 44 152, 40 130 Z" />
        </clipPath>
      </defs>
      {/* ствол мозга */}
      <path d="M 186 172 Q 196 210 200 250" stroke={on('brainstem') ? COLORS.accent : COLORS.brainDark} strokeWidth={26} strokeLinecap="round" fill="none" style={glow('brainstem')} />
      {/* мозжечок */}
      <g style={glow('cerebellum')}>
        <ellipse cx={244} cy={190} rx={44} ry={28} fill={on('cerebellum') ? COLORS.accent : COLORS.brainDark} />
        <path d="M 210 186 Q 244 176 282 188 M 214 198 Q 244 190 278 200" stroke={COLORS.bg} strokeWidth={2.5} fill="none" opacity={0.5} />
      </g>
      {/* большие полушария */}
      <path
        d="M 40 130 C 20 70, 80 18, 160 20 C 240 22, 296 62, 292 128 C 290 160, 268 176, 240 172 C 210 168, 190 178, 170 180 C 140 182, 110 186, 80 176 C 56 168, 44 152, 40 130 Z"
        fill={COLORS.brain}
      />
      {/* извилины */}
      <g clipPath={`url(#${clipId})`} stroke={COLORS.brainDark} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.85}>
        <path d="M 150 22 C 140 60, 170 80, 150 120 C 140 140, 150 160, 140 182" />
        <path d="M 60 80 C 90 70, 100 100, 130 90 C 150 84, 140 60, 120 50" />
        <path d="M 70 140 C 100 130, 120 150, 150 140" />
        <path d="M 180 40 C 200 70, 230 50, 250 80 C 270 110, 240 120, 260 150" />
        <path d="M 190 110 C 210 100, 220 130, 240 120" />
        <path d="M 60 110 C 76 100, 92 120, 110 112" />
        <path d="M 200 150 C 216 140, 228 160, 250 150" />
      </g>
      {/* префронтальная кора */}
      {on('prefrontal') && (
        <path d="M 40 130 C 20 70, 70 26, 112 24 C 96 70, 92 110, 80 176 C 56 168, 44 152, 40 130 Z" fill={COLORS.accent} opacity={0.55} style={glow('prefrontal')} />
      )}
      {/* миндалина (в глубине височной доли) */}
      <ellipse cx={128} cy={158} rx={12} ry={9} fill={on('amygdala') ? COLORS.accent : COLORS.brainDark} opacity={on('amygdala') ? 1 : 0.6} style={glow('amygdala')} />
      {/* гипоталамус и гипофиз */}
      <circle cx={158} cy={160} r={10} fill={on('hypothalamus') ? COLORS.accent : COLORS.gland} style={glow('hypothalamus')} />
      <line x1={158} y1={170} x2={156} y2={186} stroke={COLORS.glandDark} strokeWidth={4} />
      <ellipse cx={155} cy={193} rx={10} ry={8} fill={on('pituitary') ? COLORS.accent : COLORS.gland} style={glow('pituitary')} />
    </svg>
  );
};

/* =====================================================================
 * МЫШЦА — веретенообразное брюшко, сухожилия на концах, волокна.
 * damage 0..1 — микроразрывы волокон после нагрузки;
 * repair 0..1 — восстановление (клетки-сателлиты, «заплатки»).
 * ===================================================================== */
export const Muscle: React.FC<{width?: number; damage?: number; repair?: number; flex?: number; style?: React.CSSProperties}> = ({
  width = 600,
  damage = 0,
  repair = 0,
  flex = 0,
  style,
}) => {
  const clipId = useSvgId('belly');
  const bulge = 60 - flex * 14; // при сокращении брюшко толще
  const belly = `M 40 100 C 90 100, 120 ${bulge}, 200 ${bulge} C 280 ${bulge}, 310 100, 360 100 C 310 100, 280 ${200 - bulge}, 200 ${200 - bulge} C 120 ${200 - bulge}, 90 100, 40 100 Z`;
  const tears = [
    {x: 150, y: 86},
    {x: 205, y: 118},
    {x: 250, y: 92},
    {x: 180, y: 140},
    {x: 232, y: 66},
  ];
  return (
    <svg viewBox="0 30 400 140" width={width} height={(width * 140) / 400} style={{overflow: 'visible', ...style}}>
      <defs>
        <clipPath id={clipId}>
          <path d={belly} />
        </clipPath>
      </defs>
      {/* сухожилия */}
      <path d="M 4 100 L 60 100" stroke={COLORS.tendon} strokeWidth={14} strokeLinecap="round" />
      <path d="M 340 100 L 396 100" stroke={COLORS.tendon} strokeWidth={14} strokeLinecap="round" />
      <path d={belly} fill={COLORS.muscle} />
      {/* волокна */}
      <g clipPath={`url(#${clipId})`} stroke={COLORS.muscleDark} strokeWidth={3} fill="none" opacity={0.9}>
        {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
          <path key={i} d={`M 40 100 C 120 ${100 + i * 16}, 280 ${100 + i * 16}, 360 100`} />
        ))}
      </g>
      {/* микроразрывы */}
      <g stroke="#FFF4E8" strokeWidth={4} strokeLinecap="round" fill="none" opacity={damage * (1 - repair)}>
        {tears.map((t, i) => (
          <path key={i} d={`M ${t.x - 10} ${t.y - 6} L ${t.x - 3} ${t.y + 4} L ${t.x + 3} ${t.y - 4} L ${t.x + 10} ${t.y + 6}`} />
        ))}
      </g>
      {/* восстановление: клетки-сателлиты */}
      <g opacity={repair}>
        {tears.map((t, i) => (
          <g key={i}>
            <circle cx={t.x} cy={t.y} r={11 * repair} fill={COLORS.proven} opacity={0.35} />
            <circle cx={t.x} cy={t.y} r={5} fill={COLORS.proven} />
          </g>
        ))}
      </g>
      {/* блик */}
      <path d={`M 120 ${bulge + 26} C 160 ${bulge + 10}, 240 ${bulge + 10}, 280 ${bulge + 26}`} stroke="#FFFFFF" strokeWidth={6} opacity={0.22} fill="none" strokeLinecap="round" />
    </svg>
  );
};
