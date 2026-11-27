// v0.10 レース係：レースの 画面（えらぶ → むずかしさ → レース → けっか）と へやの「レース」ボタン。
// うごき・コース・コンピューターは js/race/*（DOM なし）、3D は js/race/scene.js。
// そうさ：ひだりの スティック（まがる）、みぎの「ダッシュ」（おしている あいだ）と「ジャンプ」。マルチタッチ・マウス・キーボード（←→・↑ か Shift で ダッシュ・スペースで ジャンプ）。
import { $, el, toast, bumpCoins, dialog } from './common.js';
import { createRace } from '../race/race.js';
import { LEVELS, LEVEL_NAME, COURSES, obstaclesAhead } from '../race/course.js';

let G = null;
let view = 'select';
let pickUid = null, level = 'easy';
let R = null, S3 = null, raf = 0, lastT = 0, fishList = [];
let input = { steer: 0, dash: false, jump: false };
let keys = {};
let resultTimer = 0, goalAt = 0, clockStopped = false;
let hintShown = {};

const FACE = { good: '😊', ok: '😐', bad: '😟' };
const COLOR = { speed: '#3a9be0', accel: '#f0a020', stamina: '#3fb37a', turn: '#9a6fe0', jump: '#e0668a', power: '#d9603a' };
const NAMES = { speed: 'はやさ', accel: 'かそく', stamina: 'スタミナ', turn: 'まがり', jump: 'ジャンプ', power: 'パワー' };
const ICONS = { speed: '💨', accel: '⚡', stamina: '🔋', turn: '🌀', jump: '🦘', power: '💪' };
const KEYS = ['speed', 'accel', 'stamina', 'turn', 'jump', 'power'];
const heartIc = () => el('span', { class: 'heart-ic sm', 'aria-hidden': 'true' });
const coinIc = () => el('span', { class: 'coin-ic sm', 'aria-hidden': 'true' });

export function init(g) {
  G = g;
  const sec = el('section', { id: 'scr-race', class: 'screen', 'data-screen': 'race', hidden: true },
    el('div', { id: 'race-body' }));
  $('#app').append(sec);
  G.addScreen('race', { show, hide }, { sheet: false });
  // へやの ボタン（ぼうけんの 上）
  const b = el('button', { id: 'btn-race', 'aria-label': 'レース' },
    el('span', { class: 'rb-ic', text: '🏁' }), el('span', { class: 'rb-lb', text: 'レース' }));
  b.addEventListener('click', () => G.go('race'));
  $('#scr-room').append(b);
  const nav = () => { b.hidden = !G.state.tutorial.done; };
  nav();
  G.on('screen', nav);
  G.on('tutorialDone', nav);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', resetInput);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') resetInput(); });
  G.race = { get R() { return R; }, auto: false, debug: {} };   // 確認用（playtest）
}

const api = () => G.sim.race;
const reward = () => G.sim.raceReward;

function show(g, opts = {}) {
  hintShown = {};
  if (opts.level) level = opts.level;
  renderSelect();
}
function hide() { stopRace(); document.body.classList.remove('race-play'); }

// ---------------- えらぶ ----------------
function allFish() {
  const out = [];
  for (const t of G.state.tanks) for (const f of t.fish) out.push({ f, t });
  return out;
}
function canOf(f) {
  const A = api();
  const r = A?.canRace ? A.canRace(f) : { ok: false, reason: 'none' };
  return r;
}
function reasonText(r) {
  if (r.ok) return '';
  return r.text || api()?.REASON_TEXT?.[r.reason] || 'いまは でられないよ';
}
function picOf(f) { const sp = G.data.fishById[f.speciesId] || {}; return f.dream?.art || sp.texture || ''; }

