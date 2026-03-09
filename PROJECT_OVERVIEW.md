# 🎮 MTC Game - Project Overview
> สำหรับ AI Assistant — อ่านเมื่อเริ่มแชทใหม่เพื่อเข้าใจโปรเจคต์ก่อนลงมือ

**MTC the Game** — Top-down 2D Wave Survival Shooter, 15 waves + bosses + upgrades
**Stack:** Vanilla JS + HTML5 Canvas (ไม่มี framework) | **Target:** 60 FPS | **Status:** Beta v3.11.14+

---

## 📋 Stability Legend
- 🟢 **STABLE** — แทบไม่เปลี่ยน (architecture, patterns, file locations)
- 🟡 **SEMI-DYNAMIC** — เปลี่ยนบางครั้ง (system integration, task checklists)
- 🔴 **DYNAMIC** — เปลี่ยนบ่อย (config values, code snippets, balance) → verify ใน codebase ก่อนใช้เสมอ

---

## 🗂️ File Structure 🟢

### Root
| ไฟล์ | หน้าที่ |
|------|--------|
| `index.html` | หน้าหลัก, โหลด JS ทั้งหมด |
| `sw.js` | Service Worker — **bump version ทุกครั้งที่เปลี่ยนโค้ด** |
| `Debug.html` | Debug/profiling page |
| `CHANGELOG.md` | บันทึกการเปลี่ยนแปลง |
| `README-info.md` | เอกสารผู้เล่น |
| `manifest.json` | PWA manifest |
| `secrets.js` | CONFIG_SECRETS (GEMINI_API_KEY) — ไม่มี cheat codes |

### `/js/` — Core Logic
| ไฟล์ | หน้าที่สำคัญ |
|------|------------|
| `game.js` | Game loop หลัก, state transitions, startGame() |
| `config.js` | ค่าทั้งหมด — BALANCE, MAP_CONFIG, ACHIEVEMENT_DEFS |
| `input.js` | Keyboard/mouse/touch — global `keys` object |
| `audio.js` | SFX + BGM, Web Audio API, namespace protection |
| `effects.js` | Particles (object pool), FloatingText, OrbitalParticle |
| `weapons.js` | WeaponSystem, Projectile, ProjectileManager, SpatialGrid |
| `map.js` | แผนที่, collision detection, MTCRoom |
| `ui.js` | HUD, **AchievementSystem** (อยู่ที่นี่ — ไม่ใช่ไฟล์แยก) |
| `menu.js` | Main menu, `selectCharacter()` |
| `ai.js` | Enemy AI behaviors |
| `utils.js` | Utility functions |
| `tutorial.js` | Tutorial system |

### `/js/systems/`
| ไฟล์ | หน้าที่ |
|------|--------|
| `GameState.js` | State management (single source of truth) + `window.gameState` compat |
| `WaveManager.js` | Wave progression, enemy spawning, deterministic schedule |
| `TimeManager.js` | Bullet time |
| `ShopSystem.js` | ร้านค้า, upgrades |
| `AdminSystem.js` | Debug console (GUEST/OPERATOR/ROOT) — `spawn manop [1\|2\|3]`, `spawn first [advanced]`, `devbuff` |

### `/js/entities/`
| ไฟล์ | หน้าที่ |
|------|--------|
| `base.js` | Base Entity class — ทุก entity สืบทอด |
| `enemy.js` | Enemy types (Enemy, TankEnemy, MageEnemy) |
| `boss.js` | BossBase → KruManop / KruFirst |
| `boss_attacks.js` | Attack patterns, domain expansion |
| `summons.js` | Pets, helpers, power-up entities |

### `/js/entities/player/`
| ไฟล์ | ตัวละคร | บทบาท |
|------|--------|-------|
| `PlayerBase.js` | Base ทุกตัว | `applyDevBuff()`, `_hitFlashTimer`, passive unlock |
| `Kaoplayer.js` | เก้า | Assassin — stealth, teleport, clone |
| `PoomPlayer.js` | ภูมิ | Spiritual Warrior — ritual, naga, garuda |
| `AutoPlayer.js` | ออโต้ | Pyromaniac — vacuum, detonate, Wanchai Stand |

