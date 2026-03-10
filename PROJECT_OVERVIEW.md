# 🎮 MTC Game - Project Overview
> สำหรับ AI Assistant — อ่านเมื่อเริ่มแชทใหม่เพื่อเข้าใจโปรเจคต์ก่อนลงมือ

**MTC the Game** — Top-down 2D Wave Survival Shooter, 15 waves + bosses + upgrades
**Stack:** Vanilla JS + HTML5 Canvas (ไม่มี framework) | **Target:** 60 FPS | **Status:** Beta v3.29.9

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
| `input.js` | Keyboard/mouse/touch — global `keys` object, **mobile haptic feedback**, **button press states**, **touchcancel cleanup** |
| `audio.js` | SFX + BGM, Web Audio API, BGM crossfade system, namespace protection |
| `effects.js` | Particles (object pool), FloatingText, OrbitalParticle |
| `weapons.js` | WeaponSystem, Projectile, ProjectileManager, SpatialGrid |
| `map.js` | แผนที่, collision detection, MTCRoom |
| `ui.js` | HUD, **AchievementSystem** (อยู่ที่นี่ — ไม่ใช่ไฟล์แยก), **high score display**, **mobile UI polish** |
| `menu.js` | Main menu, `selectCharacter()` |
| `ai.js` | Legacy AI behaviors (pre-EnemyBase refactor) — verify ยังใช้อยู่ไหม |
| `utils.js` | Utility functions |
| `tutorial.js` | Tutorial system |

### `/js/ai/` — AI Enhancement System 🟡
Load order: `UtilityAI.js → EnemyActions.js → PlayerPatternAnalyzer.js → SquadAI.js`

| ไฟล์ | หน้าที่ |
|------|--------|
| `UtilityAI.js` | Core decision system — 2Hz timer, utility scoring, personality-weighted, delegates actions ไป EnemyActions, อ่าน `_squadRole` override |
| `EnemyActions.js` | Static action library — `retreat()`, `flank()`, `shieldWall()`, `strafeOrbit()` (stateless, ไม่มี state ของตัวเอง) |
| `PlayerPatternAnalyzer.js` | `window.playerAnalyzer` singleton — Float32Array(30) ring buffer, detect: kiting/circling/standing/mixed, `getDominantStyle()`, `dominantDirection()`, `reset()` |
| `SquadAI.js` | `window.squadAI` singleton — 1Hz coordinator, `_BucketGrid` O(N), `tagOnSpawn()` static, role assignment: assault/flanker/shield/support |

> ⚠️ `EnemyPersonality.js`, `FormationController.js`, `BossAI.js` **ไม่มี** — ถูก revised ออก: Personality อยู่ใน `BALANCE.ai.personalities` (config.js), Formation รวมใน SquadAI, Boss AI อยู่ใน ManopBoss/FirstBoss โดยตรง

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
| `enemy.js` | **EnemyBase** (บรรทัด 87) + Enemy, TankEnemy, MageEnemy — ศัตรูใหม่ทุกตัว extends EnemyBase ได้ AI+StatusEffect+hitFlash ทันที |
| `summons.js` | Pets, helpers, power-up entities |

### `/js/entities/boss/`
| ไฟล์ | หน้าที่ |
|------|--------|
| `BossBase.js` | Base Boss class — shared lifecycle, death hooks |
| `ManopBoss.js` | KruManop + BossDog classes (math boss encounters) |
| `FirstBoss.js` | KruFirst class (physics boss with GravitationalSingularity) |
| `boss_attacks.js` | Attack patterns, domain expansion, skill mechanics |

### `/js/entities/player/`
| ไฟล์ | ตัวละคร | บทบาท |
|------|--------|-------|
| `PlayerBase.js` | Base ทุกตัว | `applyDevBuff()`, `_hitFlashTimer`, passive unlock |
| `Kaoplayer.js` | เก้า | Assassin — stealth, teleport, clone |
| `PoomPlayer.js` | ภูมิ | Spiritual Warrior — ritual, naga, garuda |
| `AutoPlayer.js` | ออโต้ | Thermodynamic Brawler — Heat Wave, Vacuum Pull+Ignite (Q), Overheat Detonation (E), Wanchai Stand (R-Click, JoJo-inspired crimson/gold), Heat Tier System (COLD/WARM/HOT/OVERHEAT), Stand Meter (0–100%), ORA Combo, Skill Synergy (Stand Pull/Charge Punch/Stand Guard), Rage Mode, Killing Blow Supercharge |

### `/js/rendering/`
- `PlayerRenderer.js` — วาด player ทั้งหมด (animations, effects, hit flash)
- `BossRenderer.js` — วาด boss ทั้งหมด (KruManop, KruFirst, BossDog, domain effects)

### `/assets/audio/`
`menu.mp3`, `battle.mp3`, `boss.mp3`, `glitch.mp3`

---

## 📝 Version Increment Criteria 🟡

**Service Worker Location:** `sw.js` line 1: `const CACHE_NAME = 'mtc-cache-vX.X.X';`

### 🎯 Decision Flow

| **Question** | **Answer** | **Version Increment** |
|--------------|------------|---------------------|
| 1. Is this a breaking change? | Yes | **+1.00.00** (Major) |
| 2. Is this a major new system or architecture refactor? | Yes | **+0.01.00** (Minor) |
| 3. Is this a bug fix or minor improvement? | Yes | **+0.00.01** (Patch) |

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

| **Version Change** | **Type** | **Reason** |
|-------------------|----------|------------|
| v3.27.11 → v3.28.0 | +0.01.00 | AI Enhancement System (4 new files, architecture refactor) |
| v3.27.10 → v3.27.11 | +0.01.00 | BGM Crossfade System (major audio system) |
| v3.27.9 → v3.27.10 | +0.00.01 | Documentation Update (patch version) |
| v3.27.8 → v3.27.9 | +0.00.01 | UI Language & Theme Updates (minor features) |

### ⚠️ Important Notes

- **Documentation-only updates** should increment patch version (+0.00.01) per workflow rules
- **Always update** all documentation files when incrementing version:
  - `sw.js` (CACHE_NAME)
  - `CHANGELOG.md` (add entry)
  - `README-info.md` (update current version)
  - `PROJECT_OVERVIEW.md` (update status version)

---

## 🎮 Architecture 🟢

### Core Loop
```
Input (input.js) → Game Update (game.js) → Entity Updates → Collision (map.js) → Render → UI (ui.js)
```

