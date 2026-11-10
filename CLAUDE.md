# CLAUDE.md — правила проекта «Фабрика Shorts: биология тела»

Пользователь не программист: объясняй просто, по-русски. Тексты роликов — на английском.

## Архитектура
- `web/` — страница (FastAPI + index.html). 5 шагов, каждый ждёт решения человека. Состояние — `output/<дата>_<тема>/state.json`.
- `pipeline/` — СКРИПТЫ (не агенты): `tts.py` (Kokoro → Piper → edge-tts, GPU → CPU), `captions.py` (faster-whisper, пословные тайминги, сверка с текстом), `render.py` (Remotion, `--gl=angle` → `swangle`), `produce.py` (шаг 4 + проверки), `package.py` (шаг 5), `job.py` (шаги 2–3, вызов агентов через `claude -p --agent`), `readability.py`.
- `.claude/agents/` — субагенты с минимумом инструментов: idea-researcher, scriptwriter, fact-checker, storyboard-agent, quality-reviewer. Они **никогда не задают вопросов** пользователю — только через страницу.
- `remotion/` — видео. `src/style.ts` — единая палитра/шрифты/безопасная зона. `src/lib/` — визуальная библиотека (SVG кодом). `src/templates/` — шаблоны кадров (типы из `docs/STORYBOARD_SCHEMA.md`). `src/Short.tsx` — ролик по раскадровке. `src/Thumbnail.tsx` — обложка.

## Нерушимые правила
1. Медицинский контент — строго по `docs/MEDICAL_RULES.md`: только обучение, источник у каждого факта (обзоры/мета-анализы PubMed, NIH, WHO, Mayo, учебники), без дозировок/добавок/препаратов, метки proven/early/myth, дисклеймер «Educational, not medical advice».
2. Простой язык — `docs/PLAIN_LANGUAGE.md`: понятно ребёнку ~10 лет, термин → сразу объяснение. Проверяется `readability.py` (grade ≤ 6).
3. Только бесплатные открытые инструменты, всё локально. Никаких платных API. edge-tts — лишь последний запасной вариант.
4. Внешние изображения — только public domain/CC0 с записью в `sources.txt`; по умолчанию всё рисуется кодом. Музыка — только CC0 или без неё.
5. Видео **точно** соответствует подтверждённой раскадровке (`storyboard_hash` в state.json). Новый шаблон кадра = сначала описать в `docs/STORYBOARD_SCHEMA.md`, потом реализовать в `src/templates/`.
6. Анатомия не противоречит учебнику (вид спереди: левая сторона человека = правая сторона экрана).
7. Всё важное — внутри безопасной зоны Shorts (`SAFE` в `style.ts`: сверху 220, снизу 440, справа 170, слева 70 px).
8. Автозагрузки на YouTube нет.

## Remotion (следуй skill `.claude/skills/remotion-best-practices`)
- Анимация только через `useCurrentFrame()` + `interpolate()`/`Easing`; CSS-анимации запрещены.
- `fps` — из `useVideoConfig()`; файлы — из `public/` через `staticFile()`; пакеты `@remotion/*` — через `npx remotion add`.
- Субтитры — в формате `Caption` (`@remotion/captions`), отрисовка — `src/lib/Captions.tsx` (данные приходят из пайплайна, поэтому массив не инлайнится).

## Критерии «готово» (проверяет `produce.py` + quality-reviewer)
Звук = видео = сумма кадров; субтитры совпадают с текстом (≥ 85%, обычно 100%); громкость −17…−13 LUFS, пики ≤ −0.5 dBFS; длина 30–55 с; 1080×1920; нет обрезанных слов; в `sources.txt` все нескодовые файлы с лицензией.

## Разработка
- Python 3.12 (`.venv`), Node 18+, FFmpeg. В облаке: `REMOTION_BROWSER` и `HF_HUB_DISABLE_XET=1` подставляются автоматически/вручную.
- Перед коммитом: `cd remotion && npx tsc -p .`; быстрые стоп-кадры: `npx remotion still src/index.ts Short out.png --frame=N --props=<job>/props.json --scale=0.25`.
- Тестовые листы библиотеки: композиции `SheetGuide`, `SheetAnatomy`, `SheetDiagrams`.
