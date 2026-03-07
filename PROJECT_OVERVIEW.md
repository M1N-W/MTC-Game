# 🎮 MTC Game - Project Overview

**สรุปโปรเจคต์สำหรับ AI Assistant (Claude/Cascade)**
เอกสารนี้จัดทำขึ้นเพื่อให้ AI มีความเข้าใจโปรเจคต์ MTC Game อย่างครบถ้วนเมื่อเริ่มการสนทนาใหม่

---

## 📋 Project Summary

**MTC the Game** เป็นเกมแนว Top-down 2D Wave Survival Shooter ที่พัฒนาด้วย Vanilla JavaScript และ HTML5 Canvas API โดยไม่ใช้ Framework ใดๆ

- **ประเภท:** Wave Survival Shooter Game
- **เทคโนโลยี:** HTML5 Canvas, Vanilla JavaScript
- **Performance Target:** 60 FPS
- **สถานะ:** Beta (v3.11.14)
- **เป้าหมาย:** เกมฆ่าศัตรู 15 เวฟ พร้อมบอสและระบบอัปเกรด

---

## 🗂️ File Structure & Responsibilities

### 📄 Root Files
- **`index.html`** - หน้าเว็บหลักของเกม, โหลด JavaScript ทั้งหมด
- **`sw.js`** - Service Worker สำหรับ cache management, **ต้องอัปเดทเวอร์ชันทุกครั้งที่มีการเปลี่ยนแปลงโค้ด**
- **`manifest.json`** - PWA manifest
- **`Debug.html`** - หน้า debug สำหรับ testing
- **`README-info.md`** - เอกสารสำหรับผู้เล่น
- **`CHANGELOG.md`** - บันทึกการเปลี่ยนแปลงทั้งหมด

### 📁 `/js/` - Core Game Logic

#### 🔧 Main Systems
- **`game.js`** - Game loop หลัก, การอัปเดตเกมต่อเฟรม
- **`config.js`** - ค่าคอนฟิกทั้งหมด (weapon stats, character stats, game settings)
- **`input.js`** - ระบบจัดการ input จากผู้เล่น (keyboard, mouse, touch)
- **`audio.js`** - ระบบเสียง, SFX, BGM
- **`effects.js`** - Visual effects, particles, animations
- **`weapons.js`** - ระบบอาวุธ, projectile management
- **`utils.js`** - Utility functions ทั่วไป
- **`map.js`** - ระบบแผนที่, collision detection
- **`ui.js`** - UI elements, HUD, menus
- **`menu.js`** - เมนูหลัก, character selection
- **`tutorial.js`** - ระบบ tutorial
- **`ai.js`** - AI logic สำหรับศัตรู
- **`secrets.js`** - ระบบลับ, cheat codes

#### 📁 `/js/systems/` - Game Management Systems
- **`GameState.js`** - State management หลักของเกม
- **`WaveManager.js`** - จัดการ wave progression, enemy spawning
- **`TimeManager.js`** - จัดการเวลาในเกม, bullet time
- **`ShopSystem.js`** - ระบบร้านค้า, upgrades
- **`AdminSystem.js`** - Admin console, debug commands

#### 📁 `/js/entities/` - Game Entities
- **`base.js`** - Base entity class ทุก entity สืบทอดจากนี้
- **`enemy.js`** - Enemy class หลัก
- **`boss.js`** - Boss entities, mechanics ต่างๆ
- **`boss_attacks.js`** - Boss attack patterns และ abilities
- **`summons.js`** - Summoned entities (pets, helpers)

##### 📁 `/js/entities/player/` - Player Characters
- **`PlayerBase.js`** - Base class สำหรับ player ทุกตัว
- **`Kaoplayer.js`** - ตัวละคร "เก้า" (Assassin class)
- **`PoomPlayer.js`** - ตัวละคร "ภูมิ" (Spiritual Warrior)
- **`AutoPlayer.js`** - ตัวละคร "ออโต้" (Pyromaniac)

#### 📁 `/js/rendering/` - Rendering System
- **`PlayerRenderer.js`** - การวาด player ทั้งหมด, animations, effects

### 📁 `/css/` - Stylesheets
- **`main.css`** - หน้าตา UI ทั้งหมด, HUD design, military theme, animations, responsive design

### 📁 `/assets/` - Game Assets
#### 📁 `/assets/audio/` - Audio Files
- **`menu.mp3`** - เพลงพื้นหลังเมนูหลัก
- **`battle.mp3`** - เพลงพื้นหลังระหว่างเกม (combat)
- **`boss.mp3`** - เพลงพื้นหลังตอนต่อสู้บอส
- **`glitch.mp3`** - เพลงพื้นหลังสำหรับ Glitch Wave event

### 🔧 Development & Deployment Files
- **`Debug.html`** - หน้า debug สำหรับ testing และ system diagnostics
- **`manifest.json`** - PWA manifest สำหรับการติดตั้งเป็น web app
- **`favicon.svg`** - Favicon ของเกม
- **`skills-lock.json`** - AI skills configuration สำหรับ development tools
- **`.gitignore`** - Git ignore rules

### 📁 `.github/` - GitHub Configuration
#### 📁 `.github/workflows/`
- **`deploy.yml`** - GitHub Actions workflow สำหรับ auto-deploy ไป GitHub Pages

