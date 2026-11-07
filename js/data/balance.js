// 数値の決まり（企画・図鑑係）。ゲーム係の sim.js はここだけを見て計算する。
// 変化量はすべて「ゲーム内1時間あたり（perHour）」。sim.tick(state, gameMinutes) では × gameMinutes / 60 する。
// 計算の手順は docs/仕様_v0.1.md の「2. 数値の変化」に書いた。数値を変えるときはこのファイルだけ直す。

// ---------------- 時間 ----------------
export const TIME = {
  stopDuringTutorial: true,    // チュートリアル中は 時計を とめる（よむのが ゆっくりな子のため）
  realSecPerGameDay: 600,      // ゲームの1日 ＝ 現実10分
  realSecPerGameHour: 25,      // 600 / 24
  gameMinPerRealSec: 2.4,      // 1440 / 600
  dayStartHour: 6,             // ゲーム開始の時刻（はじめて遊んだときの時計 6:00）
};

// ---------------- はじめの状態 ----------------
export const START = {
  coins: 200,                  // 最初の所持コイン
  roomTemp: 20,                // へやの温度（v0.1 はずっと 20ど）
  waterTemp: 20,               // 水槽の水温
  clean: 100,                  // きれいさ
  air: 70,                     // くうき
  leftover: 0,                 // たべのこし（こ）
  fish: { onaka: 60, health: 80, mood: 60, natsuki: 0 },   // 買ったばかりの魚
};

// ---------------- すいそう ----------------
export const TANK = {
  capacity: 6,                 // 魚の space の合計がこれまで（メダカ6ぴき、キンギョ3びき、エビは12ひき）
};

// ---------------- すいおん ----------------
export const TEMP = {
  towardRoomPerHour: 0.5,      // ヒーターなし：へやの温度に むけて 1じかんに 0.5ど 近づく
  // ヒーターあり：items.js heater.effect（25ど に むけて 1ど/じかん）
  bestRange: 2,                // best ± 2ど 以内 ＝「ぴったり」
  farOut: 3,                   // min/max から 3ど 以上はずれたら「とても さむい／あつい」
};

// ---------------- きれいさ（0〜100） ----------------
export const CLEAN = {
  basePerHour: -0.3,           // なにもしなくても すこし よごれる
  perSpacePerHour: -0.4,       // 魚の space 1 あたり（キンギョは space 2 なので -0.8）
  perLeftoverPerHour: -1.5,    // たべのこし 1こ あたり
  leftoverMax: 5,              // たべのこし は 5こ まで たまる
  cleanerIds: ['corydoras', 'albino_corydoras', 'minami_shrimp', 'red_bee_shrimp', 'skunk_shrimp'],  // v0.2 で スカンクシュリンプを 足した（かい は SNAIL）
  cleanerLeftoverPerHour: 0.125, // そうじやの魚 1ぴきで たべのこし を 8じかんで 1こ たべる
  scoopClean: 0,               // 「そうじ」（あみで たべのこしを すくう）：たべのこし 0 にするだけ（きれいさ は ふえない。コインも なし）
  // フィルターは よごれる はやさ（basePerHour＋perSpace＋perLeftover の合計）を filter.effect.dirtMultiplier 倍（0.5）にする
  // みずくさ・みずかえ の量は items.js の effect
};

// ---------------- くうき（0〜100） ----------------
export const AIR = {
  naturalPerHour: 0.6,         // 水面から 入る くうき（くうき が naturalCap より下のときだけ）
  naturalCap: 60,
  perSpacePerHour: -0.5,       // 魚の space 1 あたり
  // ブクブク +3、フィルター +0.5、みずくさ 1こ +0.8（ライトで 1.5ばい）は items.js
};

// ---------------- おなか（魚ごと、0〜100） ----------------
export const HUNGER = {
  perHour: -3.5,               // × fish.appetite（メダカ -2.8、キンギョ -3.85、エビ -1.75）
  full: 90,                    // これ以上は たべない。全員が full 以上なら えさボタンは「みんな おなか いっぱい」と出して えさを おとさない
  rewardBelow: 80,             // これより すいている魚が たべたら「えさやり」の ごほうび・なつき の対象
  // 1回の えさやりで 1ぴき1回だけ おなか += items.js の food_flake.effect.fill（30）。上限 100
  leftoverIfHalfFull: 0.5,     // えさを おとした とき、たべなかった（full 以上の）魚が 半分以上 いたら たべのこし +0.5
  feedLockRealSec: 5,          // えさボタンを おしてから 5びょうは おせない（1回の えさやり）
};

