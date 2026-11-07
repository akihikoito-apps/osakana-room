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
//
// order の じゅんに 3つずつ 画面に出す（おわったら つぎが 出る）。チュートリアル中は出さない。
export const MISSIONS = [
  { id: 'm_feed3',      order: 1,  title: 'ごはんの じかん',      desc: 'えさを 3かい あげよう',                   goal: { type: 'feed', count: 3 },          reward: { coin: 30 } },
  { id: 'm_pet5',       order: 2,  title: 'なでなで',              desc: 'さかなを 5かい タッチしよう',             goal: { type: 'pet', count: 5 },           reward: { coin: 20 } },
  { id: 'm_water1',     order: 3,  title: 'ピカピカの みず',      desc: 'みずかえを 1かい しよう',                 goal: { type: 'waterChange', count: 1 },   reward: { coin: 30 } },
  { id: 'm_fish2',      order: 4,  title: 'おともだち',            desc: 'さかなを 2ひきに しよう',                 goal: { type: 'fishCount', count: 2 },     reward: { coin: 50 } },
  { id: 'm_plant',      order: 5,  title: 'みどりの すいそう',    desc: 'みずくさを いれよう',                     goal: { type: 'placeItem', id: 'plant' },  reward: { coin: 40 } },
  { id: 'm_thanks1',    order: 6,  title: 'ありがとうの きもち',  desc: 'さかなから ありがとうを もらおう',         goal: { type: 'thanks', count: 1 },        reward: { coin: 40 } },
  { id: 'm_friends',    order: 7,  title: 'なかよし コンビ',      desc: 'なかよしの さかなを いっしょに しよう',   goal: { type: 'friends' },                 reward: { coin: 60 } },
  { id: 'm_grow1',      order: 8,  title: 'おおきく なあれ',      desc: 'さかなを おとなに そだてよう',             goal: { type: 'grow', stage: 1 },          reward: { coin: 80 } },
  { id: 'm_filter',     order: 9,  title: 'みずを きれいに',      desc: 'フィルターを いれよう',                   goal: { type: 'placeItem', id: 'filter' }, reward: { coin: 60 } },
  { id: 'm_healthy',    order: 10, title: 'みんな げんき',        desc: 'さかな 3びき いじょう、みんなを げんきに', goal: { type: 'allHealthy', value: 70, minFish: 3 }, reward: { coin: 80 } },
  { id: 'm_natsuki',    order: 11, title: 'なかよしの しるし',    desc: 'なつきの ハートを 3こに しよう',          goal: { type: 'natsuki', value: 60 },      reward: { coin: 80 } },
  { id: 'm_zukan4',     order: 12, title: 'ずかん あつめ',        desc: 'ずかんに 4しゅるい のせよう',              goal: { type: 'zukan', count: 4 },         reward: { coin: 100 } },
  { id: 'm_light',      order: 13, title: 'きらきら すいそう',    desc: 'ライトを いれよう',                       goal: { type: 'placeItem', id: 'light' },  reward: { coin: 60 } },
  { id: 'm_days5',      order: 14, title: 'まいにち おせわ',      desc: '5にち おせわ しよう',                     goal: { type: 'days', count: 5 },          reward: { coin: 100 } },
  { id: 'm_big',        order: 15, title: 'ビッグに なった！',    desc: 'さかなを ビッグに そだてよう',             goal: { type: 'grow', stage: 2 },          reward: { coin: 150 } },
];

export const MISSION_VISIBLE = 3;   // いちどに 画面に出す かず
