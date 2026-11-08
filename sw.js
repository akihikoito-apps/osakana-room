// オフラインで動くようにする サービスワーカー（部屋・ゲーム係）。
// VERSION は js/version.js と かならず そろえる（ここが かわると 新しい版として 入れなおす）。
const VERSION = '0.4.0';
const CACHE = 'osakana-room-' + VERSION;

const FILES = [
  './', 'index.html', 'manifest.json', 'css/style.css', 'css/help.css', 'css/play.css',
  'icon-180.png', 'icon-192.png', 'icon-512.png', 'stay-awake.mp4',
  'js/main.js', 'js/state.js', 'js/sim.js', 'js/version.js', 'js/bgm.js',
  'js/ui/common.js', 'js/ui/room.js', 'js/ui/tank.js', 'js/ui/shop.js', 'js/ui/dex.js', 'js/ui/missions.js', 'js/ui/photo.js', 'js/ui/tutorial.js', 'js/ui/awake.js', 'js/ui/bgm-ui.js',
  'js/data/fish.js', 'js/data/items.js', 'js/data/compat.js', 'js/data/balance.js', 'js/data/missions.js', 'js/data/hints.js', 'js/data/tutorial.js',
  'js/aquarium/index.js', 'js/aquarium/tank.js', 'js/aquarium/swim.js', 'js/aquarium/fishModel.js', 'js/aquarium/fx.js', 'js/aquarium/fallbackArt.js', 'js/aquarium/speciesDefaults.js', 'js/aquarium/clean.js',
  'vendor/three.module.min.js',
  'assets/bgm/pokapoka.m4a', 'assets/bgm/hidamari.m4a', 'assets/bgm/yurayura.m4a', 'assets/bgm/suichu.m4a', 'assets/bgm/ohirune.m4a',
  'assets/room/room_base.jpg', 'assets/room/room_v2.jpg', 'assets/room/room_v2_night.jpg', 'assets/room/sand.png', 'assets/room/tank_bg.png', 'assets/room/driftwood.png',
  'assets/room/plant1.png', 'assets/room/plant2.png', 'assets/room/plant3.png',
  'assets/room/stone1.png', 'assets/room/stone2.png', 'assets/room/stone3.png',
  'assets/fish/albino_corydoras.png', 'assets/fish/angelfish.png', 'assets/fish/betta.png', 'assets/fish/blue_damsel.png', 'assets/fish/blue_tang.png',
  'assets/fish/cherry_barb.png', 'assets/fish/clownfish.png', 'assets/fish/corydoras.png', 'assets/fish/dwarf_gourami.png', 'assets/fish/firefish.png',
  'assets/fish/goldfish.png', 'assets/fish/guppy.png', 'assets/fish/ishimaki.png', 'assets/fish/mandarin.png', 'assets/fish/medaka.png',
  'assets/fish/minami_shrimp.png', 'assets/fish/neon_tetra.png', 'assets/fish/otocinclus.png', 'assets/fish/platy.png', 'assets/fish/ramshorn.png',
  'assets/fish/red_bee_shrimp.png', 'assets/fish/rummy_nose.png', 'assets/fish/shittaka.png', 'assets/fish/skunk_shrimp.png', 'assets/fish/yellow_tang.png',
  'assets/fish/yamato_shrimp.png', 'assets/fish/kanoko.png', 'assets/fish/green_chromis.png', 'assets/fish/tomato_clown.png', 'assets/fish/pajama_cardinal.png',
  'assets/fish/banggai_cardinal.png', 'assets/fish/royal_gramma.png', 'assets/fish/vagabond_butterfly.png', 'assets/fish/flame_angel.png', 'assets/fish/boxfish.png',
  'assets/fish/moorish_idol.png', 'assets/fish/peppermint_shrimp.png', 'assets/fish/white_socks.png', 'assets/fish/magaki.png',
  'assets/items/seaweed.png', 'assets/items/anemone.png', 'assets/items/shell.png', 'assets/items/coral_stone.png', 'assets/items/color_stone.png', 'assets/items/pot.png',
  'assets/items/air_pump.png', 'assets/items/auto_feeder.png', 'assets/items/bgm.png', 'assets/items/co2_kit.png', 'assets/items/coral.png',
  'assets/items/dirt_bits.png', 'assets/items/driftwood.png', 'assets/items/fan.png', 'assets/items/filter.png', 'assets/items/food_flake.png',
  'assets/items/food_sinking.png', 'assets/items/food_vitamin.png', 'assets/items/food_vitamin_set.png', 'assets/items/heart.png', 'assets/items/heater.png', 'assets/items/light.png',
  'assets/items/liverock.png', 'assets/items/net.png', 'assets/items/plant.png', 'assets/items/skimmer.png', 'assets/items/stone.png',
  'assets/items/tank_fresh.png', 'assets/items/tank_salt.png', 'assets/items/water_change.png',
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
    // 動画（stay-awake.mp4）は Safari が Range で とりに くるので、206 で かえす
    const range = req.headers.get('range');
    if (hit && range) {
      const buf = await hit.arrayBuffer();
      const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
      const start = Number(m[1] || 0), end = m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
      return new Response(buf.slice(start, end + 1), { status: 206, headers: { 'Content-Type': hit.headers.get('Content-Type') || 'video/mp4', 'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
    }
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
