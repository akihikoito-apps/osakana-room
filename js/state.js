// セーブ・時計・コイン（部屋・ゲーム係）。
// - セーブは localStorage 'osakana-room-save-v1'。壊れていても落ちずに新しいデータで始める。
// - 版の違うセーブは migrate() で読み替える（save.v を見て順に上げる）。
// - 時計はアプリを開いている間だけ進む。hidden の間は止め、閉じていた間は取り戻さない。
//   ゲームの1日 ＝ 現実 600 秒（1ゲーム分 ＝ 0.4167 秒）。
export const SAVE_KEY = 'osakana-room-save-v1';
export const SAVE_VERSION = 2;   // 2：水槽を いくつも もてる（slot・name）・ハート・かいほう
export const REAL_SEC_PER_GAME_DAY = 600;
export const MIN_PER_DAY = 1440;
export const START_MINUTE = 6 * 60;          // 1にちめ の あさ 6:00 から（balance.js TIME.dayStartHour が あれば そちら）

let uidSeq = 0;
export function newUid(prefix = 'f') {
  uidSeq = (uidSeq + 1) % 1000;
  return prefix + Date.now().toString(36) + uidSeq.toString(36) + Math.floor(Math.random() * 36 * 36).toString(36);
}

/** 新しいセーブ。数値の初期値は sim.js（balance.js）から渡す。 */
export function newState(init = {}) {
  return {
    v: SAVE_VERSION,
    created: Date.now(),
    clock: { min: init.startMinute ?? START_MINUTE },
    coins: init.coins ?? 100,
    tanks: [{
      id: 't1', water: 'fresh', slot: 0, name: '',
      temp: init.waterTemp ?? 20, clean: init.clean ?? 100, air: init.air ?? 70, leftover: init.leftover ?? 0, waste: 0,
      decor: [], equip: [],
      fish: [],
    }],
    box: [],                 // v0.5 おやすみすいそう（あずけた 生きもの。水槽の 魚と おなじ 形・時間は すすまない）
    storage: [],             // v0.6 そうこ（しまった すいそう。中身ごと・時間は すすまない）
    quiz: null,              // v0.5 ミニゲームの とちゅう（とじても つづきから）
    hearts: 0,               // なでて もらった ハート（いまの かず。あとで つかう よてい）
    heartsTotal: 0,          // つうさんの ハート（つかっても へらない）
    unlocks: {},             // 解放ずみ { tank6: その日 }（いちど ひらいたら もどさない）
    notices: {},             // まだ 見せていない 大きな お知らせ { tank6: true }
    inv: {},                 // 持っている消耗品（えさ など）{ id: かず }
    owned: {},               // 一度でも持った魚・器具 { id: true }（ずかん用は dex）
    dex: {},                 // ずかん { speciesId: { first: day, count } }
    missions: { done: {}, claimed: {}, prog: {} },
    stats: {},               // かぞえる（えさ・みずかえ・そうじ・ありがとう …）
    daily: { day: 1, care: 0, thanks: 0, hearts: 0 },
    tutorial: { step: 0, done: false },
    settings: { sound: true },
    ui: { lastScreen: 'room', tankId: 't1' },
  };
}

