# HSK 4 тренер — описание для будущих сессий

Локальное веб-приложение (FastAPI + SQLite + vanilla JS PWA) для подготовки к новому HSK 4 (HSK 3.0) за 16 недель. Пользователь — Адиль, не программист, говорит по-русски, Windows-ноутбук (RTX 4050 6 ГБ), Китай, VPN всегда включён. Только бесплатное; контент генерирует Claude Code заранее (не API во время работы).

## Правила
- Общение и интерфейс — по-русски, коротко, без подбадриваний (в прогнозах только цифры).
- Не выдумывать формат экзамена: всё неподтверждённое помечено в `EXAM_SPEC.md`. Официальные сайты (chinesetest.cn, moe.gov.cn) из песочницы были недоступны — проверь снова.
- Любой китайский контент проходит `python tools/validate_content.py` (jieba, слова ≤ HSK 4, пиньинь). Не добавлять слова в whitelist ради обхода.
- Перед «готово» — реально запустить: `python -m pytest -q tests` и сценарий в браузере (Playwright, мобильный viewport).

## Структура
- `app/` — backend: `main.py` (API), `srs.py` (FSRS, py-fsrs), `cards.py` (упражнения), `plan.py` (план/прогноз/статистика), `audio.py` (имена файлов, голоса), `db.py` (схема, загрузка контента), `config.py` (`AVAILABLE` — готовые модули).
- `web/` — SPA без сборки (`app.js`, `style.css`, `sw.js`, manifest).
- `content/words.json` — 1950 слов (собирается `tools/build_vocab.py` из `data/raw/` + `content/ru/*.tsv` (русские переводы, писал Claude) + `content/en_fix.tsv`). `content/src/` — примеры и аудирование (вручную/по `/hsk-refill`).
- `app/grammar.py` — грамматика, письмо, очередь `queue` (на `/hsk-check`). Контент: `content/src/grammar_src.tsv` → `tools/build_grammar.py`, `content/src/writing_src.txt` → `tools/build_writing.py`.
- `tools/` — `build_vocab.py`, `validate_content.py`, `build_audio.py` (edge-tts, запускается на ноутбуке пользователя), `report.py`.
- `.claude/commands/` — `/hsk-check`, `/hsk-refill`, `/hsk-week`.
- `hsk.db`, `audio/*.mp3` — не в git.

## Ключевые решения
- Список слов «newest» (1950). Слова из старого HSK 3 (570) проходят «сортировку» (знаю/не знаю) → сидируются в FSRS как известные.
- Типы карточек: recog (иероглифы→значение, self-rate), recall, audio, tones, context; последние открываются после 2 успешных recog.
- «Выучено» = recog стабильность ≥ 21 дня.
- Прогноз: слово 40%, аудирование 20%, грамматика/письмо 20%, чтение 10%, говорение 10%; нет данных по навыку — он исключается и это написано.
- Звук: файлы из edge-tts, если нет — SpeechSynthesis браузера.

См. `PROGRESS.md` — что сделано и что дальше.
