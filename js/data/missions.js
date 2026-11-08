// ミッション（企画・図鑑係）。v0.1 で ぜんぶ たっせい できるもの。1かい きり（くりかえし なし）。
// 画面に出す文字（title / desc）はひらがな・カタカナだけ。
//
// goal の type（ゲーム係が数える。くわしくは docs/仕様_v0.1.md「8. ミッション」）
//   'buyFish'      : 魚を かった かず（つうさん）              { count }
//   'fishCount'    : いま すいそうに いる 魚の かず             { count }
//   'speciesCount' : いま すいそうに いる しゅるいの かず       { count }
//   'placeItem'    : その id の もの を すいそうに いれた／もった { id }
//   'feed'         : 魚が えさを たべた かいすう（つうさん。1かいの えさやりで 1）{ count }
//   'waterChange'  : みずかえ した かいすう（つうさん）         { count }
//   'scoop'        : そうじ した かいすう（つうさん）           { count }
//   'pet'          : 魚を なでた かいすう（つうさん）           { count }
//   'thanks'       : ありがとう を もらった かいすう（つうさん） { count }
//   'grow'         : どれかの 魚が その stage に なった         { stage }
//   'natsuki'      : どれかの 魚の なつき が その値 以上       { value }
//   'friends'      : 相性2 の くみあわせが すいそうに ある      {}
//   'allHealthy'   : 魚が 2ひき以上 いて、全員 けんこう ≥ value   { value, minFish }
//   'days'         : あそんだ ゲームの日数（日が かわった かいすう） { count }
//   'zukan'        : 図鑑に のった しゅるい（いちど かった）     { count }
//   --- v0.2 ---
//   'tankCreatures': その すいそうの 生きものの 数（1ぴき＝1）     { tankIndex, count }
//   'unlock'       : state.unlocks[id] が ある（UNLOCK の 条件を たっせいした）{ id }
//   'kindCount'    : ぜんぶの すいそうで その kind の 生きものの 数 { kind, count }
//   'tankCount'    : へやの すいそうの 数（はじめの 1つを ふくむ） { count }
//   'hasTankWater' : その みずの すいそうを もっている           { water }
//   'waterFishCount': ぜんぶの すいそうで その みずの 生きものの 数 { water, count }
//   'hearts'       : なでて もらった ハートの つうさん（つかっても へらない数）{ count }
//   'placeItem' は v0.2 から ぜんぶの すいそうを 見る
//   --- v0.3 ---
//   'vitaminEat'   : ビタミンを たべた かいすう（1かいの ビタミンで 1）。love: true なら だいすき の 魚が たべた かいすう { count, love? }
//   'gadgetCount'  : ぜんぶの すいそうに 入っている v0.3 の 器具（ids の どれか）の かず { ids, count }
//
//   --- v0.6（ゲーム係）---
//   'stat'        : state.stats[key] の かず（fishing・gasagasa・adventureOpen・shinyGet・crownGet・feedKinds・quizPlays・quizPerfect・quizCorrect・toBox・fromBox・storeTank・coinsEarned など）{ key, count }
//   'bigCount' / 'adultCount' : ビッグ／おとな いじょうの 生きものの かず（おやすみすいそう・そうこも）{ count }
//   'creatures'   : そだてている 生きもの ぜんぶの かず { count }
//   'decorCount' / 'decorKinds' : 入れた かざりの かず／しゅるい { count }
//   'zukanWater'  : その 水の 生きものの ずかんの かず { water, count }
//   'zukanRarity' : ★ rarity いじょうの ずかんの かず { rarity, count }
//   'tanksWater'  : その 水の すいそうの かず（そうこも）{ water, count }
//   'quizBest'    : クイズの さいこう きろく { count }
//   lane : あそびの しゅるい（care おせわ／grow そだてる／zukan ずかん・ぼうけん／room すいそう・かざり／play ハート・クイズ）。
//          画面には lane ごとに 1つめを 出す（5つの まどが おなじ しゅるいで うまらない。agy の あん）。
//   gate : 'started'（すこし すすんでから 出す＝うんしだいの キラキラ・おうかん）／{ stat }（ぼうけんが ひらいてから）／{ unlock }
//
// 配列の じゅん（＝ order の じゅん）に 3つずつ 画面に出す。v0.2 の ものは order に 小数を つかって あいだに 入れた（おわったら つぎが 出る）。チュートリアル中は出さない。
const OLD = [
  { id: 'm_feed3',      order: 1,  title: 'ごはんの じかん',      desc: 'えさを 3かい あげよう',                   goal: { type: 'feed', count: 3 },          reward: { coin: 30 } },
  { id: 'm_pet5',       order: 2,  title: 'なでなで',              desc: 'さかなを 5かい タッチしよう',             goal: { type: 'pet', count: 5 },           reward: { coin: 20 } },
  { id: 'm_water1',     order: 3,  title: 'ピカピカの みず',      desc: 'みずかえを 1かい しよう',                 goal: { type: 'waterChange', count: 1 },   reward: { coin: 30 } },
  { id: 'm_fish2',      order: 4,  title: 'おともだち',            desc: 'さかなを 2ひきに しよう',                 goal: { type: 'fishCount', count: 2 },     reward: { coin: 50 } },
  { id: 'm_plant',      order: 5,  title: 'みどりの すいそう',    desc: 'みずくさを いれよう',                     goal: { type: 'placeItem', id: 'plant' },  reward: { coin: 40 } },
  { id: 'm_snail',      order: 5.5, title: 'おそうじやさん',      desc: 'かいを むかえよう',                       goal: { type: 'kindCount', kind: 'snail', count: 1 }, reward: { coin: 30 } },
  { id: 'm_thanks1',    order: 6,  title: 'ありがとうの きもち',  desc: 'さかなから ありがとうを もらおう',         goal: { type: 'thanks', count: 1 },        reward: { coin: 40 } },
  { id: 'm_friends',    order: 7,  title: 'なかよし コンビ',      desc: 'なかよしの さかなを いっしょに しよう',   goal: { type: 'friends' },                 reward: { coin: 60 } },
  { id: 'm_tank6',      order: 7.5, title: 'にぎやかな すいそう',  desc: '1つめの すいそうを 6ぴきに しよう',        goal: { type: 'unlock', id: 'tank6' }, reward: { coin: 150 } },
  { id: 'm_grow1',      order: 8,  title: 'おおきく なあれ',      desc: 'さかなを おとなに そだてよう',             goal: { type: 'grow', stage: 1 },          reward: { coin: 80 } },
  { id: 'm_hearts20',   order: 8.1, title: 'ハート あつめ',        desc: 'なでて ハートを 20こ もらおう',            goal: { type: 'hearts', count: 20 },       reward: { coin: 50 } },
  { id: 'm_salt',       order: 8.2, title: 'うみの すいそう',      desc: 'うみの すいそうを かおう',                 goal: { type: 'hasTankWater', water: 'salt' }, reward: { coin: 150 } },
  { id: 'm_tank2',      order: 8.3, title: 'すいそうが ふえた',    desc: 'すいそうを 2つに しよう',                 goal: { type: 'tankCount', count: 2 },     reward: { coin: 100 } },
  { id: 'm_filter',     order: 9,  title: 'みずを きれいに',      desc: 'フィルターを いれよう',                   goal: { type: 'placeItem', id: 'filter' }, reward: { coin: 60 } },
  { id: 'm_vitamin1',   order: 9.5, title: 'えいよう たっぷり',    desc: 'ビタミンを あげてみよう',                 goal: { type: 'vitaminEat', count: 1 },    reward: { coin: 40 } },
  { id: 'm_healthy',    order: 10, title: 'みんな げんき',        desc: 'さかな 3びき いじょう、みんなを げんきに', goal: { type: 'allHealthy', value: 70, minFish: 3 }, reward: { coin: 80 } },
  { id: 'm_natsuki',    order: 11, title: 'なかよしの しるし',    desc: 'なつきの ハートを 3こに しよう',          goal: { type: 'natsuki', value: 60 },      reward: { coin: 80 } },
  { id: 'm_zukan4',     order: 12, title: 'ずかん あつめ',        desc: 'ずかんに 4しゅるい のせよう',              goal: { type: 'zukan', count: 4 },         reward: { coin: 100 } },
  { id: 'm_light',      order: 13, title: 'きらきら すいそう',    desc: 'ライトを いれよう',                       goal: { type: 'placeItem', id: 'light' },  reward: { coin: 60 } },
  { id: 'm_vitamin_love', order: 13.5, title: 'だいすきな ごはん',  desc: 'ビタミンが だいすきな さかなに 3かい あげよう', goal: { type: 'vitaminEat', count: 3, love: true }, reward: { coin: 80 } },
  { id: 'm_days5',      order: 14, title: 'まいにち おせわ',      desc: '5にち おせわ しよう',                     goal: { type: 'days', count: 5 },          reward: { coin: 100 } },
  { id: 'm_gadget2',    order: 14.5, title: 'どうぐ はかせ',        desc: 'あたらしい どうぐを 2つ いれよう',         goal: { type: 'gadgetCount', ids: ['auto_feeder', 'fan', 'co2_kit', 'skimmer'], count: 2 }, reward: { coin: 100 } },
  { id: 'm_big',        order: 15, title: 'ビッグに なった！',    desc: 'さかなを ビッグに そだてよう',             goal: { type: 'grow', stage: 2 },          reward: { coin: 150 } },
  // ---- v0.2 ----
  { id: 'm_saltfish3',  order: 19, title: 'うみの なかまたち',    desc: 'うみの いきものを 3びきに しよう',          goal: { type: 'waterFishCount', water: 'salt', count: 3 }, reward: { coin: 100 } },
  { id: 'm_liverock',   order: 20, title: 'うみの いわ',          desc: 'ライブロックを いれよう',                 goal: { type: 'placeItem', id: 'liverock' }, reward: { coin: 60 } },
  { id: 'm_hearts100',  order: 21, title: 'ハート いっぱい',      desc: 'なでて ハートを 100こ もらおう',           goal: { type: 'hearts', count: 100 },      reward: { coin: 150 } },
  { id: 'm_zukan12',    order: 22, title: 'ずかん はかせ',        desc: 'ずかんに 12しゅるい のせよう',             goal: { type: 'zukan', count: 12 },        reward: { coin: 200 } },
];

