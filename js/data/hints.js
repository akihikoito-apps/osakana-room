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
  { id: 'h_dirty',       priority: 5,  when: { type: 'dirty' },
    text: 'みずが すこし よごれてきたよ。「みずかえ」を すると ピカピカに なるよ。', action: 'water_change' },
  { id: 'h_hungry',      priority: 6,  when: { type: 'hungry' },
    text: '{name}の おなかが すいたみたい。「えさ」で ごはんを あげよう。', action: 'feed' },
  { id: 'h_leftover',    priority: 7,  when: { type: 'leftover' },
    text: 'そこに たべのこしが あるよ。「そうじ」で すくって あげよう。', action: 'scoop' },
  { id: 'h_lonely',      priority: 8,  when: { type: 'lonelySchool' },
    text: '{name}は なかまと およぐのが すきだよ。おなじ さかなを むかえて あげると よろこぶよ。', action: 'shop' },
  { id: 'h_like',        priority: 9,  when: { type: 'noLikedDecor' },
    text: '{name}は {like}が すきだよ。すいそうに いれて あげると よろこぶよ。', action: 'shop' },
  { id: 'h_nigate',      priority: 10, when: { type: 'nigate' },
    text: '{name}は いっしょの なかまが すこし にがて みたい。すきな かざりを いれると きげんが なおるよ。', action: 'shop' },
  { id: 'h_full',        priority: 20, when: { type: 'tankFull' },
    text: 'すいそうが いっぱいだよ。いまの さかなを たいせつに そだてよう。', action: null },
  { id: 'h_nocoin',      priority: 21, when: { type: 'noCoins' },
    text: 'コインが すこし たりないよ。さかなを げんきに そだてると コインが もらえるよ。', action: null },
];

// お店で 魚を えらんだとき、すいそうに 相性0 の 魚が いたら 出す（かうのは とめない）
export const SHOP_NIGATE_CONFIRM = '{name}は いまの なかまが すこし にがて みたい。それでも むかえる？';

// えさボタンを おしたが 全員 おなか いっぱい（≥ 90）のとき
export const FULL_LINE = 'みんな おなか いっぱい みたい。また あとで あげてね。';

// ぜんぶ よいときに ときどき 出す ひとこと（ヒントの ばしょに 出す）
export const HAPPY_LINES = [
  'みんな げんきだよ。いい すいそうだね！',
  '{name}が きもちよさそうに およいでいるよ。',
  'みずが ピカピカで きもちいいね。',
  '{name}が こっちを みているよ。なでて あげてね。',
];
