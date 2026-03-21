# 📚 PROMPT_MEMORY.md — ที่เก็บ Prompt สำคัญของ MTC Game

**วัตถุประสงค์:** เก็บคำสั่ง prompt, context, และ memory ที่สำคัญต่อโปรเจคต์  
**ใช้ยังไง:** เมื่อต้องการให้ AI ตัวใหม่เข้าใจโปรเจคต์ → copy & paste ส่วนที่ต้องการ

---

## 🎯 ส่วนที่ 1: Project Context (ส่วนนี้ copy ทุกครั้ง)

### Prompt: โปรเจคต์นี้คืออะไร

```
🎮 MTC The Game — Top-down 2D Wave Survival Shooter
• Stack: Vanilla JS + HTML5 Canvas (ไม่มี framework)
• Target: 60 FPS
• Current Version: v3.33.2 (Beta)

Characters:
• Kao (เก้า) — Assassin with stealth/teleport/clone
• Auto (ออโต้) — Thermodynamic brawler with heat/wanchai stand
• Poom (ภูมิ) — Spiritual warrior with rituals/naga/garuda
• Pat (แพท) — Samurai ronin with katana/blade guard

Architecture:
• Config-driven: BALANCE.characters.[charId] → ทุกค่า
• Entity-based: PlayerBase, EnemyBase, BossBase → สืบทอดลงมา
• Renderer-decoupled: PlayerRenderer._draw[Char]() → canvas drawing
• AI-enhanced: UtilityAI, SquadAI, PlayerPatternAnalyzer

Critical Files:
• js/config.js — BALANCE (ค่าทั้งหมด)
• js/game.js — Game loop (60 FPS)
• js/entities/player/KaoPlayer.js — Kao logic
• js/rendering/PlayerRenderer.js — Canvas drawing (ทุก character)
• js/systems/GameState.js — State management
```

### Prompt: Naming Conventions

```
Characters: kao, auto, poom, pat (lowercase)
Classes: KaoPlayer, AutoPlayer, PoomPlayer, PatPlayer (PascalCase)
Methods: _drawKao(), _drawAuto(), fireWeapon(), checkPassiveUnlock()
Config path: BALANCE.characters.kao / BALANCE.characters.kao.weapons.auto
Variables: entity._anim, entity.isFreeStealthActive, entity._freeStealthKills
```

### Prompt: Terminology Clarification

```
📍 FREE-STEALTH (ซุ่มเสรี) = Passive state (triggered อัตโนมัติ)
   • Triggered by: Dash, Enemy bullet penetration
   • Effect: Damage ×1.5, Guaranteed crit
   • Duration: 2 seconds typically
   • Count kills towards Lv2 unlock

📍 AUTO-STEALTH (ซุ่มอัตโนมัติ) = Mechanism (ไม่ต้องกด)
   • Subset of Free-Stealth system
   • Code term: this.isFreeStealthActive

📍 SKILL STEALTH (R-Click) = Player-triggered stealth
   • ผู้เล่นต้องกด R เอง
   • Cooldown: 5.5 วินาที
```

---

## 🎯 ส่วนที่ 2: Animation Editing Prompt

### Prompt: เมื่อต้องแก้ animation

```
เมื่อต้องแก้ animation ของตัวละครใดๆ (animation = การเคลื่อนไหว):

ตรวจสอบ 3 ไฟล์เท่านั้น:

1️⃣ PlayerRenderer.js → _getLimbParams()
   • L.444-522
   • Animation parameters: moveT, bob, breathe, stretchX, stretchY, shootLift, runLean
   • ปรับตัวเลข: 0.09, -8, 0.12 ฯลฯ

2️⃣ PlayerRenderer.js → _draw[Character]()
   • LAYER 0-4: วาดตัว, อาวุธ, ส่วนต่าง ๆ
   • ปรับ: ctx.arc() position, ctx.translate(), ctx.rotate(), ctx.scale()

3️⃣ [Character]Player.js → update() / constructor
   • Set entity._anim = { moveT, shootT, hurtT, dashT, state, ... }
   • Update ค่า _anim ตามเวลา (dt)

ตัวอย่าง prompt:
"PlayerRenderer.js → _getLimbParams() → ปรับ shootLift จาก sT * -8 เป็น sT * -12 (ยกแขนสูงขึ้น)"
```

### Prompt: animation parameter reference

