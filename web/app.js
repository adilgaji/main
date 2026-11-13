'use strict';
const $ = s => document.querySelector(s), app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function api(path, body) {
  const r = await fetch('/api' + path, body ? {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)} : {});
  if (!r.ok) throw new Error(path + ' → ' + r.status); return r.json();
}
let mod = 'home', lastTouch = Date.now(), speed = localStorage.getItem('speed') || 'normal';
['click','keydown','touchstart'].forEach(e => addEventListener(e, () => lastTouch = Date.now(), {passive:true}));
setInterval(() => { if (!document.hidden && Date.now() - lastTouch < 60000) api('/heartbeat', {module: mod, seconds: 15}).catch(()=>{}); }, 15000);
// ---------- звук ----------
let curAudio = null;
function play(spec, spd) {
  spd = spd || speed; return new Promise(res => {
    stopAudio(); const url = spec[spd] || (spd === 'slow' ? null : null) || spec.normal;
    if (url) { const a = new Audio(spec[spd] || spec.normal); curAudio = a; a.onended = a.onerror = () => res(); a.play().catch(() => speak(spec.text, spd, res)); return; }
    speak(spec.text, spd, res);
  });
}
function speak(text, spd, done) {
  if (!('speechSynthesis' in window)) return done && done();
  const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = spd === 'slow' ? 0.65 : 0.95;
  const v = speechSynthesis.getVoices().find(v => /zh[-_]CN|Chinese/i.test(v.lang + v.name)); if (v) u.voice = v;
  u.onend = u.onerror = () => done && done(); speechSynthesis.cancel(); speechSynthesis.speak(u);
}
function stopAudio() { if (curAudio) { curAudio.pause(); curAudio = null; } if ('speechSynthesis' in window) speechSynthesis.cancel(); }
async function playSeq(specs, spd) { for (const s of specs) { await play(s, spd); await new Promise(r => setTimeout(r, 350)); } }
const spk = (spec, label = '🔊') => `<button class="sp" data-t="${esc(spec.text)}" data-a='${esc(JSON.stringify(spec))}'>${label}</button>`;
document.addEventListener('click', e => { const b = e.target.closest('button.sp'); if (b) play(JSON.parse(b.dataset.a)); });
// ---------- роутер ----------
const routes = {};
function route() {
  stopAudio(); const [r, ...rest] = (location.hash.slice(2) || '').split('/'); mod = r || 'home';
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.r === (r || '')));
  (routes[r || ''] || routes.more)(rest).catch(err => app.innerHTML = `<div class="card bad">Ошибка: ${esc(err.message)}<br><span class="mut sm">Проверь, что окно start.bat открыто.</span></div>`);
}
addEventListener('hashchange', route);
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
// ---------- Сегодня ----------
routes[''] = async () => {
  const t = await api('/today'); const f = t.forecast;
  if (!t.placement_done) { app.innerHTML = `<h1>Начнём с входного теста</h1><div class="card"><p>Тест занимает ~10 минут: слова и аудирование. По результату строится план на 16 недель.</p><a class="btn p" href="#/placement">Пройти входной тест</a></div>`; return; }
  const b = t.behind;
  app.innerHTML = `<h1>Сегодня</h1>
  <div class="card"><div class="row sm mut"><span>День <b>${t.day}</b> · неделя ${t.week}/16</span><span style="text-align:right">До экзамена: <b>${t.days_left}</b> дн.</span></div>
   <div class="sm">${esc(t.phase)}</div>
   <div class="bar" style="margin:8px 0"><i style="width:${pct(t.minutes_today, t.planned_minutes)}%"></i></div>
   ${t.queue_pending ? `<div class="sm warn">На проверку у Claude: ${t.queue_pending} ответов → /hsk-check</div>` : ''}<div class="sm mut">Сегодня учился: ${t.minutes_today} мин из ${t.planned_minutes} · серия: ${t.streak} дн.</div></div>
  <div class="card">${t.blocks.map(k => `<div class="blk ${k.available ? '' : 'off'}"><div><b>${esc(k.title)}</b><br><span class="sm mut">${k.available ? `~${k.minutes} мин · ${k.done}/${k.target} ${k.unit}` : ''} ${esc(k.hint)}</span></div>
     ${k.available ? `<a class="btn ${k.done >= k.target && k.target ? '' : 'p'}" href="${k.route}">${k.done >= k.target && k.target ? '✓' : 'Начать'}</a>` : '<span class="pill">скоро</span>'}</div>`).join('')}</div>
  <div class="card"><h2>Прогноз (только цифры)</h2>
   <div class="big">${f.ready_pct}%</div><div class="sm mut">готовность по оценённым навыкам (вес ${f.covered_weight}% экзамена)</div>
   <table><tr><td>Слов выучено (стабильность ≥21 дн.)</td><td><b>${f.words.known}</b> / ${f.words.total}</td></tr>
   <tr><td>В процессе / новых</td><td>${f.words.learning} / ${f.words.new}</td></tr>
   <tr><td>Прогноз к экзамену</td><td>${f.words.projected} (цель ${f.words.target})</td></tr>
   <tr><td>Темп / нужно, слов в день</td><td>${f.words.rate_per_day} / ${f.words.need_rate ?? '—'}</td></tr>
   <tr><td>Аудирование (30 дн.)</td><td>${f.components.listening ?? 'нет данных'}${f.components.listening != null ? '%' : ''}</td></tr>
   <tr><td>Грамматика и письмо</td><td>${f.components.grammar ?? 'нет данных'}${f.components.grammar != null ? '%' : ''} <span class="sm mut">(охват пунктов ${f.grammar.covered_pct}%)</span></td></tr><tr><td>Чтение · говорение</td><td class="mut">нет данных</td></tr>
   <tr><td>Отставание от графика</td><td class="${b.words > 20 ? 'bad' : ''}">${b.words} слов; пропущено дней: ${b.missed_days}</td></tr></table>
   ${f.messages.map(m => `<div class="sm warn">• ${esc(m)}</div>`).join('')}<div class="sm mut" style="margin-top:6px">${esc(f.note)}</div></div>`;
};
// ---------- Карточки ----------
routes.review = async () => {
  const c = await api('/review/next');
  if (c.empty) { app.innerHTML = `<h1>Карточки</h1><div class="card">Сейчас повторять нечего.${c.next_due ? `<br><span class="mut sm">Следующая: ${new Date(c.next_due).toLocaleString('ru-RU')}</span>` : ''}</div><a class="btn" href="#/">← Сегодня</a>`; return; }
  const t0 = Date.now(), w = c.word; let html = `<div class="sm mut">Осталось: ${c.remaining} · ${({recog:'иероглифы → значение',recall:'значение → иероглифы',audio:'аудио → слово',tones:'пиньинь и тоны',context:'слово в предложении'})[c.kind]}</div><div class="card">`;
  if (c.mode === 'reveal') {
    html += `<div class="hz">${esc(w.hanzi)}</div><div style="text-align:center">${spk(w.audio)}</div><div id="back" hidden><div class="py">${esc(w.pinyin)}</div><h2 style="text-align:center">${esc(w.ru)}</h2><div class="mut sm" style="text-align:center">${esc(w.en)}</div>${(w.examples || []).map(e => `<div class="sm" style="margin-top:8px">${esc(e.zh)} ${spk(e.audio,'🔊')}<br><span class="mut">${esc(e.pinyin)}<br>${esc(e.ru)}</span></div>`).join('')}</div></div>
      <div id="act"><button class="p" style="width:100%" id="show">Показать ответ</button></div><div id="grade" class="row" hidden>
      <button data-r="1">Не помню</button><button data-r="2">Трудно</button><button data-r="3" class="p">Помню</button><button data-r="4">Легко</button></div>`;
  } else {
    if (c.cue) html += `<div class="hz s">${esc(c.cue)}</div>`;
    if (c.cue && c.cue_en) html += `<div class="mut sm" style="text-align:center">${esc(c.cue_en)}</div>`;
    if (c.cloze) html += `<div class="hz s">${esc(c.cloze)}</div><div class="mut sm" style="text-align:center">${esc(c.cloze_ru)}</div>`;
    if (c.audio_only) html += `<div style="text-align:center;font-size:40px">${spk(w.audio, '🔊 Слушать')}</div>`;
    html += `<p class="mut" style="text-align:center">${esc(c.prompt)}</p><div class="col" id="opts">${c.options.map((o, i) => `<button class="opt" data-i="${i}">${typeof o === 'string' ? esc(o) : `<span style="font-size:22px">${esc(o.hanzi)}</span> <span class="mut">${esc(o.pinyin)}</span>`}</button>`).join('')}</div></div><div id="fb"></div>`;
  }
  app.innerHTML = html + (c.mode === 'reveal' ? '' : '') ; if (c.mode === 'reveal') app.innerHTML += '';
  const next = () => routes.review();
  if (c.autoplay) setTimeout(() => play(w.audio, 'normal'), 250);
  if (c.mode === 'reveal') {
    $('#show').onclick = () => { $('#back').hidden = false; $('#act').hidden = true; $('#grade').hidden = false; };
    document.querySelectorAll('#grade button').forEach(b => b.onclick = async () => { await api('/review/answer', {card_id: c.card_id, rating: +b.dataset.r, ms: Date.now() - t0}); next(); });
  } else document.querySelectorAll('#opts .opt').forEach(b => b.onclick = async () => {
    const r = await api('/review/answer', {card_id: c.card_id, choice: +b.dataset.i, ms: Date.now() - t0});
    document.querySelectorAll('#opts .opt').forEach((x, i) => { x.disabled = true; if (i === r.answer) x.classList.add('ok'); else if (i === +b.dataset.i) x.classList.add('no'); });
    $('#fb').innerHTML = `<div class="card"><b class="${r.correct ? 'ok' : 'bad'}">${r.correct ? 'Верно' : 'Неверно'}</b> — <span class="hz s" style="font-size:24px">${esc(w.hanzi)}</span> ${esc(w.pinyin)} — ${esc(w.ru)} ${spk(w.audio)}</div><button class="p" style="width:100%" id="nx">Дальше</button>`;
    if (c.kind === 'audio') play(w.audio, 'normal'); $('#nx').onclick = next;
  });
};
// ---------- Новые слова / сортировка ----------
const intro = (source) => async () => {
  const r = await api('/new/next?source=' + source);
  if (r.empty) { app.innerHTML = `<h1>${source === 'triage' ? 'Сортировка' : 'Новые слова'}</h1><div class="card">Слов в этом списке больше нет.</div><a class="btn" href="#/">← Сегодня</a>`; return; }
  const w = r.word; const tri = source === 'triage';
  app.innerHTML = `<div class="sm mut">${tri ? 'Слова старого HSK 3: знаешь — отметь, не знаешь — пойдёт в изучение' : 'Новое слово'} · осталось ${r.left}</div><div class="card"><div class="hz">${esc(w.hanzi)}</div><div style="text-align:center">${spk(w.audio)}</div>
   <div id="back" ${tri ? 'hidden' : ''}><div class="py">${esc(w.pinyin)}</div><h2 style="text-align:center">${esc(w.ru)}</h2><div class="mut sm" style="text-align:center">${esc(w.en)}</div>${(w.examples || []).map(e => `<div class="sm" style="margin-top:8px">${esc(e.zh)} ${spk(e.audio)}<br><span class="mut">${esc(e.pinyin)}<br>${esc(e.ru)}</span></div>`).join('')}</div></div>
   ${tri ? `<button id="peek" style="width:100%;margin-bottom:8px">Показать значение</button>` : ''}
   <div class="row"><button id="learn">${tri ? 'Не знаю' : 'Учить'}</button><button class="p" id="know">${tri ? 'Знаю' : 'Уже знаю'}</button></div>`;
  setTimeout(() => play(w.audio, 'normal'), 250);
  if (tri) $('#peek').onclick = () => { $('#back').hidden = false; $('#peek').hidden = true; };
  const done = async a => { await api('/new/answer', {word_id: w.id, action: a}); routes[source === 'triage' ? 'triage' : 'new'](); };
  $('#learn').onclick = () => done('learn'); $('#know').onclick = () => done('know');
};
routes.new = intro('new'); routes.triage = intro('triage');
// ---------- Аудирование ----------
routes.listening = async (rest) => {
  if (rest[0] === 'dictation') return dictation();
  const exclude = (routes._seen = routes._seen || []);
  app.innerHTML = `<h1>Аудирование</h1><div class="row" style="margin-bottom:10px"><a class="btn p" href="#/listening">Задания</a><a class="btn" href="#/listening/dictation">Диктант</a>
   <button id="spd">${speed === 'slow' ? '🐢 Медленно' : '▶ Обычно'}</button></div><div id="item"></div>`;
  $('#spd').onclick = e => { speed = speed === 'slow' ? 'normal' : 'slow'; localStorage.setItem('speed', speed); e.target.textContent = speed === 'slow' ? '🐢 Медленно' : '▶ Обычно'; };
  const it = await api('/listening/next?exclude=' + exclude.slice(-20).join(','));
  if (it.empty) { $('#item').innerHTML = '<div class="card">Заданий нет.</div>'; return; }
  const t0 = Date.now(); let plays = 0, busy = false;
  $('#item').innerHTML = `<div class="card"><div class="sm mut">${it.type === 'dialog' ? 'Диалог' : 'Монолог'} · уровень ${it.level} · ${it.turns.map(t => t.spk === 'F' ? '♀' : '♂').join('')}</div>
   <div style="text-align:center;margin:10px 0"><button class="p" id="go" style="font-size:20px;padding:14px 26px">🔊 Слушать</button><div class="sm mut" id="pc">Прослушано: 0 (на экзамене обычно 2 раза)</div></div>
   <div id="q" hidden><div class="row" style="align-items:center"><span>Вопрос:</span>${spk(it.question_audio)}</div><div class="col" id="opts" style="margin-top:8px">${it.options.map((o, i) => `<button class="opt" data-i="${i}">${'ABCD'[i]}. ${esc(o)}</button>`).join('')}</div></div></div><div id="fb"></div>`;
  $('#go').onclick = async () => { if (busy) return; busy = true; plays++; $('#pc').textContent = `Прослушано: ${plays}`; await playSeq(it.turns.map(t => t.audio).concat([it.question_audio])); $('#q').hidden = false; busy = false; };
  document.querySelectorAll('#opts .opt').forEach(b => b.onclick = async () => {
    const r = await api('/listening/answer', {item_id: it.id, choice: +b.dataset.i, ms: Date.now() - t0, mode: speed === 'slow' ? 'slow' : 'exam'}); exclude.push(it.id);
    document.querySelectorAll('#opts .opt').forEach((x, i) => { x.disabled = true; if (i === r.answer) x.classList.add('ok'); else if (i === +b.dataset.i) x.classList.add('no'); });
    $('#fb').innerHTML = `<div class="card"><b class="${r.correct ? 'ok' : 'bad'}">${r.correct ? 'Верно' : 'Неверно'}</b><p class="sm">${esc(r.explain)}</p>${r.script.map(s => `<div class="sm">${s.spk === 'F' ? '♀' : '♂'} ${esc(s.zh)}</div>`).join('')}<div class="sm mut">${esc(r.question)}</div></div><button class="p" style="width:100%" id="nx">Следующее</button>`;
    $('#nx').onclick = () => routes.listening([]);
  });
};
async function dictation() {
  const ex = (routes._dseen = routes._dseen || []); const d = await api('/dictation/next?exclude=' + ex.slice(-30).join(',')); let mode = 'hanzi', tones = false;
  app.innerHTML = `<h1>Диктант</h1><div class="row" style="margin-bottom:10px"><a class="btn" href="#/listening">Задания</a><a class="btn p" href="#/listening/dictation">Диктант</a></div>
   <div class="card"><div style="text-align:center"><button class="p" id="go" style="font-size:20px;padding:14px 26px">🔊 Слушать</button> <button id="spd">${speed === 'slow' ? '🐢' : '▶'}</button><div class="sm mut">Знаков в предложении: ${d.length}</div></div>
   <div class="row" style="margin:10px 0"><select id="mode"><option value="hanzi">Писать иероглифами</option><option value="pinyin">Писать пиньинем</option></select><label class="sm"><input type="checkbox" id="tn" style="width:auto"> с тонами</label></div>
   <input id="ans" autocomplete="off" placeholder="Что услышал…"><button class="p" id="ok" style="width:100%;margin-top:8px">Проверить</button></div><div id="fb"></div>`;
  const t0 = Date.now(); $('#go').onclick = () => play(d.audio); $('#spd').onclick = e => { speed = speed === 'slow' ? 'normal' : 'slow'; localStorage.setItem('speed', speed); e.target.textContent = speed === 'slow' ? '🐢' : '▶'; };
  $('#ok').onclick = async () => {
    const r = await api('/dictation/check', {id: d.id, answer: $('#ans').value, mode: $('#mode').value, tones: $('#tn').checked, ms: Date.now() - t0}); ex.push(d.id);
    $('#fb').innerHTML = `<div class="card"><b class="${r.correct ? 'ok' : 'bad'}">${r.correct ? 'Верно' : 'Есть ошибки'}</b> (${Math.round(r.ratio * 100)}%)<div class="hz s">${esc(r.zh)}</div><div class="py sm">${esc(r.pinyin)}</div>
      ${r.correct ? '' : `<div class="sm">${r.diff.filter(x => x.op !== 'equal').map(x => `<span class="diff-del">${esc(x.ref) || '∅'}</span>→<span class="diff-ins">${esc(x.ans) || '∅'}</span>`).join(' ')}</div>`}</div><button class="p" style="width:100%" id="nx">Следующее</button>`;
    $('#nx').onclick = () => dictation(); $('#ok').disabled = true;
  };
}
// ---------- Входной тест ----------
routes.placement = async () => {
  app.innerHTML = '<h1>Входной тест</h1><div class="card">Загрузка…</div>'; const {questions} = await api('/placement/questions');
  const vocab = [], lis = [], gram = []; let i = 0;
  const step = () => {
    if (i >= questions.length) return finish(); const q = questions[i]; const prog = `<div class="bar"><i style="width:${pct(i, questions.length)}%"></i></div><div class="sm mut">Вопрос ${i + 1} из ${questions.length} · ${({vocab:'слова',listening:'аудирование',grammar:'грамматика'})[q.type]}</div>`; const t0 = Date.now();
    if (q.type === 'vocab') {
      app.innerHTML = `${prog}<div class="card"><div class="hz">${esc(q.hanzi)}</div><div style="text-align:center">${spk(q.audio)}</div><div class="col" style="margin-top:10px">${q.options.map((o, k) => `<button class="opt" data-i="${k}">${esc(o)}</button>`).join('')}<button class="opt mut" data-i="-1">Не знаю</button></div></div>`;
      document.querySelectorAll('.opt').forEach(b => b.onclick = () => { vocab.push({stratum: q.stratum, word_id: q.word_id, correct: +b.dataset.i === q.answer_idx}); i++; step(); });
    } else if (q.type === 'grammar') {
      app.innerHTML = `${prog}<div class="card"><div class="hz s" style="font-size:24px">${esc(q.zh)}</div><div class="col" style="margin-top:10px">${q.options.map((o, k) => `<button class="opt" data-i="${k}">${esc(o)}</button>`).join('')}</div></div>`;
      document.querySelectorAll('.opt').forEach(b => b.onclick = () => { gram.push({point_id: q.point_id, correct: +b.dataset.i === q.answer_idx}); i++; step(); });
    } else {
      const it = q.item; let busy = false; app.innerHTML = `${prog}<div class="card"><div style="text-align:center"><button class="p" id="go" style="font-size:20px;padding:14px 26px">🔊 Слушать</button></div><div id="q" hidden><div class="col" style="margin-top:10px">${it.options.map((o, k) => `<button class="opt" data-i="${k}">${'ABCD'[k]}. ${esc(o)}</button>`).join('')}</div></div></div>`;
      $('#go').onclick = async () => { if (busy) return; busy = true; await playSeq(it.turns.map(t => t.audio).concat([it.question_audio])); $('#q').hidden = false; busy = false; };
      document.querySelectorAll('.opt').forEach(b => b.onclick = async () => { const r = await api('/listening/answer', {item_id: it.id, choice: +b.dataset.i, ms: Date.now() - t0, mode: 'placement'}); lis.push({item_id: it.id, correct: r.correct, choice: +b.dataset.i, ms: Date.now() - t0}); i++; step(); });
    }
  };
  const finish = async () => {
    const r = await api('/placement/submit', {vocab, listening: lis, grammar: gram});
    app.innerHTML = `<h1>Результат</h1><div class="card"><table><tr><td>Слов из списка (1950) ты знаешь</td><td><b>≈${r.known_est}</b></td></tr><tr><td>Добрать</td><td><b>≈${r.to_learn}</b></td></tr><tr><td>Нужно новых слов в день (до рубежа за 3 нед. до экзамена)</td><td><b>${r.per_day}</b></td></tr>
      <tr><td>Старый HSK 3 → знаешь</td><td>${r.strata_est_pct.old ?? '—'}%</td></tr><tr><td>Остальные слова ≤ уровня 3 / уровень 4</td><td>${r.strata_est_pct.l3 ?? '—'}% / ${r.strata_est_pct.l4 ?? '—'}%</td></tr>
      <tr><td>Аудирование</td><td>${r.listening_acc == null ? '—' : Math.round(r.listening_acc * 100) + '%'} (мало вопросов — грубая оценка)</td></tr>
      <tr><td>Грамматика (6 вопросов)</td><td>${r.grammar_acc == null ? '—' : Math.round(r.grammar_acc * 100) + '%'}</td></tr></table><p class="sm mut">Вопросов мало — это грубая оценка.</p></div><a class="btn p" href="#/">К плану на сегодня</a>`;
  };
  step();
};

