# MTC Game — Rendering Remaster Plan (Canvas-First + Tailwind UI)

**ฉบับร่าง:** มีนาคม 2026  
**เป้าหมายหลัก:** ปลดล็อกการ “เพิ่มฟีเจอร์ / ปรับกราฟฟิค” ให้เร็วขึ้นอย่างเป็นระบบ โดยคงระบบเกมเดิม (Gameplay/AI/Systems) ไว้ให้มากที่สุด

---

## 0) Executive Summary

โปรเจกต์ปัจจุบันแข็งแรงด้านระบบ (loop/state/AI/worker/devtools) แต่ติดคอขวดที่ “การ author งานภาพ” เพราะ renderer มีโค้ดวาดแบบ hardcode ยาวมากและกระจายหลายไฟล์ ส่งผลให้:

- แก้ภาพ 1 จุดต้องแตะหลายส่วน, เสี่ยง regression สูง
- AI ตามบริบทไม่ทันง่าย เพราะการเปลี่ยนแปลงเล็ก ๆ ถูกซ่อนในไฟล์ขนาดใหญ่

แผนนี้เสนอ “Remaster แบบค่อยเป็นค่อยไป” ด้วยหลัก:

- **Canvas-first:** ไม่เปลี่ยนเอนจินทั้งเกม
- **Asset-driven + Tokens:** ย้ายภาระ “รูปร่าง/สี/สไตล์” ออกจากโค้ดวาดยาว ๆ
- **Refactor-by-slice:** ย้ายทีละตัวละคร/ศัตรู/เอฟเฟกต์ ด้วยเกณฑ์วัดผลชัด
- **Tailwind เฉพาะ UI DOM:** ใช้กับ overlay/modal เพื่อสปีดงาน UI โดยไม่แตะ core loop

---

## 1) เป้าหมายที่วัดผลได้ (Success Metrics)

### 1.1 เวลาในการทำงาน (Developer Velocity)

- เปลี่ยน “ธีมสีหลัก/ความหนาเส้น/ความแรง glow” ได้จากไฟล์เดียวและเห็นผลในทั้งเกม
- เพิ่ม/แก้ “เอฟเฟกต์ 1 แบบ” โดยแก้ไม่เกิน 1–2 ไฟล์หลัก และไม่ต้องค้นหาจากไฟล์ renderer ยาว ๆ
- ทำ “สกิน/ลุค” สำหรับตัวละคร 1 ตัวได้ภายใน 2–4 ชั่วโมง (หลังระบบพร้อม)

### 1.2 คุณภาพและเสถียรภาพ

- เฟรมเรต 60 FPS บน Desktop และมือถือระดับกลาง (เทียบ baseline ปัจจุบัน)
- ไม่มี GC spikes ที่เกิดจากการสร้าง object ใหม่ใน draw/update loop
- Regression ในภาพ/เอฟเฟกต์ต้องตรวจจับได้ด้วย “ชุด checklist + debug toggles”

### 1.3 โครงสร้างที่ทำให้คุยกับ AI ง่าย

- ทุก renderer ใหญ่ต้องมี “entry points” ที่ชัด: draw(entity, ctx) → drawParts(…)
- เปลี่ยนแปลงงานภาพถูกทำใน “ไฟล์เล็ก” ที่ชื่อสะท้อนส่วนประกอบ/เอฟเฟกต์

---

## 2) ขอบเขตงาน (Scope)

### 2.1 In-Scope (ทำใน Remaster)

- ย้ายการกำหนดสไตล์ (สี, shadow, glow, lineWidth, alpha, blend) ไปเป็น “tokens” กลาง
- ทำระบบ “visual parts / presets” สำหรับตัวละครและบอส โดยไม่พัง dispatcher เดิม
- ทำเอฟเฟกต์ให้เป็นโมดูลย่อยมากขึ้น และมีคอนฟิกที่แก้ได้ง่าย
- ปรับ UI DOM (เช่น Shop/Admin Console/Loading overlay) ให้แก้ง่ายขึ้นด้วย Tailwind

### 2.2 Out-of-Scope (ไม่ทำในเฟสนี้)

- เปลี่ยนเอนจินเป็น Three.js ทั้งเกม
- เปลี่ยนสถาปัตยกรรม core loop/AI/workers ครั้งใหญ่
- ย้ายระบบ collision/physics ใหม่ทั้งหมด

