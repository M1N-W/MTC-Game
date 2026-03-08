# 🎮 MTC Game - Project Overview

> **⚠️ IMPORTANT:** This documentation contains both **stable patterns** and **dynamic information** that changes with each update. Always verify current implementation before referencing.

**สรุปโปรเจคต์สำหรับ AI Assistant (Claude/Cascade)**
เอกสารนี้จัดทำขึ้นเพื่อให้ AI มีความเข้าใจโปรเจคต์ MTC Game อย่างครบถ้วนเมื่อเริ่มการสนทนาใหม่

---

## 📋 Documentation Stability Guide

### 🟢 **STABLE PATTERNS** (Rarely Change)
- **File Structure:** Core file locations and purposes
- **Architecture Patterns:** Entity hierarchy, rendering decoupling, state management
- **Development Workflow:** Git workflow, AI assistant roles, commit patterns
- **Code Organization:** Module structure, naming conventions, design patterns
- **Technical Concepts:** Object pooling, spatial optimization, deterministic rendering

### 🟡 **SEMI-DYNAMIC** (Changes Occasionally)
- **Quick Reference Tasks:** File lists for common development tasks
- **System Integration:** How major systems connect and interact
- **Configuration Structure:** Overall config organization (not specific values)
- **UI/UX Patterns:** General UI approaches and design principles

### 🔴 **DYNAMIC INFORMATION** (Changes Frequently)
- **🔥 Current Implementation Details:** Specific feature implementations, version-specific behaviors
- **🔥 Configuration Values:** Exact numbers, durations, percentages, colors
- **🔥 File Contents:** Current code snippets, method signatures, class structures
- **🔥 Version-Specific Features:** Features added in specific versions
- **🔥 Balance Values:** HP amounts, damage values, cooldown times, buff magnitudes

---

## 📖 How to Use This Documentation

### ✅ **For New Development:**
- Use **STABLE PATTERNS** for understanding architecture and workflow
- Reference **SEMI-DYNAMIC** sections for general task guidance
- Always verify **DYNAMIC INFORMATION** against current codebase

### ⚠️ **For Existing Features:**
- Check current implementation in actual files before referencing
- Use this as a guide, not as absolute truth
- Look for version indicators (e.g., "v3.11.17") for temporal context

### 🔄 **When Updating Code:**
- Update this documentation when making architectural changes
- Mark version-specific information clearly
- Consider separating stable patterns from dynamic implementation details

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
- **`secrets.js`** - CONFIG_SECRETS (เช่น GEMINI_API_KEY) — ไม่มีระบบ cheat codes

#### 📁 `/js/systems/` - Game Management Systems
- **`GameState.js`** - State management หลักของเกม
- **`WaveManager.js`** - จัดการ wave progression, enemy spawning
- **`TimeManager.js`** - จัดการเวลาในเกม, bullet time
- **`ShopSystem.js`** - ระบบร้านค้า, upgrades
- **`AdminSystem.js`** - Admin console, debug commands
  - Permission system: GUEST / OPERATOR / ROOT
  - `spawn manop [1|2|3]` — Kru Manop phase 1/2/3
  - `spawn first [advanced]` — Kru First normal/advanced
  - `devbuff` — inject dev stat package ให้ player ปัจจุบัน

#### 📁 `/js/entities/` - Game Entities
- **`base.js`** - Base entity class ทุก entity สืบทอดจากนี้
- **`enemy.js`** - Enemy class หลัก
- **`boss.js`** - Boss entities, mechanics ต่างๆ
- **`boss_attacks.js`** - Boss attack patterns และ abilities
- **`summons.js`** - Summoned entities (pets, helpers)

##### 📁 `/js/entities/player/` - Player Characters
- **`PlayerBase.js`** - Base class สำหรับ player ทุกตัว
  - `applyDevBuff()` — Dev Mode stat buff (ทุกตัวละครสืบทอดได้, flag `_devBuffApplied` ป้องกันซ้ำ)
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

### 🔁 IMPORTANT: AI File Versioning Rule

**ปัญหา:** เมื่อแชทยาวขึ้น AI อาจสับสนว่าควรใช้ไฟล์จาก output ที่เคยสร้างในแชท หรือรอรับไฟล์ใหม่จากผู้ใช้

**Rule: ทุกครั้งที่เริ่ม task ใหม่ในแชท — AI ต้องรอรับไฟล์จากผู้ใช้เสมอ ไม่ใช้ไฟล์จาก output เดิมในแชท**

เหตุผล: ผู้ใช้อาจแก้ไขไฟล์เพิ่มเติมใน project จริงหลังจาก copy output ไปแล้ว ทำให้ output เก่าในแชทล้าสมัย

**Flow ที่ถูกต้อง:**
```
รอบที่ 1: ผู้ใช้ส่งไฟล์ → AI แก้ → output → ผู้ใช้ copy ไป project
รอบที่ 2: ผู้ใช้บอกแก้เพิ่ม → AI ถาม/รอรับไฟล์ใหม่จาก project → แก้ → output ใหม่
รอบที่ 3+: ซ้ำแบบรอบที่ 2 เสมอ — ห้ามใช้ output จากรอบก่อนหน้า
```

**ห้าม:** นำ output จากรอบก่อนมาแก้ต่อโดยไม่รับไฟล์ใหม่จากผู้ใช้
**ถูกต้อง:** ถ้าผู้ใช้ไม่ส่งไฟล์มาด้วย ให้แจ้งว่า "กรุณาส่งไฟล์ล่าสุดจาก project มาด้วยครับ"

---

### ⚠️ IMPORTANT: Commit & Push Workflow
**หลังจากเปลี่ยนแปลงโค้ดใดๆ ต้องทำตามขั้นตอนนี้เสมอ:**

1. **Review Changes** - ตรวจสอบการเปลี่ยนแปลงให้แน่ใจว่าถูกต้อง
2. **Update Documentation:**
   - `sw.js` - เพิ่มเวอร์ชัน cache (เช่น v3.11.14 → v3.11.15)
   - `CHANGELOG.md` - เพิ่มรายละเอียดการเปลี่ยนแปลง
   - `README-info.md` - อัปเดทหากจำเป็น
   - **Update other documentation files if the changes affect them**
3. **Commit & Push** - พร้อมคำอธิบายที่ละเอียด

**📝 คำสั่งที่สมบูรณ์สำหรับ Windsurf IDE:**
"commit and push, but before committing, you must check the changes to ensure they are correct and understand what has been changed. Then, write a detailed description and do not forget to update @sw.js, @CHANGELOG.md and @README-info.md. Update other documentation files if the changes affect them."

**⚠️ หมายเหตุ:** คำสั่งนี้ใช้สำหรับ Windsurf IDE เท่านั้น เพราะ Claude มีหน้าที่เขียนโค้ดให้แบบ 100% และไม่รับผิดชอบการ commit & push

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

## 🤖 สำหรับ AI Assistant (Claude/Cascade)

### 📋 บทบาทและการใช้งาน

**🎯 หน้าที่หลัก:**

#### 🧠 Claude (Complex Tasks):
- **Complex Code Changes:** แก้ไขโค้ดขนาดใหญ่และ refactor ระบบหลัก
- **Bug Resolution:** แก้ไขบั๊กซับซ้อนที่ต้องการ deep debugging
- **Architecture Changes:** เปลี่ยนแปลงโครงสร้างระบบใหญ่
- **Performance Optimization:** ปรับแต่งประสิทธิภาพขั้นสูง
- **System Integration:** ทำงานที่ต้องการความเข้าใจระบบซับซ้อน

#### 💻 Windsurf IDE (Simple Tasks):
- **Code Writer:** เขียนโค้ด JavaScript, HTML, CSS สำหรับฟีเจอร์เล็กๆ
- **Project Analyst:** วิเคราะห์โครงสร้างโปรเจคต์และไฟล์ต่างๆ
- **Documentation Creator:** สร้างไฟล์อธิบายบริบทและเอกสารประกอบ
- **Git Manager:** ดำเนินการ commit & push ตาม workflow ที่กำหนด
- **Feature Development:** เพิ่มฟีเจอร์ง่ายๆ ตาม Quick Reference

**🛠️ เครื่องมือที่ใช้:**
- **Claude:** สำหรับงานซับซ้อนที่ต้องการความเชี่ยวชาญ
- **Windsurf IDE:** สำหรับงานทั่วไปและการวิเคราะห์ไฟล์
- **Version Control:** Git สำหรับการจัดการ source code
- **Documentation:** Markdown สำหรับสร้างเอกสาร

---

### 🎮 การแบ่งงานระหว่าง AI

#### 🧠 งานที่ใช้ Claude (Complex & Critical):
1. **แก้ไขโค้ดขนาดใหญ่** - การ refactor ระบบหลัก
2. **แก้บั๊กซับซ้อน** - ปัญหาที่ต้องการ deep debugging
3. **เปลี่ยนแปลง architecture** - การปรับโครงสร้างระบบใหญ่
4. **Performance optimization** - การปรับแต่งประสิทธิภาพขั้นสูง
5. **System Integration** - การเชื่อมโยงระบบซับซ้อน
6. **Critical Bug Fixes** - ปัญหาที่กระทบ gameplay หลัก

