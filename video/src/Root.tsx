import React from 'react';
import {AbsoluteFill, Composition, Folder, Sequence} from 'remotion';
import {calculateChapterMetadata, Chapter, Stage, type ChapterProps} from './Chapter';
import {EMOTIONS, Narrator, POSES} from './character/Narrator';
import {Backdrop} from './components/Backdrop';
import {Captions, type CaptionWord} from './components/Captions';
import library from './demo/library.json';
import {Shot, type ShotSpec} from './shots';
import {FRAME, useStyle} from './style';

type DemoShot = {id: string; narration: string; shot: ShotSpec};
const SHOTS = library.shots as unknown as DemoShot[];
const EXTRA = library.extra as unknown as Record<string, ShotSpec>;
const byId = (id: string): DemoShot => SHOTS.find((s) => s.id === id) as DemoShot;

const PREVIEW_FRAMES = 210;

/** Слова с условным временем — чтобы показать субтитры на неподвижном листе. */
const fakeWords = (text: string, startAt = 0): CaptionWord[] =>
  text.split(/\s+/).map((w, i) => ({text: w, start: startAt + i * 0.36, end: startAt + i * 0.36 + 0.32}));

const ShotPreview: React.FC<{spec: ShotSpec}> = ({spec}) => (
  <Stage>
    <Shot spec={spec} frames={PREVIEW_FRAMES} />
  </Stage>
);

// ---------------------------------------------------------------- лист персонажа

const RU_POSE: Record<string, string> = {idle: 'спокойно', explain: 'объясняет', point: 'показывает', think: 'думает', surprise: 'удивлён', welcome: 'приветствует'};
const RU_EMOTION: Record<string, string> = {neutral: 'нейтрально', smile: 'улыбка', serious: 'серьёзно', surprised: 'удивление', concerned: 'тревога', curious: 'любопытство'};

const CharacterSheetInner: React.FC = () => {
  const {palette: p, fonts} = useStyle();
  return (
    <AbsoluteFill>
      <Backdrop kind="stone" seed={9} />
      <div style={{position: 'absolute', left: 90, top: 50, fontFamily: fonts.caption, fontWeight: 800, fontSize: 54, color: p.light}}>Рассказчик: позы и эмоции</div>
      {POSES.map((pose, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        return (
          <div key={pose} style={{position: 'absolute', left: 90 + col * 590, top: 140 + row * 470, width: 560, height: 450}}>
            <div style={{position: 'absolute', left: 60, top: 0, width: 800, height: 1000, transformOrigin: '0 0', scale: 0.44}}>
              <Narrator palette={p} pose={pose} emotion={EMOTIONS[i]} time={1.0 + i * 0.2} mouthOpen={i === 1 ? 0.6 : 0} />
            </div>
            <div style={{position: 'absolute', left: 0, right: 0, bottom: -6, textAlign: 'center', fontFamily: fonts.caption, fontWeight: 700, fontSize: 30, color: p.light}}>
              {RU_POSE[pose]} · {RU_EMOTION[EMOTIONS[i]]}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const CharacterSheet: React.FC = () => (
  <Stage>
    <CharacterSheetInner />
  </Stage>
);

// ---------------------------------------------------------------- тестовый лист 3 x 3

type Cell = {label: string; spec?: ShotSpec; frame: number; narration?: string; character?: boolean};

const CELLS: Cell[] = [
  {label: 'Карта: маршрут, границы, подписи', spec: byId('map').shot, frame: 196, narration: byId('map').narration},
  {label: 'Таймлайн', spec: byId('timeline').shot, frame: 184, narration: byId('timeline').narration},
  {label: 'Архивное изображение (Ken Burns)', spec: byId('kenburns').shot, frame: 150, narration: byId('kenburns').narration},
  {label: 'Цитата из первоисточника', spec: byId('quote').shot, frame: 200, narration: byId('quote').narration},
  {label: 'Инфографика: сравнение чисел', spec: byId('infographic').shot, frame: 200, narration: byId('infographic').narration},
  {label: 'Инфографика: полосы', spec: EXTRA.bars, frame: 170},
  {label: 'Рассказчик', spec: byId('narrator').shot, frame: 120, narration: byId('narrator').narration},
  {label: 'Позы и эмоции рассказчика', frame: 0, character: true},
  {label: 'Карта: другой масштаб, реки', spec: EXTRA.mapWide, frame: 150},
];

const SheetCell: React.FC<{cell: Cell; index: number}> = ({cell, index}) => {
  const {fonts} = useStyle();
  const col = index % 3;
  const row = Math.floor(index / 3);
  return (
    <div style={{position: 'absolute', left: col * 640, top: row * 360, width: 640, height: 360, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: FRAME.width, height: FRAME.height, transformOrigin: '0 0', scale: 1 / 3}}>
        {/* Сдвиг времени: содержимое ячейки показывается так, как выглядит на кадре cell.frame */}
        <Sequence from={-cell.frame}>
          <AbsoluteFill>
            {cell.character ? <CharacterSheetInner /> : cell.spec ? <Shot spec={cell.spec} frames={PREVIEW_FRAMES} /> : null}
            {cell.narration ? <Captions words={fakeWords(cell.narration, cell.frame / FRAME.fps - 1.5)} /> : null}
          </AbsoluteFill>
        </Sequence>
      </div>
      <div style={{position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.85)'}} />
      <div style={{position: 'absolute', right: 8, top: 8, padding: '3px 10px 4px', borderRadius: 6, backgroundColor: 'rgba(8,10,14,0.82)', color: '#FFFFFF', fontFamily: fonts.caption, fontWeight: 700, fontSize: 15}}>
        {index + 1}. {cell.label}
      </div>
    </div>
  );
};

const LibrarySheet: React.FC = () => (
  <Stage>
    {CELLS.map((c, i) => (
      <SheetCell key={c.label} cell={c} index={i} />
    ))}
  </Stage>
);

// ---------------------------------------------------------------- регистрация

const defaultChapter: ChapterProps = {
  styleId: null,
  audio: null,
  words: [],
  captions: true,
  shots: SHOTS.map((s, i) => ({start: i * PREVIEW_FRAMES, frames: PREVIEW_FRAMES, shot: s.shot})),
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Глава видео: содержимое передаётся снаружи через --props */}
      <Composition
        id="Chapter"
        component={Chapter}
        calculateMetadata={calculateChapterMetadata}
        durationInFrames={SHOTS.length * PREVIEW_FRAMES}
        fps={FRAME.fps}
        width={FRAME.width}
        height={FRAME.height}
        defaultProps={defaultChapter}
      />
      <Folder name="Library">
        {/* Листы — обычные композиции в один кадр: у <Still> частота кадров равна 1,
            и всё время внутри кадров считалось бы неверно. */}
        <Composition id="Library-Sheet" component={LibrarySheet} durationInFrames={1} fps={FRAME.fps} width={FRAME.width} height={FRAME.height} />
        <Composition id="Character-Sheet" component={CharacterSheet} durationInFrames={1} fps={FRAME.fps} width={FRAME.width} height={FRAME.height} />
        {[...SHOTS.map((s) => [s.id, s.shot] as const), ...Object.entries(EXTRA)].map(([id, spec]) => (
          <Composition
            key={id}
            id={`Shot-${id}`}
            component={ShotPreview}
            durationInFrames={PREVIEW_FRAMES}
            fps={FRAME.fps}
            width={FRAME.width}
            height={FRAME.height}
            defaultProps={{spec}}
          />
        ))}
      </Folder>
    </>
  );
};