---

## 3) จุดคอขวดปัจจุบัน (Pain Points)

### 3.1 Renderer ไฟล์ใหญ่และ hardcode

- ตัวอย่างไฟล์ที่มักเป็นคอขวด:
  - `js/rendering/AutoRenderer.js`
  - `js/rendering/BossRenderer.js`
  - `js/rendering/PlayerRenderer.js` (dispatcher + shared helpers)
- ลักษณะปัญหา: รูปร่าง/สี/พฤติกรรมการวาดปะปนกัน ทำให้ “แก้ลุค” เท่ากับ “แก้ logic วาด” ที่ยาวและเสี่ยง

### 3.2 Global state + script-order coupling

- ระบบมี dependency ตามลำดับโหลด (เหมาะกับ Vanilla) แต่ทำให้การแยกโมดูล/ทดสอบ/ย้ายไฟล์ทำได้ยาก
- แผนนี้จะไม่แก้เรื่องนี้ทั้งหมด แต่จะทำให้ “งานภาพ” ถูกแยกเป็นส่วน ๆ ที่ปลอดภัยขึ้น

---

## 4) แนวทางเทคนิค (Technical Direction)

### 4.1 Visual Tokens (Single Source of Truth)

สร้างชุด token กลางสำหรับงานภาพ เช่น:

- palette: primary/accent/danger/heal
- stroke widths: outline/body/detail
- glow profiles: soft/strong/critical
- shadow presets: ambient/hitFlash/aura

หลักการ:

- renderer ห้าม hardcode สีซ้ำ ๆ แบบกระจัดกระจาย
- renderer ต้องอ่านค่าจาก token และอนุญาต override ต่อ character/skin

### 4.2 Asset-Driven Rendering (ไม่จำเป็นต้องเป็น sprite อย่างเดียว)

ย้ายการกำหนด “รูปร่าง” ไปเป็นรูปแบบที่แก้ได้ง่ายกว่าโค้ดยาว:

- Path2D presets (เหมาะกับ performance และยังอยู่ใน Canvas)
- SVG paths/portraits ที่แปลงเป็น Path2D หรือ pre-render เป็น bitmap cache
- Optional: spritesheet เฉพาะส่วนที่ซับซ้อน (แต่ต้องมีข้อกำหนดขนาดไฟล์/การ cache)

แนวคิดสำคัญ:

- แยก “model” (ข้อมูลรูปร่าง/part) ออกจาก “renderer” (วาดด้วย token + animation params)

### 4.3 Render Parts + Composition

แทนที่จะมีฟังก์ชันวาดยาว ๆ ให้แตกเป็นชิ้น:

- parts: head, body, arms, weapon, aura, trails
- overlays: hit flash, shield, low-hp glow
- effects: afterimage, particles, shockwave

ข้อกำหนด:

- ทุก part ต้องเป็น pure draw (ไม่มี side effects ต่อ state เกม)
- ต้องใช้ ctx.save()/restore() อย่างเป็นระบบใน boundary ของ part เท่านั้น

### 4.4 Performance Contract

กฎที่ต้องรักษาเพื่อ 60 FPS:

- ห้าม `new` ใน draw loop (ยกเว้นระหว่าง init หรือ cache warmup)
- ใช้ cache (OffscreenCanvas/bitmap) สำหรับ static parts ตาม pattern ที่มีอยู่แล้ว
- ใช้ viewport culling ตามที่ระบบทำอยู่

---

## 5) แผนงานแบบเป็นเฟส (Phased Roadmap)

### Phase 0 — Baseline + Guardrails (0.5–1 วัน)

Deliverables:

- บันทึก baseline: FPS เฉลี่ย/ต่ำสุดในสถานการณ์หนัก (เช่น wave สูง, boss fight)
- นิยาม “render budget” คร่าว ๆ: draw calls, particles cap, cache strategy
- สร้าง checklist สำหรับ regression (ภาพ, hit flash, aura, HUD, boss HP bar)

Acceptance Criteria:

- มี baseline ตัวเลขที่เทียบก่อน/หลังได้
- มี checklist ที่ใช้ตรวจทุกครั้งก่อน merge

### Phase 1 — Tokens & Styling Backbone (1–2 วัน)

Deliverables:

