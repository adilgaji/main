// Быстрые стоп-кадры: один бандл, много кадров/стилей. node scripts_stills.mjs <props.json> <outdir> <frames,comma> <styles,comma> [scale] [composition]
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
const [propsFile, out, framesArg, stylesArg, scaleArg = '0.25', comp = 'Short'] = process.argv.slice(2);
const props = JSON.parse(fs.readFileSync(propsFile, 'utf8'));
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browserExecutable = process.env.REMOTION_BROWSER || null;
fs.mkdirSync(out, {recursive: true});
const frames = framesArg.split(',').map(Number);
const jobs = [];
for (const style of stylesArg.split(',')) for (const f of frames) jobs.push({style, f});
const conc = Number(process.env.STILL_CONCURRENCY || 3);
let i = 0;
const worker = async () => {
  while (i < jobs.length) {
    const {style, f} = jobs[i++];
    const inputProps = {...props, style};
    const composition = await selectComposition({serveUrl, id: comp, inputProps, browserExecutable, chromiumOptions: {gl: 'swiftshader'}});
    await renderStill({serveUrl, composition, inputProps, frame: f, output: path.join(out, `${style}_${f}.png`), scale: Number(scaleArg), browserExecutable, chromiumOptions: {gl: 'swiftshader'}});
  }
};
await Promise.all(Array.from({length: conc}, worker));
console.log('done', jobs.length);
