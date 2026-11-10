import {Config} from '@remotion/cli/config';

// Единые настройки рендера.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
// В облаке разработки используем заранее установленный Chromium.
// На вашем компьютере переменная не задана — Remotion скачает свой браузер сам.
if (process.env.REMOTION_BROWSER) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
