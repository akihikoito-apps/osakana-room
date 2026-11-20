// v0.8 ゆめのすいそう（ゆめ係）：こどもが かいた 絵の いきものを そだてる ふしぎな すいそう。画面（DOM）には さわらない。
// - 5にちめ あさ 6じ いこう（sim.gameDay(min) >= DREAM.giftDay）に 1かいだけ もらえる（checkGift）。
//   もう すぎて いる 人も つぎに ひらいた とき もらえる。へやが いっぱいなら sim.addTank が そうこへ。
// - すいそう：t.water === 'dream'、t.layout = 'water' | 'land'（はじめ 'water'）。きれいさ・すいおん・くうき は いつも ちょうど よい（calm）。
// - いきもの：sim.createFish で つくる（addDex は よばない）＋ f.dream（docs/仕様_v0.8_約束.md の 形）。speciesId は 'dream_' + kind。
//   おおきさは えらんだ まま そだたない（stage は おとな＝1 で とめる）。
// - ずかん・ミッション・クイズ・あいしょう から はずす（sim.js 側で isDream を 見る）。
// sim.js が `export * as dream from './dream.js'` で 再輸出する（sim.dream.addCreature …）。
import { balance, data, createFish, gameDay, addTank, checkMissions } from './sim.js';

export const KINDS = ['fish', 'crab', 'frog', 'reptile'];
export const SPEEDS = ['slow', 'normal', 'fast'];
export const SIZES = ['s', 'm', 'l'];
export const LAYOUTS = ['water', 'land'];
// balance.js DREAM が ない ときの かわり
const DEF = {
  giftDay: 5, maxPerTank: 6, maxCreatures: 30, sizeCm: { s: 3, m: 6, l: 10 },
  start: { onaka: 80, health: 100, mood: 80, natsuki: 0 }, steady: { temp: 25, clean: 100, air: 100 },
  nameMax: 8, artMaxChars: 400000, artBudgetChars: 3000000,
};
export const rule = () => ({ ...DEF, ...(balance()?.DREAM || {}) });

const inc = (state, k) => { state.stats[k] = (state.stats[k] || 0) + 1; };
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

/** ゆめの すいそう か */
export const isDreamTank = (t) => !!t && t.water === 'dream';
/** ゆめの しゅるい id か（dream_fish など） */
export const isDreamSpecies = (id) => typeof id === 'string' && /^dream_/.test(id) && (!data() || data().fishById[id]?.obtain === 'dream');
/** ゆめの いきもの か */
export const isDream = (f) => !!f && isDreamSpecies(f.speciesId);

/**
 * ぬりえの もとの しゅるい → うごきの しゅるい。
 * エビ・カニ・ザリガニ・貝（kind shrimp・snail）→ crab、カエル → frog、カメ・スッポン・イモリ・トカゲ → reptile、ほか → fish
 */
export function kindOf(speciesId) {
  if (typeof speciesId === 'string' && speciesId.startsWith('dream_')) { const k = speciesId.slice(6); return KINDS.includes(k) ? k : 'fish'; }
  const sp = data()?.fishById[speciesId];
  if (!sp) return 'fish';
  const n = sp.name || '';
  if (/(ガエル|カエル)$/.test(n)) return 'frog';
  if (n !== 'タガメ' && /([カガ]メ|スッポン|イモリ|トカゲ|ヤモリ)$/.test(n)) return 'reptile';
  if (sp.kind === 'shrimp' || sp.kind === 'snail' || /(エビ|カニ|ザリガニ)$/.test(n)) return 'crab';
  return 'fish';
}

/** ゆめの いきもの ぜんぶ（すいそう＋そうこ＋おやすみすいそう） */
export function allDream(state) {
  return state.tanks.concat(state.storage || []).flatMap((t) => t.fish || []).concat(state.box || []).filter(isDream);
}
// 絵の ながさ（art ＋ もじペンの overlay）。セーブの 大きさの みつもりに つかう
const len = (x) => (typeof x === 'string' ? x.length : 0);
export const infoChars = (d) => len(d?.art) + len(d?.overlay);
const artChars = (state) => allDream(state).reduce((a, f) => a + infoChars(f.dream), 0);
const okImg = (x, R = rule()) => typeof x === 'string' && /^data:image\/(png|webp);base64,/.test(x) && x.length <= R.artMaxChars;

