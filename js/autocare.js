// v0.9 じどう おせわき（おせわき係）：とりつけた すいそうの おせわを じどうで する。画面（DOM）には さわらない。
// - もらう：もっている すいそう（へや＋そうこ。ゆめのすいそうも かぞえる）が AUTOCARE.giftAt（6）こに なったら 1かいだけ count（3）こ。
//   すでに 6つ いじょう ある 人は つぎに ひらいた とき（normalize）もらえる。チュートリアル中は まつ。
//   もらったら state.unlocks.autoCare = その日（もどさない）・state.notices.autoCare = true（画面が あんないを 出したら けす）。
// - かず：state.inv.auto_care（とりつけて いない もの）＋ t.autoCare === true の すいそう（へや＋そうこ）＝ count。normalize で いつも そろえる。
// - うごき（sim.tick の 5ふん きざみ ごと。state.tanks だけ＝そうこの すいそうは 時間が とまって いるので うごかない）：
//   おなか < feedBelow の いきもの を feedTo まで（いきもの ごと。上の 子には あげない）。
//   きれいさ < cleanBelow で cleanTo まで もどす（みずかえ 相当・たべのこし も 0）。そこの ごみ >= wasteAt で wasteTo まで、
//   たべのこし >= leftoverAt で 0 に（そうじ 相当）。ピカピカ（70）の ごきげんボーナスは じぶんで みずかえ した ときに のこす。
// - じどうでは コイン・ハート・なつき・そだち・ミッションの おせわ回数（stats.feed / waterChange / scoop）は ふえない。
//   sim.feedStart / waterChange / scoop は よばない（コイン・1日の かいすう・ミッションの かぞえに ふれない ため）。値だけ ととのえる。
// - ゆめのすいそう には つけられない（いつも ちょうど よい）。
// sim.js が `export * as autocare from './autocare.js'` で 再輸出する（sim.autocare.attach …）。
import { balance, gameDay } from './sim.js';

export const ITEM_ID = 'auto_care';
// balance.js AUTOCARE が ない ときの かわり（数は Codex と agy に 相談して きめた。balance.js の ほうが かつ）
const DEF = {
  giftAt: 6, count: 3,
  feedBelow: 30, feedTo: 75,
  cleanBelow: 62, cleanTo: 68,
  wasteAt: 3, wasteTo: 1,
  leftoverAt: 1,
  noticeGapSec: 45,
};
export const rule = () => ({ ...DEF, ...(balance()?.AUTOCARE || {}) });

const isDreamTank = (t) => !!t && t.water === 'dream';
const allTanks = (state) => (state.tanks || []).concat(state.storage || []);
const inc = (state, k) => { state.stats[k] = (state.stats[k] || 0) + 1; };

/** もっている すいそうの かず（へや＋そうこ。ゆめのすいそうも かぞえる：2026-11-25 本人） */
export const tankCount = (state) => allTanks(state).length;
/** もらった か */
export const unlocked = (state) => !!state.unlocks?.autoCare;
/** のこり（とりつけて いない かず） */
export const left = (state) => Math.max(0, Math.floor(state.inv?.[ITEM_ID] || 0));
/** とりつけて いる すいそう（へや＋そうこ） */
export const attachedTanks = (state) => allTanks(state).filter((t) => t.autoCare === true);
/** ぜんぶの かず（のこり＋とりつけ） */
export const total = (state) => left(state) + attachedTanks(state).length;
/** その すいそうに つけられる しゅるい か（ゆめのすいそう は だめ） */
export const canHold = (t) => !!t && !isDreamTank(t);

/** とりつけ られるか。{ ok, reason: 'none'|'locked'|'dream'|'have'|'empty' } */
export function canAttach(state, t) {
  if (!t || !allTanks(state).includes(t)) return { ok: false, reason: 'none' };
  if (!unlocked(state)) return { ok: false, reason: 'locked' };
  if (isDreamTank(t)) return { ok: false, reason: 'dream' };
  if (t.autoCare === true) return { ok: false, reason: 'have' };
  if (left(state) <= 0) return { ok: false, reason: 'empty' };
  return { ok: true };
}