### Key Design Patterns
- **Object Pooling** — particles/projectiles/FloatingText (effects.js) ลด GC
- **State Management** — GameState singleton
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

### Character Quick-Stats 🔴 (verify in config.js)
| Char | HP | MoveSpeed | DashSpeed | Key Cooldowns |
|------|----|-----------|-----------|--------------|
| **Kao** | 119 | 298 | 550 | Stealth 5.5s, Clone 25s, Teleport 18s, Dash 1.65s |
| **Poom** | 165 | 298 | 520 | Naga 22s / 9s dur, EatRice 10s, Dash 1.65s |
| **Auto** | 230 | 260 | 490 | Wanchai 12s / 8s dur, Vacuum 6s, Detonate 8s, Dash 1.7s |

Poom key values: `riceDamage: 62`, `riceCooldown: 0.42`, `nagaDamage: 100`, `nagaSegments: 18`  
Kao key values: `critMultiplier: 2.5`, `baseCritChance: 0.05`, `damageMultiplierPerLevel: 0.12`


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
| Auto | Q Vacuum/Stand Pull | `vacuumEnergyCost` | 20 |
| Auto | E Detonation/Charge Punch | `detonationEnergyCost` | 30 |
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

### Auto Rework — "The Thermodynamic Stand User" 🔥

> **Status:** ✅ **COMPLETE** — All 4 features + Bug Fix (Stand Rush cooldown fallthrough)
> Files: `AutoPlayer.js`, `PlayerRenderer.js`, `config.js`

#### Base Stats (ค่าปัจจุบันใน config.js)
| Stat | ค่า | หมายเหตุ |
|------|-----|---------|
| HP | **230** | Tank identity (+10) |
| MoveSpeed | **260** | ช้ากว่า Kao/Poom (298) |
| DashSpeed | 490 / CD 1.7s | |
| EnergyRegen | 20/s | |
| Wanchai Duration | **8.0s** | +2s จาก 6.0s |
| Wanchai Cooldown | **12s** | +3s จาก 9s (less spammy) |
| Wanchai Damage | **30/punch** | NERF จาก 38 |
| Punch Rate | **0.10s** (10/s) | NERF จาก 0.09s |
| HP Drain OVERHEAT | **5/s** | NERF จาก 3 (risk จริง) |

#### ✅ Heat Tier System
| Tier | Range | Effect |
|------|-------|--------|
| COLD | 0–33% | dmg ×0.70, speed ×0.90 (penalty) |
| WARM | 34–66% | dmg ×1.15, punch rate ×0.85 |
| HOT | 67–99% | dmg ×1.30, punch rate ×0.70, melee range+ |
| OVERHEAT | 100% | dmg ×1.50, crit +20%, HP drain 5/s |

- **Heat idle decay:** 2.0s ไม่ hit → +8/s extra decay (`heatIdleDecayDelay`, `heatIdleDecayRate`)
- **Vent Explosion** (OVERHEAT→HOT drop): 45 dmg AOE 160px, screen shake +6

#### ✅ Feature 2 — Rage Engine / Killing Blow Supercharge
- **Supercharge** (kill ขณะ combo ≥5): +30 heat (`heatOnKillSupercharge`), rush cooldown reset
- **Rage Mode** (OVERHEAT + HP <30%): dmg ×1.30, dmg reduction 20%
- **Stand Absorb** visual: scale ×1.25 + gold ring ที่ combo ≥5

#### ✅ Feature 3 — Skill Synergy (Wanchai Active)
- **Q → Stand Pull**: pull range 380px (`standPullRange`), 18 dmg/enemy, uses vacuumCooldown
- **E hold → Charge Punch**: max 1.5s charge → ×3.5 dmg, ×1.3 range (ต่างจาก E ปกติ = Detonation)
- **Shift → Stand Guard**: block input, Stand ยืนหน้า, 60% dmg reduction (`standGuardReduction`)

#### ✅ Feature 4 — Stand Meter (แทน countdown timer)
- Drain: 8/s normal | ×1.30 ขณะ COLD | ×0.50 ขณะ OVERHEAT
- Fill: +4/hit (Stand หรือ player), +12/kill ขณะ active
- HUD: `"❄️42%"` / `"🔥87%"` / `"💥94%"` ตาม tier

#### ✅ Bug Fix — Stand Rush Cooldown Fallthrough
- เดิม: Wanchai active + L-Click → `return` ทุกกรณี → ยิงไม่ได้ระหว่าง CD
- แก้: CD หมด → Stand Rush; CD ยังอยู่ → fall through ยิง Heat Wave ได้ปกติ

