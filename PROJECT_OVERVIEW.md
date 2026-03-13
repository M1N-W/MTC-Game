# MTC Game - Project Overview

สำหรับ AI Assistant — อ่านเมื่อเริ่มแชทใหม่เพื่อเข้าใจโปรเจคต์ก่อนลงมือ

**MTC the Game** — Top-down 2D Wave Survival Shooter, 15 waves + bosses + upgrades
**Stack:** Vanilla JS + HTML5 Canvas (ไม่มี framework) | **Target:** 60 FPS | **Status:** Beta v3.34.1

---

## Stability Legend

- **STABLE** — แทบไม่เปลี่ยน (architecture, patterns, file locations)
- **SEMI-DYNAMIC** — เปลี่ยนบางครั้ง (system integration, task checklists)
- **DYNAMIC** — เปลี่ยนบ่อย (config values, code snippets, balance) → verify ใน codebase ก่อนใช้เสมอ
- 🟢 **STABLE** — แทบไม่เปลี่ยน (architecture, patterns, file locations)
- 🟡 **SEMI-DYNAMIC** — เปลี่ยนบางครั้ง (system integration, task checklists)
- 🔴 **DYNAMIC** — เปลี่ยนบ่อย (config values, code snippets, balance) → verify ใน codebase ก่อนใช้เสมอ

---

## 🗂️ File Structure 🟢

### Root

| ไฟล์             | หน้าที่                                                  |
| ---------------- | -------------------------------------------------------- |
| `index.html`     | หน้าหลัก, โหลด JS ทั้งหมด                                |
| `sw.js`          | Service Worker — **bump version ทุกครั้งที่เปลี่ยนโค้ด** |
| `Debug.html`     | Debug/profiling page                                     |
| `CHANGELOG.md`   | บันทึกการเปลี่ยนแปลง                                     |
| `manifest.json`  | PWA manifest                                             |
| `secrets.js`     | CONFIG_SECRETS (GEMINI_API_KEY) — ไม่มี cheat codes      |

### `/js/` — Core Logic

| ไฟล์          | หน้าที่สำคัญ                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `game.js`     | Game loop หลัก, state transitions, startGame()                                                                            |
| `config.js`   | ค่าทั้งหมด — BALANCE, MAP_CONFIG, ACHIEVEMENT_DEFS                                                                        |
| `input.js`    | Keyboard/mouse/touch — global `keys` object, **mobile haptic feedback**, **button press states**, **touchcancel cleanup** |
| `audio.js`    | SFX + BGM, Web Audio API, BGM crossfade system, namespace protection                                                      |
| `effects.js`  | Particles (object pool), FloatingText, OrbitalParticle                                                                    |
| `weapons.js`  | WeaponSystem, Projectile, ProjectileManager, SpatialGrid                                                                  |
| `map.js`      | แผนที่, collision detection, MTCRoom                                                                                      |
| `ui.js`       | HUD, **AchievementSystem** (อยู่ที่นี่ — ไม่ใช่ไฟล์แยก), **high score display**, **mobile UI polish**                     |
| `menu.js`     | Main menu, `selectCharacter()`                                                                                            |
| `ai.js`       | Legacy AI behaviors (pre-EnemyBase refactor) — verify ยังใช้อยู่ไหม                                                       |
| `utils.js`    | Utility functions                                                                                                         |
| `tutorial.js` | Tutorial system                                                                                                           |
| `commit-push.md` | Instruction สำหรับ commit และ push การเปลี่ยนแปลง                                                                      |

### `/js/ai/` — AI Enhancement System 🟡

Load order: `UtilityAI.js → EnemyActions.js → PlayerPatternAnalyzer.js → SquadAI.js`

| ไฟล์                       | หน้าที่                                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UtilityAI.js`             | Core decision system — 2Hz timer, utility scoring, personality-weighted, delegates actions ไป EnemyActions, อ่าน `_squadRole` override                          |
| `EnemyActions.js`          | Static action library — `retreat()`, `flank()`, `shieldWall()`, `strafeOrbit()` (stateless, ไม่มี state ของตัวเอง)                                              |
| `PlayerPatternAnalyzer.js` | `window.playerAnalyzer` singleton — Float32Array(30) ring buffer, detect: kiting/circling/standing/mixed, `dominantPattern()`, `dominantDirection()`, `reset()` |
| `SquadAI.js`               | `window.squadAI` singleton — 1Hz coordinator, `_BucketGrid` O(N), `tagOnSpawn()` static, role assignment: assault/flanker/shield/support                        |

> ⚠️ `EnemyPersonality.js`, `FormationController.js`, `BossAI.js` **ไม่มี** — ถูก revised ออก: Personality อยู่ใน `BALANCE.ai.personalities` (config.js), Formation รวมใน SquadAI, Boss AI อยู่ใน ManopBoss/FirstBoss โดยตรง

### `/js/systems/`

| ไฟล์             | หน้าที่                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `GameState.js`   | State management (single source of truth) + `window.gameState` compat                              |
| `WaveManager.js` | Wave progression, enemy spawning, deterministic schedule                                           |
| `TimeManager.js` | Bullet time                                                                                        |
| `ShopSystem.js`  | ร้านค้า, upgrades                                                                                  |
| `AdminSystem.js` | Debug console (GUEST/OPERATOR/ROOT) — `spawn manop [1\|2\|3]`, `spawn first [advanced]`, `devbuff` |

### `/js/entities/`

| ไฟล์         | หน้าที่                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `base.js`    | Base Entity class — ทุก entity สืบทอด                                                                                          |
| `enemy.js`   | **EnemyBase** (บรรทัด 87) + Enemy, TankEnemy, MageEnemy — ศัตรูใหม่ทุกตัว extends EnemyBase ได้ AI+StatusEffect+hitFlash ทันที |
| `summons.js` | Pets, helpers, power-up entities                                                                                               |

### `/js/entities/boss/`

| ไฟล์                     | หน้าที่                                                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BossBase.js`            | Base Boss class — shared lifecycle, death hooks                                                                                                                                                 |
| `ManopBoss.js`           | KruManop + BossDog classes (math boss encounters)                                                                                                                                               |
| `FirstBoss.js`           | KruFirst class (physics boss with GravitationalSingularity)                                                                                                                                     |
| `boss_attacks_shared.js` | Shared attack effects — `ExpandingRing` (used by both bosses)                                                                                                                                   |
| `boss_attacks_manop.js`  | KruManop attacks — `BarkWave`, `GoldfishMinion`, `BubbleProjectile`, `MatrixGridAttack`, `DomainExpansion`, `EquationSlam`, `DeadlyGraph`, `ChalkWall`                                          |
| `boss_attacks_first.js`  | KruFirst attacks — `FreeFallWarningRing`, `PorkSandwich`, `EmpPulse`, `PhysicsFormulaZone`, `ParabolicVolley`, `OrbitalDebris`, `GravitationalSingularity`, `GravityWell`, `SuperpositionClone` |

