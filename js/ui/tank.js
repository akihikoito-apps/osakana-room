// すいそう画面：3D水槽・ゲージ・お世話ボタン・魚のカード・ヒント。
import { createAquarium } from '../aquarium/index.js';
import { $, $$, el, toast, popAt, bumpCoins } from './common.js';
import { lightOf } from '../state.js';

let G = null;
let aq = null;                // いま 見ている 水槽の 3D
const aqs = {};               // 水の しゅるいごとに 1つだけ 作って つかいまわす（ズームで 出入りしても 作りなおさない）
let shownTankId = null;
let cleaning = false;         // そうじの アニメ中
let selected = null;          // カードを出している魚の uid
let tagUid = null, tagTimer = 0, tagEl = null;
let busy = {};                // ボタンの 連打よけ（実時間）
let feedTimer = 0;
let hint = null, happyLineAt = 0, happyUntil = 0, hintOpenUntil = 0;
const HINT_OPEN_MS = 10000;
const CARD_CLOSE_MS = 8000;       // 魚カードは さわらなければ 8びょうで とじる
const GAUGE_CLOSE_MS = 8000;      // スマホで ひらいた ゲージは 8びょうで たたむ
const IDLE_MS = 10000;            // なにも しない 時間が 10びょう で ボタンを うすく
let cardTimer = 0, gaugeTimer = 0, idleTimer = 0;
const isPhone = () => matchMedia('(max-height: 500px)').matches;
const tutorialOn = () => !!G?.tutorialBusy?.();
const pending = [];           // すいそうが 見えていない ときの リアクション（見えたら 出す）

const FACE = { good: '😊', ok: '😐', bad: '😟' };

export function init(g) {
  G = g;
  G.refreshCare = () => renderCareState();
  G.queueReact = (uid, kind, delay = 0) => { if (G.screen === 'tank' && aq) setTimeout(() => aq.react(uid, kind), delay); else pending.push([uid, kind, delay]); };
  $$('#care [data-care]').forEach((b) => b.addEventListener('click', () => onCare(b.dataset.care, b)));
  G.on('tick', () => { if (G.screen === 'tank') { renderGauges(); renderCard(); syncWater(); syncFish(); } renderCareState(); });
  G.on('sim', (ev) => { if (ev.type === 'hour' && G.screen === 'tank') renderHint(); });
  G.on('changed', () => { if (aq) { syncFish(); syncDecor(); syncWater(); } renderGauges(); renderCareState(); renderCard(); renderEmpty(); if (G.screen === 'tank') renderHint(); });
  G.on('sim', onSimEvent);
  $('#hint').addEventListener('click', (e) => {
    if (e.target.closest('.hint-x')) { if (hint) G.sim.closeHint(G.state, hint.key); hint = null; happyUntil = 0; $('#hint').hidden = true; $('#hint-mini').hidden = true; glow(null); G.markDirty(); }
  });
  // 10びょう たったら 小さな 💡 に たたむ（水槽の 底が かくれない ように）。おすと また ひらく
  $('#hint-mini').addEventListener('click', () => { if (!hint) return; hintOpenUntil = performance.now() + HINT_OPEN_MS; $('#hint').hidden = false; $('#hint-mini').hidden = true; });
  // スマホ：ゲージは たたんで おき、さわると ひらく
  $('#gauges').addEventListener('click', () => {
    if (!isPhone()) return;
    const g = $('#gauges');
    g.classList.toggle('open');
    clearTimeout(gaugeTimer);
    if (g.classList.contains('open') && !tutorialOn()) gaugeTimer = setTimeout(() => g.classList.remove('open'), GAUGE_CLOSE_MS);
  });
  for (const c of ['#aq', '#aq-salt']) $(c).addEventListener('pointerdown', () => { if (!tutorialOn()) $('#gauges').classList.remove('open'); });
  // ほかの 水槽へ（へやに もどらずに じゅんばんに）
  $('#feeder-sw').addEventListener('click', () => {
    const t = G.tank();
    const on = G.sim.setFeeder(t, t.feederOn === false);
    toast(on ? 'じどう えさやりを オンに したよ' : 'じどう えさやりを オフに したよ');
    G.markDirty(); G.saveNow(); renderFeeder();
  });
  $('#tank-title .tt-prev').addEventListener('click', () => step(-1));
  $('#tank-title .tt-next').addEventListener('click', () => step(1));
  $('#fish-card').addEventListener('pointerdown', () => armCardClose());
  // なにも しない 時間が つづいたら ボタンを うすく（さわれば もどる。うすい ときの タップも そのまま きく：agy の いけん）
  const wake = () => {
    document.body.classList.remove('idle');
    armIdle();
  };
  window.addEventListener('pointerdown', wake, true);
  window.addEventListener('keydown', wake, true);
  G.on('screen', () => { document.body.classList.remove('idle'); armIdle(); });
  armIdle();
  // 名前の札を 魚に ついていかせる
  const follow = () => {
    if (tagEl && tagUid && aq) {
      const p = aq.screenPosOf(tagUid);
      if (p && performance.now() < tagTimer) { tagEl.style.left = p.x + 'px'; tagEl.style.top = (p.y - 6) + 'px'; tagEl.hidden = false; }
      else { tagEl.remove(); tagEl = null; tagUid = null; }
    }
    if (!$('#hint').hidden && happyUntil && performance.now() > happyUntil) { $('#hint').hidden = true; happyUntil = 0; }
    if (hint && !$('#hint').hidden && performance.now() > hintOpenUntil && G.screen === 'tank') { $('#hint').hidden = true; $('#hint-mini').hidden = false; $('#hint-mini').classList.toggle('pulse', !!hint.action); }
    requestAnimationFrame(follow);
  };
  requestAnimationFrame(follow);
}