#### 💻 งานที่ใช้ Windsurf IDE (Simple & Routine):
1. **เขียนโค้ดฟีเจอร์ใหม่** - ตาม Quick Reference for Common Tasks
2. **วิเคราะห์ไฟล์โปรเจคต์** - ค้นหาและอ่านไฟล์
3. **สร้างเอกสาร** - PROJECT_OVERVIEW.md, README, คำอธิบายบริบท
4. **Commit & Push** - ตาม workflow ที่กำหนด (sw.js, CHANGELOG.md, README-info.md)
5. **Simple Bug Fixes** - ปัญหาง่ายๆ ที่แก้ได้ง่าย
6. **UI/Visual Tweaks** - การปรับแต่ง UI ขนาดเล็ก

---

### 🔄 Workflow การทำงาน

#### 🧠 Claude Workflow (Complex Tasks):
```
1. วิเคราะห์ปัญหาซับซ้อน
2. อ่านไฟล์ที่เกี่ยวข้องจำนวนมาก
3. ออกแบบ solution ขั้นสูง
4. เขียน/แก้ไขโค้ดขนาดใหญ่
5. ทดสอบและ validate
6. ⚠️ **สำคัญ:** ถ้าเขียน patch diff ให้เสร็จแล้วต้อง put the fixed code in the files ให้ด้วยอัตโนมัติ
7. Commit & push พร้อมคำอธิบายละเอียด
```

**⚠️ ข้อควรรู้สำคัญสำหรับ Claude:**
- **Automatic Code Application:** หลังจากเขียน patch diff ที่เสร็จสมบูรณ์ ต้อง apply โค้ดที่แก้ไขลงในไฟล์จริงโดยอัตโนมัติ
- **No Manual Steps:** ไม่ต้องรอให้ผู้ใช้ทำการ apply โค้ดด้วยตนเอง
- **Complete Solution:** ต้องแน่ใจว่าโค้ดที่แก้ไขถูกนำไปใช้จริงในไฟล์
- **Validation:** ตรวจสอบว่าโค้ดที่ apply ถูกต้องและทำงานได้
- **🔥 Multi-round Editing Workflow:** หากมีการแก้ไขหลายรอบในแชทเดิม (ใช้ไฟล์ที่ Claude แก้ให้มาแก้ต่อ) จะต้อง base จาก `/mnt/user-data/outputs/` เสมอ ไม่ใช่ `/mnt/user-data/uploads/` เพื่อป้องกันการสูญหายของโค้ดที่แก้ไขไปแล้ว แต่ถ้าผู้ใช้อัพโหลดไฟล์ใหม่แนบมาใน prompt อาจมีการอัปเดทไฟล์จากข้างนอก ทำให้อาจจำเป็นต้องใช้ไฟล์ใน uploads แทน outputs ล่าสุดของ Claude

#### 💻 Windsurf IDE Workflow (Simple Tasks):
```bash
# ค้นหาไฟล์ที่เกี่ยวข้อง
find_by_name Pattern="skill" SearchDirectory="/js"
grep_search Query="function shoot" SearchPath="/js"

# อ่านไฟล์เพื่อทำความเข้าใจ
read_file file_path="/js/entities/player/AutoPlayer.js"
read_file file_path="/js/config.js" limit=50

# เขียนโค้ดฟีเจอร์เล็กๆ
# Commit & push ตาม workflow
```

---

### 📝 ตัวอย่างการแบ่งงาน

#### 🧠 Case 1: แก้ปัญหา Performance ซับซ้อน (Claude)
```
ปัญหา: Game lag ตอนมีศัตรูมากกว่า 50 ตัว

การแก้:
1. Claude วิเคราะห์ performance bottleneck
2. Claude อ่าน game.js, effects.js, weapons.js
3. Claude ออกแบบ object pooling improvement
4. Claude แก้ไขโค้ดขนาดใหญ่
5. Claude ทดสอบและ validate
6. Claude commit & push พร้อมรายละเอียด
```

#### � Case 2: เพิ่ม Skill ง่ายๆ (Windsurf IDE)
```
ต้องการ: เพิ่ม skill "Shield Bash" ให้ตัวละครเก้า

การแก้:
1. Windsurf IDE วิเคราะห์ Kaoplayer.js
2. Windsurf IDE อ่าน config.js
3. Windsurf IDE เขียน shieldBash() method
4. Windsurf IDE เพิ่ม stats ใน config.js
5. Windsurf IDE commit & push ตาม workflow
```

---

### ⚠️ ข้อควรรู้สำคัญ

#### 🧠 สำหรับ Claude:
- **Deep Analysis** - ต้องการความเข้าใจระบบอย่างลึกซึ้ง
- **Complex Solutions** - ออกแบบ solution ขั้นสูง
- **System Impact** - ต้องคำนึงถึงผลกระทบต่อระบบทั้งหมด
- **Testing Required** - ต้องทดสอบอย่างละเอียด
- **🔥 Automatic Code Application:** หลังจากเขียน patch diff ให้เสร็จ ต้อง apply โค้ดที่แก้ไขลงในไฟล์จริงโดยอัตโนมัติ ไม่ต้องรอผู้ใช้ทำเอง
- **🔥 Multi-round Editing Workflow:** หากมีการแก้ไขหลายรอบในแชทเดิม (ใช้ไฟล์ที่ Claude แก้ให้มาแก้ต่อ) จะต้อง base จาก `/mnt/user-data/outputs/` เสมอ ไม่ใช่ `/mnt/user-data/uploads/` เพื่อป้องกันการสูญหายของโค้ดที่แก้ไขไปแล้ว แต่ถ้าผู้ใช้อัพโหลดไฟล์ใหม่แนบมาใน prompt อาจมีการอัปเดทไฟล์จากข้างนอก ทำให้อาจจำเป็นต้องใช้ไฟล์ใน uploads แทน outputs ล่าสุดของ Claude

#### 💻 สำหรับ Windsurf IDE:
- **Pattern Following** - ใช้ pattern ที่มีอยู่แล้ว
- **File Analysis** - ใช้ Windsurf IDE ค้นหาและอ่านไฟล์
- **Workflow Compliance** - ทำตาม workflow ที่กำหนด
- **Simple Scope** - ทำงานที่ไม่ซับซ้อน

---

### 🎯 เป้าหมายของการทำงาน

**✅ ความสำเร็จร่วมกัน:**
- **Claude:** แก้ปัญหาซับซ้อนได้อย่างมีประสิทธิภาพ
- **Windsurf IDE:** ทำงานทั่วไปได้อย่างรวดเร็ว
- **ทั้งคู่:** ช่วยลดภาระงานของนักพัฒนาได้
- **ร่วมกัน:** ทำให้โปรเจคต์พัฒนาได้อย่างมีประสิทธิภาพ

**🚫 ข้อจำกัด:**
- **Claude:** ไม่ต้องทำงานง่ายๆ ที่ Windsurf IDE ทำได้
- **Windsurf IDE:** ไม่ต้องทำงานซับซ้อนที่ต้องการ Claude
- **ทั้งคู่:** ทำงานในขอบเขตที่กำหนด

---

## 🔍 Quick Reference for Common Tasks

### 1. 🦸‍♂️ การเพิ่มตัวละครใหม่
**ไฟล์ที่ต้องแก้ไข:**
- `/js/entities/player/[NewCharacter].js` - สร้าง class ตัวละครใหม่ สืบทอบจาก `PlayerBase.js`
- `/js/config.js` - เพิ่ม character stats ใน `BALANCE.characters.[newChar]`, abilities, weapons config
- `/js/rendering/PlayerRenderer.js` - เพิ่ม rendering method `_draw[NewChar](entity, ctx)` และ update dispatcher
- `/js/menu.js` - เพิ่มตัวละครใน character selection menu (selectCharacter function)
- `/js/ui.js` - เพิ่ม UI elements สำหรับตัวละคร (HUD, skill icons, achievement system)
- `/js/audio.js` - เพิ่ม sound effects สำหรับ abilities/weapons (character-specific sounds)
- `/css/main.css` - เพิ่ม styles สำหรับ UI elements ใหม่

**ไฟล์ที่อาจกระทบ:**
- `/js/game.js` - ถ้าต้องการเพิ่ม special game logic หรือ AI integration
- `/js/systems/WaveManager.js` - ถ้าตัวละครมีผลต่อ wave progression
- `/js/weapons.js` - ถ้าตัวละครมี weapon system พิเศษ (เช่น Poom bypass)

**⚠️ ข้อควรรู้:**
- AchievementSystem อยู่ใน `/js/ui.js` ไม่ใช่ไฟล์แยก
- PlayerRenderer ใช้ pattern `_draw[CharName]()` และตรวจสอบ instanceof ใน dispatcher

---

### 2. 👑 การเพิ่มบอสใหม่
**ไฟล์ที่ต้องแก้ไข:**
- `/js/entities/boss.js` - เพิ่ม boss class ใหม่ สืบทอดจาก `BossBase` (เช่น KruManop, KruFirst pattern)
- `/js/entities/boss_attacks.js` - สร้าง attack patterns และ abilities ใหม่
- `/js/config.js` - เพิ่ม boss stats, phases, drop rates
- `/js/systems/WaveManager.js` - เพิ่ม boss spawn logic ใน wave ที่กำหนด (deterministic queue)
- `/js/audio.js` - เพิ่ม boss music, attack sounds, death sounds

