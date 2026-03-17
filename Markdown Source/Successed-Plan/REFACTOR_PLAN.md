# แผนการ Refactor และแยกไฟล์ (Code Splitting Plan)

ไฟล์นี้จัดทำขึ้นเพื่อวางแผนการแยกไฟล์ JavaScript ขนาดใหญ่ในโปรเจคต์ **MTC The Game** เพื่อให้ง่ายต่อการดูแลรักษาและลดความซับซ้อนของโค้ด

## 📋 สรุปไฟล์ที่ต้องจัดการ (Top Priority)

| ไฟล์ต้นทาง                               | ขนาด (บรรทัด) | แผนการแยกส่วน                                                |
| :--------------------------------------- | :-----------: | :----------------------------------------------------------- |
| `js/rendering/PlayerRenderer.js`         |     5,276     | แยกตามตัวละคร (Kao, Auto, Poom, Pat)                         |
| `js/ui.js`                               |     2,619     | แยก Achievement, Shop, UI Manager, CanvasHUD                 |
| `js/weapons.js`                          |     2,612     | แยก Projectile, WeaponSystem, ProjectileManager, SpatialGrid |
| `js/effects.js`                          |     2,615     | แยก CombatEffects, EnvironmentEffects, ParticleSystems       |
| `js/entities/boss/boss_attacks_manop.js` |     2,082     | แยกตาม Phase ของบอส หรือกลุ่มท่าโจมตี                        |
| `js/config.js`                           |     1,912     | แยก BalanceConfig, GameStrings (Texts)                       |

---

## 🔍 รายละเอียดการแยกไฟล์แต่ละส่วน

### 1. Player Rendering (`js/rendering/`)

**เป้าหมาย**: ลดขนาดไฟล์ `PlayerRenderer.js` ที่ใหญ่ที่สุดในโปรเจคต์

- `KaoRenderer.js`: เก็บ `_drawKao`, `_drawKaoClone`
- `AutoRenderer.js`: เก็บ `_drawAuto`, `_drawWanchaiStand`
- `PoomRenderer.js`: เก็บ `_drawPoom`
- `PatRenderer.js`: เก็บ `_drawPat`
- `PlayerRenderer.js`: (ไฟล์เดิม) ทำหน้าที่เป็น Dispatcher และเก็บ Shared Utilities (Aura, Shield, Badge)

### 2. UI Systems (`js/ui.js`)

**เป้าหมาย**: แยก Logic ที่ไม่เกี่ยวข้องกันออกจากกัน

- `AchievementSystem.js`: คลาส `AchievementSystem` และ `AchievementGallery`
- `ShopManager.js`: คลาส `ShopManager` (DOM interaction)
- `UIManager.js`: การจัดการ HUD, Boss HP, Voice Bubbles
- `CanvasHUD.js`: การวาด UI บน Canvas (Minimap, Combo, Ammo)

### 3. Combat & Weapons (`js/weapons.js`)

**เป้าหมาย**: แยก Core Engine ของการยิงและกระสุน

- `Projectile.js`: คลาส `Projectile` และ Logic การเคลื่อนที่/ชน
- `WeaponSystem.js`: คลาส `WeaponSystem` (การจัดการอาวุธของ Kao)
- `ProjectileManager.js`: คลาส `ProjectileManager`
- `SpatialGrid.js`: คลาส `SpatialGrid` สำหรับ Optimization การตรวจจับการชน

---

## 🛠 ขั้นตอนการดำเนินการ (Workflow)

1.  **Backup**: ตรวจสอบว่า Code ปัจจุบันถูก Commit ลง Git เรียบร้อยแล้ว
2.  **Create New Files**: สร้างไฟล์ใหม่ในโฟลเดอร์ที่เหมาะสม
3.  **Move Code**: ย้าย Code จากไฟล์ใหญ่ไปไฟล์ใหม่ (ระมัดระวังเรื่อง "use strict" และ Global Variables)
4.  **Update index.html**: เพิ่ม `<script src="...">` ใน `index.html` ตามลำดับความสัมพันธ์ (Dependency)
    - _หมายเหตุ_: ต้องโหลดไฟล์ที่เป็น Base หรือ Utility ก่อนไฟล์ที่เรียกใช้งาน
5.  **Verification**: ทดสอบเล่นเกมและเช็ค Console Error

---

## ⚠️ ข้อควรระวัง (Dependencies)

เนื่องจากโปรเจคต์นี้เป็น Vanilla JavaScript ที่ใช้ Global Scope:

- **Load Order**: ลำดับการโหลดใน `index.html` สำคัญมาก หากไฟล์ B เรียกใช้ Class ในไฟล์ A, ไฟล์ A ต้องถูกโหลดก่อน
- **Circular Dependencies**: ระวังการเรียกใช้กันไปมาของ Class ที่แยกออกมา
- **Global Objects**: ตรวจสอบว่า `window.XXX` ถูกกำหนดค่าไว้อย่างถูกต้องเพื่อให้ไฟล์อื่นมองเห็น

---

## ✅ รายการตรวจสอบความถูกต้อง (Checklist)

- [✅] เกมเริ่มเล่นได้ตามปกติ (startGame ทำงาน)
- [✅ ] ตัวละครแต่ละตัววาดกราฟิกถูกต้อง (Renderer แยกส่วนทำงานได้)
- [✅ ] ระบบ UI (Achievement/Shop) เปิดปิดและใช้งานได้ปกติ
- [✅ ] กระสุนและการสร้างความเสียหายทำงานปกติ
- [✅ ] ไม่มี Error สีแดงใน Browser Console (F12)

---

_จัดทำเมื่อ: 2026-03-16_
