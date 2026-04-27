# Walkthrough: MTC Roadmap Session History

อัปเดตล่าสุด: March 23, 2026

---

## สิ่งที่ดำเนินการไปแล้ว

### Session ล่าสุด — March 12, 2026 (Roadmap Phase 2.1 + 2.2)

**Phase 2.1 — Predictive AI Aiming ✅ COMPLETE**

ไฟล์ที่แก้:

- `js/ai/PlayerPatternAnalyzer.js` — เพิ่ม 2 methods:
  - `velocityEstimate()` — O(1), zero GC, อ่าน _posX/_posY ring buffer 2 samples ล่าสุด → {vx, vy} world units/sec
  - `predictedPosition(aheadSeconds=0.25)` — cap 0.5s, fallback null ถ้า _count < 2
- `js/entities/enemy.js` MageEnemy — MeteorStrike predictive aim + wave scaling:
  - lead: 0.15s→0.40s cap (wave 3+ only, guard _wave >= 3)
  - spread: 300→120 shrink
- `js/entities/enemy.js` Enemy — projectile predictive aim:
  - lead: 0.08s→0.25s cap (wave 4+ only)
- `js/entities/boss/ManopBoss.js` — ATTACK state chalk projectile:
  - phase1 lead 0.20s / phase2 lead 0.35s
  - _aimAngle จาก predictedPosition() แทน this.angle
- `js/entities/boss/boss_attacks_first.js` — 2 จุด:
  - ParabolicVolley.fire() — predictive aim ก่อน baseAngle (normal 0.28s / advanced 0.22s)
  - GravitationalSingularity TIDAL phase projectile — _tPred lead 0.18s

**Phase 2.2 — Elemental Reaction IGNITE+SLOW→SHATTER ✅ COMPLETE**

- `js/entities/player/AutoPlayer.js` _doVacuum():
  - Bug fix: enemy.isBurning/burnTimer/burnDps → enemy.igniteTimer/igniteDPS
  - (property เดิมไม่มีใน EnemyBase — ignite ไม่เคยทำงานมาตลอด)
- `js/entities/enemy.js` EnemyBase._tickShared() — เพิ่ม SHATTER reaction block:
  - Trigger: igniteTimer > 0 && (stickySlowMultiplier < 0.65 || stickyStacks >= 3)
  - Damage: igniteDPS × 2.5 burst, consume ignite
  - Stun: _shatterStunTimer = 0.4s →_aiMoveX/Y = 0 ก่อน AI tick
  - Anti-loop guard: _shatterUsed flag

**Phase 2.3 — KruFirst Multi-Phase State Machine ✅ COMPLETE**

- `js/entities/boss/FirstBoss.js` — เพิ่ม logic เปลี่ยนสถานะที่ 50% HP:
  - เซ็ต `isEnraged = true` และบัฟความเร็ว `moveSpeed *= 1.18`
  - ใช้ `playerAnalyzer.reset()` ทั้งในจังหวะ enraged และ derivation mode (HP < 40%) เพื่อรองรับผู้เล่นเปลี่ยนรูปแบบการเดินอ้างอิง
  - Enraged attack chain: โอกาส 45% ยิง `ParabolicVolley.fire()` ต่อหลังคาถา `SUVAT_CHARGE`

**Phase 3.1 — Hit-Stop & Dynamic Camera ✅ COMPLETE**

- `js/game.js` — เพิ่ม global `triggerHitStop(duration)`:
  - แก้ `GameState.hitStopTimer` ข้าม game loop ไม่ให้กระทบค่า delta time ลึกๆ
  - ไม่ดร็อประยะเวลาลงแฮกมี call ซ้อนกัน (ป้องกัน duration downgrade)
- `js/entities/player/AutoPlayer.js` — เพิ่ม `triggerHitStop(0.04)` ใน Wanchai Punch R-click และ L-click (Stand Rush) ตีติดคริ
- `js/entities/player/PatPlayer.js` — เพิ่ม `triggerHitStop(isCrit ? 0.09 : 0.07)` ใน Iaido Strike (R-click)

**Phase 1.2 — JSON-ready Wave Schedule Refactor ✅ COMPLETE**