```
_getLimbParams() คืนค่า:
• moveT (0-1): ความเร็วเดิน
  → ใช้ปรับ: bob, stretch, runLean, foot swing
  
• bob: ขึ้นลงตามจังหวะเดิน
  → ใช้ปรับ: body bounce, shadow scale
  
• breathe: หายใจ (idle)
  → ใช้ปรับ: chest expansion, slight scale
  
• stretchX / stretchY: ยืดหดตัว
  → ใช้ใน ctx.scale(stretchX, stretchY)
  
• shootLift: ยกแขนขณะยิง
  → ค่าเดิม: sT * -8 (ลบ = ขึ้น)
  
• shootReach: แขนไปข้างหน้า
  → ค่าเดิม: sT * 5
  
• hurtPushX / hurtPushY: นำตัวหลังโดนดา
  → คำนวณจาก aimAngle × hT × 6
  
• runLean: เอนตัววิ่ง (เรเดียน)
  → ค่าเดิม: moveT * 0.12
  
• dashStretchX: ยืดตัวขณะ dash
  → ค่าเดิม: 1 + dT * 0.18
```

---

## 🎯 ส่วนที่ 3: Code Structure Prompt

### Prompt: ไฟล์สำคัญและตำแหน่ง

```
Core Files:

📄 js/config.js
   • L.47-146: BALANCE.characters.kao
   • L.147-300: BALANCE.characters.auto
   • L.1200+: BALANCE.weapons, BALANCE.ai, BALANCE.map

📄 js/game.js
   • L.75-127: gameLoop() — 60 FPS heart
   • L.151-183: updateGame() — update all entities
   • L.800-900: drawGame() — render to canvas

📄 js/entities/player/KaoPlayer.js
   • L.82-142: constructor() — ตั้งค่า instance variables
   • L.149-226: checkPassiveUnlock() — unlock passive Lv1 & Lv2
   • L.300-700: update() — update state ทุก frame
   • L.740-942: fireWeapon() — shoot logic

📄 js/rendering/PlayerRenderer.js
   • L.444-522: _getLimbParams() — compute animation params
   • L.610-850: _drawKao() — render Kao (LAYER 0-4)
   • L.90-114: draw() dispatcher — routes to correct _draw[Char]()

📄 js/systems/GameState.js
   • State management (phase, score, wave, etc)

📄 js/systems/WaveManager.js
   • Wave progression, enemy spawning
```

### Prompt: Constructor vs Instance

```
Constructor = Function that runs ONCE (when new KaoPlayer())
Instance = Object created from constructor (lives in window.player)

Example:
const kao = new KaoPlayer(500, 500);  // ← Constructor runs here
window.player = kao;  // ← Instance stored

In constructor:
this.maxHp = BALANCE.characters.kao.hp;  // ← Read config ONCE

In update():
this.maxHp -= damage;  // ← Instance value changes EVERY frame
BALANCE.characters.kao.hp stays 119 (unchanged)
```

---

## 🎯 ส่วนที่ 4: Common Edits & Solutions

### Prompt: ต้องเพิ่ม/ลด stat

```
หากต้องเพิ่ม/ลด stat ของตัวละครใดๆ:

1. ไปแก้ js/config.js
   BALANCE.characters.[charId].[statName] = newValue
   
   ตัวอย่าง:
   • เพิ่ม Kao HP: BALANCE.characters.kao.hp = 150 (จาก 119)
   • เพิ่ม Auto moveSpeed: BALANCE.characters.auto.moveSpeed = 280 (จาก 260)

2. ไปแก้ KaoPlayer.js constructor ถ้าต้อง:
   this.maxHp = BALANCE.characters.kao.hp;  // อ่านค่า config

3. ไม่ต้องแก้ PlayerRenderer.js (ไม่เกี่ยวกับ rendering)
```

### Prompt: ต้องแก้ weapon damage/cooldown

```
1. ไปแก้ js/config.js
   BALANCE.characters.[charId].weapons.[weaponKey].damage = newValue
   BALANCE.characters.[charId].weapons.[weaponKey].cooldown = newValue
   
   ตัวอย่าง:
   • Kao auto rifle: BALANCE.characters.kao.weapons.auto.damage = 30 (จาก 26)
   • Kao shotgun cooldown: BALANCE.characters.kao.weapons.shotgun.cooldown = 0.6 (จาก 0.55)

2. ไม่ต้องแก้อื่น (อ่านค่า config อัตโนมัติ)
```

### Prompt: ต้องแก้ skill cooldown/cost

```
1. ไปแก้ js/config.js
   BALANCE.characters.[charId].[skillName]Cooldown = newValue
   BALANCE.characters.[charId].[skillName]EnergyCost = newValue
   
   ตัวอย่าง (Kao):
   • Stealth cooldown: BALANCE.characters.kao.stealthCooldown = 6 (จาก 5.5)
   • Teleport cooldown: BALANCE.characters.kao.teleportCooldown = 20 (จาก 18)
   • Clone energy cost: BALANCE.characters.kao.cloneEnergyCost = 35 (จาก 30)

2. KaoPlayer.js constructor อ่านค่าเอง:
   this.teleportCooldown = S.teleportCooldown ?? 20;
   (S = BALANCE.characters.kao)

3. ไม่ต้องแก้ PlayerRenderer.js
```

