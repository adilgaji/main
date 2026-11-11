import React from 'react';
import {Composition, Still} from 'remotion';
import {VIDEO} from './style';
import {TestScene, calcTestScene} from './scenes/TestScene';
import {Short, calcShort} from './Short';
import {Thumbnail} from './Thumbnail';
import {LogoGuide, LogoGuideCell, LogoHeart, LogoSheet, LogoWord, LogoZoom} from './brand/Logos';
import {LibraryMotion, SheetAnatomy, SheetDiagrams, SheetGuide} from './sheets/Sheets';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Still id="SheetGuide" component={SheetGuide} width={VIDEO.width} height={VIDEO.height} defaultProps={{showSafe: true}} />
      <Still id="SheetAnatomy" component={SheetAnatomy} width={VIDEO.width} height={VIDEO.height} />
      <Still id="SheetDiagrams" component={SheetDiagrams} width={VIDEO.width} height={VIDEO.height} />
      <Composition id="LibraryMotion" component={LibraryMotion} durationInFrames={6 * VIDEO.fps} fps={VIDEO.fps} width={VIDEO.width} height={VIDEO.height} />
      <Still id="LogoSheet" component={LogoSheet} width={1920} height={560} />
      <Still id="LogoGuide" component={LogoGuide} width={800} height={800} />
      <Still id="LogoZoom" component={LogoZoom} width={800} height={800} />
      <Still id="LogoHeart" component={LogoHeart} width={800} height={800} />
      <Still id="LogoWord" component={LogoWord} width={800} height={800} />
      <Still id="LogoGuideCell" component={LogoGuideCell} width={800} height={800} />
      <Still id="Thumbnail" component={Thumbnail} width={VIDEO.width} height={VIDEO.height} defaultProps={{text: 'WHY MUSCLES *GROW*', visual: 'muscle', visual_params: {repair: 1}, pose: 'think', emotion: 'surprised'}} />
      <Composition
        id="Short"
        component={Short}
        calculateMetadata={calcShort}
        durationInFrames={300}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{audio: 'jobs/test/voice.wav', words: [], shots: [], total: 10, music: null}}
      />
      <Composition
        id="TestScene"
        component={TestScene}
        calculateMetadata={calcTestScene}
        durationInFrames={300}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{audio: 'jobs/test/voice.wav', words: []}}
      />
    </>
  );
};
