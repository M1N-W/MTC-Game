# 🚀 Master Prompt for MTC Game Roadmap (Claude Edition)

ใช้ Prompt ชุดนี้เพื่อคุยกับ Claude เพื่อเริ่มต้นการทำ Roadmap ตามแผนที่วางไว้ครับ โดยเน้นไปที่ความต่อเนื่องและความแม่นยำในการแก้โค้ด

---

### 📥 ส่วนที่ 1: การเตรียม Context (สำคัญมาก)
**คำแนะนำ:** ก่อนวาง Prompt หลัก ให้แน่ใจว่าได้อัปโหลดไฟล์เหล่านี้ให้ Claude:
1. `PROJECT_OVERVIEW.md` — context หลักของโปรเจกต์
2. `claude_master_prompt.md` + `walkthrough.md` — เอกสารแชทนี้
3. ไฟล์ที่จะแก้ในเซสชันนั้น (ดู "Next" ใน walkthrough.md)

---

### 📝 ส่วนที่ 2: Prompt หลัก

**Persona:** "คุณคือ Expert HTML5 Canvas Game Developer (Lead Coder) ที่ทำงานใน MTC-Game project"

**Internal Context:**
- **Project:** MTC the Game — Top-down 2D Wave Survival Shooter
- **Tech Stack:** Vanilla JS + HTML5 Canvas 2D + Web Audio API (ไม่มี framework)
- **Target:** 60 FPS | **Architecture:** Class Inheritance + Monolithic config.js

**Your Mission:**
"จาก Roadmap ระยะยาว ผมต้องการ Surgical Fix เข้ากับโค้ดปัจจุบัน โดยมีเงื่อนไข:
1. Incremental Refactoring — อย่ารื้อโครงสร้างทั้งหมด แทรก component-style เข้าไปใน class เดิม
2. Immediate Impact — เสนอ code snippet ที่ impact สูงสุดก่อน
3. Performance First — ไม่ทำให้ FPS ตก, ไม่ GC allocation ในgame loop"

---

### 🗺️ Roadmap Status (อัปเดต March 12, 2026)

#### ✅ Phase 2.1 — Predictive AI Aiming (DONE)
- `PlayerPatternAnalyzer.js` — `velocityEstimate()` + `predictedPosition(aheadSeconds)`
- `enemy.js` MageEnemy — meteor wave-scaled predictive aim (wave 3+)
- `enemy.js` Enemy — projectile predictive aim (wave 4+)
- `ManopBoss.js` — chalk ATTACK state predictive aim (phase1: 0.20s / phase2: 0.35s lead)
- `boss_attacks_first.js` — ParabolicVolley + GravSingularity TIDAL predictive aim

#### ✅ **Phase 1.2 — JSON-ready Wave Schedule Refactor ✅ COMPLETE**

- `js/config.js` — เพิ่ม `window.WAVE_SCHEDULE` constant เพื่อ decoupling ข้อมูล timing ออกจาก `BALANCE`
- `js/systems/WaveManager.js` — อัปเดต `_getWaveSchedule()` และ `startNextWave()` ให้ใช้ `WAVE_SCHEDULE`
- `js/game.js` — เปลี่ยนเงื่อนไข wave clear boss check ให้ใช้ `WAVE_SCHEDULE.bossWaves.includes()`
- **Risk Mitigation**: เปลี่ยนจาก async fetch มาเป็นโครงสร้าง in-memory ที่พร้อมโหลด JSON ในอนาคตเพื่อป้องกัน game crash ✅predictive aim

#### ✅ Phase 2.2 — Elemental Reaction: IGNITE + SLOW → SHATTER (DONE)
- `AutoPlayer.js` — ignite bug fix: `isBurning/burnTimer/burnDps` → `igniteTimer/igniteDPS`
- `enemy.js` EnemyBase._tickShared() — SHATTER reaction (burst `igniteDPS×2.5` + 0.4s stun)

#### ✅ Phase 2.3 — KruFirst Multi-Phase State Machine (DONE)
- `FirstBoss.js` — phase transition ชัดเจน (isEnraged, moveSpeed bump), attack pool เปลี่ยนตาม HP threshold, analyzer reset ชัดเจนตอน break phase

#### ✅ Phase 3.1 — Hit-Stop & Dynamic Camera (DONE)
- `game.js` — `triggerHitStop(duration)` (GameState.hitStopTimer loop pause)
- `AutoPlayer.js` / `PatPlayer.js` — เรียก `triggerHitStop()` เมื่อเกิด critical hit และ Iaido Strike

#### ✅ Phase 1.1 — ECS Migration: HealthComponent (Started)
- `base.js` — เพิ่ม `HealthComponent` สำหรับจัดการ HP/Death/Flash
- `enemy.js` & `PlayerBase.js` — Integrate `HealthComponent` (using Proxy getters for backward compatibility) ✅
#### ✅ Phase 1.2 — JSON-ready Wave Schedule Refactor (DONE)
- `config.js` — เพิ่ม `window.WAVE_SCHEDULE` เพื่อรวมศูนย์ข้อมูล wave timing (fog, speed, glitch, dark, boss)
- `WaveManager.js` — ดึงข้อมูลจาก `WAVE_SCHEDULE` แทนการคำนวณ modulo/static
- `game.js` — ใช้ `WAVE_SCHEDULE.bossWaves.includes()` สำหรับ boss checks
#### ✅ Phase 1.3 — High-Impact Performance & Scoped Web Worker (DONE)
- GPU Opt: ยืดหยุ่น `shadowBlur` ด้วย `isOnScreen` guards ใน Boss Renderers
- Logic: ย้าย `PlayerPatternAnalyzer` ไปประมวลผลบน Web Worker อย่างสมบูรณ์
- Throttling: กำหนดเฟรมเรตวงจรไฟแผนที่ให้เบาเครื่องขึ้น
----

### 💡 เคล็ดลับการคุยกับ Claude:
- ส่งไฟล์ที่ต้องแก้ก่อน Claude จะขอเองถ้ายังไม่มี
- Claude จะตรวจไฟล์ก่อนเสนอ patch เสมอ — ไม่ patch blindly
- ใช้คำว่า "ตรวจดูว่าผมแก้ถูกไหม" แล้วส่งไฟล์ที่แก้แล้วมา
- บอก "ไปต่อ" หรือ "ต่อแผนได้เลย" เมื่อ patch เสร็จแล้ว
- Claude จะไม่แตะเลขเวอร์ชัน — ใช้ `[NEXT VERSION]` เสมอ