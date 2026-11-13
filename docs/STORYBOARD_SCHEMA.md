# Типы кадров (шаблоны) для раскадровки

Раскадровка (`storyboard.json`) может использовать ТОЛЬКО эти шаблоны и параметры.
Каждый шаблон реализован в `remotion/src/templates/`. Тексты на экране — английские.
`*слово*` в headline выделяется жёлтой плашкой.

Общие допустимые значения:
- **background** (необязательно, в params любого кадра): muscle | blood | neural | cells | molecules | bone | air | dna | skin | night | grid | abstract | soft
- **pose**: stand | point | wave | think | shrug | run | flex | present
- **emotion**: neutral | happy | surprised | worried | excited
- **organ** (на контуре тела): brain | hypothalamus | pituitary | thyroid | lungs | heart | liver | stomach | kidneys | adrenals | testes | muscles | vessels
- **brain region**: prefrontal | amygdala | hypothalamus | pituitary | cerebellum | brainstem
- **molecule**: steroid (тестостерон, кортизол, эстроген) | amine (адреналин, дофамин, серотонин) | peptide (инсулин, гормон роста, белки)
- **icon**: sleep | food | exercise | stress | weight | clock | water | sun | flask | alcohol
- **evidence**: proven | early | myth
- **color**: blood | vein | muscle | brain | gland | lung | organ | cell | mito | hormone | hormoneAlt | nerve | accent | proven | early | myth

---

### hook — первый кадр
```json
{"headline": "Why muscles *grow* after rest", "pose": "think", "emotion": "surprised",
 "visual": "muscle", "visual_params": {"damage": 1}}
```
`visual`: heart | brain | muscle | cell | body | molecule | icon. `visual_params` — параметры этого элемента
(heart: `bpm`; brain: `highlight` [regions]; muscle: `damage`, `repair`, `flex` 0..1;
cell: `receptors` membrane|nuclear; body: `highlight` [organs]; molecule: `kind`; icon: `name`).

### guide — гид объясняет
```json
{"headline": "Training *breaks* fibers", "pose": "present", "emotion": "happy", "icons": ["exercise"]}
```
`icons` — 0–3 иконки рядом с гидом.

### body — схема тела
```json
{"highlight": ["brain", "adrenals"], "labels": [{"organ": "adrenals", "text": "ADRENAL GLANDS"}],
 "arrows": [{"from": "brain", "to": "adrenals"}], "molecules": {"kind": "amine", "from": "adrenals", "to": "heart"},
 "pose": "point"}
```
Подсвеченные органы светятся по очереди в порядке списка. `labels` ≤ 3, `arrows` ≤ 2.

### zoom — фирменный зум тело → орган → клетка
```json
{"organ": "muscles", "label": "MUSCLE FIBER", "end": "fiber"}
```
`organ`: heart | brain | muscles. `end`: cell (клетка с рецепторами, параметры `receptors`, `molecule`)
или fiber (мышечное волокно — для тем про мышцы). Сверху навигация BODY › ORGAN › CELL.

### organ — крупный план органа
```json
{"organ": "muscle", "headline": "Micro *tears*", "from": {"damage": 0}, "to": {"damage": 1}, "labels": ["MICRO-TEARS"]}
```
`organ`: heart (`bpm`), brain (`highlight`), muscle (`damage`, `repair`, `flex`). Значения анимируются от `from` к `to`.

### fiber — мышечное волокно и восстановление
```json
{"stage": "immune", "headline": "Clean-up *crew*", "labels": ["IMMUNE CELLS"]}
```
`stage`: damage (микроразрывы) | immune (иммунные клетки убирают повреждённое) |
satellite (клетки-сателлиты сливаются с волокном) | rebuild (синтез белка, волокно восстанавливается и утолщается).

### cell — клетка
```json
{"receptors": "membrane", "molecule": "amine", "label": "RECEPTORS", "headline": "Signal *received*"}
```

### graph — график (качественный, без точных чисел)
```json
{"title": "Muscle protein synthesis", "data": [0.2, 0.7, 0.9, 0.6, 0.3], "x_labels": ["0h", "12h", "24h", "36h", "48h"],
 "y_label": "", "highlight_index": 2}
```
`data` — значения 0..1 (форма кривой по источнику), 3–8 точек.

### bars — столбцы
```json
{"title": "Sleep matters", "bars": [{"label": "Short sleep", "value": 0.5, "color": "myth"}, {"label": "Full sleep", "value": 0.9, "color": "proven"}]}
```
2–4 столбца.

### flow — цепочка процесса
```json
{"steps": [{"label": "Training", "color": "muscle"}, {"label": "Micro-tears", "color": "blood"}, {"label": "Repair", "color": "proven"}]}
```
2–4 шага, подписи ≤ 14 символов.

### tips — что реально помогает
```json
{"headline": "What *helps*", "items": [{"icon": "sleep", "text": "Sleep", "evidence": "proven"}, {"icon": "food", "text": "Protein", "evidence": "proven"}]}
```
1–3 пункта, текст ≤ 14 символов.

### myth — миф против факта
```json
{"myth": "Lactic acid = soreness", "fact": "Lactate clears in hours", "pose": "shrug"}
```
Тексты ≤ 26 символов.

### outro — (устарело для петли) последний кадр
```json
{"headline": "Rest is *training*", "pose": "wave", "emotion": "happy"}
```
Всегда показывает «Educational, not medical advice».

### chapter — титульный кадр главы (только длинное видео)
```json
{"number": 2, "title": "The *repair* crew"}
```

### steps — чек-лист по шагам (советы)
```json
{"title": "After the gym", "steps": [{"icon": "water", "text": "Drink water"}, {"icon": "food", "text": "Eat protein"}, {"icon": "sleep", "text": "Sleep 7-9 h"}]}
```
2–4 шага, текст ≤ 18 символов, пункты появляются под голос.

### do_dont — делай / не делай
```json
{"title": "Recovery", "do": ["Sleep 7-9 hours", "Walk the next day"], "dont": ["Skip meals", "Train sore muscles hard"]}
```
По 1–3 пункта в колонке, ≤ 22 символов.