- `js/config.js` — เพิ่ม `window.WAVE_SCHEDULE` constant เพื่อ decoupling ข้อมูล timing ออกจาก `BALANCE`
- `js/systems/WaveManager.js` — อัปเดต `_getWaveSchedule()` และ `startNextWave()` ให้ใช้ `WAVE_SCHEDULE`
- `js/game.js` — เปลี่ยนเงื่อนไข wave clear boss check ให้ใช้ `WAVE_SCHEDULE.bossWaves.includes()`
- **Risk Mitigation**: เปลี่ยนจาก async fetch มาเป็นโครงสร้าง in-memory ที่พร้อมโหลด JSON ในอนาคตเพื่อป้องกัน game crash ✅

**Phase 1.1 — ECS Migration: HealthComponent ✅ COMPLETE**

- `js/entities/base.js` — สร้าง `HealthComponent` คุม `hp/maxHp/dead/flash`
- `js/entities/enemy.js` & `js/entities/player/PlayerBase.js` — เชื่อมต่อระบบผ่าน Proxy getters:
  - ทำให้ call sites เดิม (`entity.hp`, `entity.dead`) ยังทำงานได้ปกติแต่เบื้องหลังรันผ่าน Component
  - แยก logic `tick()` และ `takeDamage()` ออกมาชัดเจน ลด Garbage Collection และ Code Coupling ✅

**Phase 1.2 — Data-Driven Config (JSON) Preparation ✅ COMPLETE**

- `js/systems/WaveManager.js` — เปลี่ยน Static set เป็น Dynamic (Lazy initialization):
  - สร้าง `_getWaveSchedule()` มาใช้แทนดึงข้อมูล Wave ต่างๆ
  - จัดการ `FOG_WAVES/SPEED_WAVES/DARK_WAVES` const เก่าหายครบ
  - อัปเดต `startNextWave()` fog/speed check ✅
  - อัปเดต `_startTrickle()` dark check ✅
- **Verify & Bug Scan**: ตรวจสอบโค้ดระบบ Boss domains (`boss_attacks_manop.js`, `boss_attacks_first.js`) และ Weapon/Projectile Reflect ของ `PatPlayer` (`weapons.js`) ข้อมูลสมบูรณ์ ไม่พบบัค

---

**Phase 1.3 — High-Impact Performance & Scoped Web Worker ✅ COMPLETE**

- `js/rendering/BossRenderer.js` — เพิ่ม `isOnScreen(200)` guards และ `ctx.shadowBlur = 0` เพื่อลดภาระ GPU จากการวาดวงแหวนแสงของบอสที่อยู่นอกจอ
- `js/map.js` — สลับการวาด (Throttling) `drawTerrain` circuit packets ให้ทำงานแบบข้ามเฟรม ช่วยประหยัด CPU
- `js/workers/analyzer-worker.js` & `js/systems/WorkerBridge.js` — แยก `PlayerPatternAnalyzer` แบบไร้พันธะ (Zero coupling) ไปคำนวณบน Web Worker พ้น Main Thread
- `js/game.js` & `index.html` — แทร็กโหลดและ Sync ข้อมูลกับ Web Worker ได้อย่างราบรื่น

---

### Session — March 23, 2026 (Firebase Spark, cloud save, leaderboard UI, campus map v3, docs)

**Online / persistence (Firebase Spark — ไม่บังคับ Cloud Functions)**

- `package.json` + `npm run build:firebase` → `js/firebase-bundle.js` จาก `js/firebase-init.js` (Auth anonymous + Google link/popup, Firestore, Analytics, Remote Config)
- `js/systems/CloudSaveSystem.js` — ซิงก์ `mtc_save_v1` + tutorial flag ไป `users/{uid}`; เรียกจาก `utils.js` / `tutorial.js`
- `js/systems/LeaderboardUI.js` + ปุ่มใน `index.html` / `css/main.css` — Google sign-in row + modal; ส่งคะแนนผ่าน Firestore ภายใต้ `firestore.rules` (ลง Google แล้วเท่านั้น)
- `firestore.rules`, `firebase.json`, `.firebaserc`, `GITHUB_PAGES_FIREBASE.md` — deploy กฎด้วย `firebase deploy --only firestore:rules`; โฟลเดอร์ `functions/` เป็นของอ้างอิงถ้าอัปเกรด Blaze ภายหลัง

**Campus map generation (v3)**

