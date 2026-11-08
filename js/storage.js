// そうこ（v0.6 ゲーム係）：へやの すいそうを 中身ごと しまう／だす。画面（DOM）には さわらない。
// - しまった すいそうは state.storage。sim.tick は state.tanks しか 見ないので、中は 時間が とまる。
// - へやは かならず 1つ のこす（からっぽの へやに しない）。
// - 6ぴき かいほう まえは 1つめ（state.tanks[0]）を しまえない（かいほうの かぞえが かわらない ように）。
// - すいそうの かずの 上限（へや＋そうこ）は sim.tankLimit()。かうとき へやが いっぱいなら sim.addTank が そうこへ 入れる。
import { balance, isUnlocked, freeSlot, checkMissions } from './sim.js';

const inc = (state, k) => { state.stats[k] = (state.stats[k] || 0) + 1; };
const done = (state) => checkMissions(state, []);
const roomMax = () => balance().TANKS?.max ?? 6;
const isFirst = (state, t) => !isUnlocked(state, 'tank6') && t === state.tanks[balance().UNLOCK?.tank6?.tankIndex ?? 0];

/** しまえるか。{ ok, reason: 'none'|'tutorial'|'lastTank'|'firstTank' } */
export function canStoreTank(state, tankId) {
  if (!state.tutorial.done) return { ok: false, reason: 'tutorial' };
  const t = state.tanks.find((x) => x.id === tankId);
  if (!t) return { ok: false, reason: 'none' };
  if (state.tanks.length <= 1) return { ok: false, reason: 'lastTank' };
  if (isFirst(state, t)) return { ok: false, reason: 'firstTank' };
  return { ok: true };
}

/** へや → そうこ。{ ok, tank, events } */
export function storeTank(state, tankId) {
  const c = canStoreTank(state, tankId);
  if (!c.ok) return c;
  const i = state.tanks.findIndex((x) => x.id === tankId);
  const [t] = state.tanks.splice(i, 1);
  t.storedAt = state.clock.min;
  t.slot = -1;
  (state.storage ||= []).push(t);
  if (state.ui?.tankId === t.id) state.ui.tankId = state.tanks[0].id;
  inc(state, 'storeTank');
  return { ok: true, tank: t, events: done(state) };
}

/** だせるか。{ ok, reason: 'none'|'roomFull' } */
export function canTakeOutTank(state, tankId) {
  if (!(state.storage || []).some((x) => x.id === tankId)) return { ok: false, reason: 'none' };
  if (freeSlot(state) < 0) return { ok: false, reason: 'roomFull' };
  return { ok: true };
}

/** そうこ → へや（あいている わく。slot を わたせば そこ）。{ ok, tank, events } */
export function takeOutTank(state, tankId, slot) {
  const c = canTakeOutTank(state, tankId);
  if (!c.ok) return c;
  const k = Number.isInteger(slot) && slot >= 0 && slot < roomMax() && !state.tanks.some((x) => x.slot === slot) ? slot : freeSlot(state);
  const i = state.storage.findIndex((x) => x.id === tankId);
  const [t] = state.storage.splice(i, 1);
  delete t.storedAt;
  t.slot = k;
  state.tanks.push(t);
  inc(state, 'takeOutTank');
  return { ok: true, tank: t, events: done(state) };
}

/** いれかえ：へやの outId を しまって、そうこの inId を おなじ わくに だす（agy の あん）。{ ok, reason, tank, stored, events } */
export function swapTank(state, outId, inId) {
  if (!state.tutorial.done) return { ok: false, reason: 'tutorial' };
  const out = state.tanks.find((x) => x.id === outId);
  const j = (state.storage || []).findIndex((x) => x.id === inId);
  if (!out || j < 0) return { ok: false, reason: 'none' };
  if (isFirst(state, out)) return { ok: false, reason: 'firstTank' };
  const i = state.tanks.indexOf(out);
  const [t] = state.storage.splice(j, 1, out);   // しまう ものは だす ものが いた ところへ
  out.storedAt = state.clock.min;
  const slot = out.slot;
  out.slot = -1;
  delete t.storedAt;
  t.slot = slot;
  state.tanks.splice(i, 1, t);                   // へやの じゅんばんも そのまま
  if (state.ui?.tankId === out.id) state.ui.tankId = t.id;
  inc(state, 'storeTank'); inc(state, 'takeOutTank');
  return { ok: true, tank: t, stored: out, events: done(state) };
}