**ไฟล์ที่อาจกระทบ:**
- `/js/entities/summons.js` - ถ้าบอสมี summoned minions (เช่น BossDog, GoldfishMinion)
- `/js/map.js` - ถ้าต้องการพื้นที่พิเศษสำหรับ boss fight

**⚠️ ข้อควรรู้:**
- Boss ใช้ hierarchy: BossBase → KruManop/KruFirst
- Boss มี Gemini speech integration ผ่าน `speak()` method
- WaveManager ใช้ deterministic boss queue (waves 3,6,9,12,15)

---

### 3. 👾 การเพิ่มศัตรูตัวใหม่
**ไฟล์ที่ต้องแก้ไข:**
- `/js/entities/enemy.js` - เพิ่ม enemy type ใหม่ (Enemy, TankEnemy, MageEnemy pattern)
- `/js/config.js` - เพิ่ม enemy stats, behaviors, spawn rates
- `/js/systems/WaveManager.js` - เพิ่ม enemy ใน wave patterns (trickle system)
- `/js/audio.js` - เพิ่ม enemy sounds (attack, death, hurt)
- `/js/effects.js` - เพิ่ม death effects และ attack visuals

**ไฟล์ที่อาจกระทบ:**
- `/js/ai.js` - ถ้าศัตรูมี AI behavior พิเศษ
- `/js/weapons.js` - ถ้าศัตรูมี weapons พิเศษ

**⚠️ ข้อควรรู้:**
- Enemy มี hit flash system (HIT_FLASH_DURATION = 0.10s)
- Glitch wave ลด damage 40% สำหรับ melee contact
- Enemy ใช้ Entity base class พร้อม health bar rendering

---

### 🏰 การเพิ่มความสามารถของ MTC Room (Safe Zone)
**ไฟล์ที่ต้องแก้ไข:**
- `/js/map.js` - แก้ไข MTCRoom class, เพิ่ม healing mechanics, shield regeneration, buff systems
- `/js/entities/player/PlayerBase.js` - เพิ่ม safe zone detection, healing logic, buff application
- `/js/config.js` - เพิ่ม MTC Room settings (heal rate, shield regen, buff types, duration)
- `/js/effects.js` - เพิ่ม healing visual effects, shield regeneration particles, buff indicators
- `/js/audio.js` - เพิ่ม healing sounds, shield regen sounds, buff activation sounds
- `/js/ui.js` - เพิ่ม safe zone status indicators, buff timers, healing progress bars

**ไฟล์ที่อาจกระทบ:**
- `/js/game.js` - ถ้าต้องการ global safe zone state tracking
- `/js/entities/boss.js` - ถ้าต้องการ boss behavior changes ใน safe zone
- `/js/entities/enemy.js` - ถ้าต้องการ enemy avoidance ของ safe zone

**⚠️ ข้อควรรู้:**
- **MTC Room Bounds:** x: -150→150, y: -700→-460 (ขนาด 300x240)
- **Current Features:** Safe zone protection, boss spawn guard, visual enhancements
- **Potential Abilities:** HP regeneration, shield restoration, speed boost, damage buff, cooldown reduction
- **Visual Feedback:** ต้องมี clear indicators สำหรับ healing, buff activation, safe zone status
- **Balance Considerations:** ต้องคำนึงถึง game balance ไม่ให้ safe zone โดดเด่นเกินไป

**🎯 ไอเดียสำหรับความสามารถใหม่:**
- **Healing Station:** Regenerate HP ตามเวลา (เช่น 5 HP ต่อวินาที)
- **Shield Recharge:** Restore shield energy อัตโนมัติ
- **Buff Terminal:** ให้ temporary buffs (damage boost, speed increase)
- **Cooldown Reset:** Reset skill cooldowns เมื่อเข้า safe zone
- **Ammo Resupply:** Refill ammunition สำหรับตัวละครที่ใช้ ammo
- **Repair Station:** Fix damaged equipment หรือ restore special abilities

---

### 🏰 MTC Room Abilities (🔴 DYNAMIC - Current Implementation v3.11.17)
**⚠️ WARNING:** This section contains **version-specific implementation details** that may change with updates. Always verify against current codebase.

**ไฟล์ที่ต้องแก้ไข:**
- `/js/map.js` - MTCRoom.update() พร้อม buff cycle logic, MTCRoom.draw() พร้อม buff indicators
- `/js/entities/player/PlayerBase.js` - applyMtcBuff() method, buff state tracking, timer management
- `/js/config.js` - BALANCE.mtcRoom settings พร้อม buff cycle configuration
- `/js/audio.js` - playMtcEntry(), playMtcBuff() sound effects
- `/js/effects.js` - spawnParticles() สำหรับ buff visual feedback

**⚠️ ข้อควรรู้ (Current Implementation):**
- **Dash Reset:** รีเซ็ต dash cooldown ทันทีเมื่อเข้า MTC Room
- **Crisis Protocol:** ถ้า HP ≤ 25% ได้รับ +35 HP ทันทีพร้อม visual effects
- **Rotating Buff Terminal:** 3 buffs ที่สลับเปลี่ยนต่อการเข้า (DMG +15%, SPD +10%, CDR BURST -35%)
- **Buff Cycle:** สลับเปลี่ยนอัตโนมัติ (0→1→2→0) ต่อการเข้าแต่ละครั้ง
- **Visual Indicators:** แสดง next buff และ active buff timer บน holo-table
- **Energy Regeneration:** Regenerate energy 30 ต่อวินาทีขณะอยู่ใน MTC Room
- **HP Regeneration:** Regenerate HP 30 ต่อวินาที (ลดจาก 40 เพื่อ balance)

**🔧 Technical Implementation:**
- **Buff State:** player.mtcBuffType, player.mtcBuffTimer, player.mtcDmgBuff, player.mtcSpeedBuff
- **Buff Application:** applyMtcBuff(buffIndex) ใน PlayerBase class
- **Visual Feedback:** spawnParticles(), spawnFloatingText() สำหรับ buff activation
- **Sound Design:** playMtcEntry() (3-note arpeggio), playMtcBuff() (bright ping)
- **UI Integration:** Next buff indicator, active buff progress bar, buff timer display

**📊 Configuration (config.js):**
```javascript
mtcRoom: {
    healRate: 30,
    maxStayTime: 4,
    cooldownTime: 10,
    size: 300,
    dashResetOnEntry: true,
    crisisHpPct: 0.25,
    crisisHealBonus: 35,
    buffCycleDuration: [8, 6, 0],     // DMG, SPD, CDR (วินาที)
    buffCycleMagnitude: [0.15, 0.10, 0.35],
    buffCycleNames: ['DMG +15%', 'SPD +10%', 'CDR BURST'],
    buffCycleColors: ['#f97316', '#22d3ee', '#a78bfa'],
    buffCycleIcons: ['⚔', '💨', '⚡'],
}
```

---

### �� การแก้ไข Visual & สกิลอุกกาบาต MageEnemy
**ไฟล์ที่ต้องแก้ไข:**
- `/js/entities/enemy.js` - แก้ไข MageEnemy class, เพิ่ม spell casting animations, projectile patterns
- `/js/entities/boss_attacks.js` - เพิ่ม meteor spell class ถ้าต้องการ reuse boss attack patterns
- `/js/effects.js` - เพิ่ม spell effects, meteor trails, explosion particles, magic circles
- `/js/audio.js` - เพิ่ม spell casting sounds, meteor impact sounds, magic charge sounds
- `/js/config.js` - เพิ่ม MageEnemy stats, spell damage, cooldowns, visual parameters

**ไฟล์ที่อาจกระทบ:**
- `/js/weapons.js` - ถ้าต้องการ collision detection สำหรับ meteor projectiles
- `/js/map.js` - ถ้าต้องการ environmental effects จาก meteor impact (craters, scorch marks)

**⚠️ ข้อควรรู้:**
- **Meteor Pattern:** ใช้ arc trajectory พร้อม gravity simulation
- **Spell Casting:** มี charge-up animation ก่อน cast meteor
- **Visual Effects:** ใช้ particle systems สำหรับ trails และ explosions
- **Sound Design:** ต้องมี charge sound, whoosh sound, และ impact sound

---

### 🔫 การแก้ไข Weapon System & Projectiles
**ไฟล์ที่ต้องแก้ไข:**
- `/js/weapons.js` - แก้ไข Projectile class, เพิ่ม weapon types, collision detection
- `/js/config.js` - เพิ่ม weapon stats, damage, spread, speed, visual parameters
- `/js/effects.js` - เพิ่ม muzzle flash, bullet trails, impact effects
- `/js/audio.js` - เพิ่ม weapon sounds (shoot, reload, impact)
- `/js/entities/player/[Character].js` - แก้ไข character-specific weapon logic

**ไฟล์ที่อาจกระทบ:**
- `/js/entities/boss.js` - ถ้าต้องการ weapon resistance หรือ special interactions
- `/js/entities/enemy.js` - ถ้าศัตรูมี weapon weakness พิเศษ

