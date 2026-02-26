const CACHE_NAME = 'mtc-cache-v3.4.9'; // v3.4.9 Menu Update: Latest features and version information

// รายชื่อไฟล์ทั้งหมดที่ต้องการโหลดเก็บไว้ในเครื่องผู้เล่น
// Cache busting: เพิ่ม timestamp เพื่อบังคับให้โหลดไฟล์ใหม่
const CACHE_TIMESTAMP = Date.now();
const urlsToCache = [
  './',
  './index.html',
  './favicon.svg',
  './js/config.js?v=' + CACHE_TIMESTAMP,
  './js/utils.js?v=' + CACHE_TIMESTAMP,
  './js/audio.js?v=' + CACHE_TIMESTAMP,
  './js/input.js?v=' + CACHE_TIMESTAMP,
  './js/map.js?v=' + CACHE_TIMESTAMP,
  './js/effects.js?v=' + CACHE_TIMESTAMP,
  './js/weapons.js?v=' + CACHE_TIMESTAMP,
  './js/ui.js?v=' + CACHE_TIMESTAMP,
  './js/ai.js?v=' + CACHE_TIMESTAMP,
  './js/game.js?v=' + CACHE_TIMESTAMP,
  './js/tutorial.js?v=' + CACHE_TIMESTAMP,
  './js/secrets.js?v=' + CACHE_TIMESTAMP,
  './GODOT_EXPORT.md?v=' + CACHE_TIMESTAMP,
  // Entities
  './js/entities/base.js?v=' + CACHE_TIMESTAMP,
  './js/entities/player/PlayerBase.js?v=' + CACHE_TIMESTAMP,
  './js/entities/player/Kaoplayer.js?v=' + CACHE_TIMESTAMP,
  './js/entities/player/AutoPlayer.js?v=' + CACHE_TIMESTAMP,
  './js/entities/player/PoomPlayer.js?v=' + CACHE_TIMESTAMP,
  './js/entities/enemy.js?v=' + CACHE_TIMESTAMP,
  './js/entities/boss.js?v=' + CACHE_TIMESTAMP,
  './js/entities/boss_attacks.js?v=' + CACHE_TIMESTAMP,
  './js/entities/summons.js?v=' + CACHE_TIMESTAMP,
  // Systems
  './js/systems/WaveManager.js?v=' + CACHE_TIMESTAMP,
  './js/systems/ShopSystem.js?v=' + CACHE_TIMESTAMP,
  './js/systems/TimeManager.js?v=' + CACHE_TIMESTAMP,
  './js/systems/AdminSystem.js?v=' + CACHE_TIMESTAMP,
  // Audio Assets (no cache busting for large files)
  './assets/audio/menu.mp3',
  './assets/audio/battle.mp3',
  './assets/audio/boss.mp3',
  './assets/audio/glitch.mp3'
];

// 1. ติดตั้ง Service Worker และดึงไฟล์ทั้งหมดลง Cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        console.log('📦 [Service Worker] Caching all assets');
        const failedUrls = [];

        await Promise.all(
          urlsToCache.map(url =>
            cache.add(url).catch(() => {
              failedUrls.push(url);
            })
          )
        );

        if (failedUrls.length > 0) {
          console.warn('⚠️ [Service Worker] Some assets failed to precache:', failedUrls);
        }
      })
  );
  self.skipWaiting();
});

// 2. ลบ Cache เก่าทิ้งเมื่อมีการอัปเดตเวอร์ชันใหม่
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🧹 [Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. ดึงจาก Cache ก่อน ถ้าไม่มีให้ดึงจากเน็ต แล้วแอบเก็บลง Cache ไว้ใช้คราวหน้า (Runtime Caching)
self.addEventListener('fetch', event => {
  const { request } = event;

  // Skip requests that are not safe/valid for Cache API.
  if (request.method !== 'GET') return;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') return;

  event.respondWith(
    caches.match(request)
      .then(response => {
        // เจอในแคช -> ส่งคืนทันที (Offline First)
        if (response) {
          return response;
        }

        // ไม่เจอในแคช -> วิ่งไปดึงจากเน็ต
        return fetch(request).then(networkResponse => {
          // ตรวจสอบว่าไฟล์โหลดสมบูรณ์ไหม ถ้าสมบูรณ์ให้ก็อปปี้เก็บลงแคชด้วย
          if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                // แอบแคช Google Fonts หรือไฟล์ที่หลงลืมไว้แบบอัตโนมัติ
                return cache.put(request, responseToCache);
              })
              .catch(cacheError => {
                console.warn('⚠️ [Service Worker] Runtime cache put failed for:', request.url, cacheError);
              });
          }
          return networkResponse;
        }).catch(() => {
          console.warn('⚡ [Service Worker] Network & Cache failed for:', request.url);
          // (ถ้ามีหน้าจอแจ้งเตือนว่าออฟไลน์ สามารถใส่ลอจิกตรงนี้ได้ครับ)
        });
      })
  );
});