# Структуры роликов и петля (endless loop)

Каждый ролик — НОВАЯ структура. Баланс содержания — docs/PRACTICAL.md (≈40% объяснение, ≈60% советы). Фабрика помнит последние структуры (`output/_history.json`)
и передаёт сценаристу список запрещённых (последние 4). Хук тоже по разной формуле (docs/HOOKS.md).

## Структуры (id — для script.json → "structure")

| id | Как строится | Пример (тема «мышцы после тренировки») |
|---|---|---|
| `myth_flip` | Начинаем с популярного мифа → почему так думают → что на самом деле происходит внутри → правда в одной фразе | «Soreness means growth? Not quite…» |
| `countdown` | «3 вещи…» / «2 ошибки…»: пункты по убыванию, последний — самый неожиданный | «3 things your muscles do while you sleep» |
| `timeline` | Что происходит через 10 секунд → 10 минут → 10 часов → 2 дня | «Minute 1 after your last rep…» |
| `pov` | От первого лица органа/клетки: «I'm your muscle fiber. Here's my week.» | «I'm a repair cell. I've been asleep for months…» |
| `journey` | Путешествие молекулы/сигнала по телу: откуда → куда → что делает | «Follow one protein from your plate to your bicep» |
| `what_if` | «Что будет, если…» → цепочка последствий внутри тела → вывод | «What if you never rested after training?» |
| `versus` | Сравнение A и B (сон vs без сна, до vs после), что меняется внутри | «Your muscle after 8 hours of sleep vs none» |
| `mystery` | Загадка в начале → подсказки → разгадка в конце (связана с началом — идеально для петли) | «Why does it hurt two days later, not today?» |
| `zoom_story` | Последовательный зум: тело → орган → клетка → молекула, на каждом уровне одна мысль | «Zoom into a sore leg…» |
| `mistakes_fixes` | 3 частые ошибки → почему они вредят (коротко) → как исправить (подробно) | «3 recovery mistakes you make after the gym» |
| `routine` | Простой распорядок шаг за шагом (утро/вечер/после тренировки) с объяснением каждого шага | «Your 10-minute after-workout routine» |
| `try_tonight` | Челлендж: «сделай это сегодня» → что почувствуешь → почему работает | «Try this tonight and wake up less sore» |
| `habit_stack` | Маленькие привычки, которые вместе дают результат | «4 tiny habits that make muscles recover faster» |
| `do_dont` | Делай / не делай, с причиной для каждого пункта | «Do this, not that, after training» |
| `question_chain` | Цепочка «почему?»: каждый ответ рождает следующий вопрос | «Why do muscles grow? Because… Why? Because…» |

## Петля (endless loop) — обязательно

1. Последняя фраза ролика **перетекает в первую**: при повторе видео текст читается как одно целое.
   - Конец: «…and that's exactly why you keep» → начало: «Training five days a week but not growing?» ✗ (не склеивается)
   - Конец: «…so if you skip rest, you'll keep» → начало: «training five days a week but not growing.» ✓
   - Конец: «…which brings us back to the question:» → начало: «Why does it hurt two days later?» ✓
2. Последнее предложение **без точки в конце** (обрывается и продолжается началом). В script.json поле
   `"loop_line"`: как звучит стык «последняя фраза + первая фраза».
3. Начало должно работать и как хук для нового зрителя, и как продолжение для зрителя на повторе.
4. Никаких прощаний («thanks for watching», «see you») и призывов в конце — они ломают петлю.
5. Раскадровка: последний кадр визуально ведёт к первому (тот же объект/фон, что в кадре 1);
   программа сама плавно переводит последние 0,5 с в первый кадр.
6. Дисклеймер «Educational, not medical advice» — маленькой строкой в последнем кадре (добавляется автоматически)
   и в описании.