- ไฟล์ token กลาง (palette, glow, stroke, alpha)
- ตัวอย่างการนำ token ไปใช้จริง 1 จุด (เช่น shared helper ใน PlayerRenderer หรือ CombatEffects)

Acceptance Criteria:

- เปลี่ยน palette หลักแล้วเห็นผลในหลายส่วน โดยไม่ไล่แก้สีหลายไฟล์

### Phase 2 — Vertical Slice: 1 ตัวละคร (2–4 วัน)

เลือกตัวละครที่ “เจ็บสุด” (แนะนำ Auto เพราะ renderer ใหญ่มาก)
Deliverables:

- แตกการวาดเป็น parts
- ย้ายสี/สไตล์ไป token
- ทำ cache สำหรับ static parts ที่เหมาะสม

Acceptance Criteria:

- แก้ลุค 1 อย่าง (เช่น glow/outline/ธีมสี) โดยแก้ไฟล์น้อยลงอย่างชัดเจน
- FPS ไม่ตกจาก baseline เกิน 5%

### Phase 3 — Vertical Slice: 1 ศัตรู + 1 Boss Element (2–4 วัน)

Deliverables:

- ปรับ EnemyRenderer overlays ให้เป็นโมดูลย่อยและใช้ token
- ปรับส่วนของ BossRenderer ที่เป็น aura/overlay ให้เป็น preset

Acceptance Criteria:

- เพิ่ม/แก้ status overlay ใหม่ได้โดยไม่แตะโค้ดวาดตัวหลักยาว ๆ

### Phase 4 — Effects Modularization (2–5 วัน)

Deliverables:

- แยก effect ที่ซ้ำ pattern (shockwave, trails, sparks) เป็น factory/preset
- ใช้ object pool ตามระบบเดิม

Acceptance Criteria:

- ทำเอฟเฟกต์ใหม่ 1 แบบโดยเพิ่ม preset + hook จุดเดียว

### Phase 5 — Tailwind UI Migration (เลือกทำเมื่อพร้อม, 1–3 วัน)

Scope แนะนำ:

- Loading overlay, Shop modal, Prompt strips, Admin console layout

Acceptance Criteria:

- UI layout แก้ง่ายขึ้น (spacing/typography/theme) โดยไม่ต้องแก้ CSS ยาว ๆ
- ไม่กระทบ core loop และ input

---

## 5.1) แผนงานแบบ “เซสชัน” (Session-by-Session Plan)

นิยาม “1 เซสชัน” ในแผนนี้:

- 1 เซสชัน = 2–4 ชั่วโมง (โฟกัสงานเดียวให้จบเป็นชิ้นเล็ก ๆ)
- ทุกเซสชันต้องจบด้วย: เล่นได้จริง, ไม่ error, และเทียบ baseline ได้

ภาพรวมจำนวนเซสชัน (แนะนำ):

- **ขั้นต่ำ (Core Remaster): 10 เซสชัน** — ได้ tokens + refactor ตัวละคร 1 ตัว + ศัตรู 1 ตัว + effects 1 ชุด
- **รวม Tailwind UI: 12–13 เซสชัน** — เพิ่ม UI migration แบบไม่ทำลายระบบเดิม

### Session 1 — วัด baseline + เตรียม checklist (Phase 0)

เป้าหมาย: รู้ “ก่อนทำ/หลังทำ” ต่างกันแค่ไหน และมีกรอบกันพัง

- ไฟล์ที่แก้/ใช้ตรวจ:
  - `Debug.html` (ใช้เป็นหน้าวัด/สังเกต)
  - `js/game.js` (จุด render pipeline และตำแหน่งที่เหมาะกับ debug overlay)
  - `js/systems/AdminSystem.js` (มีคำสั่ง/overlay ที่ช่วยวัด เช่น fps toggle)
  - `js/effects/ParticleSystem.js`, `js/effects/WeatherSystem.js` (ตัวสร้าง load หนักที่ใช้เป็น stress case)
- Output ที่ต้องได้:
  - baseline: FPS เฉลี่ย/ต่ำสุดใน 3 สถานการณ์ (wave สูง, boss fight, particles หนา)
  - checklist regression 1 หน้า (ภาพสำคัญ + จุดที่มักพัง)

### Session 2 — วาง “Tokens” กลางสำหรับงานภาพ (Phase 1)

