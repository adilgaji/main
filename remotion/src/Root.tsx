import React from 'react';
import {Composition, Still} from 'remotion';
import {VIDEO} from './style';
import {TestScene, calcTestScene} from './scenes/TestScene';
import {LibraryMotion, SheetAnatomy, SheetDiagrams, SheetGuide} from './sheets/Sheets';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Still id="SheetGuide" component={SheetGuide} width={VIDEO.width} height={VIDEO.height} defaultProps={{showSafe: true}} />
      <Still id="SheetAnatomy" component={SheetAnatomy} width={VIDEO.width} height={VIDEO.height} />
      <Still id="SheetDiagrams" component={SheetDiagrams} width={VIDEO.width} height={VIDEO.height} />
      <Composition id="LibraryMotion" component={LibraryMotion} durationInFrames={6 * VIDEO.fps} fps={VIDEO.fps} width={VIDEO.width} height={VIDEO.height} />
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
