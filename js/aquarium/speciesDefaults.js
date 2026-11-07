// 水槽で使う「種ごとの動きと形」の予備。js/data/fish.js に look / swim があればそちらが優先。
// データがまだ届いていない種でも、それらしく泳がせるための値。
//   habit: 'coral'  … サンゴ・ライブロックの近くにいる（クマノミ）
//          'hover'  … 底の近くでホバリング（マンダリン・ハタタテハゼ）
//          'cling'  … ガラスや流木・石にはりつく（オトシンクルス）
//          'crawl'  … 貝。面に沿ってとてもゆっくり這う
export const SPECIES_DEFAULTS = {
  // 海水
  clownfish:     { kind: 'fish', water: 'salt', look: { lengthToHeight: 2.6, thickness: 0.24, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.8, school: false, habit: 'coral' } },
  blue_tang:     { kind: 'fish', water: 'salt', look: { lengthToHeight: 1.8, thickness: 0.14, finStyle: 'normal' }, swim: { layer: 'middle', speed: 1.0, school: false } },
  yellow_tang:   { kind: 'fish', water: 'salt', look: { lengthToHeight: 1.5, thickness: 0.13, finStyle: 'tall' }, swim: { layer: 'middle', speed: 0.9, school: false } },
  blue_damsel:   { kind: 'fish', water: 'salt', look: { lengthToHeight: 2.4, thickness: 0.2, finStyle: 'normal' }, swim: { layer: 'middle', speed: 1.1, school: false, habit: 'coral' } },
  firefish:      { kind: 'fish', water: 'salt', look: { lengthToHeight: 5.0, thickness: 0.14, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.6, school: false, habit: 'hover' } },
  mandarin:      { kind: 'fish', water: 'salt', look: { lengthToHeight: 3.2, thickness: 0.26, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.45, school: false, habit: 'hover' } },
  skunk_shrimp:  { kind: 'shrimp', water: 'salt', look: { lengthToHeight: 4.0, thickness: 0.2, finStyle: 'shrimp' }, swim: { layer: 'bottom', speed: 0.5, school: false } },
  shittaka:      { kind: 'snail', water: 'salt', look: { lengthToHeight: 1.25, thickness: 0.62, finStyle: 'snail' }, swim: { layer: 'bottom', speed: 0.1, school: false, habit: 'crawl' } },
  // 淡水
  platy:         { kind: 'fish', water: 'fresh', look: { lengthToHeight: 2.7, thickness: 0.22, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.9, school: false } },
  cherry_barb:   { kind: 'fish', water: 'fresh', look: { lengthToHeight: 3.1, thickness: 0.2, finStyle: 'normal' }, swim: { layer: 'middle', speed: 1.0, school: true } },
  otocinclus:    { kind: 'fish', water: 'fresh', look: { lengthToHeight: 4.3, thickness: 0.2, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.7, school: false, habit: 'cling' } },
  dwarf_gourami: { kind: 'fish', water: 'fresh', look: { lengthToHeight: 2.0, thickness: 0.15, finStyle: 'normal' }, swim: { layer: 'top', speed: 0.6, school: false } },
  rummy_nose:    { kind: 'fish', water: 'fresh', look: { lengthToHeight: 4.3, thickness: 0.17, finStyle: 'normal' }, swim: { layer: 'middle', speed: 1.2, school: true } },
  ishimaki:      { kind: 'snail', water: 'fresh', look: { lengthToHeight: 1.3, thickness: 0.62, finStyle: 'snail' }, swim: { layer: 'bottom', speed: 0.1, school: false, habit: 'crawl' } },
  ramshorn:      { kind: 'snail', water: 'fresh', look: { lengthToHeight: 1.15, thickness: 0.5, finStyle: 'snail' }, swim: { layer: 'bottom', speed: 0.1, school: false, habit: 'crawl' } },
};

/** データ（fish.js）と予備をまぜる。データの値が優先。 */
export function mergeSpec(id, data) {
  const d = SPECIES_DEFAULTS[id] || {};
  const base = data || { id, name: id };
  const spec = { kind: 'fish', ...d, ...base, id };
  spec.look = { ...(d.look || {}), ...(base.look || {}) };
  spec.swim = { ...(d.swim || {}), ...(base.swim || {}) };
  if (spec.kind === 'snail' && !spec.swim.habit) spec.swim.habit = 'crawl';
  if (spec.kind === 'snail' && !spec.look.finStyle) spec.look.finStyle = 'snail';
  if (!spec.texture) spec.texture = 'assets/fish/' + id + '.png';
  return spec;
}