เป้าหมาย: เปลี่ยนสไตล์จากจุดเดียวได้จริง

- ไฟล์ที่เพิ่ม/แก้:
  - เพิ่ม: `js/rendering/RenderTokens.js` (palette, stroke, glow, alpha presets)
  - แก้: `index.html` (เพิ่ม script tag ให้โหลด token ก่อน renderer อื่น ๆ)
  - แก้ (ชั่วคราว): `js/rendering/PlayerRenderer.js` (นำ token ไปใช้กับ shared helper อย่างน้อย 1 จุด)
- Output ที่ต้องได้:
  - เปลี่ยนสีหลักใน token แล้วเห็นผลอย่างน้อย 2–3 จุดทันที (เช่น shield/low-hp glow/level badge)

### Session 3 — ทำ “Token Adoption” เพิ่มอีก 2 จุด (Phase 1)

เป้าหมาย: ให้ tokens ครอบคลุมของที่แก้บ่อยจริง

- ไฟล์ที่แก้:
  - `js/rendering/PlayerRenderer.js` (shared helpers เพิ่มเติม)
  - `js/rendering/BossRenderer.js` (aura/HP bar สีและ glow profiles)
  - `js/effects/CombatEffects.js` (สี crit/damage/heal ให้ใช้ palette)
- Output ที่ต้องได้:
  - “ธีมสี” เปลี่ยนแล้ว consistent ระหว่าง player/boss/effects

### Session 4 — เลือกตัวละครเป้าหมาย + แตกส่วนเป็น Parts (Phase 2)

เป้าหมาย: เริ่ม refactor แบบไม่แตะระบบอื่น

- ไฟล์ที่แก้:
  - `js/rendering/AutoRenderer.js` (เริ่มแยกฟังก์ชันเป็น part-level เช่น drawBody/drawArms/drawFace)
  - `js/rendering/PlayerRenderer.js` (dispatcher ต้องยังเรียก AutoRenderer ได้เหมือนเดิม)
- ไฟล์ที่เพิ่ม (แนะนำ ถ้าต้องการแตกไฟล์จริง):
  - เพิ่ม: `js/rendering/auto/AutoParts.js` (รวม parts) หรือ `js/rendering/auto/parts/*.js` (ถ้าจะแยกละเอียด)
  - แก้: `index.html` (script order สำหรับไฟล์ใหม่)
- Output ที่ต้องได้:
  - Auto ยังวาดได้เหมือนเดิม แต่โค้ดถูกแบ่งเป็นส่วน ๆ และแต่ละส่วนอ่าน token ได้

### Session 5 — ใส่ Cache สำหรับ static parts ของตัวละคร (Phase 2)

เป้าหมาย: ลดภาระการวาดซ้ำของส่วนที่ไม่ต้อง recompute ทุกเฟรม

- ไฟล์ที่แก้:
  - `js/rendering/AutoRenderer.js` หรือ `js/rendering/auto/AutoParts.js` (สร้าง OffscreenCanvas cache เฉพาะส่วนที่ static)
  - `js/rendering/PlayerRenderer.js` (ถ้าต้องเพิ่ม helper สำหรับ cache)
- Output ที่ต้องได้:
  - FPS ไม่ตกจาก baseline และมีแนวโน้มดีขึ้นในฉากที่มี Auto เอฟเฟกต์เยอะ

### Session 6 — ทำ “Skin Hooks” (Phase 2)

เป้าหมาย: เปลี่ยนลุค Auto แบบเป็นระบบ โดยไม่แก้โค้ดวาดยาว

- ไฟล์ที่เพิ่ม/แก้:
  - เพิ่ม: `js/rendering/Skins.js` หรือ `js/rendering/RenderSkins.js` (skin presets ที่ override token บางส่วน)
  - แก้: `js/systems/GameState.js` (เพิ่ม field สำหรับเลือก skin ต่อ character หรือเก็บใน save)
  - แก้: `js/utils.js` (ถ้ามี save/load helper ที่ต้องขยาย)
  - แก้: `index.html` (script order)
- Output ที่ต้องได้:
  - สลับ skin แล้วเปลี่ยน palette/glow/outline ได้ทันทีโดยไม่แตะ renderer หลัก

### Session 7 — ศัตรู 1 ตัว: ย้าย overlay ให้เป็นโมดูล + ใช้ token (Phase 3)