function renderSelect() {
  view = 'select';
  document.body.classList.remove('race-play');
  const body = $('#race-body');
  body.className = 'rc-select';
  const list = allFish().filter(({ f }) => G.data.fishById[f.speciesId]?.kind !== 'snail' || true);
  // でられる 魚を さきに
  list.sort((a, b) => (canOf(b.f).ok - canOf(a.f).ok));
  if (!pickUid || !list.some((x) => x.f.uid === pickUid && canOf(x.f).ok)) pickUid = list.find((x) => canOf(x.f).ok)?.f.uid || null;
  const grid = el('div', { class: 'rc-fish grid' }, ...list.map(({ f }) => {
    const ok = canOf(f).ok;
    const cond = api()?.conditionOf ? api().conditionWord(api().conditionOf(f)) : { lvl: 'ok' };
    return el('button', { class: 'rc-fcard' + (ok ? '' : ' no') + (f.uid === pickUid ? ' on' : ''), 'data-uid': f.uid, onclick: () => { pickUid = f.uid; renderSelect(); } },
      el('span', { class: 'rc-fpic' }, el('img', { src: picOf(f), alt: '', draggable: 'false', onerror: (e) => { e.target.replaceWith(el('span', { text: '🐟' })); } })),
      el('span', { class: 'rc-fname', text: G.sim.nameOf(f) }),
      ok ? el('span', { class: 'rc-fface', text: FACE[cond.lvl] || '😐' }) : el('span', { class: 'rc-fno', text: '✕' }));
  }));
  const head = el('div', { class: 'rc-head' }, el('h2', { text: '🏁 レース' }), el('span', { class: 'rc-sub', text: 'どの さかなで でる？' }));
  if (!list.length) {
    body.replaceChildren(head, el('div', { class: 'rc-empty' }, el('div', { class: 'big', text: '🐟' }), el('div', { text: 'すいそうに さかなが いないよ。おみせで さかなを むかえよう' }),
      el('button', { class: 'btn primary', text: '🛒 おみせへ', onclick: () => G.go('shop', { tab: 'fish' }) })));
    return;
  }
  const pick = list.find((x) => x.f.uid === pickUid) || list[0];
  body.replaceChildren(head, el('div', { class: 'rc-wrap' }, grid, detail(pick.f)));
}

function detail(f) {
  const A = api();
  const r = canOf(f);
  const st = A?.statsOf ? A.statsOf(G.state, f) : Object.fromEntries(KEYS.map((k) => [k, 0]));
  const eff = A?.effectiveStats ? A.effectiveStats(G.state, f) : st;
  const c = A?.conditionOf ? A.conditionOf(f) : 1;
  const cw = A?.conditionWord ? A.conditionWord(c) : { lvl: 'good', word: 'ばっちり' };
  const tk = A?.tokuiOf ? A.tokuiOf(f) : null;
  const sel = el('div', { class: 'rc-detail' },
    el('div', { class: 'rc-dtop' },
      el('img', { class: 'rc-dpic', src: picOf(f), alt: '', draggable: 'false' }),
      el('div', { class: 'rc-dname' }, el('b', { text: G.sim.nameOf(f) }), tk ? el('small', { class: 'rc-tokui', text: tk.word || ('とくい：' + tk.name) }) : null)),
    el('div', { class: 'rc-bars' }, ...KEYS.map((k) => el('div', { class: 'rc-bar' + (tk?.key === k ? ' tokui' : '') },
      el('span', { class: 'rc-bic', text: A?.STAT_ICONS?.[k] || ICONS[k], 'aria-hidden': 'true' }),
      el('span', { class: 'rc-bnm', text: A?.STAT_NAMES?.[k] || NAMES[k] }),
      el('span', { class: 'rc-btrack' }, el('i', { class: 'base', style: { width: Math.max(2, st[k]) + '%', background: COLOR[k] } }), el('i', { class: 'eff', style: { width: Math.max(2, eff[k]) + '%', background: COLOR[k] } })),
      el('b', { class: 'rc-bnum', text: String(eff[k]) })))),
    el('div', { class: 'rc-cond', 'data-lvl': cw.lvl },
      el('span', { text: 'ちょうし ' }), el('span', { class: 'rc-face', text: FACE[cw.lvl] }), el('b', { text: cw.word }),
      el('span', { class: 'rc-onaka', text: `　おなか ${Math.round(f.onaka)}` })),
    r.ok ? el('button', { class: 'btn primary rc-go', text: 'この こで でる ▶', onclick: () => renderLevel() })
      : el('div', { class: 'rc-why', text: reasonText(r) }));
  return sel;
}

