// こまったときの ヒント（企画・図鑑係）。画面に出す文字（text）はひらがな・カタカナだけ。
// {name} は その魚の なまえ、{like} は その魚の すきな飾りの なまえ（items.js の name）に おきかえる。
//
// when.type（ゲーム係が判定する。くわしくは docs/仕様_v0.1.md「10. ヒント」）
//   'noHeaterCold'   : ヒーターが なく、すいおん < その魚の min（target: その魚）
//   'tempLow'        : すいおん < その魚の min（ヒーターは ある。あたたまる とちゅう）
//   'tempHigh'       : すいおん > その魚の max（v0.1 では おきない。後の版の ため）
//   'veryDirty'      : きれいさ < 20
//   'dirty'          : きれいさ < どれかの魚の cleanMin（レッドビーは 60）
//   'noPumpAirLow'   : ブクブクが なく、くうき < 30
//   'airLow'         : くうき < 30（ブクブクは ある）
//   'hungry'         : どれかの魚の おなか < 30
//   'leftover'       : たべのこし ≥ 1
//   'lonelySchool'   : swim.school の魚が 1ぴきだけ
//   'noLikedDecor'   : どれかの魚の ごきげん < 50 で、その魚の すきな飾りが 1つも ない
//   'nigate'         : にがて（相性0）の くみあわせが いる
//   'tankFull'       : space の合計が TANK.capacity（お店で 魚を えらんだ とき）
//   'noCoins'        : かいたい ものの コインが たりない（お店で）
//   --- v0.2（ヒントは いま 見ている すいそう ごとに 判定する）---
//   'airLowSalt'     : うみの すいそうで くうき < 30（ブクブクは ある）。airLow の かわりに 出す（みずくさ が 入れられないため）
//   'saltNoLiverock' : うみの すいそうに 生きものが いて、ライブロックが 1つも なく、きれいさ < 70
//   'unlockNear'     : UNLOCK.tank6 が まだで、1つめの すいそうの 生きものが 4〜5ひき（{n} は のこりの かず）
//   'tankEmpty'      : 生きものが 1ぴきも いない すいそう（2つめ いこう）
//   --- v0.3 ---
//   'fanCold'        : ヒーターと クーラーファンが 両方 あり、すいおん < どれかの魚の min（tempLow の かわりに 出す。ダイヤルは あんぜんな だん しか えらべないので ふつうは おきない）
//   'co2NoPlant'     : シーオーツーが あるのに みずくさ が 0（淡水）
//   'weakVitamin'    : げんきが ない魚が いて、ほかの 原因が もう ない（なおる とちゅう）。ビタミンを もっていて、その魚が dislike でない
//
// priority が 小さいほど さきに 出す。いちどに 出すのは 1つだけ。
// 魚が「げんきが ない」（けんこう < 40）ときは、えらばれた ヒントの まえに WEAK_PREFIX を つける（action は そのヒントの もの）。
// action は 光らせる ボタン（ゲーム係の UI の名前に あわせて よい）。
export const WEAK_PREFIX = '{name}は すこし やすんでいるよ。';
export const RECOVERING_LINE = '{name}は すこしずつ げんきに なっているよ。';  // げんきが ない 魚の 原因が ぜんぶ なおったとき
export const RECOVERED_LINE = '{name}が げんきに なったよ！';                   // けんこう が 40 以上に もどったとき