function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const busy = tutorialOn() || G.screen !== 'tank' || !$('#dialog').hidden || document.body.classList.contains('photo');
    if (busy) { armIdle(); return; }
    // カードと ひらいた ヒントは さきに とじる
    selected = null; renderCard();
    if (hint && !$('#hint').hidden) { hintOpenUntil = 0; }
    $('#gauges').classList.remove('open');
    document.body.classList.add('idle');
  }, IDLE_MS);
}

function armCardClose() {
  clearTimeout(cardTimer);
  if (tutorialOn()) return;
  cardTimer = setTimeout(() => { selected = null; renderCard(); }, CARD_CLOSE_MS);
}

/** いまの 水槽の 水に あう 3D を えらぶ（まみず・うみ で 1つずつ。作るのは さいしょの 1かい だけ） */
function ensureAq() {
  const t = G.tank();
  const water = t.water === 'salt' ? 'salt' : 'fresh';
  if (!aqs[water]) {
    const canvas = $(water === 'salt' ? '#aq-salt' : '#aq');
    const a = createAquarium(canvas, { water, species: G.data.FISH });
    a.on('tapFish', ({ uid }) => { if (a === aq) onTapFish(uid); });
    a.on('eat', ({ uid, kind }) => { if (a === aq) onEat(uid, kind); });
    // 魚の いない ところを タップしたら カードを とじる（見回しの ドラッグは のぞく）
    let downAt = null;
    canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; justTapped = false; });
    canvas.addEventListener('pointerup', (e) => {
      const moved = !downAt || Math.abs(e.clientX - downAt.x) + Math.abs(e.clientY - downAt.y) > 10;
      setTimeout(() => { if (!moved && !justTapped && selected) { selected = null; renderCard(); } justTapped = false; }, 0);
    });
    aqs[water] = a;
  }
  if (aq && aq !== aqs[water]) aq.stop();
  aq = aqs[water];
  G.aq = aq;
  $('#aq').hidden = water !== 'fresh';
  $('#aq-salt').hidden = water !== 'salt';
  syncDecor(); syncWater(); syncFish();
  return aq;
}

/** となりの 水槽へ（へやの わくの じゅん） */
function step(dir) {
  const list = G.state.tanks.slice().sort((a, b) => a.slot - b.slot);
  if (list.length < 2) return;
  const i = list.findIndex((t) => t.id === G.tank().id);
  const next = list[(i + dir + list.length) % list.length];
  hide();
  G.setTank(next.id);
  const body = $('#scr-tank');
  body.classList.remove('slide-l', 'slide-r'); void body.offsetWidth;
  body.classList.add(dir > 0 ? 'slide-l' : 'slide-r');
  show(G);
  G.emit('action', { type: 'openTank', tankId: next.id });
}

function renderTitle() {
  const s = G.state, t = G.tank();
  const box = $('#tank-title');
  box.querySelector('.tt-name').textContent = G.sim.tankName(s, t);
  const w = box.querySelector('.tt-water');
  w.textContent = t.water === 'salt' ? 'うみ' : 'かわ';
  w.className = 'tt-water water-tag ' + t.water;
  const list = s.tanks.slice().sort((a, b) => a.slot - b.slot);
  const many = list.length > 1;
  box.querySelector('.tt-prev').hidden = !many;
  box.querySelector('.tt-next').hidden = !many;
  box.querySelector('.tt-dots').replaceChildren(...(many ? list.map((x) => el('i', { class: x.id === t.id ? 'on ' + x.water : x.water })) : []));
  box.hidden = !!G.tutorialBusy?.() && list.length < 2;
}
let justTapped = false;