### `/js/entities/player/`

| ไฟล์            | ตัวละคร     | บทบาท                                                                                                                                                                                                                                                                                                         |
| --------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlayerBase.js` | Base ทุกตัว | `applyDevBuff()`, `_hitFlashTimer`, passive unlock                                                                                                                                                                                                                                                            |
| `Kaoplayer.js`  | เก้า        | Assassin — stealth, teleport, clone                                                                                                                                                                                                                                                                           |
| `PoomPlayer.js` | ภูมิ        | Spiritual Warrior — ritual, naga, garuda                                                                                                                                                                                                                                                                      |
| `AutoPlayer.js` | ออโต้       | Thermodynamic Brawler — Heat Wave, Vacuum Pull+Ignite (Q), Overheat Detonation (E), Wanchai Stand (R-Click, JoJo-inspired crimson/gold), Heat Tier System (COLD/WARM/HOT/OVERHEAT), Stand Meter (0–100%), ORA Combo, Skill Synergy (Stand Pull/Charge Punch/Stand Guard), Rage Mode, Killing Blow Supercharge |
| `PatPlayer.js`  | แพท         | Samurai Ronin — Katana dual-mode (Slash Wave / Melee Combo), Zanzo Flash Q (afterimage blink+ambush), Iaido Strike R (3-phase cinematic kill), Blade Guard R-Click (projectile reflect) — ⚠️ `tryReflectProjectile` MUST set `proj.team='player'` AND `proj.owner='player'`; katana hands drawn inside katana `ctx.save()` block at local coords |

### `/js/rendering/`

- `PlayerRenderer.js` — วาด player ทั้งหมด (animations, effects, hit flash)
- `BossRenderer.js` — วาด boss ทั้งหมด (KruManop, KruFirst, BossDog, domain effects)

### `/assets/audio/`

`menu.mp3`, `battle.mp3`, `boss.mp3`, `glitch.mp3`

---

## 📝 Version Increment Criteria 🟡

**Service Worker Location:** `sw.js` line 1: `const CACHE_NAME = 'mtc-cache-vX.X.X';`

### 🎯 Decision Flow

| **Question**                                            | **Answer** | **Version Increment** |
| ------------------------------------------------------- | ---------- | --------------------- |
| 1. Is this a breaking change?                           | Yes        | **+1.00.00** (Major)  |
| 2. Is this a major new system or architecture refactor? | Yes        | **+0.01.00** (Minor)  |
| 3. Is this a bug fix or minor improvement?              | Yes        | **+0.00.01** (Patch)  |

### 📋 Version Types

#### **Major Version (+1.00.00)**

- Breaking changes that affect save compatibility or core game mechanics
- Complete engine migration (e.g., Godot migration)
- Fundamental architecture overhaul
- **NOT currently used in development cycle**

#### **Minor Version (+0.01.00)**

- Major new systems (AI Enhancement System, BGM Crossfade System)
- Architecture refactors (EnemyBase consolidation, new inheritance patterns)
- Complete new gameplay systems (Domain Expansion, Boss AI overhaul)
- Multiple related features bundled together
- **4+ new files created**
- Significant gameplay enhancement

#### **Patch Version (+0.00.01)**

- Bug fixes (Cooldown HUD fixes, collision corrections)
- Balance tweaks (Stat adjustments, difficulty modifications)
- Minor features (Individual skill improvements, UI polish)
- Documentation updates (README, changelog, PROJECT_OVERVIEW)
- Small quality-of-life improvements

### 🔄 Recent Examples

| **Version Change**  | **Type** | **Reason**                                                 |
| ------------------- | -------- | ---------------------------------------------------------- |
| v3.27.11 → v3.28.0  | +0.01.00 | AI Enhancement System (4 new files, architecture refactor) |
| v3.27.10 → v3.27.11 | +0.01.00 | BGM Crossfade System (major audio system)                  |
| v3.27.9 → v3.27.10  | +0.00.01 | Documentation Update (patch version)                       |
| v3.27.8 → v3.27.9   | +0.00.01 | UI Language & Theme Updates (minor features)               |

### ⚠️ Important Notes

- **Documentation-only updates** should increment patch version (+0.00.01) per workflow rules
- **Always update** all documentation files when incrementing version:
  - `sw.js` (CACHE_NAME)
  - `CHANGELOG.md` (add entry)
  - `PROJECT_OVERVIEW.md` (update status version)

### 🚦 Version Bump Ownership — Single Source of Truth

**IDE (ตอน commit) เท่านั้นที่ bump เลขเวอร์ชัน** — ไม่ว่าจะใช้ Windsurf, Cursor, Antigravity หรือ IDE ใดก็ตาม

| Role                         | Version Action                    |
| ---------------------------- | --------------------------------- |
| Claude (code analysis/fixes) | ❌ ไม่แตะเลขเวอร์ชัน              |
| Claude (doc summary in chat) | ❌ ไม่แตะเลขเวอร์ชัน              |
| IDE — commit & push          | ✅ bump ทุกไฟล์ในครั้งเดียว       |

**เหตุผล:** ถ้า Claude อัพเดทเลขใน `PROJECT_OVERVIEW.md` แล้ว IDE bump อีกรอบ → เวอร์ชันใน `sw.js` / `CHANGELOG.md` / `PROJECT_OVERVIEW.md` จะ desync กัน

**Claude + multi-session workflow:** Claude อาจถูกตัด session กลางคัน (token หมด) และขึ้นแชทใหม่บ่อย — ห้าม Claude เขียน version จริงลงไฟล์ใดๆ ทั้งนั้น ให้ใช้ `[NEXT VERSION]` ใน chat summary เท่านั้น IDE จะเติมเลขจริงตอน commit

---

## 🎮 Architecture 🟢

### Core Loop

```
Input (input.js) → Game Update (game.js) → Entity Updates → Collision (map.js) → Render → UI (ui.js)
```

### Key Design Patterns

- **Object Pooling** — particles/projectiles/FloatingText (effects.js) ลด GC
- **State Management** — GameState singleton
- **Static Bitmap Caching** — ใช้ `OffscreenCanvas` ใน `BossRenderer` และ `PlayerRenderer` เพื่อ cache static body parts (ช่วยลด draw calls และ GPU state switching)
- **Rendering Decoupling** — `PlayerRenderer.draw()` dispatcher → `_drawKao()` / `_drawPoom()` / `_drawAuto()`, `BossRenderer.draw()` dispatcher → `drawBoss()` / `drawBossFirst()` / `drawBossDog()`
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
แชทใหม่ / task แรก + ผู้ใช้แนบไฟล์มาด้วย:
  ใช้ uploads ที่แนบมาได้เลย — ไม่ต้องถามหาไฟล์อีก

แชทใหม่ / task แรก + ผู้ใช้ไม่ได้แนบไฟล์:
  แจ้ง "กรุณาส่งไฟล์ล่าสุดจาก project มาด้วยครับ"
  (ขอเฉพาะไฟล์ที่จำเป็นต่อ task นั้น)

task ต่อเนื่องในแชทเดิม (ผู้ใช้ไม่ได้แนบไฟล์ใหม่):
  ตรวจ /mnt/user-data/outputs/<filename> ก่อนเสมอ
  ถ้ามี → ใช้ output (cp /mnt/user-data/outputs/X /home/claude/X)
  ถ้าไม่มี → ใช้ /mnt/user-data/uploads/<filename>
  ❌ ห้ามถามหาไฟล์ซ้ำถ้ามีอยู่แล้วใน uploads หรือ outputs

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

**🚫 ห้ามถามหาไฟล์ซ้ำใน scenario เหล่านี้:**

- ผู้ใช้เพิ่งแนบไฟล์มาใน message ก่อนหน้าในแชทเดียวกัน
- มีไฟล์อยู่ใน /mnt/user-data/uploads/ หรือ /mnt/user-data/outputs/ แล้ว
- task ต่อเนื่องจาก task ก่อนหน้าในแชทเดียวกัน (เช่น "แก้ตามลำดับ" หลังจากวิเคราะห์)

### Commit & Push Workflow

1. Bump `sw.js` cache version (เช่น v3.11.14 → v3.11.15)
2. เพิ่ม entry ใน `CHANGELOG.md`
3. Commit & push พร้อมคำอธิบายละเอียด

**คำสั่ง IDE (ใช้ได้กับทุก IDE — Windsurf / Cursor / Antigravity / อื่นๆ):**
_"commit and push, check changes first, write detailed description, update @sw.js, @CHANGELOG.md, @PROJECT_OVERVIEW.md"_

> Claude มีหน้าที่เขียนโค้ด 100% — IDE รับผิดชอบ commit & push

---

## ⚙️ Critical Technical Notes

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

### Wave Events 🟡

| Event  | เงื่อนไข          | ผล                                    |
| ------ | ----------------- | ------------------------------------- |
| Dark   | Wave 1            | มืด                                   |
| Fog    | Waves 2,8,11,14   | หมอก                                  |
| Speed  | Waves 4,7,13      | ศัตรูเร็วขึ้น                         |
| Glitch | ทุก 5 waves       | invert controls, enemy melee dmg −40% |
| Boss   | Waves 3,6,9,12,15 | deterministic boss queue              |

### MTC Room

- ห้องฟื้นฟู — bounds, features, boss safe spawn Y อยู่ใน `BALANCE.mtcRoom` และ `BossBase` constructor guard

---

## 🔍 Quick Reference — Common Tasks 🟡

### เพิ่มตัวละครใหม่

**ต้องแก้:** `PlayerBase.js` (สืบทอด), `config.js`, `PlayerRenderer.js` (เพิ่ม `_draw[Name]()` + dispatcher), `menu.js`, `ui.js`, `audio.js`, `css/main.css`
**อาจกระทบ:** `game.js`, `WaveManager.js`, `weapons.js`

### เพิ่มบอสใหม่

**ต้องแก้:** สร้าง `js/entities/boss/[Name]Boss.js` (extends BossBase), `js/entities/boss/boss_attacks_[name].js` (หรือเพิ่มใน shared ถ้า attack ใช้ได้กับทุก boss), `BossRenderer.js` (เพิ่ม static draw method + dispatcher), `config.js`, `WaveManager.js`, `audio.js`, `index.html` (script tag)
**อาจกระทบ:** `summons.js`, `map.js`
⚠️ Boss มี Gemini speech integration ผ่าน `speak()` | Boss queue: waves 3,6,9,12,15
⚠️ window exports ต้องมี backward-compat alias (เช่น `window.BossXxx = XxxClass`) สำหรับ WaveManager + AdminSystem

### เพิ่มศัตรูใหม่

**ต้องแก้:** `enemy.js` (extends EnemyBase — ได้ AI+StatusEffect ทันที), `config.js`, `WaveManager.js` (SquadAI.tagOnSpawn() จะ auto-tag หลัง enemies.push()), `audio.js`, `effects.js`
**อาจกระทบ:** `weapons.js`

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
⚠️ BGM crossfade system uses Web Audio API GainNode — check \_crossfadeOutAndStop() for transitions

### แก้ UI / HUD

**ต้องแก้:** `ui.js`, `effects.js`, `css/main.css`
⚠️ AchievementSystem อยู่ใน `ui.js` | data save ผ่าน `getSaveData()`/`setSaveData()`
⚠️ **Mobile UI Enhancement:** Use `.pressed` class for button states, `navigator.vibrate(12)` for haptic feedback, `-webkit-tap-highlight-color: transparent` for better mobile experience

### แก้ Pause / Menu UI

**ต้องแก้:** `css/main.css` (`.resume-prompt-inner`, `.resume-btn`, `.rp-corner` ฯลฯ), `index.html` (HTML structure ของ `#resume-prompt`)
⚠️ Stat bar ของ char select อยู่ใน `index.html` (hard-coded width % + val) — ถ้าแก้ balance ต้องอัพเดท stat bars ด้วย
⚠️ Reference สำหรับ stat bars: HP max = Auto 230, SPD max = 298, RANGE max = Kao 900, DMG ref ≈ 150 DPS

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