### `/js/rendering/`
- `PlayerRenderer.js` — วาด player ทั้งหมด (animations, effects, hit flash)

### `/assets/audio/`
`menu.mp3`, `battle.mp3`, `boss.mp3`, `glitch.mp3`

---

## 🎮 Architecture 🟢

### Core Loop
```
Input (input.js) → Game Update (game.js) → Entity Updates → Collision (map.js) → Render → UI (ui.js)
```

### Key Design Patterns
- **Object Pooling** — particles/projectiles/FloatingText (effects.js) ลด GC
- **State Management** — GameState singleton
- **Rendering Decoupling** — `PlayerRenderer.draw()` dispatcher → `_drawKao()` / `_drawPoom()` / `_drawAuto()`
- **Spatial Grid** — weapons.js collision: O(E) build, O(P×k) query — เร็วกว่า O(P×E) brute force ~12×
- **No `instanceof` in PlayerBase** — ใช้ behavior flags แทน (`passiveSpeedBonus`, `usesOwnLifesteal`)
- **Deterministic Rendering** — ห้าม `Math.random()` ใน draw loop เด็ดขาด

### Integration Points
- Menu→Game: `selectCharacter()` → `window.selectedChar` → `startGame()`
- Input→Player: `keys.w/a/s/d/space/q/e/r/b/t/f/shift` object
- Wave→Enemy: `WaveManager.spawn()` → `window.enemies[]`
- Achievement: `AchievementSystem.unlock()` → UIManager popup
- Audio: Global `Audio` instance + namespace protection

---

## 🔧 Development Workflow 🟢

### AI File Versioning Rule (สำคัญมาก)
**ทุก task ใหม่ในแชทใหม่ — รอรับไฟล์จากผู้ใช้เสมอ ห้ามใช้ output เก่าในแชท**

เหตุผล: ผู้ใช้อาจแก้ไขใน project จริงหลัง copy output ไปแล้ว ทำให้ output เก่าล้าสมัย

```
แชทใหม่ / task ใหม่:
  ผู้ใช้ส่งไฟล์ → AI แก้ → output → ผู้ใช้ copy ไป project

task ต่อเนื่องในแชทเดิม (ไม่มีไฟล์ใหม่):
  ตรวจ /mnt/user-data/outputs/<filename> ก่อนเสมอ
  ถ้ามี → ใช้ output (cp /mnt/user-data/outputs/X /home/claude/X)
  ถ้าไม่มี → ใช้ /mnt/user-data/uploads/<filename>

task ต่อเนื่อง + ผู้ใช้อัปโหลดไฟล์ใหม่:
  ใช้ uploads (อาจมีการแก้ไขนอก session) — output เก่าถือเป็น stale
```

**⚠️ ขั้นตอน mandatory ก่อนแก้ไฟล์ใดๆ ในแชทเดิม:**
```bash
# 1. ตรวจว่ามี output ล่าสุดไหม
ls /mnt/user-data/outputs/<filename>

# 2. ถ้ามี → cp จาก outputs ไม่ใช่ uploads
cp /mnt/user-data/outputs/config.js /home/claude/config.js   ✅
cp /mnt/user-data/uploads/config.js /home/claude/config.js   ❌ (ถ้ามี output อยู่แล้ว)
```

ถ้าผู้ใช้ไม่ส่งไฟล์มา → แจ้ง "กรุณาส่งไฟล์ล่าสุดจาก project มาด้วยครับ"

### Commit & Push Workflow
1. Bump `sw.js` cache version (เช่น v3.11.14 → v3.11.15)
2. เพิ่ม entry ใน `CHANGELOG.md`
3. อัปเดท `README-info.md` ถ้าจำเป็น
4. Commit & push พร้อมคำอธิบายละเอียด