export function show(g) {
  G = g;
  if (shownTankId !== G.tank().id) { selected = null; hint = null; shownTankId = G.tank().id; }
  ensureAq();
  syncFish(); syncDecor(); syncWater();
  aq.start();
  renderTitle();
  renderGauges(); renderCareState(); renderCard(); renderHint(true); renderEmpty();
  // 見えていない ときに たまった リアクション
  const list = pending.splice(0);
  list.forEach(([uid, kind, delay], i) => setTimeout(() => aq?.react(uid, kind), 600 + i * 250 + delay));
}
export function hide() {
  cleanDone?.();
  aq?.stop();
  if (feedTimer) { clearTimeout(feedTimer); feedTimer = 0; G.handleEvents(G.sim.feedEnd(G.state)?.events); }
}

// ---------- 3D と データを あわせる ----------
function syncFish() {
  const fish = G.tank().fish;
  aq?.setFish(fish.map((f) => ({ uid: f.uid, speciesId: f.speciesId, stage: f.stage, health: f.health, happy: f.mood })));
  // ビタミンの すききらい（3D の ぷいっ・だいすき の よろこび）
  aq?.setFoodPrefs?.(Object.fromEntries(fish.map((f) => [f.uid, { vitamin: G.data.fishById[f.speciesId]?.vitamin || 'ok' }])));
}
function syncDecor() { aq?.setDecor(G.tank().decor.slice()); }
function syncWater() {
  if (!aq) return;
  const t = G.tank();
  const base = t.decor.includes('light') ? (G.data.itemById.light?.effect?.light ?? 1) : 0.6;
  // よるは すこし くらく（まっくらには しない）
  const day = lightOf(G.state.clock.min);
  const light = base * (0.55 + 0.45 * (day - 0.45) / 0.55);
  aq.setWater({ dirt: (100 - t.clean) / 100, waste: (t.waste || 0) / (G.sim.balance().CLEAN?.wasteMax ?? 9), light: Math.max(0.3, Math.min(1, light)), bubbles: t.decor.includes('air_pump') });
}

// ---------- ゲージ ----------
function renderGauges() {
  const t = G.tank();
  const sim = G.sim;
  const set = (key, pct, lvl, word) => {
    const g = $(`#gauges [data-g="${key}"]`);
    g.querySelector('.bar i').style.width = Math.max(4, Math.min(100, pct)) + '%';
    g.dataset.lvl = lvl;
    g.querySelector('.g-face').textContent = FACE[lvl] || FACE.ok;
    g.querySelector('.g-word').textContent = word;
  };
  const has = t.fish.length > 0;
  // すいおん：10〜32ど。すきな はんいを 帯、いまの 水温を 点で
  const lo = 10, hi = 32, P = (x) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
  const ts = sim.tempState(t);
  const tl = { good: 'good', ok: 'ok', cold: 'bad', hot: 'bad' }[ts];
  const tg = $('#gauges [data-g="temp"]');
  tg.dataset.lvl = has ? tl : 'ok';
  tg.querySelector('.g-face').textContent = has ? FACE[tl] : '';
  tg.querySelector('.g-word').textContent = has ? sim.label('temp', ts) : '';
  tg.querySelector('.g-val').textContent = Math.round(t.temp) + 'ど';
  const bar = tg.querySelector('.bar');
  const r = sim.tempRange(t);
  const band = bar.querySelector('.band');
  if (r && r.min < r.max) { band.hidden = false; band.style.left = P(r.min) + '%'; band.style.width = (P(r.max) - P(r.min)) + '%'; } else band.hidden = true;
  bar.querySelector('.mark').style.left = P(t.temp) + '%';
  set('clean', t.clean, sim.level('clean', t.clean), sim.label('clean', t.clean));
  set('air', t.air, sim.level('air', t.air), sim.label('air', t.air));
  const ok = sim.onakaMin(t);
  set('food', has ? ok : 0, has ? sim.level('onaka', ok) : 'ok', has ? sim.label('onaka', ok) : '');
  if (!has) $('#gauges [data-g="food"] .g-face').textContent = '';
}