export const HINTS = [
  { id: 'h_noheater',    priority: 1,  when: { type: 'noHeaterCold' },
    text: 'みずが すこし つめたいみたい。おみせの ヒーターで あたためて あげよう。', action: 'shop' },
  { id: 'h_fan_cold',    priority: 1.5, when: { type: 'fanCold' },
    text: '{name}には すこし すずしすぎる みたい。おんど ダイヤルを あたたかく してみよう。', action: 'thermo' },
  { id: 'h_cold',        priority: 2,  when: { type: 'tempLow' },
    text: 'いま ヒーターが みずを あたためているよ。すこし まってね。', action: null },
  { id: 'h_hot',         priority: 2,  when: { type: 'tempHigh' },
    text: '{name}は もうすこし すずしい みずが すきだよ。', action: null },
  { id: 'h_verydirty',   priority: 3,  when: { type: 'veryDirty' },
    text: 'みずが よごれているよ。「みずかえ」で ピカピカに してあげよう。', action: 'water_change' },
  { id: 'h_noPump',      priority: 4,  when: { type: 'noPumpAirLow' },
    text: 'みずの くうきが すくないよ。おみせの ブクブクを いれてあげよう。', action: 'shop' },
  { id: 'h_air',         priority: 4,  when: { type: 'airLow' },
    text: 'みずの くうきが すくないよ。みずくさを いれると くうきが ふえるよ。', action: 'shop' },
  { id: 'h_air_salt',    priority: 4,  when: { type: 'airLowSalt' },
    text: 'みずの くうきが すくないよ。サンゴを いれると くうきが すこし ふえるよ。', action: 'shop' },
  { id: 'h_salt_rock',   priority: 5.5, when: { type: 'saltNoLiverock' },
    text: 'うみの すいそうには ライブロックが おすすめ。みずを きれいに して くれるよ。', action: 'shop' },
  { id: 'h_dirty',       priority: 5,  when: { type: 'dirty' },
    text: 'みずが すこし よごれてきたよ。「みずかえ」を すると ピカピカに なるよ。', action: 'water_change' },
  { id: 'h_hungry',      priority: 6,  when: { type: 'hungry' },
    text: '{name}の おなかが すいたみたい。「えさ」で ごはんを あげよう。', action: 'feed' },
  { id: 'h_leftover',    priority: 7,  when: { type: 'leftover' },
    text: 'すいそうの そこに たべのこしが あるよ。「そうじ」で すくって あげよう。', action: 'scoop' },
  { id: 'h_lonely',      priority: 8,  when: { type: 'lonelySchool' },
    text: '{name}は なかまと およぐのが すきだよ。おなじ さかなを むかえて あげると よろこぶよ。', action: 'shop' },
  { id: 'h_like',        priority: 9,  when: { type: 'noLikedDecor' },
    text: '{name}は {like}が すきだよ。すいそうに いれて あげると よろこぶよ。', action: 'shop' },
  { id: 'h_nigate',      priority: 10, when: { type: 'nigate' },
    text: '{name}は いっしょの なかまが すこし にがて みたい。すきな かざりを いれると きげんが なおるよ。', action: 'shop' },
  { id: 'h_co2',         priority: 12, when: { type: 'co2NoPlant' },
    text: 'シーオーツーは みずくさが あると はたらくよ。みずくさを いれてみよう。', action: 'shop' },
  { id: 'h_weak_vitamin', priority: 13, when: { type: 'weakVitamin' },
    text: 'ビタミンを あげると {name}が はやく げんきに なるよ。', action: 'vitamin' },
  { id: 'h_unlock_near', priority: 15, when: { type: 'unlockNear' },
    text: 'あと {n}ひきで あたらしい なかまに あえるよ。エビや かいも かぞえるよ。', action: 'shop' },
  { id: 'h_tank_empty',  priority: 16, when: { type: 'tankEmpty' },
    text: 'あたらしい すいそうだね。おみせで いきものを むかえよう。', action: 'shop' },
  { id: 'h_full',        priority: 20, when: { type: 'tankFull' },
    text: 'すいそうが いっぱいだよ。いまの さかなを たいせつに そだてよう。', action: null },
  { id: 'h_nocoin',      priority: 21, when: { type: 'noCoins' },
    text: 'コインが すこし たりないよ。さかなを げんきに そだてると コインが もらえるよ。', action: null },
];

// お店で 魚を えらんだとき、すいそうに 相性0 の 魚が いたら 出す（かうのは とめない）
export const SHOP_NIGATE_CONFIRM = '{name}は いまの なかまが すこし にがて みたい。それでも むかえる？';

