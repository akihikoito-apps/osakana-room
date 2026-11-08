// 相性表（企画・図鑑係）。2=なかよし 1=ふつう 0=にがて
// キーは id を辞書順（JS の < 比較）に並べて | でつなぐ。同じ種類どうしは 'medaka|medaka' のように同じ id を2つ。
// 表に無い組み合わせは COMPAT_DEFAULT（ふつう）。表は docs/相性表.md と同じ。
export const COMPAT_DEFAULT = 1;

export const COMPAT = {
  // 同じ種類どうし
  'medaka|medaka': 2,
  'guppy|guppy': 2,
  'neon_tetra|neon_tetra': 2,
  'goldfish|goldfish': 2,
  'corydoras|corydoras': 2,
  'minami_shrimp|minami_shrimp': 2,
  'betta|betta': 0,                     // オスどうしは けんかする
  'angelfish|angelfish': 1,
  'red_bee_shrimp|red_bee_shrimp': 2,
  'albino_corydoras|albino_corydoras': 2,

  // メダカ
  'guppy|medaka': 1,
  'medaka|neon_tetra': 1,
  'goldfish|medaka': 1,                 // にほんでは よく いっしょに かわれる
  'corydoras|medaka': 1,
  'medaka|minami_shrimp': 2,            // どちらも にほんの おがわ
  'betta|medaka': 1,
  'angelfish|medaka': 0,                // ちいさい魚を おいかける
  'medaka|red_bee_shrimp': 1,
  'albino_corydoras|medaka': 1,

  // グッピー
  'guppy|neon_tetra': 2,
  'goldfish|guppy': 0,
  'corydoras|guppy': 2,
  'guppy|minami_shrimp': 1,
  'betta|guppy': 0,                     // ながい ひれどうしで けんか
  'angelfish|guppy': 1,
  'guppy|red_bee_shrimp': 1,
  'albino_corydoras|guppy': 2,

  // ネオンテトラ
  'goldfish|neon_tetra': 0,
  'corydoras|neon_tetra': 2,
  'minami_shrimp|neon_tetra': 1,
  'betta|neon_tetra': 1,
  'angelfish|neon_tetra': 0,            // エンゼルが たべようとする
  'neon_tetra|red_bee_shrimp': 1,
  'albino_corydoras|neon_tetra': 2,

  // キンギョ（あたたかい魚とも、エビとも あわない）
  'corydoras|goldfish': 0,
  'goldfish|minami_shrimp': 0,
  'betta|goldfish': 0,
  'angelfish|goldfish': 0,
  'goldfish|red_bee_shrimp': 0,
  'albino_corydoras|goldfish': 0,

  // コリドラス
  'corydoras|minami_shrimp': 2,
  'betta|corydoras': 1,
  'angelfish|corydoras': 2,
  'corydoras|red_bee_shrimp': 1,
  'albino_corydoras|corydoras': 2,      // なかまどうし

  // ミナミヌマエビ
  'betta|minami_shrimp': 0,             // ベタが エビを たべようとする
  'angelfish|minami_shrimp': 0,
  'minami_shrimp|red_bee_shrimp': 2,
  'albino_corydoras|minami_shrimp': 2,

  // ベタ
  'angelfish|betta': 0,
  'betta|red_bee_shrimp': 0,
  'albino_corydoras|betta': 1,

  // エンゼルフィッシュ
  'angelfish|red_bee_shrimp': 0,
  'albino_corydoras|angelfish': 2,

  // レッドビーシュリンプ
  'albino_corydoras|red_bee_shrimp': 1,

  // ======== v0.2 ========
  // 淡水と海水は 同じ すいそうに 入らないので、くみあわせは 書かない

  // 淡水の 同じ種類どうし
  'ishimaki|ishimaki': 1,
  'ramshorn|ramshorn': 1,
  'platy|platy': 2,
  'cherry_barb|cherry_barb': 2,
  'otocinclus|otocinclus': 2,
  'dwarf_gourami|dwarf_gourami': 0,      // オスどうしは けんかする
  'rummy_nose|rummy_nose': 2,

  // 淡水：プラティ（おだやか）
  'guppy|platy': 2,
  'neon_tetra|platy': 2,
  'corydoras|platy': 2,
  'albino_corydoras|platy': 2,
  'goldfish|platy': 0,
  'cherry_barb|platy': 2,
  'otocinclus|platy': 2,
  'platy|rummy_nose': 2,
  'medaka|platy': 1,

  // 淡水：チェリーバルブ
  'cherry_barb|neon_tetra': 2,
  'cherry_barb|rummy_nose': 2,
  'cherry_barb|corydoras': 2,
  'albino_corydoras|cherry_barb': 2,
  'cherry_barb|goldfish': 0,
  'cherry_barb|otocinclus': 2,

  // 淡水：オトシンクルス（おそうじやで おだやか）
  'neon_tetra|otocinclus': 2,
  'corydoras|otocinclus': 2,
  'albino_corydoras|otocinclus': 2,
  'minami_shrimp|otocinclus': 2,
  'otocinclus|red_bee_shrimp': 2,
  'guppy|otocinclus': 2,
  'goldfish|otocinclus': 0,
  'otocinclus|rummy_nose': 2,

  // 淡水：ドワーフグラミー
  'betta|dwarf_gourami': 0,              // にた なかまで けんか
  'dwarf_gourami|minami_shrimp': 0,      // エビを たべようとする
  'dwarf_gourami|red_bee_shrimp': 0,
  'dwarf_gourami|goldfish': 0,
  'corydoras|dwarf_gourami': 2,
  'albino_corydoras|dwarf_gourami': 2,

  // 淡水：ラミーノーズテトラ
  'neon_tetra|rummy_nose': 2,
  'corydoras|rummy_nose': 2,
  'albino_corydoras|rummy_nose': 2,
  'angelfish|rummy_nose': 0,             // エンゼルが たべようとする
  'goldfish|rummy_nose': 0,

  // 淡水：貝（だれとでも ふつう。エビ・コリドラスとは なかよし）
  'ishimaki|minami_shrimp': 2,
  'ishimaki|red_bee_shrimp': 2,
  'ishimaki|otocinclus': 2,
  'minami_shrimp|ramshorn': 2,
  'ramshorn|red_bee_shrimp': 2,

  // 海水の 同じ種類どうし
  'blue_damsel|blue_damsel': 0,          // なわばりで けんか
  'clownfish|clownfish': 2,
  'skunk_shrimp|skunk_shrimp': 2,
  'shittaka|shittaka': 1,
  'firefish|firefish': 1,
  'yellow_tang|yellow_tang': 0,          // ハギどうしは けんか
  'blue_tang|blue_tang': 0,
  'mandarin|mandarin': 0,                // オスどうしは けんか

  // 海水
  'blue_tang|yellow_tang': 0,            // ハギどうし
  'blue_damsel|firefish': 0,             // ルリスズメが おいかける
  'blue_damsel|mandarin': 0,
  'blue_damsel|clownfish': 1,
  'clownfish|skunk_shrimp': 2,           // おそうじエビは だれとでも なかよし
  'blue_tang|skunk_shrimp': 2,
  'skunk_shrimp|yellow_tang': 2,
  'firefish|skunk_shrimp': 2,
  'mandarin|skunk_shrimp': 2,
  'blue_damsel|skunk_shrimp': 2,
  'shittaka|skunk_shrimp': 2,
  'clownfish|firefish': 2,
  'clownfish|mandarin': 2,
  'clownfish|yellow_tang': 2,
  'blue_tang|clownfish': 2,
  'firefish|mandarin': 2,
  'mandarin|shittaka': 2,

  // ======== v0.4（企画・図鑑係）：新しい 14しゅるい。くみあわせは ぜんぶ 書く（1 も 書く）========
  // 淡水：yamato_shrimp
  'medaka|yamato_shrimp': 2,
  'guppy|yamato_shrimp': 1,
  'neon_tetra|yamato_shrimp': 1,
  'goldfish|yamato_shrimp': 0,  // キンギョは エビと あわない
  'corydoras|yamato_shrimp': 2,
  'minami_shrimp|yamato_shrimp': 2,
  'betta|yamato_shrimp': 0,  // エビを たべようとする
  'angelfish|yamato_shrimp': 0,  // エビを たべようとする
  'red_bee_shrimp|yamato_shrimp': 2,
  'albino_corydoras|yamato_shrimp': 2,
  'ishimaki|yamato_shrimp': 2,
  'ramshorn|yamato_shrimp': 2,
  'platy|yamato_shrimp': 1,
  'cherry_barb|yamato_shrimp': 1,
  'otocinclus|yamato_shrimp': 2,
  'dwarf_gourami|yamato_shrimp': 0,  // エビを たべようとする
  'rummy_nose|yamato_shrimp': 1,
  'yamato_shrimp|yamato_shrimp': 2,
  'kanoko|yamato_shrimp': 2,
  // 淡水：kanoko
  'kanoko|medaka': 1,
  'guppy|kanoko': 1,
  'kanoko|neon_tetra': 1,
  'goldfish|kanoko': 1,
  'corydoras|kanoko': 1,
  'kanoko|minami_shrimp': 2,  // イシマキガイと おなじ
  'betta|kanoko': 1,
  'angelfish|kanoko': 1,
  'kanoko|red_bee_shrimp': 2,  // イシマキガイと おなじ
  'albino_corydoras|kanoko': 1,
  'ishimaki|kanoko': 1,
  'kanoko|ramshorn': 1,
  'kanoko|platy': 1,
  'cherry_barb|kanoko': 1,
  'kanoko|otocinclus': 2,  // イシマキガイと おなじ
  'dwarf_gourami|kanoko': 1,
  'kanoko|rummy_nose': 1,
  'kanoko|kanoko': 1,
  // 海水：green_chromis
  'blue_damsel|green_chromis': 0,  // ルリスズメが おいかける
  'clownfish|green_chromis': 2,  // おだやかな ていばん
  'green_chromis|skunk_shrimp': 2,  // おそうじエビ
  'green_chromis|shittaka': 1,
  'firefish|green_chromis': 1,
  'green_chromis|yellow_tang': 1,
  'blue_tang|green_chromis': 1,
  'green_chromis|mandarin': 1,
  'green_chromis|green_chromis': 2,  // むれで およぐ
  'green_chromis|tomato_clown': 1,
  'green_chromis|pajama_cardinal': 1,
  'banggai_cardinal|green_chromis': 1,
  'green_chromis|royal_gramma': 1,
  'green_chromis|vagabond_butterfly': 1,
  'flame_angel|green_chromis': 1,
  'boxfish|green_chromis': 1,
  'green_chromis|moorish_idol': 1,
  'green_chromis|peppermint_shrimp': 1,
  'green_chromis|white_socks': 2,  // おそうじエビ
  'green_chromis|magaki': 1,
  // 海水：tomato_clown
  'blue_damsel|tomato_clown': 0,  // どちらも きが つよい
  'clownfish|tomato_clown': 0,  // クマノミどうし
  'skunk_shrimp|tomato_clown': 2,  // おそうじエビ
  'shittaka|tomato_clown': 1,
  'firefish|tomato_clown': 1,
  'tomato_clown|yellow_tang': 1,
  'blue_tang|tomato_clown': 1,
  'mandarin|tomato_clown': 1,
  'tomato_clown|tomato_clown': 1,  // ペアなら かえるが きが つよい
  'pajama_cardinal|tomato_clown': 1,
  'banggai_cardinal|tomato_clown': 1,
  'royal_gramma|tomato_clown': 1,
  'tomato_clown|vagabond_butterfly': 1,
  'flame_angel|tomato_clown': 1,
  'boxfish|tomato_clown': 1,
  'moorish_idol|tomato_clown': 1,
  'peppermint_shrimp|tomato_clown': 1,
  'tomato_clown|white_socks': 2,  // おそうじエビ
  'magaki|tomato_clown': 1,
  // 海水：pajama_cardinal
  'blue_damsel|pajama_cardinal': 0,  // ルリスズメが おいかける
  'clownfish|pajama_cardinal': 2,  // おだやかな ていばん
  'pajama_cardinal|skunk_shrimp': 2,  // おそうじエビ
  'pajama_cardinal|shittaka': 1,
  'firefish|pajama_cardinal': 1,
  'pajama_cardinal|yellow_tang': 1,
  'blue_tang|pajama_cardinal': 1,
  'mandarin|pajama_cardinal': 1,
  'pajama_cardinal|pajama_cardinal': 2,  // むれで およぐ
  'banggai_cardinal|pajama_cardinal': 2,  // テンジクダイの なかま
  'pajama_cardinal|royal_gramma': 1,
  'pajama_cardinal|vagabond_butterfly': 1,
  'flame_angel|pajama_cardinal': 1,
  'boxfish|pajama_cardinal': 1,
  'moorish_idol|pajama_cardinal': 1,
  'pajama_cardinal|peppermint_shrimp': 1,
  'pajama_cardinal|white_socks': 2,  // おそうじエビ
  'magaki|pajama_cardinal': 1,
  // 海水：banggai_cardinal
  'banggai_cardinal|blue_damsel': 0,  // ルリスズメが おいかける
  'banggai_cardinal|clownfish': 2,  // おだやかな ていばん
  'banggai_cardinal|skunk_shrimp': 2,  // おそうじエビ
  'banggai_cardinal|shittaka': 1,
  'banggai_cardinal|firefish': 1,
  'banggai_cardinal|yellow_tang': 1,
  'banggai_cardinal|blue_tang': 1,
  'banggai_cardinal|mandarin': 1,
  'banggai_cardinal|banggai_cardinal': 1,  // おとなどうしは すこし あらそう
  'banggai_cardinal|royal_gramma': 1,
  'banggai_cardinal|vagabond_butterfly': 1,
  'banggai_cardinal|flame_angel': 1,
  'banggai_cardinal|boxfish': 1,
  'banggai_cardinal|moorish_idol': 1,
  'banggai_cardinal|peppermint_shrimp': 1,
  'banggai_cardinal|white_socks': 2,  // おそうじエビ
  'banggai_cardinal|magaki': 1,
  // 海水：royal_gramma
  'blue_damsel|royal_gramma': 0,  // ルリスズメが おいかける
  'clownfish|royal_gramma': 1,
  'royal_gramma|skunk_shrimp': 2,  // おそうじエビ
  'royal_gramma|shittaka': 1,
  'firefish|royal_gramma': 1,
  'royal_gramma|yellow_tang': 1,
  'blue_tang|royal_gramma': 1,
  'mandarin|royal_gramma': 1,
  'royal_gramma|royal_gramma': 0,  // なわばりで けんか
  'royal_gramma|vagabond_butterfly': 1,
  'flame_angel|royal_gramma': 1,
  'boxfish|royal_gramma': 1,
  'moorish_idol|royal_gramma': 1,
  'peppermint_shrimp|royal_gramma': 1,
  'royal_gramma|white_socks': 2,  // おそうじエビ
  'magaki|royal_gramma': 1,
  // 海水：vagabond_butterfly
  'blue_damsel|vagabond_butterfly': 1,
  'clownfish|vagabond_butterfly': 1,
  'skunk_shrimp|vagabond_butterfly': 2,  // おそうじエビ
  'shittaka|vagabond_butterfly': 1,
  'firefish|vagabond_butterfly': 1,
  'vagabond_butterfly|yellow_tang': 1,
  'blue_tang|vagabond_butterfly': 1,
  'mandarin|vagabond_butterfly': 1,
  'vagabond_butterfly|vagabond_butterfly': 1,  // しぜんでは ペアで くらす
  'flame_angel|vagabond_butterfly': 1,
  'boxfish|vagabond_butterfly': 1,
  'moorish_idol|vagabond_butterfly': 1,
  'peppermint_shrimp|vagabond_butterfly': 1,
  'vagabond_butterfly|white_socks': 2,  // おそうじエビ
  'magaki|vagabond_butterfly': 1,
  // 海水：flame_angel
  'blue_damsel|flame_angel': 1,
  'clownfish|flame_angel': 1,
  'flame_angel|skunk_shrimp': 2,  // おそうじエビ
  'flame_angel|shittaka': 1,
  'firefish|flame_angel': 1,
  'flame_angel|yellow_tang': 1,
  'blue_tang|flame_angel': 1,
  'flame_angel|mandarin': 1,
  'flame_angel|flame_angel': 0,  // なわばりで けんか
  'boxfish|flame_angel': 1,
  'flame_angel|moorish_idol': 1,
  'flame_angel|peppermint_shrimp': 1,
  'flame_angel|white_socks': 2,  // おそうじエビ
  'flame_angel|magaki': 1,
  // 海水：boxfish
  'blue_damsel|boxfish': 0,  // ルリスズメが おいかける
  'boxfish|clownfish': 1,
  'boxfish|skunk_shrimp': 1,  // ハコフグは エビを つつくことが ある
  'boxfish|shittaka': 1,
  'boxfish|firefish': 1,
  'boxfish|yellow_tang': 1,
  'blue_tang|boxfish': 1,
  'boxfish|mandarin': 1,
  'boxfish|boxfish': 0,  // おなじ なかまどうしは けんか
  'boxfish|moorish_idol': 1,
  'boxfish|peppermint_shrimp': 0,  // ハコフグが エビを つつく
  'boxfish|white_socks': 1,  // ハコフグは エビを つつくことが ある
  'boxfish|magaki': 1,
  // 海水：moorish_idol
  'blue_damsel|moorish_idol': 1,
  'clownfish|moorish_idol': 1,
  'moorish_idol|skunk_shrimp': 2,  // おそうじエビ
  'moorish_idol|shittaka': 1,
  'firefish|moorish_idol': 1,
  'moorish_idol|yellow_tang': 1,
  'blue_tang|moorish_idol': 1,
  'mandarin|moorish_idol': 1,
  'moorish_idol|moorish_idol': 0,  // すいそうでは けんかしやすい
  'moorish_idol|peppermint_shrimp': 1,
  'moorish_idol|white_socks': 2,  // おそうじエビ
  'magaki|moorish_idol': 1,
  // 海水：peppermint_shrimp
  'blue_damsel|peppermint_shrimp': 1,
  'clownfish|peppermint_shrimp': 1,
  'peppermint_shrimp|skunk_shrimp': 2,  // おなじ なかまの エビ
  'peppermint_shrimp|shittaka': 2,
  'firefish|peppermint_shrimp': 1,
  'peppermint_shrimp|yellow_tang': 1,
  'blue_tang|peppermint_shrimp': 1,
  'mandarin|peppermint_shrimp': 2,  // ライブロックの なかま
  'peppermint_shrimp|peppermint_shrimp': 2,  // なかまと くらす
  'peppermint_shrimp|white_socks': 1,
  'magaki|peppermint_shrimp': 2,  // エビと かいは なかよし
  // 海水：white_socks
  'blue_damsel|white_socks': 2,  // おそうじエビ
  'clownfish|white_socks': 2,  // おそうじエビ
  'skunk_shrimp|white_socks': 2,
  'shittaka|white_socks': 2,  // おそうじエビ
  'firefish|white_socks': 2,  // おそうじエビ
  'white_socks|yellow_tang': 2,  // おそうじエビ
  'blue_tang|white_socks': 2,  // おそうじエビ
  'mandarin|white_socks': 2,  // おそうじエビ
  'white_socks|white_socks': 1,  // すこし なわばりが ある
  'magaki|white_socks': 2,  // エビと かいは なかよし
  // 海水：magaki
  'blue_damsel|magaki': 1,
  'clownfish|magaki': 1,
  'magaki|skunk_shrimp': 2,  // エビと かいは なかよし
  'magaki|shittaka': 1,
  'firefish|magaki': 1,
  'magaki|yellow_tang': 1,
  'blue_tang|magaki': 1,
  'magaki|mandarin': 1,
  'magaki|magaki': 1,
};

// 2匹の相性（0/1/2）を返す
export function compatOf(a, b) {
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  return COMPAT[key] ?? COMPAT_DEFAULT;
}