// ---------------- むずかしさ ----------------
function renderLevel() {
  view = 'level';
  const f = findFish(pickUid);
  if (!f) { renderSelect(); return; }
  const RW = reward();
  const body = $('#race-body');
  body.className = 'rc-level';
  const cards = LEVELS.map((lv) => {
    const open = RW?.levelOpen ? RW.levelOpen(G.state, lv) : lv === 'easy';
    const p1 = RW?.prizeOf ? RW.prizeOf(lv, 1, G.state) : { hearts: 5, coins: 0, first: 0 };
    const best = RW?.raceData ? RW.raceData(G.state).best[lv] : null;
    const cleared = RW?.raceData ? RW.raceData(G.state).cleared[lv] : false;
    const prev = LEVEL_NAME[LEVELS[LEVELS.indexOf(lv) - 1]];
    return el('button', { class: 'rc-lv ' + lv + (open ? '' : ' locked'), 'data-lv': lv, onclick: () => { if (!open) { toast(`${prev}で 1いに なったら あくよ`); return; } level = lv; startRace(); } },
      el('span', { class: 'rc-lvname', text: LEVEL_NAME[lv] }),
      el('span', { class: 'rc-lvcourse', text: COURSES[lv].name }),
      el('span', { class: 'rc-lvstars', text: '⭐'.repeat(LEVELS.indexOf(lv) + 1) }),
      open ? el('span', { class: 'rc-lvprize' }, '1い ', heartIc(), String(p1.hearts), ' ', coinIc(), String(p1.coins), p1.first ? el('small', { text: ` ＋はじめて ${p1.first}` }) : null)
        : el('span', { class: 'rc-lvlock', text: `🔒 ${prev}で 1いに なったら あくよ` }),
      cleared ? el('span', { class: 'rc-lvmedal', text: '🏅' }) : null,
      best ? el('span', { class: 'rc-lvbest', text: `ベスト ${best}びょう` }) : null);
  });
  body.replaceChildren(
    el('div', { class: 'rc-head' }, el('button', { class: 'btn soft rc-backbtn', text: '◀ さかなを えらぶ', onclick: renderSelect }),
      el('span', { class: 'rc-sub' }, el('img', { class: 'rc-mini', src: picOf(f), alt: '' }), `${G.sim.nameOf(f)}で でる！ むずかしさを えらんでね`)),
    el('div', { class: 'rc-lvs' }, ...cards),
    el('div', { class: 'rc-tip', text: '2い は ハート3こ、3い は 2こ。まけても また ちょうせん できるよ' }));
}

function findFish(uid) { for (const t of G.state.tanks) { const f = t.fish.find((x) => x.uid === uid); if (f) return f; } return null; }

