// リアクションの 3D スプライト（ハート・しずく・Zz・キラキラ）。絵は canvas で描く。
import * as THREE from '../../vendor/three.module.min.js';

const backOut = (t) => { const s = 2.2; t -= 1; return t * t * ((s + 1) * t + s) + 1; };

function canvasTex(size, draw) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function heartPath(g, cx, cy, s) {
  g.beginPath();
  g.moveTo(cx, cy + s * 0.38);
  g.bezierCurveTo(cx - s * 0.62, cy - s * 0.02, cx - s * 0.42, cy - s * 0.55, cx, cy - s * 0.25);
  g.bezierCurveTo(cx + s * 0.42, cy - s * 0.55, cx + s * 0.62, cy - s * 0.02, cx, cy + s * 0.38);
  g.closePath();
}

export function makeFxTextures() {
  return {
    heart: canvasTex(128, (g, n) => {
      heartPath(g, n / 2, n / 2 + 4, n * 0.95);
      g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = '#ffffff'; g.stroke();
      const gr = g.createLinearGradient(0, 20, 0, n - 10);
      gr.addColorStop(0, '#ff8cc0'); gr.addColorStop(1, '#ff2e7a');
      g.fillStyle = gr; g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.ellipse(n * 0.34, n * 0.36, n * 0.09, n * 0.055, -0.6, 0, 7); g.fill();
    }),
    drop: canvasTex(128, (g, n) => {
      g.beginPath();
      g.moveTo(n / 2, 10);
      g.bezierCurveTo(n * 0.62, n * 0.38, n * 0.8, n * 0.55, n * 0.8, n * 0.68);
      g.arc(n / 2, n * 0.68, n * 0.3, 0, Math.PI);
      g.bezierCurveTo(n * 0.2, n * 0.55, n * 0.38, n * 0.38, n / 2, 10);
      g.closePath();
      g.lineWidth = 16; g.strokeStyle = '#ffffff'; g.lineJoin = 'round'; g.stroke();
      const gr = g.createLinearGradient(0, 10, 0, n);
      gr.addColorStop(0, '#9fdcff'); gr.addColorStop(1, '#3d8cff');
      g.fillStyle = gr; g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.ellipse(n * 0.4, n * 0.66, n * 0.06, n * 0.1, 0.3, 0, 7); g.fill();
    }),
    z: canvasTex(128, (g, n) => {
      g.font = `900 ${n * 0.85}px "Arial Rounded MT Bold", "Hiragino Maru Gothic ProN", sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = 22; g.strokeStyle = '#ffffff'; g.strokeText('Z', n / 2, n / 2 + 4); g.lineWidth = 6; g.strokeStyle = '#3b3f9e'; g.strokeText('Z', n / 2, n / 2 + 4);
      g.fillStyle = '#7a8cff'; g.fillText('Z', n / 2, n / 2 + 4);
    }),
    sparkle: canvasTex(128, (g, n) => {
      const c = n / 2;
      const glow = g.createRadialGradient(c, c, 0, c, c, c);
      glow.addColorStop(0, 'rgba(255,255,220,0.9)'); glow.addColorStop(0.35, 'rgba(255,240,150,0.35)'); glow.addColorStop(1, 'rgba(255,240,150,0)');
      g.fillStyle = glow; g.fillRect(0, 0, n, n);
      g.beginPath();
      const R = c * 0.86, r = c * 0.24;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r : R;
        g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
      }
      g.closePath(); g.lineJoin = 'round'; g.lineWidth = 7; g.strokeStyle = '#ff9a1f'; g.stroke(); g.fillStyle = '#fff07a'; g.fill();
      g.beginPath(); g.arc(c, c, c * 0.16, 0, 7); g.fillStyle = '#ffffff'; g.fill();
    }),
    ring: canvasTex(128, (g, n) => {
      g.beginPath(); g.arc(n / 2, n / 2, n * 0.4, 0, 7);
      g.lineWidth = 8; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke();
    }),
  };
}

export class FxLayer {
  constructor(scene) {
    this.scene = scene;
    this.tex = makeFxTextures();
    this.items = [];
    this.pool = [];
  }

  _sprite(texName) {
    let s = this.pool.pop();
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false }));
      s.renderOrder = 20;
    }
    s.material.map = this.tex[texName];
    s.material.opacity = 1;
    s.material.rotation = 0;
    s.visible = true;
    this.scene.add(s);
    return s;
  }

  /**
   * 粒を1つ出す。anchor() は毎フレーム呼ばれ、ついていく位置（魚の頭の上など）を返す。
   */
  add(tex, anchor, o) {
    const s = this._sprite(tex);
    this.items.push({
      s, anchor, t: -(o.delay || 0), life: o.life || 1.4, size: o.size || 0.7,
      ox: o.ox || 0, oy: o.oy || 0, oz: o.oz || 0, vx: o.vx || 0, vy: o.vy ?? 0.5, spin: o.spin || 0,
      sway: o.sway ?? 0.08, twinkle: !!o.twinkle, grow: o.grow || 0, pos: new THREE.Vector3(),
    });
    s.visible = !(o.delay > 0);
  }

  /** リアクションの種類ごとの演出。 */
  spawn(type, anchor) {
    const r = (a, b) => a + Math.random() * (b - a);
    switch (type) {
      case 'eat':
        this.add('heart', anchor, { size: 0.55, life: 1.1, vy: 0.7 });
        break;
      case 'heart':
        this.add('heart', anchor, { size: 0.85, life: 1.6, vy: 0.55 });
        break;
      case 'happy':
        for (let i = 0; i < 3; i++) this.add('heart', anchor, { delay: i * 0.18, size: r(0.5, 0.75), life: 1.5, ox: (i - 1) * 0.45, vx: (i - 1) * 0.25, vy: 0.8 });
        for (let i = 0; i < 4; i++) this.add('sparkle', anchor, { delay: 0.2 + i * 0.12, size: r(0.35, 0.5), life: 0.8, ox: r(-0.8, 0.8), oy: r(-0.5, 0.3), vy: 0.2, twinkle: true });
        break;
      case 'jump':
        for (let i = 0; i < 5; i++) this.add('sparkle', anchor, { delay: 0.45 + i * 0.06, size: r(0.35, 0.55), life: 0.8, ox: r(-0.9, 0.9), oy: r(-0.6, 0.2), vy: r(0.1, 0.5), twinkle: true });
        break;
      case 'spin':
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          this.add('sparkle', anchor, { delay: 0.25 + i * 0.05, size: 0.42, life: 0.9, ox: Math.cos(a) * 0.9, oy: Math.sin(a) * 0.6 - 0.3, vx: Math.cos(a) * 0.6, vy: Math.sin(a) * 0.4, twinkle: true });
        }
        break;
      case 'thanks':
        for (let i = 0; i < 9; i++) this.add('sparkle', anchor, { delay: 0.65 + i * 0.09, size: r(0.4, 0.7), life: 1.0, ox: r(-1.1, 1.1), oy: r(-0.8, 0.4), vy: r(0.1, 0.4), twinkle: true });
        this.add('heart', anchor, { delay: 1.25, size: 0.8, life: 1.4, vy: 0.5 });
        break;
      case 'sad':
        for (let i = 0; i < 2; i++) this.add('drop', anchor, { delay: i * 0.7, size: 0.62, life: 1.4, ox: 0.25 + i * 0.12, oy: -0.2, vy: -0.3, sway: 0 });
        break;
      case 'sleepy':
        for (let i = 0; i < 3; i++) this.add('z', anchor, { delay: i * 0.85, size: 0.55 + i * 0.14, life: 1.9, ox: 0.15 + i * 0.2, oy: -0.1, vx: 0.2, vy: 0.4, sway: 0.1, grow: 0.3 });
        break;
    }
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.t += dt;
      if (p.t < 0) { p.s.visible = false; continue; }
      if (p.t >= p.life) { this._free(i); continue; }
      const k = p.t / p.life;
      const a = p.anchor(p.pos);
      if (!a) { this._free(i); continue; }
      p.s.visible = true;
      const pop = p.t < 0.32 ? backOut(p.t / 0.32) : 1;
      let sc = p.size * Math.max(0.01, pop) * (1 + p.grow * k);
      if (p.twinkle) sc *= 0.7 + 0.3 * Math.abs(Math.sin(p.t * 9));
      p.s.scale.set(sc, sc, 1);
      p.s.position.set(
        p.pos.x + p.ox + p.vx * p.t + Math.sin(p.t * 5) * p.sway,
        p.pos.y + p.oy + p.vy * p.t,
        p.pos.z + p.oz + 0.3,
      );
      p.s.material.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      if (p.twinkle) p.s.material.rotation = p.t * 2;
    }
  }

  _free(i) {
    const p = this.items[i];
    p.s.visible = false;
    this.scene.remove(p.s);
    this.pool.push(p.s);
    this.items.splice(i, 1);
  }

  dispose() {
    for (const p of this.items) { this.scene.remove(p.s); p.s.material.dispose(); }
    for (const s of this.pool) s.material.dispose();
    for (const t of Object.values(this.tex)) t.dispose();
    this.items = []; this.pool = [];
  }
}
