// Реестр кадров: по типу из раскадровки выбирается нужный компонент.
import React from 'react';
import {CompareShot, type CompareShotProps} from './CompareShot';
import {DiagramShot, type DiagramShotProps} from './DiagramShot';
import {InfographicShot, type InfographicShotProps} from './InfographicShot';
import {KenBurnsShot, type KenBurnsShotProps} from './KenBurnsShot';
import {MapShot, type MapShotProps} from './MapShot';
import {NarratorShot, type NarratorShotProps} from './NarratorShot';
import {QuoteShot, type QuoteShotProps} from './QuoteShot';
import {SceneShot, type SceneShotProps} from './SceneShot';
import {TimelineShot, type TimelineShotProps} from './TimelineShot';

type Body<T> = Omit<T, 'frames'>;

/** Один кадр раскадровки. frames (длительность) подставляется при сборке главы. */
export type ShotSpec =
  | ({type: 'map'} & Body<MapShotProps>)
  | ({type: 'timeline'} & Body<TimelineShotProps>)
  | ({type: 'kenburns'} & Body<KenBurnsShotProps>)
  | ({type: 'quote'} & Body<QuoteShotProps>)
  | ({type: 'infographic'} & Body<InfographicShotProps>)
  | ({type: 'narrator'} & Body<NarratorShotProps>)
  | ({type: 'compare'} & Body<CompareShotProps>)
  | ({type: 'diagram'} & Body<DiagramShotProps>)
  | ({type: 'scene'} & Body<SceneShotProps>);

export const SHOT_TYPES = ['map', 'timeline', 'kenburns', 'quote', 'infographic', 'narrator', 'compare', 'diagram', 'scene'] as const;

export const Shot: React.FC<{spec: ShotSpec; frames: number}> = ({spec, frames}) => {
  switch (spec.type) {
    case 'map':
      return <MapShot {...spec} frames={frames} />;
    case 'timeline':
      return <TimelineShot {...spec} frames={frames} />;
    case 'kenburns':
      return <KenBurnsShot {...spec} frames={frames} />;
    case 'quote':
      return <QuoteShot {...spec} frames={frames} />;
    case 'infographic':
      return <InfographicShot {...spec} frames={frames} />;
    case 'narrator':
      return <NarratorShot {...spec} frames={frames} />;
    case 'compare':
      return <CompareShot {...spec} frames={frames} />;
    case 'diagram':
      return <DiagramShot {...spec} frames={frames} />;
    case 'scene':
      return <SceneShot {...spec} frames={frames} />;
    default:
      return null;
  }
};
