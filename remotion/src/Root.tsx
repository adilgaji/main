import React from 'react';
import {Composition, Still} from 'remotion';
import {Intro, INTRO, INTRO_VARIANTS} from './brand/Intro';
import {VIDEO} from './style';
import {TestScene, calcTestScene} from './scenes/TestScene';
import {Short, calcShort} from './Short';
import {StyleSample, StyleSampleSheet} from './scenes/StyleSample';
import {Thumbnail, ThumbnailWide} from './Thumbnail';
import {Long, calcLong} from './Long';
import {WmPulseNavy, WmPulseNavy2, WordmarkSheet, WmCoral, WmSerif, WmPulse, WmLab, WmMolecule, WmMarker} from './brand/Wordmarks';
import {BlueprintPairSheet, Banner2Sheet, BannerBlueprint, BannerMicroscope, BannerNeurons, BannerSoft} from './brand/Banners2';
import {BannerClassic, BannerDark, BannerOrgans, BannerSheet} from './brand/Banners';
import {LogoGuide, LogoGuideCell, LogoHeart, LogoSheet, LogoWord, LogoZoom} from './brand/Logos';
import {LibraryMotion, SheetAnatomy, SheetDiagrams, SheetGuide} from './sheets/Sheets';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {INTRO_VARIANTS.map((v) => (
        <Composition key={v} id={`Intro-${v}`} component={Intro} durationInFrames={INTRO.seconds * VIDEO.fps} fps={VIDEO.fps} width={INTRO.width} height={INTRO.height} defaultProps={{variant: v, withVoice: true}} />
      ))}
      <Still id="SheetGuide" component={SheetGuide} width={VIDEO.width} height={VIDEO.height} defaultProps={{showSafe: true}} />
      <Still id="SheetAnatomy" component={SheetAnatomy} width={VIDEO.width} height={VIDEO.height} />
      <Still id="SheetDiagrams" component={SheetDiagrams} width={VIDEO.width} height={VIDEO.height} />
      <Composition id="LibraryMotion" component={LibraryMotion} durationInFrames={6 * VIDEO.fps} fps={VIDEO.fps} width={VIDEO.width} height={VIDEO.height} />
      <Composition id="StyleSample" component={StyleSample} durationInFrames={60} fps={VIDEO.fps} width={VIDEO.width} height={VIDEO.height} defaultProps={{style: 'classic' as const}} />
      <Composition id="StyleSampleSheet" component={StyleSampleSheet} durationInFrames={60} fps={VIDEO.fps} width={1090} height={2080} />
      <Still id="BlueprintPairSheet" component={BlueprintPairSheet} width={1620} height={1250} />
      <Still id="WmPulseNavy" component={WmPulseNavy} width={800} height={800} />
      <Still id="WmPulseNavy2" component={WmPulseNavy2} width={800} height={800} />
      <Still id="Banner2Sheet" component={Banner2Sheet} width={1620} height={1480} />
      <Still id="BannerMicroscope" component={BannerMicroscope} width={2560} height={1440} />
      <Still id="BannerBlueprint" component={BannerBlueprint} width={2560} height={1440} />
      <Still id="BannerNeurons" component={BannerNeurons} width={2560} height={1440} />
      <Still id="BannerSoft" component={BannerSoft} width={2560} height={1440} />
      <Still id="BannerSheet" component={BannerSheet} width={1640} height={1440} />
      <Still id="BannerClassic" component={BannerClassic} width={2560} height={1440} />
      <Still id="BannerOrgans" component={BannerOrgans} width={2560} height={1440} />
      <Still id="BannerDark" component={BannerDark} width={2560} height={1440} />
      <Still id="WordmarkSheet" component={WordmarkSheet} width={1500} height={1260} />
      <Still id="WmCoral" component={WmCoral} width={800} height={800} />
      <Still id="WmSerif" component={WmSerif} width={800} height={800} />
      <Still id="WmPulse" component={WmPulse} width={800} height={800} />
      <Still id="WmLab" component={WmLab} width={800} height={800} />
      <Still id="WmMolecule" component={WmMolecule} width={800} height={800} />
      <Still id="WmMarker" component={WmMarker} width={800} height={800} />
      <Still id="LogoSheet" component={LogoSheet} width={1920} height={560} />
      <Still id="LogoGuide" component={LogoGuide} width={800} height={800} />
      <Still id="LogoZoom" component={LogoZoom} width={800} height={800} />
      <Still id="LogoHeart" component={LogoHeart} width={800} height={800} />
      <Still id="LogoWord" component={LogoWord} width={800} height={800} />
      <Still id="LogoGuideCell" component={LogoGuideCell} width={800} height={800} />
      <Composition
        id="Long"
        component={Long}
        calculateMetadata={calcLong}
        durationInFrames={300}
        fps={VIDEO.fps}
        width={1920}
        height={1080}
        defaultProps={{audio: 'jobs/test/voice.wav', words: [], shots: [], total: 10, chapters: [], style: 'classic' as const}}
      />
      <Still id="ThumbnailWide" component={ThumbnailWide} width={1280} height={720} defaultProps={{text: 'WHY MUSCLES *GROW*', visual: 'muscle', visual_params: {repair: 1}, pose: 'think', emotion: 'surprised', style: 'classic' as const}} />
      <Still id="Thumbnail" component={Thumbnail} width={VIDEO.width} height={VIDEO.height} defaultProps={{text: 'WHY MUSCLES *GROW*', visual: 'muscle', visual_params: {repair: 1}, pose: 'think', emotion: 'surprised'}} />
      <Composition
        id="Short"
        component={Short}
        calculateMetadata={calcShort}
        durationInFrames={300}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{audio: 'jobs/test/voice.wav', words: [], shots: [], total: 10, music: null, style: 'classic' as const}}
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