เป้าหมาย: เพิ่ม/แก้ status effect ง่ายขึ้น

- ไฟล์ที่แก้:
  - `js/entities/enemy.js` (ส่วน EnemyRenderer.\_drawStatusOverlays ให้แยกเป็นฟังก์ชัน/โมดูลย่อยและใช้ token)
  - `js/effects/CombatEffects.js` (สีและรูปแบบ damage/status ให้เข้ากับ overlay)
- ไฟล์ที่เพิ่ม (ทางเลือก):
  - เพิ่ม: `js/rendering/enemy/EnemyOverlays.js`
  - แก้: `index.html`
- Output ที่ต้องได้:
  - เพิ่ม overlay ใหม่ 1 แบบ (เช่น “slow/freeze ring”) ได้โดยแก้ไฟล์น้อยและไม่แตะ body draw

### Session 8 — Boss element 1 ชิ้น: ทำ preset สำหรับ aura/overlay (Phase 3)

เป้าหมาย: ทำให้ boss visuals ไม่ต้องแก้โค้ดยาวทุกครั้ง

- ไฟล์ที่แก้:
  - `js/rendering/BossRenderer.js` (ดึงสี/strength/params ไปเป็น preset)
  - `js/rendering/RenderTokens.js` (เติม boss palette/glow profile ถ้าจำเป็น)
- ไฟล์ที่เพิ่ม (ทางเลือก):
  - เพิ่ม: `js/rendering/boss/BossPresets.js`
  - แก้: `index.html`
- Output ที่ต้องได้:
  - เปลี่ยน “ธีม aura ต่อ phase” ได้จาก preset มากกว่าแก้โค้ดวาดยาว ๆ

### Session 9 — Effects modularization: เลือก 1 pattern แล้วทำเป็น preset/factory (Phase 4)

เป้าหมาย: ทำเอฟเฟกต์ใหม่ได้ไวด้วยการเพิ่ม preset

- ไฟล์ที่แก้/เพิ่ม:
  - `js/effects.js` (ถ้าเป็นจุดรวม pool/factory)
  - `js/effects/VisualPolish.js` (รวม effect ที่เป็น polish)
  - เพิ่ม: `js/effects/EffectPresets.js` (preset configs)
- Output ที่ต้องได้:
  - สร้าง effect แบบใหม่ 1 ชิ้น (เช่น shockwave preset ใหม่) โดยเพิ่ม config + เรียก factory 1 จุด

### Session 10 — ทำ Regression Pass + ปิดหนี้เทคนิค (Phase 4)

เป้าหมาย: ให้ระบบใหม่ “เสถียร” และใช้งานซ้ำได้

- ไฟล์ที่แก้ (ตามผลทดสอบ):
  - `js/game.js` (ถ้าเจอ state leak หรือ draw order issue)
  - `js/rendering/PlayerRenderer.js`, `js/rendering/ProjectileRenderer.js` (ถ้าเจอ ctx state ไม่ถูก reset)
  - `js/effects/ParticleSystem.js` (ถ้า particle thinning/LOD ต้องจูน)
- Output ที่ต้องได้:
  - ผ่าน checklist regression ทั้งหมด และ performance อยู่ในงบที่ตั้งไว้

### Session 11 — Tailwind เริ่มจาก “Loading overlay + prompts” (Phase 5, optional)

เป้าหมาย: ให้เห็นผลเร็วโดยไม่แตะระบบเกม

- ไฟล์ที่แก้:
  - `index.html` (classnames ของ loading/prompt elements)
  - `css/main.css` (คงไว้เฉพาะส่วนที่ต้องใช้จริง หรือทำเป็น bridge ชั่วคราว)
- ไฟล์ที่เพิ่ม (เลือกแนวทางใดแนวทางหนึ่ง):
  - แนวทาง A (เร็วสุด): ใช้ Tailwind CDN ใน `index.html` (ไม่มี build step)
  - แนวทาง B (คุม bundle): เพิ่ม toolchain สำหรับ build Tailwind (จะกระทบ workflow มากกว่า)
- Output ที่ต้องได้:
  - ปรับ spacing/typography/theme ของ loading/prompt ได้เร็วขึ้นโดยไม่แก้ CSS เยอะ

### Session 12 — Tailwind กับ “Shop + Admin Console layout” (Phase 5, optional)

