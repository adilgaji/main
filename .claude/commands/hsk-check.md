---
description: Проверить свободные письменные ответы и записи говорения из очереди, записать разбор в приложение
---
Очередь «на проверку» лежит в таблице `queue` базы `hsk.db` (статус `pending`). Модули письма и говорения кладут туда ответы (`kind`: writing_sentence | writing_translation | speaking; `payload` JSON). Если очередь пуста — так и скажи (на текущем этапе модули письма/говорения могут быть ещё не готовы, см. PROGRESS.md).

1. `python tools/report.py` → `queue_pending`. Для каждой записи прочитай `payload` через `sqlite3 hsk.db "select payload from queue where id=N"`. Для говорения в payload есть `transcript` (faster-whisper), `expected`, путь к записи.
2. Оцени строго и по делу, на русском: грамматика, порядок слов, выбор слов, тоны/произношение (по расшифровке — только то, что видно из текста), уровень лексики (слова выше HSK 4 отметь). Каждую ошибку: тип, исходный фрагмент, исправление, короткое правило. Балл 0–5 по критериям, без утешений.
3. Запиши разбор: `UPDATE queue SET status='checked', feedback=<JSON {score, errors:[{type,orig,fix,rule_ru}], better_version, words:[...]}> WHERE id=N`.
4. Добавь проблемные слова в повторение: для каждого слова из `words` (иероглифы из content/words.json) выполни
   `python -c "from app import db,srs; c=db.connect(); wid=<id>; srs.create_card(c,wid,'recog'); srs.create_card(c,wid,'recall'); c.commit()"`
   Для конструкций — запиши строку в `content/src/grammar_todo.txt` (для /hsk-refill).
5. Итог в чате: сколько проверено, 3–5 самых частых ошибок, что делать пользователю.
