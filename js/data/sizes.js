// v0.6 個体差（個体差係）：おおきさの ばらつき・キラキラ・えいよう・えさの すききらい の 数値。
// 計算は js/size.js（純粋関数）。fish.js（図鑑係）は さわらずに、ここで 上書き・きまり を もつ。
//
// おおきさ：ビッグの cm = 平均 × (1 + cv × z)。z = 生まれつき（ふつう分布）＋ そだちボーナス、±zMax で とめる。
//   平均は fish.js の sizeCm[2]（ビッグ）。cv＝ばらつき（平均に たいする 標準偏差の わりあい）。
//   メダカ：平均 4.5・cv 0.11 → σ 0.5cm、±3σ で 3.0〜6.0cm（ユーザーの 例）。
export const SIZE = {
  cv: 0.11,                  // ふつうの ばらつき（σ ÷ 平均）
  cvByKind: { shrimp: 0.09, snail: 0.08 },   // エビ・かいは すこし そろいやすい
  zMax: 3,                   // ±3σ で とめる（はしは とめるだけ。ひきなおし しない）
  crownPct: 90,              // 上位10% ＝ おうかん
  shinyChance: 0.01,         // 手に入れた とき 1% で キラキラ
  // そだちボーナス（σ の たんい）＝ careMaxZ × r − careBaseZ。r＝ビッグまでの えいようの へいきん（0〜1）。
  // −0.2〜＋0.8：生まれつき ±3σ に くらべて ひかえめ。フレークを こまめに（r≈0.45）で ＋0.25、いろいろ＋ビタミン（r≈0.9）で ＋0.7。
  // すこし マイナスも ある（agy：ほったらかし ぎみだと ちいさい きろくも うまる）
  careMaxZ: 1.0, careBaseZ: 0.2,
  oldSaveZScale: 0.8,        // 古い セーブの 魚：uid から きめる z を すこし おだやかに
  oldSaveCare: 0.5,          // 古い セーブで もう ビッグの 魚の えいよう へいきん（ボーナス ＋0.3。Codex・agy とも 0.3）
  // 3D の 見た目：(cm ÷ 平均)^lookPow を lookMin〜lookMax で とめる
  lookPow: 0.8, lookMin: 0.75, lookMax: 1.3,
};

// 種ごとの 上書き：{ mean: ビッグの 平均cm, cv }
export const SIZE_OVERRIDE = {
  medaka: { mean: 4.5 },     // ユーザーの 例（3〜6cm・平均 4.5）
};

// えいよう（魚ごと 0〜100）。ビッグに なるまでの 時間平均が そだちボーナスに なる
export const EIYO = {
  start: 50,
  perHour: -1.5,             // ゲームの 1じかんに へる（1日 −36 ＝ 現実 10ぷん）
  vitamin: { love: 20, ok: 15 },
  loveMul: 1.3,              // だいすきな えさ
  // バランス：さいきん recentN かい（こんかいも 入れる）に たべた えさの しゅるいの かずで ふえる。1しゅるい ×1、2 ×1.25、3 ×1.5、4 ×1.75。
  // おなじ えさの へらしは しない（Codex・agy：すきな えさを くりかえす 子を ばっしない）
  varietyStep: 0.25,
  recentN: 4,
  labels: { good: 'たっぷり', ok: 'ふつう', bad: 'すくない', goodMin: 70, okMin: 35 },
};

// えさ（items.js の food）ごとの えいようと 3D の 見た目（aq.feed の kind）
export const FOODS = {
  // short：えさボタンに 出す みじかい なまえ
  food_flake:   { eiyo: 8, kind: 'flake', short: 'えさ' },
  food_sinking: { eiyo: 8, kind: 'sinking', short: 'しずむ えさ' },
  food_bloodworm: { eiyo: 13, kind: 'bloodworm', short: 'あかむし' },
  food_brine:   { eiyo: 13, kind: 'brine', short: 'ブライン' },
  food_veggie:  { eiyo: 13, kind: 'veggie', short: 'やさい' },
  food_krill:   { eiyo: 14, kind: 'krill', short: 'クリル' },
};
// えさを えらぶ ならび
export const FOOD_ORDER = ['food_flake', 'food_bloodworm', 'food_brine', 'food_veggie', 'food_krill'];

