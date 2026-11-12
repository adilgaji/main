import React from 'react';
import {AbsoluteFill, Composition, Folder, Sequence} from 'remotion';
import {calculateChapterMetadata, Chapter, Stage, type ChapterProps} from './Chapter';
import {EMOTIONS, Narrator, POSES} from './character/Narrator';
import {Backdrop} from './components/Backdrop';
import {Captions, type CaptionWord} from './components/Captions';
import library from './demo/library.json';
import {Shot, type ShotSpec} from './shots';
import {FONT_SERVICE, FRAME, getStyle, STYLE_LIST, StyleContext, useStyle} from './style';

type DemoShot = {id: string; narration: string; shot: ShotSpec};
const SHOTS = library.shots as unknown as DemoShot[];
const EXTRA = library.extra as unknown as Record<string, ShotSpec>;
const byId = (id: string): DemoShot => SHOTS.find((s) => s.id === id) as DemoShot;

const PREVIEW_FRAMES = 210;

/** Слова с условным временем — чтобы показать субтитры на неподвижном листе. */
const fakeWords = (text: string, startAt = 0): CaptionWord[] =>
  text.split(/\s+/).map((w, i) => ({text: w, start: startAt + i * 0.36, end: startAt + i * 0.36 + 0.32}));

const ShotPreview: React.FC<{spec: ShotSpec; styleId?: string | null}> = ({spec, styleId}) => (
  <Stage styleId={styleId}>
    <Shot spec={spec} frames={PREVIEW_FRAMES} />
  </Stage>
);

// ---------------------------------------------------------------- лист персонажа

const RU_POSE: Record<string, string> = {idle: 'спокойно', explain: 'объясняет', point: 'показывает', think: 'думает', surprise: 'удивлён', welcome: 'приветствует'};
const RU_EMOTION: Record<string, string> = {neutral: 'нейтрально', smile: 'улыбка', serious: 'серьёзно', surprised: 'удивление', concerned: 'тревога', curious: 'любопытство'};