เป้าหมาย: ลดความยากของ UI งานหนักและเปลี่ยน layout ได้ไว

- ไฟล์ที่แก้:
  - `index.html` (ส่วน shop modal + admin console markup)
  - `js/ui/ShopManager.js` (ถ้ามีการอ้าง className หรือสร้าง DOM)
  - `js/systems/AdminSystem.js` (ถ้ามี DOM class binding)
  - `css/main.css` (ลบ/ลดเฉพาะส่วนที่ถูกแทนด้วย Tailwind)
- Output ที่ต้องได้:
  - ปรับ layout ของ shop/admin console ได้โดยไม่แตะ CSS หลายสิบจุด

### Session 13 — Optional: ตัดสินใจ “ไป Hybrid/Three หรือไม่” (Decision Gate)

เป้าหมาย: ตัดสินใจด้วยข้อมูล ไม่ใช่ความรู้สึก

- สิ่งที่ต้องใช้ประกอบการตัดสินใจ:
  - เวลาจริงที่ใช้ “เพิ่มลุค/เอฟเฟกต์” หลัง Remaster เทียบก่อนหน้า
  - ความถี่ที่ยังต้องแก้ renderer ยาว ๆ และยังรู้สึกตัน
- ไฟล์ที่อาจแตะ (ถ้าจะเริ่ม Hybrid prototype):
  - `index.html` (เพิ่ม canvas/webgl layer แยก)
  - `js/game.js` (สลับ backend rendering เฉพาะ world layer)

## 6) วิธีทำงานให้ “คุยกับ AI ง่าย”

### 6.1 Contract สำหรับทุกงานภาพ

เวลาให้ AI ช่วย แบ่งงานเป็น 3 ชั้นเสมอ:

1. Token: เปลี่ยนสี/สไตล์จากจุดเดียว
2. Part: เปลี่ยนรูปร่างเฉพาะส่วน
3. Compose: จัดลำดับเลเยอร์ + เงื่อนไขการโชว์

### 6.2 กติกาการส่ง context ให้ AI

- ส่งเฉพาะ function/part ที่เกี่ยวข้อง 150–250 บรรทัด
- ระบุ “สิ่งที่ห้ามพัง” เช่น hit flash, aura, culling, cache
- ระบุ baseline/งบ performance ที่ต้องรักษา

---

## 7) ความเสี่ยงและการลดความเสี่ยง (Risk Mitigation)

- **เสี่ยง:** refactor renderer แล้วภาพเพี้ยน/เลเยอร์สลับ  
  **ลดเสี่ยง:** checklist + debug toggles + ทำทีละ slice
- **เสี่ยง:** performance ตกเพราะ draw ซับซ้อนหรือสร้าง object ใหม่  
  **ลดเสี่ยง:** enforce no-new-in-loop, ใช้ cache, จำกัด particle
- **เสี่ยง:** เปลี่ยนเยอะแล้ว AI สับสน  
  **ลดเสี่ยง:** ย่อยไฟล์เล็ก, ตั้งชื่อ part ชัด, ทำ contract คงที่

---

## 8) Decision Gate: เมื่อไหร่ค่อยพิจารณา Three.js

ทำ “ย้ายเป็น Three.js” เฉพาะเมื่อผ่านเงื่อนไข:

- Remaster แล้วแต่ยังแก้ภาพช้า เพราะต้องการ postprocessing/lighting เป็นแกน
- มี vertical slice ที่พิสูจน์ว่า workflow บน Three.js “เร็วกว่า” จริงในงานประจำวัน

แนวทางที่ปลอดภัยที่สุดถ้าจะเริ่ม:

- Hybrid: Three เฉพาะ world/effects (orthographic) + UI DOM/Tailwind
- คงระบบเกมเดิม (state, AI, collision) แล้วเปลี่ยนเฉพาะ renderer backend

---

## 9) Checklist ก่อนถือว่า “จบเฟส”

- FPS เทียบ baseline ไม่ตกเกินงบที่กำหนด
- ไม่เพิ่ม allocation ใน draw/update loop
- ภาพสำคัญยังถูกต้อง: hit flash, aura, shield, boss HP bar, HUD
- โค้ดงานภาพใหม่ถูกแบ่งเป็น part/preset และใช้ token กลาง
