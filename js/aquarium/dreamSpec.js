// v0.8 3D係：ゆめの いきもの（f.dream）の 「うごき と 大きさ」を きめる（DOM・GPU に よらない。tests/v08_3d.test.js）。
//   base あり（ぬりえ）：もとの しゅるいの spec（swim・厚み・round・habit）を そのまま。絵だけ f.dream.art。
//   base なし（オリジナル）：ひらたい いた（flat）。kind で うごきを きめる。
// 大きさは ゆめ係の sim.sizeOf と あわせる（s 3cm・m 6cm・l 10cm）。3D の 全長は swim.js fishLength の 式（0.55 + cm×0.2）。

export const DREAM_SPEED = { slow: 0.6, normal: 1, fast: 1.6 };
export const DREAM_SIZE_CM = { s: 3, m: 6, l: 10 };
export const DREAM_KINDS = ['fish', 'crab', 'frog', 'reptile'];

// オリジナルの kind → swim.js が わかる しゅるい・すむ ところ。
//   fish：ふつうに およぐ。crab：そこを あるく（エビの しくみ＝kind 'shrimp'）。
//   frog：りくで ぴょん・みずでは およぐ（habit 'land' ＋ hop）。reptile：りくを あるく・みずでは ゆっくり（habit 'land'）。
//   v0.10 limb：水の 中では 足で 泳ぐ（frog＝けって すべる、reptile＝カメの ように 漕ぐ）。
//   りくが ない ゆめのすいそう では、land の 子は みずの 中（frog）と 底ちかく（reptile）で すごす（swim.js の ふつうの およぎ）。
export const DREAM_KIND_SPEC = {
  fish:    { kind: 'fish',   look: { lengthToHeight: 2.6, thickness: 0.2 },  swim: { layer: 'middle', speed: 0.9, school: false } },
  crab:    { kind: 'shrimp', look: { lengthToHeight: 1.6, thickness: 0.3 },  swim: { layer: 'bottom', speed: 0.45, school: false } },
  frog:    { kind: 'fish',   look: { lengthToHeight: 1.8, thickness: 0.4 },  swim: { layer: 'middle', speed: 0.6, school: false, habit: 'land', hop: true, limb: 'frog' } },
  reptile: { kind: 'fish',   look: { lengthToHeight: 2.4, thickness: 0.45 }, swim: { layer: 'bottom', speed: 0.4, school: false, habit: 'land', limb: 'turtle' } },
};
// 最後の はやさ（もとの はやさ × 倍率）の はば。おそい しゅるい × slow で とまって 見えない ように（agy）。貝（crawl）は のぞく
export const DREAM_SPEED_RANGE = [0.35, 1.8];

// 見た目の 大きさの そろえ（Codex・agy：ひらたい いたは 絵が 大きく 見え、ぬりえの 立体は ほそく 小さく 見える → 1.4倍くらいの 差を うめる）。
// s<m<l の じゅんばんは かわらない。sim.sizeOf の cm は そのまま（3D の 見た目だけ）
export const DREAM_LOOK_MUL = { flat: 0.85, model: 1.2 };
export const dreamLookMul = (d) => (d && d.base ? DREAM_LOOK_MUL.model : DREAM_LOOK_MUL.flat);

const clampSpeed =(v) => Math.min(DREAM_SPEED_RANGE[1], Math.max(DREAM_SPEED_RANGE[0], v));
const pick = (map, k, d) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : d);
export const dreamSpeedMul = (speed) => pick(DREAM_SPEED, speed, 1);
export const dreamSizeCm = (size) => pick(DREAM_SIZE_CM, size, DREAM_SIZE_CM.m);
export const dreamKind = (kind) => (DREAM_KINDS.includes(kind) ? kind : 'fish');

/** 見た目を つくりなおす ひつようが あるか くらべる ための かぎ（絵・もと・しゅるい・はやさ・おおきさ）。 */
export function dreamKey(d) {
  if (!d) return '';
  const art = typeof d.art === 'string' ? d.art : '';
  const ov = typeof d.overlay === 'string' ? d.overlay : '';   // もじペンの 層（v0.8 追加）
  return [d.base || '-', dreamKind(d.kind), d.speed || 'normal', d.size || 'm', art.length, art.slice(-40), ov.length, ov.slice(-40)].join('|');
}

/**
 * ゆめの いきもの 1ぴきぶんの spec を つくる。
 * @param {object} d        f.dream
 * @param {object|null} baseSpec  ぬりえ の もとの しゅるいの spec（mergeSpec ずみ）。オリジナル なら null
 * @param {string} uid
 */
export function dreamSpec(d, baseSpec, uid) {
  const mul = dreamSpeedMul(d?.speed);
  const cm = dreamSizeCm(d?.size);
  const kind = dreamKind(d?.kind);
  const id = 'dream~' + uid;   // 1ぴきごとに べつの 見た目（むれ にも ならない）
  if (d?.base && baseSpec) {
    const swim = { ...(baseSpec.swim || {}), school: false };
    swim.speed = (swim.speed ?? 1) * mul;
    if (baseSpec.kind !== 'snail' && swim.habit !== 'crawl') swim.speed = clampSpeed(swim.speed);
    if (kind === 'frog' && swim.habit === 'land') swim.hop = true;   // カエルの ぬりえも りくでは ぴょん
    // water は 'dream'（うみの さかなの ×1.2 を かさねない。大きさは えらんだ cm だけで きまる）
    return {
      ...baseSpec, id, baseId: baseSpec.id, water: 'dream', texture: null, sizeCm: [cm, cm, cm],
      look: { ...(baseSpec.look || {}) }, swim,
      dream: { flat: false, kind, mul, cm },
    };
  }
  const k = DREAM_KIND_SPEC[kind];
  return {
    id, name: d?.name || '', kind: k.kind, water: 'dream', texture: null, sizeCm: [cm, cm, cm],
    look: { ...k.look, finStyle: 'flat' }, swim: { ...k.swim, speed: clampSpeed(k.swim.speed * mul) },
    dream: { flat: true, kind, mul, cm },
  };
}
