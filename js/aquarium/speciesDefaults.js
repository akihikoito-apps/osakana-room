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
  // 海水（v0.4）
  green_chromis:      { kind: 'fish', water: 'salt', look: { lengthToHeight: 2.5, thickness: 0.18, finStyle: 'normal' }, swim: { layer: 'middle', speed: 1.1, school: true, habit: 'coral' } },
  tomato_clown:       { kind: 'fish', water: 'salt', look: { lengthToHeight: 2.3, thickness: 0.25, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.8, school: false, habit: 'coral' } },
  pajama_cardinal:    { kind: 'fish', water: 'salt', look: { lengthToHeight: 1.9, thickness: 0.2, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.5, school: true } },
  banggai_cardinal:   { kind: 'fish', water: 'salt', look: { lengthToHeight: 1.7, thickness: 0.15, finStyle: 'tall' }, swim: { layer: 'middle', speed: 0.5, school: true, habit: 'coral' } },
  royal_gramma:       { kind: 'fish', water: 'salt', look: { lengthToHeight: 3.3, thickness: 0.16, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.7, school: false, habit: 'hover' } },
  vagabond_butterfly: { kind: 'fish', water: 'salt', look: { lengthToHeight: 1.4, thickness: 0.12, finStyle: 'tall' }, swim: { layer: 'middle', speed: 0.8, school: false } },
  flame_angel:        { kind: 'fish', water: 'salt', look: { lengthToHeight: 1.9, thickness: 0.16, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.8, school: false } },
  boxfish:            { kind: 'fish', water: 'salt', look: { lengthToHeight: 1.6, thickness: 0.45, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.45, school: false } },
  moorish_idol:       { kind: 'fish', water: 'salt', look: { lengthToHeight: 1.2, thickness: 0.12, finStyle: 'tall' }, swim: { layer: 'middle', speed: 0.8, school: false } },
  peppermint_shrimp:  { kind: 'shrimp', water: 'salt', look: { lengthToHeight: 4.0, thickness: 0.2, finStyle: 'shrimp' }, swim: { layer: 'bottom', speed: 0.5, school: false } },
  white_socks:        { kind: 'shrimp', water: 'salt', look: { lengthToHeight: 3.8, thickness: 0.22, finStyle: 'shrimp' }, swim: { layer: 'bottom', speed: 0.45, school: false } },
  magaki:             { kind: 'snail', water: 'salt', look: { lengthToHeight: 1.6, thickness: 0.55, finStyle: 'snail' }, swim: { layer: 'bottom', speed: 0.1, school: false, habit: 'crawl' } },
  // 淡水
  platy:         { kind: 'fish', water: 'fresh', look: { lengthToHeight: 2.7, thickness: 0.22, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.9, school: false } },
  cherry_barb:   { kind: 'fish', water: 'fresh', look: { lengthToHeight: 3.1, thickness: 0.2, finStyle: 'normal' }, swim: { layer: 'middle', speed: 1.0, school: true } },
  otocinclus:    { kind: 'fish', water: 'fresh', look: { lengthToHeight: 4.3, thickness: 0.2, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.7, school: false, habit: 'cling' } },
  dwarf_gourami: { kind: 'fish', water: 'fresh', look: { lengthToHeight: 2.0, thickness: 0.15, finStyle: 'normal' }, swim: { layer: 'top', speed: 0.6, school: false } },
  rummy_nose:    { kind: 'fish', water: 'fresh', look: { lengthToHeight: 4.3, thickness: 0.17, finStyle: 'normal' }, swim: { layer: 'middle', speed: 1.2, school: true } },
  ishimaki:      { kind: 'snail', water: 'fresh', look: { lengthToHeight: 1.3, thickness: 0.62, finStyle: 'snail' }, swim: { layer: 'bottom', speed: 0.1, school: false, habit: 'crawl' } },
  ramshorn:      { kind: 'snail', water: 'fresh', look: { lengthToHeight: 1.15, thickness: 0.5, finStyle: 'snail' }, swim: { layer: 'bottom', speed: 0.1, school: false, habit: 'crawl' } },
  // 淡水（v0.4）
  yamato_shrimp: { kind: 'shrimp', water: 'fresh', look: { lengthToHeight: 4.2, thickness: 0.2, finStyle: 'shrimp' }, swim: { layer: 'bottom', speed: 0.55, school: false } },
  kanoko:        { kind: 'snail', water: 'fresh', look: { lengthToHeight: 1.3, thickness: 0.6, finStyle: 'snail' }, swim: { layer: 'bottom', speed: 0.1, school: false, habit: 'crawl' } },
  // うみの つり（v0.6）
  mahaze:        { kind: 'fish', water: 'salt', look: { lengthToHeight: 5, thickness: 0.2, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.6, school: false, habit: 'hover' } },
  aji:           { kind: 'fish', water: 'salt', look: { lengthToHeight: 3.6, thickness: 0.16, finStyle: 'normal' }, swim: { layer: 'middle', speed: 1.3, school: true } },
  nenbutsudai:   { kind: 'fish', water: 'salt', look: { lengthToHeight: 2.8, thickness: 0.17, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.7, school: true } },
  yadokari:      { kind: 'shrimp', water: 'salt', look: { lengthToHeight: 2.2, thickness: 0.3, finStyle: 'shrimp' }, swim: { layer: 'bottom', speed: 0.4, school: false } },
  kusafugu:      { kind: 'fish', water: 'salt', look: { lengthToHeight: 2.6, thickness: 0.35, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.7, school: false } },
  kisu:          { kind: 'fish', water: 'salt', look: { lengthToHeight: 5.5, thickness: 0.16, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.9, school: true } },
  kasago:        { kind: 'fish', water: 'salt', look: { lengthToHeight: 3, thickness: 0.3, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.3, school: false, habit: 'hover' } },
  mebaru:        { kind: 'fish', water: 'salt', look: { lengthToHeight: 2.8, thickness: 0.2, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.5, school: true } },
  kyusen:        { kind: 'fish', water: 'salt', look: { lengthToHeight: 4.2, thickness: 0.16, finStyle: 'normal' }, swim: { layer: 'middle', speed: 1, school: false } },
  umitanago:     { kind: 'fish', water: 'salt', look: { lengthToHeight: 2.2, thickness: 0.15, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.8, school: true } },
  mejina:        { kind: 'fish', water: 'salt', look: { lengthToHeight: 2.2, thickness: 0.18, finStyle: 'normal' }, swim: { layer: 'middle', speed: 1, school: true } },
  kawahagi:      { kind: 'fish', water: 'salt', look: { lengthToHeight: 1.7, thickness: 0.12, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.6, school: false } },
  kurodai:       { kind: 'fish', water: 'salt', look: { lengthToHeight: 2.3, thickness: 0.17, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.8, school: false } },
  ishidai:       { kind: 'fish', water: 'salt', look: { lengthToHeight: 2, thickness: 0.15, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.9, school: false } },
  madai:         { kind: 'fish', water: 'salt', look: { lengthToHeight: 2.3, thickness: 0.16, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.9, school: false } },
  aoriika:       { kind: 'fish', water: 'salt', look: { lengthToHeight: 2.8, thickness: 0.25, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.6, school: false } },
  madako:        { kind: 'shrimp', water: 'salt', look: { lengthToHeight: 1.8, thickness: 0.35, finStyle: 'shrimp' }, swim: { layer: 'bottom', speed: 0.35, school: false } },
  // いけの ガサガサ（v0.6）
  tanishi:       { kind: 'snail', water: 'pond', look: { lengthToHeight: 1.2, thickness: 0.6, finStyle: 'snail' }, swim: { layer: 'bottom', speed: 0.15, school: false, habit: 'crawl' } },
  sujiebi:       { kind: 'shrimp', water: 'pond', look: { lengthToHeight: 4, thickness: 0.2, finStyle: 'shrimp' }, swim: { layer: 'bottom', speed: 0.6, school: false } },
  zarigani:      { kind: 'shrimp', water: 'pond', look: { lengthToHeight: 2.8, thickness: 0.35, finStyle: 'shrimp' }, swim: { layer: 'bottom', speed: 0.4, school: false, habit: 'land' } },
  otamajakushi:  { kind: 'fish', water: 'pond', look: { lengthToHeight: 2.5, thickness: 0.4, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.7, school: false } },
  motsugo:       { kind: 'fish', water: 'pond', look: { lengthToHeight: 4, thickness: 0.17, finStyle: 'normal' }, swim: { layer: 'middle', speed: 1.1, school: true } },
  dojou:         { kind: 'fish', water: 'pond', look: { lengthToHeight: 7, thickness: 0.15, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.6, school: false } },
  funa:          { kind: 'fish', water: 'pond', look: { lengthToHeight: 2.4, thickness: 0.22, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.8, school: true } },
  oikawa:        { kind: 'fish', water: 'pond', look: { lengthToHeight: 4, thickness: 0.15, finStyle: 'normal' }, swim: { layer: 'middle', speed: 1.3, school: true } },
  yago:          { kind: 'shrimp', water: 'pond', look: { lengthToHeight: 4.5, thickness: 0.25, finStyle: 'shrimp' }, swim: { layer: 'bottom', speed: 0.3, school: false } },
  yoshinobori:   { kind: 'fish', water: 'pond', look: { lengthToHeight: 4.5, thickness: 0.2, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.6, school: false, habit: 'hover' } },
  sawagani:      { kind: 'shrimp', water: 'pond', look: { lengthToHeight: 1.4, thickness: 0.35, finStyle: 'shrimp' }, swim: { layer: 'bottom', speed: 0.35, school: false, habit: 'land' } },
  tanago:        { kind: 'fish', water: 'pond', look: { lengthToHeight: 2.8, thickness: 0.15, finStyle: 'normal' }, swim: { layer: 'middle', speed: 0.9, school: true } },
  donko:         { kind: 'fish', water: 'pond', look: { lengthToHeight: 4, thickness: 0.25, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.35, school: false, habit: 'hover' } },
  mizukamakiri:  { kind: 'shrimp', water: 'pond', look: { lengthToHeight: 8, thickness: 0.12, finStyle: 'shrimp' }, swim: { layer: 'bottom', speed: 0.3, school: false } },
  hotokedojou:   { kind: 'fish', water: 'pond', look: { lengthToHeight: 5, thickness: 0.2, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.6, school: false } },
  namazu:        { kind: 'fish', water: 'pond', look: { lengthToHeight: 6, thickness: 0.2, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.5, school: false } },
  gengorou:      { kind: 'fish', water: 'pond', look: { lengthToHeight: 1.8, thickness: 0.4, finStyle: 'normal' }, swim: { layer: 'middle', speed: 1.2, school: false } },
  tonosamagaeru: { kind: 'fish', water: 'pond', look: { lengthToHeight: 2, thickness: 0.4, finStyle: 'normal' }, swim: { layer: 'top', speed: 0.6, school: false, habit: 'land' } },
  amagaeru:      { kind: 'fish', water: 'pond', look: { lengthToHeight: 1.8, thickness: 0.4, finStyle: 'normal' }, swim: { layer: 'top', speed: 0.5, school: false, habit: 'land' } },
  kusagame:      { kind: 'fish', water: 'pond', look: { lengthToHeight: 2.2, thickness: 0.5, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.4, school: false, habit: 'land' } },
  ishigame:      { kind: 'fish', water: 'pond', look: { lengthToHeight: 2.2, thickness: 0.5, finStyle: 'normal' }, swim: { layer: 'bottom', speed: 0.4, school: false, habit: 'land' } },
  tagame:        { kind: 'shrimp', water: 'pond', look: { lengthToHeight: 2.8, thickness: 0.25, finStyle: 'shrimp' }, swim: { layer: 'bottom', speed: 0.3, school: false } },
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