**คำสั่ง Windsurf:** _"commit and push, check changes first, write detailed description, update @sw.js, @CHANGELOG.md, @README-info.md"_
> Claude มีหน้าที่เขียนโค้ด 100% — Windsurf รับผิดชอบ commit & push

---

## ⚙️ Critical Technical Notes

### PlayerRenderer — Rendering Architecture 🟢
- **Layer 1 = Body** — `ctx.save()` → translate(screen + recoil + bob) → scale(stretch × facing) → draw body → hit flash → energy shield → `ctx.restore()`
- **Layer 2 = Weapon + Hands** — `ctx.save()` → translate(screen + recoil + bob) → rotate(angle) → draw weapon → `ctx.restore()`
- **⚠️ Variable Declaration Order** — `moveT`, `bobY`, `stretchX/Y`, `R` **ต้อง declare ก่อน** dash ghost loop และ ground shadow เสมอ ถ้า declare ทีหลัง → `ReferenceError` ทันที

### Bullet Spawn — Muzzle Offset 🔴
`shootSingle()` ใน weapons.js ต้อง spawn กระสุนที่ปากกระบอกปืนจริง ไม่ใช่ center ของผู้เล่น:

| ตัวละคร | ปืน | Offset (px) | ที่มา |
|---------|-----|-------------|------|
| Kao | Auto rifle | 49 | translate(15,10) + muzzle x=34 |
| Kao | Sniper | 69 | translate(15,10) + suppressor tip x=54 |
| Kao | Shotgun | 45 | translate(15,10) + muzzle arc x=30 |
| Poom | Spirit gun | 43 | translate(12,6) + emitter arc x=31 |
| Auto | Thermodynamic rifle | 51 | translate(12,4) + muzzle arc x=39 |

ตรวจ `player.charId` ('poom'/'auto'/default=Kao) → ถ้า Kao ค่อยตรวจ `this.currentWeapon`

### Hit Flash System 🔴
**Properties ใน PlayerBase:** `_hitFlashTimer` (1→0), `_hitFlashBig` (bool), `_hitFlashLocked` (bool)
- Decay: `dt * 6` (~167ms ที่ 60fps)
- `takeDamage()` set `_hitFlashLocked = true` พร้อม timer — ปลด lock เมื่อ timer < 0.4
- **ทำไมต้อง lock:** contact damage เรียก `takeDamage()` ทุกเฟรม → timer reset ซ้ำ → flash ค้างแดงตลอด

### Passive Unlock Architecture 🟢
- `PlayerBase.checkPassiveUnlock()` ตรวจ stealth count — เหมาะแค่ Kao
- **Poom + Auto ต้อง override `checkPassiveUnlock()`** มิฉะนั้น passive unlock ไม่ได้เลย
- `passiveUnlockStealthCount: 0` สำหรับ Auto/Poom (ห้ามใช้ 99)
- Behavior flags แทน instanceof:
  - `this.passiveSpeedBonus = N` — speed multiplier หลัง unlock
  - `this.usesOwnLifesteal = bool` — true = subclass จัดการ lifesteal เอง
- Dev Mode **ไม่** unlock passive — ใช้ `applyDevBuff()` (flag `_devBuffApplied` ป้องกันซ้ำ)

### Poom Skill Input Routing 🟢
- **eatRice (R-Click):** route จาก `game.js` — lock check อยู่ที่นี่
- **E (Garuda) / R (Ritual) / Q (Naga):** route จาก `PoomPlayer.update()` ทั้งหมด
- ⚠️ ห้ามมี Q-consume block ซ้ำใน `game.js` → ทำให้ข้าม cooldown

### Poom Weapon 🟢
Poom **bypasses WeaponSystem ทั้งหมด** — ยิงผ่าน `PoomPlayer.shoot()` โดยตรง (rice projectiles)

