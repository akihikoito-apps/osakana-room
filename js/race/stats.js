// v0.10 のうりょく係：レースの のうりょく（6つ）。数値は js/data/raceStats.js。画面（DOM）には さわらない。
// sim.js が `export * as race from './race/stats.js'` で 再輸出する（sim.race.statsOf …）。
//
// 魚に 足す 項目（セーブに のこる）
//   f.rIndiv : こたいち { speed, accel, stamina, turn, jump, power }（整数 ±7。手に入れた とき きまる。古い 魚は uid から）
//   f.rQ     : おせわの よさの へいきん（0〜1。1じかん ごとの q の へいきん。さいきん 200じかん くらい）
//   f.rH     : おせわを かぞえた 時間（なれ。100じかん で ボーナス いっぱい）
//
// しき（くわしい 数は RULE）
//   statsOf    = (しゅるいの とくい ＋ こたいち ±7) × だんかいの かけざん（ちびっこ0.62 → おとな0.8 → ビッグ0.92）＋ おせわ ボーナス（0〜15）、0〜100
//     とくいの こたいちは マイナスに しない（agy）
//     おせわ ボーナス = 15 × rQ × min(1, rH ÷ 100)
//     q（1じかん）   = けんこう/100 × (0.3 ＋ 0.7 × えいよう/100)。おなか < 20 なら はんぶん
//   conditionOf = けんこう 10 → 0.7 ・ 90 いじょう → 1.0（あいだは まっすぐ）
//   effectiveStats = statsOf × conditionOf
//   cpuStats   = (しゅるいの とくい ＋ こたいち) × mul ＋ add（めやすは raceStats.js の RULE.cpu。easy≈34・normal≈46・hard≈60）
import { data, growRatio } from '../sim.js';
import { isDream, kindOf } from '../dream.js';
import { randNormal, hashRnd } from '../size.js';
import { STAT_KEYS, STAT_NAMES, STAT_ICONS, TOKUI_WORDS, PROFILE, DREAM_PROFILE, NO_RACE, REASON_TEXT, RULE } from '../data/raceStats.js';
export { STAT_KEYS, STAT_NAMES, STAT_ICONS, TOKUI_WORDS, REASON_TEXT, RULE };

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const toObj = (arr) => Object.fromEntries(STAT_KEYS.map((k, i) => [k, arr[i]]));

// ---------------- しゅるい ----------------
/** でられない りゆう（しゅるいだけ で きまる もの）。でられるなら null */
function kindReason(f) {
  const sp = data()?.fishById[f?.speciesId];
  if (!sp) return 'none';
  if (isDream(f)) {
    const k = f.speciesId.slice(6);
    return k === 'fish' ? null : ({ crab: 'shrimp', frog: 'frog', reptile: 'turtle' })[k] || 'notFish';
  }
  if (sp.kind === 'shrimp') return 'shrimp';
  if (sp.kind === 'snail') return 'snail';
  if (NO_RACE[sp.id]) return NO_RACE[sp.id];
  if (sp.kind !== 'fish') return 'notFish';
  const k = kindOf(sp.id);                       // 名前で カエル・カメ（あとから ふえた 生きものも）
  if (k === 'frog') return 'frog';
  if (k === 'reptile') return 'turtle';
  return null;
}
/** でられる しゅるい id か（おみせ・つり・いけ・とくべつ。ゆめは のぞく） */
export function canRaceSpecies(id) {
  const sp = data()?.fishById[id];
  if (!sp || sp.obtain === 'dream') return false;
  return kindReason({ speciesId: id }) === null;
}

/** しゅるいの とくい（6つの 配列）。ゆめの さかなは ぬりえなら もとの しゅるい、オリジナルは ふつう＋えらんだ はやさ */
export function profileOf(f) {
  if (isDream(f)) {
    const base = f.dream?.base;
    if (base && PROFILE[base]) return PROFILE[base];
    return DREAM_PROFILE[f.dream?.speed] || DREAM_PROFILE.normal;
  }
  return PROFILE[f?.speciesId] || DREAM_PROFILE.normal;
}