### Prompt: ต้องแก้ passive unlock ค่า

```
1. ไปแก้ js/config.js
   BALANCE.characters.[charId].passiveHpBonusPct = newValue
   BALANCE.characters.[charId].passiveCritBonus = newValue
   ฯลฯ
   
   ตัวอย่าง (Kao):
   • Passive Lv1 HP bonus: passiveHpBonusPct = 0.40 (จาก 0.30)
   • Passive Lv2 crit bonus: passiveLv2CritBonus = 0.05 (จาก 0.04)

2. KaoPlayer.js checkPassiveUnlock() อ่านค่าเอง:
   const hpBonus = Math.floor(this.maxHp * (S.passiveHpBonusPct ?? 0.3));
```

---

## 🎯 ส่วนที่ 5: Bug Reports & Fixes

### Template: หากพบ bug

```
**Bug Report Template:**

1. What happened?
   "ตัวละครหยุดเคลื่อนไหวตอน dash"

2. Where?
   "PlayerRenderer.js → _drawKao() → LAYER 1"
   or "KaoPlayer.js → update()"

3. Expected?
   "ควรเคลื่อนไหวต่ออยู่"

4. Steps to reproduce?
   "กด space (dash) → ตัวหยุด"

5. Possible cause?
   "dashT ไม่ได้ลดลง? ctx.restore() missing?"
```

---

## 🎯 ส่วนที่ 6: Memory Checklist

### ✅ สิ่งที่ต้องจำ (ก่อนแก้ code)

```
Before editing:
□ เข้าใจ config-driven architecture (ค่า config ควรเป็น single source of truth)
□ เข้าใจ Constructor vs Instance (constructor ทำ 1 ครั้ง, instance เปลี่ยนตลอด)
□ เข้าใจ 3-layer rendering (game.js → PlayerRenderer.js → canvas)
□ เข้าใจ animation flow (KaoPlayer.update() → set _anim → PlayerRenderer use _anim)

When editing animation:
□ ตรวจสอบ _getLimbParams() ก่อน (animation parameters)
□ ตรวจสอบ _draw[Char]() ที่สอง (rendering)
□ ตรวจสอบ [Char]Player.js update() ที่สาม (state management)

When editing stats:
□ ไปแก้ config.js เท่านั้น
□ เช็ค config path ถูกต้องไหม (BALANCE.characters.kao...)
□ ไม่ต้องแก้ลอจิก (คน read config)
```

---

## 📋 ตัวอย่าง: Prompt สำคัญๆ

### Prompt A: สั่ง AI เข้าใจโปรเจคต์

```
"ผมกำลังทำเกม MTC The Game (Vanilla JS + Canvas)
ตัวละคร Kao (เก้า) คือ Assassin ที่มี stealth/teleport/clone
Config ทั้งหมดอยู่ใน BALANCE.characters.kao
Architecture: Config → KaoPlayer (logic) → PlayerRenderer (drawing)

ให้ช่วยอ่านไฟล์และอธิบายว่า constructor ของ KaoPlayer ทำอะไร"
```

### Prompt B: สั่ง AI แก้ animation

```
"ต้องแก้ animation ของ Kao

PlayerRenderer.js → _getLimbParams() (L.444-522)
ปรับ shootLift จาก sT * -8 เป็น sT * -12 (ยกแขนสูงขึ้น)

แล้วแสดง line 462 ใหม่"
```

### Prompt C: สั่ง AI แก้ stat

```
"เพิ่ม Kao HP จาก 119 เป็น 150

ไปแก้ js/config.js → BALANCE.characters.kao.hp = 150
แล้วแสดง code block ที่แก้"
```

---

## 🚀 วิธีใช้ PROMPT_MEMORY.md

**เมื่อ AI ตัวใหม่เข้ามา:**

1. Copy ส่วน 1 (Project Context) → ให้ AI เข้าใจโปรเจคต์
2. Copy ส่วนที่เกี่ยว → ตามสิ่งที่ต้องการแก้
   - Animation? → Copy ส่วน 2
   - Stat? → Copy ส่วน 4
   - Bug? → Copy ส่วน 5

**ตัวอย่าง:**

```
"ผมมีเกม MTC The Game (Vanilla JS Canvas)

[COPY ส่วน 1: Project Context]

[COPY ส่วน 2: Animation Editing Prompt]

ตอนนี้อยากแก้ animation Kao แบบนี้...
"
```

---

## 📌 Key Takeaway

> **PROMPT_MEMORY.md = ตำแหน่งเดียวเก็บ context สำคัญ**
> 
> แทนที่จะไปค้นหาข้อความเก่า ๆ ใน Keep Memo → เก็บไว้ที่นี่
> สะอาด, จัดระเบียบ, ค้นหาง่าย, copy-paste ง่าย ✨