#### WanchaiStand Visual Reference
- **Palette:** crimson `#dc2626` / gold `#f59e0b`
- **ORA combo:** 0–10, fist fan 5→12 หมัด, "ORA ORA ORA!" gold text ที่ combo ≥5
- **Charge ring:** pulsing arc รอบผู้เล่น (#dc2626→#fef08a), "MAX!" เมื่อ ready
- **Guard stance:** arms crossed + gold shield arc

### FloatingText Stack-Offset 🟡
`FloatingTextSystem.spawn()` นับ live texts ในรัศมี 40px ก่อน spawn ใหม่ — offset ขึ้น 22px ต่อชั้น (max 5 ชั้น) ป้องกัน text ซ้อนทับกัน

---

## 🔍 Quick Reference — Common Tasks 🟡

### เพิ่มตัวละครใหม่
**ต้องแก้:** `PlayerBase.js` (สืบทอด), `config.js`, `PlayerRenderer.js` (เพิ่ม `_draw[Name]()` + dispatcher), `menu.js`, `ui.js`, `audio.js`, `css/main.css`
**อาจกระทบ:** `game.js`, `WaveManager.js`, `weapons.js`

### เพิ่มบอสใหม่
**ต้องแก้:** สร้าง `js/entities/boss/[Name]Boss.js` (extends BossBase), `boss_attacks.js`, `BossRenderer.js` (เพิ่ม static draw method + dispatcher), `config.js`, `WaveManager.js`, `audio.js`, `index.html` (script tag)
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
⚠️ BGM crossfade system uses Web Audio API GainNode — check _crossfadeOutAndStop() for transitions

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

| ไฟล์ | หน้าที่ visual | ตัวอย่าง |
|------|--------------|---------|
| `[Name]Renderer.js` | **shape / animation / look** ของ entity นั้นโดยตรง | body, glove, mongkhon, flame crown |
| `effects.js` | **ผลกระทบชั่วคราว** ที่เกิดจาก event (spawn ครั้งเดียวแล้วหาย) | กระจาย particle, ตัวเลขลอย, screen shake |
| `config.js` | **ค่าตัวเลข / สี** ที่ Renderer และ effects.js ดึงไปใช้ | สีผนัง, ระยะแสง, ค่า LIGHTING |

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
เมื่อ visual นั้น *เกิดจาก event* และ *หายเองหลังเวลาหนึ่ง*:
- เพิ่ม particle burst เมื่อ skill ถูกกด → `spawnParticles()` เรียกจาก player file, renderer แค่วาด body
- ตัวเลขลอย damage / heal → `spawnFloatingText()`
- เพิ่ม OrbitalParticle วนรอบตัวละคร → `OrbitalParticleSystem` ใน effects.js
- screen shake เมื่อ crit → `addScreenShake()`

> **กฎง่ายๆ:** ถ้า visual นั้น *วาดซ้ำทุกเฟรมตลอดชีวิต entity* → `Renderer.js`  
> ถ้า *spawn ครั้งเดียวแล้ว fade/หาย* → `effects.js`

---

### ✏️ แก้โมเดลบอส

เหมือนตัวละครทุกอย่าง แต่เปลี่ยนไฟล์:

```
แก้ shape / animation / layer    → BossRenderer.js  (static draw methods)
เพิ่ม particle burst / text      → spawnParticles() / spawnFloatingText() ใน boss files
แก้ domain expansion visual      → BossRenderer.js + boss_attacks.js (DomainExpansion class)
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
| ไฟล์ | หน้าที่ | วิธีใช้ |
|------|--------|---------|
| `Debug.html` | **หน้า debug หลัก** - system diagnostics, performance profiling, health checks | เปิดใน browser โดยตรง (ไม่ต้องผ่านเกม) |
| `js/systems/AdminSystem.js` | **Admin Console** - commands, god mode, entity spawning | กด `~` ในเกม → พิมพ์คำสั่ง (`help`, `spawn manop`, `god`, `devbuff`) |
| `js/VersionManager.js` | **Version sync** - ดึง version จาก service worker | Auto-run ตอน start เกม |
| `sw.js` | **Service Worker** - cache management, version control | Update `CACHE_NAME` ทุกครั้งที่แก้โค้ด |

### Debug.html Features
- **System Health Checks** - ตรวจสอบ files loading, API availability, memory usage
- **Performance Profiling** - FPS monitoring, object pooling efficiency, GC pressure
- **Live Console** - Real-time log output พร้อม color coding
- **Achievement Inspector** - Browse  achievements, unlock states, requirements
- **BALANCE Inspector** - View all config values, character stats, weapon data
- **Export Tools** - Copy diagnostics, save logs, generate reports

### Admin Console Commands (ในเกม)
กด `~` เปิด console แล้วพิมพ์:

| คำสั่ง | ผล | Permission |
|--------|-----|------------|
| `help` | แสดงคำสั่งทั้งหมด | GUEST |
| `heal [100]` | ฟื้น HP | OPERATOR |
| `score [5000]` | เพิ่มคะแนน | OPERATOR |
| `next wave` | ข้าม wave ปัจจุบัน | OPERATOR |
| `set wave [10]` | กระโดดไป wave 10 | OPERATOR |
| `give weapon [rifle]` | ได้รับอาวุธ | OPERATOR |
| `spawn manop [1|2|3]` | เรียก Kru Manop (phase 1-3) | OPERATOR |
| `spawn first [advanced]` | เรียก Kru First (normal/advanced) | OPERATOR |
| `devbuff` | +50% HP/EN, +25% DMG, +20% SPD | OPERATOR |
| `energy [100]` | ฟื้นพลังงาน | OPERATOR |
| `god` / `god off` | ลิงก์เกอร์ / ปิด | ROOT |
| `kill all` | ฆ่าศัตรูทั้งหมด | ROOT |
| `speed [2.0]` | เพิ่มความเร็ว ×2 | ROOT |
| `reset buffs` | ล้าง buff ทั้งหมด | ROOT |
| `fps` | เปิด/ปิด FPS overlay | GUEST |

### Debugging Workflow
1. **Start with Debug.html** - ตรวจสอบ system health ก่อน
2. **Use Admin Console** ในเกมสำหรับ real-time testing
3. **Check Browser Console** (F12) สำหรับ JavaScript errors
4. **Use Performance Tab** ใน DevTools สำหรับ profiling
5. **Network Tab** สำหรับ API calls และ resource loading

---

## �🐛 Common Debugging Solutions

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
| **`ReferenceError: EquationSlam is not defined` ใน Node/bundler** | **`effects.js` exports `EquationSlam`, `DeadlyGraph` ที่ไม่มีใน file** | **ลบออกจาก `module.exports` — class เหล่านี้ไม่ได้ถูก implement ใน effects.js** |
| **`waveAnnouncementFX` / `decalSystem` / `shellCasingSystem` หายใน strict module** | **ใช้แค่ `var` hoisting โดยไม่มี explicit `window.*` assign** | **เพิ่ม `window.X = X` หลัง singleton construction ใน effects.js** |
| **`showVoiceBubble is not a function` ใน MTCRoom** | **map.js เรียก bare `showVoiceBubble()` ที่ไม่มีใน global scope** | **ใช้ `window.UIManager?.showVoiceBubble()` หรือ global wrapper จาก utils.js** |
| **`drawDatabaseServer()` วาด sprite ซ้อนทับ `database` MapObject** | **AdminSystem.js ยังมี full sprite draw อยู่ แม้ MapObject `database` จะ render แล้ว** | **Slim ให้เหลือแค่ proximity aura — pattern เดียวกับ `drawShopObject()`** |
| **Server rack แสงออกมาสีฟ้า (cool) แต่ LED เป็นสีทอง (amber)** | **`punchLight` type ใช้ `'cool'` แทน `'warm'` สำหรับ `server` type** | **เปลี่ยน `'cool'`→`'warm'` ใน `drawLighting()` loop** |
| **Courtyard ดูมืดกว่า zone อื่นแม้มีต้นไม้เยอะ** | **`tree` type ไม่มี punchLight — ไม่ emit light เลย** | **เพิ่ม `else if (obj.type === 'tree')` ใน lighting loop + เพิ่ม `'green'` tint type** |
| **Domain slow ไม่มีผล** | **แก้ `player.moveSpeed` แทน `player.stats.moveSpeed`** | **ใช้ `player.stats.moveSpeed` เสมอ — ดู Domain Slow Critical Note** |
| **`ReferenceError: Cannot access 'isBossWave' before initialization`** | **`const isBossWave` declare หลังบรรทัดที่ใช้มัน (TDZ)** | **ย้าย `const wave/isBossWave/isGlitch` ขึ้นมาก่อน `waveAnnouncementFX.trigger()` เสมอ** |
| **Shop item `speedWave` ซื้อแล้วไม่มีผล** | **ShopSystem เซ็ต `_speedWaveTimer` แต่ game.js tick `shopSpeedBoostActive`** | **ใช้ `shopSpeedBoostActive/shopSpeedBoostTimer` เท่านั้น — property เดียวที่ game.js อ่าน** |
| **`ShopManager.tick()` ไม่ทำงานตอน shop เปิด** | **Monkey-patch ใน ShopSystem.js ทับ static method และ guard `GameState.phase !== 'PLAYING'` (shop = PAUSED)** | **ห้าม monkey-patch `ShopManager.tick` นอก class — แก้ `static tick()` ใน ui.js โดยตรง** |
| **`poomRice` CDR ไม่ stack กับ `cdr` item** | **`poomRice` ใช้ `cooldownMultiplier` ต่างจาก `cdr` item ที่ใช้ `skillCooldownMult`** | **CDR property มาตรฐานคือ `skillCooldownMult` — ใช้ชื่อนี้เสมอในทุก item** |
| **สกิลกดได้ทั้งที่ energy หมด** | **ไม่มี energy guard ใน skill activation block** | **เพิ่ม pattern `if (energy < cost)` ก่อน doSkill() — ดู Energy Cost System** |
| **Auto Q-icon arc เกิน 100% ทันทีเมื่อใช้ Stand Pull** | **`updateSkillIcons` ใช้ `vacuumCooldown` (6s) เป็น max เสมอ แต่ Stand Pull set `cooldowns.vacuum = 10s`** | **max CD ต้อง dynamic: `wanchaiActive ? standPullCooldown : vacuumCooldown`** |
| **Auto Q/E arc ไม่ขึ้นเลย** | **`AutoPlayer.updateUI()` เขียนไปที่ `'q-icon'`/`'e-icon'` แต่ DOM ใช้ id `'vacuum-icon'`/`'auto-det-icon'`** | **เปลี่ยน icon id ใน `AutoPlayer.updateUI()` ให้ตรงกับที่ `ui.js` ตั้งไว้** |
| **Kao dash/stealth arc ไม่อัปเดต** | **`KaoPlayer.updateUI()` ไม่มี `dash-icon` / `stealth-icon` — comment บอก "handled by PlayerBase" แต่ PlayerBase ไม่มี `updateUI()` เลย** | **เพิ่ม `_setCooldownVisual('dash-icon', ...)` และ `_setCooldownVisual('stealth-icon', ...)` ใน `KaoPlayer.updateUI()`** |

---

## 📱 Mobile UI Development Patterns 🟡

### Mobile Button Architecture
**Location:** `js/input.js` — `_btnPress()` / `_btnRelease()` functions

```javascript
// Press feedback (visual + haptic)
function _btnPress(el) {
    if (el) el.classList.add('pressed');
    if (navigator.vibrate) navigator.vibrate(12);
}

// Release cleanup
function _btnRelease(el) {
    if (el) el.classList.remove('pressed');
}
```

### Mobile Button Event Pattern
**For each mobile button:**
```javascript
_mobileHandlers.btnXxxStart = function (e) {
    e.preventDefault(); e.stopPropagation(); 
    _btnPress(btnXxx);
    // button logic here
};
_mobileHandlers.btnXxxEnd = function (e) {
    e.preventDefault(); e.stopPropagation(); 
    _btnRelease(btnXxx);
};

// Event listeners
btnXxx.addEventListener('touchstart', _mobileHandlers.btnXxxStart, { passive: false });
btnXxx.addEventListener('touchend', _mobileHandlers.btnXxxEnd, { passive: false });
btnXxx.addEventListener('touchcancel', _mobileHandlers.btnXxxEnd, { passive: false }); // Critical!
```

### Mobile CSS Patterns
**Location:** `css/main.css`

```css
.action-btn {
    transition: transform 0.08s ease, background 0.08s ease, box-shadow 0.08s ease;
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
| Layer | ไฟล์ | Update Rate |
|-------|------|------------|
| Individual AI | `UtilityAI.js` | 2Hz (0.5s timer) |
| Tactical Actions | `EnemyActions.js` | เรียกจาก UtilityAI (stateless) |
| Player Analysis | `PlayerPatternAnalyzer.js` | Sample 10Hz / Compute 4Hz |
| Squad Coordination | `SquadAI.js` | 1Hz (1.0s timer) |
| Entity Foundation | `EnemyBase` (enemy.js) | Every frame (via `_tickShared`) |

### EnemyBase — Auto-inherited by all enemies
ศัตรูใหม่ที่ `extends EnemyBase` ได้รับอัตโนมัติ: UtilityAI, StatusEffect framework, hit flash, sticky slow, ignite DoT, squad role tagging, AI dispose on death

**Template:**
```js
class SniperEnemy extends EnemyBase {
    constructor(x, y) { super(x, y, 18, 'mage'); this.type = 'sniper'; }
    update(dt, player) {
        if (this.dead) return;
        this._tickShared(dt, player); // AI+StatusEffect+hitFlash ครบ
        // movement + attack logic เท่านั้น
    }
    _onDeath(player) { /* death FX + score */ }
}
```

### SquadAI — Role System
| Role | Enemy Type | Action | เงื่อนไข |
|------|-----------|--------|---------|
| assault | basic | ATTACK direct | basic ใกล้ centroid (< 50% radius) |
| flanker | basic | FLANK ally-density | basic นอก centroid + flankerCount < 3 |
| shield | tank | SHIELD_WALL cohesion | tank ทุกตัวเสมอ |
| support | mage | orbit + cast | mage ทุกตัวเสมอ |

### PlayerPatternAnalyzer — Boss Counter Logic
| Pattern | Detection | Boss Response |
|---------|-----------|--------------|
| kiting | distInc > 55% | KruFirst: SUVAT_CHARGE / FREE_FALL. KruManop: DeadlyGraph/ChalkWall priority |
| circling | both-side perpendicular | KruFirst: ParabolicVolley lead-shot (dominant direction) |
| standing | standCount > 60% | KruManop Phase 3: Slam / Log457 priority |
| mixed | ไม่มี dominant | default skill rotation |

### Key Architecture Rules (อย่าเปลี่ยน)
- AI เขียนแค่ `_aiMoveX/_aiMoveY` — ห้ามเขียน `vx/vy` โดยตรง (vacuum/sticky เป็นเจ้าของ)
- `_tickShared()` ต้องเรียกต้น `update()` ของทุก subclass ก่อน logic ของ class
- BossBase ไม่มี `update()` — Boss AI ใส่ใน ManopBoss/FirstBoss โดยตรง
- Retreat ชนะ squad role override เสมอ (HP ต่ำ = หนีก่อน formation)

### Performance Budget
| Component | Cost | Mitigation |
|-----------|------|-----------|
| UtilityAI.tick() × 40 enemies | ~2ms/frame | อัปเดต 2Hz ไม่ใช่ 60Hz |
| SquadAI.assignRoles() | O(N) ทุก 1s | _BucketGrid — ไม่รันทุก frame |
| PlayerPatternAnalyzer.record() | O(1) | ring buffer ไม่มี allocation |

**เป้าหมาย: < 3ms overhead ต่อ frame บน 40 enemies**

---

## 📝 Recent Major Changes (v3.29.3)

### Bug Fix Batch — Shop System + WaveManager (v3.29.3 — March 10, 2026)
**Purpose:** แก้บัคใน ShopSystem, WaveManager, ui.js, game.js — รวม 7 บัค (2 Critical, 3 High, 2 Medium)

**Files Changed:** `js/systems/WaveManager.js`, `js/systems/ShopSystem.js`, `js/ui.js`, `js/game.js`

**Key Fixes:**
**🔴 Critical**
- **WaveManager TDZ crash** — `ReferenceError: Cannot access 'isBossWave' before initialization` บรรทัด 490: ย้าย `const wave/isBossWave/isGlitch` ขึ้นมาก่อน `waveAnnouncementFX.trigger()` ซึ่งใช้ทั้งสองตัว; แก้ `getWave()` ที่ถูกเรียกซ้ำซ้อน
- **`speedWave` item ไม่มีผล** — ShopSystem เซ็ต `_speedWaveTimer/_speedWaveMult` แต่ game.js tick `shopSpeedBoostActive/shopSpeedBoostTimer` — เปลี่ยน ShopSystem + game.js ให้ใช้ property เดียวกัน พร้อม restore ผ่าน `stats.moveSpeed`

**🟠 High**
- **`ShopManager.tick()` monkey-patch ทับ static method** — `ShopSystem.js` เขียนทับ `static tick()` จาก `ui.js` และ guard `GameState.phase !== 'PLAYING'` ทำให้ไม่ทำงานขณะ shop เปิด (PAUSED); ลบ monkey-patch ออก + refactor `static tick()` ให้ update badge in-place
- **`poomRice` CDR property ผิด** — ใช้ `cooldownMultiplier` แทน `skillCooldownMult` ทำให้ไม่ stack กับ `cdr` item; แก้เป็น `skillCooldownMult`

**🟡 Medium**
- **Double `rollShopItems()` at load** — call ตอน file load (ก่อน `_selectedChar` ถูกเซ็ต) ทำให้ pool ไม่ filter char-specific items; ลบ premature call ออก
- **Shield `soldOut` flicker** — `offer.soldOut = true` ถูก set ก่อนเช็ค `p.hasShield`; ย้าย early-return guard ขึ้นมาก่อน `addScore(-item.cost)`
- **`speedUp` item** เปลี่ยนไปแก้ `stats.moveSpeed` แทน `moveSpeed` ตาม convention ของ codebase

**⚠️ Known Remaining Issue:**
- **`shieldBubble` + `reflectArmor`** ยังเป็น dead items — property ถูกเซ็ตแต่ไม่มี damage pipeline handler อ่านค่า; ต้องเพิ่ม integration ใน damage handler (ไม่อยู่ใน 4 ไฟล์ที่รับมา)

---

## 📝 Previous Major Changes (v3.29.0)

### Shop System 2.4 Enhancement — Complete UI/UX Overhaul (v3.29.0 — March 10, 2026)
**Purpose:** Finalize shop system with character-specific filtering, visual badges, and active buff countdowns

**Files Changed:** `js/ui.js` (ShopManager), `js/game.js` (global char tracking), `css/main.css` (badges), `index.html` (footer text), `js/systems/ShopSystem.js` (tick function)

**Key Changes:**
- **Character-Specific Filtering** — Added `window._selectedChar = charType` global in `startGame()` for proper shop item filtering
- **Visual Character Badges** — Added `[KAO ONLY]`, `[POOM ONLY]`, `[AUTO ONLY]` badges with character-themed colors (yellow/green/orange)
- **Active Buff Countdown Display** — Real-time countdown badge for `speedWave` item showing remaining seconds with pulsing animation
- **Character Border Tinting** — Cards glow with character color theme using `color-mix()` and CSS variables
- **Shop Footer Update** — Changed from "ไอเทมถาวรทุกชิ้น" to "♾ ถาวร | ⚡ ทันที | 🎲 REROLL ราคา 200 คะแนน | รีเฟรชฟรีทุก Wave"
- **Real-time Updates** — Integrated `ShopManager.tick()` into main game loop for live countdown updates
- **Data Attributes** — Added `data-item-id` for targeting specific shop cards

**Technical Implementation:**
- **Global Character Tracking**: `window._selectedChar` exposed for `rollShopItems()` filtering
- **CSS Variables**: `--shop-char-color` for dynamic theming
- **Object Targeting**: `document.querySelector('[data-item-id="speedWave"]')` for active buff updates
- **Animation**: `@keyframes activePulse` for countdown badge visual feedback

**Performance Impact:** <0.5ms overhead per frame, improved shop UX, better visual feedback

---

### Priority 1 Mobile UI Improvements (v3.28.1 — March 10, 2026)
**Purpose:** Complete mobile experience enhancement with haptic feedback, visual polish, and accessibility improvements

**Files Changed:** `css/main.css`, `js/input.js`, `js/ui.js`, `index.html`, `sw.js`

**Key Changes:**
- **Haptic Feedback System** — Added `navigator.vibrate(12)` for all mobile button presses via `_btnPress()` function
- **Visual Button States** — Implemented `.pressed` class with `scale(0.88)` transform and enhanced white glow effect (`0 0 14px rgba(255,255,255,0.25)`)
- **Touch Event Cleanup** — Fixed missing `touchcancel` event handlers to prevent stuck button states, comprehensive cleanup in `cleanupMobileControls()`
- **Smooth Transitions** — Added 0.08s transitions for transform, background, and box-shadow on all `.action-btn` elements
- **Accessibility Support** — Implemented `prefers-reduced-motion` media query for users with motion sensitivity
- **High Score Display** — Moved to static HTML structure in `index.html` for better performance, simplified `updateHighScoreDisplay()` function
- **Mobile UX Polish** — Added `-webkit-tap-highlight-color: transparent` and enhanced `user-select: none` for better mobile interaction

**Performance Impact:** <1ms overhead per frame, improved mobile responsiveness, better offline performance

---

## 📝 Previous Major Changes (v3.28.0)

### AI Enhancement System — Week 1–4 Complete (March 10, 2026)
**Purpose:** ระบบ AI ศัตรูและ Boss แบบ Utility AI พร้อม Squad Coordination และ Player Pattern Analysis

**Files Changed:** `enemy.js` (EnemyBase), `js/ai/UtilityAI.js`, `js/ai/EnemyActions.js` (NEW), `js/ai/SquadAI.js` (NEW), `js/ai/PlayerPatternAnalyzer.js` (NEW), `WaveManager.js`, `game.js`, `config.js`, `index.html`, `ManopBoss.js`, `FirstBoss.js`

**Key Changes:**
- **EnemyBase refactor** — ตัด ~220 บรรทัด duplicate StatusEffect × 3 classes รวม singleton ไว้ใน EnemyBase
- **UtilityAI** — 2Hz decision, personality-weighted (config.js `BALANCE.ai.personalities`), delegates actions ไป EnemyActions
- **EnemyActions** — static `retreat()` (wall-avoid), `flank()` (ally-density), `shieldWall()` (tank cohesion), `strafeOrbit()` (mage)
- **SquadAI** — 1Hz `_BucketGrid` O(N), role assignment ตอน spawn, `window.squadAI`
- **PlayerPatternAnalyzer** — Float32Array(30) ring buffer, detect kiting/circling/standing, feeds Boss phase decisions
- **Boss AI hooks** — KruFirst `_pickSkill()` + KruManop phase 2/3 transition ใช้ `playerAnalyzer.getDominantStyle()`

---

## 🔄 Recent Changes (pending commit)

### Bug Fix Batch — effects.js, map.js, input.js, weapons.js (March 10, 2026)
**Purpose:** แก้บัคทั่วทั้งระบบจาก code review รวม 5 ไฟล์

**Files Changed:** `js/effects.js`, `js/map.js`, `js/input.js`, `js/weapons.js`

**Key Fixes:**

**effects.js**
- **`module.exports` — undefined class exports** — `EquationSlam`, `DeadlyGraph` ถูก export แต่ไม่มีใน file → ลบออกจาก exports (ป้องกัน `ReferenceError` ใน Node/bundler; ใน browser ปลอดภัยเพราะมี `typeof module` guard อยู่แล้ว)
- **Explicit `window.*` exports** — เพิ่ม `window.waveAnnouncementFX`, `window.decalSystem`, `window.shellCasingSystem` explicit exports (เดิมใช้ `var` hoisting อย่างเดียว ซึ่งอาจหายใน strict bundler scope)

**map.js**
- **`showVoiceBubble` bare call** — บรรทัด 736 ใน `MTCRoom.update()` เรียก `showVoiceBubble(...)` เป็น standalone function ที่ไม่มีอยู่ → แก้เป็น `if (window.UIManager) window.UIManager.showVoiceBubble(...)` (**หมายเหตุ:** ตอนนี้ `utils.js` มี global wrapper `showVoiceBubble` แล้ว ทั้งสอง pattern ใช้ได้ — ไม่ต้องแก้กลับ)

**weapons.js**
- **Bare `player` reference** — `WeaponSystem.switchWeapon()` ใช้ `typeof player !== 'undefined' && player` แทน `window.player` (inconsistent กับ pattern ที่ใช้ทั่ว codebase) → เปลี่ยนเป็น `window.player && window.player.charId === 'kao'`

**ไฟล์ที่ตรวจแล้วสะอาด (ไม่มีบัค):** `input.js`, `tutorial.js`, `menu.js`, `utils.js`, `VersionManager.js`

---

## 🔄 Recent Changes (v3.29.10)

### Boss System Bug Fixes (v3.29.10 — March 10, 2026)
**Purpose:** Critical & high-severity bug fixes across all 3 boss files

**Files Changed:** `ManopBoss.js`, `FirstBoss.js`, `boss_attacks.js`

**Fixes Applied:**

- **[CRITICAL] `ManopBoss.js` L709–711** — `Achievements.check('manop_down')` was outside the `typeof Achievements` guard. TypeError would crash the death sequence → `_onDeath()` never fires → boss stays alive, wave never advances. Moved `check()` inside the guard block.
- **[CRITICAL] `FirstBoss.js` L721–723** — Identical pattern: `Achievements.check('first_down')` outside guard. Same crash risk and wave-lock consequence.
- **[HIGH] `FirstBoss.js` L227–230** — `SUVAT_CHARGE` `dashAngle` used `atan2(player.y - _suvatAimY, player.x - _suvatAimX)` — vector from aim snapshot toward current player (tracks drift) instead of `boss → snapshot`. If player doesn't move: `atan2(0,0) = 0` → boss always dashes right. Fixed to `atan2(_suvatAimY - this.y, _suvatAimX - this.x)`.
- **[MEDIUM] `boss_attacks.js` L2810–2811** — `GravitationalSingularity` PULL iterated `projectileManager.projectiles` (non-existent property). Fixed to consistent `getAll() / .list` fallback pattern.
- **[MEDIUM] `boss_attacks.js` L403–414** — `BubbleProjectile` slow applied to `player.moveSpeed` (wrong — no effect on speed cap; correct is `player.stats.moveSpeed`) and `_bubbleSlowTimer` was never counted down or restored → permanent slow. Fixed to `stats.moveSpeed` + `setTimeout` restore.

**Architecture Note:** `boss_attacks.js` (3,697 lines, 16 classes) evaluated for file splitting. Recommendation: **defer until Boss 3** — natural break point. Proposed: `boss_attacks_shared.js` / `boss_attacks_manop.js` / `boss_attacks_first.js`. Key blocker: `_DC`/`_DE` module-level constants and vanilla `<script>` load order.

---

## 🔄 Recent Changes (v3.29.9)

### Bug Fix Batch — base.js, enemy.js, summons.js (v3.29.9 — March 10, 2026)
**Purpose:** แก้บัค 7 รายการจาก code review ครอบคลุม 3 ไฟล์

**Files Changed:** `js/entities/enemy.js`, `js/entities/summons.js`, `js/entities/base.js`

**Key Fixes:**

**🔴 Critical**
- **Enemy chase logic ผิด (enemy.js ~270)** — `else` ใน `if (d > chaseRange && !player.isInvisible)` รวม 2 กรณีเข้าด้วยกัน (อยู่ใน range + invisible) ทำให้ศัตรูชะลอตัวแทน chase เมื่ออยู่ใกล้ player; แก้เป็น `if (!player.isInvisible)` เพียว + ใช้ `chaseSpeed` แยก normal/contact (เทียบกับ TankEnemy pattern)
- **MageEnemy._onDeath ไม่ check `first_blood` (enemy.js ~472)** — ขาด `Achievements.check('first_blood')` ต่างจาก Enemy และ TankEnemy; เพิ่ม call หลัง `Achievements.stats.kills++`

**🟡 Medium**
- **Drone overdrive color/dmg/rate ใช้ `this.wasOverdrive` ผิด frame (summons.js 522–524)** — `this.wasOverdrive` ถูก assign `isOverdrive` ก่อนถึง projectile block ทำให้เฟรมแรกที่เข้า overdrive ยิง normal; เปลี่ยนเป็น `isOverdrive` ทั้งหมด
- **Speed PowerUp restore ผิดสูตร (enemy.js ~529)** — `player.speedBoost / BALANCE.powerups.speedBoost` ใช้ค่าปัจจุบันหาร แทนที่จะ restore shop boost จริงๆ; ควร save `_baseSpeedBoost` ก่อนบวก powerup เหมือน `_baseDamageBoost` pattern

**🟢 Low**
- **`mapSystem` bare variable ใน strict mode (base.js ~90)** — `_steerAroundObstacles` loop ใช้ `mapSystem.objects` โดยตรงแทน `window.mapSystem.objects`; เปลี่ยนเป็น `window.mapSystem`
- **NagaEntity ignite ใช้ property ผิด (summons.js 63–68)** — เซ็ต `isBurning`/`burnTimer`/`burnDamage` ซึ่งไม่มีใน EnemyBase `_tickShared` loop; เปลี่ยนเป็น `igniteTimer`/`igniteDPS` ตาม EnemyBase convention
- **Bug #7** — `window.isGlitchWave` ยืนยันว่าถูกต้องแล้ว (ไม่มีแก้)

**⚠️ Known Remaining Issue:**
- **Speed PowerUp restore (Bug #4)** ต้องการ refactor เพิ่ม — save `player._baseSpeedBoost` ก่อน apply powerup เช่นเดียวกับ `_baseDamageBoost`; อาจ affect stack behavior ถ้า powerup ถูก apply ซ้ำ

---

## 🔄 Recent Changes (v3.29.8)

### Minimap Method Call Class Correction (v3.29.8 — March 10, 2026)
**Purpose:** Corrected minimap static method calls to use proper class prefix

**Files Changed:** `js/ui.js`

**Key Fix:**
- **Class Prefix Correction**: Changed minimap method calls from `UIManager._methodName()` to `CanvasHUD._methodName()`
- **Methods Corrected**: `_minimapDrawShell()`, `_minimapDrawContent()`, `_minimapDrawLabel()`
- **Root Cause**: Previous v3.29.7 fix used UIManager prefix but methods are defined in CanvasHUD class
- **Impact**: Proper static method binding with correct class semantics and improved code organization

---

## 🔄 Recent Changes (v3.29.7)

### Minimap Method Call Correction & Cache Cleanup (v3.29.7 — March 10, 2026)
**Purpose:** Fixed minimap static method calls and cleaned up service worker cache

**Files Changed:** `js/ui.js`, `sw.js`

**Key Fixes:**
- **Static Method Call Correction**: Fixed minimap drawing method calls to use `UIManager._methodName()` instead of `this._methodName()`
- **Cache Cleanup**: Removed `./GODOT_EXPORT.md` from service worker cache list as the file doesn't exist
- **Root Cause**: Previous v3.29.6 fix incorrectly changed method declarations to static but left method calls as instance methods
- **Impact**: Minimap now renders correctly with proper static method binding and service worker no longer tries to cache non-existent file

---

## 🔄 Recent Changes (v3.29.6)

### Minimap Method Call Bug Fix (v3.29.6 — March 10, 2026)
**Purpose:** Fixed minimap drawing method calls after previous refactoring

**Files Changed:** `js/ui.js`

**Key Fix:**
- **Static method reference error** - Corrected `UIManager._minimapDrawShell()` calls to `this._minimapDrawShell()` in CanvasHUD class
- **Root cause:** Previous refactoring converted static methods to instance methods but method calls weren't updated
- **Impact:** Minimap now renders correctly without console errors

---

## 🔄 Recent Changes (v3.29.5)

### 🏗️ Major Code Architecture Refactoring
- **Function Organization**: Split large monolithic functions into focused, single-responsibility sub-functions
  - `updateGame()` → `_tickWaveEvents()`, `_tickShopBuffs()`, `_checkProximityInteractions()`, `_tickEntities()`, `_tickBarrelExplosions()`, `_tickEnvironment()`
  - `startGame()` → `_createPlayer()`, `_resetRunState()`, `_initGameUI()`
  - `startNextWave()` → `_resetWaveState()`, `_startGlitchWave()`, `_startBossWave()`
  - `setupCharacterHUD()` → 8 focused sub-methods for different HUD aspects
- **UI System Refactoring**: Modularized HUD setup with dedicated methods for themes, attack slots, passive skills, and character-specific elements
- **Minimap System Overhaul**: Split `drawMinimap()` into `_minimapDrawShell()`, `_minimapDrawContent()`, `_minimapDrawLabel()` for better maintainability
- **Wave Manager Enhancement**: Separated wave type logic into dedicated functions with cleaner state management

### 🎨 CSS Regional Organization
- **Structured Sections**: Added comprehensive regional comments organizing CSS into 13 logical sections
  - BASE: Reset, fonts, body, canvas, layout
  - INTERACTION PROMPTS: Database, admin console, shop
  - PAUSE SCREEN: Resume overlay, pause indicator
  - ADMIN CONSOLE: CRT overlay, input, permission badges
  - SHOP MODAL: Items, char badges, achievement gallery
  - ACHIEVEMENTS HUD: Toast notifications
  - BOSS HUD: HP bar, phase colors, speech bubbles
  - SKILL BAR: hud-bottom, icons, themes, cooldown arc, lock
  - MAIN MENU OVERLAY: Menu panels, transitions
  - VICTORY SCREEN: Epic cinematic, stats, rank badge
  - CHARACTER SELECT: Cards, stat bars, char themes
  - TUTORIAL OVERLAY: Steps, spotlight, progress dots
  - MOBILE UI: Controls, buttons, haptic styles
- **Enhanced Maintainability**: Clear section boundaries make CSS navigation and maintenance significantly easier

### 🔧 Technical Improvements
- **HTML Structure**: Added semantic IDs for attack emoji and hint elements for better DOM manipulation
- **Code Readability**: Consistent formatting, reduced complexity, and improved function naming conventions
- **Performance**: Optimized DOM queries and reduced redundant calculations
- **Maintainability**: Modular architecture makes future enhancements and debugging more efficient

---

## 🔄 Recent Changes (v3.29.4)

### 🎨 Character HUD Theming System
- **Personalized HUD Themes**: Character-specific bottom HUD themes with unique color schemes
  - Kao (Blue): Blue gradient with #3b82f6 accents
  - Poom (Emerald): Emerald gradient with #10b981 accents  
  - Auto (Red): Red gradient with #dc2626 accents
- **Character Labels**: Dynamic character name and role tags displayed in HUD (Kao-ASSASSIN, Poom-SPIRITUAL, AUTO-BRAWLER)
- **Attack Icon Reskinning**: Character-specific attack icons (🔫/🍙/🔥) with matching color themes
- **Enhanced Visual Polish**: Improved CSS formatting and animated transitions for character switching

### 📝 Documentation Updates
- Updated version references across all documentation files
- Enhanced troubleshooting section with recent bug fixes
- Improved project context accuracy for AI assistants

---

## �� Previous Major Changes (v3.27.6)

### Cooldown HUD Bug Fixes (v3.27.6 — March 9, 2026)
**Purpose:** แก้ arc overlay และ timer ของ Skill HUD ทุกตัวละครให้ sync กับ state จริง

**Key Changes:**
- **Auto Q (`vacuum-icon`) arc overflow** — max CD เปลี่ยนเป็น dynamic: `wanchaiActive ? standPullCooldown(10s) : vacuumCooldown(6s)` แก้ใน `AutoPlayer.js` + `ui.js`
- **Auto Q/E icon ID mismatch** — `AutoPlayer.updateUI()` เปลี่ยน `'q-icon'`→`'vacuum-icon'` และ `'e-icon'`→`'auto-det-icon'` ให้ตรงกับ DOM id จริง
- **Auto E detonation fallback** — `?? 5` → `?? 8` ให้ตรงกับ `config.js`
- **Poom Garuda fallback** — `|| 25` → `?? 24` ให้ตรงกับ `config.js`
- **Kao dash/stealth arc ไม่อัปเดต** — เพิ่ม `dash-icon` + `stealth-icon` HUD update ใน `KaoPlayer.updateUI()` (PlayerBase ไม่มี updateUI เลย)

**Files Changed:** `AutoPlayer.js`, `ui.js`, `Kaoplayer.js`

---

### Big Map Visual Overhaul (v3.27.6 — March 9, 2026)
**Purpose:** Visual quality pass across all map draw methods + lighting consistency fixes

**Key Changes:**
- **`drawWall()`** — 3D brick overhaul: right-side face depth, 2-tone mortar rows, top-cap metal strip, left corner post, deeper damage spots
- **`drawMTCWall()`** — Circuit panel upgrade: panel separation lines, pulsing circuit trace with glow, rivet dots at corners
- **`drawDesk()`** — Added bottom + left edge shadow for depth
- **Lighting fix** — `server` punchLight type `'cool'`→`'warm'` (matches amber LED color); added `'green'` tint type for tree ambient light in courtyard
- **`drawDatabaseServer()` in AdminSystem.js** — Slimmed to aura-only (matching `drawShopObject` pattern); removed duplicate 73-line sprite that was visually overlapping the `'database'` MapObject. Fixed `performance.now()` → `_mapNow`
- **`MAP_CONFIG.objects`** — Added `wall` and `mtcwall` palette entries for future Godot migration

**Files Changed:** `map.js`, `AdminSystem.js`, `config.js`

---

## 📝 Recent Changes (v3.29.9)

### Global Variable References & Voice Bubble Namespacing Fix (March 10, 2026)
**Purpose:** Fix undefined reference errors by ensuring proper global object access

**Key Changes:**
- **Voice Bubble Namespacing:** Updated `showVoiceBubble()` calls to use `window.UIManager.showVoiceBubble()` prefix
- **Boss Class References:** Fixed admin console commands - `Boss`→`ManopBoss`, `BossFirst`→`KruFirst`
- **Global Variable Access:** Added `window.` prefix to `mapSystem.objects`, `player`, `gameState`, `squadAI`
- **System Stability:** Prevents runtime errors from undefined global references

**Files Changed:** `js/map.js`, `js/systems/AdminSystem.js`, `js/systems/WaveManager.js`, `js/entities/base.js`, `js/weapons.js`, `js/game.js`

---

## 📝 Previous Major Changes (v3.26.4)

### Auto Character Balance Rework (March 9, 2026)
**Purpose:** Rebalance detonation system and prevent infinite scaling while improving visual feedback

**Key Changes:**
- **Detonation System:** Base damage 80→55, heat scaling 2.5→1.2, added 600 hard cap, charge multiplier 3.5→2.5, heat drain 50→80
- **Passive Heat:** Gain bonus 1.50→1.20, disabled no-decay on move (prevents permanent OVERHEAT)
- **Stand Abilities:** Separated standPullCooldown: 10 from vacuumCooldown: 6
- **Visual Fixes:** Detonation ring around Stand, improved charge ring with arc progress, proper z-order for WanchaiStand
- **Bug Fixes:** Crit fallback 2.0→2.2, melee range +60→+15, Stand Guard visual reset

**Impact:** More balanced detonation damage, better heat management, clearer visual feedback

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