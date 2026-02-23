const CACHE_NAME = 'mtc-cache-v2.5'; // ⚠️ เปลี่ยนเลขเวอร์ชันตรงนี้ทุกครั้งที่มีการอัปเดตเกม, v2.5 harden fetch/runtime caching guards

// รายชื่อไฟล์ทั้งหมดที่ต้องการโหลดเก็บไว้ในเครื่องผู้เล่น
const urlsToCache = [
  './',
  './index.html',
  './favicon.svg',
  './js/config.js',
  './js/utils.js',
  './js/audio.js',
  './js/input.js',
  './js/map.js',
  './js/effects.js',
  './js/weapons.js',
  './js/ui.js',
  './js/ai.js',
  './js/game.js',
  './js/tutorial.js',
  './js/secrets.js',
  // Entities
  './js/entities/base.js',
  './js/entities/player/PlayerBase.js',
  './js/entities/player/Kaoplayer.js',
  './js/entities/player/AutoPlayer.js',
  './js/entities/player/PoomPlayer.js',
  './js/entities/enemy.js',
  './js/entities/boss.js',
  './js/entities/boss_attacks.js',
  './js/entities/summons.js',
  // Systems
  './js/systems/WaveManager.js',
  './js/systems/ShopSystem.js',
  './js/systems/TimeManager.js',
  './js/systems/AdminSystem.js',
  // Audio Assets
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