### Configuration Structure 🟡
```javascript
BALANCE.characters[charId] = {
    hp, maxHp, energy, maxEnergy, moveSpeed, dashSpeed,
    passiveUnlockText, passiveUnlockStealthCount,
    // ── Skill energy costs (ทุกสกิล active ต้องมี) ──
    xyzEnergyCost: N,   // pattern: <skillName>EnergyCost
    weapons: { weaponName: { damage, cooldown, range, speed, spread, color, icon } }
}
BALANCE.map = { mapColors, objects: { desk, tree } }
BALANCE.mtcRoom = { healRate, maxStayTime, cooldownTime, dashResetOnEntry, ... }
```
⚠️ Ritual (R) ของ Poom ไม่มี energy cost โดยเจตนา — เป็น combo finisher ที่มี CD + stack requirement อยู่แล้ว


### Wave Events 🟡
| Event | เงื่อนไข | ผล |
|-------|---------|---|
| Dark | Wave 1 | มืด |
| Fog | Waves 2,8,11,14 | หมอก |
| Speed | Waves 4,7,13 | ศัตรูเร็วขึ้น |
| Glitch | ทุก 5 waves | invert controls, enemy melee dmg −40% |
| Boss | Waves 3,6,9,12,15 | deterministic boss queue |

### MTC Room 🔴 (v3.11.17)
- **Bounds:** x: −150→150, y: −700→−460 (300×240px)
- **Boss safe spawn Y:** −330 (ใต้ห้อง + buffer 130px) — มี runtime guard ใน BossBase constructor
- **Features:** Dash reset on entry, Crisis Protocol (HP≤25% → +35HP), Rotating Buff (DMG +15% / SPD +10% / CDR −35%), Energy regen 30/s, HP regen 30/s

### Domain Singleton Reset — Critical Pitfall 🔴
`DomainExpansion` และ `GravitationalSingularity` เป็น **module-level singletons** — ไม่ reset อัตโนมัติระหว่างเกม

**ปัญหา:** ถ้า phase ค้าง (`casting`/`active`) ข้ามเกม → `isInvincible()` return `true` ตลอด → boss รับ damage ไม่ได้

**3 จุดที่ต้อง abort ทุกครั้งที่ boss หายออกจากเกม:**
1. `BossBase._onDeath()` — abort ทั้งสองก่อน `window.boss = null`
2. `AdminSystem` `kill` command — abort หลัง `takeDamage(99999)`
3. `AdminSystem` `skipwave` command — abort หลัง `window.boss = null`

`game.js`: `GravitationalSingularity.update()` **ต้องรันแม้ boss dead** (ไม่มี `window.boss &&` guard) — เพื่อให้ `_abort()` trigger ได้เมื่อ `boss = null`

```js
// ✅ ถูก — รันเสมอ
if (typeof GravitationalSingularity !== 'undefined')
    GravitationalSingularity.update(dt, window.boss, window.player);

// ❌ ผิด — ถ้า boss null แล้ว update ไม่รัน → phase ค้าง
if (typeof GravitationalSingularity !== 'undefined' && window.boss && !window.boss.dead)
    GravitationalSingularity.update(dt, window.boss, window.player);
```

### Domain Slow — stats.moveSpeed vs moveSpeed 🔴
`DomainExpansion` slow debuff ต้อง target `player.stats.moveSpeed` เท่านั้น
`player.moveSpeed` เป็น property แยก — PlayerBase ใช้ `S.moveSpeed` เป็น speed cap จริง การแก้ `player.moveSpeed` ไม่มีผล

```js
// ✅ ถูก
player._domainSlowBase = player.stats.moveSpeed;
player.stats.moveSpeed *= _DC.CELL_SLOW_FACTOR;

// ❌ ผิด — ไม่กระทบ speed cap ใน PlayerBase
player._domainSlowBase = player.moveSpeed;
player.moveSpeed *= _DC.CELL_SLOW_FACTOR;
```

### Energy Cost System 🟡
ทุกสกิล active ทุกตัวละครมี energy cost — ตรวจ config ก่อนเพิ่มสกิลใหม่