// ---------------- けんこう（魚ごと、10〜100） ----------------
export const HEALTH = {
  min: 10,                     // ぜったいに これより下がらない（死なない）
  max: 100,
  weak: 40,                    // これより下 ＝「げんきが ない」（よわっている）
  good: 70,                    // これ以上 ＝「げんき」
  // 1じかんごとに 下の「わるいこと」を足す（いちばん重いものだけでなく、ぜんぶ足す）
  bad: {
    tempOut: -2,               // すいおん が min〜max の そと
    tempFarOut: -3,            // TEMP.farOut 以上 はずれ（tempOut の かわりに）
    dirty: -1.5,               // きれいさ < fish.cleanMin
    veryDirty: -3,             // きれいさ < 20（dirty の かわりに）
    airLow: -2,                // くうき < 30
    airVeryLow: -3,            // くうき < 15（airLow の かわりに）
    starving: -1.5,            // おなか < 10
    nigate: 0,                 // にがて は けんこう に えいきょう しない（v0.1 は 魚を てばなせないので、なおせない ことで よわらせない）。ごきげん だけ
  },
  badCapPerHour: -3,           // わるいこと の合計は 1じかんに -3 まで
  recoverPerHour: 4,           // わるいことが 1つも ない（10→40 は 7.5じかん＝3ぷん）
  recoverBestPerHour: 6,       // さらに「ぜんぶ ぴったり」（下の best の条件）
  best: { clean: 70, air: 50, onaka: 30 },  // ＋すいおん が ぴったり（best ± 2）
};

// ---------------- ごきげん（魚ごと、0〜100） ----------------
// 目標値 target を計算して、1じかんに approachPerHour ずつ近づける
export const MOOD = {
  base: 50,
  approachPerHour: 5,
  temp: { best: 15, ok: 0, out: -20 },          // ぴったり／はんい内／はんい外
  clean: { high: 70, highBonus: 10, low: 40, lowPenalty: -15 },
  air: { high: 50, highBonus: 5, low: 30, lowPenalty: -15 },
  onaka: { high: 50, highBonus: 5, low: 20, lowPenalty: -15 },
  likePerDecor: 5, likeMax: 15,                 // すきな飾り 1しゅるい +5（さいだい +15）
  friendPerMate: 5, friendMax: 10,              // なかよし（相性2）の あいて 1ぴき +5（さいだい +10）
  nigatePerMate: -10, nigateMin: -20,           // にがて（相性0）の あいて 1ぴき -10（ごうけい -20 まで）
  light: 5,                                     // ライトが ある（items.js light.effect.moodBonus と同じ）
  happy: 70,                                    // これ以上 ＝「ごきげん」
  sad: 30,                                      // これより下 ＝「しょんぼり」
};

// ---------------- なつき（魚ごと、0〜100） ----------------
export const BOND = {
  feed: 2, feedPerDay: 5,        // おなか < 80（HUNGER.rewardBelow）の ときに たべた：+2（1日 5かい まで）
  pet: 1, petPerDay: 5,          // 魚を タップ（なでる）：+1（1日 5かい まで、おなじ魚は 30びょう あける）
  petCooldownRealSec: 30,
  waterChange: 1, waterChangePerDay: 2, // みずかえ（きれいさ < 85 の とき）：全員 +1
  // なつき は へらない（つみかさねた なかよしを うしなわせない）
  heartStep: 20,                 // ハート1こ ＝ 20（0〜5こ で見せる）
};

// ---------------- なかよし（魚ごと、相性表から毎回計算） ----------------
export const NAKAYOSHI = {
  value: { 0: 20, 1: 60, 2: 100 },   // いっしょの すいそうの あいて全員の 平均
  alone: 50,                          // 1ぴきだけ
  aloneSchool: 40,                    // 1ぴきだけで swim.school: true の魚（ヒント「なかまが ほしい」）
  // 同じ種類どうしも 相性表で数える（'medaka|medaka' など）
};

// ---------------- 成長 ----------------
// 「そだち」ゲージ（時間）を ためていく つみあげ式。日ごとの 合格・不合格は ない。へらない。
export const GROW = {
  goodHour: { onaka: 20, health: 60, tempInRange: true },  // よい時間：おなか≥20 かつ けんこう≥60 かつ すいおんが min〜max の 1じかん ＝ +1
  feedBonusHours: 2,             // えさを たべて おなかが ふえた とき +2（えさで ぐんぐん そだつ）
  feedBonusPerDay: 4,            // えさの ボーナスは 1日 4かい まで
  hoursPerGrowDay: 20,           // fish.growDays の 1日 ＝ ゲージ 20じかん ぶん
  // stage 0→1 は growDays[0]×20、1→2 は そこから さらに growDays[1]×20
  // 例：メダカ [2,4] → おとな まで 40、ビッグ まで さらに 80（よく せわすると 1日に 約30 たまる → おとな 約13ぷん、ビッグ さらに 約27ふん）
};