/** ついか できるか。{ ok, reason: 'notDream'|'full'|'max' } */
export function canAdd(state, t) {
  const R = rule();
  if (!isDreamTank(t)) return { ok: false, reason: 'notDream' };
  if ((t.fish || []).length >= (R.maxPerTank ?? 6)) return { ok: false, reason: 'full' };
  if (allDream(state).length >= R.maxCreatures) return { ok: false, reason: 'max' };
  if (artChars(state) >= (R.artBudgetChars ?? 3e6) * 0.95) return { ok: false, reason: 'max' };   // 絵（art＋overlay）で セーブが いっぱいに ちかい
  return { ok: true };
}

/** なまえ：ひらがな・カタカナ（と ー・ゔ）だけ。nameMax もじ まで */
export function cleanName(s) {
  const R = rule();
  return [...String(s ?? '').normalize('NFC').replace(/[^ぁ-ゖゝゞァ-ヺー-ヾ]/g, '')].slice(0, R.nameMax).join('');
}

/** dreamInfo を 約束の 形に そろえる（おかしな ところは ふつうに）。art が つかえなければ null */
export function cleanInfo(info, day = 1) {
  if (!isObj(info)) return null;
  const R = rule();
  const art = okImg(info.art, R) ? info.art : null;
  if (!art) return null;
  const base = typeof info.base === 'string' && data()?.fishById[info.base] && !isDreamSpecies(info.base) ? info.base : null;
  const kind = base ? kindOf(base) : (KINDS.includes(info.kind) ? info.kind : 'fish');
  return {
    art, base, kind,
    ...(okImg(info.overlay, R) ? { overlay: info.overlay } : {}),   // もじペンの そう（art と おなじ 大きさ。なければ 省く）
    speed: SPEEDS.includes(info.speed) ? info.speed : 'normal',
    size: SIZES.includes(info.size) ? info.size : 'm',
    name: cleanName(info.name),
    made: Number.isFinite(info.made) ? Math.max(1, Math.floor(info.made)) : day,
  };
}

/**
 * かいた いきものを すいそうに 入れる。かえす：新しい 魚（f.dream つき）。入れられなければ null。
 * セーブは よぶ がわ（おえかき係）。
 */
export function addCreature(state, t, dreamInfo) {
  const c = canAdd(state, t);
  if (!c.ok) return null;
  const day = gameDay(state.clock.min);
  const info = cleanInfo(dreamInfo, day);
  if (!info) return null;
  if (artChars(state) + infoChars(info) > rule().artBudgetChars) return null;   // セーブが いっぱいに ならない ように
  const f = createFish(state, 'dream_' + info.kind, { source: 'dream' });
  const S0 = rule().start || {};
  for (const k of ['onaka', 'health', 'mood', 'natsuki']) if (Number.isFinite(S0[k])) f[k] = S0[k];
  fixFish(f);
  f.dream = info;
  t.fish.push(f);
  inc(state, 'dreamMade');
  checkMissions(state, []);
  return f;
}

/** ゆめの いきものの きまり：おとな で とめる・キラキラ なし・おおきさの ばらつき なし */
function fixFish(f) {
  f.stage = 1; f.grow = 0; f.shiny = false; f.sizeZ = 0;
}

/** なまえ（から なら しゅるいの なまえ） */
export function nameOf(f) {
  if (!f) return '';
  const sp = data()?.fishById[f.speciesId];
  if (isDream(f)) return f.dream?.name || ({ fish: 'ゆめの さかな', crab: 'ゆめの エビ・カニ', frog: 'ゆめの カエル', reptile: 'ゆめの カメ・トカゲ' })[f.dream?.kind] || sp?.name || '';
  return sp?.name || '';
}

/** えに もどす（かいた 絵を けして かきなおせる）。すいそう t か おやすみすいそう から。{ ok, fish } */
export function release(state, t, uid) {
  const from = t && Array.isArray(t.fish) ? t.fish : null;
  let i = from ? from.findIndex((f) => f.uid === uid) : -1;
  let list = from;
  if (i < 0) { list = state.box || []; i = list.findIndex((f) => f.uid === uid); }
  if (i < 0 || !isDream(list[i])) return { ok: false, reason: 'none' };
  const [f] = list.splice(i, 1);
  inc(state, 'dreamRelease');
  return { ok: true, fish: f };
}

/** すいそうの かたち：'water'（みずだけ）| 'land'（はんぶん りく） */
export function setLayout(state, t, layout) {
  if (!isDreamTank(t) || !LAYOUTS.includes(layout)) return { ok: false, reason: 'none' };
  t.layout = layout;
  return { ok: true, layout };
}

/**
 * ぬりえに えらべる しゅるい：ずかんに のっていて 絵の ある もの（FISH の じゅん）。
 * ゆめ用 4つ と、とくべつ コーナー（premium）で いま もっていない もの は のぞく。
 */
