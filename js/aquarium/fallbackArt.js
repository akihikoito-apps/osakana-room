// 絵（assets/fish/<id>.png）がまだ無いときの「仮の魚」を canvas に描く。
// 真横・頭が右・背景透過。本物の絵と同じ流れ（輪郭読み取り→立体化）に乗せる。

const PALETTE = {
  medaka:          { body: '#d9c79a', back: '#9c8a5c', belly: '#f4ecd2', fin: 'rgba(225,205,160,0.75)', accent: '#c9a96a' },
  guppy:           { body: '#b9b39a', back: '#7d7a63', belly: '#ece6d0', fin: 'rgba(255,120,60,0.9)', fin2: 'rgba(70,120,255,0.85)', accent: '#ff8a3c' },
  neon_tetra:      { body: '#c9ced6', back: '#4f5a66', belly: '#eef0f4', fin: 'rgba(230,235,240,0.55)', stripe: '#2ee8ff', red: '#ff2a3a' },
  goldfish:        { body: '#ff7a1f', back: '#e0450f', belly: '#ffd38a', fin: 'rgba(255,120,40,0.75)', accent: '#ffb347' },
  corydoras:       { body: '#a9a593', back: '#6f6b5c', belly: '#ece4cf', fin: 'rgba(200,195,175,0.7)', spot: '#4e4a3e' },
  albino_corydoras:{ body: '#f2d6c9', back: '#e0b4a2', belly: '#fff3ea', fin: 'rgba(250,225,215,0.7)', eye: '#e2465a' },
  betta:           { body: '#2b49c9', back: '#1a2b8a', belly: '#4f7bff', fin: 'rgba(200,30,70,0.85)', fin2: 'rgba(60,90,255,0.85)', accent: '#ff3d6e' },
  angelfish:       { body: '#d8dde2', back: '#a8b0b8', belly: '#f4f6f8', fin: 'rgba(220,226,232,0.8)', band: 'rgba(30,30,36,0.85)' },
  minami_shrimp:   { body: 'rgba(150,135,110,0.9)', back: 'rgba(110,95,75,0.95)', belly: 'rgba(210,200,180,0.85)', fin: 'rgba(160,145,120,0.8)' },
  red_bee_shrimp:  { body: 'rgba(250,250,250,0.95)', back: 'rgba(235,235,235,1)', belly: 'rgba(255,255,255,0.95)', fin: 'rgba(240,240,240,0.85)', band: '#d0102a' },
};

function hashColor(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return {
    body: `hsl(${hue},55%,62%)`, back: `hsl(${hue},55%,40%)`, belly: `hsl(${hue},45%,85%)`,
    fin: `hsla(${(hue + 20) % 360},60%,65%,0.8)`, accent: `hsl(${(hue + 40) % 360},70%,55%)`,
  };
}