- `js/map.js` — `_isClearZone()` กันวางวัตถุทับ spawn / citadel / database / shop / gate gaps; `createCluster()` แบบ center-anchored grid + jitter
- `js/config.js` — `BALANCE.map.objectSizes` สำหรับ footprint ตอน generate

**เอกสารสถาปัตย์ / a11y**

- `Markdown Source/Information/PROJECT_OVERVIEW.md` + `.agents/skills/mtc-game-skills_claude/SKILL.md` — load order รวม Firebase prelude; สรุป `MapSystem` generation
- `index.html` — viewport ปรับให้สอด accessibility linter (อนุญาต zoom); `mtc-game-conventions.md` ชี้ไป `SKILL.md`

**Release:** `sw.js` / `CHANGELOG.md` — v3.38.8 (ดู changelog สำหรับรายการไฟล์เต็ม)

---

## 💡 Future Ideas (Phase 2.x - Gameplay Features)

**Option 1 — New Enemy Type (High-Impact)**
- **The Healer**: A coward support unit that uses `UtilityAI` to find `nearbyAllies` with low HP and heal them. This adds Target Prioritization mechanics for the player.
- **The Sniper**: A ranged unit that constantly maintains a ~400px distance and fires highly accurate shots utilizing the new `PlayerPatternAnalyzer` prediction math. Requires the player to actively dash and dodge rather than just kiting.

---

## Next Session — คิวถัดไป (สอด `COMPREHENSIVE_DEVELOPMENT_PLAN.md`)

> HealthComponent + `WAVE_SCHEDULE` + JSON-prep ทำแล้ว — **ไม่**เปิดซ้ำเป็น “Option A/B” เดิม

### 1) Performance (วัดก่อนแก้)

- อ่าน `Markdown Source/Successed-Plan/PERF_PLAN.md` — ส่วน **W1** (`weapons.js` / `SpatialGrid`) และไฟล์ที่ยัง **not yet audited** (`game.js`, `ui.js`, `summons.js`, boss attacks)
- ใช้ `Debug.html` + Chrome Performance/Memory ยืนยันคอขวดก่อน OffscreenCanvas / particle pooling

### 2) UX / engagement

- FTUE safety zone, dynamic camera ช่วง Domain Expansion, ปุ่ม feedback export JSON — ตามแผนฉบับรวม; ไฟล์หลัก `tutorial.js`, `game.js`, `config.js` (สตริง/UI)

### 3) Content pipeline

- โหลด `waves.json` / แยก data จาก `config.js` — **หลัง** มี loading gate ที่ไม่ทำให้ boot พัง (สอด `WAVE_SCHEDULE` ที่มีอยู่)

### 4) QA / automation

- Playwright stress (Wave 15+) — หลังมีสคริปต์/CI

**ขั้นตอนเปิดเซสชันกับ AI**

1. อัปโหลด `PROJECT_OVERVIEW.md`, `SKILL.md` (โฟลเดอร์ `.agents/skills/mtc-game-skills_claude/`), และจาก `Markdown Source/Successed-Plan/`: `claude_master_prompt.md`, `walkthrough.md`, `COMPREHENSIVE_DEVELOPMENT_PLAN.md`
2. วาง prompt จาก `claude_master_prompt.md` ส่วนที่ 2
3. แนบไฟล์โค้ดตามหัวข้อคิวด้านบนที่จะทำในรอบนั้น

---

## Key Patterns สำหรับเซสชันถัดไป

Predictive aim pattern (ใช้ซ้ำได้):

```js
const _pred = (typeof playerAnalyzer !== 'undefined')
    ? playerAnalyzer.predictedPosition(LEAD_SECONDS)
    : null;
const aimX = _pred ? _pred.x : player.x;
const aimY = _pred ? _pred.y : player.y;
```

SHATTER reaction อยู่ใน EnemyBase._tickShared() หลัง ignite DoT block แล้ว
Fallback ทุกจุด: typeof playerAnalyzer !== 'undefined' guard เสมอ

---

## Previous Session History

### Session ก่อนหน้า (Gemini)

- วิเคราะห์ config.js (1700+ lines monolithic)
- สร้าง Master Prompt template
- วางแผน Phase 1.1 (ECS) และ Phase 2.1 (AI Prediction)