// ---------------- レース ----------------
function startRace() {
  const f = findFish(pickUid);
  const A = api();
  if (!f || !canOf(f).ok) { toast('この こは いま でられないよ'); renderSelect(); return; }
  stopRace();
  view = 'play';
  const seed = (Date.now() & 0xffff) + 1;
  let rs = seed;
  const rnd = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };
  const me = { id: 'me', stats: A.effectiveStats(G.state, f), speciesId: f.speciesId, dream: f.dream || null, name: G.sim.nameOf(f) };
  const used = new Set([f.speciesId]);
  const cpus = [1, 2, 3].map((i) => {
    let c = A.cpuStats(level, rnd);
    for (let k = 0; k < 4 && used.has(c.speciesId); k++) c = A.cpuStats(level, rnd);   // おなじ しゅるいが ならびすぎない
    used.add(c.speciesId);
    return { id: 'cpu' + i, stats: c.stats, speciesId: c.speciesId, name: G.data.fishById[c.speciesId]?.name || 'さかな' };
  });
  fishList = [me, ...cpus];
  R = createRace({ level, player: me, cpus, seed });
  const body = $('#race-body');
  body.className = 'rc-play';
  const canvas = el('canvas', { id: 'race-cv' });
  body.replaceChildren(canvas, hud(), controls());
  document.body.classList.add('race-play');
  if (G.clock && !clockStopped) { G.clock.stop(); clockStopped = true; }   // レースの あいだは そだちの 時計を とめる（Codex）
  import('../race/scene.js').then(({ createRaceScene }) => {
    if (!R || view !== 'play') return;
    try {
      S3 = createRaceScene(canvas, R, { fishList, speciesById: G.data.fishById });
    } catch (e) { console.error(e); toast('ごめんね、レースが ひらけなかったよ'); renderSelect(); return; }
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
    setTimeout(() => { if (R && R.phase === 'count') pop('▼ と きいろい わ が きみの さかな だよ', 'me', 2200); }, 300);
  });
  G.emit('action', { type: 'raceStart', level });
}

function stopRace() {
  cancelAnimationFrame(raf); raf = 0;
  clearTimeout(resultTimer);
  if (S3) { S3.dispose(); S3 = null; }
  R = null; goalAt = 0;
  resetInput();
  if (clockStopped && G?.clock) { G.clock.start(); clockStopped = false; }
}

function hud() {
  return el('div', { class: 'rc-hud' },
    el('div', { class: 'rc-lap' }, el('b', { id: 'rc-lap-n', text: '1' }), el('span', { id: 'rc-lap-t', text: `／${COURSES[level].laps}しゅう` })),
    el('div', { class: 'rc-rank' }, el('b', { id: 'rc-rank-n', text: '4' }), el('span', { text: 'い' })),
    el('div', { class: 'rc-prog', id: 'rc-prog' }, ...fishList.map((x) => el('i', { 'data-id': x.id, class: x.id === 'me' ? 'me' : '' }))),
    el('button', { class: 'rc-quit', 'aria-label': 'やめる', onclick: onQuit }, el('span', { text: '⏸' }), el('span', { class: 'lb', text: 'やめる' })),
    el('div', { class: 'rc-count', id: 'rc-count', text: '3' }),
    el('div', { class: 'rc-pop', id: 'rc-pop', hidden: true }));
}

async function onQuit() {
  if (!R) return;
  const was = R.phase;
  R.paused = true;
  const v = await dialog([el('div', { class: 'big', text: 'レースを やめる？' }), el('div', { text: 'やめると ごほうびは もらえないよ（おなかも へらないよ）' })],
    [{ label: 'つづける', value: false, kind: 'primary' }, { label: 'やめる', value: true, kind: 'soft' }], { cancelValue: false });
  if (!R) return;
  R.paused = false;
  lastT = performance.now();
  if (v) { stopRace(); renderSelect(); }
  else if (was !== R.phase) { /* なし */ }
}