/** 仮の魚の絵を返す（HTMLCanvasElement）。 */
export function drawFallbackFish(spec) {
  const look = spec.look || {};
  const style = look.finStyle || 'normal';
  const pal = PALETTE[spec.id] || hashColor(spec.id || 'x');
  if (spec.kind === 'shrimp' || style === 'shrimp') return drawShrimp(pal, spec.id);

  const lth = Math.max(0.8, Math.min(6, look.lengthToHeight || 3.5));
  const W = 512;
  // 体の部分（尾びれを除く）は x=120..500
  const bx0 = style === 'long' ? 170 : style === 'fan' ? 160 : 110;
  const bx1 = 500;
  const bodyLen = bx1 - bx0;
  // 全長（ひれ込み）に対する体高 = W/lth。胴体の高さはその 7〜8 割
  let bodyH = (W / lth) * (style === 'tall' ? 0.55 : 0.78);
  bodyH = Math.min(bodyH, bodyLen * 0.85);
  const finExtra = style === 'tall' ? bodyH * 1.1 : style === 'long' ? bodyH * 0.7 : bodyH * 0.35;
  const H = Math.ceil(bodyH + finExtra * 2 + 24);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const cy = H / 2;
  const top = cy - bodyH / 2, bot = cy + bodyH / 2;

  // 体の輪郭（頭が右）
  const bodyPath = new Path2D();
  const headX = bx1, pedX = bx0 + bodyLen * 0.08;
  const pedH = bodyH * (style === 'long' ? 0.32 : 0.22);
  const maxX = bx0 + bodyLen * 0.58;
  bodyPath.moveTo(pedX, cy - pedH / 2);
  bodyPath.bezierCurveTo(bx0 + bodyLen * 0.3, top + bodyH * 0.05, maxX - bodyLen * 0.1, top, maxX, top);
  bodyPath.bezierCurveTo(maxX + bodyLen * 0.25, top, headX, cy - bodyH * 0.25, headX, cy + bodyH * 0.02);
  bodyPath.bezierCurveTo(headX, cy + bodyH * 0.3, maxX + bodyLen * 0.2, bot, maxX - bodyLen * 0.05, bot);
  bodyPath.bezierCurveTo(bx0 + bodyLen * 0.3, bot - bodyH * 0.05, bx0 + bodyLen * 0.2, cy + pedH / 2, pedX, cy + pedH / 2);
  bodyPath.closePath();

  // ひれ
  g.lineJoin = 'round';
  const fin = (path, color) => { g.fillStyle = color; g.fill(path); };
  const tail = new Path2D();
  if (style === 'fan') {
    tail.moveTo(pedX + 6, cy);
    tail.bezierCurveTo(pedX - 40, cy - bodyH * 0.9, 10, cy - bodyH * 1.2, 4, cy - bodyH * 0.6);
    tail.quadraticCurveTo(-4, cy, 4, cy + bodyH * 0.6);
    tail.bezierCurveTo(10, cy + bodyH * 1.2, pedX - 40, cy + bodyH * 0.9, pedX + 6, cy);
  } else if (style === 'long') {
    tail.moveTo(pedX + 8, cy);
    tail.bezierCurveTo(pedX - 60, cy - bodyH * 0.9, 30, cy - bodyH * 1.1, 6, cy - bodyH * 0.35);
    tail.quadraticCurveTo(40, cy, 6, cy + bodyH * 0.45);
    tail.bezierCurveTo(30, cy + bodyH * 1.15, pedX - 60, cy + bodyH * 0.9, pedX + 8, cy);
  } else {
    const tl = Math.min(bx0 - 6, bodyLen * 0.32);
    tail.moveTo(pedX + 4, cy);
    tail.lineTo(pedX - tl, cy - bodyH * 0.55);
    tail.quadraticCurveTo(pedX - tl * 0.6, cy, pedX - tl, cy + bodyH * 0.55);
    tail.closePath();
  }
  fin(tail, pal.fin);
  if (pal.fin2) { g.save(); g.clip(tail); g.fillStyle = pal.fin2; g.fillRect(0, cy - 4, pedX, bodyH * 2); g.restore(); }

  // 背びれ・しりびれ
  const dorsal = new Path2D();
  const anal = new Path2D();
  if (style === 'tall') {
    dorsal.moveTo(maxX + 20, top + 4); dorsal.quadraticCurveTo(maxX - 30, top - finExtra * 0.9, bx0 + bodyLen * 0.12, top - finExtra * 0.95); dorsal.quadraticCurveTo(bx0 + bodyLen * 0.3, top + bodyH * 0.1, pedX + 30, cy - pedH * 0.4); dorsal.closePath();
    anal.moveTo(maxX + 10, bot - 4); anal.quadraticCurveTo(maxX - 30, bot + finExtra * 0.9, bx0 + bodyLen * 0.12, bot + finExtra * 0.95); anal.quadraticCurveTo(bx0 + bodyLen * 0.3, bot - bodyH * 0.1, pedX + 30, cy + pedH * 0.4); anal.closePath();
  } else if (style === 'long') {
    dorsal.moveTo(maxX + 10, top + 4); dorsal.quadraticCurveTo(maxX - 40, top - finExtra * 0.9, pedX + 10, top - finExtra * 0.2); dorsal.lineTo(pedX + 20, cy - pedH * 0.3); dorsal.closePath();
    anal.moveTo(maxX + 30, bot - 4); anal.quadraticCurveTo(maxX - 40, bot + finExtra * 1.0, pedX - 10, bot + finExtra * 0.4); anal.lineTo(pedX + 20, cy + pedH * 0.3); anal.closePath();
  } else {
    const dx = bx0 + bodyLen * 0.45;
    dorsal.moveTo(dx + 40, top + 6); dorsal.quadraticCurveTo(dx + 10, top - finExtra * 0.9, dx - 30, top - finExtra * 0.5); dorsal.lineTo(dx - 20, top + bodyH * 0.12); dorsal.closePath();
    anal.moveTo(dx + 10, bot - 4); anal.quadraticCurveTo(dx - 20, bot + finExtra * 0.7, dx - 50, bot + finExtra * 0.4); anal.lineTo(dx - 40, bot - bodyH * 0.1); anal.closePath();
  }
  fin(dorsal, pal.fin); fin(anal, pal.fin);
  if (spec.id === 'betta' && pal.fin2) { g.save(); g.clip(anal); g.fillStyle = pal.fin2; g.fillRect(0, bot, W, H); g.restore(); }

  // 体
  const grad = g.createLinearGradient(0, top, 0, bot);
  grad.addColorStop(0, pal.back); grad.addColorStop(0.45, pal.body); grad.addColorStop(1, pal.belly);
  g.fillStyle = grad; g.fill(bodyPath);

  g.save(); g.clip(bodyPath);
  // うろこのきらめき
  g.globalAlpha = 0.12; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
  for (let x = bx0; x < bx1 - 60; x += 14) for (let y = top; y < bot; y += 12) {
    g.beginPath(); g.arc(x + ((y / 12) % 2) * 7, y, 7, -1.2, 1.2); g.stroke();
  }
  g.globalAlpha = 1;
  // 種ごとの模様
  if (spec.id === 'neon_tetra') {
    g.fillStyle = pal.stripe; g.fillRect(bx0 + 20, cy - bodyH * 0.18, bodyLen * 0.8, bodyH * 0.16);
    g.fillStyle = pal.red; g.fillRect(bx0, cy + bodyH * 0.0, bodyLen * 0.55, bodyH * 0.35);
  } else if (spec.id === 'angelfish') {
    g.fillStyle = pal.band;
    for (const f of [0.18, 0.5, 0.78]) g.fillRect(bx0 + bodyLen * f - 8, 0, 16, H);
  } else if (pal.spot) {
    g.fillStyle = pal.spot;
    for (let i = 0; i < 40; i++) { const x = bx0 + 20 + ((i * 53) % (bodyLen - 80)); const y = top + 10 + ((i * 37) % (bodyH - 20)); g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); }
  } else if (spec.id === 'goldfish') {
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(maxX, bot - bodyH * 0.2, bodyLen * 0.3, bodyH * 0.18, 0, 0, 7); g.fill();
  } else if (spec.id === 'medaka') {
    g.strokeStyle = 'rgba(80,70,40,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(pedX, cy); g.lineTo(headX - 40, cy - 2); g.stroke();
  }
  // えら
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 3;
  g.beginPath(); g.arc(headX - bodyLen * 0.12, cy, bodyH * 0.35, Math.PI * 0.62, Math.PI * 1.38); g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.stroke(bodyPath);

  // 胸びれ
  g.fillStyle = pal.fin; g.beginPath();
  g.ellipse(headX - bodyLen * 0.2, cy + bodyH * 0.15, bodyLen * 0.08, bodyH * 0.07, 0.5, 0, 7); g.fill();
  // 目
  const er = Math.max(6, Math.min(bodyH * 0.11, 16));
  const ex = headX - bodyLen * 0.07, ey = cy - bodyH * 0.08;
  g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, ey, er * 1.15, 0, 7); g.fill();
  g.fillStyle = pal.eye || '#111'; g.beginPath(); g.arc(ex, ey, er, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(ex + er * 0.3, ey - er * 0.35, er * 0.32, 0, 7); g.fill();
  return cv;
}

