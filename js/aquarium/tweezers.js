// v0.7 ピンセットで えさを あげる（1ぴきずつ。水の 中でも りくちの 上でも とどく）。
// Codex・agy に 相談：先が まるい プラスチック。スクショを 見て もらって、水・草と まざらない 白っぽい ぎんいろ＋ミントの すべりどめ に（agy）、
// みじかくして V の 根元が 画面に 見える ように（Codex・agy）、えさは 大きめ。その子が かおを むけている がわの ななめ上（すこし 手前）から すっと 入り、
// 口もとで ちょっと まって パクッ → ぬける。ぜんぶで 約1.4びょう。えさは まく ときより 大きめの 1つぶ。
// まっている あいだ その子は その場で とまる（agent.held）。きらいな えさなら ぷいっ（えさは ピンセットに のこって もどる）。
import * as THREE from '../../vendor/three.module.min.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
const easeIn = (t) => t * t;
export const TW = { in: 0.5, wait: 0.2, eat: 0.35, out: 0.35 };
export const TWEEZERS_DUR = TW.in + TW.wait + TW.eat + TW.out;   // 1.4 びょう
const REACH = 7;   // 入ってくる きょり（ワールド単位。画面の 外から）

const FOOD_COL = { flake: '#d9893c', sinking: '#b8662a', vitamin: '#ff6fb5', bloodworm: '#c4202f', brine: '#ff9a5c', veggie: '#4f9a3a', krill: '#ff8f7a' };