**⚠️ ข้อควรรู้:**
- **Spatial Grid:** ใช้ spatial grid สำหรับ projectile collision optimization
- **Poom Special:** Poom bypasses WeaponSystem ยิง rice projectiles โดยตรง
- **Weapon Types:** Assault, Sniper, Shotgun, และ character-specific weapons

---

### 🎵 การอัปเดท Audio System & Music
**ไฟล์ที่ต้องแก้ไข:**
- `/js/audio.js` - เพิ่ม sound effects, BGM tracks, volume controls
- `/js/config.js` - เพิ่ม audio settings, volume levels, sound toggles
- `/js/menu.js` - เพิ่ม audio options ใน settings menu

**ไฟล์ที่อาจกระทบ:**
- `/js/ui.js` - ถ้าต้องการ audio visualizers หรือ sound indicators

**⚠️ ข้อควรรู้:**
- **BGM Namespace:** มีการแก้ไข namespace collision ใน Audio constructor
- **Web Audio API:** ใช้ Web Audio API สำหรับ advanced sound processing
- **Character Sounds:** แต่ละตัวละครมีเสียงพิเศษ (Poom shoot, Naga attack, Stand rush)

---

### 🎮 การแก้ไข Game State & Progression
**ไฟล์ที่ต้องแก้ไข:**
- `/js/GameState.js` - แก้ไข game states, save/load system, progression logic
- `/js/game.js` - แก้ไข main game loop, state transitions, game flow
- `/js/systems/WaveManager.js` - แก้ไข wave progression, difficulty scaling
- `/js/systems/ShopSystem.js` - แก้ไข shop items, pricing, upgrade paths

**ไฟล์ที่อาจกระทบ:**
- `/js/ui.js` - ถ้าต้องการ progression UI หรือ save/load interface
- `/js/menu.js` - ถ้าต้องการ main menu progression display

**⚠️ ข้อควรรู้:**
- **State Management:** GameState เป็น single source of truth
- **Progression:** ใช้ wave-based progression พร้อม boss encounters
- **Save System:** มีระบบบันทึกคะแนน และ achievements

---

### 🎨 การอัปเดท UI & Visual Effects
**ไฟล์ที่ต้องแก้ไข:**
- `/js/ui.js` - แก้ไข HUD elements, achievement popups, UI components
- `/js/effects.js` - เพิ่ม particle effects, screen shake, visual feedback
- `/css/main.css` - แก้ไข styles, animations, responsive design
- `/js/rendering/PlayerRenderer.js` - แก้ไข player visual effects, rendering logic

**ไฟล์ที่อาจกระทบ:**
- `/js/menu.js` - ถ้าต้องการ menu visual enhancements
- `/js/game.js` - ถ้าต้องการ screen effects หรือ post-processing

**⚠️ ข้อควรรู้:**
- **Military HUD Theme:** ใช้ military-style UI พร้อม scanlines และ hex grid
- **Particle Pooling:** ใช้ object pooling สำหรับ performance optimization
- **Achievement System:** มี popup notifications และ progress tracking

---

### 4. ⚔️ การเพิ่มอาวุธใหม่ให้กับตัวละครหนึ่ง
**ไฟล์ที่ต้องแก้ไข:**
- `/js/weapons.js` - เพิ่ม weapon class ใหม่, Projectile class พร้อม spatial grid optimization
- `/js/config.js` - เพิ่ม weapon stats ใน `BALANCE.characters[char].weapons`, projectile types
- `/js/entities/player/[TargetCharacter].js` - เพิ่ม weapon ใน character's weapon list
- `/js/audio.js` - เพิ่ม weapon sounds (fire, reload, hit)
- `/js/effects.js` - เพิ่ม muzzle flash, projectile effects

**ไฟล์ที่อาจกระทบ:**
- `/js/rendering/PlayerRenderer.js` - ถ้าต้องการ weapon rendering พิเศษ
- `/js/ui.js` - ถ้าต้องการ weapon UI indicators

**⚠️ ข้อควรรู้:**
- Weapons.js ใช้ spatial grid สำหรับ collision optimization (O(E) build, O(P×k) query)
- Poom bypasses WeaponSystem และยิงโดยตรงผ่าน PoomPlayer.shoot()
- Projectile ใช้ object pooling สำหรับ performance

---

### 5. ✨ การเพิ่มความสามารถใหม่ให้กับตัวละครหนึ่ง (สกิลกดใช้)
**ไฟล์ที่ต้องแก้ไข:**
- `/js/entities/player/[TargetCharacter].js` - เพิ่ม skill method ใหม่
- `/js/config.js` - เพิ่ม skill stats (cooldown, damage, duration)
- `/js/audio.js` - เพิ่ม skill sounds
- `/js/effects.js` - เพิ่ม skill visual effects
- `/js/ui.js` - เพิ่ม skill cooldown indicators
- `/js/input.js` - เพิ่ม key binding สำหรับ skill ใหม่ (ถ้าจำเป็น)

**ไฟล์ที่อาจกระทบ:**
- `/js/rendering/PlayerRenderer.js` - ถ้า skill มี animation พิเศษ

**⚠️ ข้อควรรู้:**
- Input system ใช้ global `keys` object: keys.w, a, s, d, space, q, e, b, t, f, r, shift
- Skills ใช้ cooldown system ผ่าน `this.cooldowns` object

---

### 6. 🌟 การเพิ่มความสามารถใหม่ให้กับทุกตัวละคร (ความสามารถพื้นฐาน)

#### 6.1 สกิลกดใช้ (Active Skills)
**ไฟล์ที่ต้องแก้ไข:**
- `/js/entities/player/PlayerBase.js` - เพิ่ม base skill method
- `/js/entities/player/Kaoplayer.js` - เพิ่ม implementation สำหรับเก้า
- `/js/entities/player/PoomPlayer.js` - เพิ่ม implementation สำหรับภูมิ
- `/js/entities/player/AutoPlayer.js` - เพิ่ม implementation สำหรับออโต้
- `/js/config.js` - เพิ่ม skill stats สำหรับทุกตัวละคร
- `/js/input.js` - เพิ่ม key binding สำหรับ skill ใหม่
- `/js/ui.js` - เพิ่ม skill UI สำหรับทุกตัวละคร
- `/js/audio.js` - เพิ่ม skill sounds สำหรับทุกตัวละคร
- `/js/effects.js` - เพิ่ม visual effects สำหรับทุกตัวละคร

#### 6.2 สกิลติดตัว (Passive Abilities)
**ไฟล์ที่ต้องแก้ไข:**
- `/js/entities/player/PlayerBase.js` - เพิ่ม passive ability logic
- `/js/entities/player/[Character].js` - เพิ่ม character-specific passive bonuses
- `/js/config.js` - เพิ่ม passive stats และ modifiers
- `/js/rendering/PlayerRenderer.js` - เพิ่ม visual indicators สำหรับ passive effects
- `/js/ui.js` - เพิ่ม passive ability icons ใน HUD

**ความแตกต่างของสกิลประเภทต่างๆ:**
- **สกิลกดใช้:** ต้องการ input handling, cooldown management, visual effects
- **สกิลติดตัว:** ทำงานอัตโนมัติ, มักเป็น stat modifiers หรือ trigger effects

**⚠️ ข้อควรรู้:**
- Player มี built-in passive: damageBoost, speedBoost, speedBoostTimer
- Passive effects แสดงผลผ่าน PlayerRenderer visual indicators

---

### 7. 🗺️ การอัปเดทแผนที่ / Visual ของแมพ
**ไฟล์ที่ต้องแก้ไข:**
- `/js/map.js` - แก้ไข collision boundaries, spawn points, visual elements, drawing helpers
- `/js/effects.js` - เพิ่ม background effects, environmental particles, weather system
- `/js/config.js` - เพิ่ม map configuration ใหม่ (`BALANCE.map`, `MAP_CONFIG`)
- `/css/main.css` - เพิ่ม styles สำหรับ map elements (ถ้ามี HTML elements)

**ไฟล์ที่อาจกระทบ:**
- `/js/game.js` - ถ้ามีการเปลี่ยนแปลง game boundaries
- `/js/entities/boss.js` - ถ้า boss fight มีผลต่อ environment
- `/js/entities/boss_attacks.js` - ถ้า boss attacks มีผลต่อ environment (เช่น DeadlyGraph ของบอสมานพสร้างความเสียหายต่อ environment ได้)

**⚠️ ข้อควรรู้:**
- Map มี architectural zones: Server Aisles (East), Library Maze (West), Symmetry Courtyard (South)
- Weather system อยู่ใน effects.js (rain, snow, none)
- Map ใช้ drawing helpers: drawDesk(), drawTree()

---

### 🐛 การแก้ไขปัญหา Boss Spawn ใน MTC Room (🟢 STABLE - Core Issue, 🔴 DYNAMIC - Specific Values)
**ไฟล์ที่ต้องแก้ไข:**
- `/js/config.js` - ปรับ spawnY ให้พ้น MTC Room bounds (จาก -600 เป็น -330)
- `/js/entities/boss.js` - เพิ่ม runtime guard ใน BossBase constructor ตรวจสอบ MTC Room collision
- `/js/map.js` - อัปเกรด visual MTCRoom (เพิ่ม header, columns, hologram, ambient orbs)