// ---- v0.2：お店で かえない ときの ことば（ボタンを 灰色に して、おしたら 出す）----
export const SHOP_LINES = {
  wrongWater: '{name}は うみで くらすよ。うみの すいそうを えらんでね。',               // うみの いきものを かわの すいそうで えらんだ
  wrongWaterFresh: '{name}は かわで くらすよ。かわの すいそうを えらんでね。',            // かわの いきものを うみの すいそうで えらんだ
  noSaltTank: '{name}は うみで くらすよ。おみせで うみの すいそうが かえるよ。',          // うみの すいそうを まだ もっていない
  needs: '{name}は {item}が ある すいそうで くらすよ。さきに {item}を いれてね。',      // fish.needs が すいそうに ない（{item} は items.js の name）
  locked: '1つめの すいそうに 6ぴき いると あえるよ（エビも かいも かぞえるよ）',                                   // unlock 前の かぎつき カード（balance.js UNLOCK.tank6.lockedLine と おなじ）
  tankMax: 'へやに すいそうが いっぱいだよ。いまの すいそうを たいせつに そだてよう。',     // すいそうが TANKS.max（6）
  newTank: 'あたらしい すいそうが へやに きたよ！',                                       // すいそうを かった とき
  snailFull: 'かいは 1つの すいそうに 2ひき までだよ。',                                   // （v0.3）かい が snailMax
  fishFull: 'さかなと エビは 1つの すいそうに 6ぴき までだよ。かいなら あと すこし いれられるよ。', // （v0.3）さかな・エビが fishMax（かいの あきが あるとき。ないときは h_full）
  co2Salt: 'シーオーツーは かわの すいそうで つかうよ。',                                 // （v0.3）うみの すいそうで えらんだ
  skimmerFresh: 'プロテインスキマーは うみの すいそうで つかうよ。',                       // （v0.3）かわの すいそうで えらんだ
  vitaminFull: 'ビタミンは まだ のこっているよ。つかいおわったら また かってね。',          // （v0.3）5かいぶん もっている
};

// ---- v0.3：ビタミンの ことば（{name} は その魚）----
export const VITAMIN_LINES = {
  love: '{name}は ビタミンが だいすき！ おおよろこび！',          // だいすき の 魚が たべた（いちばん よろこんだ 1ぴきだけ ふきだし）
  ok: '{name}が ビタミンを たべたよ。げんきが でてきた！',
  dislike: '{name}は ぷいっ！ いつもの ごはんが すきなんだね。',   // ぷいっ（はじめて その しゅるいで おきた とき だけ。♪ マークを そえる）
  willEat: '{n}ひき よろこぶよ',                                  // ビタミンボタンの よこ（この すいそうで たべる 魚の かず）
  allDislike: 'みんな いつもの ごはんが すき みたい。ビタミンは のこしておくね。', // 全員 dislike（おとさない・へらない）
  doneToday: 'この すいそうの ビタミンは つぎの あさ 6じに また あげられるよ。', // きょう もう あげた すいそう（ボタンに のこり時間も 出す）
  empty: 'ビタミンが なくなったよ。おみせで かえるよ。',                       // のこり 0
};
// ずかんの「ビタミン」の らん（fish.vitamin → ことば）
export const VITAMIN_DEX = { love: 'だいすき', ok: 'たべる', dislike: 'いつもの ごはんが すき' };

// ---- v0.3：おんど ダイヤル の ことば ----
export const THERMO_LINES = {
  title: 'おんど ダイヤル',
  outOfRange: '{name}には あわない あたたかさ だよ。',   // 灰色の だんを おしたとき（えらべない）
  reset: '{name}に あわせて ふつうに もどしたよ。',        // あとから 入った 魚に あわないので 'normal' に もどした とき
  needHeater: 'ファンは ヒーターと いっしょに つかうよ。',   // ファンだけ の すいそう
  recommend: 'みんなに おすすめ',                          // 全員 ぴったり／はんい内 に なる だんの しるし
};

// えさボタンを おしたが 全員 おなか いっぱい（≥ 90）のとき
export const FULL_LINE = 'みんな おなか いっぱい みたい。また あとで あげてね。';

// ぜんぶ よいときに ときどき 出す ひとこと（ヒントの ばしょに 出す）
export const HAPPY_LINES = [
  'みんな げんきだよ。いい すいそうだね！',
  '{name}が きもちよさそうに およいでいるよ。',
  'みずが ピカピカで きもちいいね。',
  '{name}が こっちを みているよ。なでて あげてね。',
];