// v0.5 まで の 27こ の lane
const OLD_LANE = {
  m_feed3: 'care', m_water1: 'care', m_thanks1: 'care', m_vitamin1: 'care', m_healthy: 'care', m_vitamin_love: 'care', m_days5: 'care',
  m_pet5: 'play', m_hearts20: 'play', m_natsuki: 'play', m_hearts100: 'play',
  m_fish2: 'zukan', m_snail: 'zukan', m_tank6: 'zukan', m_zukan4: 'zukan', m_saltfish3: 'zukan', m_zukan12: 'zukan',
  m_plant: 'room', m_salt: 'room', m_tank2: 'room', m_filter: 'room', m_light: 'room', m_gadget2: 'room', m_liverock: 'room',
  m_friends: 'grow', m_grow1: 'grow', m_big: 'grow',
};

// ---- v0.6 で ふやした ミッション（ゲーム係）----
// [id, title, desc, goal, coin, gate]。lane の 中は 上から じゅんに 出る（やさしい → ながい）。
// ほうしゅう：かんたん 30〜60／ふつう 80〜200／ながい 300〜500（Codex 30〜300・agy 50〜800 の あいだ）
const ADV = { stat: 'adventureOpen' };
const T6 = { unlock: 'tank6' };
const NEW = {
  care: [
    ['c_feed20', 'もりもり ごはん', 'えさを 20かい あげよう', { type: 'feed', count: 20 }, 60],
    ['c_water5', 'みずかえ じょうず', 'みずかえを 5かい しよう', { type: 'waterChange', count: 5 }, 60],
    ['c_scoop5', 'おそうじ たいむ', 'そうじを 5かい しよう', { type: 'scoop', count: 5 }, 60],
    ['c_feedkinds2', 'いろいろな ごはん', '2しゅるいの えさを あげよう', { type: 'stat', key: 'feedKinds', count: 2 }, 80],
    ['c_feed50', 'ごはん たっぷり', 'えさを 50かい あげよう', { type: 'feed', count: 50 }, 120],
    ['c_thanks10', 'ありがとう いっぱい', 'ありがとうを 10かい もらおう', { type: 'thanks', count: 10 }, 120],
    ['c_vitamin10', 'げんきの もと', 'ビタミンを 10かい あげよう', { type: 'vitaminEat', count: 10 }, 120],
    ['c_days10', '10にち おせわ', '10にち おせわ しよう', { type: 'days', count: 10 }, 150],
    ['c_scoop20', 'ピカピカ はかせ', 'そうじを 20かい しよう', { type: 'scoop', count: 20 }, 150],
    ['c_healthy5', 'げんきな すいそう', '5ひき いじょう いる すいそうを みんな げんきに', { type: 'allHealthy', value: 70, minFish: 5 }, 150],
    ['c_feedkinds4', 'ごはん はかせ', '4しゅるいの えさを あげよう', { type: 'stat', key: 'feedKinds', count: 4 }, 200],
    ['c_water20', 'みずかえ めいじん', 'みずかえを 20かい しよう', { type: 'waterChange', count: 20 }, 200],
    ['c_feed150', 'まいにちの ごはん', 'えさを 150かい あげよう', { type: 'feed', count: 150 }, 300],
    ['c_thanks50', 'ありがとうの たば', 'ありがとうを 50かい もらおう', { type: 'thanks', count: 50 }, 300],
    ['c_days30', '30にち おせわ', '30にち おせわ しよう', { type: 'days', count: 30 }, 400],
    ['c_days60', 'ずっと いっしょ', '60にち おせわ しよう', { type: 'days', count: 60 }, 500],
  ],
  grow: [
    ['g_adult3', 'おとなの なかま', 'おとなを 3びきに しよう', { type: 'adultCount', count: 3 }, 80],
    ['g_creatures10', 'にぎやかな おへや', 'いきものを 10ぴきに しよう', { type: 'creatures', count: 10 }, 100],
    ['g_big3', 'ビッグ トリオ', 'ビッグを 3びきに しよう', { type: 'bigCount', count: 3 }, 150],
    ['g_adult10', 'おとな いっぱい', 'おとなを 10ぴきに しよう', { type: 'adultCount', count: 10 }, 150],
    ['g_crown1', 'おうかんの しるし', 'おうかんの いきものを みつけたよ', { type: 'stat', key: 'crownGet', count: 1 }, 150, 'started'],
    ['g_natsuki100', 'だいすきの しるし', 'なつきの ハートを 5こに しよう', { type: 'natsuki', value: 100 }, 200],
    ['g_big5', 'ビッグ ファイブ', 'ビッグを 5ひきに しよう', { type: 'bigCount', count: 5 }, 200],
    ['g_creatures20', 'いきもの だいすき', 'いきものを 20ぴきに しよう', { type: 'creatures', count: 20 }, 200],
    ['g_adult20', 'おとなの むれ', 'おとなを 20ぴきに しよう', { type: 'adultCount', count: 20 }, 300],
    ['g_crown3', 'おうかん あつめ', 'おうかんの しゅるいを 3つに しよう', { type: 'stat', key: 'crownGet', count: 3 }, 300, 'started'],
    ['g_big10', 'ビッグ いっぱい', 'ビッグを 10ぴきに しよう', { type: 'bigCount', count: 10 }, 300],
    ['g_crown5', 'おうかん はかせ', 'おうかんの しゅるいを 5つに しよう', { type: 'stat', key: 'crownGet', count: 5 }, 500, 'started'],
    ['g_big20', 'ビッグ めいじん', 'ビッグを 20ぴきに しよう', { type: 'bigCount', count: 20 }, 500],
  ],
  zukan: [
    ['z_shrimp2', 'エビの なかま', 'エビを 2ひきに しよう', { type: 'kindCount', kind: 'shrimp', count: 2 }, 60],
    ['z_zukan8', 'ずかん 8', 'ずかんに 8しゅるい のせよう', { type: 'zukan', count: 8 }, 80],
    ['z_adv', 'ぼうけんの はじまり', 'ぼうけんに いけるように なったよ', { type: 'stat', key: 'adventureOpen', count: 1 }, 100, ADV],
    ['z_fishing1', 'はじめての つり', 'うみで つりを しよう', { type: 'stat', key: 'fishing', count: 1 }, 60, ADV],
    ['z_gasa1', 'はじめての ガサガサ', 'いけで ガサガサ しよう', { type: 'stat', key: 'gasagasa', count: 1 }, 60, ADV],
    ['z_salt5', 'うみの ずかん', 'うみの いきものを ずかんに 5しゅるい', { type: 'zukanWater', water: 'salt', count: 5 }, 120, T6],
    ['z_zukan16', 'ずかん 16', 'ずかんに 16しゅるい のせよう', { type: 'zukan', count: 16 }, 150],
    ['z_fishing10', 'つり じょうず', 'つりを 10かい しよう', { type: 'stat', key: 'fishing', count: 10 }, 150, ADV],
    ['z_gasa10', 'ガサガサ じょうず', 'ガサガサを 10かい しよう', { type: 'stat', key: 'gasagasa', count: 10 }, 150, ADV],
    ['z_shiny1', 'キラキラ はっけん', 'キラキラの いきものを みつけたよ', { type: 'stat', key: 'shinyGet', count: 1 }, 200, 'started'],
    ['z_rare3', 'めずらしい なかま', '★3 いじょうを ずかんに 5しゅるい', { type: 'zukanRarity', rarity: 3, count: 5 }, 200],
    ['z_pond5', 'いけの ずかん', 'いけの いきものを ずかんに 5しゅるい', { type: 'zukanWater', water: 'pond', count: 5 }, 200, ADV],
    ['z_zukan20', 'ずかん 20', 'ずかんに 20しゅるい のせよう', { type: 'zukan', count: 20 }, 200],
    ['z_fishing30', 'つり めいじん', 'つりを 30かい しよう', { type: 'stat', key: 'fishing', count: 30 }, 300, ADV],
    ['z_gasa30', 'ガサガサ めいじん', 'ガサガサを 30かい しよう', { type: 'stat', key: 'gasagasa', count: 30 }, 300, ADV],
    ['z_zukan25', 'ずかん 25', 'ずかんに 25しゅるい のせよう', { type: 'zukan', count: 25 }, 300],
    ['z_rare4', 'とっても めずらしい', '★4 いじょうを ずかんに 3しゅるい', { type: 'zukanRarity', rarity: 4, count: 3 }, 300],
    ['z_zukan30', 'ずかん 30', 'ずかんに 30しゅるい のせよう', { type: 'zukan', count: 30 }, 400],
    ['z_pond15', 'いけ はかせ', 'いけの いきものを ずかんに 15しゅるい', { type: 'zukanWater', water: 'pond', count: 15 }, 400, ADV],
    ['z_shiny3', 'キラキラ コレクター', 'キラキラの いきものを 3びき みつけよう', { type: 'stat', key: 'shinyGet', count: 3 }, 500, 'started'],
    ['z_zukan50', 'ずかん はかせ 50', 'ずかんに 50しゅるい のせよう', { type: 'zukan', count: 50 }, 500, ADV],
  ],
  room: [
    ['r_decor3', 'かざりつけ', 'かざりを 3つ いれよう', { type: 'decorCount', count: 3 }, 50],
    ['r_box1', 'おやすみ なさい', 'おやすみすいそうに 1ぴき あずけよう', { type: 'stat', key: 'toBox', count: 1 }, 50],
    ['r_frombox1', 'おはよう', 'おやすみすいそうから 1ぴき もどそう', { type: 'stat', key: 'fromBox', count: 1 }, 50],
    ['r_kinds5', 'かざり いろいろ', 'かざりを 5しゅるい いれよう', { type: 'decorKinds', count: 5 }, 100],
    ['r_decor8', 'すてきな すいそう', 'かざりを 8つ いれよう', { type: 'decorCount', count: 8 }, 120],
    ['r_store1', 'そうこに しまおう', 'すいそうを そうこに しまおう', { type: 'stat', key: 'storeTank', count: 1 }, 80, T6],
    ['r_tank3', 'すいそう 3つ', 'すいそうを 3つに しよう', { type: 'tankCount', count: 3 }, 200, T6],
    ['r_pondtank', 'いけの すいそう', 'いけの すいそうを もとう', { type: 'hasTankWater', water: 'pond' }, 150, ADV],
    ['r_kinds10', 'かざり はかせ', 'かざりを 10しゅるい いれよう', { type: 'decorKinds', count: 10 }, 200],
    ['r_gadget4', 'どうぐ めいじん', 'あたらしい どうぐを 4つ いれよう', { type: 'gadgetCount', ids: ['auto_feeder', 'fan', 'co2_kit', 'skimmer'], count: 4 }, 200, T6],
    ['r_salt2', 'うみが ふたつ', 'うみの すいそうを 2つに しよう', { type: 'tanksWater', water: 'salt', count: 2 }, 300, T6],
    ['r_decor20', 'かざり いっぱい', 'かざりを 20こ いれよう', { type: 'decorCount', count: 20 }, 300],
    ['r_tank6', 'すいそう 6つ', 'すいそうを 6つに しよう', { type: 'tankCount', count: 6 }, 400, T6],
    ['r_tank8', 'すいそう コレクター', 'すいそうを 8つに しよう（そうこも かぞえるよ）', { type: 'tankCount', count: 8 }, 500, T6],
  ],
  play: [
    ['p_pet30', 'なでなで 30', 'さかなを 30かい なでよう', { type: 'pet', count: 30 }, 50],
    ['p_quiz1', 'クイズに ちょうせん', 'さかな あて クイズで あそぼう', { type: 'stat', key: 'quizPlays', count: 1 }, 50],
    ['p_hearts50', 'ハート 50', 'ハートを 50こ あつめよう', { type: 'hearts', count: 50 }, 80],
    ['p_quizbest3', 'クイズ 3もん', 'クイズで 3もん せいかい しよう', { type: 'quizBest', count: 3 }, 80],
    ['p_pet100', 'なでなで 100', 'さかなを 100かい なでよう', { type: 'pet', count: 100 }, 120],
    ['p_quizperfect1', 'ぜんもん せいかい', 'クイズで ぜんもん せいかい しよう', { type: 'stat', key: 'quizPerfect', count: 1 }, 150],
    ['p_hearts200', 'ハート 200', 'ハートを 200こ あつめよう', { type: 'hearts', count: 200 }, 150],
    ['p_quiz10', 'クイズ だいすき', 'クイズで 10かい あそぼう', { type: 'stat', key: 'quizPlays', count: 10 }, 150],
    ['p_hearts300', 'ハート 300', 'ハートを 300こ あつめよう', { type: 'hearts', count: 300 }, 200],
    ['p_quizcorrect30', 'さかな ものしり', 'クイズで 30もん せいかい しよう', { type: 'stat', key: 'quizCorrect', count: 30 }, 200],
    ['p_pet300', 'なでなで 300', 'さかなを 300かい なでよう', { type: 'pet', count: 300 }, 200],
    ['p_coins3000', 'コイン ちょきん', 'コインを ぜんぶで 3000 もらおう', { type: 'stat', key: 'coinsEarned', count: 3000 }, 300],
    ['p_hearts600', 'ハート 600', 'ハートを 600こ あつめよう', { type: 'hearts', count: 600 }, 300],
    ['p_quizperfect5', 'クイズ めいじん', 'クイズで ぜんもん せいかいを 5かい', { type: 'stat', key: 'quizPerfect', count: 5 }, 300],
    ['p_hearts1000', 'ハート 1000', 'ハートを 1000こ あつめよう', { type: 'hearts', count: 1000 }, 500],
  ],
};

const LANES = ['care', 'grow', 'zukan', 'room', 'play'];
export const MISSIONS = [
  ...OLD.map((m) => ({ ...m, lane: OLD_LANE[m.id] || 'care' })),
  // order：lane の 中の じゅん（30, 31, …）＋ lane ごとに すこし ずらす（かさならない ように）
  ...LANES.flatMap((lane, li) => NEW[lane].map(([id, title, desc, goal, coin, gate], i) => ({
    id, order: 30 + i + li / 10, lane, title, desc, goal, reward: { coin }, ...(gate ? { gate } : {}),
  }))),
];

export const MISSION_VISIBLE = 5;   // いちどに 画面に出す かず（v0.6：3 → 5）