**ไฟล์ที่อาจกระทบ:**
- `/js/systems/WaveManager.js` - ถ้าต้องปรับ boss spawn timing หรือ positioning

**⚠️ ข้อควรรู้ (🔴 DYNAMIC - May Change):**
- **MTC Room bounds:** x: -150→150, y: -700→-460 (ขนาด 300x240) - *Unlikely to change*
- **ปัญหาเดิม:** บอส spawn ที่ (0, -600) = ใจกลางห้อง MTC Room ทำให้ผู้เล่นโจมตีฟรีได้ - *Core issue stable*
- **Safe spawn Y:** -330 (ใต้ห้อง + buffer 130px) - *May be adjusted*
- **Runtime guard:** ตรวจสอบ spawn position ใน BossBase constructor และ eject ออกทางทิศใต้ถ้าชน - *Implementation stable*
- **Visual upgrade:** Diamond grid floor, "MTC CITADEL" header, corner pillars, double-ring hologram, ambient orbs, hex tile forcefield - *May change*

---

### 🔄 การ Refactor โค้ดขนาดใหญ่ (🟢 STABLE - Architecture Pattern)

**วัตถุประสงค์:** เขียน comment อธิบายรายละเอียดในไฟล์สำคัญ และทำให้โค้ดอ้างอิงถึงกันได้ง่าย โดยไม่กระทบการทำงาน

**ไฟล์ที่ต้องแก้ไข:**
- ไฟล์หลักทั้งหมดใน `js/` ที่เป็น core logic
- ไฟล์ config และ routing
- ไฟล์ UI และ rendering

**⚠️ ข้อควรรู้:**
- **ไม่เปลี่ยน logic:** แค่เพิ่ม comment และ documentation
- **ไม่กระทบ performance:** เป็นเพียงการเพิ่มข้อความอธิบาย
- **เพิ่มความเข้าใจ:** ทำให้ AI และ developer เข้าใจโค้ดได้ง่ายขึ้น

**🔧 Technical Implementation:**

**1. สร้าง File Header Template:**
```javascript
/**
 * FILE: [filename.js]
 * ROLE: [primary responsibility]
 * DEPENDENCIES: [files this depends on]
 * DEPENDENTS: [files that depend on this]
 * 
 * DESCRIPTION:
 * [detailed description of what this file does]
 * 
 * KEY FUNCTIONS:
 * - [functionName]: [brief description]
 * - [functionName]: [brief description]
 * 
 * DATA FLOW:
 * Input → [process] → Output
 * 
 * LAST UPDATED: v3.11.18
 */
```

**2. สร้าง Function Documentation:**
```javascript
/**
 * [function description]
 * @param {[type]} [paramName] - [description]
 * @returns {[type]} - [description]
 * @dependencies {[functions/classes it calls]}
 * @used-by {[functions/classes that call this]}
 */
```

**3. สร้าง Cross-Reference System:**
```javascript
// CROSS-REFERENCES:
// Uses: GameState.js (for player state), Audio.js (for sounds)
// Used by: PlayerRenderer.js (for rendering), UI.js (for HUD updates)
```

**🎯 ไฟล์ที่ต้อง Refactor (Priority Order):**

**Tier 1: Core Systems**
- `js/game.js` - Main game loop and initialization
- `js/systems/GameState.js` - Central state management
- `js/config.js` - All configuration constants

**Tier 2: Entity Systems**
- `js/entities/base.js` - Base entity class
- `js/entities/player/PlayerBase.js` - Player base class
- `js/entities/player/[Character].js` - Specific character implementations
- `js/entities/enemy.js` - Enemy entity system
- `js/entities/boss.js` - Boss system

**Tier 3: Rendering & Visual**
- `js/rendering/PlayerRenderer.js` - Player rendering
- `js/rendering/BossRenderer.js` - Boss rendering
- `js/effects.js` - Particle and visual effects

**Tier 4: Game Systems**
- `js/weapons.js` - Weapon and projectile system
- `js/input.js` - Input handling
- `js/audio.js` - Audio system
- `js/ui.js` - User interface

**Tier 5: Map & Environment**
- `js/map.js` - Map rendering and MTC Room
- `js/systems/WaveManager.js` - Wave management

**📝 Documentation Standards:**

**File Header Requirements:**
- **Purpose:** 1-2 sentences อธิบายหน้าที่หลัก
- **Dependencies:** รายการไฟล์ที่ import หรืออ้างอิง
- **Dependents:** รายการไฟล์ที่อ้างอิงถึงไฟล์นี้
- **Key Functions:** รายการ function สำคัญพร้อมคำอธิบายสั้นๆ
- **Data Flow:** อธิบายการไหลของข้อมูล

**Function Documentation Requirements:**
- **Purpose:** อธิบายว่า function ทำอะไร
- **Parameters:** รายการ parameter พร้อม type และ description
- **Returns:** ค่าที่ return พร้อม type และ description
- **Dependencies:** function อื่นที่เรียกใช้
- **Used By:** function อื่นที่เรียก function นี้

**🔍 Cross-Reference Examples:**

**ใน PlayerBase.js:**
```javascript
/**
 * FILE: PlayerBase.js
 * ROLE: Base class for all player characters
 * DEPENDENCIES: GameState.js, Audio.js, effects.js
 * DEPENDENTS: KaoPlayer.js, AutoPlayer.js, PoomPlayer.js
 * 
 * CROSS-REFERENCES:
 * Uses: config.js (for BALANCE.characters), audio.js (playSound)
 * Used by: PlayerRenderer.js (rendering), ui.js (HUD updates)
 */
```

**ใน map.js:**
```javascript
/**
 * FILE: map.js
 * ROLE: Map rendering and environment management
 * DEPENDENCIES: config.js, effects.js
 * DEPENDENTS: game.js (main loop), entities (for collision)
 * 
 * CROSS-REFERENCES:
 * Uses: config.js (MAP_CONFIG, BALANCE.map)
 * Used by: PlayerBase.js (collision), Enemy.js (pathfinding)
 */
```

**⚡ Implementation Strategy:**

**Phase 1: Core Documentation (1-2 hours)**
- Add file headers to Tier 1 files
- Document main functions in core systems
- Create cross-reference mapping

**Phase 2: Entity Documentation (2-3 hours)**
- Add file headers to Tier 2 files
- Document entity lifecycle methods
- Update cross-references

**Phase 3: System Documentation (2-3 hours)**
- Add file headers to Tier 3-4 files
- Document system interactions
- Verify cross-reference accuracy

**Phase 4: Validation (1 hour)**
- Test that all documentation is accurate
- Verify cross-references are correct
- Ensure no functional changes were made

**🎯 Expected Outcomes:**
- **AI Understanding:** AI สามารถเข้าใจความสัมพันธ์ระหว่างไฟล์ได้ทันที
- **Developer Onboarding:** Developer ใหม่เข้าใจโครงสร้างได้เร็วขึ้น
- **Maintenance:** การแก้ไขโค้ดทำได้ง่ายขึ้นเพราะรู้ dependency
- **Zero Risk:** ไม่มีการเปลี่ยนแปลง logic ทำให้ปลอดภัย

---

### 🔧 การแก้ไขปัญหาข้อความซ้อนกันในเกม (🟢 STABLE - UI Fix)

**วัตถุประสงค์:** แก้ไขปัญหาข้อความแจ้งเตือน (damage, healing, buff activation) ที่ซ้อนทับกันในเกม

**ไฟล์ที่ต้องแก้ไข:**
- `js/effects.js` - แก้ FloatingTextSystem.spawn() เพิ่ม stack-offset logic

**⚠️ ข้อควรรู้:**
- **ปัญหา:** ข้อความแจ้งเตือน (damage, healing, buff activation) แสดงผลซ้อนทับกัน
- **สาเหตุ:** FloatingTextSystem.spawn() ไม่มี stack-offset logic - text หลายตัวที่ spawn จาก (x,y) เดียวกันพร้อมกันจะทับกันทันที
- **ผลกระทบ:** ข้อความบางส่วนมองไม่เห็น หรืออ่านไม่ออก
- **ระบบ:** Canvas-based 100% - ไม่ใช่ DOM elements, CSS z-index ใช้ไม่ได้

**🔧 Technical Implementation (Canvas-based Solution):**

**✅ การแก้ไขที่ถูกต้อง:**
```javascript
// ใน js/effects.js ที่ FloatingTextSystem.spawn()
spawn(text, x, y, color, size = 20) {
    // ── STACK OFFSET: prevent overlap when multiple texts spawn at same pos ──
    // Count live texts within CLUSTER_R world-units horizontally.
    // Each one pushes the new text up by STEP_Y world-units.
    // Cap at MAX_STACK to avoid texts flying off screen.
    const CLUSTER_R = 40;   // world px horizontal proximity threshold
    const STEP_Y = 22;   // world px per stacked text
    const MAX_STACK = 5;

    let stack = 0;
    for (let i = 0, len = this.texts.length; i < len; i++) {
        const t = this.texts[i];
        if (Math.abs(t.x - x) < CLUSTER_R && Math.abs(t.y - y) < CLUSTER_R * 2) {
            stack++;
            if (stack >= MAX_STACK) break;
        }
    }
    const spawnY = y - stack * STEP_Y;

    // ── POOL: reuse a dead instance instead of allocating ──
    this.texts.push(FloatingText.acquire(text, x, spawnY, color, size));
}
```

