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
};

// 2匹の相性（0/1/2）を返す
export function compatOf(a, b) {
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  return COMPAT[key] ?? COMPAT_DEFAULT;
}