| ตัวละคร | Skill | Cost Key | ค่า |
|---------|-------|----------|-----|
| Kao | Q Teleport/PhantomBlink | `teleportEnergyCost` | 20 |
| Kao | E Clone | `cloneEnergyCost` | 30 |
| Kao | R-Click Stealth | `stealthCost` | 25 |
| Auto | R-Click Wanchai | `wanchaiEnergyCost` | 25 |
| Auto | Q Vacuum | `vacuumEnergyCost` | 20 |
| Auto | E Detonation | `detonationEnergyCost` | 30 |
| Poom | Q Naga | `nagaEnergyCost` | 25 |
| Poom | E Garuda | `garudaEnergyCost` | 30 |
| Poom | R-Click EatRice | `eatRiceEnergyCost` | 15 |
| Poom | R Ritual | — | ฟรี (combo finisher) |

Pattern ใน player files:
```js
const cost = S.xyzEnergyCost ?? DEFAULT;
if ((this.energy ?? 0) < cost) {
    spawnFloatingText('⚡ FOCUS LOW!', this.x, this.y - 50, '#facc15', 16);
} else {
    this.energy = Math.max(0, (this.energy ?? 0) - cost);
    this.doSkill();
}
```

### FloatingText Stack-Offset 🟡
`FloatingTextSystem.spawn()` นับ live texts ในรัศมี 40px ก่อน spawn ใหม่ — offset ขึ้น 22px ต่อชั้น (max 5 ชั้น) ป้องกัน text ซ้อนทับกัน

---

## 🔍 Quick Reference — Common Tasks 🟡

### เพิ่มตัวละครใหม่
**ต้องแก้:** `PlayerBase.js` (สืบทอด), `config.js`, `PlayerRenderer.js` (เพิ่ม `_draw[Name]()` + dispatcher), `menu.js`, `ui.js`, `audio.js`, `css/main.css`
**อาจกระทบ:** `game.js`, `WaveManager.js`, `weapons.js`

### เพิ่มบอสใหม่
**ต้องแก้:** `boss.js` (extends BossBase), `boss_attacks.js`, `config.js`, `WaveManager.js`, `audio.js`
**อาจกระทบ:** `summons.js`, `map.js`
⚠️ Boss มี Gemini speech integration ผ่าน `speak()` | Boss queue: waves 3,6,9,12,15

### เพิ่มศัตรูใหม่
**ต้องแก้:** `enemy.js`, `config.js`, `WaveManager.js`, `audio.js`, `effects.js`
**อาจกระทบ:** `ai.js`, `weapons.js`

### เพิ่มอาวุธใหม่
**ต้องแก้:** `weapons.js`, `config.js`, `[Character].js`, `audio.js`, `effects.js`
⚠️ อาวุธ Kao ใหม่ → ต้องเพิ่ม muzzle offset ใน `shootSingle()` ด้วย

### เพิ่มสกิล (Active)
**ต้องแก้:** `[Character].js`, `config.js`, `audio.js`, `effects.js`, `ui.js`
**อาจกระทบ:** `input.js` (key binding), `PlayerRenderer.js` (animation)

### แก้ Visual / Player Animation
**ต้องแก้:** `PlayerRenderer.js`, `effects.js`
⚠️ `moveT`/`bobY`/`R` ต้อง declare ก่อน dash ghost loop — ดู Critical Notes

### แก้ Weapon / Projectile System
**ต้องแก้:** `weapons.js`, `config.js`, `effects.js`, `audio.js`
⚠️ Poom ยิงผ่าน `PoomPlayer.shoot()` โดยตรง — ไม่ผ่าน WeaponSystem

### แก้ Audio
**ต้องแก้:** `audio.js`, `config.js`
⚠️ มี BGM namespace collision fix — ตรวจก่อนแก้ Audio constructor

### แก้ UI / HUD
**ต้องแก้:** `ui.js`, `effects.js`, `css/main.css`
⚠️ AchievementSystem อยู่ใน `ui.js` | data save ผ่าน `getSaveData()`/`setSaveData()`