// ---------------- コイン ----------------
export const COIN = {
  care: {
    feed:        { coin: 6,  perDay: 4 },  // その えさやりで、おなか < 80 の魚が 1ぴき以上 たべた
    waterChange: { coin: 10, perDay: 3, cleanBelow: 85 },  // みずかえ前の きれいさ < 85
    // そうじ・なでる は コイン なし（れんだ・わざと よごす ことで かせげないように）
  },
  careDailyCap: 50,              // お世話で もらえるのは 1日 50 まで（つぎの日 6:00 に もどる）
  thanks: {
    chancePerHour: 0.10,         // 条件を みたす魚 1ぴきごと、1じかんに 10%
    need: { health: 70, mood: 70, onaka: 40 },
    coinBase: 8, coinPerRarity: 2,   // 8 + 2×レアど（メダカ 10、レッドビー 16）
    perFishPerDay: 1,
    perTankPerDay: 4,
    minGapHours: 2,              // すいそう全体で つぎの ありがとう まで 2じかん あける
    guaranteeHours: 12,          // その日 条件を ごうけい 12じかん みたして まだ ありがとう していない魚は、かならず ありがとう（運が わるくて 0 の日を なくす）
  },
  max: 99999,                    // もてる コインの 上限
};

// ---------------- 魚のリアクション ----------------
export const REACTION = {
  petCooldownRealSec: 3,         // おなじ魚を つづけて タップしても 3びょうに 1かい
  idleEveryHours: 4,             // ごきげん ≥ 80 の魚が いれば 4じかんに 1かい、1ぴきが jump か spin
  sadEveryHours: 3,              // おなか < 30 か ごきげん < 30 の魚は 3じかんに 1かい sad
  sleepyEveryHours: 5,           // けんこう < 40 の魚は 5じかんに 1かい sleepy（「すこし やすんでいるよ」）
  nightSleepy: { from: 22, to: 6, chancePerHour: 0.2 },  // よる（22じ〜6じ）は ときどき sleepy
};

// ---------------- 画面に出す ことば（数値 → 3だんかい の かお） ----------------
// 小さい子には数字より かお（にこにこ／ふつう／しょんぼり）＋ みじかい ことば で見せる。
// いつも出すのは きほんの 4つ（すいおん・きれいさ・くうき・おなか）。けんこう・ごきげん・なつき・なかよし は 魚を タップしたとき。
// 数字（0〜100）は 図鑑の「くわしく」だけ。すいおん は「25ど」と 数字も出してよい。
export const LABELS = {
  temp:   { good: 'ちょうどいい', ok: 'まあまあ', cold: 'さむい', hot: 'あつい' },
  clean:  { good: 'ピカピカ', ok: 'ふつう', bad: 'よごれてる', goodMin: 70, okMin: 40 },
  air:    { good: 'たっぷり', ok: 'ふつう', bad: 'すくない', goodMin: 50, okMin: 30 },
  onaka:  { good: 'たりてる', ok: 'すこし すいた', bad: 'ぺこぺこ', goodMin: 70, okMin: 30, full: 'おなか いっぱい' },
  health: { good: 'げんき', ok: 'ふつう', bad: 'げんきが ない', goodMin: 70, okMin: 40 },
  mood:   { good: 'ごきげん', ok: 'ふつう', bad: 'しょんぼり', goodMin: 70, okMin: 30 },
  nakayoshi: { good: 'なかよし', ok: 'ふつう', bad: 'にがて', goodMin: 80, okMin: 40 },
  stage: ['ちびっこ', 'おとな', 'ビッグ'],
};

// ================================================================
// v0.2 で 足したもの（くわしくは docs/仕様_v0.2.md）
// ================================================================

// ---------------- 解放（あたらしい すいそう・さかなが おみせに ならぶ） ----------------
export const UNLOCK = {
  tank6: {
    tankIndex: 0,              // 1つめの すいそう（state.tanks[0]）を 見る
    count: 6,                  // その すいそうの 生きもの（さかな・エビ・かい）の 数が 6 以上
    counts: 'creatures',       // space ではなく 1ぴき＝1 で 数える（エビ・かいも 1）
    orFull: true,              // または その すいそうが いっぱい（space の合計 ≥ TANK.capacity）でも たっせい。
                               // キンギョ・エンゼル（space 2）で うまって 6ぴきに とどかない「つみ」を ふせぐ（v0.2 は 魚を てばなせない）
    permanent: true,           // いちど たっせいしたら、あとで へっても もどさない（state.unlocks.tank6 = ゲームの日）
    // たっせい したとき 大きな字で 出す（2まい。タップで つぎへ）
    banner: [
      'うみの すいそうが かえるように なったよ！ おみせで 1000コイン だよ。',
      'あたらしい さかなや かい、かわの すいそうも おみせに ふえたよ！',
    ],
    // まだの とき、お店の かぎつき カードに 出す
    lockedLine: '1つめの すいそうに 6ぴき いると あえるよ（エビも かいも かぞえるよ）',  // その下に「4／6」の ように いまの かずも 出す
  },
};