// ---------------- そうさ ----------------
let stickId = null, stickC = null, dashId = null;
function controls() {
  const knob = el('div', { class: 'rc-knob' });
  const base = el('div', { class: 'rc-stick' }, el('div', { class: 'rc-stick-ring' }), el('span', { class: 'rc-arr l', text: '◀' }), el('span', { class: 'rc-arr r', text: '▶' }), knob);
  const zone = el('div', { class: 'rc-zone' }, base);
  const dash = el('button', { class: 'rc-dash', 'aria-label': 'ダッシュ' }, el('span', { class: 'rc-gauge' }), el('span', { class: 'rc-btn-in' }, el('span', { class: 'ic', text: '💨' }), el('span', { class: 'lb', text: 'ダッシュ' })));
  const jump = el('button', { class: 'rc-jump', 'aria-label': 'ジャンプ' }, el('span', { class: 'rc-btn-in' }, el('span', { class: 'ic', text: '⤴' }), el('span', { class: 'lb', text: 'ジャンプ' })));
  const moveStick = (e) => {
    if (!stickC) return;
    const rad = base.offsetWidth * 0.42;
    let dx = e.clientX - stickC.x, dy = e.clientY - stickC.y;
    const d = Math.hypot(dx, dy);
    if (d > rad) { dx *= rad / d; dy *= rad / d; }
    input.steer = Math.abs(dx / rad) < 0.12 ? 0 : dx / rad;
    knob.style.transform = `translate(${dx}px, ${dy * 0.6}px)`;
    base.style.setProperty('--tilt', (dx / rad * 18).toFixed(1) + 'deg');
  };
  zone.addEventListener('pointerdown', (e) => {
    if (stickId != null) return;
    stickId = e.pointerId;
    zone.setPointerCapture?.(e.pointerId);
    const br = base.getBoundingClientRect();
    const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
    // とおくを さわったら そこを まんなかに（すこし うごかす）
    if (Math.hypot(e.clientX - cx, e.clientY - cy) > br.width * 0.7) {
      stickC = { x: e.clientX, y: e.clientY };
      base.style.translate = `${e.clientX - cx}px ${e.clientY - cy}px`;
    } else stickC = { x: cx, y: cy };
    base.classList.add('on');
    moveStick(e);
    e.preventDefault();
  });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
  const endStick = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null; stickC = null; input.steer = 0;
    knob.style.transform = ''; base.style.translate = ''; base.style.setProperty('--tilt', '0deg');
    base.classList.remove('on');
  };
  zone.addEventListener('pointerup', endStick);
  zone.addEventListener('pointercancel', endStick);
  zone.addEventListener('lostpointercapture', endStick);
  dash.addEventListener('pointerdown', (e) => { dashId = e.pointerId; dash.setPointerCapture?.(e.pointerId); input.dash = true; dash.classList.add('on'); e.preventDefault(); });
  const endDash = (e) => { if (e.pointerId !== dashId) return; dashId = null; input.dash = false; dash.classList.remove('on'); };
  dash.addEventListener('pointerup', endDash);
  dash.addEventListener('pointercancel', endDash);
  dash.addEventListener('lostpointercapture', endDash);
  jump.addEventListener('pointerdown', (e) => { input.jump = true; jump.classList.add('on'); setTimeout(() => jump.classList.remove('on'), 150); e.preventDefault(); });
  return el('div', { class: 'rc-ctrl' }, zone, el('div', { class: 'rc-btns' }, jump, dash));
}
function resetInput() {
  input = { steer: 0, dash: false, jump: false }; keys = {}; stickId = null; stickC = null; dashId = null;
  document.querySelectorAll('.rc-dash.on').forEach((b) => b.classList.remove('on'));
}
function onKey(e) {
  if (view !== 'play' || G.screen !== 'race') return;
  const down = e.type === 'keydown';
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Shift', 'x', 'X', 'z', 'Z'].includes(k)) e.preventDefault();
  if (k === ' ' || k === 'z' || k === 'Z') { if (down && !keys.jump) input.jump = true; keys.jump = down; return; }
  if (k === 'ArrowUp' || k === 'Shift' || k === 'x' || k === 'X') { keys.dash = down; return; }
  if (k === 'ArrowLeft') keys.left = down;
  if (k === 'ArrowRight') keys.right = down;
}

// ---------------- まわす ----------------
function loop(now) {
  raf = requestAnimationFrame(loop);
  if (!R || !S3) return;
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  if (!R.paused) {
    // キーボード（スティックを さわって いない とき）
    const kSteer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const inp = { steer: stickId != null ? input.steer : kSteer, dash: input.dash || !!keys.dash, jump: input.jump, auto: !!G.race.auto, waitAll: false };
    input.jump = false;
    // こまかく わけて すすめる（はやい ときも いわを すりぬけない）
    const n = Math.max(1, Math.ceil(dt / (1 / 60)));
    for (let i = 0; i < n; i++) {
      const evs = R.update(dt / n, i === 0 ? inp : { ...inp, jump: false });
      for (const ev of evs) onEvent(ev);
      if (!R) return;
    }
    if (R.phase === 'done' && !goalAt) goalAt = now;
  }
  S3.render(dt);
  updateHud();
}