### แก้ Map / MTC Room
**ต้องแก้:** `map.js`, `config.js`
⚠️ Bounds: x:−150→150, y:−700→−460 | Boss spawn guard ใน BossBase constructor

### เพิ่ม Achievement
**ต้องแก้:** `ui.js` (AchievementSystem + ACHIEVEMENT_DEFS), `config.js`, `audio.js`, `css/main.css`

### เพิ่ม Wave Event
**ต้องแก้:** `WaveManager.js`, `config.js`, `effects.js`, `audio.js`, `ui.js`

### เพิ่ม Shop Item
**ต้องแก้:** `ShopSystem.js`, `config.js`, `ui.js`
⚠️ Shop location: `{x:−350, y:350, INTERACTION_RADIUS:90}` — proximity interaction

### แก้ Game State / Progression
**ต้องแก้:** `GameState.js`, `game.js`, `WaveManager.js`, `ShopSystem.js`

### เพิ่ม Special Effect / Particle
**ต้องแก้:** `effects.js`, `config.js`
⚠️ ใช้ object pool เสมอ — ห้าม `new` ใน draw/update loop

---

## 🐛 Common Debugging Solutions

| ปัญหา | สาเหตุ | วิธีแก้ |
|------|--------|--------|
| `ReferenceError: Cannot access X before initialization` ใน PlayerRenderer | `moveT`/`bobY`/`R` ถูกใช้ก่อน declare | ย้าย var declarations ขึ้นบนสุดของ function ก่อน dash ghost loop |
| Hit flash ค้างแดงตลอด | Contact damage reset `_hitFlashTimer` ทุกเฟรม | ตรวจ `_hitFlashLocked` flag ใน PlayerBase.js |
| กระสุนออกจากตัวผู้เล่นแทนปากกระบอกปืน | `offset` ใน `shootSingle()` ผิด | ดูตาราง Muzzle Offset ใน Critical Notes |
| Passive unlock ไม่ทำงาน (Poom/Auto) | Base `checkPassiveUnlock()` ตรวจ stealth count | Override `checkPassiveUnlock()` ใน subclass |
| "Malformed Edit" (Windsurf) | Multi-line JS strings | บอก "ใช้ Python script" — script ใช้ UTF-8 + string.replace() |
| Boss spawn ใน MTC Room | spawnY ติด room bounds | ตรวจ BossBase constructor guard + safe Y: −330 |
| Performance drop | GC / render bottleneck | ตรวจ object pooling ใน effects.js, ใช้ Debug.html profiling |
| Visual glitch | ctx state leak | ตรวจ `ctx.save()`/`ctx.restore()` ครบคู่ใน PlayerRenderer.js |
| **"DOMAIN SHIELD!" spam + boss รับ damage ไม่ได้** | **Domain singleton phase ค้างจากเกมก่อน** | **ตรวจ `_onDeath()` + AdminSystem abort calls — ดู Domain Singleton Reset** |
| **Domain slow ไม่มีผล** | **แก้ `player.moveSpeed` แทน `player.stats.moveSpeed`** | **ใช้ `player.stats.moveSpeed` เสมอ — ดู Domain Slow Critical Note** |
| **สกิลกดได้ทั้งที่ energy หมด** | **ไม่มี energy guard ใน skill activation block** | **เพิ่ม pattern `if (energy < cost)` ก่อน doSkill() — ดู Energy Cost System** |

---

## 🤖 AI Roles

| Claude (Complex) | Windsurf IDE (Simple/Routine) |
|-----------------|-------------------------------|
| Complex refactoring, multi-file changes | Simple features, small tweaks |
| Deep bug analysis, root cause | Commit & push |
| Architecture redesign | Documentation |
| Performance optimization | File analysis, grep |
| Critical bug fixes | UI/visual minor edits |

---

**📌 อัปเดทเอกสารนี้เมื่อมีการเปลี่ยนแปลง architecture, critical patterns, หรือ pitfall ใหม่ที่ค้นพบ**