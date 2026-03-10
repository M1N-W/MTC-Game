<div align="center">

# 🎮 MTC the Game (Beta Edition)

**Survive the waves. Defeat the teachers. Master the madness.**

> **Current Version:** Beta v3.29.2 | **Latest Update:** Wave Announcement & Shop Timer Fixes - Fixed WaveAnnouncementFX timing and shop speed boost timer display optimization

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
| 🔥 **ออโต้ (Auto)** | Thermodynamic Brawler | 230 / MAX / 260 / MELEE | **20/s Regen**<br>Q: 20 ⚡<br>E: 30 ⚡<br>R-Click: 25 ⚡ | 🌀 Early Vacuum<br>💥 Heat Detonation<br>👊 Wanchai Stand<br>🌡️ Heat Tier System | เน้นการควบคุมพื้นที่ตั้งแต่เริ่มเกม, สะสมความร้อนพร้อมระบบ Heat tiers (COLD/WARM/HOT/OVERHEAT), ปล่อย Stand Rush ไปตำแหน่งใดก็ได้พร้อมระบบ combo, Stand Meter 0-100, และ Skill Synergy (Stand Pull, Charge Punch, Stand Guard) |

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
- [x] 🚧 **Godot Engine Migration:** วางแผนพอร์ตเกมไปสู่ Godot เพื่อยกระดับกราฟิกและประสิทธิภาพในอนาคต!

---

## 📈 Current Version: v3.25.1 (March 9, 2026)

**Latest Major Updates:**
- 🥊 **Rush Fist Refinements:** Round glove design with afterimage motion effects replacing trail lines
- 👑 **Flame Crown Redesign:** Tapered spike geometry with perfect 5-spike crown symmetry
- � **Visual Polish:** Enhanced color intensity, improved shadows, and cleaner motion representation
- ⚡ **Performance Optimizations:** Consistent fist sizing and refined alpha blending
- � **Mathematical Precision:** Surface-attached spikes with arc-based positioning for realistic crown appearance

---

## 📋 Latest Update (v3.20.2)

**Boss Safe-Zone Protection System - March 9, 2026**

### 🛡️ Anti-Exploit Protection
- **MTC Room Exclusion:** Bosses can no longer be lured into MTC Room for spawn-killing exploits
- **Smooth Push-Out:** Automatic 380 px/s push force moves bosses away from safe zone
- **Temporary Immunity:** Bosses immune to damage during push-out with clear visual feedback
- **Universal Coverage:** Protection applies to all boss types (BossDog, KruManop, KruFirst)

### 🎯 Gameplay Fairness
- **Maintains Challenge:** Prevents circumventing boss mechanics through safe-room exploitation
- **Clear Feedback:** "SAFE ZONE" indicator shows when protection is active
- **Non-Disruptive:** Smooth mechanics maintain game flow without jarring teleportation

---

## 📋 Previous Update (v3.20.1)

**UI Polish & Display Improvements - March 9, 2026**

### ✨ Enhanced Level Up Display
- **Staggered Text Timing**: Level up notifications now split into two phases for better visual hierarchy
- **Improved Positioning**: Stats text positioned higher to avoid character overlap
- **Cleaner Visual Design**: Smaller stats text with delayed big level announcement

### 🎨 Weapon Indicator Improvements
- **Smooth Transitions**: Added fade and slide animations for weapon changes
- **Enhanced Visual Feedback**: Weapon switching now features smooth 0.4s ease transitions

### 🌊 Wave Event Optimization
- **Reduced Visual Clutter**: Eliminated duplicate floating text during wave events
- **Better Timing**: Wave announcements staggered 900ms after banner begins
- **Cleaner Display**: Voice bubbles only for atmospheric feedback

---