// ---------- お世話ボタン ----------
function renderCareState() {
  const s = G.state, t = G.tank(), sim = G.sim;
  const btn = (k) => $(`#care [data-care="${k}"]`);
  const fb = btn('feed'), wb = btn('water'), cb = btn('clean');
  fb.classList.toggle('cool', !sim.ownsTool(s, 'food_flake') || sim.feedBusy() || cleaning);
  wb.classList.toggle('cool', !sim.ownsTool(s, 'water_change') || cleaning);
  cb.classList.toggle('cool', cleaning);      // たべのこし 0 でも あみは つかえる（仕様 v0.2 7章）
  cb.classList.toggle('busy', cleaning);
  const show = G.tutorialShows || (() => true);
  fb.hidden = !show('feed'); wb.hidden = !show('water'); cb.hidden = !show('clean'); btn('photo').hidden = !show('photo');
  // ビタミン：いちど かったら 出す。のこり かいすう・きょう もう あげた・みんな にがて は うすく
  const vb = btn('vitamin');
  const left = s.inv.food_vitamin || 0;
  vb.hidden = !s.owned.food_vitamin || !show('feed');
  // きょう もう あげた 水槽は「☀ あしたの あさ また」（のこりが あっても おせない わけ）
  const doneNow = (s.daily.vitamin?.[t.id] || 0) >= (sim.balance().VITAMIN?.perTankPerDay ?? 1);
  vb.querySelector('.vit-left').textContent = doneNow && left ? '☀ あしたの あさ また' : ` のこり ${left}`;
  const done = (s.daily.vitamin?.[t.id] || 0) >= (sim.balance().VITAMIN?.perTankPerDay ?? 1);
  const allNo = t.fish.length > 0 && t.fish.every((f) => G.data.fishById[f.speciesId]?.vitamin === 'dislike');
  vb.classList.toggle('cool', !left || done || allNo || cleaning || sim.vitaminBusy());
  renderCap(); renderThermo();
}

/** 定員：「さかな ◯／6 ・ かい ◯／2」（かずが わかる ように いっぱい なら ことばで） */
export function capText(t) {
  const c = G.sim.capacityOf(t);
  const fishFull = c.full ?? (c.space >= c.capacity - 1e-9);   // 6ぴき でも space でも いっぱい
  return { fish: fishFull ? 'さかな いっぱい' : `さかな ${c.fish}ひき`, snail: c.snail >= c.snailMax ? 'かい いっぱい' : `かい ${c.snail}／${c.snailMax}`, fishFull, snailFull: c.snail >= c.snailMax, c };
}
function renderCap() {
  const box = $('#tank-cap');
  const t = G.tank();
  if (!t.fish.length || G.tutorialBusy?.()) { box.hidden = true; return; }
  const k = capText(t);
  box.replaceChildren(el('span', { class: k.fishFull ? 'full' : '', text: '🐟 ' + k.fish }), el('span', { class: k.snailFull ? 'full' : '', text: '🐚 ' + k.snail }));
  box.hidden = false;
}

/** おんど ダイヤル（ヒーターと ファンが りょうほう ある 水槽） */
function renderThermo() {
  const box = $('#thermo');
  const t = G.tank(), sim = G.sim;
  if (!sim.hasThermo(t) || G.tutorialBusy?.()) { box.hidden = true; renderFeeder(); return; }
  const steps = sim.balance().THERMO?.steps || [];
  renderFeeder();
  box.querySelector('.th-steps').replaceChildren(...steps.map((st) => {
    const out = sim.thermoOutFish(t, st.id);
    const face = out.length ? el('img', { class: 'th-fish', src: G.data.fishById[out[0].speciesId]?.texture || '', alt: '' }) : el('span', { class: 'th-face', text: '😊' });
    return el('button', { class: 'th-step' + (t.thermo === st.id ? ' on' : '') + (out.length ? ' out' : ''), 'data-step': st.id, onclick: () => pickThermo(st.id) },
      el('span', { class: 'th-lb', text: st.label }), el('span', { class: 'th-deg', text: st.temp + 'ど' }), face);
  }));
  box.hidden = false;
}
/** じどう えさやりの オン／オフ（きぐが ある 水槽だけ。「いり」は「えさ いり」と よめるので つかわない） */
function renderFeeder() {
  const b = $('#feeder-sw');
  const t = G.tank();
  if (!t.decor.includes('auto_feeder') || G.tutorialBusy?.()) { b.hidden = true; return; }
  const on = t.feederOn !== false;
  b.classList.toggle('on', on);
  b.querySelector('.fs-state').textContent = on ? 'オン' : 'オフ';
  b.setAttribute('aria-pressed', String(on));
  b.hidden = false;
}
function pickThermo(id) {
  const t = G.tank();
  const r = G.sim.setThermo(G.state, t, id);
  // あわない 段（灰色）は えらべない。おしたら わけを いう
  if (!r.ok) { if (r.out?.length) toast(G.sim.data().THERMO_LINES.outOfRange.replaceAll('{name}', G.data.fishById[r.out[0].speciesId]?.name || '')); return; }
  G.markDirty(); G.saveNow();
  renderThermo(); renderGauges();
}