## 🎨 Visual Workflow — แก้ Visual ต้องใช้ไฟล์ไหน?

### แกนหลัก 3 ไฟล์ (รู้จักก่อน)

| ไฟล์                | หน้าที่ visual                                                 | ตัวอย่าง                                 |
| ------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| `[Name]Renderer.js` | **shape / animation / look** ของ entity นั้นโดยตรง             | body, glove, mongkhon, flame crown       |
| `effects.js`        | **ผลกระทบชั่วคราว** ที่เกิดจาก event (spawn ครั้งเดียวแล้วหาย) | กระจาย particle, ตัวเลขลอย, screen shake |
| `config.js`         | **ค่าตัวเลข / สี** ที่ Renderer และ effects.js ดึงไปใช้        | สีผนัง, ระยะแสง, ค่า LIGHTING            |

---

### ✏️ แก้โมเดลตัวละคร (shape / animation)

**ใช้แค่ `PlayerRenderer.js`** — ไม่ต้องแตะไฟล์อื่น

```
ต้องการ                         → แก้ที่ไหน
───────────────────────────────────────────────────────
เปลี่ยน body shape               PlayerRenderer.js → _drawKao / _drawPoom / _drawAuto
เพิ่ม accessory (เช่น mongkhon)  PlayerRenderer.js → layer ที่เหมาะ
แก้ bob / sway animation         PlayerRenderer.js → oscillator vars (bob, breathe)
เปลี่ยนสี arm / glove             PlayerRenderer.js → color literal หรือดึงจาก config
แก้ hit flash visual             PlayerRenderer.js → _hitFlashTimer block
```