function onEvent(ev) {
  S3?.onEvent(ev);
  const cnt = $('#rc-count');
  if (ev.type === 'count' && cnt) { cnt.textContent = String(ev.n); cnt.classList.remove('pulse'); void cnt.offsetWidth; cnt.classList.add('pulse'); }
  if (ev.type === 'go' && cnt) { cnt.textContent = 'スタート！'; cnt.classList.add('go'); setTimeout(() => { if (cnt) cnt.hidden = true; }, 700); }
  if (ev.type === 'done') {
    const me = R.player;
    const rank = ev.rank || R.rankOf(me);
    clearTimeout(resultTimer);
    resultTimer = setTimeout(() => finishRace(rank, me.finishTime || R?.time || 0), 1600);
    return;
  }
  if (!ev.player) return;
  if (ev.type === 'rock') pop('ごつん！ いわは ジャンプ！', 'bad');
  if (ev.type === 'ring') pop('あわの わ！ びゅーん', 'good');
  if (ev.type === 'over') pop('ジャンプ せいこう！', 'good');
  if (ev.type === 'lap') pop(R.player.lap === R.course.laps - 1 ? 'さいごの 1しゅう！' : `${R.player.lap + 1}しゅうめ`, 'lap');
  if (ev.type === 'finish') { pop('ゴール！', 'goal'); }
}

let popTimer = 0;
function pop(text, kind, ms) {
  const p = $('#rc-pop');
  if (!p) return;
  p.textContent = text; p.className = 'rc-pop pk-' + kind; p.hidden = false;
  clearTimeout(popTimer);
  popTimer = setTimeout(() => { p.hidden = true; }, ms || (kind === 'lap' ? 1400 : 900));
}

let hudKey = '';
function updateHud() {
  if (!R) return;
  const me = R.player;
  const lap = Math.min(R.course.laps, me.lap + 1);
  const rank = R.rankOf(me);
  const key = lap + '|' + rank;
  if (key !== hudKey) {
    hudKey = key;
    const ln = $('#rc-lap-n'); if (ln) ln.textContent = String(lap);
    const rn = $('#rc-rank-n'); if (rn) { rn.textContent = String(rank); rn.parentElement.dataset.rank = String(rank); }
  }
  // すすみぐあい（ぜんたいの きょり）
  for (const r of R.racers) {
    const d = document.querySelector(`#rc-prog i[data-id="${r.id}"]`);
    if (d) d.style.left = (Math.min(1, Math.max(0, r.s / R.course.total)) * 100).toFixed(2) + '%';
  }
  const g = document.querySelector('.rc-dash');
  if (g) {
    g.style.setProperty('--g', (me.dash / me.d.dashCap * 360).toFixed(0) + 'deg');
    g.classList.toggle('empty', me.dash < 0.05);
    g.classList.toggle('dashing', me.dashing);
    g.classList.toggle('full', me.dash >= me.d.dashCap - 0.01);
    document.getElementById('race-body')?.classList.toggle('fast', me.dashing || me.boost > 0);
  }
  // いわが ちかい：ジャンプの おしらせ（かんたんは いつも、ほかは 1しゅうめ だけ）
  if (R.phase === 'run' && !me.finished && (level === 'easy' || me.lap === 0)) {
    const near = obstaclesAhead(R.course, me.s, 9).find(({ o, dist }) => o.kind === 'rock' && dist > 2 && Math.abs(me.lat - o.lat) < o.w + 0.9);
    const jb = document.querySelector('.rc-jump');
    if (jb) jb.classList.toggle('hint', !!near && !me.air);
    if (near && !hintShown[near.o.s] && !me.air) { hintShown[near.o.s] = 1; pop('いわ だ！ ジャンプ！', 'hint'); }
  } else document.querySelector('.rc-jump')?.classList.remove('hint');
}