/** とりつける：のこり −1。stats.autoCareAttach を +1（ミッション係が つかう）。{ ok, reason, left } */
export function attach(state, t) {
  const c = canAttach(state, t);
  if (!c.ok) return c;
  state.inv[ITEM_ID] = left(state) - 1;
  t.autoCare = true;
  state.owned = { ...(state.owned || {}), [ITEM_ID]: true };
  inc(state, 'autoCareAttach');
  return { ok: true, left: left(state) };
}

/** はずす：のこり +1。{ ok, reason: 'none'|'notOn', left } */
export function detach(state, t) {
  if (!t || !allTanks(state).includes(t)) return { ok: false, reason: 'none' };
  if (t.autoCare !== true) return { ok: false, reason: 'notOn' };
  t.autoCare = false;
  state.inv[ITEM_ID] = left(state) + 1;
  return { ok: true, left: left(state) };
}

/**
 * もらう：すいそうが giftAt こ いじょう・まだ もらって いない・チュートリアルが おわって いる。
 * events に { type: 'autoCareGift', count }。かえす：もらったら true
 */
export function checkGift(state, events = []) {
  if (unlocked(state)) return false;
  if (!state.tutorial?.done) return false;
  const R = rule();
  if (tankCount(state) < R.giftAt) return false;
  const day = gameDay(state.clock.min);
  state.unlocks = { ...(state.unlocks || {}), autoCare: day };
  state.notices = { ...(state.notices || {}), autoCare: true };
  state.inv[ITEM_ID] = left(state) + R.count;
  state.owned = { ...(state.owned || {}), [ITEM_ID]: true };
  fixCount(state);
  events.push({ type: 'autoCareGift', count: R.count });
  return true;
}

/** かずを そろえる：のこり＋とりつけ ＝ count（もらう まえは 0）。ゆめのすいそうの とりつけは はずす */
function fixCount(state) {
  const R = rule();
  for (const t of allTanks(state)) if ('autoCare' in t) t.autoCare = t.autoCare === true && canHold(t);
  if (!unlocked(state)) {
    for (const t of allTanks(state)) if (t.autoCare) t.autoCare = false;
    delete state.inv[ITEM_ID];
    return;
  }
  const on = attachedTanks(state);
  // おおすぎる とりつけ（セーブの こわれ）は うしろから はずす
  for (const t of on.slice(R.count)) t.autoCare = false;
  state.inv[ITEM_ID] = Math.max(0, R.count - Math.min(on.length, R.count));
}

/** sim.normalize から：かずを そろえて、もう 6つ ある 人には ここで わたす（おしらせは 画面が 出す） */
export function normalizeState(state) {
  state.inv ||= {};
  fixCount(state);
  checkGift(state);
}

/**
 * sim.tick の 1ステップ（5ふん いか）ごと：とりつけた へやの すいそうを ととのえる。
 * events に { type: 'autoCare', tankId, fed: [uid…], water: bool, scoop: bool }（なにか した ときだけ）。
 */
export function run(state, events = []) {
  if (!unlocked(state)) return events;
  const R = rule();
  for (const t of state.tanks) {
    if (t.autoCare !== true || !canHold(t)) continue;
    const fed = [];
    for (const f of t.fish) {
      if (f.onaka < R.feedBelow) { f.onaka = Math.max(f.onaka, R.feedTo); fed.push(f.uid); }
    }
    let water = false, scoop = false;
    if (t.clean < R.cleanBelow) { t.clean = Math.max(t.clean, R.cleanTo); t.leftover = 0; water = true; }
    if ((t.waste || 0) >= R.wasteAt) { t.waste = Math.min(t.waste, R.wasteTo); t.leftover = 0; scoop = true; }
    if ((t.leftover || 0) >= R.leftoverAt) { t.leftover = 0; scoop = true; }
    if (fed.length || water || scoop) events.push({ type: 'autoCare', tankId: t.id, fed, water, scoop });
  }
  return events;
}