function drawShrimp(pal, id) {
  const W = 512, H = 200;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const cy = 100;
  // あし
  g.strokeStyle = pal.fin; g.lineWidth = 4; g.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const x = 250 + i * 34; g.beginPath(); g.moveTo(x, cy + 30); g.lineTo(x - 6, cy + 70); g.stroke(); }
  for (let i = 0; i < 4; i++) { const x = 120 + i * 30; g.beginPath(); g.moveTo(x, cy + 28); g.lineTo(x - 4, cy + 48); g.stroke(); }
  // しょっかく
  g.lineWidth = 2.5; g.strokeStyle = pal.back;
  g.beginPath(); g.moveTo(470, cy - 10); g.quadraticCurveTo(510, cy - 70, 380, cy - 95); g.stroke();
  g.beginPath(); g.moveTo(470, cy - 5); g.quadraticCurveTo(505, cy - 30, 500, cy + 40); g.stroke();
  // しっぽの扇
  g.fillStyle = pal.fin;
  g.beginPath(); g.moveTo(70, cy + 5); g.lineTo(8, cy - 30); g.quadraticCurveTo(0, cy + 10, 12, cy + 45); g.closePath(); g.fill();
  // 体（節）
  const body = new Path2D();
  body.moveTo(60, cy + 8);
  body.bezierCurveTo(120, cy - 50, 300, cy - 60, 420, cy - 40);
  body.quadraticCurveTo(475, cy - 30, 485, cy - 5);
  body.quadraticCurveTo(470, cy + 25, 420, cy + 32);
  body.bezierCurveTo(300, cy + 40, 150, cy + 35, 60, cy + 22);
  body.closePath();
  const grad = g.createLinearGradient(0, cy - 50, 0, cy + 35);
  grad.addColorStop(0, pal.back); grad.addColorStop(0.5, pal.body); grad.addColorStop(1, pal.belly);
  g.fillStyle = grad; g.fill(body);
  g.save(); g.clip(body);
  if (pal.band) {
    g.fillStyle = pal.band;
    for (const [x0, w] of [[60, 50], [190, 55], [330, 70]]) g.fillRect(x0, 0, w, H);
  }
  g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 2;
  for (let x = 110; x < 330; x += 40) { g.beginPath(); g.moveTo(x, cy - 60); g.lineTo(x - 8, cy + 40); g.stroke(); }
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 2; g.stroke(body);
  // 目
  g.fillStyle = '#111'; g.beginPath(); g.arc(452, cy - 18, 8, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(455, cy - 21, 2.5, 0, 7); g.fill();
  return cv;
}