// ---------------- こたいち ----------------
/** 手に入れた ときの こたいち（rnd は 0〜1） */
export function rollIndiv(rnd = Math.random) {
  const o = {};
  for (const k of STAT_KEYS) {
    let v = randNormal(rnd) * RULE.indivSd;
    for (let i = 0; i < 8 && Math.abs(v) > RULE.indivMax; i++) v = randNormal(rnd) * RULE.indivSd;   // はみ出たら ひきなおし
    o[k] = Math.round(clamp(v, -RULE.indivMax, RULE.indivMax));
  }
  return o;
}

/** 魚の のうりょくの 項目を そろえる（sim の normFish から。こたいちが ない 古い 魚には uid から きめる＝もらいそこね なし） */
export function normFish(f) {
  const ok = f.rIndiv && typeof f.rIndiv === 'object' && STAT_KEYS.every((k) => fin(f.rIndiv[k]));
  if (!ok) {
    const old = rollIndiv(hashRnd('race:' + String(f.uid || '')));
    const cur = f.rIndiv && typeof f.rIndiv === 'object' ? f.rIndiv : {};
    f.rIndiv = Object.fromEntries(STAT_KEYS.map((k) => [k, fin(cur[k]) ? cur[k] : old[k]]));
  }
  for (const k of STAT_KEYS) f.rIndiv[k] = Math.round(clamp(f.rIndiv[k], -RULE.indivMax, RULE.indivMax));
  for (const k of Object.keys(f.rIndiv)) if (!STAT_KEYS.includes(k)) delete f.rIndiv[k];
  if (!fin(f.rH) || !fin(f.rQ)) {               // 古い セーブ：ふつうの おせわ・だんかいに あった なれ
    f.rQ = RULE.oldQ;
    f.rH = RULE.oldH[clamp(f.stage | 0, 0, 2)] ?? 0;
  }
  f.rQ = clamp(f.rQ, 0, 1);
  f.rH = clamp(f.rH, 0, 1e6);
  return f;
}

// ---------------- そだち ----------------
/** 1じかんの おせわの よさ（0〜1） */
export function careQ(f) {
  const h = clamp(fin(f.health) ? f.health : 80, 0, 100) / 100;
  const e = clamp(fin(f.eiyo) ? f.eiyo : 50, 0, 100) / 100;
  const q = h * (0.3 + 0.7 * e);
  return (fin(f.onaka) ? f.onaka : 60) < RULE.minOnaka ? q / 2 : q;
}
/** 1じかん（sim の hourly から。すいそうの 中の 魚だけ）：おせわの よさを へいきんに 入れる */
export function hourTick(f) {
  if (!fin(f.rQ) || !fin(f.rH)) normFish(f);
  const n = Math.min(f.rH, RULE.careAvgH);
  f.rQ = clamp((f.rQ * n + careQ(f)) / (n + 1), 0, 1);
  f.rH += 1;
}
/** おせわ ボーナス（ぜんぶの のうりょくに たす。0〜careMax） */
export function careBonus(f) {
  const rq = fin(f?.rQ) ? f.rQ : RULE.oldQ;
  const rh = fin(f?.rH) ? f.rH : 0;
  return RULE.careMax * clamp(rq, 0, 1) * clamp(rh / RULE.rampH, 0, 1);
}
/** そだちの いち 0（ちびっこ）〜 2（ビッグ） */
export function levelOf(f) {
  if (isDream(f)) return RULE.dreamLevel;
  const s = clamp(f?.stage | 0, 0, 2);
  return s >= 2 ? 2 : s + clamp(growRatio(f), 0, 1) * 0.999;
}
/** だんかいの かけざん（とちゅうは なめらかに） */
export function stageMul(level) {
  const M = RULE.stageMul;
  const l = clamp(level, 0, 2);
  const i = Math.min(1, Math.floor(l));
  return M[i] + (M[i + 1] - M[i]) * (l - i);
}