export class Tweezers {
  constructor(scene, tank, fx) {
    this.scene = scene; this.tank = tank; this.fx = fx;
    this.active = null;
    this.rig = new THREE.Group();   // 原点 ＝ ピンセットの 先（えさを はさむ ところ）。+y が 持つ ほう
    this.rig.visible = false;
    const mint = new THREE.MeshLambertMaterial({ color: '#f2f6f8', emissive: '#59646c' });   // からだ：白っぽい ぎんいろ
    const grip = new THREE.MeshLambertMaterial({ color: '#3fc7a0', emissive: '#155a48' });   // すべりどめ：ミント
    this.mats = [mint, grip];
    this.geos = [];
    const G = (g) => (this.geos.push(g), g);
    const L = 4.4;
    // 2本の あし：先は くっついて（えさを はさむ）、まんなかで ひらき、上で また くっつく
    const seg = (x0, y0, x1, y1, w, mat) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const g = G(new THREE.BoxGeometry(w, len, 0.09));
      const m = new THREE.Mesh(g, mat);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
      m.rotation.z = Math.atan2(-(x1 - x0), y1 - y0);
      return m;
    };
    for (const s of [-1, 1]) {
      this.rig.add(seg(s * 0.1, 0.02, s * 0.32, L * 0.55, 0.16, mint));
      this.rig.add(seg(s * 0.32, L * 0.55, s * 0.14, L, 0.19, mint));
      // すべりどめ（にぎる ところの みぞ）
      for (let i = 0; i < 3; i++) { const y = L * (0.34 + i * 0.07); const r = seg(s * (0.1 + 0.22 * y / (L * 0.55)), y, s * (0.1 + 0.22 * (y + 0.14) / (L * 0.55)), y + 0.14, 0.22, grip); this.rig.add(r); }
      const tip = new THREE.Mesh(G(new THREE.SphereGeometry(0.085, 10, 8)), mint);
      tip.position.set(s * 0.1, 0.02, 0);
      this.rig.add(tip);
    }
    const top = new THREE.Mesh(G(new THREE.CylinderGeometry(0.19, 0.19, 0.4, 12)), grip);
    top.rotation.z = Math.PI / 2; top.position.y = L;
    this.rig.add(top);
    // はさんだ えさ（まく ときより 大きめ）
    this.foodMat = new THREE.MeshLambertMaterial({ color: '#d9893c', emissive: '#3a1a00' });
    this.mats.push(this.foodMat);
    this.food = new THREE.Mesh(G(new THREE.IcosahedronGeometry(0.22, 1)), this.foodMat);
    this.food.scale.set(1.1, 0.75, 1);
    this.rig.add(this.food);
    this.rig.traverse((o) => { o.frustumCulled = false; o.renderOrder = 8; });
    scene.add(this.rig);
    this.axis = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.q = new THREE.Quaternion();
  }

  get busy() { return !!this.active; }

  /**
   * agent の 口もとへ えさを はこぶ。o.kind ＝ えさの しゅるい（tank.foodKinds の キー・'flake'・'vitamin'）。
   * o.onEat(agent, kind) ／ o.onPui(agent, kind) を たべた（そむけた）しゅんかんに よぶ。o.pref(agent, kind) で すききらいを しらべる。
   * Promise は 'ate' | 'pui' | 'gone'（とちゅうで いなくなった）で 解決。つかっている あいだは null を かえす。
   */
  play(agent, o = {}) {
    if (this.active || !agent) return null;
    const kind = o.kind || 'flake';
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    const fdir = Math.cos(agent.yaw) >= 0 ? 1 : -1;   // かおを むけている がわ から
    this.axis.set(fdir * 0.6, 1, 0.38).normalize();
    this.q.setFromUnitVectors(_Y, this.axis);
    const fk = this.tank.foodKinds?.[kind];
    this.foodMat.color.set(fk ? fk.colors[0] : FOOD_COL[kind] || FOOD_COL.flake);
    this.food.visible = true;
    agent.held = true;
    agent.speed = 0;
    this.active = { t: 0, agent, kind, fdir, resolve, promise, o, done: null, wasIn: false };
    this.rig.visible = true;
    this.update(0);
    return promise;
  }

  /** 口もと（すこし まえ・すこし 上）。 */
  aim(a, out) {
    a.mouth(out);
    return out.set(out.x + Math.cos(a.yaw) * (0.1 + a.len * 0.06), out.y + 0.05 + a.len * 0.04, out.z - Math.sin(a.yaw) * (0.1 + a.len * 0.06));
  }

  update(dt) {
    const s = this.active;
    if (!s) return;
    s.t += dt;
    const a = s.agent, T = s.t;
    const t1 = TW.in, t2 = t1 + TW.wait, t3 = t2 + TW.eat;
    if (a.gone) { this.finish('gone'); return; }
    this.aim(a, this.target);
    let dist;
    if (T < t1) dist = REACH * (1 - easeOut(T / t1));
    else if (T < t3) dist = 0;
    else dist = REACH * easeIn(clamp((T - t3) / TW.out, 0, 1));
    // パクッ：先が すこし 口へ ちかづいて もどる
    const nib = T >= t2 && T < t3 ? Math.sin(((T - t2) / TW.eat) * Math.PI) * 0.12 : 0;
    this.rig.position.copy(this.target).addScaledVector(this.axis, dist - nib);
    this.rig.quaternion.copy(this.q);
    // 水面を とおる ときに 波もん
    const lv = this.tank.levelNow, inW = this.rig.position.y < lv && this.rig.position.x < this.tank.waterMaxX;
    if (inW !== s.wasIn && T > 0.05) this.tank.addRipple(this.rig.position.x + this.axis.x * ((lv - this.rig.position.y) / this.axis.y), clamp(this.rig.position.z + this.axis.z * ((lv - this.rig.position.y) / this.axis.y), this.tank.bounds.minZ, this.tank.bounds.maxZ));
    s.wasIn = inW;
    // まっている あいだ：その子は ピンセットの ほうへ かおを むけて ちょっと 口を ぱくぱく
    if (!s.done) {
      a.speed = 0;
      a.wave += dt * 3.5;
      a.amp += (0.035 - a.amp) * Math.min(1, dt * 4);
      const want = s.fdir > 0 ? 0 : Math.PI;
      let d = want - a.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      a.yaw += d * Math.min(1, dt * 3);
      a.pitch += (0 - a.pitch) * Math.min(1, dt * 3);
    }
    if (!s.done && T >= t2 + TW.eat * 0.45) this.resolveEat();
    if (T >= TWEEZERS_DUR) this.finish();
  }

  /** たべる（または ぷいっ）。1かいだけ。 */
  resolveEat() {
    const s = this.active;
    if (!s || s.done) return;
    const a = s.agent, o = s.o;
    a.held = false;
    const pref = o.pref ? o.pref(a, s.kind) : 'ok';
    if (pref === 'dislike') {
      s.done = 'pui';
      a.startReact('pui');
      o.onPui && o.onPui(a, s.kind);
    } else {
      s.done = 'ate';
      this.food.visible = false;
      a.sx = 0.86; a.flash = 0.5;
      a.fullUntil = (a.clock || 0) + 4;
      o.onEat && o.onEat(a, s.kind);
    }
  }

  /** おわらせる（すぐ）。まだ たべて いなければ、ここで たべた ことに する（eat:false で しない）。 */
  finish(result, eat = true) {
    const s = this.active;
    if (!s) return;
    if (!s.done && result !== 'gone' && eat) this.resolveEat();
    s.agent.held = false;
    this.active = null;
    this.rig.visible = false;
    s.resolve(result || s.done || 'gone');
  }

  dispose() {
    this.finish('gone', false);
    this.scene.remove(this.rig);
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}

const _Y = new THREE.Vector3(0, 1, 0);