/** ヒントの action の ボタンを ゆっくり 光らせる */
function glow(action) {
  $$('.hint-glow').forEach((e) => e.classList.remove('hint-glow'));
  const map = { feed: '#care [data-care="feed"]', water_change: '#care [data-care="water"]', scoop: '#care [data-care="clean"]', shop: '#btn-menu', vitamin: '#care [data-care="vitamin"]', thermo: '#thermo' };
  const e = action && map[action] && $(map[action]);
  if (e) e.classList.add('hint-glow');
}

function onCare(kind, b) {
  const now = performance.now();
  if (busy[kind] && now < busy[kind]) return;
  const s = G.state, t = G.tank(), sim = G.sim;
  if (kind === 'photo') { G.emit('photo'); return; }
  if (cleaning) return;                 // あみの アニメ中は えさ・みずかえ・そうじ を おせない
  if (kind === 'feed') {
    if (!sim.ownsTool(s, 'food_flake')) { toast('えさは おみせに あるよ'); return; }
    const r = sim.feedStart(s, t);
    if (!r.ok) {
      if (r.reason === 'full') toast(r.text);
      else if (r.reason === 'noFish') toast('まだ さかなが いないよ');
      return;
    }
    busy.feed = now + r.lockMs;
    G.handleEvents(r.prevEvents);
    setTimeout(renderCareState, r.lockMs + 50);
    // 魚が いる あたり（なければ まんなか）に 落とす
    const W = $('#aq').clientWidth || 1;
    const xs = t.fish.map((f) => aq?.screenPosOf(f.uid)?.x).filter((x) => x != null);
    const x = xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length / W : 0.5;
    aq?.feed(Math.min(0.85, Math.max(0.15, x + (Math.random() - 0.5) * 0.12)), 0.15);
    // 魚が おおいときは もうひとつまみ（1回 5つぶ なので）
    if (t.fish.length > 4) setTimeout(() => aq?.feed(Math.min(0.85, Math.max(0.15, x + 0.12)), 0.15), 250);
    renderCareState();
    clearTimeout(feedTimer);
    feedTimer = setTimeout(() => {
      feedTimer = 0;
      const end = sim.feedEnd(s);
      G.handleEvents(end?.events);
      renderCareState(); G.markDirty(); G.saveNow();
      G.emit('changed');
    }, r.windowMs);
    G.emit('action', { type: 'feedStart' });
    return;
  }
  if (kind === 'vitamin') { giveVitamin(b); return; }
  if (kind === 'water') {
    if (!sim.ownsTool(s, 'water_change')) { toast('みずかえセットは おみせに あるよ'); return; }
    busy.water = now + 1500;
    const r = sim.waterChange(s, t);
    flashWater();
    toast('みずが ピカピカに なったよ');
    reward(r.coin, b);
    // 全員 happy、1ぴきだけ spin
    const spinner = t.fish.length ? t.fish[Math.floor(Math.random() * t.fish.length)].uid : null;
    t.fish.forEach((f, i) => setTimeout(() => aq?.react(f.uid, f.uid === spinner ? 'spin' : 'happy'), i * 120));
    G.emit('action', { type: 'waterChange', result: r });
    G.handleEvents(r.events);
  } else if (kind === 'clean') {
    startClean(b, t);
    return;
  }
  G.markDirty(); G.saveNow();
  G.emit('changed');
  G.refreshHud();
}

/** そうじ：あみで すくう アニメ（aq.playClean。仕様 v0.2 7章：2びょう）→ おわりに たべのこし・そこの ごみ 0 */
let cleanDone = null;
function startClean(b, t) {
  cleaning = true;
  renderCareState();
  const sec = G.sim.balance().SCOOP?.animRealSec ?? 2;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  // 3D の あみ（aq.playClean）。おそい 端末でも かならず おわる ように 2びょう＋2びょう で しめる
  const anim = Promise.race([typeof aq?.playClean === 'function' ? Promise.resolve(aq.playClean()).catch(() => {}) : wait(sec * 1000), wait(sec * 1000 + 2000)]);
  let finished = false;
  cleanDone = () => {
    if (finished) return;
    finished = true; cleanDone = null; cleaning = false;
    const tank = G.state.tanks.find((x) => x.id === t.id) || t;
    const r = G.sim.scoop(G.state, tank);
    if (r.ok) {
      toast('そこの ごみを すくったよ');
      G.emit('action', { type: 'scoop', result: r });
      G.handleEvents(r.events);
    } else toast('ピカピカだね！');
    G.markDirty(); G.saveNow();
    G.emit('changed');
    G.refreshHud();
  };
  Promise.resolve(anim).catch(() => {}).then(() => cleanDone?.());
}
// とちゅうで 裏に まわったら、そこで おわった ことに する
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') cleanDone?.(); });

