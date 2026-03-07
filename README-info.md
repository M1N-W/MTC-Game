<div align="center">

# 🎮 MTC the Game (Beta Edition)

**Survive the waves. Defeat the teachers. Master the madness.**

เกมแนว **Top-down 2D Wave Survival Shooter** สุดมันส์ที่พัฒนาด้วย HTML5 Canvas API และ Vanilla JavaScript ล้วนๆ (No Frameworks!)  
เอาชีวิตรอดจากกองทัพศัตรู 15 เวฟ และเผชิญหน้ากับบอสสุดโหดประจำภาควิชาคณิตศาสตร์และฟิสิกส์!

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5 Canvas](https://img.shields.io/badge/HTML5_Canvas-E34F26?style=flat-square&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
[![Status](https://img.shields.io/badge/Status-Beta-success?style=flat-square)]()
[![Engine](https://img.shields.io/badge/Engine-Custom_JS-blue?style=flat-square)]()

---

</div>

## 🌟 Key Features

* **🌊 15 Waves of Chaos:** ฝ่าด่านศัตรูที่ค่อยๆ แข็งแกร่งขึ้น พร้อมระบบ Wave Events สุดป่วน (Glitch Wave, Fog Wave, Speed Wave)
* **🛒 Roguelite Shop System:** สะสม Score เพื่อซื้อบัฟอัปเกรดตัวละคร (Damage, Speed, HP, Shield) ระหว่างเวฟ
* **⏱️ Bullet Time:** กด `T` เพื่อหน่วงเวลา 70% ให้คุณหลบกระสุนแบบ Matrix ได้อย่างเฉียบคม
* **🏆 Achievement System:** หอเกียรติยศบันทึกสถิติและความสำเร็จของผู้เล่น
* **🗄️ MTC Database & Admin Console:** ระบบ Lore และ Terminal ลับสำหรับใส่สูตรโกง (ถ้าคุณรู้คำสั่ง!)
* **🎨 Visual Polish:** SVG Portrait System, 6-layer Wanchai Stand rendering, Military HUD theme, and enhanced particle effects
* **🤖 Advanced AI:** Autonomous Wanchai Stand with tactical intelligence and positioning
* **🌌 Domain Expansion:** Ultimate boss abilities with arena-wide effects and physics manipulation

---

## 🦸‍♂️ Playable Characters

เลือกเล่นเป็น 3 ตัวละครที่มีสกิลและสไตล์การเล่นแตกต่างกันอย่างสิ้นเชิง:

| Character | Class | Key Abilities | Playstyle |
| :--- | :--- | :--- | :--- |
| 🎓 **เก้า (Kao)** | Advanced Assassin | 👻 Stealth<br>⚡ Teleport<br>👥 Hologram Clone | เน้นการลอบเร้น, คริติคอล, และการสลับอาวุธ (Assault, Sniper, Shotgun) |
| 🌾 **ภูมิ (Poom)** | Spiritual Warrior | 🔥 Ritual Burst<br>🐉 Naga Summon<br>🍚 Eat Rice (Heal) | เน้นการสร้างสถานะสโลว์ติดหนึบ (Sticky) และระเบิดดาเมจวงกว้าง |
| 🔥 **ออโต้ (Auto)** | Pyromaniac | 🌀 Vacuum Heat<br>💥 Detonate<br>👊 Wanchai Stand | เน้นการควบคุมพื้นที่ (Crowd Control) ปล่อย Stand Rush ไปตำแหน่งใดก็ได้ และทำดาเมจต่อเนื่อง |

---

## 👑 Epic Boss Fights

เตรียมพบกับ Boss Encounters ทุกๆ 3 เวฟ ที่มาพร้อมกับ Mechanics ระดับโหดหิน:
* 📐 **ครูมานพ (The Math Boss):** โจมตีด้วยสมการคณิตศาสตร์, กราฟมรณะ, ตาราง Matrix Grid และการเรียกสุนัขกับปลาทองคู่ใจ
* ⚛️ **ครูเฟิร์ส (The Physics Master):** โจมตีด้วยกฎฟิสิกส์, การพุ่งชนความเร็วสูง (SUVAT), ตกจากฟ้า (Free Fall) และระเบิดล็อคการเคลื่อนที่ (EMP Pulse)

---

## 🛠️ Technical Architecture

โปรเจกต์นี้เขียนด้วย **Vanilla JavaScript** โดยเน้นที่ Performance ระดับ 60FPS:
* **Render Engine:** แยกส่วนการวาดกราฟิกทั้งหมดไว้ที่ `PlayerRenderer.js` และ `BossRenderer.js` เพื่อความคลีนของโค้ด
* **State Management:** ใช้ `GameState.js` เป็น Single Source of Truth
* **Object Pooling:** จัดการ Particles และ Projectiles อย่างมีประสิทธิภาพเพื่อลดปัญหา Garbage Collection (GC)
* **Modular Design:** แบ่งคลาส Entity, ระบบ Input, และ UI ออกจากกันอย่างชัดเจน
* **Boss Architecture:** Refactored with `BossBase` class hierarchy for shared lifecycle management
* **Service Worker:** Automatic cache management and version updates for seamless deployment

---

## 🚀 How to Play

1.  ไปที่หน้าเว็บไซต์ของเกม (หรือรันผ่าน Live Server)
2.  เลือกตัวละครที่หน้าเมนูหลัก
3.  (แนะนำ) กดปุ่ม **🎓 REPLAY TUTORIAL** หากเพิ่งเคยเล่นครั้งแรกเพื่อเรียนรู้ระบบสกิล
4.  ใช้ปุ่ม `W A S D` ในการเดิน, `Left Click` เพื่อยิง, `Spacebar` เพื่อ Dash และกด `Q`, `E`, `R`, `T` สำหรับสกิลพิเศษ

---

## 🗺️ Roadmap (Next Steps)

- [x] Rework Tutorial System
- [x] End-game Boss Scaling (Wave 15)
- [x] SVG Portrait System & Visual Polish
- [x] Wanchai Stand 6-Layer Rendering System
- [x] Boss Architecture Refactor (BossBase hierarchy)
- [x] Advanced AI & Autonomous Systems
- [x] Domain Expansion Ultimate Abilities
- [x] Military HUD Theme Implementation
- [x] Tutorial Enhancements
- [ ] 🚧 **Godot Engine Migration:** วางแผนพอร์ตเกมไปสู่ Godot เพื่อยกระดับกราฟิกและประสิทธิภาพในอนาคต!

---

## 📈 Current Version: v3.11.12 (March 7, 2026)

**Latest Major Updates:**
- ✨ **Boss Architecture Refactor:** Clean class hierarchy with shared lifecycle management
- 🎨 **Visual Polish:** Complete SVG portrait system and 6-layer Wanchai Stand rendering
- 🤖 **Advanced AI:** Autonomous Stand system with tactical intelligence
- 🌌 **Domain Expansion:** Ultimate boss abilities with arena-wide physics manipulation
- ⚖️ **Balance Overhaul:** Comprehensive weapon and character balance adjustments
- 📚 **Tutorial System Sync:** Updated all tutorial content to match current game state
- 🌊 **Wave Events Documentation:** Added detailed breakdown of all wave types and boss encounters
- ⚔️ **Auto Character Combat Buffs:** Enhanced Wanchai Stand damage, speed, and visual effects
- 🎯 **Comprehensive Frontend Design Overhaul:** Military HUD theme with scanlines, hex grid, and enhanced visual effects
- 🔧 **UX Improvements Patch:** Overlay fade transitions, mobile button states, new record badge, and accessibility support
- ⏱️ **Bullet Time Visual System Overhaul:** Multi-layer cinematic effects with time ripples, clock-hand streaks, and circular energy HUD
- 🎯 **Enemy Renderer Refactor & Visual Polish:** Performance optimizations, shared helpers, enhanced visual details for all enemy types
- 🎨 **Comprehensive Visual Polish Overhaul:** Player renderer refactor, boss summons redesign, naturalistic creature designs with dangerous supernatural elements
- 🌌 **Domain Expansion Enhanced Visuals & New Abilities:** Portal iris opening, rotating hex geometry, ambient particles, Void Pulse rings, Formula Beam sweeping attacks, cinematic visual effects
- 🔊 **Complete Boss Attack Visual Rework:** Enhanced BarkWave, BubbleProjectile, ExpandingRing, EmpPulse, MatrixGridAttack, new EquationSlam & DeadlyGraph classes, ultimate attack wind-up effects, log457 visual states