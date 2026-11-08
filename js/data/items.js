// 器具・餌・飾り（企画・図鑑係）。画面に出す文字（name / desc）はひらがな・カタカナだけ。
//
// 項目
//   id      : アイコンのファイル名・aq.setDecor() に渡す id と同じ
//   type    : 'heater'|'filter'|'air'|'waterchange'|'decor'|'food'|'light'|'tank'（v0.2：すいそう そのもの）|'feeder'|'fan'|'co2'|'skimmer'（v0.3）
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

  // ---- v0.4：インテリアの 飾り（うみでも つかえる 石・くさ など）。ねだん・こうか は Codex と agy に そうだんして きめた ----
  {
    id: 'seaweed', name: 'うみくさ', type: 'decor', price: 60, water: 'salt', inTank: true, max: 4, tag: 'seaweed',
    effect: { airPerHour: 0.8, cleanPerHour: 0.2 }, // 1こ あたり。みずくさ と おなじ（うみの すいそうの みずくさ）。ライトの 1.5ばいは sim.js しだい
    icon: 'assets/items/seaweed.png',
    desc: 'うみに はえる ほそながい くさ。ゆらゆら ゆれて、くうきを つくり、みずも すこし きれいに するよ。',
  },
  {
    id: 'anemone', name: 'イソギンチャク', type: 'decor', price: 200, water: 'salt', inTank: true, max: 1, tag: 'anemone', unlock: 'tank6',
    effect: { airPerHour: 0.3, cleanPerHour: 0.1 }, // サンゴ と おなじ くらい（からだの なかの ちいさな しょくぶつが ひかりで くうきを つくる）
    icon: 'assets/items/anemone.png',
    desc: 'しょくしゅが ふわふわ ゆれる うみの いきもの。クマノミの なかまが だいすき だよ。',
  },
  {
    id: 'shell', name: 'かいがら', type: 'decor', price: 40, water: 'both', inTank: true, max: 2, tag: 'shell',
    effect: {},
    icon: 'assets/items/shell.png',
    desc: 'ホタテや まきがいの かいがら。すなの うえに おくと かわいいよ。',
  },
  {
    id: 'coral_stone', name: 'サンゴいし', type: 'decor', price: 50, water: 'salt', inTank: true, max: 2, tag: 'stone',
    effect: {},
    icon: 'assets/items/coral_stone.png',
    desc: 'しろい サンゴの かけらの いし。うみの すいそうに ぴったり。そこの さかなが やすめるよ。',
  },
  {
    id: 'color_stone', name: 'いろいし', type: 'decor', price: 40, water: 'both', inTank: true, max: 2, tag: 'stone',
    effect: {},
    icon: 'assets/items/color_stone.png',
    desc: 'ピンクや みずいろの つやつやの こいし。すいそうが はなやかに なるよ。',
  },
  {
    id: 'pot', name: 'つぼ', type: 'decor', price: 90, water: 'both', inTank: true, max: 1, tag: 'cave',
    effect: {},
    icon: 'assets/items/pot.png',
    desc: 'よこに ねかせた やきものの つぼ。なかに かくれられる ひみつの おうち だよ。',
  },

  // ---- v0.5：せの たかい 飾り・器具（さかなが およぐ たかさ まで とどく）。かわ 2・うみ 2。Codex と agy に そうだんして きめた ----
  {
    id: 'ukikusa', name: 'うきくさ', type: 'decor', price: 120, water: 'fresh', inTank: true, max: 2, tag: 'plant',
    effect: { airPerHour: 0.5, cleanPerHour: 0.3 }, // 1こ あたり。すいめんに うかび、ねっこが まんなか まで たれる。ねっこが よごれを すう
    icon: 'assets/items/ukikusa.png',
    desc: 'みずに うかぶ まるい はっぱの くさ。ながい ねっこが たれて、さかなの かくれがに なるよ。',
  },
  {
    id: 'sponge_filter', name: 'スポンジフィルター', type: 'decor', price: 180, water: 'fresh', inTank: true, max: 1, tag: 'stone', unlock: 'tank6',
    effect: { airPerHour: 1.0, cleanPerHour: 0.4 }, // あわで みずを すいあげて、スポンジで こす（ブクブクより よわく、フィルターと ちがって よごれる はやさは かえない）
    icon: 'assets/items/sponge_filter.png',
    desc: 'せの たかい スポンジの フィルター。あわが ぽこぽこ のぼって、みずを きれいに するよ。エビや ちいさい さかなに やさしい。',
  },
  {
    id: 'coral_tree', name: 'サンゴツリー', type: 'decor', price: 180, water: 'salt', inTank: true, max: 1, tag: 'coral', unlock: 'tank6',
    effect: { airPerHour: 0.3, cleanPerHour: 0.2 }, // サンゴと おなじ くらい。せが たかく、まんなかの たかさに えだが ひろがる
    icon: 'assets/items/coral_tree.png',
    desc: 'きのように えだを のばす やわらかい サンゴ。さかなが えだの まわりに あつまるよ。',
  },
  {
    id: 'filter_tower', name: 'ろかタワー', type: 'decor', price: 220, water: 'salt', inTank: true, max: 1, tag: 'liverock', unlock: 'tank6',
    effect: { cleanPerHour: 0.6, airPerHour: 0.4 }, // とうめいな つつの なかの いしで みずを きれいに する（ライブロック 2こ ぶん くらい）
    icon: 'assets/items/filter_tower.png',
    desc: 'とうめいな つつに いしが はいった せの たかい タワー。うみの みずを きれいに して、あわも でるよ。',
  },

  // ---- v0.3：ビタミン剤（へっていく えさ）----
  {
    id: 'food_vitamin', name: 'ビタミン', type: 'food', price: 100, water: 'both', inTank: false, max: 1,
    uses: 5,                                    // 1つ かうと 5かいぶん（つかうと へる。0 に なったら また かう）。もてるのは 5かいぶん まで
    effect: { fill: 0 },                        // おなか は ふえない。そだち・けんこう・ごきげん は balance.js VITAMIN（すききらいで かわる）
    icon: 'assets/items/food_vitamin.png',      // 絵はまだ無い（デザイン係へ）
    desc: 'えいようが たっぷりの とくべつな ごはん。そだちと げんきが ぐんと あがるよ。すききらいが あるよ。1つで 5かいぶん。',
  },

  // ---- v0.4：ビタミンセット（ふつうの 6ばいの かいすうで 5ばいの ねだん）----
  {
    id: 'food_vitamin_set', name: 'ビタミンセット', type: 'food', price: 500, water: 'both', inTank: false, max: 1,
    uses: 30, grants: 'food_vitamin',           // かうと ビタミン（food_vitamin）が 30かいぶん ふえる。つかうのは ふつうの ビタミンと おなじ
    deal: 'おとく',                              // お店の カードに 「おとく」の しるし
    effect: { fill: 0 },
    icon: 'assets/items/food_vitamin_set.png',
    desc: 'ビタミンが 30かいぶん はいった おとくな セット。ふつうに かうより 100コイン おとく だよ。',
  },

  // ---- v0.3：器具 ----
  {
    id: 'auto_feeder', name: 'じどう えさやり', type: 'feeder', price: 200, water: 'both', inTank: true, max: 1, unlock: 'tank6',
    effect: { atHours: [8, 18], below: 50, fill: 15 }, // ゲームの 8じ と 18じ に、おなか < 50 の 魚だけ おなか +15（コイン・なつき・そだち は なし）。スイッチで いり／きり
    icon: 'assets/items/auto_feeder.png',       // 絵はまだ無い（デザイン係へ）
    desc: 'おなかが すいた さかなに、あさと ゆうがた すこしだけ えさを あげて くれるよ。ごはんは じぶんでも あげてね。',
  },
  {
    id: 'fan', name: 'クーラーファン', type: 'fan', price: 180, water: 'both', inTank: true, max: 1, unlock: 'tank6',
    effect: { needsHeater: true },              // ヒーターと いっしょの ときだけ はたらく：おんど ダイヤル（balance.js THERMO）が つかえる。ファンだけ なら なにも しない
    icon: 'assets/items/fan.png',               // 絵はまだ無い（デザイン係へ）
    desc: 'ヒーターと いっしょに つかうと、みずの あたたかさを えらべるよ。さかなに ぴったりに すると よろこぶよ。',
  },
  {
    id: 'co2_kit', name: 'シーオーツー', type: 'co2', price: 250, water: 'fresh', inTank: true, max: 1, unlock: 'tank6',
    effect: { plantAirBoost: 1.5, moodBonusPlantLovers: 5 }, // みずくさ の くうき だけ 1.5ばい（ライトと かけあわせ。きれいさ は ふやさない）、みずくさ が すきな 魚の ごきげん +5。みずくさ が 0 なら こうか なし
    icon: 'assets/items/co2_kit.png',           // 絵はまだ無い（デザイン係へ）
    desc: 'みずくさと セットで つかうよ。みずくさが げんきに なって、くうきが ふえるよ。',
  },
  {
    id: 'skimmer', name: 'プロテインスキマー', type: 'skimmer', price: 250, water: 'salt', inTank: true, max: 1, unlock: 'tank6',
    effect: { dirtMultiplier: 0.8, leftoverPerHour: 0.1, airPerHour: 0.5 }, // くうき +0.5/時間（あわ） // よごれる はやさ 0.8ばい（フィルターと かけあわせ 0.4。みずかえ が いらなく ならない ように）、たべのこし −0.1/時間
    icon: 'assets/items/skimmer.png',           // 絵はまだ無い（デザイン係へ）
    desc: 'こまかい あわで うみの みずの よごれを とって くれるよ。',
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