// ---------------- けっか ----------------
function finishRace(rank, time) {
  if (!R) return;
  const order = R.standings();
  const names = order.map((r) => ({ id: r.id, name: fishList.find((x) => x.id === r.id)?.name || '', me: r.isPlayer, sp: fishList.find((x) => x.id === r.id) }));
  const f = findFish(pickUid);
  const res = f ? reward().finish(G.state, pickUid, level, rank, { time }) : { ok: false };
  cancelAnimationFrame(raf); raf = 0;
  if (S3) { S3.dispose(); S3 = null; }
  R = null;
  if (clockStopped && G.clock) { G.clock.start(); clockStopped = false; }
  document.body.classList.remove('race-play');
  if (res.ok) {
    if (res.coins || res.first) bumpCoins();
    G.refreshHud(); G.markDirty(); G.saveNow();
    G.emit('changed');
    G.handleEvents(res.events);
    G.emit('action', { type: 'race', level, rank });
  }
  view = 'result';
  const name = f ? G.sim.nameOf(f) : '';
  const words = ['やったね！ 1い！', 'すごい！ 2い！', 'よく がんばったね！ 3い！', 'つぎは がんばろう！'];
  const body = $('#race-body');
  body.className = 'rc-result';
  const medal = ['🥇', '🥈', '🥉', '🐟'][rank - 1];
  body.replaceChildren(el('div', { class: 'rc-res r' + rank },
    el('div', { class: 'rc-rleft' },
      el('div', { class: 'rc-rmedal', text: medal }),
      el('div', { class: 'rc-rword', text: words[rank - 1] }),
      el('div', { class: 'rc-rlist' }, ...names.map((x, i) => el('div', { class: 'rc-rrow' + (x.me ? ' me' : '') },
        el('b', { text: `${i + 1}い` }),
        el('img', { src: x.sp?.dream?.art || G.data.fishById[x.sp?.speciesId]?.texture || '', alt: '' }),
        el('span', { text: x.me ? `${x.name}（きみ）` : x.name }))))),
    el('div', { class: 'rc-rright' },
      res.ok && res.hearts ? el('div', { class: 'rc-rprize' }, `${name}から `, heartIc(), el('b', { text: `＋${res.hearts}` })) : null,
      res.ok && res.coins ? el('div', { class: 'rc-rprize' }, coinIc(), el('b', { text: `＋${res.coins}` }), ' コイン') : null,
      res.ok && res.first ? el('div', { class: 'rc-rprize first' }, '🏅 はじめての 1い！ ', coinIc(), el('b', { text: `＋${res.first}` })) : null,
      res.ok && res.unlocked ? el('div', { class: 'rc-rnew', text: `🎉「${LEVEL_NAME[res.unlocked]}」が ひらいたよ！` }) : null,
      res.ok && res.best ? el('div', { class: 'rc-rbest', text: `🌟 ベスト きろく ${Math.round(time * 10) / 10}びょう` }) : null,
      rank === 4 ? el('div', { class: 'rc-rtip', text: 'ダッシュや あわの わを つかうと はやく なるよ' }) : null,
      el('div', { class: 'rc-rbtns' },
        el('button', { class: 'btn primary', text: '🔁 もう いっかい', onclick: () => { const ff = findFish(pickUid); if (ff && canOf(ff).ok) startRace(); else { toast(reasonText(ff ? canOf(ff) : { ok: false })); renderSelect(); } } }),
        res.ok && res.unlocked ? el('button', { class: 'btn primary', text: `つぎの レース（${LEVEL_NAME[res.unlocked]}）▶`, onclick: () => { level = res.unlocked; const ff = findFish(pickUid); if (ff && canOf(ff).ok) startRace(); else renderSelect(); } }) : null,
        el('button', { class: 'btn soft', text: '🐟 ほかの さかな', onclick: renderSelect }),
        el('button', { class: 'btn soft', text: '🏠 へやへ', onclick: () => G.go('room') })))));
}
