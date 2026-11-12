// Реестр кадров: по типу из раскадровки выбирается нужный компонент.
import React from 'react';
import {InfographicShot, type InfographicShotProps} from './InfographicShot';
import {KenBurnsShot, type KenBurnsShotProps} from './KenBurnsShot';
import {MapShot, type MapShotProps} from './MapShot';
import {NarratorShot, type NarratorShotProps} from './NarratorShot';
import {QuoteShot, type QuoteShotProps} from './QuoteShot';
import {TimelineShot, type TimelineShotProps} from './TimelineShot';

type Body<T> = Omit<T, 'frames'>;

/** Один кадр раскадровки. frames (длительность) подставляется при сборке главы. */
export type ShotSpec =
  | ({type: 'map'} & Body<MapShotProps>)
  | ({type: 'timeline'} & Body<TimelineShotProps>)
  | ({type: 'kenburns'} & Body<KenBurnsShotProps>)
  | ({type: 'quote'} & Body<QuoteShotProps>)
  | ({type: 'infographic'} & Body<InfographicShotProps>)
  | ({type: 'narrator'} & Body<NarratorShotProps>);

export const SHOT_TYPES = ['map', 'timeline', 'kenburns', 'quote', 'infographic', 'narrator'] as const;

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
    default:
      return null;
  }
};
