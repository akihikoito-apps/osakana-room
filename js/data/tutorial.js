// チュートリアル（企画・図鑑係）。はじめて あそぶ ときだけ。画面に出す文字（say / speaker）はひらがな・カタカナだけ。
// {name} は かった 魚の なまえ に おきかえる。
//
// 1つの ステップ
//   say    : ふきだしの セリフ（2ぎょう・1ぎょう 20じ くらいまで）
//   target : 光らせる UI（ゲーム係の UI の名前に あわせて よい）。null なら 光らせない
//   wait   : つぎへ すすむ きっかけ
//            'tap'               … どこかを タップ
//            'openShop'          … お店を ひらいた
//            'buyFish'           … 魚を 1ぴき かった（firstFish の中から）
//            'buyItem:<id>'      … その どうぐを うけとった（tutorialFree なので 0コイン。ボタンは「うけとる」）
//            'openTank'          … すいそうの がめんに した
//            'feedEaten'         … えさを あげて 魚が たべた
//   lockOthers : true なら target いがいは おせない（まわりを すこし くらくする）
//   give   : その ステップに 入ったとき もらえる もの（コインを つかわない）
//
// チュートリアル中は 時計が とまる（balance.js TIME.stopDuringTutorial）。ミッション・ヒントは 出さない。
// とちゅうで とじたら、つぎは その ステップから。
export const TUTORIAL = {
  speaker: 'おみせの ひと',
  firstFish: ['medaka', 'guppy', 'neon_tetra'],   // さいしょに えらべる 魚（ねだん 50〜80。キンギョは なかよしの あいてが すくないので はずす）
  recommend: 'medaka',                            // 「おすすめ」の しるしを つける
  heaterWarmsNow: true,                           // ヒーターを うけとったら すいおん を すぐ 25ど に する（時計が とまっているので）
  doneReward: { coin: 50 },                       // さいごに「おいわい」で +50
  steps: [
    { id: 't_hello',   say: 'ようこそ！ ここが きみの おへやだよ。さかなを むかえに「おみせ」へ いこう。', target: 'shopButton', wait: 'openShop', lockOthers: true },
    { id: 't_fish',    say: 'すきな さかなを 1ぴき えらんでね。はじめてなら メダカが おすすめだよ。',     target: 'shopFish',   wait: 'buyFish',  lockOthers: true,
      give: null },
    { id: 't_tank',    say: '{name}が きたよ！ えさも つけておくね。すいそうを みに いこう。',             target: 'tank',       wait: 'openTank', lockOthers: true,
      give: { item: 'food_flake' } },
    { id: 't_feed',    say: '「えさ」の ボタンで ごはんを あげてみよう。',                                 target: 'feedButton', wait: 'feedEaten', lockOthers: true },
    { id: 't_heart',   say: 'ハートが でたね！ よろこんでいるよ。さかなに タッチすると なでて あげられるよ。', target: null,     wait: 'tap',      lockOthers: false },
    { id: 't_tools',   say: 'つぎは すいそうに どうぐを いれよう。はじめての どうぐは プレゼントだよ！',     target: 'shopButton', wait: 'openShop', lockOthers: true },
    { id: 't_stone',   say: '「いし」を うけとろう。さかなが かくれたり やすんだり できるよ。',             target: 'shopItem:stone',        wait: 'buyItem:stone',        lockOthers: true },
    { id: 't_pump',    say: '「ブクブク」は みずに くうきを おくって くれるよ。',                          target: 'shopItem:air_pump',     wait: 'buyItem:air_pump',     lockOthers: true },
    { id: 't_heater',  say: '「ヒーター」は みずを ちょうどよい あたたかさに して くれるよ。',              target: 'shopItem:heater',       wait: 'buyItem:heater',       lockOthers: true },
    { id: 't_water',   say: '「みずかえセット」で、よごれた みずを ピカピカに できるよ。',                 target: 'shopItem:water_change', wait: 'buyItem:water_change', lockOthers: true },
    { id: 't_meters',  say: 'ここで みずの ようすが わかるよ。かおが にこにこに なるように おせわ しようね。', target: 'meters',  wait: 'tap',      lockOthers: true },
    { id: 't_end',     say: 'おせわを すると コインが もらえるよ。こまったら ヒントが おしえてくれるよ。', target: 'coins',      wait: 'tap',      lockOthers: false },
    // v0.6（ゲーム係）：さいごに ヘルプの ばしょを おしえる（へやの ひだりうえ。Codex・agy の あんを あわせた）
    { id: 't_help',    say: 'わからない ことが あったら、ひだりうえの「ヘルプ」を みてね！',              target: 'helpButton', wait: 'tap',      lockOthers: false },
  ],
};
