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
// 配列の じゅん（＝ order の じゅん）に 3つずつ 画面に出す。v0.2 の ものは order に 小数を つかって あいだに 入れた（おわったら つぎが 出る）。チュートリアル中は出さない。
export const MISSIONS = [
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

export const MISSION_VISIBLE = 3;   // いちどに 画面に出す かず
