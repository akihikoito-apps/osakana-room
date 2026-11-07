// 器具・餌・飾り（企画・図鑑係）。画面に出す文字（name / desc）はひらがな・カタカナだけ。
//
// 項目
//   id      : アイコンのファイル名・aq.setDecor() に渡す id と同じ
//   type    : 'heater'|'filter'|'air'|'waterchange'|'decor'|'food'|'light'|'tank'（v0.2：すいそう そのもの）
//   price   : お店の値段。null は売っていない（後の版）
//   water   : 'fresh'|'salt'|'both'  どちらの すいそうで使えるか
//   inTank  : true なら すいそうに入れるもの（aq.setDecor に id を渡す）。false は道具（ボタンになる）
//   max     : 1つの すいそうに いくつまで入れられるか（道具は 1 = 1こ持てばずっと使える）
//   tag     : 魚の likes と比べるタグ（飾りだけ）
//   tutorialFree : チュートリアル中の 1こめは 0コイン（「プレゼント」の ふだ、ボタンは「うけとる」）
//   effect  : 数値の効果。単位はゲーム内1時間あたり（perHour）か、1回あたり（once）。計算は docs/仕様_v0.1.md
//   icon    : 絵。まだ無いものは仮の絵のパス（コメントに書いた）
//   unlock  : （v0.2）お店に ならぶ 条件。無い＝はじめから。'tank6'＝balance.js UNLOCK.tank6
//   includes: （v0.2・type 'tank' だけ）かったとき その すいそうに はじめから 入っている もの
export const ITEMS = [
  // ---- 道具（すいそうには入れない。持っていると ボタンが出る）----
  {
    id: 'food_flake', name: 'えさ', type: 'food', price: 40, water: 'both', inTank: false, max: 1,   // チュートリアルで 魚と いっしょに もらう
    effect: { fill: 30 },                      // 食べた魚の おなか +30（1回の えさやりで）
    icon: 'assets/items/food_flake.png',
    desc: 'さかなの ごはん。ずっと つかえるよ。おなかが すいたら あげよう。',
  },
  {
    id: 'water_change', name: 'みずかえセット', type: 'waterchange', price: 80, water: 'both', inTank: false, max: 1, tutorialFree: true,
    effect: { clean: 40, clearLeftover: true }, // 1回で きれいさ +40、たべのこし を 0 に
    icon: 'assets/items/water_change.png',
    desc: 'よごれた みずを あたらしい みずに かえるよ。みずが ピカピカに なる。',
  },
  {
    id: 'food_sinking', name: 'しずむ えさ', type: 'food', price: null, water: 'both', inTank: false, max: 1,
    effect: { fill: 35 },                      // 後の版：そこの魚・エビ用（food に food_sinking がある魚だけ）
    icon: 'assets/items/food_sinking.png',     // 絵はまだ無い
    desc: 'そこに しずむ ごはん。そこに いる さかなや エビが たべやすいよ。',
  },

  // ---- 器具（すいそうに入れる）----
  {
    id: 'air_pump', name: 'ブクブク', type: 'air', price: 120, water: 'both', inTank: true, max: 1, tutorialFree: true,
    effect: { airPerHour: 3 },
    icon: 'assets/items/air_pump.png',
    desc: 'みずに あわを おくって、くうきを たっぷりに するよ。',
  },
  {
    id: 'heater', name: 'ヒーター', type: 'heater', price: 150, water: 'both', inTank: true, max: 1, tutorialFree: true,
    effect: { targetTemp: 25, tempPerHour: 1 }, // すいおん を 25ど に むけて 1じかんに 1ど ずつ
    icon: 'assets/items/heater.png',
    desc: 'みずを ちょうどよい あたたかさ（25ど）に して くれるよ。',
  },
  {
    id: 'filter', name: 'フィルター', type: 'filter', price: 200, water: 'both', inTank: true, max: 1,
    effect: { dirtMultiplier: 0.5, airPerHour: 0.5, leftoverPerHour: 0.2 }, // よごれる はやさ はんぶん、たべのこし を 5じかんで 1こ かたづける
    icon: 'assets/items/filter.png',
    desc: 'みずが よごれにくく なるよ。みずかえは ときどきで よくなるよ。',
  },
  {
    id: 'light', name: 'ライト', type: 'light', price: 150, water: 'both', inTank: true, max: 1,
    effect: { moodBonus: 5, plantBoost: 1.5, light: 1.0 }, // ごきげん +5、みずくさの こうか 1.5ばい、aq.setWater({light}) に 1.0
    icon: 'assets/items/light.png',
    desc: 'すいそうを あかるく てらすよ。みずくさが げんきに なって、さかなも うれしい。',
  },

  // ---- 飾り（すいそうに入れる）----
  {
    id: 'stone', name: 'いし', type: 'decor', price: 30, water: 'both', inTank: true, max: 2, tag: 'stone', tutorialFree: true,
    effect: {},                                 // すきな魚の ごきげん が上がる（likes）
    icon: 'assets/items/stone.png',
    desc: 'まるい かわの いし。そこの さかなが かくれたり やすんだり できるよ。',
  },
  {
    id: 'plant', name: 'みずくさ', type: 'decor', price: 60, water: 'fresh', inTank: true, max: 4, tag: 'plant',
    effect: { airPerHour: 0.8, cleanPerHour: 0.2 }, // 1こ あたり。ライトが あると 1.5ばい
    icon: 'assets/items/plant.png',
    desc: 'みどりの みずくさ。くうきを つくって、みずも すこし きれいに するよ。',
  },
  {
    id: 'driftwood', name: 'りゅうぼく', type: 'decor', price: 100, water: 'fresh', inTank: true, max: 1, tag: 'driftwood',
    effect: {},
    icon: 'assets/room/driftwood.png',          // アイコンの絵はまだ無いので すいそう用の絵を仮に使う
    desc: 'かわで ながれて きた き。エビや そこの さかなの おきにいり。',
  },
  {
    id: 'rock', name: 'おおきな いわ', type: 'decor', price: 80, water: 'both', inTank: true, max: 1, tag: 'stone',
    effect: {},
    icon: 'assets/items/stone.png',             // 仮の絵
    desc: 'どっしりした おおきな いわ。',
  },

  // ---- 海水用（v0.2：うみの すいそう だけで かえる）----
  {
    id: 'liverock', name: 'ライブロック', type: 'decor', price: 150, water: 'salt', inTank: true, max: 2, tag: 'liverock', unlock: 'tank6',
    effect: { cleanPerHour: 0.3 },              // 1こ あたり。きれいさ +0.3/時間（フィルターと あわせても みずかえ が ときどき いる くらい）
    icon: 'assets/items/liverock.png',
    desc: 'うみの いわ。ちいさな いきものが すんでいて、みずを きれいに して くれるよ。',
  },
  {
    id: 'coral', name: 'サンゴ', type: 'decor', price: 120, water: 'salt', inTank: true, max: 2, tag: 'coral', unlock: 'tank6',
    effect: { airPerHour: 0.3, cleanPerHour: 0.1 }, // 1こ あたり。くうき +0.3・きれいさ +0.1/時間（ライトで 1.5ばい。みずくさ と おなじ あつかい）
    icon: 'assets/items/coral.png',             // 絵はまだ無い（デザイン係へ）
    desc: 'いろあざやかな サンゴ。うみの さかなが よろこぶよ。',
  },

  // ---- すいそう（v0.2）。かうと へやに すいそうが ふえる（balance.js TANKS）----
  {
    id: 'tank_fresh', name: 'かわの すいそう', type: 'tank', price: 800, water: 'fresh', inTank: false, max: 5, unlock: 'tank6',
    includes: ['heater', 'air_pump'],           // ヒーターと ブクブクつき（あたらしい すいそうで さむくならないように）
    effect: {},
    icon: 'assets/items/tank_fresh.png',        // 絵はまだ無い（デザイン係へ）
    desc: 'かわや いけの いきものの すいそう。ヒーターと ブクブクが ついているよ。',
  },
  {
    id: 'tank_salt', name: 'うみの すいそう', type: 'tank', price: 1000, water: 'salt', inTank: false, max: 5, unlock: 'tank6',
    includes: ['heater', 'air_pump'],
    effect: {},
    icon: 'assets/items/tank_salt.png',         // 絵はまだ無い（デザイン係へ）
    desc: 'うみの みずの すいそう。うみの さかなが かえるよ。ヒーターと ブクブクが ついているよ。',
  },
];