**❌ สิ่งที่ไม่ควรทำ (DOM-based Solutions):**
- ไม่ต้องสร้าง NotificationManager class
- ไม่ต้องใช้ CSS z-index (ไม่มี DOM elements)
- ไม่ต้องใช้ DOM querySelectorAll
- ไม่ต้องแก้ไฟล์ ui.js, main.css, PlayerBase.js

**🎯 ทำไมการแก้ไขนี้ทำงานได้:**

**✅ เหมาะกับระบบ Canvas:**
- **FloatingText.y คือ world-coordinate** → offset 22px = ระยะที่มองเห็นชัดในทุก zoom level
- **ตรวจ live texts ใน this.texts[] โดยตรง** → O(n) แต่ n ≤ 80 ไม่กระทบ FPS
- **ไม่สร้าง object ใหม่** → ไม่ setTimeout, ไม่แตะ pool pattern เดิม

**✅ Performance:**
- **O(n) check** แต่ n มีขีดจำกัด (max 80 texts)
- **ไม่มี garbage collection** ใช้ object pool อยู่แล้ว
- **ไม่มี DOM manipulation** ทำงานใน Canvas เท่านั้น

**✅ Simplicity:**
- **แก้ไฟล์เดียว** - `js/effects.js` เพียงไฟล์เดียว
- **ไม่ต้องสร้าง class ใหม่** - ใช้โครงสร้างเดิม
- **ไม่ต้องแก้ไฟล์อื่น** - ไม่แตะ ui.js, main.css, PlayerBase.js

**🔍 ไฟล์ที่ต้องตรวจสอบและแก้ไข:**

**1. js/effects.js (เพียงไฟล์เดียว)**
- แก้ `FloatingTextSystem.spawn()` method
- เพิ่ม stack-offset logic 15 บรรทัด
- ใช้ world coordinates และ object pool อยู่แล้ว

**🎯 Expected Results:**
- **ไม่มีการซ้อนทับ:** ข้อความจะเลื่อนขึ้นอย่างสวยงาม (22px ต่อชั้น)
- **อ่านง่าย:** ข้อความทั้งหมดมองเห็นชัดเจน
- **Performance:** ไม่กระทบ FPS (O(n) แต่ n ≤ 80)
- **Maintainable:** แก้ไฟล์เดียว 15 บรรทัด ง่ายต่อการบำรุงรักษา
- **Canvas-compatible:** ทำงานได้ดีกับระบบ Canvas-based 100%

**⚡ Quick Implementation:**
แก้เพียง `FloatingTextSystem.spawn()` ใน `js/effects.js` เพิ่ม 15 บรรทัด stack-offset logic เท่านั้น

---

### 5. 🎮 การเพิ่มตัวละครใหม่ (🟢 STABLE)
**ไฟล์ที่ต้องแก้ไข:**
- `/js/entities/player/[NewCharacter].js` - สร้าง class ตัวละครใหม่ สืบทอบจาก `PlayerBase.js`
- `/js/config.js` - เพิ่ม character stats ใน `BALANCE.characters.[newChar]`, abilities, weapons config
- `/js/rendering/PlayerRenderer.js` - เพิ่ม rendering method `_draw[NewChar](entity, ctx)` และ update dispatcher
- `/js/menu.js` - เพิ่มตัวละครใน character selection menu (selectCharacter function)
- `/js/ui.js` - เพิ่ม UI elements สำหรับตัวละคร (HUD, skill icons, achievement system)
- `/js/audio.js` - เพิ่ม sound effects สำหรับ abilities/weapons (character-specific sounds)
- `/css/main.css` - เพิ่ม styles สำหรับ UI elements ใหม่

**ไฟล์ที่อาจกระทบ:**
- `/js/game.js` - ถ้าต้องการ character-specific game mechanics
- `/js/effects.js` - ถ้าต้องการ character-specific visual effects

**⚠️ ข้อควรรู้ (🟢 STABLE):**
- **PlayerBase:** ตัวละครใหม่ต้องสืบทอดจาก PlayerBase class
- **Rendering:** ใช้ PlayerRenderer.draw() dispatcher pattern
- **Character Selection:** ใช้ selectCharacter() function ใน menu.js
- **Config Structure:** ต้องเพิ่มใน BALANCE.characters.[newChar]

---

### 6. 👑 การเพิ่มบอสใหม่ (🟢 STABLE)
**ไฟล์ที่ต้องแก้ไข:**
- `/js/entities/boss.js` - สร้าง boss class ใหม่ สืบทอบจาก `BossBase.js`
- `/js/entities/boss_attacks.js` - สร้าง attack patterns และ abilities ใหม่
- `/js/config.js` - เพิ่ม boss stats, phases, drop rates
- `/js/systems/WaveManager.js` - เพิ่ม boss spawn logic ใน wave ที่กำหนด (deterministic queue)
- `/js/audio.js` - เพิ่ม boss music, attack sounds, death sounds

**ไฟล์ที่อาจกระทบ:**
- `/js/entities/summons.js` - ถ้าบอสมี summoned minions (เช่น BossDog, GoldfishMinion)
- `/js/map.js` - ถ้าต้องการพื้นที่พิเศษสำหรับ boss fight

**⚠️ ข้อควรรู้ (🟢 STABLE):**
- **Boss ใช้ hierarchy:** BossBase → KruManop/KruFirst
- **Boss มี Gemini speech integration** ผ่าน `speak()` method
- **WaveManager ใช้ deterministic boss queue** (waves 3,6,9,12,15)

---

### 7. 🎮 การอัปเดท Main Menu (Start Game & Game Over) (🟡 SEMI-DYNAMIC)
**ไฟล์ที่ต้องแก้ไข:**
- `/js/menu.js` - แก้ไข menu layout, navigation, animations, character selection
- `/js/ui.js` - เพิ่ม UI components ใหม่สำหรับ menu, achievement system
- `/css/main.css` - เพิ่ม styles สำหรับ menu elements
- `/js/audio.js` - เพิ่ม menu music, button sounds
- `/index.html` - ถ้าต้องการเพิ่ม HTML elements ใหม่

**ไฟล์ที่อาจกระทบ:**
- `/js/game.js` - ถ้ามีการเปลี่ยนแปลง game state transitions

**⚠️ ข้อควรรู้:**
- Menu system ใช้ selectCharacter(charType) function
- Portrait system ใช้ window.PORTRAITS object
- Achievement popup แสดงผลผ่าน UIManager

---

### 9. 🌊 การเพิ่ม Wave Events ใหม่
**ไฟล์ที่ต้องแก้ไข:**
- `/js/systems/WaveManager.js` - เพิ่ม wave event type ใหม่, special event logic
- `/js/config.js` - เพิ่ม wave event configuration, modifiers
- `/js/effects.js` - เพิ่ม visual effects สำหรับ wave event (glitch effect)
- `/js/audio.js` - เพิ่ม wave event music และ sound effects
- `/js/ui.js` - เพิ่ม wave event notifications และ indicators

**ไฟล์ที่อาจกระทบ:**
- `/js/entities/enemy.js` - ถ้า wave event มีผลต่อ enemy behavior
- `/js/entities/player/PlayerBase.js` - ถ้า wave event มีผลต่อ player abilities

**⚠️ ข้อควรรู้:**
- Current events: Glitch (every 5 waves), Fog (waves 2,8,11,14), Speed (waves 4,7,13), Dark (wave 1)
- WaveManager ใช้ deterministic schedule และ trickle system
- Glitch wave inverts controls และ reduces enemy damage 40%

---

### 10. 🛒 การเพิ่มระบบร้านค้า (Shop System)
**ไฟล์ที่ต้องแก้ไข:**
- `/js/systems/ShopSystem.js` - เพิ่ม items, prices, categories, shop drawing logic
- `/js/config.js` - เพิ่ม shop configuration, item stats
- `/js/ui.js` - เพิ่ม shop UI, item displays, purchase buttons
- `/js/audio.js` - เพิ่ม shop sounds (purchase, select)
- `/css/main.css` - เพิ่ม shop styles, animations

**ไฟล์ที่อาจกระทบ:**
- `/js/systems/GameState.js` - สำหรับ player currency/inventory
- `/js/entities/player/PlayerBase.js` - สำหรับ applying purchased upgrades

**⚠️ ข้อควรรู้:**
- Shop location: MTC_SHOP_LOCATION = {x: -350, y: 350, INTERACTION_RADIUS: 90}
- Shop ใช้ proximity interaction system
- Shop items ส่งผลต่อ player stats ผ่าน upgrade application

---

### 11. 🏆 การเพิ่มระบบ Achievement
**ไฟล์ที่ต้องแก้ไข:**
- `/js/ui.js` - เพิ่ม achievement definitions ใน AchievementSystem class, notifications, display panels
- `/js/config.js` - เพิ่ม achievement definitions, conditions (`ACHIEVEMENT_DEFS`)
- `/js/audio.js` - เพิ่ม achievement unlock sounds
- `/css/main.css` - เพิ่ม achievement popup styles

