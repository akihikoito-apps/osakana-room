// すいそう画面：3D水槽・ゲージ・お世話ボタン・魚のカード・ヒント。
import { createAquarium } from '../aquarium/index.js';
import { $, $$, el, toast, popAt, bumpCoins } from './common.js';
import { lightOf } from '../state.js';

let G = null;
let aq = null;
let selected = null;          // カードを出している魚の uid
let tagUid = null, tagTimer = 0, tagEl = null;
let busy = {};                // ボタンの 連打よけ（実時間）
let feedTimer = 0;
let hint = null, happyLineAt = 0, happyUntil = 0, hintOpenUntil = 0;
const HINT_OPEN_MS = 10000;
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

function ensureAq() {
  if (aq) return aq;
  const t = G.tank();
  aq = createAquarium($('#aq'), { water: t.water, species: G.data.FISH });
  G.aq = aq;
  aq.on('tapFish', ({ uid }) => onTapFish(uid));
  aq.on('eat', ({ uid }) => onEat(uid));
  // 魚の いない ところを タップしたら カードを とじる（見回しの ドラッグは のぞく）
  let downAt = null;
  $('#aq').addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; justTapped = false; });
  $('#aq').addEventListener('pointerup', (e) => {
    const moved = !downAt || Math.abs(e.clientX - downAt.x) + Math.abs(e.clientY - downAt.y) > 10;
    setTimeout(() => { if (!moved && !justTapped && selected) { selected = null; renderCard(); } justTapped = false; }, 0);
  });
  syncDecor(); syncWater(); syncFish();
  return aq;
}
let justTapped = false;

export function show(g) {
  G = g;
  ensureAq();
  syncFish(); syncDecor(); syncWater();
  aq.start();
  renderGauges(); renderCareState(); renderCard(); renderHint(true); renderEmpty();
  // 見えていない ときに たまった リアクション
  const list = pending.splice(0);
  list.forEach(([uid, kind, delay], i) => setTimeout(() => aq?.react(uid, kind), 600 + i * 250 + delay));
}
export function hide() {
  aq?.stop();
  if (feedTimer) { clearTimeout(feedTimer); feedTimer = 0; G.handleEvents(G.sim.feedEnd(G.state)?.events); }
}

// ---------- 3D と データを あわせる ----------
function syncFish() {
  aq?.setFish(G.tank().fish.map((f) => ({ uid: f.uid, speciesId: f.speciesId, stage: f.stage, health: f.health, happy: f.mood })));
}
function syncDecor() { aq?.setDecor(G.tank().decor.slice()); }
function syncWater() {
  if (!aq) return;
  const t = G.tank();
  const base = t.decor.includes('light') ? (G.data.itemById.light?.effect?.light ?? 1) : 0.6;
  // よるは すこし くらく（まっくらには しない）
  const day = lightOf(G.state.clock.min);
  const light = base * (0.55 + 0.45 * (day - 0.45) / 0.55);
  aq.setWater({ dirt: (100 - t.clean) / 100, light: Math.max(0.3, Math.min(1, light)), bubbles: t.decor.includes('air_pump') });
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
  fb.classList.toggle('cool', !sim.ownsTool(s, 'food_flake') || sim.feedBusy());
  wb.classList.toggle('cool', !sim.ownsTool(s, 'water_change'));
  cb.classList.toggle('cool', !(t.leftover > 0));
  const show = G.tutorialShows || (() => true);
  fb.hidden = !show('feed'); wb.hidden = !show('water'); cb.hidden = !show('clean'); btn('photo').hidden = !show('photo');
}

/** ヒントの action の ボタンを ゆっくり 光らせる */
function glow(action) {
  $$('.hint-glow').forEach((e) => e.classList.remove('hint-glow'));
  const map = { feed: '#care [data-care="feed"]', water_change: '#care [data-care="water"]', scoop: '#care [data-care="clean"]', shop: '#btn-menu' };
  const e = action && map[action] && $(map[action]);
  if (e) e.classList.add('hint-glow');
}

function onCare(kind, b) {
  const now = performance.now();
  if (busy[kind] && now < busy[kind]) return;
  const s = G.state, t = G.tank(), sim = G.sim;
  if (kind === 'photo') { G.emit('photo'); return; }
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
    const r = sim.scoop(s, t);
    if (!r.ok) { toast('たべのこしは ないよ。ピカピカ！'); return; }
    busy.clean = now + 1200;
    toast('たべのこしを すくったよ');
    G.emit('action', { type: 'scoop', result: r });
    G.handleEvents(r.events);
  }
  G.markDirty(); G.saveNow();
  G.emit('changed');
  G.refreshHud();
}

function onEat(uid) {
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
  const r = G.sim.pet(G.state, uid, Date.now());
  if (r.ok && r.react) {
    aq.react(uid, r.react);
    G.emit('action', { type: 'pet', uid });
    G.handleEvents(r.events);
    G.markDirty();
  }
  selected = uid;
  showTag(uid);
  renderCard();
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
  const h = G.sim.currentHint(G.state);
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
  if (t.fish.length || G.screen !== 'tank' || G.tutorialBusy?.()) { m.hidden = true; return; }
  m.replaceChildren(el('div', { text: 'まだ さかなが いないよ' }), el('button', { class: 'btn primary', text: '🛒 おみせへ', style: { marginTop: '8px' }, onclick: () => G.go('shop', { tab: 'fish' }) }));
  m.hidden = false;
}

// ---------- できごと ----------
function onSimEvent(ev) {
  const t = G.tank();
  const f = ev.uid && t.fish.find((x) => x.uid === ev.uid);
  const name = (f && G.data.fishById[f.speciesId]?.name) || '';
  const visible = G.screen === 'tank' && aq;
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
  } else if (ev.type === 'newDay') {
    toast(`${ev.day}にちめの あさ だよ`);
  }
}