/** ビタミン：おとす（にがての 魚は 3D が ぷいっ）。おわりに しめる */
let vitTimer = 0;
function giveVitamin(b) {
  const s = G.state, t = G.tank(), sim = G.sim;
  if (cleaning) return;
  const r = sim.vitaminStart(s, t);
  if (!r.ok) { if (r.text) toast(r.text); else if (r.reason === 'noFish') toast('まだ さかなが いないよ'); return; }
  const W = $('#aq').clientWidth || 1;
  const xs = t.fish.map((f) => aq?.screenPosOf(f.uid)?.x).filter((x) => x != null);
  const x = xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length / W : 0.5;
  aq?.feed(Math.min(0.85, Math.max(0.15, x)), 0.15, { kind: 'vitamin' });
  if (t.fish.length > 4) setTimeout(() => aq?.feed(Math.min(0.85, Math.max(0.15, x + 0.12)), 0.15, { kind: 'vitamin' }), 250);
  // にがての 魚：すききらいを ずかんに のせる（はじめての しゅるい なら ふきだし）
  for (const f of t.fish) {
    if (G.data.fishById[f.speciesId]?.vitamin !== 'dislike') continue;
    const e = sim.vitaminEat(s, f.uid);
    if (e?.line) toast('♪ ' + e.line);   // ぷいっ は あかるく（3D は setFoodPrefs で じどうで 'pui'）
  }
  renderCareState();
  setTimeout(renderCareState, r.lockMs + 50);
  clearTimeout(vitTimer);
  vitTimer = setTimeout(() => { const end = sim.vitaminEnd(s); G.handleEvents(end?.events); G.markDirty(); G.saveNow(); G.emit('changed'); }, r.windowMs);
  G.markDirty(); G.saveNow();
  G.emit('action', { type: 'vitamin' });
}
let vitLineShown = false;
function onVitaminEat(uid) {
  const r = G.sim.vitaminEat(G.state, uid);
  if (!r) return;
  const kinds = r.react || [];
  // 3D は だいすき を じぶんで よろこぶ。ここでは のこりの リアクションを つづけて
  kinds.forEach((k, i) => setTimeout(() => aq?.react(uid, k === 'turn' ? 'pui' : k), i * 1000));
  if (r.line && !vitLineShown && r.pref !== 'dislike') { vitLineShown = true; toast(r.line, r.pref === 'love' ? 'gold' : ''); setTimeout(() => { vitLineShown = false; }, 6000); }
  G.handleEvents(r.events);
  G.markDirty();
  renderGauges();
}

function onEat(uid, kind) {
  if (kind === 'vitamin') { onVitaminEat(uid); return; }
  const r = G.sim.feedEat(G.state, uid);
  if (!r) return;
  if (r.coin) {
    const p = aq?.screenPosOf(uid);
    if (p) popAt(p.x, p.y - 28, `+${r.coin} <span class="coin-ic sm"></span>`);
    bumpCoins();
  }
  G.emit('action', { type: 'feed', result: { ate: [uid] } });
  G.handleEvents(r.events);
  G.refreshHud();
  renderGauges();
}

function reward(coin, b) {
  if (!coin) return;
  const r = b.getBoundingClientRect();
  popAt(r.left + r.width / 2, r.top, `+${coin} <span class="coin-ic sm"></span>`);
  bumpCoins();
}

function flashWater() {
  $('#aq').animate([{ filter: 'brightness(1.35) saturate(1.2)' }, { filter: 'none' }], { duration: 900, easing: 'ease-out' });
}

// ---------- 魚を タップ ----------
function onTapFish(uid) {
  justTapped = true;
  const r = G.sim.pet(G.state, uid, Date.now(), G.tank());
  if (r.ok && r.react) {
    aq.react(uid, r.react);
    if (r.heart) { flyHeart(uid); plusOne(uid); }
    if (r.coin) { toast(`+${r.coin} コイン  なでて もらって うれしいな`, 'gold'); bumpCoins(); G.refreshHud(); }
    if (r.justFull || (r.dayFull && !heartDoneShown)) { heartDoneShown = true; toast(G.sim.balance().HEART?.doneLine || 'また あしたね'); }
    else if (r.weak && !r.heart) toast(G.sim.balance().HEART?.restLine || 'いまは やすんでいるよ');
    G.emit('action', { type: 'pet', uid });
    G.handleEvents(r.events);
    G.markDirty();
  }
  selected = uid;
  showTag(uid);
  renderCard();
  armCardClose();
}