/** 古い版・欠けたデータを今の形に直す。形がおかしければ null。 */
export function migrate(raw, init) {
  if (!raw || typeof raw !== 'object') return null;
  let s = raw;
  const v = Number.isFinite(s.v) ? s.v : 0;
  // 版ごとの読み替え
  if (v < 2) {
    // v0.1：水槽は 1つ（slot・name なし）、ハート・かいほう なし → 1つめの 水槽を へやの 1ばんめの わくへ
    s = { ...s, tanks: Array.isArray(s.tanks) ? s.tanks.map((t, i) => (isObj(t) ? { slot: i, name: '', ...t } : t)) : s.tanks, hearts: 0, heartsTotal: 0, unlocks: {}, notices: {} };
  }
  if (v > SAVE_VERSION) console.warn('あたらしい ばんの セーブ', v);
  const base = newState(init);
  const out = { ...base, ...s, v: SAVE_VERSION };
  // 欠けたところを埋める・型を直す
  out.clock = { ...base.clock, ...(isObj(s.clock) ? s.clock : {}) };
  if (!Number.isFinite(out.clock.min) || out.clock.min < 0) out.clock.min = START_MINUTE;
  out.coins = Number.isFinite(s.coins) ? Math.max(0, Math.floor(s.coins)) : base.coins;
  out.tanks = Array.isArray(s.tanks) && s.tanks.length ? s.tanks.filter(isObj).map((t, i) => fixTank(t, base.tanks[0], i)) : base.tanks;
  if (!out.tanks.length) out.tanks = base.tanks;
  for (const k of ['inv', 'owned', 'dex', 'stats']) out[k] = isObj(s[k]) ? s[k] : {};
  out.missions = { done: {}, claimed: {}, prog: {}, ...(isObj(s.missions) ? s.missions : {}) };
  out.daily = { ...base.daily, ...(isObj(s.daily) ? s.daily : {}) };
  out.tutorial = { ...base.tutorial, ...(isObj(s.tutorial) ? s.tutorial : {}) };
  out.settings = { ...base.settings, ...(isObj(s.settings) ? s.settings : {}) };
  out.ui = { ...base.ui, ...(isObj(s.ui) ? s.ui : {}) };
  out.hearts = Number.isFinite(s.hearts) ? Math.max(0, Math.floor(s.hearts)) : 0;
  out.heartsTotal = Number.isFinite(s.heartsTotal) ? Math.max(out.hearts, Math.floor(s.heartsTotal)) : out.hearts;
  // v0.5 おやすみすいそう：古い セーブには ない → []
  out.box = Array.isArray(s.box) ? s.box.filter((f) => isObj(f) && typeof f.speciesId === 'string').map((f) => ({
    ...f, uid: typeof f.uid === 'string' ? f.uid : newUid(), stage: [0, 1, 2].includes(f.stage) ? f.stage : 0,
  })) : [];
  out.quiz = isObj(s.quiz) && Array.isArray(s.quiz.qs) ? s.quiz : null;
  out.unlocks = isObj(s.unlocks) ? s.unlocks : {};
  out.notices = isObj(s.notices) ? s.notices : {};
  // 水槽の わく（0〜5）が かさならない ように
  const used = new Set();
  for (const t of out.tanks) {
    let k = Number.isInteger(t.slot) && t.slot >= 0 && t.slot < 6 && !used.has(t.slot) ? t.slot : -1;
    if (k < 0) { k = 0; while (used.has(k) && k < 6) k++; }
    t.slot = k; used.add(k);
  }
  // v0.6 そうこ（しまった すいそう）：古い セーブには ない → []。へやに はいりきらない すいそうも すてずに そうこへ
  const stored = Array.isArray(s.storage) ? s.storage.filter(isObj).map((t, i) => ({ ...fixTank(t, base.tanks[0], 100 + i), slot: -1 })) : [];
  out.storage = stored.concat(out.tanks.filter((t) => t.slot >= 6).map((t) => ({ ...t, slot: -1 })));
  out.tanks = out.tanks.filter((t) => t.slot < 6);
  const ids = new Set(out.tanks.map((t) => t.id));
  for (const t of out.storage) { while (ids.has(t.id)) t.id = 't' + Math.random().toString(36).slice(2, 7); ids.add(t.id); }
  if (!out.tanks.some((t) => t.id === out.ui.tankId)) out.ui.tankId = out.tanks[0].id;
  return out;
}

