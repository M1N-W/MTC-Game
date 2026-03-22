# MTC Game — แผนพัฒนาฉบับสมบูรณ์ (Comprehensive Development Plan)
**ฉบับปรับปรุง:** มีนาคม 2026 | **เป้าหมาย:** สู่สถานะ Production-Ready (60 FPS, เนื้อหาครบถ้วน, ประสบการณ์ผู้เล่นยอดเยี่ยม)

---

## 1. แผนพัฒนาประสิทธิภาพ (Performance Development Plan)
แผนการที่ต่อยอดจาก [PERF_PLAN.md](./PERF_PLAN.md) เพื่อให้เกมลื่นไหลตลอดเวลาแม้ใน Wave 15+

### เป้าหมาย (Benchmarks)
- **Frame Rate**: เสถียรที่ 60 FPS บนมือถือระดับกลาง (Snapdragon 700 series) และ Desktop สเปกต่ำ (Integrated Graphics)
- **Memory Usage**: ใช้ Heap สูงสุดไม่เกิน 150MB; ไม่มี Memory Leak ตลอดการเล่น 60 นาที
- **Loading Time**: โหลดเริ่มต้น (Initial Load) ต่ำกว่า 10 วินาที (ด้วย Asset Optimization + Service Worker Caching)

### ลำดับความสำคัญ (Optimization Milestones)
- **CPU (Milestone 1)**: ก่อนเปิดงาน refactor — อ่าน [PERF_PLAN.md](./PERF_PLAN.md) ส่วน **W1** (SpatialGrid / integer key) และเทียบกับ **SpatialGrid ที่มีอยู่แล้ว** ใน [`js/weapons.js`](../../js/weapons.js) (broadphase / คีย์แบบจำนวนเต็มตามคอมเมนต์ในโค้ด); ปิด milestone เฉพาะเมื่อสอดกับ PERF_PLAN และผลการวัดจริง
- **GPU (Milestone 2)**: ใช้ `OffscreenCanvas` เพื่อ cache ส่วนประกอบของร่างกายที่อยู่นิ่ง (static parts) ใน [`js/rendering/BossRenderer.js`](../../js/rendering/BossRenderer.js) และ [`js/rendering/PlayerRenderer.js`](../../js/rendering/PlayerRenderer.js) เพื่อลดการเรียกใช้ path rendering ที่ซับซ้อน — **หลัง** ยืนยันคอขวดด้วยโปรไฟล์
- **Memory (Milestone 3)**: ตรวจสอบและย้าย boss attack particles ทั้งหมดใน [`js/entities/boss/boss_attacks_manop.js`](../../js/entities/boss/boss_attacks_manop.js) เข้าสู่ centralized object pool ใน [`js/effects.js`](../../js/effects.js) — **หลัง** ยืนยัน allocation จริง

### การวัดผลและตรวจสอบ (Profiling & Monitoring)
- **เครื่องมือ**: ใช้ [`Debug.html`](../../Debug.html) เพื่อดูสุขภาพระบบแบบเรียลไทม์; ใช้ Chrome DevTools (Performance/Memory) สำหรับการตรวจสอบเชิงลึก
- **Automated Testing**: ใช้ Playwright/Puppeteer สคริปต์เพื่อทดสอบ "Wave 15 Stress Test" (100+ entities) และรายงานการตกของ FPS ในระบบ CI/CD
- **Success Criteria**: ไม่มี "Long Tasks" (>50ms) ระหว่างเปลี่ยน Wave; รักษา 60 FPS ได้แม้มีศัตรู 50+ ตัว และ particles 200+ ตัวพร้อมกัน

---

## 2. แผนเพิ่มพูนประสบการณ์การเล่น (Gaming Experience Enhancement Plan)
เน้นไปที่ความรู้สึกของผู้เล่นและการเข้าถึงได้ (Accessibility) เพื่อให้บอสคณิตศาสตร์/ฟิสิกส์มีความท้าทายที่น่าสนุก

### การปรับแต่ง User Journey
- **First-Time User Experience (FTUE)**: ปรับปรุง [`js/tutorial.js`](../../js/tutorial.js) ให้มี "Safety Zone" ใน 30 วินาทีแรกของ Wave 1
- **Boss Encounters**: เพิ่มระบบ Dynamic Camera Zooming ใน [`js/game.js`](../../js/game.js) ระหว่างการใช้ "Domain Expansion" ของ [`js/entities/boss/ManopBoss.js`](../../js/entities/boss/ManopBoss.js) เพื่อเพิ่มความกดดัน

### ตัวชี้วัดการมีส่วนร่วม (Player Engagement Metrics)
- **Retention**: ติดตาม "Wave 5 Dropout Rate" (เป้าหมาย < 15%) และ "Boss 1 Defeat Rate"
- **Session Length**: เป้าหมาย 15–20 นาทีต่อหนึ่งรอบการเล่นจนจบ