**เมื่อไหรถึงต้องใช้ `effects.js` ร่วม?**
เมื่อ visual นั้น _เกิดจาก event_ และ _หายเองหลังเวลาหนึ่ง_:

- เพิ่ม particle burst เมื่อ skill ถูกกด → `spawnParticles()` เรียกจาก player file, renderer แค่วาด body
- ตัวเลขลอย damage / heal → `spawnFloatingText()`
- เพิ่ม OrbitalParticle วนรอบตัวละคร → `OrbitalParticleSystem` ใน effects.js
- screen shake เมื่อ crit → `addScreenShake()`

> **กฎง่ายๆ:** ถ้า visual นั้น _วาดซ้ำทุกเฟรมตลอดชีวิต entity_ → `Renderer.js`  
> ถ้า _spawn ครั้งเดียวแล้ว fade/หาย_ → `effects.js`

---

### ✏️ แก้โมเดลบอส

เหมือนตัวละครทุกอย่าง แต่เปลี่ยนไฟล์:

```
แก้ shape / animation / layer    → BossRenderer.js  (static draw methods)
เพิ่ม particle burst / text      → spawnParticles() / spawnFloatingText() ใน boss files
แก้ domain expansion visual      → BossRenderer.js + boss_attacks_manop.js (DomainExpansion class)
```

---

### ✏️ แก้ Visual แผนที่ (Map)

แผนที่แบ่งชัดเป็น 3 layer:

```
Layer                  แก้ที่ไหน                    ตัวอย่าง
──────────────────────────────────────────────────────────────────────
Object shape/color     map.js                        drawWall(), drawDesk(), drawServer()
Object color palette   config.js                     BALANCE.map.mapColors.*
Object layout/size     map.js (generateCampusMap)    เพิ่ม/ย้าย object, เปลี่ยน grid
Lighting radius/color  config.js                     BALANCE.LIGHTING.*
Lighting logic         map.js (drawLighting)         punchLight(), tint type
Floor base color       config.js                     BALANCE.map.mapColors.floor / floorAlt
Weather (rain/snow)    effects.js                    WeatherSystem class
Screen shake           effects.js                    addScreenShake()
Decals (blood spots)   effects.js                    DecalSystem
Shell casings          effects.js                    ShellCasingSystem
```

**workflow ปกติเมื่อแก้ map visual:**

1. เปลี่ยนสีผนัง/พื้น → `config.js` → `BALANCE.map.mapColors`
2. เปลี่ยน shape ของ object → `map.js` → `drawWall()` / `drawDesk()` ฯลฯ
3. เพิ่ม object ใหม่ → `map.js` → เพิ่ม type ใน `MapObject.draw()` switch + `generateCampusMap()`
4. แก้ระยะแสง/สีแสง → `config.js` → `BALANCE.LIGHTING`
5. เพิ่ม particle/decal เมื่อ object ถูกทำลาย → `effects.js` → `DecalSystem` / `spawnParticles()`

> ⚠️ `map.js` ใช้ `CTX` (global canvas context) โดยตรง — ต่างจาก Renderer files ที่รับ `ctx` เป็น parameter  
> ⚠️ ห้าม `Math.random()` ใน `draw()` ของ map object — ใช้ deterministic seed แทน (ดูตัวอย่างใน `drawWall()`)

---

### 📊 Decision Tree สรุป

```
ต้องการแก้ visual อะไร?
│
├─ shape / body / animation ของ entity (วาดทุกเฟรม)
│   ├─ ตัวละคร   → PlayerRenderer.js
│   └─ บอส       → BossRenderer.js
│
├─ เกิดจาก event แล้วหายไปเอง
│   ├─ กระจาย particle     → effects.js  (spawnParticles)
│   ├─ ตัวเลขลอย           → effects.js  (spawnFloatingText)
│   ├─ orbital ring        → effects.js  (OrbitalParticleSystem)
│   ├─ screen shake        → effects.js  (addScreenShake)
│   ├─ decal / blood spot  → effects.js  (DecalSystem)
│   └─ shell casing        → effects.js  (ShellCasingSystem)
│
├─ ค่าตัวเลข / สีที่ใช้ใน Renderer หรือ effects
│   └─ config.js  (BALANCE.map.mapColors, BALANCE.LIGHTING, BALANCE.characters)
│
└─ แผนที่
    ├─ shape ของ object    → map.js  (draw methods ใน MapObject)
    ├─ layout / ตำแหน่ง   → map.js  (generateCampusMap)
    ├─ สี palette          → config.js  (BALANCE.map.mapColors)
    └─ แสง/เงา            → config.js  (BALANCE.LIGHTING) + map.js  (drawLighting)
```