export function baseChoices(state) {
  const D = data();
  if (!D) return [];
  const ownedPremium = new Set(Object.values(state.iap?.owned || {}).map((v) => v?.speciesId).filter(Boolean));
  for (const f of state.tanks.concat(state.storage || []).flatMap((t) => t.fish || []).concat(state.box || [])) ownedPremium.add(f.speciesId);
  return D.FISH.filter((sp) => state.dex?.[sp.id] && sp.texture && !sp.hidden && sp.obtain !== 'dream'
    && (sp.obtain !== 'premium' || ownedPremium.has(sp.id))).map((sp) => sp.id);
}

/** おおきさ（sim.sizeOf の ゆめ版）：えらんだ まま きまっている */
export function sizeInfo(f) {
  const cm = rule().sizeCm?.[f?.dream?.size] ?? rule().sizeCm?.m ?? 6;
  return { cm, maxCm: cm, pct: 50, crown: false, fixed: true, scale: 1, mean: cm, min: cm, max: cm, dream: true, size: f?.dream?.size || 'm' };
}

/** ゆめのすいそうは いつも ちょうど よい（sim の 1ステップごと・よみこみ・もらった とき） */
export function calm(t) {
  const St = rule().steady || {};
  t.temp = St.temp ?? 25; t.clean = St.clean ?? 100; t.air = St.air ?? 100;
  t.leftover = 0; t.waste = 0;
  t.decor = []; t.equip = [];
}

/**
 * プレゼント：5にちめ あさ 6じ いこう、まだ もらって いなければ ゆめのすいそうを 1つ。
 * もらったら state.unlocks.dreamTank = その日（もどさない）・state.notices.dream = { tankId, stored }（画面が おしらせを 出したら けす）。
 * へや＋そうこ が 上限で おけない ときは もらわずに まつ（あきが できたら もらえる）。かえす：もらった すいそう か null
 */
export function checkGift(state, events = []) {
  if (state.unlocks?.dreamTank) return null;
  if (!state.tutorial?.done) return null;
  if (gameDay(state.clock.min) < (rule().giftDay ?? 5)) return null;
  if (state.tanks.concat(state.storage || []).some(isDreamTank)) { state.unlocks = { ...(state.unlocks || {}), dreamTank: gameDay(state.clock.min) }; return null; }
  const t = addTank(state, 'dream', []);
  if (!t) return null;
  t.layout = 'water';
  t.feederOn = false;
  calm(t);
  const stored = t.slot < 0;
  state.unlocks = { ...(state.unlocks || {}), dreamTank: gameDay(state.clock.min) };
  state.notices = { ...(state.notices || {}), dream: { tankId: t.id, stored } };
  events.push({ type: 'dreamGift', tankId: t.id, stored });
  return t;
}

/**
 * sim.normalize から：ゆめのすいそうの 形・ゆめの いきものの f.dream を そろえる。
 * まちがった すいそうに いる 子（ふつうの 魚が ゆめのすいそうに・ゆめの 子が ふつうの すいそうに）は おやすみすいそうへ。
 */
export function normalizeState(state) {
  state.box ||= [];
  for (const t of state.tanks.concat(state.storage || [])) {
    if (isDreamTank(t)) {
      t.layout = LAYOUTS.includes(t.layout) ? t.layout : 'water';
      calm(t);
    }
    const wrong = t.fish.filter((f) => isDream(f) !== isDreamTank(t));
    if (wrong.length) { t.fish = t.fish.filter((f) => !wrong.includes(f)); state.box.push(...wrong); }
  }
  const day = gameDay(state.clock.min);
  for (const f of state.tanks.concat(state.storage || []).flatMap((t) => t.fish).concat(state.box)) {
    if (!isDream(f)) { if ('dream' in f) delete f.dream; continue; }
    const kind = f.speciesId.slice(6);
    const info = cleanInfo({ ...(isObj(f.dream) ? f.dream : {}) }, day);
    // 絵が こわれていても いきものは けさない（ぼんやりした 絵で のこす。3D係は art が '' なら かわりの 形）
    f.dream = info ? { ...info, kind: info.base ? info.kind : kind } : { art: '', base: null, kind, speed: 'normal', size: 'm', name: cleanName(f.dream?.name), made: day, ...(okImg(f.dream?.overlay) ? { overlay: f.dream.overlay } : {}) };
    if (f.dream.kind !== kind) f.speciesId = 'dream_' + f.dream.kind;
    fixFish(f);
  }
}