**ไฟล์ที่อาจกระทบ:**
- `/js/menu.js` - ถ้าต้องการ achievement menu
- `/js/game.js` - สำหรับ achievement trigger events

**⚠️ ข้อควรรู้:**
- AchievementSystem อยู่ใน `/js/ui.js` ไม่ใช่ไฟล์แยก
- Achievement data บันทึกผ่าน getSaveData()/setSaveData() functions
- Achievement unlock แสดงผลผ่าน UIManager popup

---

### 🔧 CRITICAL TECHNICAL NOTES (100% Accuracy)

#### 📁 File Structure Reality Check:
- **AchievementSystem**: Located in `/js/ui.js` (class AchievementSystem)
- **PlayerRenderer**: Uses pattern `_draw[CharName]()` with instanceof dispatcher
- **Weapon System**: Poom bypasses WeaponSystem, shoots directly via PoomPlayer.shoot()
- **Audio System**: Has BGM namespace collision fix, uses Web Audio API
- **Input System**: Global `keys` object with specific key bindings
- **Wave System**: Uses deterministic schedule + trickle spawning
- **Enemy System**: Has hit flash (0.10s) + glitch wave damage reduction (40%)

#### 🔐 Passive Unlock Architecture (CRITICAL — อ่านก่อนแตะ passive system):
- **`PlayerBase.checkPassiveUnlock()`** คือ base implementation — ตรวจ `stealthUseCount >= passiveUnlockStealthCount` เหมาะกับ Kao เท่านั้น
- **ตัวละครที่ไม่มี stealth (Poom, Auto) MUST override `checkPassiveUnlock()`** ไม่งั้น unlock ไม่ได้เลย
- **`config.js` ต้องมี `passiveUnlockText`** ต่อแต่ละตัวละคร — `checkPassiveUnlock()` ทุก override ใช้ `S.passiveUnlockText ?? 'fallback'` แทน hardcode
- **`passiveUnlockStealthCount: 0`** สำหรับ Auto/Poom (ไม่มี stealth) — ห้ามใช้ `99` อีก (จะ unlock ไม่ได้)
- **Passive behaviour flags** ใน constructor ทุกตัวละคร — override ใน subclass แทน `instanceof` checks:
  - `this.passiveSpeedBonus = N` — speed mult ที่ได้หลัง passive unlock (0 = ไม่มี)
  - `this.usesOwnLifesteal = bool` — `true` = subclass จัดการ lifesteal เอง ไม่ใช้ base
- **Dev Mode ไม่ unlock passive อีกต่อไป** — `startGame()` เรียก `player.applyDevBuff()` แทน (ทุกตัวละคร) passive ต้องปลดเองในเกมตามปกติเท่านั้น

#### 🎮 Skill Lock Input Routing (Poom-specific):
- **`eatRice` (R-Click)**: route จาก **`game.js`** — lock check อยู่ใน game.js Poom block
- **E (Garuda) / R (Ritual) / Q (Naga)**: route จาก **`PoomPlayer.update()`** ทั้งหมด
- **ไม่มี Q block ซ้ำใน game.js** — การ consume Q ทำที่เดียวใน `PoomPlayer.update()` เท่านั้น

#### 🎮 Core Architecture Patterns:
- **Entity Hierarchy**: Entity → Player/BossBase → Character classes
- **Rendering Decoupling**: PlayerRenderer.draw() dispatcher → specific methods
- **State Management**: GameState singleton + window.gameState compatibility
- **Object Pooling**: Effects.js particles, FloatingText, OrbitalParticle
- **Spatial Optimization**: Weapons.js spatial grid for collision detection
- **No `instanceof` in PlayerBase**: ใช้ flags (`passiveSpeedBonus`, `usesOwnLifesteal`) แทน `instanceof KaoPlayer` checks ใน base class

#### 🗂️ Configuration Structure:
```javascript
BALANCE.characters[charId] = {
    hp, maxHp, energy, maxEnergy, moveSpeed, dashSpeed,
    weapons: { weaponName: { damage, cooldown, range, speed, spread, color, icon } }
}
BALANCE.map = { mapColors, objects: { desk, tree } }
MAP_CONFIG = { objects: { desk, tree } }
```

#### 🎯 Key Integration Points:
- **Menu → Game**: selectCharacter() → window.selectedChar → startGame()
- **Game → UI**: AchievementSystem.unlock() → UIManager popup
- **Input → Player**: keys object → character skill methods
- **Wave → Enemies**: WaveManager.spawn() → window.enemies array
- **Audio → All**: Audio global instance with namespace protection

---

### 12. 🎯 การเพิ่ม Projectile Types ใหม่
**ไฟล์ที่ต้องแก้ไข:**
- `/js/weapons.js` - เพิ่ม projectile class ใหม่
- `/js/config.js` - เพิ่ม projectile stats, behaviors
- `/js/effects.js` - เพิ่ม projectile trail effects, impact effects
- `/js/audio.js` - เพิ่ม projectile sounds (launch, impact)
- `/js/map.js` - ถ้า projectile มีผลต่อ environment

**ไฟล์ที่อาจกระทบ:**
- `/js/rendering/PlayerRenderer.js` - ถ้า projectile มี rendering พิเศษ

---

### 13. 💎 การเพิ่ม Power-ups & Pickups
**ไฟล์ที่ต้องแก้ไข:**
- `/js/entities/summons.js` - สร้าง power-up entities
- `/js/config.js` - เพิ่ม power-up types, effects, duration
- `/js/effects.js` - เพิ่ม power-up visual effects, glow effects
- `/js/audio.js` - เพิ่ม power-up pickup sounds
- `/js/entities/player/PlayerBase.js` - เพิ่ม power-up application logic
  - **`applyDevBuff()`** — Dev Mode stat package (HP+50%, EN+50%, DMG×1.25, SPD×1.20, CDR×0.60, Crit+8%, cooldowns reset)

**ไฟล์ที่อาจกระทบ:**
- `/js/systems/WaveManager.js` - ถ้าต้องการ power-up spawn logic
- `/js/ui.js` - สำหรับ power-up status indicators

---

### 14. 🎨 การเพิ่ม Themes & Skins
**ไฟล์ที่ต้องแก้ไข:**
- `/js/config.js` - เพิ่ม theme configurations, color schemes
- `/css/main.css` - เพิ่ม theme styles, color variables
- `/js/rendering/PlayerRenderer.js` - เพิ่ม skin rendering logic
- `/js/ui.js` - เพิ่ม theme selection UI
- `/js/menu.js` - เพิ่ม theme/skin selection menu

**ไฟล์ที่อาจกระทบ:**
- `/js/effects.js` - ถ้า theme มีผลต่อ visual effects

---

### 15. 📊 การเพิ่ม Statistics & Analytics
**ไฟล์ที่ต้องแก้ไข:**
- `/js/systems/GameState.js` - เพิ่ม stats tracking logic
- `/js/ui.js` - เพิ่ม stats display panels, charts
- `/js/config.js` - เพิ่ม stats configuration
- `/js/menu.js` - เพิ่ม stats viewing menu
- `/css/main.css` - เพิ่ม stats display styles

**ไฟล์ที่อาจกระทบ:**
- `/js/game.js` - สำหรับ stats collection events

---

### 16. 🎪 การเพิ่ม Game Modes ใหม่
**ไฟล์ที่ต้องแก้ไข:**
- `/js/game.js` - เพิ่ม game mode logic, win/lose conditions
- `/js/systems/WaveManager.js` - เพิ่ม mode-specific wave patterns
- `/js/config.js` - เพิ่ม game mode configurations
- `/js/menu.js` - เพิ่ม game mode selection
- `/js/ui.js` - เพิ่ม mode-specific UI elements

**ไฟล์ที่อาจกระทบ:**
- `/js/systems/GameState.js` - สำหรับ mode state management

---

### 17. 🤖 การเพิ่ม AI Companions / Pets
**ไฟล์ที่ต้องแก้ไข:**
- `/js/entities/summons.js` - สร้าง companion entities
- `/js/ai.js` - เพิ่ม companion AI behaviors
- `/js/config.js` - เพิ่ม companion stats, abilities
- `/js/entities/player/PlayerBase.js` - เพิ่ม companion management
- `/js/input.js` - เพิ่ม companion command controls

**ไฟล์ที่อาจกระทบ:**
- `/js/rendering/PlayerRenderer.js` - สำหรับ companion rendering
- `/js/ui.js` - สำหรับ companion status UI

---

### 18. 🔧 การเพิ่ม Environmental Objects
**ไฟล์ที่ต้องแก้ไข:**
- `/js/map.js` - เพิ่ม environmental objects, obstacles
- `/js/config.js` - เพิ่ม object configurations, interactions
- `/js/effects.js` - เพิ่ม object destruction effects
- `/js/audio.js` - เพิ่ม object interaction sounds
- `/js/entities/base.js` - ถ้าต้องการ object collision logic

**ไฟล์ที่อาจกระทบ:**
- `/js/game.js` - สำหรับ object update logic

---