---

## � Debugging Tools & Files

### Primary Debugging Files

| ไฟล์                        | หน้าที่                                                                        | วิธีใช้                                                              |
| --------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `Debug.html`                | **หน้า debug หลัก** - system diagnostics, performance profiling, health checks | เปิดใน browser โดยตรง (ไม่ต้องผ่านเกม)                               |
| `js/systems/AdminSystem.js` | **Admin Console** - commands, god mode, entity spawning                        | กด `~` ในเกม → พิมพ์คำสั่ง (`help`, `spawn manop`, `god`, `devbuff`) |
| `js/VersionManager.js`      | **Version sync** - ดึง version จาก service worker                              | Auto-run ตอน start เกม                                               |
| `sw.js`                     | **Service Worker** - cache management, version control                         | Update `CACHE_NAME` ทุกครั้งที่แก้โค้ด                               |

### Debug.html Features

- **System Health Checks** - ตรวจสอบ files loading, API availability, memory usage
- **Performance Profiling** - FPS monitoring, object pooling efficiency, GC pressure
- **Live Console** - Real-time log output พร้อม color coding
- **Achievement Inspector** - Browse achievements, unlock states, requirements
- **BALANCE Inspector** - View all config values, character stats, weapon data
- **Export Tools** - Copy diagnostics, save logs, generate reports

### Admin Console Commands (ในเกม)

กด `~` เปิด console แล้วพิมพ์:

| คำสั่ง                   | ผล                                | Permission |
| ------------------------ | --------------------------------- | ---------- | --------------------------- | -------- |
| `help`                   | แสดงคำสั่งทั้งหมด                 | GUEST      |
| `heal [100]`             | ฟื้น HP                           | OPERATOR   |
| `score [5000]`           | เพิ่มคะแนน                        | OPERATOR   |
| `next wave`              | ข้าม wave ปัจจุบัน                | OPERATOR   |
| `set wave [10]`          | กระโดดไป wave 10                  | OPERATOR   |
| `give weapon [rifle]`    | ได้รับอาวุธ                       | OPERATOR   |
| `spawn manop [1          | 2                                 | 3]`        | เรียก Kru Manop (phase 1-3) | OPERATOR |
| `spawn first [advanced]` | เรียก Kru First (normal/advanced) | OPERATOR   |
| `devbuff`                | +50% HP/EN, +25% DMG, +20% SPD    | OPERATOR   |
| `energy [100]`           | ฟื้นพลังงาน                       | OPERATOR   |
| `god` / `god off`        | ลิงก์เกอร์ / ปิด                  | ROOT       |
| `kill all`               | ฆ่าศัตรูทั้งหมด                   | ROOT       |
| `speed [2.0]`            | เพิ่มความเร็ว ×2                  | ROOT       |
| `reset buffs`            | ล้าง buff ทั้งหมด                 | ROOT       |
| `fps`                    | เปิด/ปิด FPS overlay              | GUEST      |

### Debugging Workflow

1. **Start with Debug.html** - ตรวจสอบ system health ก่อน
2. **Use Admin Console** ในเกมสำหรับ real-time testing
3. **Check Browser Console** (F12) สำหรับ JavaScript errors
4. **Use Performance Tab** ใน DevTools สำหรับ profiling
5. **Network Tab** สำหรับ API calls และ resource loading

---

## �🐛 Common Debugging Solutions

