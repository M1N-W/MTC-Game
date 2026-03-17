# MTC The Game — Active Backlog

**อัปเดต:** มีนาคม 2026 | สถานะ: หลัง Rendering Remaster (Sessions 1–13) + Option A Post-processing ✅

---

## 🔧 Performance (ยังไม่ได้ทำ)

- [ ] **SpatialGrid 32-bit integer keys** (`js/weapons/SpatialGrid.js`)
      ลด string allocation ~220 ครั้ง/เฟรม → `(x << 16) | y` แทน template literal key
      ไฟล์: `SpatialGrid.js` เดียว, ไม่กระทบ call sites

- [ ] **Boss attack particles → centralized pool** (`js/entities/boss/boss_attacks_manop.js`)
      หลาย attack class ยังใช้ `new Particle()` ตรงๆ → ย้ายเข้า `spawnParticles()` wrapper

- [ ] **Particle Thinning — auto-reduce count เมื่อ FPS < 55** (`js/effects/ParticleSystem.js`)
      อ่าน `PostProcessor._fpsAvg` (มีแล้ว) → ถ้า < 55 ลด `MAX_PARTICLES` ลง 50% อัตโนมัติ

---

## 🎮 Gameplay Features (ยังไม่ได้ทำ)

- [ ] **Enemy ใหม่: The Healer** (`js/entities/enemy.js`)

  - ใช้ UtilityAI `nearbyAllies` หา ally HP ต่ำ → heal
  - ผู้เล่นต้องจัดการ Target Priority
  - Load order: extends `EnemyBase`, เพิ่มใน `WAVE_SCHEDULE`

- [ ] **Enemy ใหม่: The Sniper** (`js/entities/enemy.js`)

  - รักษาระยะ ~400px จาก player
  - ใช้ `playerAnalyzer.predictedPosition(0.3)` aim
  - ต้องการ: dash/dodge จาก player เป็น counter

- [ ] **Dynamic Camera Zoom** ระหว่าง Domain Expansion (`js/game.js`)
  - zoom ออกเมื่อ `DomainExpansion.active` → เพิ่มความกดดัน
  - ใช้ camera.scale lerp ใน `updateCamera()`

---

## 🌟 Visual / Post-Processing (ต่อเนื่องจาก Session 13)

- [ ] **Option B — Dynamic Lighting overlay** (`js/game.js`, `js/map.js`)

  - radial gradient `overlay` blend รอบ player + boss
  - ดู `mapSystem.drawLighting()` ที่มีอยู่ก่อนเพื่อไม่ให้ซ้ำซ้อน
  - ไฟล์ที่ต้องอัปโหลด: `game.js`, `map.js`

- [ ] **ปรับ PostProcessor config** หลังทดสอบจริง
  - `bloomAlpha` (default 0.28) — ปรับได้ใน console: `PostProcessor.config.bloomAlpha = 0.4`
  - `vignetteAlpha` (default 0.55)
  - บันทึกค่าที่พอใจลง `GAME_CONFIG` เพื่อให้ persistent

---

## 🔭 Session 13 Decision Gate — ข้อสรุป

**คำตอบ: ยังไม่ไป Three.js**

เหตุผล:

1. ยังไม่มี baseline วัดผลหลัง Remaster
2. Option A bloom + Option B lighting ตอบโจทย์ visual ได้โดยไม่ต้อง migrate
3. ถ้าหลังทำ A+B แล้วยังรู้สึกตัน → พิจารณา **WebGL post-pass เดียว** (ไม่ใช่ full Three.js)

---

## 🗒️ สำหรับเซสชันถัดไป

**Enemy ใหม่:**
อัปโหลด: `js/entities/enemy.js` + `js/config/BalanceConfig.js` (สำหรับ WAVE_SCHEDULE)
