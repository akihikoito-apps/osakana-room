// BGM の 再生（音楽係）。曲ファイルは assets/bgm/ 、作り方と 曲の 足し方は docs/音楽.md。
//
// つかいかた（部屋・ゲーム係むけ）
//   import { TRACKS, initBgm, play, stop, setVolume, current } from './bgm.js';
//   initBgm();            // さいしょに 1かい。前回 オンなら、つぎの タップで 自動で ながれる
//   play('hidamari');     // BGM ボタンの 曲を えらんだとき（タップの 中で よぶ）。オンに なる
//   stop();               // オフ（フェードアウト）
//   setVolume(0.6);       // 0〜1（既定 0.5）
//   current();            // { id, on, playing, volume }
//   onBgmChange(fn);      // 状態が かわったら fn(current()) を よぶ（画面の 表示あわせ用・なくても よい）
//
// しくみ
//   ・ファイルは「ループ L 秒 ＋ 先頭 2 秒の くりかえし」。Web Audio の AudioBufferSourceNode で
//     loopStart=1.0 秒 から L 秒を まわすので、AAC の 先頭の 無音が あっても 隙間なく つながる。
//   ・iOS は ユーザーの 操作の あとでしか 音を 出せない → 最初の タップで AudioContext を つくる／resume する。
//   ・アプリが 裏に まわったら 止め、もどったら 再開（再開できなければ つぎの タップで）。
//   ・iPhone/iPad の マナーモード（消音スイッチ）では 鳴らない ことが 多い（効果音と おなじ あつかい）。わざと そのまま。
//   ・選んだ曲・オン/オフ・音量は localStorage 'osakana-room-bgm' に。

export const TRACKS = [
  { id: 'pokapoka', name: 'ぽかぽか おへや', file: 'assets/bgm/pokapoka.m4a', mood: 'ほのぼの（マリンバ・ピアノ）', loop: 76.8 },
  { id: 'hidamari', name: 'ひだまり カフェ', file: 'assets/bgm/hidamari.m4a', mood: 'カフェ ボサノバ（ギター・ビブラフォン）', loop: 64 },
  { id: 'yurayura', name: 'ゆらゆら ティータイム', file: 'assets/bgm/yurayura.m4a', mood: 'ローファイ ジャズ（エレピ・やわらかいドラム）', loop: 72 },
  { id: 'suichu', name: 'すいちゅう さんぽ', file: 'assets/bgm/suichu.m4a', mood: 'すいちゅう（パッド・ガラスのベル・あわ）', loop: 80 },
  { id: 'ohirune', name: 'おひるね オルゴール', file: 'assets/bgm/ohirune.m4a', mood: 'オルゴール（3びょうし）', loop: 96 },
].map((t) => ({ ...t, note: t.mood })); // note は 画面（js/ui/bgm-ui.js）の 説明の 行に 出る。loop はループの 秒数

const KEY = 'osakana-room-bgm';
const LOOP_START = 1.0;   // ファイルの この秒から L 秒を ループ
const FADE_IN = 1.5, FADE_OUT = 0.8, XFADE = 1.0;
const ROOT = new URL('../', import.meta.url); // js/ の ひとつ上（リポジトリ直下）

let ctx = null, master = null;
let settings = { on: false, id: TRACKS[0].id, volume: 0.5 };
let voice = null;          // いま鳴っている { id, src, gain }
let gen = 0;               // 曲えらびの 世代（連打したとき 古い読みこみを すてる）
const buffers = new Map(); // id → AudioBuffer（いまの曲と ひとつ前 だけ）
let inited = false, hiddenPaused = false, needTap = false;
const listeners = new Set();

const trackOf = (id) => TRACKS.find((t) => t.id === id) || TRACKS[0];
const gainOf = (v) => v * v; // 耳の感じに あわせて 2乗

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s === 'object') {
      if (typeof s.on === 'boolean') settings.on = s.on;
      if (TRACKS.some((t) => t.id === s.id)) settings.id = s.id;
      if (typeof s.volume === 'number' && s.volume >= 0 && s.volume <= 1) settings.volume = s.volume;
    }
  } catch { /* 読めなくても 既定で うごく */ }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* なし */ } }
function emit() { const c = current(); for (const f of listeners) { try { f(c); } catch { /* なし */ } } }

// タップの 中で よぶ。AudioContext を つくって 起こす。
function ensureCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try { ctx = new AC({ latencyHint: 'playback' }); } catch { ctx = new AC(); }
    master = ctx.createGain();
    master.gain.value = gainOf(settings.volume);
    master.connect(ctx.destination);
    // 古い iOS むけ：無音を 1つ 鳴らして 音の出口を ひらく
    try { const b = ctx.createBuffer(1, 1, 22050); const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch { /* なし */ }
    ctx.onstatechange = () => {
      // 電話・Siri・画面ロックなどで interrupted／suspended に なったら、見えている間は つぎの タップで 再開
      if (ctx.state !== 'running' && settings.on && !document.hidden && !hiddenPaused) armTap();
      emit();
    };
  }
  if (ctx.state !== 'running' && !document.hidden) ctx.resume().catch(() => armTap());
  return ctx;
}

function onTap() {
  needTap = false;
  removeTap();
  ensureCtx();
  if (settings.on && !voice) startTrack(settings.id);
}
const TAP_EVENTS = ['pointerdown', 'touchend', 'keydown'];
function armTap() { if (needTap) return; needTap = true; for (const e of TAP_EVENTS) window.addEventListener(e, onTap, { capture: true, passive: true }); }
function removeTap() { for (const e of TAP_EVENTS) window.removeEventListener(e, onTap, { capture: true }); }

