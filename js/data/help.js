// ヘルプの なかみ（案内係）。数字は balance.js から つくるので、数値を かえても ずれない。
// helpTopics(B) … B は balance.js の モジュール（{ HEART, COIN, ... }）。無い ものは かっこの 中の 数で うめる。
// 画面に 出る 文字は ひらがな・カタカナだけ。1つの ばめん（topic）は 3〜4ぎょうまで。
// pic は 絵の パス（無ければ ic の えもじ）。note は ちいさく 出す「おうちの ひとへ」（くわしい 数や 条件）。

/** ミニゲームに つかう ハートの かず（balance.js の MINIGAME.quiz.cost。無ければ sim.js の きほんと おなじ 10） */
export function quizCost(B = {}) {
  return B.MINIGAME?.quiz?.cost ?? 10;   // sim.js の quizRule() と おなじ ところを みる
}

export function helpTopics(B = {}) {
  const H = B.HEART || {};
  const C = B.COIN || {};
  const care = C.care || {};
  const realSecPerGameHour = B.TIME?.realSecPerGameHour ?? 25;
  const heartWaitSec = Math.round(((H.perFishEveryGameMinutes ?? 72) / 60) * realSecPerGameHour);
  const heartDay = H.perDay ?? 20;
  const dayStart = B.TIME?.dayStartHour ?? 6;
  const quiz = quizCost(B);
  const feed = care.feed || { coin: 6, perDay: 4 };
  const water = care.waterChange || { coin: 10, perDay: 3 };
  const pet = C.pet || { coin: 6 };
  const careCap = C.careDailyCap ?? 50;
  const unlock = B.UNLOCK?.tank6?.count ?? 6;
  const tanksMax = B.TANKS?.max ?? 6;
  const vitDay = B.VITAMIN?.perTankPerDay ?? 1;
  const steps = (B.THERMO?.steps || [{ temp: 23 }, { temp: 25 }, { temp: 27 }]).map((s) => s.temp);

  return [
    {
      id: 'play', ic: '🐟', label: 'あそびかた', pic: 'assets/fish/medaka.png',
      topics: [
        { h: 'すいそうを みよう', lines: [
          'へやの すいそうを タップすると、ちかくで みられるよ。',
          '◀ ▶ で ほかの すいそうに うつれるよ。',
          'さかなを タップすると、ようすが わかるよ。',
        ] },
        { h: 'おせわの ボタン', pic: 'assets/items/food_flake.png', lines: [
          'したの ボタンで おせわを するよ。',
          '「えさ」は ごはん、「みずかえ」は みずを ピカピカに、「そうじ」は そこの ごみを すくうよ。',
          '「しゃしん」で すきな ところを とれるよ。',
        ] },
        { h: 'かおの マーク', lines: [
          'ひだりの メーターの かおを みてね。',
          'にこにこ なら だいじょうぶ。しょんぼり なら おせわを してあげよう。',
          'こまったら 💡 の ヒントが おしえて くれるよ。',
        ] },
      ],
    },
    {
      id: 'heart', ic: '💗', label: 'ハートと クイズ', pic: 'assets/items/heart.png',
      topics: [
        { h: 'ハートの あつめかた', lines: [
          'さかなを なでる（タップする）と ハートが もらえるよ。',
          'キラキラ ハートが うかんでいる さかなが ハートを くれるよ。',
          `1にちに ${heartDay}こ まで。あさ ${dayStart}じに また もらえるよ。`,
        ], note: `おなじ さかなは ${heartWaitSec}びょうくらい あけると また くれます。げんきが ない さかなは やすんでいるので くれません。` },
        { h: 'ハートの つかいみち', lines: [
          `ミニゲーム「さかな あて クイズ」は ハート ${quiz}こで あそべるよ。`,
          'あたった かずだけ コインが もらえるよ。',
        ] },
      ],
    },
    {
      id: 'coin', ic: '🪙', label: 'コインと おみせ',
      topics: [
        { h: 'コインの あつめかた', lines: [
          `おなかが すいた さかなに えさを あげると ${feed.coin}コイン。`,
          `みずが よごれてきたら みずかえで ${water.coin}コイン。`,
          `なでて ハートが でたとき、ときどき ${pet.coin}コイン。`,
          'げんきで ごきげんな さかなは「ありがとう」で コインを くれるよ。',
        ] },
        { h: 'もっと もらうには', lines: [
          'ミッションを クリアすると コインが もらえるよ。',
          `「さかな あて クイズ」でも もらえるよ（ハート ${quiz}こ）。`,
        ], note: `えさ は 1にち ${feed.perDay}かい、みずかえ は ${water.perDay}かい まで（すいそう ごと）。おせわの コインは 1にち ${careCap}まで で、さかなが いる すいそうが ふえると ふえます。そうじ は コインなし。` },
        { h: 'コインの つかいみち', lines: [
          'おみせで さかな・エビ・かい・きぐ・えさ・すいそうが かえるよ。',
          'ほしい ものを めざして ためてみよう。',
        ] },
      ],
    },
    {
      id: 'care', ic: '🫧', label: 'みずの おせわ', pic: 'assets/items/water_change.png',
      topics: [
        { h: 'みずかえ と そうじ', pic: 'assets/items/net.png', lines: [
          '「みずかえ」は みずを ピカピカに するよ（きれいさ が ふえる）。',
          '「そうじ」は そこの ちゃいろい ごみを あみで すくうよ。',
          'ごみは みずかえ では へらないよ。どちらも してあげてね。',
        ] },
        { h: 'すいおん', pic: 'assets/items/heater.png', lines: [
          `ヒーターが あると みずが ${steps[1] ?? 25}どに なるよ。`,
          'すきな あたたかさは さかなで ちがうよ。ずかんで みてね。',
          `ヒーターと クーラーファンが あると、おんど ダイヤル（${steps.join('・')}ど）で えらべるよ。`,
        ] },
        { h: 'くうき', pic: 'assets/items/air_pump.png', lines: [
          'ブクブク・フィルターで みずの くうきが ふえるよ。',
          'かわの すいそうは みずくさ、うみの すいそうは サンゴでも ふえるよ。',
        ] },
      ],
    },
    {
      id: 'life', ic: '🐠', label: 'げんきに そだてる', pic: 'assets/fish/clownfish.png',
      topics: [
        { h: 'ビタミン', pic: 'assets/items/food_vitamin.png', lines: [
          `1つの すいそうに 1にち ${vitDay}かい あげられるよ。`,
          'げんき・ごきげんが あがって、ぐんぐん そだつよ。',
          'すき・きらいが あるよ。きらいだと ぷいっ と するよ。',
        ] },
        { h: 'なかよし', lines: [
          'さかなには あいしょうが あるよ。',
          'なかよしと いっしょだと ごきげんに なるよ。',
          'ずかんで「なかよし」「にがて」が みられるよ。',
        ] },
        { h: 'すきな かざり', pic: 'assets/items/plant.png', lines: [
          'すきな かざりを いれると ごきげんに なるよ。',
          'なにが すきかは ずかんで みてね。',
        ] },
        { h: 'そだつ', lines: [
          'ちびっこ → おとな → ビッグ と おおきく なるよ。',
          'えさを たべると ぐんぐん そだつよ。',
        ] },
        { h: 'ありがとう', lines: [
          'げんきで ごきげんで おなかが いっぱいの さかなは、ときどき「ありがとう」を くれるよ。',
          'まいにちの おせわが だいじだよ。',
        ] },
      ],
    },
    {
      id: 'tank', ic: '🫙', label: 'すいそう', pic: 'assets/items/tank_salt.png',
      topics: [
        { h: 'うみの すいそう', lines: [
          `1つめの すいそうに ${unlock}ぴき いると、うみの すいそうが かえるように なるよ。`,
          'エビも かいも かぞえるよ。',
        ] },
        { h: 'すいそうを ふやす', pic: 'assets/items/tank_fresh.png', lines: [
          `へやには すいそうを ${tanksMax}つまで おけるよ。`,
          'おみせの「すいそう」で かえるよ。',
        ] },
        { h: 'かりすいそう', lines: [
          'さかなを いまの すがたの まま あずけられるよ。',
          'すいそうを あけたい ときに つかってね。いつでも もどせるよ。',
        ] },
      ],
    },
    {
      id: 'more', ic: '🎵', label: 'おんがく ほか', pic: 'assets/items/bgm.png',
      topics: [
        { h: 'おんがく', pic: 'assets/items/bgm.png', lines: [
          'へやの ひだりしたの ボタンで おんがくを えらべるよ。',
          'とめる ことも できるよ。',
        ] },
        { h: 'こうしん りれき', lines: [
          'ゲームが あたらしく なったら、なにが かわったか ここで みられるよ。',
        ] },
        { h: 'あんしんしてね', lines: [
          'さかなは しなないよ。げんきが なくても、おせわで げんきに なるよ。',
          'ゲームを とじている あいだは じかんが とまるよ。',
        ] },
      ],
    },
  ];
}
