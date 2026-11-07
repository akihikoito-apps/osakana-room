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
};

// 2匹の相性（0/1/2）を返す
export function compatOf(a, b) {
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  return COMPAT[key] ?? COMPAT_DEFAULT;
}