### 19. 🎭 การเพิ่ม Cutscenes & Story Elements
**ไฟล์ที่ต้องแก้ไข:**
- `/js/game.js` - เพิ่ม cutscene trigger logic
- `/js/ui.js` - เพิ่ม dialog boxes, story text
- `/js/audio.js` - เพิ่ม cutscene music, voice lines
- `/js/config.js` - เพิ่ม story data, dialog scripts
- `/css/main.css` - เพิ่ม dialog box styles

**ไฟล์ที่อาจกระทบ:**
- `/js/menu.js` - ถ้าต้องการ story viewing menu

---

### 20. 🌐 การเพิ่ม Multiplayer Features
**ไฟล์ที่ต้องแก้ไข:**
- `/js/game.js` - เพิ่ม network sync logic
- `/js/systems/GameState.js` - เพิ่ม multiplayer state management
- `/js/input.js` - เพิ่ม network input handling
- `/js/ui.js` - เพิ่ม lobby UI, player lists
- `/js/config.js` - เพิ่ม multiplayer configuration

**ไฟล์ที่อาจกระทบ:**
- **ทุก entity files** - สำหรับ network synchronization
- **Server files** - ถ้าต้องการ dedicated server

---

### 21. 📱 การเพิ่ม Mobile Support
**ไฟล์ที่ต้องแก้ไข:**
- `/js/input.js` - เพิ่ม touch controls, gesture handling
- `/js/ui.js` - เพิ่ม mobile-optimized UI, virtual controls
- `/css/main.css` - เพิ่ม responsive design, mobile layouts
- `/js/config.js` - เพิ่ม mobile-specific settings
- `/index.html` - เพิ่ม mobile viewport settings

**ไฟล์ที่อาจกระทบ:**
- `/js/audio.js` - สำหรับ mobile audio optimization

---

### 22. 🎛️ การเพิ่ม Settings & Options
**ไฟล์ที่ต้องแก้ไข:**
- `/js/menu.js` - เพิ่ม settings menu
- `/js/config.js` - เพิ่ม settings configuration, defaults
- `/js/ui.js` - เพิ่ม settings UI, sliders, toggles
- `/js/audio.js` - เพิ่ม volume controls, audio settings
- `/js/game.js` - เพิ่ม settings application logic

**ไฟล์ที่อาจกระทบ:**
- **ทุกไฟล์** - สำหรับ applying settings changes

---

### 23. 🔍 การเพิ่ม Tutorial System
**ไฟล์ที่ต้องแก้ไข:**
- `/js/tutorial.js` - เพิ่ม tutorial steps, triggers
- `/js/ui.js` - เพิ่ม tutorial overlays, hints
- `/js/config.js` - เพิ่ม tutorial configuration
- `/js/menu.js` - เพิ่ม tutorial access menu
- `/js/game.js` - เพิ่ม tutorial state management

**ไฟล์ที่อาจกระทบ:**
- `/js/input.js` - สำหรับ tutorial input handling

---

### 24. 🌟 การเพิ่ม Special Effects & Particles
**ไฟล์ที่ต้องแก้ไข:**
- `/js/effects.js` - เพิ่ม particle systems, visual effects
- `/js/config.js` - เพิ่ม effect configurations, parameters
- `/js/rendering/PlayerRenderer.js` - เพิ่ม character-specific effects
- `/js/audio.js` - เพิ่ม effect sounds
- `/css/main.css` - เพิ่ม CSS animations สำหรับ effects

**ไฟล์ที่อาจกระทบ:**
- **ทุก entity file** - สำหรับ effect triggers

---

### 25. 🎪 การเพิ่ม Mini-Games
**ไฟล์ที่ต้องแก้ไข:**
- `/js/game.js` - เพิ่ม mini-game state management
- `/js/config.js` - เพิ่ม mini-game configurations
- `/js/ui.js` - เพิ่ม mini-game UI, controls
- `/js/input.js` - เพิ่ม mini-game specific controls
- `/js/audio.js` - เพิ่ม mini-game music, sounds

**ไฟล์ที่อาจกระทบ:**
- `/js/menu.js` - สำหรับ mini-game selection

---

### 26. 🔊 การเพิ่ม Dynamic Audio System
**ไฟล์ที่ต้องแก้ไข:**
- `/js/audio.js` - เพิ่ม adaptive music, dynamic sound effects
- `/js/config.js` - เพิ่ม audio configuration, intensity levels
- `/js/game.js` - เพิ่ม audio state management, triggers
- `/js/systems/WaveManager.js` - เพิ่ม wave-specific audio changes
- `/js/entities/player/PlayerBase.js` - เพิ่ม player state audio feedback

**ไฟล์ที่อาจกระทบ:**
- `/js/entities/boss.js` - สำหรับ boss phase audio changes
- `/js/effects.js` - สำหรับ audio-visual sync effects

---

### 27. 🎬 การเพิ่ม Cinematic Camera System
**ไฟล์ที่ต้องแก้ไข:**
- `/js/game.js` - เพิ่ม camera control logic, zoom, shake
- `/js/config.js` - เพิ่ม camera settings, sensitivity
- `/js/ui.js` - เพิ่ม cinematic overlays, letterboxing
- `/js/effects.js` - เพิ่ม camera transition effects
- `/js/input.js` - เพิ่ม camera controls (ถ้าอนุญาตให้ผู้เล่นควบคุม)

**ไฟล์ที่อาจกระทบ:**
- `/js/rendering/PlayerRenderer.js` - สำหรับ camera-relative rendering
- `/js/map.js` - สำหรับ viewport culling optimization

---

### 28. 🌈 การเพิ่ม Weather & Environment Effects
**ไฟล์ที่ต้องแก้ไข:**
- `/js/effects.js` - เพิ่ม rain, snow, lightning, wind effects
- `/js/config.js` - เพิ่ม weather configurations, intensity
- `/js/game.js` - เพิ่ม weather system logic, transitions
- `/js/audio.js` - เพิ่ม weather sounds (rain, thunder, wind)
- `/js/map.js` - เพิ่ม weather impact on gameplay

**ไฟล์ที่อาจกระทบ:**
- `/js/entities/enemy.js` - ถ้า weather มีผลต่อ enemy behavior
- `/js/entities/player/PlayerBase.js` - ถ้า weather มีผลต่อ player movement

---

### 29. 🎪 การเพิ่ม Event System & Triggers
**ไฟล์ที่ต้องแก้ไข:**
- `/js/game.js` - เพิ่ม event manager, trigger system
- `/js/config.js` - เพิ่ม event definitions, conditions
- `/js/systems/GameState.js` - เพิ่ม event state tracking
- `/js/ui.js` - เพิ่ม event notifications, prompts
- `/js/audio.js` - เพิ่ม event-specific audio cues

**ไฟล์ที่อาจกระทบ:**
- **ทุก entity file** - สำหรับ event triggers และ responses
- `/js/map.js` - สำหรับ location-based triggers

---

### 30. 🔧 การเพิ่ม Mod Support & Custom Content
**ไฟล์ที่ต้องแก้ไข:**
- `/js/config.js` - เพิ่ม mod loading configuration
- `/js/game.js` - เพิ่ม mod system initialization
- `/js/ui.js` - เพิ่ม mod selection menu, management
- `/js/systems/GameState.js` - เพิ่ mod state management
- `/js/menu.js` - เพิ่ม mod browsing interface

**ไฟล์ที่อาจกระทบ:**
- **ทุก system file** - สำหรับ mod integration hooks
- `/js/utils.js` - สำหรับ mod loading utilities

---

### 🔄 ทักษะพิเศษที่ควรรู้

#### การเพิ่ม Visual Effects
- **Particles:** `/js/effects.js` - ใช้ object pooling สำหรับ performance
- **Animations:** `/js/rendering/PlayerRenderer.js` - ใช้ sprite sheets หรือ procedural animations
- **UI Animations:** `/css/main.css` - ใช้ CSS transitions และ transforms

#### การเพิ่ม Audio
- **Sound Effects:** `/js/audio.js` - ใช้ Web Audio API สำหรับ spatial audio
- **Background Music:** `/assets/audio/` - เพิ่มไฟล์ MP3 ใหม่
- **Dynamic Audio:** ตรวจสอบ audio context สำหรับ mobile compatibility

#### Performance Considerations
- **Object Pooling:** ใช้สำหรับ projectiles, particles, enemies
- **Optimization:** ตรวจสอบ `game.js` loop สำหรับ 60 FPS target
- **Memory Management:** ลอบหมาย garbage collection issues

---

## 🔧 Common Debugging Solutions

### "Malformed Edit" Errors
ถ้าเจอ "malformed edit" กับ JavaScript files ที่มี multi-line strings:
1. บอกว่า "ใช้ Python script"
2. รอให้ AI สร้าง Python script สำหรับแก้ไขไฟล์
3. Python script จะใช้ UTF-8 encoding และ string.replace() ที่แม่นยำ

### Performance Issues
1. ตรวจสอบ `game.js` main loop
2. ดู object pooling ใน `effects.js`
3. ตรวจสอบ rendering ใน `PlayerRenderer.js`
4. ใช้ `Debug.html` สำหรับ performance profiling

### Version Update Workflow
1. อัปเดท `sw.js` cache version
2. เพิ่ม entry ใน `CHANGELOG.md`
3. อัปเดท `README-info.md` ถ้าจำเป็น
4. Commit & push พร้อมคำอธิบายละเอียด

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