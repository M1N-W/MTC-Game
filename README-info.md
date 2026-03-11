<div align="center">

# 🎮 MTC the Game (Beta Edition)

**Survive the waves. Defeat the teachers. Master the madness.**

> **Current Version:** Beta v3.30.8 | **Latest Update:** Wave Event Announcement Integration - Unified banner system with event badges

> **⚠️ DOCUMENTATION STABILITY:** This README contains **current implementation details** that change with updates. For stable architectural patterns, see [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md).

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
* **🗄️ MTC Database & Admin Console:** Advanced permission-based terminal system with three-tier access levels (GUEST/OPERATOR/ROOT), debug commands, and real-time FPS monitoring
* **🎨 Visual Polish:** SVG Portrait System, 6-layer Wanchai Stand rendering with JoJo-style aesthetics, thermodynamic color palette (crimson→amber→yellow), enhanced body design with gold pauldrons and armor, premium Mongkhon crown with 5 concave spikes, realistic Muay Thai boxing glove rush system with ORA Combo escalation, progressive depth scaling, Military HUD theme, and enhanced particle effects
* **🎵 Enhanced Audio System:** BGM crossfade transitions with same-track guard, Web Audio API GainNode routing for smooth volume control, 400ms fade-out effects between tracks (battle↔boss), and seamless wave transitions without audio cutting
* **🤖 Advanced AI System:** UtilityAI decision-making with personality-weighted behaviors, SquadAI coordination with tactical role assignments, PlayerPatternAnalyzer for adaptive boss AI, and EnemyBase refactor providing automatic AI inheritance for all enemies
* **🌌 Domain Expansion:** Ultimate boss abilities with arena-wide effects, physics manipulation, and enhanced visual effects including pillar of light, energy tendrils, and dynamic grid animations

---

## 🦸‍♂️ Playable Characters

เลือกเล่นเป็น 3 ตัวละครที่มีสกิลและสไตล์การเล่นแตกต่างกันอย่างสิ้นเชิง พร้อมระบบ stat bar ใหม่ 4 มิติ (HP/DMG/SPD/RANGE) ที่แสดงค่าจริงจาก config.js:

| Character | Class | Stats (HP/DMG/SPD/RANGE) | Energy System | Key Abilities | Playstyle |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 🎓 **เก้า (Kao)** | Advanced Assassin | 119 / 118 / 298 / 900 | **15/s Regen**<br>Q: 20 ⚡<br>E: 30 ⚡ | 👻 Holographic Stealth<br>⚡ Phantom Blink<br>👥 Hologram Clone<br>🎯 Weapon Switch FX | เน้นการลอบเร้นแบบขั้นบันได, คริติคอลจากการฆ่าตอนซุ่ม, การสลับอาวุธ (Assault, Sniper, Shotgun) พร้อม visual feedback |
| 🌾 **ภูมิ (Poom)** | Spiritual Warrior | 165 / 148 / 298 / 750 | **12/s Regen**<br>Q: 25 ⚡<br>E: 30 ⚡<br>R-Click: 15 ⚡<br>R: **FREE** | 🔥 Ritual Burst<br>🐉 Serpentine Naga<br>🌪️ Garuda Wind<br>🪷 Lotus Bloom | เน้นการสร้างสถานะสโลว์ติดหนึบ (Sticky) และระเบิดดาเมจวงกว้างพร้อมบัฟ HP 45% สูงสุด |
| 🔥 **ออโต้ (Auto)** | Thermodynamic Brawler | 230 / 24 / 260 / MELEE | **20/s Regen**<br>Q: 20 ⚡<br>E: 30 ⚡<br>R-Click: 25 ⚡ | 🌀 Early Vacuum<br>💥 Heat Detonation<br>👊 Wanchai Stand<br>🌡️ Heat Tier System | เน้นการควบคุมพื้นที่ตั้งแต่เริ่มเกม, สะสมความร้อนพร้อมระบบ Heat tiers (COLD/WARM/HOT/OVERHEAT), ปล่อย Stand Rush ไปตำแหน่งใดก็ได้พร้อมระบบ combo, Stand Meter 0-100, และ Skill Synergy (Stand Pull, Charge Punch, Stand Guard) |

---

## 👑 Epic Boss Fights

เตรียมพบกับ Boss Encounters ทุกๆ 3 เวฟ ที่มาพร้อมกับ Mechanics ระดับโหดหิน:

### 📐 ครูมานพ (The Math Boss) — Phase Structure Rework
* **Phase 2 Dynamics:** Per-encounter thresholds (enc1=50%, enc3=60%, enc5=65%) guarantee dog encounters
* **ChalkWall Barrier:** Perpendicular chalk barriers block player escape with mathematical formula overlays
* **DogPackCombo:** Synchronized attacks where boss freezes while dog rushes and ultimate fires simultaneously
* **Domain Sub-Phases:** Progressive A/B/C difficulty with extended warnings, chalk volleys, and TeacherFury triggers

### ⚛️ ครูเฟิร์ส (The Physics Master) — Complete Domain System
* **GravitationalSingularity Domain:** 4-pulse sequence at HP ≤ 25% (PULL → ESCAPE → TIDAL → COLLAPSE)
* **OrbitalDebris:** 6 orbiting projectiles during TIDAL phase with deterministic spinning visuals
* **Singularity Mode:** Post-domain enhancement with ×0.50 cooldowns and REBOUND state mechanics
* **Advanced Skills:** GravityWell distortion fields and SuperpositionClone phantom copies
* **QuantumLeap:** Teleport behind player with immediate double SUVAT charge capability

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
- [x] Enhanced Tutorial System v3 with UI highlighting and animated arrows
- [] 🚧 **Godot Engine Migration:** วางแผนพอร์ตเกมไปสู่ Godot เพื่อยกระดับกราฟิกและประสิทธิภาพในอนาคต!

---

## 📈 Current Version: v3.30.8 (March 11, 2026)

**Latest Major Updates:**
- 🎨 **Wave Event Announcement Integration:** Unified banner system with event badges for fog/speed waves
- 🎯 **Enhanced Visual Polish:** Event badge strip with icons, colors, and military HUD theme
- ⚡ **Performance Optimization:** Eliminated redundant banner drawing operations
- 🏗️ **Architecture Centralization:** Event announcement logic consolidated in effects system
- 📱 **UI Consistency:** Improved wave event display with proper positioning

---

## 📋 Latest Update (v3.30.8)

**Wave Event Announcement Integration - March 11, 2026**

### 🎨 UI/UX Enhancements
- **Unified Banner System:** Integrated wave event badges (fog/speed) into WaveAnnouncementFX
- **Event Badge Strip:** Added visual event indicators to wave announcement banners
- **Code Consolidation:** Removed duplicate banner drawing from WaveManager.js
- **Visual Polish:** Enhanced event display with icons, colors, and proper positioning

### 🔧 Technical Improvements
- **WaveManager.js:** Added `attachEvent()` calls to integrate with WaveAnnouncementFX
- **effects.js:** Extended WaveAnnouncementFX with event badge rendering
- **Performance:** Eliminated redundant banner drawing operations
- **Architecture:** Centralized event announcement logic in effects system

---