/** 出た ハートを 上の帯の ハートへ とばして かぞえる */
function flyHeart(uid) {
  const p = aq?.screenPosOf(uid);
  const dst = $('#hud-hearts').getBoundingClientRect();
  const n = G.state.hearts;
  if (!p || matchMedia('(prefers-reduced-motion: reduce)').matches) { G.refreshHud(); bumpHearts(); return; }
  const h = el('div', { class: 'fly-heart' }, el('span', { class: 'heart-ic' }));
  h.style.left = p.x + 'px'; h.style.top = (p.y - 20) + 'px';
  document.getElementById('app').append(h);
  requestAnimationFrame(() => { h.style.transform = `translate(${dst.left + 20 - p.x}px, ${dst.top + dst.height / 2 - p.y + 20}px) scale(0.7)`; h.style.opacity = '0.9'; });
  setTimeout(() => { h.remove(); G.refreshHud(); bumpHearts(); }, 470);
}
let heartDoneShown = false;
/** なでた ところに「＋1」 */
function plusOne(uid) {
  const p = aq?.screenPosOf(uid);
  if (p) popAt(p.x, p.y - 34, '<span class="heart-ic sm"></span>＋1', 'pop-coin pop-heart');
}
function bumpHearts() {
  const c = $('#hud-hearts');
  c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
}

function showTag(uid) {
  const f = G.tank().fish.find((x) => x.uid === uid);
  if (!f) return;
  tagEl?.remove();
  tagEl = el('div', { class: 'name-tag', text: G.data.fishById[f.speciesId]?.name || '' });
  tagEl.hidden = true;
  $('#tank-pops').append(tagEl);
  tagUid = uid; tagTimer = performance.now() + 2500;
}

function renderCard() {
  const card = $('#fish-card');
  const t = G.tank();
  const f = selected && t.fish.find((x) => x.uid === selected);
  if (!f || G.screen !== 'tank') { card.hidden = true; return; }
  const sp = G.data.fishById[f.speciesId] || {};
  const sim = G.sim, B = sim.balance();
  const faceRow = (name, kind, v) => {
    const lvl = sim.level(kind, v);
    const weak = kind === 'health' && v < B.HEALTH.weak;
    return el('div', { class: 'c-row', 'data-lvl': lvl },
      el('span', { class: 'c-lb', text: name }),
      el('span', { class: 'c-face', text: weak ? '💧' : FACE[lvl] }),
      el('span', { class: 'c-word', text: B.LABELS[kind][lvl] }));
  };
  const hearts = Math.max(0, Math.min(5, Math.floor(f.natsuki / (B.BOND.heartStep || 20))));
  const heartEl = el('span', { class: 'c-hearts' }, ...Array.from({ length: 5 }, (_, i) => el('i', { class: i < hearts ? 'on' : '' })));
  const nk = sim.nakayoshiOf(t, f);
  const close = el('button', { class: 'c-close', 'aria-label': 'とじる', text: '✕', onclick: () => { selected = null; renderCard(); } });
  const gr = sim.growRatio(f);
  card.replaceChildren(
    el('div', { class: 'c-head' },
      el('div', { class: 'c-name', text: sp.name || '' }),
      el('span', { class: 'c-stage', text: B.LABELS.stage[f.stage] }),
      close),
    faceRow('けんこう', 'health', f.health),
    faceRow('ごきげん', 'mood', f.mood),
    el('div', { class: 'c-row' }, el('span', { class: 'c-lb', text: 'なつき' }), heartEl),
    faceRow('なかよし', 'nakayoshi', nk),
    f.stage < 2
      ? el('div', { class: 'c-row' }, el('span', { class: 'c-lb', text: 'そだち' }), el('div', { class: 'c-grow' }, el('i', { style: { width: Math.max(4, gr * 100) + '%' } })))
      : null,
    el('div', { class: 'c-msg', text: cardMessage(f, sp) }),
  );
  card.hidden = false;
}

function cardMessage(f, sp) {
  const B = G.sim.balance();
  if (f.health < B.HEALTH.weak) return G.sim.text('weakPrefix', sp.name || '');
  if (f.onaka < 30) return 'おなかが すいているよ';
  if (f.stage === 0) return 'おとなに なるのが たのしみだね';
  if (f.stage === 1) return 'ビッグに なるのが たのしみだね';
  if (f.mood >= B.MOOD.happy) return 'この すいそうが だいすき！';
  return sp.hint || '';
}

