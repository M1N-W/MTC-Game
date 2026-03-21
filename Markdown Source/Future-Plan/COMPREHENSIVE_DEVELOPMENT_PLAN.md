# MTC Game — แผนพัฒนาฉบับสมบูรณ์ (Comprehensive Development Plan)
**ฉบับปรับปรุง:** มีนาคม 2026 | **เป้าหมาย:** สู่สถานะ Production-Ready (60 FPS, เนื้อหาครบถ้วน, ประสบการณ์ผู้เล่นยอดเยี่ยม)

---

## 1. แผนพัฒนาประสิทธิภาพ (Performance Development Plan)
แผนการที่ต่อยอดจาก [PERF_PLAN.md](file:///c:/Mawin-Game/MTC-Game/Markdown%20Source/Successed-Plan/PERF_PLAN.md) เพื่อให้เกมลื่นไหลตลอดเวลาแม้ใน Wave 15+

### เป้าหมาย (Benchmarks)
- **Frame Rate**: เสถียรที่ 60 FPS บนมือถือระดับกลาง (Snapdragon 700 series) และ Desktop สเปกต่ำ (Integrated Graphics)
- **Memory Usage**: ใช้ Heap สูงสุดไม่เกิน 150MB; ไม่มี Memory Leak ตลอดการเล่น 60 นาที
- **Loading Time**: โหลดเริ่มต้น (Initial Load) ต่ำกว่า 10 วินาที (ด้วย Asset Optimization + Service Worker Caching)

### ลำดับความสำคัญ (Optimization Milestones)
- **CPU (Milestone 1)**: ทำ W1 SpatialGrid refactor ให้เสร็จ โดยใช้ 32-bit integer keys เพื่อลด string allocations ประมาณ 220 ครั้งต่อเฟรม
- **GPU (Milestone 2)**: ใช้ `OffscreenCanvas` เพื่อ cache ส่วนประกอบของร่างกายที่อยู่นิ่ง (static parts) ใน [BossRenderer.js](file:///c:/Mawin-Game/MTC-Game/js/rendering/BossRenderer.js) และ [PlayerRenderer.js](file:///c:/Mawin-Game/MTC-Game/js/rendering/PlayerRenderer.js) เพื่อลดการเรียกใช้ path rendering ที่ซับซ้อน
- **Memory (Milestone 3)**: ตรวจสอบและย้าย boss attack particles ทั้งหมดใน [boss_attacks_manop.js](file:///c:/Mawin-Game/MTC-Game/js/entities/boss/boss_attacks_manop.js) เข้าสู่ centralized object pool ใน [effects.js](file:///c:/Mawin-Game/MTC-Game/js/effects.js)

### การวัดผลและตรวจสอบ (Profiling & Monitoring)
- **เครื่องมือ**: ใช้ [Debug.html](file:///c:/Mawin-Game/MTC-Game/Debug.html) เพื่อดูสุขภาพระบบแบบเรียลไทม์; ใช้ Chrome DevTools (Performance/Memory) สำหรับการตรวจสอบเชิงลึก
- **Automated Testing**: ใช้ Playwright/Puppeteer สคริปต์เพื่อทดสอบ "Wave 15 Stress Test" (100+ entities) และรายงานการตกของ FPS ในระบบ CI/CD
- **Success Criteria**: ไม่มี "Long Tasks" (>50ms) ระหว่างเปลี่ยน Wave; รักษา 60 FPS ได้แม้มีศัตรู 50+ ตัว และ particles 200+ ตัวพร้อมกัน

---

## 2. แผนเพิ่มพูนประสบการณ์การเล่น (Gaming Experience Enhancement Plan)
เน้นไปที่ความรู้สึกของผู้เล่นและการเข้าถึงได้ (Accessibility) เพื่อให้บอสคณิตศาสตร์/ฟิสิกส์มีความท้าทายที่น่าสนุก

### การปรับแต่ง User Journey
- **First-Time User Experience (FTUE)**: ปรับปรุง [tutorial.js](file:///c:/Mawin-Game/MTC-Game/js/tutorial.js) ให้มี "Safety Zone" ใน 30 วินาทีแรกของ Wave 1
- **Boss Encounters**: เพิ่มระบบ Dynamic Camera Zooming ใน [game.js](file:///c:/Mawin-Game/MTC-Game/js/game.js) ระหว่างการใช้ "Domain Expansion" ของ [KruManop](file:///c:/Mawin-Game/MTC-Game/js/entities/boss/ManopBoss.js) เพื่อเพิ่มความกดดัน

### ตัวชี้วัดการมีส่วนร่วม (Player Engagement Metrics)
- **Retention**: ติดตาม "Wave 5 Dropout Rate" (เป้าหมาย < 15%) และ "Boss 1 Defeat Rate"
- **Session Length**: เป้าหมาย 15–20 นาทีต่อหนึ่งรอบการเล่นจนจบ

### การปรับปรุง UX/UI
- **Feedback Integration**: เพิ่มปุ่ม "Bug/Feedback" ในเกมที่สามารถ export [GameState.js](file:///c:/Mawin-Game/MTC-Game/js/systems/GameState.js) และค่า diagnostics ปัจจุบันเป็นไฟล์ JSON
- **Input Responsiveness**: เป้าหมาย input latency < 1 เฟรม (16.6ms); ปรับปรุงระบบ haptic ใน [input.js](file:///c:/Mawin-Game/MTC-Game/js/input.js) สำหรับการ "Perfect Parry" เทียบกับการโดนโจมตีปกติ
- **Accessibility**: โหมด High-Contrast สำหรับ HUD; เปิด/ปิด Screen Shake ได้ใน [config.js](file:///c:/Mawin-Game/MTC-Game/js/config.js); ระบบ "Auto-Aim" สำหรับผู้เล่นมือถือ

### Success Criteria
- คะแนนความพึงพอใจ (User Satisfaction) > 4.2/5; อัตราการกลับมาเล่นซ้ำ (D7 Retention) 40%

---

## 3. กลยุทธ์การอัปเดตและเนื้อหา (Update and Content Strategy Plan)
ออกแบบมาเพื่อให้เกมมีความสดใหม่อยู่เสมอโดยไม่กระทบโครงสร้างหลักที่เป็น [Vanilla JS](file:///c:/Mawin-Game/MTC-Game/Markdown%20Source/Information/PROJECT_OVERVIEW.md)

### สถาปัตยกรรม Content Pipeline
- **Data-Driven Entities**: ศัตรูและอาวุธใหม่ต้องถูกกำหนดใน [config.js](file:///c:/Mawin-Game/MTC-Game/js/config.js) ภายใต้ `BALANCE` เพื่อให้การอัปเดตเนื้อหาแทบไม่ต้องแตะโค้ดหลัก
- **Modular AI**: ใช้ระบบ [UtilityAI.js](file:///c:/Mawin-Game/MTC-Game/js/ai/UtilityAI.js) เพื่อสร้างพฤติกรรมศัตรูใหม่ด้วยการปรับ "Personality Weights" ใน config

### กลยุทธ์การปรับใช้ (Deployment Strategy)
- **Versioning**: ยึดตามมาตรฐาน [Version Increment Criteria](file:///c:/Mawin-Game/MTC-Game/Markdown%20Source/Information/PROJECT_OVERVIEW.md#L156) (Major.Minor.Patch)
- **Seamless Updates**: ใช้ [sw.js](file:///c:/Mawin-Game/MTC-Game/sw.js) ในการ cache เวอร์ชันใหม่เบื้องหลัง; แจ้งผู้เล่นให้อัปเดตเฉพาะเมื่ออยู่ในสถานะ `MENU` เท่านั้น
- **Rollback & Quality Gates**: มี `FORCE_CLEAR_CACHE` flag ใน `sw.js` เพื่อแก้ปัญหา client state เสียหาย; ทุกการอัปเดต Minor (+0.01.00) ต้องผ่านการตรวจสอบสุขภาพระบบจาก `Debug.html`

### Success Criteria
- Zero Downtime สำหรับการอัปเดต; อัตราความผิดพลาดของเวอร์ชันใน [sw.js](file:///c:/Mawin-Game/MTC-Game/sw.js) < 1%

---

## 4. แผนพัฒนางานภาพ (Visual Development Plan)
กำหนดอัตลักษณ์ทางภาพที่สอดคล้องและมีประสิทธิภาพสูงสำหรับ "MTC Universe"

### รูปแบบศิลปะและข้อจำกัด (Art Style & Constraints)
- **Theme**: Neon-Glow Cyber-Educational. ใช้ [globalAlpha](file:///c:/Mawin-Game/MTC-Game/js/map.js#L180) และ solid hex strings เพื่อหลีกเลี่ยงภาระการจัดสรรหน่วยความจำ (allocation overhead) ระหว่างทำเอฟเฟกต์แสง
- **Technical Constraints**: ไม่ใช้ sprites ภายนอก; ทุกภาพวาดผ่าน Canvas API หรือใช้ [window.PORTRAITS](file:///c:/Mawin-Game/MTC-Game/js/ui.js) SVG strings เพื่อให้ขนาดไฟล์รวมเล็กมาก (< 5MB)

### การเพิ่มประสิทธิภาพ VFX
- **LOD Strategy**: ระบบ "Particle Thinning" ใน [effects.js](file:///c:/Mawin-Game/MTC-Game/js/effects.js) — หาก FPS ต่ำกว่า 55 ให้ลดจำนวน particle สูงสุดลง 50% โดยอัตโนมัติ
- **Lighting Model**: ปรับมาตรฐานระบบ [punchLight](file:///c:/Mawin-Game/MTC-Game/js/map.js#L190) ใน `map.js` ให้ใช้ `OffscreenCanvas` ตัวเดียวสำหรับ world-light-mask ทั้งหมด

### ความสม่ำเสมอทางภาพ (Visual Consistency)
- **Shared Assets**: รวมพาเลทสีทั้งหมดไว้ใน `BALANCE.map.mapColors` ใน [config.js](file:///c:/Mawin-Game/MTC-Game/js/config.js)
- **Platform Scaling**: ให้การปรับขนาด UI ใน [ui.js](file:///c:/Mawin-Game/MTC-Game/js/ui.js) ใช้เปอร์เซ็นต์ของ `CANVAS.width` แทนค่าพิกเซลคงที่

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
  - **ความเสี่ยง**: ข้อมูลเซฟเสียหายระหว่างอัปเดต **การแก้ไข**: ใช้ระบบ localStorage แบบ version-gated พร้อมสำรองข้อมูลอัตโนมัติก่อนย้ายเวอร์ชัน
- **ระเบียบการทำงานร่วมกัน**:
  - "Balance Sync" รายสัปดาห์เพื่อตรวจสอบการเปลี่ยนแปลงใน `BALANCE` config
  - การตรวจสอบโค้ด (Peer Review) สำหรับทุกการเปลี่ยนแปลงใน core [game.js](file:///c:/Mawin-Game/MTC-Game/js/game.js) loop