### การปรับปรุง UX/UI
- **Feedback Integration**: เพิ่มปุ่ม "Bug/Feedback" ในเกมที่สามารถ export [`js/systems/GameState.js`](../../js/systems/GameState.js) และค่า diagnostics ปัจจุบันเป็นไฟล์ JSON
- **Input Responsiveness**: เป้าหมาย input latency < 1 เฟรม (16.6ms); ปรับปรุงระบบ haptic ใน [`js/input.js`](../../js/input.js) สำหรับการ "Perfect Parry" เทียบกับการโดนโจมตีปกติ
- **Accessibility**: โหมด High-Contrast สำหรับ HUD; เปิด/ปิด Screen Shake ได้ใน [`js/config.js`](../../js/config.js); ระบบ "Auto-Aim" สำหรับผู้เล่นมือถือ

### Success Criteria
- คะแนนความพึงพอใจ (User Satisfaction) > 4.2/5; อัตราการกลับมาเล่นซ้ำ (D7 Retention) 40%

---

## 3. กลยุทธ์การอัปเดตและเนื้อหา (Update and Content Strategy Plan)
ออกแบบมาเพื่อให้เกมมีความสดใหม่อยู่เสมอโดยไม่กระทบโครงสร้างหลักที่เป็น Vanilla JS ตาม [`Markdown Source/Information/PROJECT_OVERVIEW.md`](../Information/PROJECT_OVERVIEW.md)

### สถาปัตยกรรม Content Pipeline
- **Data-Driven Entities**: ศัตรูและอาวุธใหม่ต้องถูกกำหนดใน [`js/config.js`](../../js/config.js) ภายใต้ `BALANCE` เพื่อให้การอัปเดตเนื้อหาแทบไม่ต้องแตะโค้ดหลัก
- **Modular AI**: ใช้ระบบ [`js/ai/UtilityAI.js`](../../js/ai/UtilityAI.js) เพื่อสร้างพฤติกรรมศัตรูใหม่ด้วยการปรับ "Personality Weights" ใน config

### กลยุทธ์การปรับใช้ (Deployment Strategy)
- **Versioning**: ยึดตามมาตรฐาน **Version Increment Criteria** ใน [`Markdown Source/Information/PROJECT_OVERVIEW.md`](../Information/PROJECT_OVERVIEW.md) (Major.Minor.Patch); ตัวเลขรีลีสจริงสอด [`CHANGELOG.md`](../CHANGELOG.md) และ `CACHE_NAME` ใน [`sw.js`](../../sw.js)
- **Seamless Updates**: ใช้ [`sw.js`](../../sw.js) ในการ cache เวอร์ชันใหม่เบื้องหลัง; แจ้งผู้เล่นให้อัปเดตเฉพาะเมื่ออยู่ในสถานะ `MENU` เท่านั้น
- **Rollback & Quality Gates**: มี `FORCE_CLEAR_CACHE` flag ใน `sw.js` เพื่อแก้ปัญหา client state เสียหาย; ทุกการอัปเดต Minor (+0.01.00) ต้องผ่านการตรวจสอบสุขภาพระบบจาก `Debug.html`

### Success Criteria
- Zero Downtime สำหรับการอัปเดต; อัตราความผิดพลาดของเวอร์ชันใน `sw.js` < 1%

### Online / Persistence (Firebase Spark)

- **ขอบเขต:** โปรเจกต์ตั้งใจใช้แผน **Spark** (ไม่บังคับ Cloud Functions สำหรับฟีเจอร์หลัก); รายละเอียดโดเมน GitHub Pages + ขั้นตอน deploy กฎ → [`GITHUB_PAGES_FIREBASE.md`](../../GITHUB_PAGES_FIREBASE.md)
- **ไคลเอนต์:** `js/firebase-init.js` (แหล่ง) → build เป็น `js/firebase-bundle.js`; Auth (anonymous + Google), Firestore, Analytics, Remote Config
- **เซฟคลาวด์:** [`js/systems/CloudSaveSystem.js`](../../js/systems/CloudSaveSystem.js) — merge ข้อมูล local กับเอกสาร `users/{uid}`; ต้องคิด **conflict / rollback** เมื่อ schema หรือกฎเปลี่ยน
- **ลีดเดอร์บอร์ด:** [`js/systems/LeaderboardUI.js`](../../js/systems/LeaderboardUI.js) + UI ใน `index.html` — เขียน/อ่านภายใต้ [`firestore.rules`](../../firestore.rules) (เช่น บังคับ signed-in สำหรับ submit)
- **Anti-cheat แบบเซิร์ฟเวอร์:** ถ้าต้องการภายหลัง แยกเป็น decision doc (มักต้อง Blaze + Functions); ไม่สมมติในแผนนี้

---

## 4. แผนพัฒนางานภาพ (Visual Development Plan)
กำหนดอัตลักษณ์ทางภาพที่สอดคล้องและมีประสิทธิภาพสูงสำหรับ "MTC Universe"

