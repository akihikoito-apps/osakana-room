// v0.10 レース係：レースの ごほうび（DOM に よらない）。sim.raceReward.finish(state, uid, level, rank) で よぶ。
// - 1〜3い：その 魚からの ハート（1日20この 上限とは べつ。heartsTotal にも 入る）と すこしの コイン。
// - その むずかしさで はじめて 1い：ボーナスの コイン（セーブ ぜんたいで 1かい）と つぎの むずかしさが ひらく。
// - レースに 出ると その 魚の おなかが すこし へる（順位に かかわらず 1かい）。
// - stats.raceRun（はしった 回数）・stats.raceWin（1いの 回数）を ふやす。
// 数は Codex・agy と そうだん（Codex：コインは ひかえめ・はじめての 1いは ＋15 / agy：もうすこし 多く・＋30〜50 → あいだ）。
import { addCoin, checkMissions, balance } from '../sim.js';
import { LEVELS } from './course.js';

export const REWARD = {
  hearts: [5, 3, 2, 0],                 // 1い・2い・3い・4い
  coins: {
    easy:   [6, 4, 2, 0],
    normal: [9, 6, 3, 0],
    hard:   [12, 8, 4, 0],
  },
  firstWin: 20,                         // その むずかしさで はじめて 1い（1かい だけ）
  onaka: 8,                             // レースで へる おなか
};

const findFish = (state, uid) => {
  for (const t of state.tanks) { const f = t.fish.find((x) => x.uid === uid); if (f) return { f, t }; }
  return null;
};

/** レースの きろく（なければ つくる） */
export function raceData(state) {
  const r = (state.race && typeof state.race === 'object') ? state.race : (state.race = {});
  r.cleared = (r.cleared && typeof r.cleared === 'object') ? r.cleared : {};
  r.best = (r.best && typeof r.best === 'object') ? r.best : {};
  r.runs = Number.isFinite(r.runs) ? r.runs : 0;
  r.wins = Number.isFinite(r.wins) ? r.wins : 0;
  return r;
}

/** その むずかしさが ひらいているか（かんたんは さいしょから。つぎは まえの むずかしさで 1い） */
export function levelOpen(state, level) {
  const i = LEVELS.indexOf(level);
  if (i <= 0) return i === 0;
  return !!raceData(state).cleared[LEVELS[i - 1]];
}

/** 順位で もらえる もの（まえもって 見せる 用） */
export function prizeOf(level, rank, state = null) {
  const i = Math.max(0, Math.min(3, (rank | 0) - 1));
  const coins = (REWARD.coins[level] || REWARD.coins.easy)[i];
  const first = rank === 1 && state && !raceData(state).cleared[level] ? REWARD.firstWin : 0;
  return { hearts: REWARD.hearts[i], coins, first };
}

/**
 * レースの けっかを うけとる。time＝ゴールまでの 秒（あれば ベスト きろく）。
 * かえす：{ ok, hearts, coins, first, unlocked（ひらいた むずかしさ|null）, best, events }
 */
export function finish(state, uid, level, rank, { time = null } = {}) {
  if (!LEVELS.includes(level)) return { ok: false, reason: 'level' };
  const hit = findFish(state, uid);
  if (!hit) return { ok: false, reason: 'fish' };
  const { f } = hit;
  rank = Math.max(1, Math.min(4, rank | 0));
  const rd = raceData(state);
  const p = prizeOf(level, rank, state);
  // ハート：1日の 上限（daily.hearts）には かぞえない
  const H = balance()?.HEART || {};
  if (p.hearts > 0) {
    state.hearts = Math.min(H.max ?? 99999, (state.hearts || 0) + p.hearts);
    state.heartsTotal = (state.heartsTotal || 0) + p.hearts;
  }
  let coins = p.coins > 0 ? addCoin(state, p.coins) : 0;
  let first = 0, unlocked = null;
  if (rank === 1 && !rd.cleared[level]) {
    rd.cleared[level] = true;
    first = addCoin(state, p.first || REWARD.firstWin);
    const next = LEVELS[LEVELS.indexOf(level) + 1];
    if (next) unlocked = next;
  }
  // おなか（しなない・へりすぎない）
  f.onaka = Math.max(0, (Number(f.onaka) || 0) - REWARD.onaka);
  rd.runs++;
  if (rank === 1) rd.wins++;
  let best = false;
  if (rank === 1 && Number.isFinite(time) && time > 0 && !(rd.best[level] <= time)) { rd.best[level] = Math.round(time * 10) / 10; best = true; }
  state.stats.raceRun = (state.stats.raceRun || 0) + 1;
  if (rank === 1) state.stats.raceWin = (state.stats.raceWin || 0) + 1;
  const events = [];
  checkMissions(state, events);
  return { ok: true, rank, hearts: p.hearts, coins, first, unlocked, best, events };
}