// ---------- ヒント ----------
function renderHint(force) {
  const box = $('#hint');
  const mini = $('#hint-mini');
  if (G.tutorialBusy?.()) { box.hidden = true; mini.hidden = true; glow(null); return; }
  const h = G.sim.currentHint(G.state, G.tank());
  if (h) {
    const fresh = !hint || hint.key !== h.key;
    hint = h; happyUntil = 0;
    if (fresh || force) hintOpenUntil = performance.now() + HINT_OPEN_MS;
    const open = performance.now() < hintOpenUntil;
    mini.hidden = open;
    box.replaceChildren(el('span', { class: 'hint-ic', text: h.kind === 'recovering' ? '🌱' : '💡' }), el('span', { class: 'hint-t', text: h.text }), el('button', { class: 'hint-x', 'aria-label': 'とじる', text: '✕' }));
    box.hidden = !open;
    glow(h.action);
    return;
  }
  hint = null; glow(null); mini.hidden = true;
  // ぜんぶ よいときは ときどき ほめる ひとこと（8びょう）
  const t = G.tank(), now = performance.now();
  if (t.fish.length && G.data.HAPPY_LINES.length && (force || now - happyLineAt > 60000) && now > happyUntil) {
    happyLineAt = now;
    const f = t.fish[Math.floor(Math.random() * t.fish.length)];
    const line = G.data.HAPPY_LINES[Math.floor(Math.random() * G.data.HAPPY_LINES.length)];
    box.replaceChildren(el('span', { class: 'hint-ic', text: '🌟' }), el('span', { class: 'hint-t', text: line.replaceAll('{name}', G.data.fishById[f.speciesId]?.name || '') }), el('button', { class: 'hint-x', 'aria-label': 'とじる', text: '✕' }));
    box.hidden = false;
    happyUntil = now + 8000;
  } else if (!happyUntil) box.hidden = true;
}

function renderEmpty() {
  const t = G.tank();
  const m = $('#tank-empty');
  if (t.fish.length || G.screen !== 'tank' || G.tutorialBusy?.() || G.sim.currentHint(G.state, t)) { m.hidden = true; return; }
  m.replaceChildren(el('div', { text: 'まだ さかなが いないよ' }), el('button', { class: 'btn primary', text: '🛒 おみせへ', style: { marginTop: '8px' }, onclick: () => G.go('shop', { tab: 'fish' }) }));
  m.hidden = false;
}

// ---------- できごと ----------
function onSimEvent(ev) {
  const t = G.tank();
  // ほかの 水槽の 魚の できごとも ある（なまえは ぜんぶの 水槽から さがす）
  const f = ev.uid && G.state.tanks.flatMap((x) => x.fish).find((x) => x.uid === ev.uid);
  const name = (f && G.data.fishById[f.speciesId]?.name) || '';
  const visible = G.screen === 'tank' && aq && !!t.fish.find((x) => x.uid === ev.uid);
  if (ev.type === 'thanks') {
    if (visible) {
      aq.react(ev.uid, 'thanks');
      const p = aq.screenPosOf(ev.uid);
      if (p) popAt(p.x, p.y - 20, `ありがとう！ +${ev.coin} <span class="coin-ic sm"></span>`);
    } else toast(`${name}から ありがとう！ +${ev.coin}`, 'gold');
    bumpCoins();
  } else if (ev.type === 'react') {
    if (visible) aq.react(ev.uid, ev.kind);
  } else if (ev.type === 'grow') {
    toast(`${name}が おおきく なったよ！`, 'gold');
    syncFish();
    G.queueReact(ev.uid, 'jump');
    G.queueReact(ev.uid, 'happy', 1000);
    if (visible) renderCard();
  } else if (ev.type === 'weak') {
    if (visible) aq.react(ev.uid, 'sleepy');
    if (G.screen === 'tank') renderHint();
  } else if (ev.type === 'recover') {
    toast(G.sim.text('recovered', name));
    G.queueReact(ev.uid, 'happy');
    if (G.screen === 'tank') renderHint();
  } else if (ev.type === 'thermoReset') {
    const tk = G.state.tanks.find((x) => x.id === ev.tankId);
    const out = tk?.fish[tk.fish.length - 1];
    toast(G.sim.data().THERMO_LINES.reset?.replaceAll('{name}', G.data.fishById[out?.speciesId]?.name || '') || 'おんどを ふつうに もどしたよ');
  } else if (ev.type === 'autoFeed') {
    // じどう えさやり：見ている 水槽なら 3D の きかいから 粒を おとす（見た目だけ。数値は sim で もう 足した）
    if (G.screen === 'tank' && aq && ev.tankId === t.id) aq.autoFeed?.({ kind: 'flake' });
  } else if (ev.type === 'newDay') {
    toast(`${ev.day}にちめの あさ だよ`);
  }
}
