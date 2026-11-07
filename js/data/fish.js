// 魚・エビの図鑑データ（企画・図鑑係）。id と texture はまとめ役が決めたもの。変えない。
// 画面に出す文字（name / intro / hint）はひらがな・カタカナだけ。
//
// 追加の項目（docs/設計.md の形に足したもの。くわしくは docs/仕様_v0.1.md）
//   appetite : おなかの へりかたの倍率（1.0 = ふつう）
//   space    : すいそうの ばしょを どれだけ使うか（すいそう1つ = balance.js の TANK.capacity）
//   likes    : すきな 飾りのタグ（items.js の tag）。入っていると ごきげん が上がる
//   cleanMin : きれいさ が これより下だと けんこう が下がりはじめる（ふつうは 40）
//   price    : null のものはお店に出さない（海水の魚は後の版）
export const FISH = [
  {
    id: 'medaka', name: 'メダカ', kind: 'fish', water: 'fresh', rarity: 1, price: 50,
    temp: { min: 15, max: 30, best: 24 }, food: ['food_flake'],
    growDays: [2, 4], sizeCm: [1.5, 3, 4], appetite: 0.8, space: 1, likes: ['plant'], cleanMin: 40,
    look: { lengthToHeight: 4.2, thickness: 0.17, finStyle: 'normal' }, swim: { layer: 'top', speed: 1.0, school: true },
    texture: 'assets/fish/medaka.png',
    intro: 'にほんの おがわや たんぼに すむ ちいさな さかな。みんなで むれて およぐよ。',
    hint: 'さむさに つよいよ。はじめての さかなに ぴったり。',
  },
  {
    id: 'guppy', name: 'グッピー', kind: 'fish', water: 'fresh', rarity: 1, price: 80,
    temp: { min: 20, max: 28, best: 25 }, food: ['food_flake'],
    growDays: [2, 5], sizeCm: [1.5, 3.5, 5], appetite: 1.0, space: 1, likes: ['plant'], cleanMin: 40,
    look: { lengthToHeight: 3.2, thickness: 0.16, finStyle: 'fan' }, swim: { layer: 'top', speed: 1.0, school: true },
    texture: 'assets/fish/guppy.png',
    intro: 'しっぽが おうぎのように ひろがる、カラフルな さかな。',
    hint: 'あたたかい みずが すき。ヒーターを いれてあげてね。',
  },
  {
    id: 'neon_tetra', name: 'ネオンテトラ', kind: 'fish', water: 'fresh', rarity: 1, price: 60,
    temp: { min: 21, max: 28, best: 25 }, food: ['food_flake'],
    growDays: [2, 5], sizeCm: [1.2, 3, 4], appetite: 0.8, space: 1, likes: ['plant', 'driftwood'], cleanMin: 40,
    look: { lengthToHeight: 4.0, thickness: 0.17, finStyle: 'normal' }, swim: { layer: 'middle', speed: 1.1, school: true },
    texture: 'assets/fish/neon_tetra.png',
    intro: 'あおと あかに ひかる ちいさな さかな。なかまと むれて およぐよ。',
    hint: 'なかまが いると あんしんするよ。なんびきか いっしょに かってあげよう。',
  },
  {
    id: 'goldfish', name: 'キンギョ', kind: 'fish', water: 'fresh', rarity: 1, price: 100,
    temp: { min: 10, max: 28, best: 23 }, food: ['food_flake'],
    growDays: [3, 7], sizeCm: [3, 8, 12], appetite: 1.1, space: 2, likes: ['stone', 'plant'], cleanMin: 40,
    look: { lengthToHeight: 2.6, thickness: 0.30, finStyle: 'long' }, swim: { layer: 'any', speed: 0.7, school: false },
    texture: 'assets/fish/goldfish.png',
    intro: 'ながい しっぽで ゆったり およぐ、むかしから にんきの さかな。',
    hint: 'よく たべて みずが よごれやすいよ。みずかえを わすれずに。',
  },
  {
    id: 'corydoras', name: 'コリドラス', kind: 'fish', water: 'fresh', rarity: 2, price: 150,
    temp: { min: 21, max: 28, best: 24 }, food: ['food_flake', 'food_sinking'],
    growDays: [3, 6], sizeCm: [2, 4, 6], appetite: 1.0, space: 1, likes: ['stone', 'driftwood'], cleanMin: 40,
    look: { lengthToHeight: 2.8, thickness: 0.28, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.8, school: true },
    texture: 'assets/fish/corydoras.png',
    intro: 'そこの すなを ほりほりしながら およぐ、ひげの ある さかな。',
    hint: 'そこに おちた たべのこしを たべて くれるよ。',
  },
  {
    id: 'minami_shrimp', name: 'ミナミヌマエビ', kind: 'shrimp', water: 'fresh', rarity: 1, price: 60,
    temp: { min: 12, max: 28, best: 23 }, food: ['food_flake', 'food_sinking'],
    growDays: [2, 5], sizeCm: [0.8, 2, 3], appetite: 0.5, space: 0.5, likes: ['plant', 'stone'], cleanMin: 40,
    look: { lengthToHeight: 4.0, thickness: 0.20, finStyle: 'shrimp' }, swim: { layer: 'bottom', speed: 0.5, school: false },
    texture: 'assets/fish/minami_shrimp.png',
    intro: 'すきとおった からだの ちいさな エビ。こけを つまんで たべるよ。',
    hint: 'みずくさが あると よろこぶよ。たべのこしも たべて くれるよ。',
  },
  {
    id: 'betta', name: 'ベタ', kind: 'fish', water: 'fresh', rarity: 2, price: 250,
    temp: { min: 24, max: 30, best: 27 }, food: ['food_flake'],
    growDays: [3, 7], sizeCm: [2, 5, 7], appetite: 0.9, space: 1, likes: ['plant', 'driftwood'], cleanMin: 40,
    look: { lengthToHeight: 2.2, thickness: 0.16, finStyle: 'long' }, swim: { layer: 'top', speed: 0.6, school: false },
    texture: 'assets/fish/betta.png',
    intro: 'ドレスのような ひれを ひろげる、うつくしい さかな。',
    hint: 'ベタどうしは けんかしちゃうよ。1ぴきで かってあげてね。',
  },
  {
    id: 'angelfish', name: 'エンゼルフィッシュ', kind: 'fish', water: 'fresh', rarity: 2, price: 300,
    temp: { min: 24, max: 29, best: 26 }, food: ['food_flake'],
    growDays: [4, 8], sizeCm: [3, 8, 12], appetite: 1.2, space: 2, likes: ['plant', 'driftwood'], cleanMin: 40,
    look: { lengthToHeight: 1.0, thickness: 0.12, finStyle: 'tall' }, swim: { layer: 'middle', speed: 0.6, school: false },
    texture: 'assets/fish/angelfish.png',
    intro: 'たかい ひれで ゆうがに およぐ、てんしの なまえの さかな。',
    hint: 'ちいさな さかなを おいかけることが あるよ。なかよしの あいてを えらんでね。',
  },
  {
    id: 'red_bee_shrimp', name: 'レッドビーシュリンプ', kind: 'shrimp', water: 'fresh', rarity: 4, price: 600,
    temp: { min: 18, max: 26, best: 23 }, food: ['food_flake', 'food_sinking'],
    growDays: [3, 7], sizeCm: [0.8, 2, 3], appetite: 0.5, space: 0.5, likes: ['plant', 'driftwood', 'stone'], cleanMin: 60,
    look: { lengthToHeight: 4.0, thickness: 0.20, finStyle: 'shrimp' }, swim: { layer: 'bottom', speed: 0.5, school: false },
    texture: 'assets/fish/red_bee_shrimp.png',
    intro: 'あかと しろの しまもようが きれいな、めずらしい エビ。',
    hint: 'きれいな みずが だいすき。みずかえを こまめに してあげてね。',
  },
  {
    id: 'albino_corydoras', name: 'アルビノコリドラス', kind: 'fish', water: 'fresh', rarity: 3, price: 300,
    temp: { min: 21, max: 28, best: 24 }, food: ['food_flake', 'food_sinking'],
    growDays: [3, 6], sizeCm: [2, 4, 6], appetite: 1.0, space: 1, likes: ['stone', 'driftwood'], cleanMin: 40,
    look: { lengthToHeight: 2.8, thickness: 0.28, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.8, school: true },
    texture: 'assets/fish/albino_corydoras.png',
    intro: 'からだが しろっぽい ピンクいろの、めずらしい コリドラス。',
    hint: 'なかまの コリドラスと いっしょだと よろこぶよ。',
  },

  // ---- ここから後の版（海水）。絵はまだ無い。price: null なのでお店に出ない ----
  {
    id: 'clownfish', name: 'カクレクマノミ', kind: 'fish', water: 'salt', rarity: 2, price: null,
    temp: { min: 24, max: 28, best: 26 }, food: ['food_flake'],
    growDays: [3, 6], sizeCm: [2, 5, 8], appetite: 1.0, space: 1, likes: ['coral', 'liverock'], cleanMin: 50,
    look: { lengthToHeight: 2.6, thickness: 0.24, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.8, school: false },
    texture: 'assets/fish/clownfish.png',
    intro: 'オレンジと しろの しまもよう。イソギンチャクの なかに かくれるよ。',
    hint: 'うみの みずで かうよ。',
  },
  {
    id: 'blue_tang', name: 'ナンヨウハギ', kind: 'fish', water: 'salt', rarity: 3, price: null,
    temp: { min: 24, max: 28, best: 26 }, food: ['food_flake'],
    growDays: [4, 8], sizeCm: [3, 10, 15], appetite: 1.2, space: 2, likes: ['liverock', 'coral'], cleanMin: 50,
    look: { lengthToHeight: 1.8, thickness: 0.14, finStyle: 'normal' }, swim: { layer: 'middle', speed: 1.0, school: false },
    texture: 'assets/fish/blue_tang.png',
    intro: 'あざやかな あおいろの からだに きいろい しっぽ。',
    hint: 'ひろい ところを およぐのが すきだよ。',
  },
  {
    id: 'skunk_shrimp', name: 'スカンクシュリンプ', kind: 'shrimp', water: 'salt', rarity: 3, price: null,
    temp: { min: 23, max: 28, best: 25 }, food: ['food_flake', 'food_sinking'],
    growDays: [3, 6], sizeCm: [1.5, 3.5, 5], appetite: 0.6, space: 0.5, likes: ['liverock'], cleanMin: 50,
    look: { lengthToHeight: 4.0, thickness: 0.20, finStyle: 'shrimp' }, swim: { layer: 'bottom', speed: 0.5, school: false },
    texture: 'assets/fish/skunk_shrimp.png',
    intro: 'せなかに しろい せんが ある、うみの おそうじエビ。',
    hint: 'ほかの さかなの からだを おそうじ してくれるよ。',
  },
];