// ---------------- 約束の 関数 ----------------
/** { ok, reason }。reason：'none'|'notFish'|'shrimp'|'snail'|'frog'|'turtle'|'bug'|'squid'|'hungry'（ことばは REASON_TEXT） */
export function canRace(f) {
  const r = kindReason(f);
  if (r) return { ok: false, reason: r, text: REASON_TEXT[r] };
  if ((fin(f.onaka) ? f.onaka : 0) < RULE.minOnaka) return { ok: false, reason: 'hungry', text: REASON_TEXT.hungry };
  return { ok: true, reason: null };
}

/** こたいちの 足し算（とくいは マイナスに しない） */
function withIndiv(p, ind = {}) {
  const top = p.indexOf(Math.max(...p));
  return p.map((v, i) => { const d = fin(ind[STAT_KEYS[i]]) ? ind[STAT_KEYS[i]] : 0; return v + (i === top ? Math.abs(d) : d); });
}

/** { speed, accel, stamina, turn, jump, power } 各 0〜100 の 整数（しゅるい＋こたいち＋そだち。コンディション まえ） */
export function statsOf(state, f) {
  if (!f) return toObj(STAT_KEYS.map(() => 0));
  const mul = stageMul(levelOf(f));
  const bonus = careBonus(f);
  return toObj(withIndiv(profileOf(f), f.rIndiv).map((v) => Math.round(clamp(v * mul + bonus, 0, 100))));
}

/** コンディション 0.7〜1.0（けんこう から） */
export function conditionOf(f) {
  const C = RULE.cond;
  const h = fin(f?.health) ? f.health : C.hi;
  const r = clamp((h - C.lo) / (C.hi - C.lo), 0, 1);
  return Math.round((C.min + (C.max - C.min) * r) * 100) / 100;
}

/** statsOf × conditionOf（整数） */
export function effectiveStats(state, f) {
  const s = statsOf(state, f);
  const c = conditionOf(f);
  return toObj(STAT_KEYS.map((k) => Math.round(clamp(s[k] * c, 0, 100))));
}

/** コンディションの ことば（カード用） */
export function conditionWord(c) {
  if (c >= 0.95) return { lvl: 'good', word: 'ばっちり' };
  if (c >= 0.82) return { lvl: 'ok', word: 'まあまあ' };
  return { lvl: 'bad', word: 'いまいち' };
}

/** とくい：いちばん 高い のうりょく（しゅるいの とくいで きめる。おなじ なら ならびの さき）。{ key, name, word } */
export function tokuiOf(f) {
  const p = profileOf(f);
  const max = Math.max(...p), min = Math.min(...p);
  if (max - min < 5) return { key: 'all', name: 'バランス', word: TOKUI_WORDS.all };
  const i = p.indexOf(max);
  const key = STAT_KEYS[i];
  return { key, name: STAT_NAMES[key], word: TOKUI_WORDS[key] };
}

/** コンピューターが つかえる しゅるい（おみせ・つり・いけ。とくべつ・ゆめは のぞく） */
export function cpuSpecies() {
  return Object.keys(PROFILE).filter((id) => { const sp = data()?.fishById[id]; return sp && sp.obtain !== 'premium' && canRaceSpecies(id); });
}

/**
 * コンピューターの 魚：{ speciesId, stats, stage }（stats は もう コンディションこみ。そのまま つかう）。
 * level：'easy'|'normal'|'hard'（ほかは normal）。stage は 3D の 見た目の めやす（1 おとな・2 ビッグ）。
 * つよさの めやす（のうりょくの へいきん）：easy ≈34・normal ≈46・hard ≈60（くわしくは raceStats.js RULE.cpu）
 */
export function cpuStats(level, rnd = Math.random) {
  const L = RULE.cpu[level] || RULE.cpu.normal;
  const list = cpuSpecies();
  const speciesId = list[Math.min(list.length - 1, Math.floor(rnd() * list.length))] || 'medaka';
  const p = PROFILE[speciesId] || DREAM_PROFILE.normal;
  const stats = toObj(withIndiv(p, rollIndiv(rnd)).map((v) => Math.round(clamp(v * L.mul + L.add, 0, 100))));
  return { speciesId, stats, stage: L.stage };
}