// ---------------- すいそう ----------------
export const TANKS = {
  max: 6,                      // へやに おける すいそうの 数（はじめの 1つを ふくむ）
  // 値段は items.js の tank_fresh（800）・tank_salt（1000）。なんこめでも おなじ ねだん
  // かった すいそうは items.js の includes（ヒーター・ブクブク）が 入った じょうたいで はじまる
  newTank: { temp: 25, clean: 100, air: 70, leftover: 0 },   // ヒーターつきなので はじめから 25ど
  // 1つの すいそうの 中身の 上限は TANK.capacity（6）の まま
};

// ---------------- すいそうが ふえたときの コイン ----------------
// お世話の 回数の 上限（COIN.care の perDay）は すいそう ごと。
// 1日の お世話コインの 合計上限は すいそうが ふえると すこし ふえる。
export const MULTI_TANK = {
  careDailyCapPerExtraTank: 25,  // 生きものが いる すいそうが 2つめ いこう 1つ ふえるごとに +25（6つで 50+125=175）。からの すいそうは 数えない
  thanksAllTanksBase: 4,         // ありがとう は すいそう ごとに 1日4かい（COIN.thanks.perTankPerDay）、
  thanksAllTanksPerExtra: 3,     // ぜんぶで 1日「4 + 3 ×（生きものが いる すいそう − 1）」かい まで（6つで 19）
  emptyTankNoCareCoin: true,     // 生きものが いない すいそうの みずかえ・えさ は コイン なし
  // ありがとう の さいてい 2じかん あける（COIN.thanks.minGapHours）は すいそう ごと
};

// ---------------- かい（貝） ----------------
export const SNAIL = {
  cleanPerHour: 0.15,          // かい 1ぴきで きれいさ +0.15/時間（こけを たべる）
  algaeEaterIds: ['otocinclus'], // かい でなくても こけを たべる 生きもの（cleanPerHour だけ おなじ ように 足す）
  leftoverPerHour: 0.06,       // かい 1ぴきで たべのこし −0.06/時間
  // かい は space 0.5。なつき・ごきげん・ありがとう は ほかの 生きものと おなじ
};

// ---------------- ハート（なでて もらう。v0.2 は ためるだけ） ----------------
export const HEART = {
  perPet: 1,                   // 魚を タップして もらえる ハート
  perFishEveryGameMinutes: 72, // おなじ 魚からは ゲーム内72ふん（現実30びょう。なつき の まち時間と おなじ）に 1こ まで
  showReadyMark: true,         // いま ハートを くれる 魚の 上に 小さな キラキラハートを うかべる（むだな れんだを ふせぐ）
  perDay: 20,                  // 1日（6:00 から）ぜんぶの すいそう あわせて 20こ まで。あとは なでても なつき・リアクション だけ
  doneLine: 'きょうの ハートは いっぱい！ また あしたね',   // 20こに なった とき 1かいだけ ふきだし。あとは カウンターに「20／20」
  restLine: 'いまは やすんでいるよ',               // けんこう < 40 の 魚を なでた とき
  need: { health: 40 },        // げんきが ない 魚（けんこう < 40）からは もらわない（よわっている 魚を つつかせない）
  react: 'heart',              // もらえた ときは なつき に かかわらず aq.react(uid, 'heart')、カウンターに「+1」が とんでいく
  max: 99999,
  // 餌を たべた ときに 水槽が 自動で 出す ハートは 数えない
};

// ---------------- そうじ（あみで すくう アニメ） ----------------
export const SCOOP = {
  animRealSec: 2.0,            // あみの アニメの ながさ（現実の びょう）
  applyAt: 'end',              // たべのこし を 0 に するのは アニメの おわり
  lockOtherCare: true,         // アニメ中は えさ・みずかえ・そうじ ボタンを おせない（時計・魚は ふつうに うごく）
  allowWhenEmpty: true,        // たべのこし 0 でも アニメは できる（コイン・きれいさ・ミッションの かぞえ は なし）
};

// ---------------- お店の 見出し・すいそうの よびかた（v0.2） ----------------
export const SHOP_TABS = [           // 魚タブの中を この じゅんの 見出しに わける（fish.kind）
  { kind: 'fish', label: 'さかな' },
  { kind: 'shrimp', label: 'エビ' },
  { kind: 'snail', label: 'かい' },
];
export const WATER_LABELS = { fresh: 'かわの すいそう', salt: 'うみの すいそう' };   // 色だけに たよらず かわ・なみ の えも そえる
export const HEART_LABEL = 'ハート';  // カウンターの よびかた（数字と ハートの え）