// ---------- Грамматика и письмо ----------
function orderBuilder(box, parts, onCheck) {
  let chosen = [];
  const draw = () => { box.innerHTML = `<div class="card" style="min-height:64px" id="ans">${chosen.map((p, i) => `<button class="chip" data-a="${i}" style="margin:3px;font-size:20px">${esc(p)}</button>`).join('') || '<span class="mut sm">нажимай слова по порядку</span>'}</div>
    <div id="pool" style="margin:8px 0">${parts.map((p, i) => chosen.includes(i) ? '' : `<button class="chip" data-p="${i}" style="margin:3px;font-size:20px">${esc(p)}</button>`).join('')}</div>
    <div class="row"><button id="rst">Сброс</button><button class="p" id="chk" ${chosen.length === parts.length ? '' : 'disabled'}>Проверить</button></div>`;
    box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { chosen.push(+b.dataset.p); draw(); });
    box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { chosen.splice(+b.dataset.a, 1); draw(); });
    $('#rst').onclick = () => { chosen = []; draw(); }; $('#chk').onclick = () => onCheck(chosen.map(i => parts[i]).join(''));
  };
  chosen = chosen.map(Number); draw();
}
routes.grammar = async (rest) => {
  if (rest[0] === 'practice') return grammarPractice();
  if (rest[0] === 'point') return grammarPoint(rest[1]);
  const list = await api('/grammar/list'); const groups = {};
  list.forEach(p => (groups[p.group || 'Прочее'] = groups[p.group || 'Прочее'] || []).push(p));
  app.innerHTML = `<h1>Грамматика и письмо</h1><div class="card col"><a class="btn p" href="#/grammar/practice">Практика грамматики (упорядочить фразу / выбрать)</a>
   <div class="sm mut">Письменная часть:</div><div class="row"><a class="btn" href="#/writing/order">Порядок слов</a><a class="btn" href="#/writing/sentence">Со словом</a></div><div class="row"><a class="btn" href="#/writing/translate">Перевод RU→ZH</a><a class="btn" href="#/writing/describe">По описанию</a></div>
   <a class="btn" href="#/feedback">Разборы от Claude</a></div><h2>76 пунктов HSK 4</h2>
   ${Object.entries(groups).map(([g, ps]) => `<div class="card"><b>${esc(g)}</b>${ps.map(p => `<div class="blk"><a href="#/grammar/point/${p.id}" style="color:inherit;text-decoration:none">${esc(p.title)}</a><span class="pill">${p.acc == null ? '—' : p.acc + '%'}</span></div>`).join('')}</div>`).join('')}`;
};
async function grammarPoint(id) {
  const p = await api('/grammar/point/' + id);
  app.innerHTML = `<a href="#/grammar" class="sm">← Все пункты</a><h1>${esc(p.title)}</h1><div class="card"><div class="tag">${esc(p.group)}</div><p>${esc(p.ru)}</p><p class="mut sm">${esc(p.en)}</p></div>
   <div class="card"><h2>Примеры</h2>${p.examples.map(e => `<div style="margin-bottom:8px"><span class="hz s" style="font-size:22px">${esc(e.zh)}</span> ${spk(e.audio)}<br><span class="mut sm">${esc(e.ru)}</span></div>`).join('')}</div>`;
}
async function grammarPractice() {
  const ex = (routes._gseen = routes._gseen || []); const q = await api('/grammar/next?exclude=' + ex.slice(-15).join(',')); const t0 = Date.now();
  app.innerHTML = `<h1>Практика грамматики</h1><div class="sm mut">№${q.no} · ${esc(q.title)}</div><div class="card"><p>${esc(q.prompt)}</p>${q.kind === 'order' ? `<div class="mut sm">${esc(q.hint)}</div><div id="bld"></div>` : `<div class="hz s" style="font-size:24px">${esc(q.zh)}</div><div class="col" style="margin-top:8px">${q.options.map((o, i) => `<button class="opt" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>`}</div><div id="fb"></div>`;
  const submit = async ans => {
    const r = await api('/grammar/answer', {point_id: q.point_id, kind: q.kind, answer: ans, ms: Date.now() - t0}); ex.push(q.point_id);
    document.querySelectorAll('.opt,.chip,#chk,#rst').forEach(b => b.disabled = true);
    document.querySelectorAll('.opt').forEach(b => { if (b.dataset.o === r.answer.slice(0) || (q.kind === 'choice' && b.dataset.o === ans && r.correct)) b.classList.add(r.correct ? 'ok' : 'no'); });
    $('#fb').innerHTML = `<div class="card"><b class="${r.correct ? 'ok' : 'bad'}">${r.correct ? 'Верно' : 'Неверно'}</b><div class="hz s" style="font-size:22px">${esc(r.answer)}</div><p class="sm">${esc(r.rule)}</p><p class="sm mut">${esc(r.rule_en)}</p><div class="sm">${esc(r.example.zh)} — <span class="mut">${esc(r.example.ru)}</span></div></div><button class="p" style="width:100%" id="nx">Дальше</button>`;
    $('#nx').onclick = grammarPractice;
  };
  if (q.kind === 'order') orderBuilder($('#bld'), q.parts, submit); else document.querySelectorAll('.opt').forEach(b => b.onclick = () => submit(b.dataset.o));
}
routes.writing = async (rest) => {
  const kind = rest[0] || 'order'; const seen = (routes._wseen = routes._wseen || []); const q = await api(`/writing/next?kind=${kind}&exclude=${seen.slice(-10).join(',')}`); const t0 = Date.now(); seen.push(q.id);
  const head = `<a href="#/grammar" class="sm">← Грамматика и письмо</a><h1>${({order:'Порядок слов',sentence:'Предложение со словом',translate:'Перевод RU→ZH',describe:'По описанию'})[kind]}</h1><div class="card"><p>${esc(q.prompt)}</p>`;
  const next = () => routes.writing([kind]);
  if (kind === 'order') {
    app.innerHTML = head + `<div class="mut sm">${esc(q.hint)}</div><div id="bld"></div></div><div id="fb"></div>`;
    orderBuilder($('#bld'), q.parts, async ans => {
      const r = await api('/writing/order', {id: q.id, answer: ans, ms: Date.now() - t0}); document.querySelectorAll('.chip,#chk,#rst').forEach(b => b.disabled = true);
      $('#fb').innerHTML = `<div class="card"><b class="${r.correct ? 'ok' : 'bad'}">${r.correct ? 'Верно' : 'Не совпало с эталоном'}</b><div class="hz s" style="font-size:22px">${esc(r.answer)}</div><div class="sm mut">${esc(r.ru)}</div>
        ${r.correct ? '' : `<button id="alt" class="sm">Мой порядок тоже возможен — отправить на проверку</button>`}</div><button class="p" style="width:100%" id="nx">Дальше</button>`;
      if (!r.correct) $('#alt').onclick = async e => { await api('/writing/submit', {kind: 'order_alt', id: q.id, answer: ans, prompt: q.hint, extra: {reference: r.answer}}); e.target.textContent = 'Отправлено ✓'; e.target.disabled = true; };
      $('#nx').onclick = next;
    });
    return;
  }
  const info = kind === 'sentence' ? `<div class="hz s">${esc(q.word.hanzi)}</div><div class="py sm">${esc(q.word.pinyin)} ${spk(q.word.audio)}</div><div class="center sm mut" style="text-align:center">${esc(q.word.ru)}</div>`
    : kind === 'translate' ? `<h2>${esc(q.ru)}</h2><div class="mut sm">${esc(q.en)}</div><div class="sm">Полезно: ${q.words.map(esc).join(', ')}</div>` : `<h2>${esc(q.ru)}</h2><div class="sm">Слова: ${q.words.map(esc).join(', ')}</div>`;
  app.innerHTML = head + info + `<textarea id="ans" rows="3" placeholder="введи по-китайски (пиньинь-клавиатура)" style="margin-top:8px"></textarea><button class="p" id="ok" style="width:100%;margin-top:8px">Отправить на проверку</button></div><div id="fb"></div>`;
  $('#ok').onclick = async () => {
    const r = await api('/writing/submit', {kind, id: q.id, answer: $('#ans').value, prompt: kind === 'sentence' ? `Предложение со словом ${q.word.hanzi}` : q.ru, extra: kind === 'sentence' ? {word: q.word.hanzi, word_id: q.word.id} : (kind === 'describe' ? {words: q.words} : {})});
    $('#ok').disabled = true; $('#ans').disabled = true;
    $('#fb').innerHTML = `<div class="card"><b class="ok">Отправлено в очередь «на проверку»</b><div class="sm mut">Разбор придёт после команды /hsk-check в Claude Code.</div>${r.reference ? `<div class="sm" style="margin-top:6px">Образец: <span class="hz s" style="font-size:20px">${esc(r.reference)}</span></div>` : ''}</div><button class="p" style="width:100%" id="nx">Следующее</button>`; $('#nx').onclick = next;
  };
};
routes.feedback = async () => {
  const q = await api('/queue'); const names = {writing_sentence: 'Предложение', writing_translation: 'Перевод', writing_describe: 'Описание', writing_order_alt: 'Порядок слов', speaking: 'Говорение'};
  app.innerHTML = `<a href="#/grammar" class="sm">← Грамматика и письмо</a><h1>Разборы</h1>${q.map(i => `<div class="card"><div class="sm mut">${esc(names[i.kind] || i.kind)} · ${new Date(i.ts).toLocaleDateString('ru-RU')} · <b class="${i.status === 'checked' ? 'ok' : 'warn'}">${i.status === 'checked' ? 'проверено' : 'ждёт /hsk-check'}</b></div>
   <div class="sm">${esc(i.payload.prompt)}</div><div class="hz s" style="font-size:22px;text-align:left">${esc(i.payload.answer)}</div>
   ${i.feedback ? `<div class="sm">Балл: <b>${esc(i.feedback.score)}/5</b></div>${(i.feedback.errors || []).map(e => `<div class="sm">• <span class="bad">${esc(e.orig)}</span> → <b>${esc(e.fix)}</b> <span class="mut">${esc(e.rule_ru)}</span></div>`).join('')}${i.feedback.better_version ? `<div class="sm">Лучше: ${esc(i.feedback.better_version)}</div>` : ''}` : ''}</div>`).join('') || '<div class="card mut">Пока пусто.</div>'}`;
};
// ---------- Статистика / Ещё ----------
routes.stats = async () => {
  const s = await api('/stats'), w = s.words;
  app.innerHTML = `<h1>Цифры</h1><div class="card"><h2>Слова</h2><div class="bar"><i style="width:${pct(w.known, w.total)}%"></i></div><table><tr><td>Выучено (≥21 дн.)</td><td><b>${w.known}</b></td></tr><tr><td>В процессе</td><td>${w.learning}</td></tr><tr><td>Новые</td><td>${w.new}</td></tr></table></div>
   <div class="card"><h2>Точность по типам карточек (30 дн.)</h2><table>${Object.entries(s.accuracy).map(([k, v]) => `<tr><td>${k}</td><td>${v}%</td></tr>`).join('') || '<tr><td class="mut">нет данных</td></tr>'}<tr><td>Аудирование</td><td>${s.listening_acc == null ? '—' : Math.round(s.listening_acc * 100) + '%'}</td></tr></table></div>
   <div class="card"><h2>Время</h2><div>Неделя: <b>${s.minutes_week}</b> мин · серия: <b>${s.streak}</b> дн.</div><table>${s.minutes_by_day.map(d => `<tr><td>${d.day}</td><td>${d.minutes} мин</td></tr>`).join('')}</table></div>
   <div class="card"><h2>Частые ошибки</h2><table>${s.hard_words.map(h => `<tr><td class="hz s" style="text-align:left;font-size:20px">${esc(h.hanzi)}</td><td>${esc(h.pinyin)}<br><span class="mut sm">${esc(h.ru)}</span></td><td>${h.bad}/${h.n}</td></tr>`).join('') || '<tr><td class="mut">пока нет</td></tr>'}</table></div>`;
};
routes.more = async () => {
  const l = await api('/lan'), st = await api('/state');
  app.innerHTML = `<h1>Ещё</h1><div class="card col"><a class="btn" href="#/words">Словарь (поиск)</a><a class="btn" href="#/placement">Пройти входной тест заново</a><a class="btn" href="#/settings">Настройки плана</a></div>
   <div class="card"><h2>С телефона</h2><div class="sm">Телефон и ноутбук в одной Wi-Fi сети. Открой в браузере телефона:</div>${l.ips.map(ip => `<div class="big" style="font-size:18px">http://${ip}:${l.port}</div>`).join('') || '<div class="mut">адрес не определён — смотри окно start.bat</div>'}</div>
   <div class="card"><h2>Модули</h2><div class="sm">Готово: ${st.available.join(', ')}. Говорение, чтение, пробные экзамены — в разработке (см. PROGRESS.md).</div></div>`;
};
routes.words = async () => {
  app.innerHTML = `<h1>Словарь</h1><input id="q" placeholder="иероглифы, пиньинь, русский или английский"><div id="res"></div>`;
  const go = async () => { const r = await api('/words?q=' + encodeURIComponent($('#q').value)); $('#res').innerHTML = r.map(w => `<div class="card"><span class="hz s" style="font-size:26px">${esc(w.hanzi)}</span> <span class="py" style="font-size:16px">${esc(w.pinyin)}</span> ${spk(w.audio)} <span class="tag">ур. ${w.level}</span><div>${esc(w.ru)}</div><div class="mut sm">${esc(w.en)}</div>${(w.examples || []).map(e => `<div class="sm">${esc(e.zh)}<br><span class="mut">${esc(e.ru)}</span></div>`).join('')}</div>`).join(''); };
  $('#q').oninput = () => { clearTimeout(routes._t); routes._t = setTimeout(go, 250); }; go();
};
routes.settings = async () => {
  const s = (await api('/state')).plan;
  app.innerHTML = `<h1>Настройки плана</h1><div class="card col"><label>Дата начала<input type="date" id="st" value="${s.start}"></label><label>Дата экзамена<input type="date" id="ex" value="${s.exam}"></label><label>Минут в день<input type="number" id="mn" value="${s.minutes}"></label><button class="p" id="sv">Сохранить</button></div><div class="sm mut">Блок «Сегодня» пересчитывается сам: сколько новых слов в день, сколько на аудирование и т.д.</div>`;
  $('#sv').onclick = async () => { await api('/settings', {start: $('#st').value, exam: $('#ex').value, minutes: +$('#mn').value}); location.hash = '#/'; };
};
['speaking', 'reading', 'mock'].forEach(k => routes[k] = async () => { app.innerHTML = '<h1>Скоро</h1><div class="card">Этот модуль ещё в разработке (см. PROGRESS.md).</div><a class="btn" href="#/">← Сегодня</a>'; });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('/sw.js').catch(() => {});
$('#clock').textContent = new Date().toLocaleDateString('ru-RU', {weekday: 'short', day: 'numeric', month: 'long'});
route();