// すききらい：'love' だいすき／'ok' たべる／'no' たべない。
// きまり（kind・水・ビッグの 大きさ）→ 種ごとの 上書き（FOOD_PREF_OVERRIDE）の じゅんで きめる。
// フレーク・しずむ えさ は fish.js の food を そのまま つかう。
export function defaultFoodPref(foodId, sp) {
  const kind = sp.kind || 'fish';
  const salt = sp.water === 'salt';
  const big = (sp.sizeCm && sp.sizeCm[2]) || 4;
  switch (foodId) {
    case 'food_bloodworm':   // あかむし：かわ・いけの さかな だいすき。うみの さかな・エビは たべる。かいは たべない
      if (kind === 'snail') return 'no';
      if (kind === 'shrimp') return 'ok';
      return salt ? 'ok' : 'love';
    case 'food_brine':       // ブラインシュリンプ：うみの さかな だいすき。ちいさな さかな・エビも たべる
      if (kind === 'snail') return 'no';
      if (kind === 'shrimp') return 'ok';
      return salt ? 'love' : 'ok';
    case 'food_veggie':      // やさいタブレット：エビ・かい だいすき。さかなは たべる（にくしょくは 上書きで no）
      if (kind === 'snail' || kind === 'shrimp') return 'love';
      return 'ok';
    case 'food_krill':       // クリル：おおきめの さかな（ビッグ 6cm いじょう）だいすき・4cm みまんは くちに はいらない
      if (kind !== 'fish') return kind === 'shrimp' ? 'ok' : 'no';
      if (big < 4.5) return 'no';
      return big >= 6 ? 'love' : 'ok';
    default: return null;
  }
}

export const FOOD_PREF_OVERRIDE = {
  goldfish: { food_bloodworm: 'love', food_veggie: 'love', food_krill: 'ok' },
  otocinclus: { food_veggie: 'love', food_bloodworm: 'ok', food_brine: 'no' },
  corydoras: { food_bloodworm: 'love', food_veggie: 'ok' },
  albino_corydoras: { food_bloodworm: 'love', food_veggie: 'ok' },
  betta: { food_bloodworm: 'love', food_veggie: 'no' },
  angelfish: { food_bloodworm: 'love', food_brine: 'love', food_veggie: 'ok' },
  platy: { food_veggie: 'love' },
  mandarin: { food_brine: 'love', food_veggie: 'no', food_krill: 'no', food_bloodworm: 'ok' },
  yellow_tang: { food_veggie: 'love', food_krill: 'ok' },
  blue_tang: { food_veggie: 'love', food_krill: 'ok' },
  moorish_idol: { food_veggie: 'love' },
  flame_angel: { food_veggie: 'love' },
  boxfish: { food_krill: 'love' },
  firefish: { food_brine: 'love', food_krill: 'no', food_veggie: 'no' },
  royal_gramma: { food_brine: 'love', food_veggie: 'no' },
  banggai_cardinal: { food_brine: 'love', food_veggie: 'no' },
  pajama_cardinal: { food_brine: 'love', food_veggie: 'no' },
  skunk_shrimp: { food_krill: 'love', food_brine: 'love', food_veggie: 'ok' },
  peppermint_shrimp: { food_krill: 'love', food_brine: 'love', food_veggie: 'ok' },
  white_socks: { food_krill: 'love', food_veggie: 'ok' },
  red_bee_shrimp: { food_krill: 'no' },
  minami_shrimp: { food_krill: 'no' },
};
