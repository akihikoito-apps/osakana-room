// オフラインで動くようにする サービスワーカー（部屋・ゲーム係）。
// VERSION は js/version.js と かならず そろえる（ここが かわると 新しい版として 入れなおす）。
const VERSION = '0.1.0';
const CACHE = 'osakana-room-' + VERSION;

const FILES = [
  './', 'index.html', 'manifest.json', 'css/style.css',
  'icon-180.png', 'icon-192.png', 'icon-512.png',
  'js/main.js', 'js/state.js', 'js/sim.js', 'js/version.js',
  'js/ui/common.js', 'js/ui/room.js', 'js/ui/tank.js', 'js/ui/shop.js', 'js/ui/dex.js', 'js/ui/missions.js', 'js/ui/photo.js', 'js/ui/tutorial.js',
  'js/data/fish.js', 'js/data/items.js', 'js/data/compat.js', 'js/data/balance.js', 'js/data/missions.js', 'js/data/hints.js', 'js/data/tutorial.js',
  'js/aquarium/index.js', 'js/aquarium/tank.js', 'js/aquarium/swim.js', 'js/aquarium/fishModel.js', 'js/aquarium/fx.js', 'js/aquarium/fallbackArt.js',
  'vendor/three.module.min.js',
  'assets/room/room_base.jpg', 'assets/room/sand.png', 'assets/room/tank_bg.png', 'assets/room/driftwood.png',
  'assets/room/plant1.png', 'assets/room/plant2.png', 'assets/room/plant3.png',
  'assets/room/stone1.png', 'assets/room/stone2.png', 'assets/room/stone3.png',
  'assets/fish/medaka.png', 'assets/fish/guppy.png', 'assets/fish/neon_tetra.png', 'assets/fish/goldfish.png', 'assets/fish/corydoras.png',
  'assets/fish/minami_shrimp.png', 'assets/fish/betta.png', 'assets/fish/angelfish.png', 'assets/fish/red_bee_shrimp.png', 'assets/fish/albino_corydoras.png',
  'assets/items/air_pump.png', 'assets/items/filter.png', 'assets/items/food_flake.png', 'assets/items/heater.png', 'assets/items/light.png',
  'assets/items/liverock.png', 'assets/items/plant.png', 'assets/items/stone.png', 'assets/items/water_change.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // 1つ 足りなくても ほかは 入れる（版の 途中で 絵が ふえても こわれない）
    await Promise.all(FILES.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => console.warn('sw: なし', f))));
    // はじめての インストールなら すぐ 使う。新しい版は「あたらしく する」を おすまで まつ
    if (!self.registration.active) self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('osakana-room-') && k !== CACHE) await caches.delete(k);
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    // ページは いつも index.html（?debug=1 などが ついていても）
    if (req.mode === 'navigate') {
      const hit = await c.match('index.html');
      if (hit) return hit;
    }
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') c.put(req, res.clone());
      return res;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});
