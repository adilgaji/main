import React from 'react';
import {AbsoluteFill, Composition} from 'remotion';
import {demoMap} from './demo/thermopylae';
import {useFontsReady} from './fonts';
import {MapShot} from './shots/MapShot';
import {FRAME, getStyle, StyleContext} from './style';

/** Общая обёртка: стиль + ожидание шрифтов. */
export const Stage: React.FC<{styleId?: string; children: React.ReactNode}> = ({styleId, children}) => {
  const ready = useFontsReady();
  const style = getStyle(styleId);
  return (
    <StyleContext.Provider value={style}>
      <AbsoluteFill style={{backgroundColor: style.palette.bg}}>{ready ? children : null}</AbsoluteFill>
    </StyleContext.Provider>
  );
};

const MapDemo: React.FC = () => (
  <Stage>
    <MapShot frames={210} {...demoMap} />
  </Stage>
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Shot-Map" component={MapDemo} durationInFrames={210} fps={FRAME.fps} width={FRAME.width} height={FRAME.height} />
    </>
  );
};