const CharacterSheetInner: React.FC = () => {
  const {palette: p} = useStyle();
  return (
    <AbsoluteFill>
      <Backdrop kind="stone" seed={9} />
      <div style={{position: 'absolute', left: 90, top: 50, fontFamily: FONT_SERVICE, fontWeight: 800, fontSize: 54, color: p.light}}>Рассказчик: позы и эмоции</div>
      {POSES.map((pose, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        return (
          <div key={pose} style={{position: 'absolute', left: 90 + col * 590, top: 140 + row * 470, width: 560, height: 450}}>
            <div style={{position: 'absolute', left: 60, top: 0, width: 800, height: 1000, transformOrigin: '0 0', scale: 0.44}}>
              <Narrator palette={p} pose={pose} emotion={EMOTIONS[i]} time={1.0 + i * 0.2} mouthOpen={i === 1 ? 0.6 : 0} />
            </div>
            <div style={{position: 'absolute', left: 0, right: 0, bottom: -6, textAlign: 'center', fontFamily: FONT_SERVICE, fontWeight: 700, fontSize: 30, color: p.light}}>
              {RU_POSE[pose]} · {RU_EMOTION[EMOTIONS[i]]}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const CharacterSheet: React.FC<{styleId?: string | null}> = ({styleId}) => (
  <Stage styleId={styleId}>
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
      <div style={{position: 'absolute', right: 8, top: 8, padding: '3px 10px 4px', borderRadius: 6, backgroundColor: 'rgba(8,10,14,0.82)', color: '#FFFFFF', fontFamily: FONT_SERVICE, fontWeight: 700, fontSize: 15}}>
        {index + 1}. {cell.label}
      </div>
    </div>
  );
};

const LibrarySheet: React.FC<{styleId?: string | null}> = ({styleId}) => (
  <Stage styleId={styleId}>
    {CELLS.map((c, i) => (
      <SheetCell key={c.label} cell={c} index={i} />
    ))}
  </Stage>
);

// ---------------------------------------------------------------- листы стилей (8 стилей на одном листе)

type StyleSheetKind = 'image' | 'map' | 'quote';

const STYLE_SHEETS: Record<StyleSheetKind, {title: string; shot: DemoShot; frame: number}> = {
  image: {title: 'Архивное изображение', shot: byId('kenburns'), frame: 150},
  map: {title: 'Карта', shot: byId('map'), frame: 196},
  quote: {title: 'Цитата', shot: byId('quote'), frame: 200},
};

const ALL_FAMILIES = [...new Set(STYLE_LIST.flatMap((s) => s.families))];

const StyleCell: React.FC<{styleId: string; index: number; kind: StyleSheetKind}> = ({styleId, index, kind}) => {
  const style = getStyle(styleId);
  const {shot, frame} = STYLE_SHEETS[kind];
  const col = index % 3;
  const row = Math.floor(index / 3);
  return (
    <div style={{position: 'absolute', left: col * 640, top: row * 360, width: 640, height: 360, overflow: 'hidden'}}>
      <StyleContext.Provider value={style}>
        <div style={{position: 'absolute', left: 0, top: 0, width: FRAME.width, height: FRAME.height, transformOrigin: '0 0', scale: 1 / 3}}>
          <Sequence from={-frame}>
            <AbsoluteFill>
              <Shot spec={shot.shot} frames={PREVIEW_FRAMES} />
              <Captions words={fakeWords(shot.narration, frame / FRAME.fps - 1.5)} />
            </AbsoluteFill>
          </Sequence>
        </div>
      </StyleContext.Provider>
      <div style={{position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.9)'}} />
      <div style={{position: 'absolute', right: 8, top: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 5px 5px', borderRadius: 24, backgroundColor: 'rgba(8,10,14,0.88)', fontFamily: FONT_SERVICE}}>
        <div style={{width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', color: '#0A0C10', fontWeight: 800, fontSize: 19, lineHeight: '30px', textAlign: 'center'}}>{index + 1}</div>
        <div style={{color: '#FFFFFF', fontWeight: 700, fontSize: 17}}>{style.nameRu}</div>
      </div>
    </div>
  );
};

/** Девятая ячейка листа: как выбрать. */
const StyleLegend: React.FC<{kind: StyleSheetKind}> = ({kind}) => (
  <div style={{position: 'absolute', left: 1280, top: 720, width: 640, height: 360, overflow: 'hidden', backgroundColor: '#14161B', fontFamily: FONT_SERVICE, color: '#F2F2F2'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: FRAME.width, height: FRAME.height, transformOrigin: '0 0', scale: 1 / 3, padding: '60px 70px'}}>
      <div style={{fontWeight: 800, fontSize: 76, lineHeight: 1.1}}>Выберите стиль</div>
      <div style={{marginTop: 12, fontWeight: 600, fontSize: 40, color: '#A9B1BD'}}>Кадр «{STYLE_SHEETS[kind].title}» в 8 стилях. Ответьте номером 1–8.</div>
      <div style={{marginTop: 36, display: 'flex', flexDirection: 'column', gap: 12}}>
        {STYLE_LIST.map((s, i) => (
          <div key={s.id} style={{display: 'flex', gap: 18, fontSize: 44, lineHeight: 1.15}}>
            <div style={{width: 52, fontWeight: 800, color: '#FFFFFF'}}>{i + 1}</div>
            <div>
              <span style={{fontWeight: 800}}>{s.nameRu}</span>
              <span style={{color: '#A9B1BD'}}> — {s.taglineRu}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{marginTop: 30, fontWeight: 600, fontSize: 36, color: '#A9B1BD'}}>Текст и субтитры всегда чёткие. Для отдельного видео стиль можно сменить.</div>
    </div>
  </div>
);

const StyleSheet: React.FC<{kind: StyleSheetKind}> = ({kind}) => (
  <Stage extraFamilies={ALL_FAMILIES}>
    {STYLE_LIST.map((s, i) => (
      <StyleCell key={s.id} styleId={s.id} index={i} kind={kind} />
    ))}
    <StyleLegend kind={kind} />
  </Stage>
);

const StyleSheetImage: React.FC = () => <StyleSheet kind="image" />;
const StyleSheetMap: React.FC = () => <StyleSheet kind="map" />;
const StyleSheetQuote: React.FC = () => <StyleSheet kind="quote" />;

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
      <Folder name="Styles">
        {/* Один и тот же кадр в 8 стилях: из этих листов владелец выбирает стиль */}
        <Composition id="Styles-Image" component={StyleSheetImage} durationInFrames={1} fps={FRAME.fps} width={FRAME.width} height={FRAME.height} />
        <Composition id="Styles-Map" component={StyleSheetMap} durationInFrames={1} fps={FRAME.fps} width={FRAME.width} height={FRAME.height} />
        <Composition id="Styles-Quote" component={StyleSheetQuote} durationInFrames={1} fps={FRAME.fps} width={FRAME.width} height={FRAME.height} />
      </Folder>
      <Folder name="Library">
        {/* Листы — обычные композиции в один кадр: у <Still> частота кадров равна 1,
            и всё время внутри кадров считалось бы неверно. */}
        <Composition id="Library-Sheet" component={LibrarySheet} durationInFrames={1} fps={FRAME.fps} width={FRAME.width} height={FRAME.height} defaultProps={{styleId: null as string | null}} />
        <Composition id="Character-Sheet" component={CharacterSheet} durationInFrames={1} fps={FRAME.fps} width={FRAME.width} height={FRAME.height} defaultProps={{styleId: null as string | null}} />
        {[...SHOTS.map((s) => [s.id, s.shot] as const), ...Object.entries(EXTRA)].map(([id, spec]) => (
          <Composition
            key={id}
            id={`Shot-${id}`}
            component={ShotPreview}
            durationInFrames={PREVIEW_FRAMES}
            fps={FRAME.fps}
            width={FRAME.width}
            height={FRAME.height}
            defaultProps={{spec, styleId: null as string | null}}
          />
        ))}
      </Folder>
    </>
  );
};