### 📁 `.windsurf/` - Development Tools
#### 📁 `.windsurf/skills/` - AI Skills (empty folders, skill definitions stored externally)
- **`javascript-testing-patterns`** - Testing patterns skill
- **`modern-javascript-patterns`** - Modern JS patterns skill  
- **`next-best-practices`** - Next.js best practices skill
- **`tauri-event-system`** - Tauri event system skill
- **`typescript-advanced-types`** - TypeScript types skill

---

## 🎮 Game Architecture

### Core Loop Flow
1. **Input Processing** (`input.js`) → รับคำสั่งจากผู้เล่น
2. **Game State Update** (`game.js`) → อัปเดต logic ทั้งหมด
3. **Entity Updates** → Player, enemies, bosses, projectiles
4. **Collision Detection** (`map.js`) → ตรวจสอบการชน
5. **Rendering** → วาดทุกอย่างบน canvas
6. **UI Update** (`ui.js`) → อัปเดต HUD, menus

### Key Design Patterns
- **Object Pooling** สำหรับ particles และ projectiles (ลด GC)
- **State Management** ผ่าน `GameState.js` (single source of truth)
- **Modular Architecture** แยกส่วน rendering, logic, UI ชัดเจน
- **Class Hierarchy** ใช้ inheritance สำหรับ entities

---

## 🔧 Development Workflow

### ⚠️ IMPORTANT: Commit & Push Workflow
**หลังจากเปลี่ยนแปลงโค้ดใดๆ ต้องทำตามขั้นตอนนี้เสมอ:**

1. **Review Changes** - ตรวจสอบการเปลี่ยนแปลงให้แน่ใจว่าถูกต้อง
2. **Update Documentation:**
   - `sw.js` - เพิ่มเวอร์ชัน cache (เช่น v3.11.14 → v3.11.15)
   - `CHANGELOG.md` - เพิ่มรายละเอียดการเปลี่ยนแปลง
   - `README-info.md` - อัปเดทหากจำเป็น
3. **Commit & Push** - พร้อมคำอธิบายที่ละเอียด

### 🐛 Debugging & Error Handling
- **Cascade Edit Issues:** ถ้าเจอ "malformed edit" กับ JavaScript files ที่มี multi-line strings, ใช้ Python script approach
- **Performance Issues:** ใช้ `Debug.html` สำหรับ testing
- **Visual Glitches:** ตรวจสอบ `PlayerRenderer.js` และ rendering pipeline

---

## 🎯 Key Features Implementation

### Player Characters (3 Playable)
- **เก้า (Kao)** - Stealth/Teleport/Clone mechanics
- **ภูมิ (Poom)** - Ritual Burst/Naga Summon/Heal
- **ออโต้ (Auto)** - Vacuum Heat/Detonate/Wanchai Stand

### Boss System
- **ครูมานพ** - Math-themed attacks (equations, graphs, matrix)
- **ครูเฟิร์ส** - Physics-themed attacks (SUVAT, free fall, EMP)
- **Domain Expansion** - Ultimate abilities ระดับโหด

### Game Systems
- **15 Wave Progression** พร้อม wave events (Glitch, Fog, Speed)
- **Roguelite Shop** สำหรับ character upgrades
- **Bullet Time System** (กด T)
- **Achievement System**
- **MTC Database** (Lore system)

---

## 🚀 Performance Considerations

### Target: 60 FPS
- **Object Pooling** สำหรับ projectiles/particles
- **Efficient Rendering** ผ่าน `PlayerRenderer.js`
- **Optimized Math** ใช้ `Math.hypot()` แทน manual distance calc
- **Memory Management** ลด garbage collection

### Critical Files for Performance
- `game.js` - Main game loop
- `PlayerRenderer.js` - Rendering pipeline
- `effects.js` - Particle systems
- `boss_attacks.js` - Boss attack patterns

---

## 📝 Recent Major Updates (v3.11.x)

- **Boss Architecture Refactor** - Clean class hierarchy
- **Visual Polish** - SVG portraits, 6-layer rendering
- **Advanced AI** - Autonomous systems
- **Domain Expansion** - Ultimate abilities
- **Performance Optimization** - Gradient handling, distance calculations

---

## 🔍 Quick Reference for Common Tasks

### Adding New Character
1. สร้าง class ใน `/js/entities/player/` สืบทอดจาก `PlayerBase.js`
2. เพิ่ม config ใน `config.js`
3. เพิ่ม rendering logic ใน `PlayerRenderer.js`
4. เพิ่ม UI elements ใน `menu.js`

### Adding New Boss Attack
1. สร้าง class ใน `boss_attacks.js`
2. เพิ่ม logic ใน `boss.js`
3. เพิ่ม visual effects ใหม่ถ้าจำเป็น

### Performance Issues
1. ตรวจสอบ `game.js` loop
2. ดู object pooling ใน `effects.js`
3. ตรวจสอบ rendering ใน `PlayerRenderer.js`

### Version Update Workflow
1. อัปเดท `sw.js` cache version
2. เพิ่ม entry ใน `CHANGELOG.md`
3. อัปเดท `README-info.md` ถ้าจำเป็น
4. Commit & push

---

## ⚡ Quick Commands

### Testing
- เปิด `Debug.html` สำหรับ debug mode
- ใช้ Admin Console (ถ้ารู้คำสั่ง)

### Common Issues
- **Malformed Edit:** "ใช้ Python script"
- **Performance:** ตรวจสอบ object pooling
- **Visual Bugs:** ดู `PlayerRenderer.js`

---

**📌 สำคัญ:** เอกสารนี้ควรถูกอัปเดทเมื่อมีการเปลี่ยนแปลงสถาปัตยกรรมหลักของโปรเจคต์