### รูปแบบศิลปะและข้อจำกัด (Art Style & Constraints)
- **Theme**: Neon-Glow Cyber-Educational. ใช้ `globalAlpha` ใน [`js/map.js`](../../js/map.js) และ solid hex strings เพื่อหลีกเลี่ยงภาระการจัดสรรหน่วยความจำ (allocation overhead) ระหว่างทำเอฟเฟกต์แสง
- **Technical Constraints**: ไม่ใช้ sprites ภายนอก; ทุกภาพวาดผ่าน Canvas API หรือใช้ `window.PORTRAITS` ใน [`js/ui.js`](../../js/ui.js) SVG strings เพื่อให้ขนาดไฟล์รวมเล็กมาก (< 5MB)

### การเพิ่มประสิทธิภาพ VFX
- **LOD Strategy**: ระบบ "Particle Thinning" ใน [`js/effects.js`](../../js/effects.js) — หาก FPS ต่ำกว่า 55 ให้ลดจำนวน particle สูงสุดลง 50% โดยอัตโนมัติ
- **Lighting Model**: ปรับมาตรฐานระบบ `punchLight` ใน `map.js` ให้ใช้ `OffscreenCanvas` ตัวเดียวสำหรับ world-light-mask ทั้งหมด

### ความสม่ำเสมอทางภาพ (Visual Consistency)
- **Shared Assets**: รวมพาเลทสีทั้งหมดไว้ใน `BALANCE.map.mapColors` ใน [`js/config.js`](../../js/config.js)
- **Platform Scaling**: ให้การปรับขนาด UI ใน [`js/ui.js`](../../js/ui.js) ใช้เปอร์เซ็นต์ของ `CANVAS.width` แทนค่าพิกเซลคงที่

### Success Criteria
- งานภาพแสดงผลได้เหมือนกันในทุก Browser (Chrome, Safari, Firefox); รักษา 60 FPS ได้แม้ในช่วงการใช้ "Domain Expansion" ที่มีเอฟเฟกต์เต็มหน้าจอ

---

## การจัดสรรทรัพยากรและความเสี่ยง (Resource & Risk Management)

- **การจัดสรรทรัพยากร**:
  - **Engineering (60%)**: การเพิ่มประสิทธิภาพ (Optimization) และระบบ AI
  - **Art/UX (30%)**: การขัดเกลา UI, การสร้าง SVG portrait และ VFX
  - **QA (10%)**: การทดสอบ Regression และการตรวจสอบสมดุล (Balance Audit)
- **การจัดการความเสี่ยง**:
  - **ความเสี่ยง**: ประสิทธิภาพลดลงบนมือถือ **การแก้ไข**: ใช้ viewport culling และ particle pooling อย่างเข้มงวด
  - **ความเสี่ยง**: ข้อมูลเซฟเสียหายระหว่างอัปเดตหรือ merge คลาวด์ **การแก้ไข**: localStorage แบบ version-gated + สำรองก่อนย้ายเวอร์ชัน; ผสานกับ **cloud merge** ใน `CloudSaveSystem` (meta key / rollback path); ทุกการเปลี่ยนกฎ Firestore ต้องทดสอบกับ [`firestore.rules`](../../firestore.rules) และไม่ทำลาย client ที่ออฟไลน์
- **ระเบียบการทำงานร่วมกัน**:
  - "Balance Sync" รายสัปดาห์เพื่อตรวจสอบการเปลี่ยนแปลงใน `BALANCE` config
  - การตรวจสอบโค้ด (Peer Review) สำหรับทุกการเปลี่ยนแปลงใน core [`js/game.js`](../../js/game.js) loop

---

## 5. คิวงานวิศวกรรม (ลำดับจากแผนนี้)

เรียงตามแรงกระทบและความเสี่ยงต่ำ — **แต่ละขั้นต้องมีเกต** ก่อนลงมือ:

| ลำดับ | โฟกัส | เกต (measurement / cross-check) |
|--------|--------|----------------------------------|
| **1** | **Performance** — PERF_PLAN ที่ยัง 🔲, โปรไฟล์ `game.js` / `ui.js` / `summons.js` / boss attacks; OffscreenCanvas / particle pool ตาม Milestone 2–3 | อ่าน [PERF_PLAN.md](./PERF_PLAN.md) + [`Debug.html`](../../Debug.html) / DevTools; ยืนยันคอขวดก่อน refactor |
| **2** | **UX / engagement** — FTUE safety, dynamic camera ช่วง Domain Expansion, feedback export JSON | สอดส่วน 2 ของเอกสารนี้ + ไฟล์ `tutorial.js` / `game.js` |
| **3** | **Content pipeline** — JSON สำหรับ wave / `BALANCE` หลัง `WAVE_SCHEDULE` | async fetch ต้องไม่ทำลาย boot; cross-check กับ `WaveManager` + walkthrough |
| **4** | **QA / automation** — Playwright stress Wave 15+ | หลังมีสคริปต์และ CI ชัด |