| ปัญหา                                                                              | สาเหตุ                                                                                                                                    | วิธีแก้                                                                                                                  |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ReferenceError: Cannot access X before initialization` ใน PlayerRenderer          | `moveT`/`bobY`/`R` ถูกใช้ก่อน declare                                                                                                     | ย้าย var declarations ขึ้นบนสุดของ function ก่อน dash ghost loop                                                         |
| Hit flash ค้างแดงตลอด                                                              | Contact damage reset `_hitFlashTimer` ทุกเฟรม                                                                                             | ตรวจ `_hitFlashLocked` flag ใน PlayerBase.js                                                                             |
| กระสุนออกจากตัวผู้เล่นแทนปากกระบอกปืน                                              | `offset` ใน `shootSingle()` ผิด                                                                                                           | ดูตาราง Muzzle Offset ใน SKILL.md §8                                                                                     |
| Passive unlock ไม่ทำงาน (Poom/Auto)                                                | Base `checkPassiveUnlock()` ตรวจ stealth count                                                                                            | Override `checkPassiveUnlock()` ใน subclass                                                                              |
| "Malformed Edit" (IDE multi-line edit)                                                        | Multi-line JS strings                                                                                                                     | บอก "ใช้ Python script" — script ใช้ UTF-8 + string.replace()                                                            |
| Boss spawn ใน MTC Room                                                             | spawnY ติด room bounds                                                                                                                    | ตรวจ BossBase constructor guard — safe spawn Y อยู่ใน BALANCE.mtcRoom                                                    |
| Performance drop                                                                   | GC / render bottleneck                                                                                                                    | ตรวจ object pooling ใน effects.js, ใช้ Debug.html profiling                                                              |
| Visual glitch                                                                      | ctx state leak                                                                                                                            | ตรวจ `ctx.save()`/`ctx.restore()` ครบคู่ใน PlayerRenderer.js                                                             |
| **`ReferenceError: EquationSlam is not defined` ใน Node/bundler**                  | **`effects.js` exports `EquationSlam`, `DeadlyGraph` ที่ไม่มีใน file**                                                                    | **ลบออกจาก `module.exports` — class เหล่านี้ไม่ได้ถูก implement ใน effects.js**                                          |
| **`waveAnnouncementFX` / `decalSystem` / `shellCasingSystem` หายใน strict module** | **ใช้แค่ `var` hoisting โดยไม่มี explicit `window.*` assign**                                                                             | **เพิ่ม `window.X = X` หลัง singleton construction ใน effects.js**                                                       |
| **`showVoiceBubble is not a function` ใน MTCRoom**                                 | **map.js เรียก bare `showVoiceBubble()` ที่ไม่มีใน global scope**                                                                         | **ใช้ `window.UIManager?.showVoiceBubble()` หรือ global wrapper จาก utils.js**                                           |
| **`drawDatabaseServer()` วาด sprite ซ้อนทับ `database` MapObject**                 | **AdminSystem.js ยังมี full sprite draw อยู่ แม้ MapObject `database` จะ render แล้ว**                                                    | **Slim ให้เหลือแค่ proximity aura — pattern เดียวกับ `drawShopObject()`**                                                |
| **Server rack แสงออกมาสีฟ้า (cool) แต่ LED เป็นสีทอง (amber)**                     | **`punchLight` type ใช้ `'cool'` แทน `'warm'` สำหรับ `server` type**                                                                      | **เปลี่ยน `'cool'`→`'warm'` ใน `drawLighting()` loop**                                                                   |
| **Courtyard ดูมืดกว่า zone อื่นแม้มีต้นไม้เยอะ**                                   | **`tree` type ไม่มี punchLight — ไม่ emit light เลย**                                                                                     | **เพิ่ม `else if (obj.type === 'tree')` ใน lighting loop + เพิ่ม `'green'` tint type**                                   |
| **Domain slow ไม่มีผล**                                                            | **แก้ `player.moveSpeed` แทน `player.stats.moveSpeed`**                                                                                   | **ใช้ `player.stats.moveSpeed` เสมอ — ดู SKILL.md §5 (stats.moveSpeed vs moveSpeed)**                                    |
| **`ReferenceError: Cannot access 'isBossWave' before initialization`**             | **`const isBossWave` declare หลังบรรทัดที่ใช้มัน (TDZ)**                                                                                  | **ย้าย `const wave/isBossWave/isGlitch` ขึ้นมาก่อน `waveAnnouncementFX.trigger()` เสมอ**                                 |
| **Shop item `speedWave` ซื้อแล้วไม่มีผล**                                          | **ShopSystem เซ็ต `_speedWaveTimer` แต่ game.js tick `shopSpeedBoostActive`**                                                             | **ใช้ `shopSpeedBoostActive/shopSpeedBoostTimer` เท่านั้น — property เดียวที่ game.js อ่าน**                             |
| **`ShopManager.tick()` ไม่ทำงานตอน shop เปิด**                                     | **Monkey-patch ใน ShopSystem.js ทับ static method และ guard `GameState.phase !== 'PLAYING'` (shop = PAUSED)**                             | **ห้าม monkey-patch `ShopManager.tick` นอก class — แก้ `static tick()` ใน ui.js โดยตรง**                                 |
| **`poomRice` CDR ไม่ stack กับ `cdr` item**                                        | **`poomRice` ใช้ `cooldownMultiplier` ต่างจาก `cdr` item ที่ใช้ `skillCooldownMult`**                                                     | **CDR property มาตรฐานคือ `skillCooldownMult` — ใช้ชื่อนี้เสมอในทุก item**                                               |
| **สกิลกดได้ทั้งที่ energy หมด**                                                    | **ไม่มี energy guard ใน skill activation block**                                                                                          | **เพิ่ม pattern `if (energy < cost)` ก่อน doSkill() — ดู SKILL.md §12**                                                  |
| **Auto Q-icon arc เกิน 100% ทันทีเมื่อใช้ Stand Pull**                             | **`updateSkillIcons` ใช้ `vacuumCooldown` (6s) เป็น max เสมอ แต่ Stand Pull set `cooldowns.vacuum = 10s`**                                | **max CD ต้อง dynamic: `wanchaiActive ? standPullCooldown : vacuumCooldown`**                                            |
| **Auto Q/E arc ไม่ขึ้นเลย**                                                        | **`AutoPlayer.updateUI()` เขียนไปที่ `'q-icon'`/`'e-icon'` แต่ DOM ใช้ id `'vacuum-icon'`/`'auto-det-icon'`**                             | **เปลี่ยน icon id ใน `AutoPlayer.updateUI()` ให้ตรงกับที่ `ui.js` ตั้งไว้**                                              |
| **Kao dash/stealth arc ไม่อัปเดต**                                                 | **`KaoPlayer.updateUI()` ไม่มี `dash-icon` / `stealth-icon` — comment บอก "handled by PlayerBase" แต่ PlayerBase ไม่มี `updateUI()` เลย** | **เพิ่ม `_setCooldownVisual('dash-icon', ...)` และ `_setCooldownVisual('stealth-icon', ...)` ใน `KaoPlayer.updateUI()`** |

---

## 📱 Mobile UI Development Patterns 🟡

### Mobile Button Architecture

**Location:** `js/input.js` — `_btnPress()` / `_btnRelease()` functions

```javascript
// Press feedback (visual + haptic)
function _btnPress(el) {
  if (el) el.classList.add("pressed");
  if (navigator.vibrate) navigator.vibrate(12);
}

// Release cleanup
function _btnRelease(el) {
  if (el) el.classList.remove("pressed");
}
```

### Mobile Button Event Pattern

**For each mobile button:**

```javascript
_mobileHandlers.btnXxxStart = function (e) {
  e.preventDefault();
  e.stopPropagation();
  _btnPress(btnXxx);
  // button logic here
};
_mobileHandlers.btnXxxEnd = function (e) {
  e.preventDefault();
  e.stopPropagation();
  _btnRelease(btnXxx);
};

