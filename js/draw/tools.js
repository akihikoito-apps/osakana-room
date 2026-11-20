// おえかきの どうぐ（おえかき係）。DOM に よらない：いろ・ペンの ふとさ・ひとつもどす・ペンの 線・なまえ・できあがりの きろく。

/** 16しょく（Codex の 案。にた いろを ならべて さがしやすく。4こ ずつ 4だん） */
export const COLORS = [
  { id: 'white', name: 'しろ', hex: '#ffffff' },
  { id: 'gray', name: 'はいいろ', hex: '#999999' },
  { id: 'black', name: 'くろ', hex: '#222222' },
  { id: 'brown', name: 'ちゃいろ', hex: '#885533' },
  { id: 'red', name: 'あか', hex: '#ef4444' },
  { id: 'orange', name: 'オレンジ', hex: '#ff922b' },
  { id: 'yellow', name: 'きいろ', hex: '#ffe044' },
  { id: 'cream', name: 'クリーム', hex: '#ffe8b0' },
  { id: 'pink', name: 'ピンク', hex: '#ff99bb' },
  { id: 'skin', name: 'はだいろ', hex: '#f3bd98' },
  { id: 'purple', name: 'むらさき', hex: '#9955cc' },
  { id: 'navy', name: 'こいあお', hex: '#334499' },
  { id: 'lime', name: 'きみどり', hex: '#a8d94a' },
  { id: 'green', name: 'みどり', hex: '#35a85b' },
  { id: 'sky', name: 'みずいろ', hex: '#70d6ef' },
  { id: 'blue', name: 'あお', hex: '#2785dd' },
];

/**
 * ペンの ふとさ（キャンバスの 長い辺 1000 に たいして。Codex 12・35・80／agy 12・32・72 の あいだ）。
 * v0.8 本人の ようぼう：「いちばん ほそい（字が かける）」を たして 4つ
 */
export const PEN_SIZES = [
  { id: 'xs', name: 'いちばん ほそい', per1000: 5 },
  { id: 's', name: 'ほそい', per1000: 12 },
  { id: 'm', name: 'ふつう', per1000: 34 },
  { id: 'l', name: 'ふとい', per1000: 76 },
];
export const penWidth = (sizeId, longSide) => Math.max(2, Math.round(((PEN_SIZES.find((s) => s.id === sizeId) || PEN_SIZES[1]).per1000 * longSide) / 1000));

/**
 * ペン・けしゴムの 線を ctx（CanvasRenderingContext2D の かたち）に かく。
 * tool：{ mode: 'pen'|'eraser', color: '#rrggbb', width }。pts：[{x,y}, …]（1こ なら てん）
 */
export function strokeOn(ctx, tool, pts) {
  if (!pts.length) return;
  ctx.save();
  ctx.globalCompositeOperation = tool.mode === 'eraser' ? 'destination-out' : 'source-over';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = tool.width;
  ctx.strokeStyle = tool.mode === 'eraser' ? '#000000' : tool.color;
  ctx.fillStyle = ctx.strokeStyle;
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, tool.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

/** ひとつもどす。push で「かえる まえ」を ためる。limit を こえたら ふるい ものから すてる */
export class History {
  constructor(limit = 12) { this.limit = limit; this.stack = []; }
  push(snap) { this.stack.push(snap); if (this.stack.length > this.limit) this.stack.shift(); }
  undo() { return this.stack.pop() || null; }
  get size() { return this.stack.length; }
  clear() { this.stack.length = 0; }
}

/** ゆびの いちを キャンバスの 中の いちに（rect：がめんの 四角、w,h：キャンバスの 中の 大きさ） */
export function toCanvas(clientX, clientY, rect, w, h) {
  return { x: ((clientX - rect.left) / rect.width) * w, y: ((clientY - rect.top) / rect.height) * h };
}

/** 2ほんゆびの ズーム（ピンチ）。まえの 2てん → いまの 2てん で view（scale, x, y）を うごかす。scale は min〜max */
export function pinchView(view, a0, b0, a1, b1, { min = 1, max = 3 } = {}) {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1, d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y) || 1;
  const scale = Math.min(max, Math.max(min, view.scale * (d1 / d0)));
  const k = scale / view.scale;
  const c0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }, c1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  // c0 の したに あった 点が c1 に くるように
  return { scale, x: c1.x - (c0.x - view.x) * k, y: c1.y - (c0.y - view.y) * k };
}

/** ズームの ずらしを はみださない ように（w,h：もとの 大きさ。scale 1 なら 0,0） */
export function clampView(view, w, h) {
  const x = Math.min(0, Math.max(w - w * view.scale, view.x)), y = Math.min(0, Math.max(h - h * view.scale, view.y));
  return { scale: view.scale, x, y };
}

// ---------------- なまえ ----------------
export const NAME_MAX = 8;
const KANA = /[ぁ-ゖゝゞァ-ヺーヽヾ]/u;
/** ひらがな・カタカナ・ー だけ のこして 8もじ まで。けした 字が あれば dropped: true */
export function cleanName(s) {
  const chars = [...String(s ?? '').normalize('NFKC')];
  const kept = chars.filter((c) => KANA.test(c));
  const dropped = kept.length !== chars.filter((c) => !/\s/.test(c)).length;
  return { name: kept.slice(0, NAME_MAX).join(''), dropped };
}

/** おまかせの なまえ */
const NAME_A = ['ぷく', 'ぴょん', 'ころ', 'すい', 'きら', 'もこ', 'ぽん', 'ふわ', 'にこ', 'るん', 'ぱく', 'とと'];
const NAME_B = ['ちゃん', 'まる', 'すけ', 'たろう', 'りん', 'きち', 'ぴ', 'こ'];
export function randomName(rnd = Math.random) {
  return NAME_A[Math.floor(rnd() * NAME_A.length)] + NAME_B[Math.floor(rnd() * NAME_B.length)];
}

// ---------------- できあがり ----------------
export const KINDS = [
  { id: 'fish', name: 'さかな', ic: '🐟' },
  { id: 'crab', name: 'エビ・カニ', ic: '🦀' },
  { id: 'frog', name: 'カエル', ic: '🐸' },
  { id: 'reptile', name: 'カメ・トカゲ', ic: '🐢' },
];
export const SPEEDS = [
  { id: 'slow', name: 'ゆっくり', ic: '🐌' },
  { id: 'normal', name: 'ふつう', ic: '🐠' },
  { id: 'fast', name: 'すばやい', ic: '💨' },
];
export const SIZES = [
  { id: 's', name: 'ちいさい' },
  { id: 'm', name: 'ふつう' },
  { id: 'l', name: 'おおきい' },
];

/** 約束の かたちの f.dream（ゆめ係の dream.addCreature に わたす） */
export function makeDreamInfo({ art, overlay = null, base = null, kind, speed = 'normal', size = 'm', name = '', made = 1 }) {
  if (typeof art !== 'string' || !art.startsWith('data:image/png;base64,')) throw new Error('art');
  const k = KINDS.some((x) => x.id === kind) ? kind : 'fish';
  const ov = typeof overlay === 'string' && overlay.startsWith('data:image/png;base64,') ? { overlay } : {};   // もじの そう（なければ はぶく）
  return {
    art,
    ...ov,
    base: base || null,
    kind: k,
    speed: SPEEDS.some((x) => x.id === speed) ? speed : 'normal',
    size: SIZES.some((x) => x.id === size) ? size : 'm',
    name: cleanName(name).name,
    made: Math.max(1, Math.floor(made) || 1),
  };
}