function fixTank(t, b, i) {
  const n = (x, d, lo = 0, hi = 100) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);
  return {
    ...b, ...t,
    id: typeof t.id === 'string' ? t.id : 't' + (i + 1),
    // v0.6 ぼうけん係：'pond' など あたらしい 水も のこす（しらない 水の チェックは sim の WATERS。ここは 形だけ）
    water: typeof t.water === 'string' && /^[a-z]{2,12}$/.test(t.water) ? t.water : 'fresh',
    name: typeof t.name === 'string' ? t.name.slice(0, 16) : '',
    slot: Number.isInteger(t.slot) ? t.slot : i,
    temp: n(t.temp, b.temp, 0, 40), clean: n(t.clean, b.clean), air: n(t.air, b.air), leftover: n(t.leftover, 0, 0, 99), waste: n(t.waste, 0, 0, 99),
    decor: Array.isArray(t.decor) ? t.decor.filter((x) => typeof x === 'string') : [],
    equip: Array.isArray(t.equip) ? t.equip.filter((x) => typeof x === 'string') : [],
    fish: Array.isArray(t.fish) ? t.fish.filter((f) => isObj(f) && typeof f.speciesId === 'string').map((f) => ({
      ...f,
      uid: typeof f.uid === 'string' ? f.uid : newUid(),
      stage: [0, 1, 2].includes(f.stage) ? f.stage : 0,
      health: n(f.health, 100),   // こまかい項目の 読み替え・おぎないは sim.normalize
    })) : [],
  };
}

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

export function load(init) {
  try {
    const txt = localStorage.getItem(SAVE_KEY);
    if (!txt) return newState(init);
    const s = migrate(JSON.parse(txt), init);
    if (s) return s;
  } catch (e) {
    console.warn('セーブを よめなかった', e);
    try { localStorage.setItem(SAVE_KEY + '-broken', localStorage.getItem(SAVE_KEY) || ''); } catch { /* いっぱい */ }
  }
  return newState(init);
}

export function save(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch (e) { console.warn('セーブ できなかった', e); return false; }
}

export function resetSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* なし */ } }

// ---------------- 時計 ----------------
export const dayOf = (min) => Math.floor(min / MIN_PER_DAY) + 1;
export const minuteOfDay = (min) => ((min % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
/** 'morning' | 'noon' | 'evening' | 'night' */
export function phaseOf(min) {
  const m = minuteOfDay(min);
  if (m >= 5 * 60 && m < 10 * 60) return 'morning';
  if (m >= 10 * 60 && m < 17 * 60) return 'noon';
  if (m >= 17 * 60 && m < 19 * 60) return 'evening';
  return 'night';
}
export const PHASE_LABEL = { morning: 'あさ', noon: 'ひる', evening: 'ゆうがた', night: 'よる' };
/** 水槽のあかり（0-1）。よるは少し暗く、あさ・ゆうがたは間。 */
export function lightOf(min) {
  const m = minuteOfDay(min) / 60;
  const k = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
  if (m < 5) return 0.45;
  if (m < 7) return k(0.45, 1, (m - 5) / 2);
  if (m < 17) return 1;
  if (m < 20) return k(1, 0.45, (m - 17) / 3);
  return 0.45;
}

/**
 * 開いている間だけ進む時計。onTick(gameMinutes) を約 1 秒ごとに呼ぶ。
 * hidden の間は止め、戻ってきたら「そこから」また数える（閉じていた間は足さない）。
 */
export function createClock(onTick, { interval = 1000, maxStepSec = 3 } = {}) {
  let last = null, timer = 0, speed = 1;
  const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
  function step() {
    const now = performance.now();
    if (!visible()) { last = null; return; }
    if (last == null) { last = now; return; }
    const sec = Math.min(maxStepSec, Math.max(0, (now - last) / 1000));   // 固まっていた間を取り戻さない
    last = now;
    const gameMin = sec * speed * MIN_PER_DAY / REAL_SEC_PER_GAME_DAY;
    if (gameMin > 0) onTick(gameMin);
  }
  function onVis() { last = null; if (visible()) step(); }
  return {
    start() { if (timer) return; last = null; timer = setInterval(step, interval); document.addEventListener('visibilitychange', onVis); },
    stop() { clearInterval(timer); timer = 0; document.removeEventListener('visibilitychange', onVis); },
    set speed(v) { speed = Math.max(0, +v || 0); },
    get speed() { return speed; },
  };
}

// ---------------- コイン ----------------
export function addCoins(state, n) {
  n = Math.floor(n);
  if (!(n > 0)) return 0;
  state.coins = Math.min(999999, state.coins + n);
  state.stats.coinsEarned = (state.stats.coinsEarned || 0) + n;
  return n;
}
export function spendCoins(state, n) {
  if (!(n >= 0) || state.coins < n) return false;
  state.coins -= n;
  return true;
}
