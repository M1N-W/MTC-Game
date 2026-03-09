# 🎮 MTC Game - Project Overview
> สำหรับ AI Assistant — อ่านเมื่อเริ่มแชทใหม่เพื่อเข้าใจโปรเจคต์ก่อนลงมือ

**MTC the Game** — Top-down 2D Wave Survival Shooter, 15 waves + bosses + upgrades
**Stack:** Vanilla JS + HTML5 Canvas (ไม่มี framework) | **Target:** 60 FPS | **Status:** Beta v3.26.7

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

## 📝 Recent Major Changes (v3.26.4)

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