function decode(arr) {
  // 古い Safari は コールバック形式だけ
  return new Promise((ok, ng) => {
    const p = ctx.decodeAudioData(arr, ok, ng);
    if (p && typeof p.then === 'function') p.then(ok, ng);
  });
}
async function getBuffer(t) {
  if (buffers.has(t.id)) return buffers.get(t.id);
  const res = await fetch(new URL(t.file, ROOT));
  if (!res.ok) throw new Error('bgm: よめない ' + t.file);
  const buf = await decode(await res.arrayBuffer());
  smoothSeam(buf, t);
  buffers.set(t.id, buf);
  return buf;
}
// ループの おわり 20ms を、ループの はじまりの 直前（中身は 同じ所の くりかえし）へ なめらかに よせる。
// AAC の 圧縮で 1周目と 2周目が ほんの少し ちがっても、つなぎ目で「ぷつ」と ならない。
function smoothSeam(buf, t) {
  const sr = buf.sampleRate;
  const ls = Math.round(loopStartOf(buf, t) * sr), le = ls + Math.round(t.loop * sr);
  const n = Math.round(0.02 * sr);
  if (ls < n || le > buf.length) return;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const w = (i + 1) / n;
      d[le - n + i] = d[le - n + i] * (1 - w) + d[ls - n + i] * w;
    }
  }
}
const loopStartOf = (buf, t) => Math.min(LOOP_START, Math.max(0, buf.duration - t.loop - 0.1));
function trimBuffers(keep) { for (const id of [...buffers.keys()]) if (!keep.includes(id)) buffers.delete(id); }

function fadeTo(g, v, sec) {
  const now = ctx.currentTime;
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(g.gain.value, now); // いまの値を いかりにする（はねないように）
  g.gain.linearRampToValueAtTime(v, now + sec);
}
function stopVoice(v, sec) {
  if (!v) return;
  try {
    fadeTo(v.gain, 0, sec);
    v.src.stop(ctx.currentTime + sec + 0.05);
  } catch { /* もう止まっている */ }
  v.src.onended = () => { try { v.src.disconnect(); v.gain.disconnect(); } catch { /* なし */ } };
}

async function startTrack(id) {
  if (!ctx) return;
  const my = ++gen;
  const t = trackOf(id);
  let buf;
  try { buf = await getBuffer(t); } catch (e) { console.warn(e); return; }
  if (my !== gen || !settings.on || settings.id !== id) return; // とちゅうで 曲が かわった・オフに なった
  if (voice && voice.id === id) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const ls = loopStartOf(buf, t);
  src.loopStart = ls;
  src.loopEnd = ls + t.loop;
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(g); g.connect(master);
  const old = voice;
  voice = { id, src, gain: g };
  src.start(ctx.currentTime + 0.03, ls);
  fadeTo(g, 1, old ? XFADE : FADE_IN);
  stopVoice(old, old ? XFADE : FADE_OUT);
  trimBuffers(old ? [id, old.id] : [id]);
  if (old) setTimeout(() => { if (voice && voice.id === id) trimBuffers([id]); }, (XFADE + 0.5) * 1000);
  emit();
}

function onVisibility() {
  if (!ctx) return;
  if (document.hidden) {
    if (ctx.state === 'running') {
      hiddenPaused = true;
      try { fadeTo(master, 0, 0.15); } catch { /* なし */ }
      setTimeout(() => { if (document.hidden && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 200);
    }
  } else if (settings.on) {
    hiddenPaused = false;
    ctx.resume().then(() => {
      fadeTo(master, gainOf(settings.volume), 0.8);
      if (!voice) startTrack(settings.id);
      emit();
    }).catch(() => armTap());
    // iOS では resume が 返ってこない ことが ある → 少し まって まだなら タップを まつ
    setTimeout(() => { if (ctx.state !== 'running' && settings.on && !document.hidden) armTap(); }, 600);
  } else {
    hiddenPaused = false;
  }
}

export function initBgm() {
  if (inited) return current();
  inited = true;
  load();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => { if (ctx && ctx.state === 'running') { hiddenPaused = true; ctx.suspend().catch(() => {}); } });
  window.addEventListener('pageshow', () => { if (!document.hidden) onVisibility(); });
  // 前回 オンなら、さいしょの タップで ながす（iOS は タップの前には 鳴らせない）
  if (settings.on) armTap();
  return current();
}

export function play(id) {
  if (!inited) initBgm();
  if (id && TRACKS.some((t) => t.id === id)) settings.id = id;
  settings.on = true;
  save();
  if (!ensureCtx()) return;
  if (master) fadeTo(master, gainOf(settings.volume), 0.05);
  startTrack(settings.id);
  emit();
}

export function stop() {
  settings.on = false;
  save();
  gen++;
  if (ctx && voice) { stopVoice(voice, FADE_OUT); voice = null; }
  emit();
}

export function setVolume(v) {
  settings.volume = Math.max(0, Math.min(1, Number(v) || 0));
  save();
  if (ctx && master && !document.hidden) fadeTo(master, gainOf(settings.volume), 0.15);
  emit();
}

export function current() {
  return {
    id: settings.id,
    on: settings.on,
    playing: !!(voice && ctx && ctx.state === 'running'),
    volume: settings.volume,
  };
}

export function onBgmChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
