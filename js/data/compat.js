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

  // ======== v0.6（企画・図鑑係）：つりの 17しゅるい・いけの 22しゅるい。くみあわせは ぜんぶ 書く（1 も 書く）========
  // いけ（pond）は かわ（fresh）・うみ（salt）と おなじ すいそうに 入らないので、くみあわせは いけどうし だけ
  // うみ（つり）：mahaze
  'blue_damsel|mahaze': 1,
  'clownfish|mahaze': 1,
  'mahaze|skunk_shrimp': 2,  // おそうじエビ
  'mahaze|shittaka': 1,
  'firefish|mahaze': 1,
  'mahaze|yellow_tang': 1,
  'blue_tang|mahaze': 1,
  'mahaze|mandarin': 1,
  'green_chromis|mahaze': 1,
  'mahaze|tomato_clown': 1,
  'mahaze|pajama_cardinal': 1,
  'banggai_cardinal|mahaze': 1,
  'mahaze|royal_gramma': 1,
  'mahaze|vagabond_butterfly': 1,
  'flame_angel|mahaze': 1,
  'boxfish|mahaze': 1,
  'mahaze|moorish_idol': 1,
  'mahaze|peppermint_shrimp': 1,
  'mahaze|white_socks': 2,  // おそうじエビ
  'magaki|mahaze': 1,
  'mahaze|mahaze': 1,
  'aji|mahaze': 1,
  'mahaze|nenbutsudai': 1,
  'mahaze|yadokari': 1,
  'kusafugu|mahaze': 1,
  'kisu|mahaze': 2,  // どちらも すなの そこ
  'kasago|mahaze': 0,  // カサゴは エビや こざかなを たべる
  'mahaze|mebaru': 1,
  'kyusen|mahaze': 1,
  'mahaze|umitanago': 1,
  'mahaze|mejina': 1,
  'kawahagi|mahaze': 1,
  'kurodai|mahaze': 1,
  'ishidai|mahaze': 1,
  'madai|mahaze': 1,
  'aoriika|mahaze': 1,
  'madako|mahaze': 1,
  // うみ（つり）：aji
  'aji|blue_damsel': 1,
  'aji|clownfish': 1,
  'aji|skunk_shrimp': 2,  // おそうじエビ
  'aji|shittaka': 1,
  'aji|firefish': 1,
  'aji|yellow_tang': 1,
  'aji|blue_tang': 1,
  'aji|mandarin': 1,
  'aji|green_chromis': 1,
  'aji|tomato_clown': 1,
  'aji|pajama_cardinal': 1,
  'aji|banggai_cardinal': 1,
  'aji|royal_gramma': 1,
  'aji|vagabond_butterfly': 1,
  'aji|flame_angel': 1,
  'aji|boxfish': 1,
  'aji|moorish_idol': 1,
  'aji|peppermint_shrimp': 1,
  'aji|white_socks': 2,  // おそうじエビ
  'aji|magaki': 1,
  'aji|aji': 2,  // むれで くらす
  'aji|nenbutsudai': 1,
  'aji|yadokari': 1,
  'aji|kusafugu': 1,
  'aji|kisu': 1,
  'aji|kasago': 1,
  'aji|mebaru': 1,
  'aji|kyusen': 1,
  'aji|umitanago': 2,  // むれで およぐ なかま
  'aji|mejina': 1,
  'aji|kawahagi': 1,
  'aji|kurodai': 1,
  'aji|ishidai': 1,
  'aji|madai': 1,
  'aji|aoriika': 0,  // イカは エビや こざかなを たべる
  'aji|madako': 1,
  // うみ（つり）：nenbutsudai
  'blue_damsel|nenbutsudai': 0,  // ルリスズメが おいかける
  'clownfish|nenbutsudai': 1,
  'nenbutsudai|skunk_shrimp': 2,  // おそうじエビ
  'nenbutsudai|shittaka': 1,
  'firefish|nenbutsudai': 1,
  'nenbutsudai|yellow_tang': 1,
  'blue_tang|nenbutsudai': 1,
  'mandarin|nenbutsudai': 1,
  'green_chromis|nenbutsudai': 1,
  'nenbutsudai|tomato_clown': 1,
  'nenbutsudai|pajama_cardinal': 1,
  'banggai_cardinal|nenbutsudai': 1,
  'nenbutsudai|royal_gramma': 1,
  'nenbutsudai|vagabond_butterfly': 1,
  'flame_angel|nenbutsudai': 1,
  'boxfish|nenbutsudai': 1,
  'moorish_idol|nenbutsudai': 1,
  'nenbutsudai|peppermint_shrimp': 1,
  'nenbutsudai|white_socks': 2,  // おそうじエビ
  'magaki|nenbutsudai': 1,
  'nenbutsudai|nenbutsudai': 2,  // むれで くらす
  'nenbutsudai|yadokari': 1,
  'kusafugu|nenbutsudai': 1,
  'kisu|nenbutsudai': 1,
  'kasago|nenbutsudai': 0,  // カサゴは エビや こざかなを たべる
  'mebaru|nenbutsudai': 1,
  'kyusen|nenbutsudai': 1,
  'nenbutsudai|umitanago': 1,
  'mejina|nenbutsudai': 1,
  'kawahagi|nenbutsudai': 1,
  'kurodai|nenbutsudai': 1,
  'ishidai|nenbutsudai': 1,
  'madai|nenbutsudai': 1,
  'aoriika|nenbutsudai': 0,  // イカは エビや こざかなを たべる
  'madako|nenbutsudai': 1,
  // うみ（つり）：yadokari
  'blue_damsel|yadokari': 1,
  'clownfish|yadokari': 1,
  'skunk_shrimp|yadokari': 1,
  'shittaka|yadokari': 0,  // まきがいの からを ほしがる
  'firefish|yadokari': 1,
  'yadokari|yellow_tang': 1,
  'blue_tang|yadokari': 1,
  'mandarin|yadokari': 1,
  'green_chromis|yadokari': 1,
  'tomato_clown|yadokari': 1,
  'pajama_cardinal|yadokari': 1,
  'banggai_cardinal|yadokari': 1,
  'royal_gramma|yadokari': 1,
  'vagabond_butterfly|yadokari': 1,
  'flame_angel|yadokari': 1,
  'boxfish|yadokari': 1,
  'moorish_idol|yadokari': 1,
  'peppermint_shrimp|yadokari': 1,
  'white_socks|yadokari': 1,
  'magaki|yadokari': 0,  // まきがいの からを ほしがる
  'yadokari|yadokari': 1,
  'kusafugu|yadokari': 0,  // フグが ヤドカリを つつく
  'kisu|yadokari': 1,
  'kasago|yadokari': 0,  // カサゴは エビや こざかなを たべる
  'mebaru|yadokari': 1,
  'kyusen|yadokari': 1,
  'umitanago|yadokari': 1,
  'mejina|yadokari': 1,
  'kawahagi|yadokari': 0,  // かいを つつく
  'kurodai|yadokari': 0,  // クロダイは カニや ヤドカリを たべる
  'ishidai|yadokari': 0,  // つよい くちで かいを わる
  'madai|yadokari': 1,
  'aoriika|yadokari': 1,
  'madako|yadokari': 0,  // タコは エビ・かい・ヤドカリを たべる
  // うみ（つり）：kusafugu
  'blue_damsel|kusafugu': 1,
  'clownfish|kusafugu': 1,
  'kusafugu|skunk_shrimp': 2,  // おそうじエビ
  'kusafugu|shittaka': 1,
  'firefish|kusafugu': 1,
  'kusafugu|yellow_tang': 1,
  'blue_tang|kusafugu': 1,
  'kusafugu|mandarin': 1,
  'green_chromis|kusafugu': 1,
  'kusafugu|tomato_clown': 1,
  'kusafugu|pajama_cardinal': 1,
  'banggai_cardinal|kusafugu': 1,
  'kusafugu|royal_gramma': 1,
  'kusafugu|vagabond_butterfly': 1,
  'flame_angel|kusafugu': 1,
  'boxfish|kusafugu': 1,
  'kusafugu|moorish_idol': 1,
  'kusafugu|peppermint_shrimp': 1,
  'kusafugu|white_socks': 2,  // おそうじエビ
  'kusafugu|magaki': 1,
  'kusafugu|kusafugu': 1,
  'kisu|kusafugu': 1,
  'kasago|kusafugu': 1,
  'kusafugu|mebaru': 1,
  'kusafugu|kyusen': 1,
  'kusafugu|umitanago': 1,
  'kusafugu|mejina': 1,
  'kawahagi|kusafugu': 1,
  'kurodai|kusafugu': 1,
  'ishidai|kusafugu': 1,
  'kusafugu|madai': 1,
  'aoriika|kusafugu': 1,
  'kusafugu|madako': 1,
  // うみ（つり）：kisu
  'blue_damsel|kisu': 0,  // ルリスズメが おいかける
  'clownfish|kisu': 1,
  'kisu|skunk_shrimp': 2,  // おそうじエビ
  'kisu|shittaka': 1,
  'firefish|kisu': 1,
  'kisu|yellow_tang': 1,
  'blue_tang|kisu': 1,
  'kisu|mandarin': 1,
  'green_chromis|kisu': 1,
  'kisu|tomato_clown': 1,
  'kisu|pajama_cardinal': 1,
  'banggai_cardinal|kisu': 1,
  'kisu|royal_gramma': 1,
  'kisu|vagabond_butterfly': 1,
  'flame_angel|kisu': 1,
  'boxfish|kisu': 1,
  'kisu|moorish_idol': 1,
  'kisu|peppermint_shrimp': 1,
  'kisu|white_socks': 2,  // おそうじエビ
  'kisu|magaki': 1,
  'kisu|kisu': 2,  // むれで くらす
  'kasago|kisu': 1,
  'kisu|mebaru': 1,
  'kisu|kyusen': 2,  // すなの うみで いっしょ
  'kisu|umitanago': 1,
  'kisu|mejina': 1,
  'kawahagi|kisu': 1,
  'kisu|kurodai': 1,
  'ishidai|kisu': 1,
  'kisu|madai': 1,
  'aoriika|kisu': 1,
  'kisu|madako': 1,
  // うみ（つり）：kasago
  'blue_damsel|kasago': 1,
  'clownfish|kasago': 1,
  'kasago|skunk_shrimp': 0,  // カサゴは エビや こざかなを たべる
  'kasago|shittaka': 1,
  'firefish|kasago': 1,
  'kasago|yellow_tang': 1,
  'blue_tang|kasago': 1,
  'kasago|mandarin': 1,
  'green_chromis|kasago': 1,
  'kasago|tomato_clown': 1,
  'kasago|pajama_cardinal': 1,
  'banggai_cardinal|kasago': 1,
  'kasago|royal_gramma': 1,
  'kasago|vagabond_butterfly': 1,
  'flame_angel|kasago': 1,
  'boxfish|kasago': 1,
  'kasago|moorish_idol': 1,
  'kasago|peppermint_shrimp': 0,  // カサゴは エビや こざかなを たべる
  'kasago|white_socks': 0,  // カサゴは エビや こざかなを たべる
  'kasago|magaki': 1,
  'kasago|kasago': 0,  // なわばりで けんか
  'kasago|mebaru': 1,
  'kasago|kyusen': 1,
  'kasago|umitanago': 1,
  'kasago|mejina': 1,
  'kasago|kawahagi': 1,
  'kasago|kurodai': 1,
  'ishidai|kasago': 1,
  'kasago|madai': 1,
  'aoriika|kasago': 1,
  'kasago|madako': 1,
  // うみ（つり）：mebaru
  'blue_damsel|mebaru': 1,
  'clownfish|mebaru': 1,
  'mebaru|skunk_shrimp': 2,  // おそうじエビ
  'mebaru|shittaka': 1,
  'firefish|mebaru': 1,
  'mebaru|yellow_tang': 1,
  'blue_tang|mebaru': 1,
  'mandarin|mebaru': 1,
  'green_chromis|mebaru': 1,
  'mebaru|tomato_clown': 1,
  'mebaru|pajama_cardinal': 1,
  'banggai_cardinal|mebaru': 1,
  'mebaru|royal_gramma': 1,
  'mebaru|vagabond_butterfly': 1,
  'flame_angel|mebaru': 1,
  'boxfish|mebaru': 1,
  'mebaru|moorish_idol': 1,
  'mebaru|peppermint_shrimp': 1,
  'mebaru|white_socks': 2,  // おそうじエビ
  'magaki|mebaru': 1,
  'mebaru|mebaru': 2,  // むれで くらす
  'kyusen|mebaru': 1,
  'mebaru|umitanago': 1,
  'mebaru|mejina': 1,
  'kawahagi|mebaru': 1,
  'kurodai|mebaru': 1,
  'ishidai|mebaru': 1,
  'madai|mebaru': 1,
  'aoriika|mebaru': 1,
  'madako|mebaru': 1,
  // うみ（つり）：kyusen
  'blue_damsel|kyusen': 1,
  'clownfish|kyusen': 1,
  'kyusen|skunk_shrimp': 2,  // おそうじエビ
  'kyusen|shittaka': 1,
  'firefish|kyusen': 1,
  'kyusen|yellow_tang': 1,
  'blue_tang|kyusen': 1,
  'kyusen|mandarin': 1,
  'green_chromis|kyusen': 1,
  'kyusen|tomato_clown': 1,
  'kyusen|pajama_cardinal': 1,
  'banggai_cardinal|kyusen': 1,
  'kyusen|royal_gramma': 1,
  'kyusen|vagabond_butterfly': 1,
  'flame_angel|kyusen': 1,
  'boxfish|kyusen': 1,
  'kyusen|moorish_idol': 1,
  'kyusen|peppermint_shrimp': 1,
  'kyusen|white_socks': 2,  // おそうじエビ
  'kyusen|magaki': 1,
  'kyusen|kyusen': 1,
  'kyusen|umitanago': 1,
  'kyusen|mejina': 1,
  'kawahagi|kyusen': 1,
  'kurodai|kyusen': 1,
  'ishidai|kyusen': 1,
  'kyusen|madai': 1,
  'aoriika|kyusen': 1,
  'kyusen|madako': 1,
  // うみ（つり）：umitanago
  'blue_damsel|umitanago': 0,  // ルリスズメが おいかける
  'clownfish|umitanago': 1,
  'skunk_shrimp|umitanago': 2,  // おそうじエビ
  'shittaka|umitanago': 1,
  'firefish|umitanago': 1,
  'umitanago|yellow_tang': 1,
  'blue_tang|umitanago': 1,
  'mandarin|umitanago': 1,
  'green_chromis|umitanago': 1,
  'tomato_clown|umitanago': 1,
  'pajama_cardinal|umitanago': 1,
  'banggai_cardinal|umitanago': 1,
  'royal_gramma|umitanago': 1,
  'umitanago|vagabond_butterfly': 1,
  'flame_angel|umitanago': 1,
  'boxfish|umitanago': 1,
  'moorish_idol|umitanago': 1,
  'peppermint_shrimp|umitanago': 1,
  'umitanago|white_socks': 2,  // おそうじエビ
  'magaki|umitanago': 1,
  'umitanago|umitanago': 2,  // むれで くらす
  'mejina|umitanago': 2,  // いその うみくさで いっしょ
  'kawahagi|umitanago': 1,
  'kurodai|umitanago': 1,
  'ishidai|umitanago': 1,
  'madai|umitanago': 1,
  'aoriika|umitanago': 1,
  'madako|umitanago': 1,
  // うみ（つり）：mejina
  'blue_damsel|mejina': 1,
  'clownfish|mejina': 1,
  'mejina|skunk_shrimp': 2,  // おそうじエビ
  'mejina|shittaka': 1,
  'firefish|mejina': 1,
  'mejina|yellow_tang': 1,
  'blue_tang|mejina': 1,
  'mandarin|mejina': 1,
  'green_chromis|mejina': 1,
  'mejina|tomato_clown': 1,
  'mejina|pajama_cardinal': 1,
  'banggai_cardinal|mejina': 1,
  'mejina|royal_gramma': 1,
  'mejina|vagabond_butterfly': 1,
  'flame_angel|mejina': 1,
  'boxfish|mejina': 1,
  'mejina|moorish_idol': 1,
  'mejina|peppermint_shrimp': 1,
  'mejina|white_socks': 2,  // おそうじエビ
  'magaki|mejina': 1,
  'mejina|mejina': 2,  // むれで くらす
  'kawahagi|mejina': 1,
  'kurodai|mejina': 1,
  'ishidai|mejina': 1,
  'madai|mejina': 1,
  'aoriika|mejina': 1,
  'madako|mejina': 1,
  // うみ（つり）：kawahagi
  'blue_damsel|kawahagi': 1,
  'clownfish|kawahagi': 1,
  'kawahagi|skunk_shrimp': 2,  // おそうじエビ
  'kawahagi|shittaka': 0,  // かいを つつく
  'firefish|kawahagi': 1,
  'kawahagi|yellow_tang': 1,
  'blue_tang|kawahagi': 1,
  'kawahagi|mandarin': 1,
  'green_chromis|kawahagi': 1,
  'kawahagi|tomato_clown': 1,
  'kawahagi|pajama_cardinal': 1,
  'banggai_cardinal|kawahagi': 1,
  'kawahagi|royal_gramma': 1,
  'kawahagi|vagabond_butterfly': 1,
  'flame_angel|kawahagi': 1,
  'boxfish|kawahagi': 1,
  'kawahagi|moorish_idol': 1,
  'kawahagi|peppermint_shrimp': 1,
  'kawahagi|white_socks': 2,  // おそうじエビ
  'kawahagi|magaki': 0,  // かいを つつく
  'kawahagi|kawahagi': 0,  // なわばりで けんか
  'kawahagi|kurodai': 1,
  'ishidai|kawahagi': 1,
  'kawahagi|madai': 1,
  'aoriika|kawahagi': 1,
  'kawahagi|madako': 1,
  // うみ（つり）：kurodai
  'blue_damsel|kurodai': 1,
  'clownfish|kurodai': 1,
  'kurodai|skunk_shrimp': 2,  // おそうじエビ
  'kurodai|shittaka': 1,
  'firefish|kurodai': 1,
  'kurodai|yellow_tang': 1,
  'blue_tang|kurodai': 1,
  'kurodai|mandarin': 1,
  'green_chromis|kurodai': 1,
  'kurodai|tomato_clown': 1,
  'kurodai|pajama_cardinal': 1,
  'banggai_cardinal|kurodai': 1,
  'kurodai|royal_gramma': 1,
  'kurodai|vagabond_butterfly': 1,
  'flame_angel|kurodai': 1,
  'boxfish|kurodai': 1,
  'kurodai|moorish_idol': 1,
  'kurodai|peppermint_shrimp': 1,
  'kurodai|white_socks': 2,  // おそうじエビ
  'kurodai|magaki': 1,
  'kurodai|kurodai': 1,
  'ishidai|kurodai': 1,
  'kurodai|madai': 2,  // タイの なかま
  'aoriika|kurodai': 1,
  'kurodai|madako': 1,
  // うみ（つり）：ishidai
  'blue_damsel|ishidai': 1,
  'clownfish|ishidai': 1,
  'ishidai|skunk_shrimp': 2,  // おそうじエビ
  'ishidai|shittaka': 0,  // つよい くちで かいを わる
  'firefish|ishidai': 1,
  'ishidai|yellow_tang': 1,
  'blue_tang|ishidai': 1,
  'ishidai|mandarin': 1,
  'green_chromis|ishidai': 1,
  'ishidai|tomato_clown': 1,
  'ishidai|pajama_cardinal': 1,
  'banggai_cardinal|ishidai': 1,
  'ishidai|royal_gramma': 1,
  'ishidai|vagabond_butterfly': 1,
  'flame_angel|ishidai': 1,
  'boxfish|ishidai': 1,
  'ishidai|moorish_idol': 1,
  'ishidai|peppermint_shrimp': 1,
  'ishidai|white_socks': 2,  // おそうじエビ
  'ishidai|magaki': 0,  // つよい くちで かいを わる
  'ishidai|ishidai': 0,  // なわばりで けんか
  'ishidai|madai': 1,
  'aoriika|ishidai': 1,
  'ishidai|madako': 1,
  // うみ（つり）：madai
  'blue_damsel|madai': 1,
  'clownfish|madai': 1,
  'madai|skunk_shrimp': 2,  // おそうじエビ
  'madai|shittaka': 1,
  'firefish|madai': 1,
  'madai|yellow_tang': 1,
  'blue_tang|madai': 1,
  'madai|mandarin': 1,
  'green_chromis|madai': 1,
  'madai|tomato_clown': 1,
  'madai|pajama_cardinal': 1,
  'banggai_cardinal|madai': 1,
  'madai|royal_gramma': 1,
  'madai|vagabond_butterfly': 1,
  'flame_angel|madai': 1,
  'boxfish|madai': 1,
  'madai|moorish_idol': 1,
  'madai|peppermint_shrimp': 1,
  'madai|white_socks': 2,  // おそうじエビ
  'madai|magaki': 1,
  'madai|madai': 1,
  'aoriika|madai': 1,
  'madai|madako': 1,
  // うみ（つり）：aoriika
  'aoriika|blue_damsel': 1,
  'aoriika|clownfish': 1,
  'aoriika|skunk_shrimp': 0,  // イカは エビや こざかなを たべる
  'aoriika|shittaka': 1,
  'aoriika|firefish': 1,
  'aoriika|yellow_tang': 1,
  'aoriika|blue_tang': 1,
  'aoriika|mandarin': 1,
  'aoriika|green_chromis': 1,
  'aoriika|tomato_clown': 1,
  'aoriika|pajama_cardinal': 1,
  'aoriika|banggai_cardinal': 1,
  'aoriika|royal_gramma': 1,
  'aoriika|vagabond_butterfly': 1,
  'aoriika|flame_angel': 1,
  'aoriika|boxfish': 1,
  'aoriika|moorish_idol': 1,
  'aoriika|peppermint_shrimp': 0,  // イカは エビや こざかなを たべる
  'aoriika|white_socks': 0,  // イカは エビや こざかなを たべる
  'aoriika|magaki': 1,
  'aoriika|aoriika': 1,
  'aoriika|madako': 1,
  // うみ（つり）：madako
  'blue_damsel|madako': 1,
  'clownfish|madako': 1,
  'madako|skunk_shrimp': 0,  // タコは エビ・かい・ヤドカリを たべる
  'madako|shittaka': 0,  // タコは エビ・かい・ヤドカリを たべる
  'firefish|madako': 1,
  'madako|yellow_tang': 1,
  'blue_tang|madako': 1,
  'madako|mandarin': 1,
  'green_chromis|madako': 1,
  'madako|tomato_clown': 1,
  'madako|pajama_cardinal': 1,
  'banggai_cardinal|madako': 1,
  'madako|royal_gramma': 1,
  'madako|vagabond_butterfly': 1,
  'flame_angel|madako': 1,
  'boxfish|madako': 1,
  'madako|moorish_idol': 1,
  'madako|peppermint_shrimp': 0,  // タコは エビ・かい・ヤドカリを たべる
  'madako|white_socks': 0,  // タコは エビ・かい・ヤドカリを たべる
  'madako|magaki': 0,  // タコは エビ・かい・ヤドカリを たべる
  'madako|madako': 0,  // なわばりで けんか
  // いけ：tanishi
  'tanishi|tanishi': 1,
  'sujiebi|tanishi': 2,  // おだやかな いけの なかま
  'tanishi|zarigani': 0,  // ザリガニが はさむ
  'otamajakushi|tanishi': 1,
  'motsugo|tanishi': 1,
  'dojou|tanishi': 2,  // おだやかな いけの なかま
  'funa|tanishi': 1,
  'oikawa|tanishi': 1,
  'tanishi|yago': 1,
  'tanishi|yoshinobori': 1,
  'sawagani|tanishi': 1,
  'tanago|tanishi': 1,
  'donko|tanishi': 1,
  'mizukamakiri|tanishi': 1,
  'hotokedojou|tanishi': 1,
  'namazu|tanishi': 1,
  'gengorou|tanishi': 1,
  'tanishi|tonosamagaeru': 1,
  'amagaeru|tanishi': 1,
  'kusagame|tanishi': 0,  // カメは ちいさな いきものを たべる
  'ishigame|tanishi': 0,  // カメは ちいさな いきものを たべる
  'tagame|tanishi': 1,
  // いけ：sujiebi
  'sujiebi|sujiebi': 2,  // むれで くらす
  'sujiebi|zarigani': 0,  // ザリガニが はさむ
  'otamajakushi|sujiebi': 1,
  'motsugo|sujiebi': 1,
  'dojou|sujiebi': 1,
  'funa|sujiebi': 1,
  'oikawa|sujiebi': 1,
  'sujiebi|yago': 0,  // ヤゴは ちいさな いきものを つかまえる
  'sujiebi|yoshinobori': 1,
  'sawagani|sujiebi': 0,  // カニが エビを はさむ
  'sujiebi|tanago': 1,
  'donko|sujiebi': 0,  // ドンコは こざかなを たべる
  'mizukamakiri|sujiebi': 0,  // ミズカマキリは ちいさな いきものを つかまえる
  'hotokedojou|sujiebi': 1,
  'namazu|sujiebi': 0,  // ナマズは おおきな くちで たべる
  'gengorou|sujiebi': 0,  // ゲンゴロウは オタマジャクシや エビを たべる
  'sujiebi|tonosamagaeru': 0,  // トノサマガエルが エビを ねらう
  'amagaeru|sujiebi': 1,
  'kusagame|sujiebi': 0,  // カメは ちいさな いきものを たべる
  'ishigame|sujiebi': 0,  // カメは ちいさな いきものを たべる
  'sujiebi|tagame': 0,  // タガメは いきものを つかまえる
  // いけ：zarigani
  'zarigani|zarigani': 0,  // なわばりで けんか
  'otamajakushi|zarigani': 0,  // ザリガニが はさむ
  'motsugo|zarigani': 1,
  'dojou|zarigani': 1,
  'funa|zarigani': 1,
  'oikawa|zarigani': 1,
  'yago|zarigani': 1,
  'yoshinobori|zarigani': 1,
  'sawagani|zarigani': 0,  // ザリガニが はさむ
  'tanago|zarigani': 1,
  'donko|zarigani': 1,
  'mizukamakiri|zarigani': 1,
  'hotokedojou|zarigani': 0,  // ザリガニが はさむ
  'namazu|zarigani': 0,  // ナマズは おおきな くちで たべる
  'gengorou|zarigani': 1,
  'tonosamagaeru|zarigani': 1,
  'amagaeru|zarigani': 1,
  'kusagame|zarigani': 1,
  'ishigame|zarigani': 1,
  'tagame|zarigani': 1,
  // いけ：otamajakushi
  'otamajakushi|otamajakushi': 2,  // むれで くらす
  'motsugo|otamajakushi': 1,
  'dojou|otamajakushi': 1,
  'funa|otamajakushi': 1,
  'oikawa|otamajakushi': 1,
  'otamajakushi|yago': 0,  // ヤゴは ちいさな いきものを つかまえる
  'otamajakushi|yoshinobori': 1,
  'otamajakushi|sawagani': 1,
  'otamajakushi|tanago': 1,
  'donko|otamajakushi': 0,  // ドンコは こざかなを たべる
  'mizukamakiri|otamajakushi': 0,  // ミズカマキリは ちいさな いきものを つかまえる
  'hotokedojou|otamajakushi': 1,
  'namazu|otamajakushi': 0,  // ナマズは おおきな くちで たべる
  'gengorou|otamajakushi': 0,  // ゲンゴロウは オタマジャクシや エビを たべる
  'otamajakushi|tonosamagaeru': 1,
  'amagaeru|otamajakushi': 1,
  'kusagame|otamajakushi': 0,  // カメは ちいさな いきものを たべる
  'ishigame|otamajakushi': 0,  // カメは ちいさな いきものを たべる
  'otamajakushi|tagame': 0,  // タガメは いきものを つかまえる
  // いけ：motsugo
  'motsugo|motsugo': 2,  // むれで くらす
  'dojou|motsugo': 1,
  'funa|motsugo': 2,  // おだやかな いけの なかま
  'motsugo|oikawa': 2,  // おだやかな いけの なかま
  'motsugo|yago': 0,  // ヤゴは ちいさな いきものを つかまえる
  'motsugo|yoshinobori': 1,
  'motsugo|sawagani': 1,
  'motsugo|tanago': 2,  // おだやかな いけの なかま
  'donko|motsugo': 0,  // ドンコは こざかなを たべる
  'mizukamakiri|motsugo': 0,  // ミズカマキリは ちいさな いきものを つかまえる
  'hotokedojou|motsugo': 1,
  'motsugo|namazu': 0,  // ナマズは おおきな くちで たべる
  'gengorou|motsugo': 1,
  'motsugo|tonosamagaeru': 1,
  'amagaeru|motsugo': 1,
  'kusagame|motsugo': 0,  // カメは ちいさな いきものを たべる
  'ishigame|motsugo': 0,  // カメは ちいさな いきものを たべる
  'motsugo|tagame': 0,  // タガメは いきものを つかまえる
  // いけ：dojou
  'dojou|dojou': 2,  // むれで くらす
  'dojou|funa': 1,
  'dojou|oikawa': 1,
  'dojou|yago': 1,
  'dojou|yoshinobori': 1,
  'dojou|sawagani': 1,
  'dojou|tanago': 1,
  'dojou|donko': 1,
  'dojou|mizukamakiri': 1,
  'dojou|hotokedojou': 2,  // おだやかな いけの なかま
  'dojou|namazu': 0,  // ナマズは おおきな くちで たべる
  'dojou|gengorou': 1,
  'dojou|tonosamagaeru': 1,
  'amagaeru|dojou': 1,
  'dojou|kusagame': 0,  // カメは ちいさな いきものを たべる
  'dojou|ishigame': 0,  // カメは ちいさな いきものを たべる
  'dojou|tagame': 0,  // タガメは いきものを つかまえる
  // いけ：funa
  'funa|funa': 2,  // むれで くらす
  'funa|oikawa': 1,
  'funa|yago': 1,
  'funa|yoshinobori': 1,
  'funa|sawagani': 1,
  'funa|tanago': 2,  // おだやかな いけの なかま
  'donko|funa': 1,
  'funa|mizukamakiri': 1,
  'funa|hotokedojou': 1,
  'funa|namazu': 1,
  'funa|gengorou': 1,
  'funa|tonosamagaeru': 1,
  'amagaeru|funa': 1,
  'funa|kusagame': 1,
  'funa|ishigame': 1,
  'funa|tagame': 1,
  // いけ：oikawa
  'oikawa|oikawa': 2,  // むれで くらす
  'oikawa|yago': 1,
  'oikawa|yoshinobori': 1,
  'oikawa|sawagani': 1,
  'oikawa|tanago': 1,
  'donko|oikawa': 1,
  'mizukamakiri|oikawa': 1,
  'hotokedojou|oikawa': 1,
  'namazu|oikawa': 0,  // ナマズは おおきな くちで たべる
  'gengorou|oikawa': 1,
  'oikawa|tonosamagaeru': 1,
  'amagaeru|oikawa': 1,
  'kusagame|oikawa': 0,  // カメは ちいさな いきものを たべる
  'ishigame|oikawa': 0,  // カメは ちいさな いきものを たべる
  'oikawa|tagame': 0,  // タガメは いきものを つかまえる
  // いけ：yago
  'yago|yago': 0,  // なわばりで けんか
  'yago|yoshinobori': 1,
  'sawagani|yago': 1,
  'tanago|yago': 1,
  'donko|yago': 1,
  'mizukamakiri|yago': 1,
  'hotokedojou|yago': 1,
  'namazu|yago': 1,
  'gengorou|yago': 1,
  'tonosamagaeru|yago': 1,
  'amagaeru|yago': 1,
  'kusagame|yago': 1,
  'ishigame|yago': 1,
  'tagame|yago': 1,
  // いけ：yoshinobori
  'yoshinobori|yoshinobori': 0,  // なわばりで けんか
  'sawagani|yoshinobori': 1,
  'tanago|yoshinobori': 1,
  'donko|yoshinobori': 0,  // ドンコは こざかなを たべる
  'mizukamakiri|yoshinobori': 1,
  'hotokedojou|yoshinobori': 1,
  'namazu|yoshinobori': 0,  // ナマズは おおきな くちで たべる
  'gengorou|yoshinobori': 1,
  'tonosamagaeru|yoshinobori': 1,
  'amagaeru|yoshinobori': 1,
  'kusagame|yoshinobori': 0,  // カメは ちいさな いきものを たべる
  'ishigame|yoshinobori': 0,  // カメは ちいさな いきものを たべる
  'tagame|yoshinobori': 0,  // タガメは いきものを つかまえる
  // いけ：sawagani
  'sawagani|sawagani': 0,  // なわばりで けんか
  'sawagani|tanago': 1,
  'donko|sawagani': 1,
  'mizukamakiri|sawagani': 1,
  'hotokedojou|sawagani': 1,
  'namazu|sawagani': 0,  // ナマズは おおきな くちで たべる
  'gengorou|sawagani': 1,
  'sawagani|tonosamagaeru': 1,
  'amagaeru|sawagani': 1,
  'kusagame|sawagani': 1,
  'ishigame|sawagani': 1,
  'sawagani|tagame': 1,
  // いけ：tanago
  'tanago|tanago': 2,  // むれで くらす
  'donko|tanago': 1,
  'mizukamakiri|tanago': 1,
  'hotokedojou|tanago': 1,
  'namazu|tanago': 0,  // ナマズは おおきな くちで たべる
  'gengorou|tanago': 1,
  'tanago|tonosamagaeru': 1,
  'amagaeru|tanago': 1,
  'kusagame|tanago': 0,  // カメは ちいさな いきものを たべる
  'ishigame|tanago': 0,  // カメは ちいさな いきものを たべる
  'tagame|tanago': 0,  // タガメは いきものを つかまえる
  // いけ：donko
  'donko|donko': 0,  // なわばりで けんか
  'donko|mizukamakiri': 1,
  'donko|hotokedojou': 0,  // ドンコは こざかなを たべる
  'donko|namazu': 1,
  'donko|gengorou': 1,
  'donko|tonosamagaeru': 1,
  'amagaeru|donko': 0,  // ドンコが ちいさな カエルを たべる
  'donko|kusagame': 1,
  'donko|ishigame': 1,
  'donko|tagame': 1,
  // いけ：mizukamakiri
  'mizukamakiri|mizukamakiri': 1,
  'hotokedojou|mizukamakiri': 1,
  'mizukamakiri|namazu': 1,
  'gengorou|mizukamakiri': 1,
  'mizukamakiri|tonosamagaeru': 1,
  'amagaeru|mizukamakiri': 1,
  'kusagame|mizukamakiri': 1,
  'ishigame|mizukamakiri': 1,
  'mizukamakiri|tagame': 1,
  // いけ：hotokedojou
  'hotokedojou|hotokedojou': 2,  // むれで くらす
  'hotokedojou|namazu': 0,  // ナマズは おおきな くちで たべる
  'gengorou|hotokedojou': 1,
  'hotokedojou|tonosamagaeru': 1,
  'amagaeru|hotokedojou': 1,
  'hotokedojou|kusagame': 0,  // カメは ちいさな いきものを たべる
  'hotokedojou|ishigame': 0,  // カメは ちいさな いきものを たべる
  'hotokedojou|tagame': 0,  // タガメは いきものを つかまえる
  // いけ：namazu
  'namazu|namazu': 0,  // なわばりで けんか
  'gengorou|namazu': 1,
  'namazu|tonosamagaeru': 0,  // ナマズは カエルも たべる
  'amagaeru|namazu': 0,  // ナマズは カエルも たべる
  'kusagame|namazu': 1,
  'ishigame|namazu': 1,
  'namazu|tagame': 1,
  // いけ：gengorou
  'gengorou|gengorou': 1,
  'gengorou|tonosamagaeru': 1,
  'amagaeru|gengorou': 1,
  'gengorou|kusagame': 1,
  'gengorou|ishigame': 1,
  'gengorou|tagame': 0,  // タガメは いきものを つかまえる
  // いけ：tonosamagaeru
  'tonosamagaeru|tonosamagaeru': 1,
  'amagaeru|tonosamagaeru': 1,
  'kusagame|tonosamagaeru': 1,
  'ishigame|tonosamagaeru': 1,
  'tagame|tonosamagaeru': 0,  // タガメは カエルも つかまえる
  // いけ：amagaeru
  'amagaeru|amagaeru': 1,
  'amagaeru|kusagame': 0,  // カメが ちいさな カエルを たべる
  'amagaeru|ishigame': 0,  // カメが ちいさな カエルを たべる
  'amagaeru|tagame': 0,  // タガメは カエルも つかまえる
  // いけ：kusagame
  'kusagame|kusagame': 1,
  'ishigame|kusagame': 2,  // いっしょに ひなたぼっこ
  'kusagame|tagame': 1,
  // いけ：ishigame
  'ishigame|ishigame': 1,
  'ishigame|tagame': 1,
  // いけ：tagame
  'tagame|tagame': 0,  // なわばりで けんか
};

// 2匹の相性（0/1/2）を返す
export function compatOf(a, b) {
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  return COMPAT[key] ?? COMPAT_DEFAULT;
}
