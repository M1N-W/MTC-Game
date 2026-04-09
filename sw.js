const CACHE_NAME = "mtc-cache-v3.41.18"; // Doc audit & Character UI updates

// รายชื่อไฟล์ทั้งหมดที่ต้องการโหลดเก็บไว้ในเครื่องผู้เล่น
// NOTE: No ?v= suffix here — URLs must match the actual requests from index.html.
// Cache-busting is handled by changing CACHE_NAME (triggers full SW reinstall).
const urlsToCache = [
  "./",
  "./index.html",
  "./css/main.css",
  "./js/config.js",
  "./js/firebase-bundle.js",
  "./js/systems/CloudSaveSystem.js",
  "./js/systems/LeaderboardUI.js",
  "./js/utils.js",
  "./js/audio.js",
  "./js/input.js",
  "./js/map.js",
  "./js/menu.js",
  "./js/effects.js",
  "./js/weapons.js",
  "./js/ui.js",
  "./js/game.js",
  "./js/tutorial.js",
  // AI System
  "./js/ai/UtilityAI.js",
  "./js/ai/EnemyActions.js",
  "./js/ai/SquadAI.js",
  "./js/ai/PlayerPatternAnalyzer.js",
  // Entities
  "./js/entities/base.js",
  "./js/entities/player/PlayerBase.js",
  "./js/entities/player/KaoPlayer.js",
  "./js/entities/player/AutoPlayer.js",
  "./js/entities/player/PoomPlayer.js",
  "./js/entities/player/PatPlayer.js",
  "./js/entities/enemy.js",
  "./js/entities/boss/boss_attacks_shared.js",
  "./js/entities/boss/boss_attacks_manop.js",
  "./js/entities/boss/boss_attacks_first.js",
  "./js/entities/boss/BossBase.js",
  "./js/entities/boss/ManopBoss.js",
  "./js/entities/boss/FirstBoss.js",
  "./js/entities/summons.js",
  // Systems
  "./js/systems/WaveManager.js",
  "./js/systems/ShopSystem.js",
  "./js/systems/TimeManager.js",
  "./js/systems/AdminSystem.js",
  "./js/systems/GameState.js",
  "./js/systems/WorkerBridge.js",
  "./js/VersionManager.js",
  // Rendering
  "./js/rendering/PlayerRenderer.js",
  "./js/rendering/BossRenderer.js",
];

// ── Helper: ดึงเลขเวอร์ชันจาก CACHE_NAME ─────────────────
function getVersion() {
  const match = CACHE_NAME.match(/mtc-cache-v(.+)/);
  return match ? match[1] : "unknown";
}

// 1. ติดตั้ง Service Worker และดึงไฟล์ทั้งหมดลง Cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log("📦 [Service Worker] Caching all assets");
      const failedUrls = [];

      await Promise.all(
        urlsToCache.map((url) =>
          cache.add(url).catch(() => {
            failedUrls.push(url);
          }),
        ),
      );

      if (failedUrls.length > 0) {
        console.warn(
          "⚠️ [Service Worker] Some assets failed to precache:",
          failedUrls,
        );
      }
    }),
  );
  self.skipWaiting();
});

// 2. ลบ Cache เก่าทิ้งเมื่อมีการอัปเดตเวอร์ชันใหม่
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("🧹 [Service Worker] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();

  // ✨ ส่ง version ไปบอกทุก tab ที่เปิดอยู่ทันทีหลัง activate
  const version = getVersion();
  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) =>
      client.postMessage({ type: "VERSION", version }),
    );
  });
});

// 3. ดึงจาก Cache ก่อน ถ้าไม่มีให้ดึงจากเน็ต แล้วแอบเก็บลง Cache ไว้ใช้คราวหน้า (Runtime Caching)
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip requests that are not safe/valid for Cache API.
  if (request.method !== "GET") return;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin")
    return;

  const requestUrl = new URL(request.url);
  if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:")
    return;

  event.respondWith(
    caches.match(request).then((response) => {
      // เจอในแคช -> ส่งคืนทันที (Offline First)
      if (response) {
        return response;
      }

      // ไม่เจอในแคช -> วิ่งไปดึงจากเน็ต
      return fetch(request)
        .then((networkResponse) => {
          // ตรวจสอบว่าไฟล์โหลดสมบูรณ์ไหม ถ้าสมบูรณ์ให้ก็อปปี้เก็บลงแคชด้วย
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === "basic" ||
              networkResponse.type === "cors")
          ) {
            const responseToCache = networkResponse.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => {
                // แอบแคช Google Fonts หรือไฟล์ที่หลงลืมไว้แบบอัตโนมัติ
                return cache.put(request, responseToCache);
              })
              .catch((cacheError) => {
                console.warn(
                  "⚠️ [Service Worker] Runtime cache put failed for:",
                  request.url,
                  cacheError,
                );
              });
          }
          return networkResponse;
        })
        .catch(() => {
          console.warn(
            "⚡ [Service Worker] Network & Cache failed for:",
            request.url,
          );
          // ── Offline fallback for navigation requests ──────────────
          if (request.mode === "navigate") {
            return caches.match("./").then((cached) => cached ||
              new Response(
                "<!DOCTYPE html><html lang='th'><head><meta charset='UTF-8'><title>MTC Game — Offline</title></head><body style='background:#0f172a;color:#94a3b8;font-family:sans-serif;text-align:center;padding-top:20vh'><h1>📡 Offline</h1><p>กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต</p></body></html>",
                { headers: { "Content-Type": "text/html; charset=utf-8" } },
              )
            );
          }
        });
    }),
  );
});

// ✨ ตอบกลับเมื่อ VersionManager.js ถามหา version (กรณี SW active อยู่แล้วตั้งแต่ต้น)
self.addEventListener("message", (event) => {
  if (event.data?.type === "GET_VERSION") {
    event.source.postMessage({ type: "VERSION", version: getVersion() });
  }
});