// Event listeners
btnXxx.addEventListener("touchstart", _mobileHandlers.btnXxxStart, {
  passive: false,
});
btnXxx.addEventListener("touchend", _mobileHandlers.btnXxxEnd, {
  passive: false,
});
btnXxx.addEventListener("touchcancel", _mobileHandlers.btnXxxEnd, {
  passive: false,
}); // Critical!
```

### Mobile CSS Patterns

**Location:** `css/main.css`

```css
.action-btn {
  transition:
    transform 0.08s ease,
    background 0.08s ease,
    box-shadow 0.08s ease;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.action-btn.pressed {
  transform: scale(0.88);
  background: rgba(255, 255, 255, 0.18);
  box-shadow: 0 0 14px rgba(255, 255, 255, 0.25);
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .action-btn {
    transition: none !important;
  }
}
```

### Mobile Performance Guidelines

- **Touch Events:** Always use `{ passive: false }` for game controls
- **Touchcancel:** **CRITICAL** - Always include to prevent stuck states
- **Haptic Feedback:** Use `navigator.vibrate(12)` for 12ms taps
- **Visual Feedback:** `.pressed` class with `scale(0.88)` for responsive feel
- **Cleanup:** Comprehensive event listener removal in `cleanupMobileControls()`

---

## 🧠 AI Enhancement System 🟡

### Architecture

| Layer              | ไฟล์                       | Update Rate                     |
| ------------------ | -------------------------- | ------------------------------- |
| Individual AI      | `UtilityAI.js`             | 2Hz (0.5s timer)                |
| Tactical Actions   | `EnemyActions.js`          | เรียกจาก UtilityAI (stateless)  |
| Player Analysis    | `PlayerPatternAnalyzer.js` | Sample 10Hz / Compute 4Hz       |
| Squad Coordination | `SquadAI.js`               | 1Hz (1.0s timer)                |
| Entity Foundation  | `EnemyBase` (enemy.js)     | Every frame (via `_tickShared`) |

### EnemyBase — Auto-inherited by all enemies

ศัตรูใหม่ที่ `extends EnemyBase` ได้รับอัตโนมัติ: UtilityAI, StatusEffect framework, hit flash, sticky slow, ignite DoT, squad role tagging, AI dispose on death

**Template:**

```js
class SniperEnemy extends EnemyBase {
  constructor(x, y) {
    super(x, y, 18, "mage");
    this.type = "sniper";
  }
  update(dt, player) {
    if (this.dead) return;
    this._tickShared(dt, player); // AI+StatusEffect+hitFlash ครบ
    // movement + attack logic เท่านั้น
  }
  _onDeath(player) {
    /* death FX + score */
  }
}
```

### SquadAI — Role System

| Role    | Enemy Type | Action               | เงื่อนไข                              |
| ------- | ---------- | -------------------- | ------------------------------------- |
| assault | basic      | ATTACK direct        | basic ใกล้ centroid (< 50% radius)    |
| flanker | basic      | FLANK ally-density   | basic นอก centroid + flankerCount < 3 |
| shield  | tank       | SHIELD_WALL cohesion | tank ทุกตัวเสมอ                       |
| support | mage       | orbit + cast         | mage ทุกตัวเสมอ                       |

### PlayerPatternAnalyzer — Boss Counter Logic

| Pattern  | Detection               | Boss Response                                                                |
| -------- | ----------------------- | ---------------------------------------------------------------------------- |
| kiting   | distInc > 55%           | KruFirst: SUVAT_CHARGE / FREE_FALL. KruManop: DeadlyGraph/ChalkWall priority |
| circling | both-side perpendicular | KruFirst: ParabolicVolley lead-shot (dominant direction)                     |
| standing | standCount > 60%        | KruManop Phase 3: Slam / Log457 priority                                     |
| mixed    | ไม่มี dominant          | default skill rotation                                                       |

### Key Architecture Rules (อย่าเปลี่ยน)

- AI เขียนแค่ `_aiMoveX/_aiMoveY` — ห้ามเขียน `vx/vy` โดยตรง (vacuum/sticky เป็นเจ้าของ)
- `_tickShared()` ต้องเรียกต้น `update()` ของทุก subclass ก่อน logic ของ class
- BossBase ไม่มี `update()` — Boss AI ใส่ใน ManopBoss/FirstBoss โดยตรง
- Retreat ชนะ squad role override เสมอ (HP ต่ำ = หนีก่อน formation)

### Performance Budget

| Component                      | Cost        | Mitigation                     |
| ------------------------------ | ----------- | ------------------------------ |
| UtilityAI.tick() × 40 enemies  | ~2ms/frame  | อัปเดต 2Hz ไม่ใช่ 60Hz         |
| SquadAI.assignRoles()          | O(N) ทุก 1s | \_BucketGrid — ไม่รันทุก frame |
| PlayerPatternAnalyzer.record() | O(1)        | ring buffer ไม่มี allocation   |

**เป้าหมาย: < 3ms overhead ต่อ frame บน 40 enemies**

---

## 🤖 AI Roles

| Claude (ใช้ผ่าน claude.ai — อาจสลับ session บ่อยเพราะ token)  | IDE (Windsurf / Cursor / Antigravity / อื่นๆ) |
| -------------------------------------------------------------- | --------------------------------------------- |
| Complex refactoring, multi-file changes                        | Simple features, small tweaks                 |
| Deep bug analysis, root cause                                  | Commit & push                                 |
| Architecture redesign                                          | Documentation sync                            |
| Performance optimization                                       | File analysis, grep                           |
| Critical bug fixes                                             | UI/visual minor edits                         |

> ⚠️ **Multi-session note:** Claude ใช้แบบ free plan — token อาจหมดกลาง session ทำให้ต้องขึ้นแชทใหม่บ่อย
> ทุกแชทใหม่ควรแนบ `PROJECT_OVERVIEW.md` + ไฟล์ที่เกี่ยวข้องเพื่อให้ Claude มี context ครบ

---

**📌 อัปเดทเอกสารนี้เมื่อมีการเปลี่ยนแปลง architecture, critical patterns, หรือ pitfall ใหม่ที่ค้นพบ**

---

## 📝 Recent Changes

> **Change log อยู่ใน `CHANGELOG.md` เท่านั้น** — ไม่เก็บ commit history ในไฟล์นี้

`PROJECT_OVERVIEW.md` เป็น **architectural reference** — อัปเดตเฉพาะเมื่อ:

| เงื่อนไข | Section ที่แก้ |
| --- | --- |
| ไฟล์ใหม่ถูกเพิ่ม / ไฟล์เดิมถูกลบ | File Structure table |
| Wave schedule ใน WaveManager เปลี่ยน | Wave Events table |
| Room bounds / BossBase spawn guard ใน map.js เปลี่ยน | MTC Room section |
| Class constructor / alias ใหม่ | SKILL.md §2 Class Name Map (ไม่ใช่ที่นี่) |
| Architecture pattern ใหม่ (Core Loop, pattern เด่น) | Architecture section |

❌ **ห้ามเพิ่ม:** numeric stats, config values, balance changes, bug fix detail → ไปที่ `CHANGELOG.md`

---

## ✅ COMPLETE: Pat Character — Samurai Ronin

### Concept

- **ชื่อ:** แพท (Pat) — หัวหน้าห้อง, ตัวเตี้ย, แว่นกลม, ดูเนิร์ด แต่เป็นซามูไรโรนินเท่มาก
- **Visual identity:** นักเรียนชาย เสื้อขาวแขนพับ + cloth wrap มือ + katana เหน็บเอว — ขัดแย้งระหว่าง nerdy กับ cool
- **charId:** `pat` | **File:** `js/entities/player/PatPlayer.js`
- **Weapon:** Katana dual-mode — Slash Wave (projectile สีฟ้า) ระยะไกล / Melee Combo 3-hit ระยะประชิด (auto-switch ตามระยะ)

### Skills

| Key     | Skill            | Description                                                                                                                                                     |
| ------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q       | **Zanzo Flash**  | Blink ไป cursor, spawn afterimage trail 4 ghost (สีฟ้า fade), ถ้า enemy อยู่ใน 120px หลังลงจอด → ambush crit window 1.5s                                        |
| R       | **Iaido Strike** | 3-phase: (1) Charge 0.6s ย่อตัว → (2) Flash พุ่งไป cursor + white line + hit detect → (3) Cinematic freeze 0.5s TimeManager หันหลังเก็บดาบ → damage+blood burst |
| R-Click | **Blade Guard**  | ถือค้าง → speed ×0.6, reflect projectile ของ enemy/boss ที่เข้า radius 55px กลับไปเป็น friendly                                                                 |
| Passive | **Ronin's Edge** | Unlock: Iaido โดน enemy ครั้งแรก → HP +25%, Crit +5%, Melee dmg +15%                                                                                            |

### Color Palette

```
Body:      #1a1a2e (navy) / #e8e8e8 (white shirt)
Katana:    #7ec8e3 (ice blue glow)
Slash Wave:#a8d8ea (light blue projectile)
Zanzo:     #4a90d9 (afterimage, 40–70% alpha)
Blood FX:  #cc2222 (Iaido kill only)
Glasses:   #333333
```

### Build Progress

| Session   | งาน                                                                              | Status  |
| --------- | -------------------------------------------------------------------------------- | ------- |
| Session 1 | `BALANCE.characters['pat']` (config.js)                                          | ✅ Done |
| Session 1 | `PatPlayer.js` — full class                                                      | ✅ Done |
| Session 1 | `index.html` — script tag (หลัง PoomPlayer.js)                                   | ✅ Done |
| Session 2 | `config.js` refactor (Godot cleanup, AI comments, VISUALS.PALETTE.PAT)           | ✅ Done |
| Session 2 | `PlayerRenderer._drawPat()` + dispatcher                                         | ✅ Done |
| Session 3 | `effects.js` — `'zanzo'` particle type, `spawnZanzoTrail()`, `spawnBloodBurst()` | ✅ Done |
| Session 3 | `audio.js` — 7 Pat SFX methods                                                   | ✅ Done |
| Session 4 | `menu.js` — character select entry                                               | ✅ Done |
| Session 4 | `ui.js` — PORTRAITS.pat + HUD icons Q/R/R-Click + `_updateIconsPat()`            | ✅ Done |
| Session 5 | `PlayerBase.js` — Blade Guard speed penalty                                      | ✅ Done |
| **FINAL** | `weapons.js` — Blade Guard reflect hook ใน ProjectileManager                     | ✅ Done |

### Files to Touch

```
js/entities/player/PatPlayer.js     ✅ created
js/config.js                        ✅ pat block + refactor done
js/rendering/PlayerRenderer.js      ✅ _drawPat() + dispatcher done
js/effects.js                       ✅ zanzo type + spawnZanzoTrail + spawnBloodBurst
js/audio.js                         ✅ 7 Pat SFX methods
index.html                          ✅ script tag added
js/menu.js                          ✅ Pat character select entry
js/ui.js                            ✅ PORTRAITS.pat + HUD icons Q/R/R-Click
js/PlayerBase.js                    ✅ Blade Guard speed penalty
js/weapons.js                       ✅ Blade Guard reflect hook — DONE
```

### Critical Pitfalls (Pat-specific)

```javascript
// ✅ Blade Guard speed penalty — DONE (PlayerBase.js ~line 246):
if (this.bladeGuardActive) speedMult *= this.stats?.bladeGuardSpeedMult ?? 0.6;

// ✅ Blade Guard reflect — DONE (weapons.js ProjectileManager.update() line 1108–1109):
// if (typeof PatPlayer !== 'undefined' && window.player instanceof PatPlayer) {
//     if (window.player.tryReflectProjectile(proj)) { continue; }
// }
// ⚠️ CRITICAL: tryReflectProjectile MUST set proj.team = 'player' AND proj.owner = 'player'
//    proj.team controls collision routing — owner alone is not enough

// ✅ Katana LAYER 2 hands — MUST be inside katana transform ctx.save() block
//    hands at tsuba(-2,0) and pommel(-HL*0.78,0) in local space — NOT fixed screen coords

// ✅ Iaido TimeManager — มีใน PatPlayer._resolveIaidoDamage() แล้ว
// ✅ R key conflict — PatPlayer._handleRKey() จัดการเอง
// ✅ Audio call sites — playPatSlash/Zanzo/IaidoCharge/IaidoStrike/Sheathe/Reflect/MeleeHit
// ✅ Effects — spawnZanzoTrail(fromX,fromY,toX,toY,angle,4)
//              spawnBloodBurst(enemy.x,enemy.y,18) ใน _resolveIaidoDamage() เท่านั้น
```