/**
 * Обложка ролика 1080x1920 (рисуется кодом). Главное — в центре кадра
 * и внутри безопасной зоны: крупный текст 2–5 слов, крупный визуал, гид.
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COLORS, FONT_FAMILY, SAFE, VIDEO, keywordStyle, loadFonts} from './style';
import {Stickman, PoseName, Emotion} from './lib/Stickman';
import {Heart, Brain, Muscle} from './lib/Organs';
import {Cell, Molecule} from './lib/CellAndMolecules';
import {BodyOutline} from './lib/BodyOutline';
import {MuscleFiber} from './lib/MuscleFiber';
import {Icon} from './lib/Diagram';

loadFonts();

export type ThumbProps = {text: string; visual: string; visual_params?: any; pose?: string; emotion?: string};

const Big: React.FC<{visual: string; vp: any}> = ({visual, vp = {}}) => {
  switch (visual) {
    case 'heart':
      return <Heart size={560} beating={false} />;
    case 'brain':
      return <Brain size={720} highlight={vp.highlight ?? []} />;
    case 'muscle':
      return <Muscle width={760} damage={vp.damage ?? 0} repair={vp.repair ?? 0} flex={vp.flex ?? 0.5} />;
    case 'fiber':
      return <MuscleFiber width={800} satellites={1} />;
    case 'cell':
      return <Cell size={600} receptors={vp.receptors ?? 'membrane'} activated={1} />;
    case 'body':
      return <BodyOutline width={300} highlight={vp.highlight ?? []} pulse={false} />;
    case 'molecule':
      return <Molecule kind={vp.kind ?? 'steroid'} size={520} spin={false} />;
    case 'icon':
      return <Icon name={vp.name ?? 'flask'} size={420} />;
    default:
      return null;
  }
};

export const Thumbnail: React.FC<ThumbProps> = ({text, visual, visual_params, pose = 'point', emotion = 'surprised'}) => {
  const parts = text.split(/(\*[^*]+\*)/).filter(Boolean);
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 55%, #2E4C7A 0%, ${COLORS.bg} 70%)`}}>
      <div
        style={{
          position: 'absolute',
          top: SAFE.top + 40,
          left: SAFE.left,
          width: VIDEO.width - SAFE.left - SAFE.right,
          textAlign: 'center',
          fontFamily: FONT_FAMILY,
          fontWeight: 900,
          fontSize: 118,
          lineHeight: 1.08,
          color: COLORS.ink,
          textTransform: 'uppercase',
          textShadow: `0 8px 0 ${COLORS.bg}`,
        }}
      >
        {parts.map((p, i) =>
          p.startsWith('*') ? (
            <span key={i} style={{...keywordStyle, borderRadius: 20, padding: '0 18px', textShadow: 'none'}}>
              {p.slice(1, -1)}
            </span>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
      </div>
      <div style={{position: 'absolute', left: SAFE.left, width: VIDEO.width - SAFE.left - SAFE.right, top: 820, height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center', filter: `drop-shadow(0 0 40px ${COLORS.accent}55)`}}>
        <Big visual={visual} vp={visual_params} />
      </div>
      <div style={{position: 'absolute', left: SAFE.left - 10, top: 1180}}>
        <Stickman pose={pose as PoseName} emotion={emotion as Emotion} size={300} alive={false} />
      </div>
    </AbsoluteFill>
  );
};
