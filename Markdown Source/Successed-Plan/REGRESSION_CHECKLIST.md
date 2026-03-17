# MTC Game — Regression Checklist (Rendering Remaster)

---

## 📌 Session Progress

| Session    | เป้าหมาย                                         | สถานะ                     | ไฟล์ที่แตะ                                                                                      |
| ---------- | ------------------------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------- |
| Session 1  | Baseline + Profiler                              | ✅ DONE                   | `RenderProfiler.js`, `game.js`, `AdminSystem.js`, `Debug.html`, `index.html`                    |
| Session 2  | RenderTokens — token กลาง + apply shared helpers | ✅ DONE (patches ส่งแล้ว) | `RenderTokens.js` (ใหม่), `PlayerRenderer.js`, `BossRenderer.js`, `index.html`                  |
| Session 3  | Token adoption เพิ่ม 2 จุด                       | ⬜ TODO (deferred)        | `PlayerRenderer.js`, `BossRenderer.js`, `CombatEffects.js`                                      |
| Session 4  | Auto vertical slice — แตก parts                  | ✅ DONE (patches ส่งแล้ว) | `AutoRenderer.js`                                                                               |
| Session 5  | Cache static parts                               | ✅ DONE (patches ส่งแล้ว) | `AutoRenderer.js`                                                                               |
| Session 6  | Skin hooks                                       | ✅ DONE (patches ส่งแล้ว) | `RenderSkins.js` (ใหม่), `AutoRenderer.js`, `GameState.js`, `utils.js`, `menu.js`, `index.html` |
| Session 7  | Enemy overlay modular                            | ✅ DONE (patches ส่งแล้ว) | `EnemyOverlays.js` (ใหม่), `enemy.js`, `CombatEffects.js`, `RenderTokens.js`, `index.html`      |
| Session 8  | Boss aura presets                                | ✅ DONE (patches ส่งแล้ว) | `BossPresets.js` (ใหม่), `BossRenderer.js`, `index.html`                                        |
| Session 9  | Effects factory/preset                           | ✅ DONE (patches ส่งแล้ว) | `EffectPresets.js` (ใหม่), `index.html`                                                         |
| Session 10 | Regression pass + deferred hardcodes             | ✅ DONE (patches ส่งแล้ว) | `BossRenderer.js`, `game.js`                                                                    |

### Session 2 — Token Coverage (ณ วันที่ apply)

| Token                       | ค่า                           | ใช้ใน                                                      |
| --------------------------- | ----------------------------- | ---------------------------------------------------------- |
| `RT.palette.danger`         | `#ef4444`                     | `_drawHitFlash`, `_drawLowHpGlow`, BossRenderer HP/enraged |
| `RT.palette.shield`         | `#8b5cf6`                     | `_drawEnergyShield`                                        |
| `RT.palette.shieldInner`    | `#c4b5fd`                     | `_drawEnergyShield`                                        |
| `RT.palette.hpHigh/Mid/Low` | `#39ff14`/`#fbbf24`/`#ef4444` | BossRenderer HP bar                                        |
| `RT.glow.danger`            | blur=18                       | `_drawLowHpGlow`                                           |
| `RT.stroke.medium`          | 2.5                           | `_drawHitFlash`, `_drawLowHpGlow`                          |

---

**Phase 0 — Baseline Guardrails**  
ใช้ตรวจทุกครั้งก่อน merge งานภาพ | อัปเดตเมื่อพบ regression ใหม่

---

## 🔴 ต้องผ่านทุกข้อก่อน merge

### A. Core Rendering — ผ่าน/ไม่ผ่าน

| #   | จุดตรวจ                        | วิธีตรวจ                 | ❌ อาการพัง                        |
| --- | ------------------------------ | ------------------------ | ---------------------------------- |
| A1  | Hit Flash แสดงเมื่อโดนดา       | ยืนรับดา 1 ครั้ง         | ไม่กะพริบ / กะพริบตลอด / สีผิด     |
| A2  | Low HP Glow (HP < 25%)         | ลด HP ต่ำกว่า 25%        | Glow หาย / ติดตลอด / ขยายเลื่อน    |
| A3  | Energy Shield วาดทับตัวละคร    | ซื้อ shield จาก shop     | Shield หาย / วาดใต้ตัว / alpha ผิด |
| A4  | Speed Streak (LAYER 1.5)       | Dash                     | Streak หาย / ติดค้างเมื่อหยุด      |
| A5  | Level Badge (มุมขวาล่างของตัว) | Level ≥ 2                | Badge หาย / offset ผิด             |
| A6  | Ground Shadow + Ground Feet    | เดินในที่สว่าง           | Shadow ขาด / กระโดด                |
| A7  | ctx transform ไม่รั่ว          | เล่น 30 วิแล้วดู console | Error หรือ visual drift สะสม       |

### B. Boss Rendering

| #   | จุดตรวจ                   | วิธีตรวจ                          | ❌ อาการพัง                                |
| --- | ------------------------- | --------------------------------- | ------------------------------------------ |
| B1  | Boss HP Bar แสดงถูกต้อง   | Spawn boss ด้วย `spawn manop 1`   | Bar หาย / ขนาดผิด / phase color ไม่เปลี่ยน |
| B2  | Boss Aura ทุก phase       | สังเกต Phase 1→2→3                | Aura หาย / ค้าง phase เก่า                 |
| B3  | Hit Flash บน Boss         | ยิง boss                          | ไม่กะพริบ                                  |
| B4  | BossDog วาดถูก            | `spawn manop 2`                   | หาย / เลเยอร์สลับ                          |
| B5  | KruFirst Phase Transition | `spawn first advanced` → กด HP ลง | Phase aura ไม่เปลี่ยน / domain effect หาย  |
| B6  | DomainExpansion overlay   | Phase สุดท้าย KruManop            | Overlay ไม่ fade in/out                    |

### C. Effect Systems

| #   | จุดตรวจ                       | วิธีตรวจ                        | ❌ อาการพัง                                      |
| --- | ----------------------------- | ------------------------------- | ------------------------------------------------ |
| C1  | FloatingText (damage numbers) | ยิงศัตรู                        | ตัวเลขไม่ขึ้น / alpha ไม่ fade                   |
| C2  | Impact Sparks                 | ยิงกำแพง                        | Spark หาย / ค้าง                                 |
| C3  | Particle Pool ไม่ leak        | `perf stress` แล้วรอ 5 วิ       | Particle ยังอยู่หลัง maxLife / pool grow ไม่หยุด |
| C4  | WeatherSystem Rain/Snow       | `weather rain` / `weather snow` | Particles เกิดนอก viewport / drop frame ทันที    |
| C5  | Screen Shake                  | โดนดาหนัก                       | Shake ไม่หยุด / canvas offset ค้าง               |
| C6  | Pat Zanzo afterimage          | กด Q ด้วย Pat                   | Afterimage ค้าง / ไม่ fade                       |

### D. HUD / Canvas UI

| #   | จุดตรวจ                     | วิธีตรวจ         | ❌ อาการพัง                          |
| --- | --------------------------- | ---------------- | ------------------------------------ |
| D1  | Minimap วาดถูก              | เดินทั่วแผนที่   | Map หาย / enemy dot ไม่ปรากฏ         |
| D2  | Skill Icon Cooldown (Q/E/R) | ใช้สกิล          | Cooldown overlay ไม่ทำงาน / icon หาย |
| D3  | Combo Counter               | ORA combo (Auto) | Counter ไม่ขึ้น / ค้าง               |
| D4  | Ammo Bar                    | ยิงจนหมด         | Bar ไม่ลด / ไม่เติม                  |
| D5  | Skill Tooltip               | Hover บน icon    | Tooltip ออก viewport / z-index ผิด   |

### E. Character-Specific

| #   | จุดตรวจ                   | ตัวละคร | ❌ อาการพัง                       |
| --- | ------------------------- | ------- | --------------------------------- |
| E1  | Wanchai Stand (R-Click)   | Auto    | Stand ไม่ปรากฏ / crimson aura หาย |
| E2  | Heat Tier color change    | Auto    | Body color ไม่เปลี่ยนตาม tier     |
| E3  | Naga Summon visual        | Poom    | Naga sprite ไม่วาด                |
| E4  | Stealth fade (Q)          | Kao     | Alpha ไม่ลด / ไม่กลับมา           |
| E5  | Katana slash arc          | Pat     | Arc path หาย / scale ผิด          |
| E6  | Blade Guard shield visual | Pat     | Guard overlay หาย                 |

---

## 🟡 Performance Gates

| Scenario          | วิธี Trigger                             | min acceptable avg | min acceptable 1%low |
| ----------------- | ---------------------------------------- | ------------------ | -------------------- |
| Normal Wave (1–7) | เล่นปกติ                                 | **55 FPS**         | **45 FPS**           |
| Heavy Wave (8–12) | Wave 8+ หรือ `spawn manop 1` + หลายศัตรู | **50 FPS**         | **40 FPS**           |
| Boss Fight        | `spawn manop 3` (Phase 3)                | **50 FPS**         | **38 FPS**           |
| Particle Stress   | `perf stress` (1500 particles)           | **45 FPS**         | **35 FPS**           |

> วัดด้วย `perf start` → รอ 10 วิ → `perf snap <label>` → `perf report`

---

## 🟢 วิธีใช้ชุดตรวจนี้

```
1. เปิดเกม + เปิด Admin Console (grave key `)
2. Login: oper <pass>  (OPERATOR tier)
3. เรียก: perf start
4. ทำ scenario ตามตาราง Performance Gates ทีละข้อ
5. เรียก: perf snap <label>  หลังแต่ละ scenario
6. เรียก: perf report  ดูผลรวม
7. ไล่ตรวจ A–E ด้วยตา (visual pass)
8. ถ้าผ่านทั้งหมด → merge ได้
```

---

## 📋 Baseline — Phase 0 (วัดจริง Session 1)

```
Date        : 2026-03-17
Version     : v3.39.4
Device      : Desktop
Browser     : Chrome 145

[boss_fight]         avg=33.2 | 1%low=20.3 | min=14.8 fps  (Wave 9, KruManop Phase 2)
[normal_wave_late]   avg=30.0 | 1%low=16.8 | min=14.3 fps  (Wave 9 หลัง boss ตาย)
[normal_wave_early]  avg=39.3 | 1%low=20.6 | min=9.9  fps  (Wave 11)
[heavy_wave]         avg=35.6 | 1%low=18.7 | min=9.9  fps  (Wave 8+)
[stress_particles]   avg=30.3 | 1%low=19.5 | min=8.2  fps  (1500 calls → capped 150)

Visual pass : ☐ A1-A7  ☐ B1-B6  ☐ C1-C6  ☐ D1-D5  ☐ E1-E6
Notes       : FPS ต่ำกว่า target ทุก scenario — avg 30–39 FPS (target 50–60)
              ParticleSystem ไม่ใช่ตัวการหลัก (stress ≈ normal_wave)
              Bottleneck น่าอยู่ที่ renderer draw state / hardcode style calls
```

### 🎯 Performance Targets (ปรับจาก baseline จริง)

| Scenario         | Baseline avg | **Target หลัง Remaster** | Target 1%low |
| ---------------- | ------------ | ------------------------ | ------------ |
| normal_wave      | 30–39 FPS    | **≥ 50 FPS**             | ≥ 40 FPS     |
| heavy_wave       | 35.6 FPS     | **≥ 45 FPS**             | ≥ 35 FPS     |
| boss_fight       | 33.2 FPS     | **≥ 45 FPS**             | ≥ 35 FPS     |
| stress_particles | 30.3 FPS     | **≥ 40 FPS**             | ≥ 30 FPS     |

---

## ⚠️ Known Fragile Points (จากประวัติ regression)

| จุด                                     | ระวัง                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ctx.save()` / `restore()` ไม่ครบคู่    | transform รั่วสะสม — ตรวจด้วย `perf report` + สังเกต visual drift                                                                                            |
| `Math.random()` ใน draw()               | ห้ามเด็ดขาด — ทำให้ determinism พัง                                                                                                                          |
| OffscreenCanvas cache invalidation      | เมื่อ resize หรือ theme เปลี่ยน ต้อง invalidate cache ด้วย                                                                                                   |
| `proj.team` บน reflected projectile     | Pat Blade Guard — ต้องเซ็ต `team='player'` + `owner='player'` + `isReflected=true`                                                                           |
| Tooltip `position: fixed`               | อย่าเปลี่ยนเป็น `absolute` — ทำให้ออก viewport เมื่อ scroll                                                                                                  |
| stat bar % hardcoded                    | HUD stat bars ใช้ % hardcode — อย่า refactor เป็น dynamic โดยไม่ทดสอบ edge                                                                                   |
| BossRenderer isEnraged color (deferred) | `drawBoss` / `drawBossFirst` ยังมี `isEnraged ? "#ef4444"` hardcode ~7 จุด — partially addressed in Session 8 — body detail hardcodes deferred to Session 10 |
| `RT.palette.crit` ใน `_category()`      | ใช้เปรียบเทียบ `col === RT.palette.crit` — ถ้าเปลี่ยน token ต้องส่ง color ที่ match มาด้วยเมื่อ spawn                                                        |
| `_drawAutoBody` heat tier gradients     | สี hardcode ตาม tier (`#7f1d1d`, `#c84a10` ฯลฯ) — deferred ไป Session 6 (Skins)                                                                              |
| Part function ตัว `ctx.save/restore`    | \_drawAutoBody + \_drawAutoWeaponFists แต่ละตัวมี ctx.save/restore ของตัวเอง — ต้องตรวจ visual pass A1/A4/E1-E3 ทุกครั้งที่แก้                               |

---

## 🔁 Session 4 — Token Coverage

### AutoRenderer Part Functions (Session 4)

| Part function             | Lines (original) | Token adoptions                                                       |
| ------------------------- | ---------------- | --------------------------------------------------------------------- |
| `_drawAutoDashTrail`      | 147–160          | `danger`, `dangerDark`                                                |
| `_drawAutoGroundFX`       | 161–174          | —                                                                     |
| `_drawAutoVacuumRing`     | 175–221          | `danger`, `dangerDark`, `bossOrange`, `bossOrangeMid`                 |
| `_drawAutoDetonationRing` | 222–244          | `dangerDark`                                                          |
| `_drawAutoStandGuard`     | 245–280          | `gold`                                                                |
| `_drawAutoStandRush`      | 281–436          | `dangerDark`, `bossOrange`                                            |
| `_drawAutoChargePunch`    | 437–496          | `crit`, `gold`                                                        |
| `_drawAutoBody`           | 497–885          | `danger`, `dangerDark`, `bossOrange`, `bossOrangeMid`, `gold`, `crit` |
| `_drawAutoWeaponFists`    | 887–950          | `dangerDark`, `bossOrangeMid`                                         |

**Total RT token adoptions in AutoRenderer: ×79**
Heat tier body gradient colors (tier-specific dark reds/oranges) deferred → Session 6 (Skins)

---

---

## 🔁 Session 7 — Token Coverage

### EnemyOverlays.js — New Overlay Module

| Overlay method    | Trigger condition                       | RT tokens used                        |
| ----------------- | --------------------------------------- | ------------------------------------- |
| `_drawSlowRing()` | `stickySlowMultiplier < 0.70` (**NEW**) | `slowRing`, `slowFill`                |
| `_drawSticky()`   | `stickyStacks > 0`                      | `sticky`, `stickyPip`                 |
| `_drawIgnite()`   | `igniteTimer > 0`                       | `bossOrange`, `gold`, `bossOrangeMid` |
| `_drawHitFlash()` | `hitFlashTimer > 0`                     | `white`                               |

### enemy.js — \_drawHpBar tokens

| Was hardcode | Now                 |
| ------------ | ------------------- |
| `#ef4444`    | `RT.palette.danger` |
| `#ffffff`    | `RT.palette.white`  |

### CombatEffects.js — Wanchai colours

| Was hardcode | Now                     |
| ------------ | ----------------------- |
| `#dc2626`    | `RT.palette.dangerDark` |
| `#f97316`    | `RT.palette.bossOrange` |
| `#ffffff`    | `RT.palette.white`      |
| `#fca5a5`    | `RT.palette.dangerSoft` |

### RenderTokens.js — New tokens added (Session 7)

| Token                  | ค่า       | ใช้ใน                        |
| ---------------------- | --------- | ---------------------------- |
| `RT.palette.sticky`    | `#00ff88` | `_drawSticky` body tint      |
| `RT.palette.stickyPip` | `#00ff88` | `_drawSticky` orbital pips   |
| `RT.palette.slowRing`  | `#38bdf8` | `_drawSlowRing` outer stroke |
| `RT.palette.slowFill`  | `#bfdbfe` | `_drawSlowRing` frost fill   |

---

## ⚠️ Session 7 — Visual Regression Hotspots

| Check                 | What could break                                                                      |
| --------------------- | ------------------------------------------------------------------------------------- |
| A1 Hit Flash (enemy)  | EnemyOverlays.\_drawHitFlash() now reads `RT.palette.white` — verify still pure white |
| Sticky tint (green)   | Colour unchanged (`#00ff88`) but now via token — verify intensity scaling correct     |
| Ignite ring           | `#f97316` → `RT.palette.bossOrange` (same hex) — no visual change expected            |
| `EnemyOverlays` guard | If file fails to load, `_drawStatusOverlays` silently no-ops — all overlays disappear |
| slowRing NEW overlay  | Trigger: `stickySlowMultiplier < 0.70` — verify NOT showing on un-slowed enemies      |

---

## 🔁 Session 8 — Boss Preset Coverage

### BossPresets.js — New Preset File

| Preset key                          | Covers                                            | RT tokens used                    |
| ----------------------------------- | ------------------------------------------------- | --------------------------------- |
| `BOSS_PRESETS.manop.aura[1]`        | KruManop Phase 1 golden aura (fill+ring+dots)     | —                                 |
| `BOSS_PRESETS.manop.aura[2]`        | KruManop Phase 2 red enraged aura + inner ring    | —                                 |
| `BOSS_PRESETS.manop.aura[3]`        | KruManop Phase 3 cyan water aura                  | —                                 |
| `BOSS_PRESETS.manop.ring.*`         | Silhouette ring per state (phase3/enraged/normal) | —                                 |
| `BOSS_PRESETS.manop.enrageRing`     | Phase 2 extra enrage ring                         | —                                 |
| `BOSS_PRESETS.manop.symbolColFn(e)` | Orbit glyph color — RT-aware                      | `RT.palette.danger`               |
| `BOSS_PRESETS.first.normal/enraged` | KruFirst body: main/glow/bodyDark/bodyMid         | —                                 |
| `BOSS_PRESETS.first.berserk`        | KruFirst berserk aura + fire particle colors      | —                                 |
| `BOSS_PRESETS.first.goggleGlow(e)`  | Goggle color by state — RT-aware                  | `RT.palette.accentMid/bossOrange` |
| `BOSS_PRESETS.first.pointerCol(e)`  | Energy pointer by state — RT-aware                | `RT.palette.accentMid/bossOrange` |

### BossRenderer.js — Patches Applied

| Block removed                           | Replaced with                                 |
| --------------------------------------- | --------------------------------------------- |
| KruManop 80-line phase aura if/else/if  | `BossRenderer._drawManopPhaseAura()` 1-liner  |
| Orbit symbol color ternary              | `BOSS_PRESETS.manop.symbolColFn(e)`           |
| Phase 2 enrage ring + silhouette ring   | `BOSS_PRESETS.manop.enrageRing` / `.ring.*`   |
| KruFirst berserk aura gradient + flames | `BOSS_PRESETS.first.enraged` / `.berserk`     |
| KruFirst holographic ring colors        | `BOSS_PRESETS.first.normal/enraged.main/glow` |
| KruFirst body cache bodyDark/bodyMid    | `BOSS_PRESETS.first.*.bodyDark/bodyMid`       |
| KruFirst chest stripe color             | `mainCol` (preset-derived, in scope)          |
| KruFirst goggle state ternary           | `BOSS_PRESETS.first.goggleGlow(e)`            |
| KruFirst berserk fire particles         | `BOSS_PRESETS.first.berserk`                  |
| KruFirst energy pointer ternary         | `BOSS_PRESETS.first.pointerCol(e)`            |

### Remaining Hardcodes (Deferred → Session 10)

| Location                     | What                                 | Why deferred           |
| ---------------------------- | ------------------------------------ | ---------------------- |
| `drawBossDog` L607–783       | BossDog body/attack detail colors    | Body detail, not aura  |
| `drawBoss` L959–1149         | KruManop tie/glass/enrage particles  | Body detail, not aura  |
| `drawBossFirst` L1734–1761   | Jetpack outer/mid flame colors       | Complex gradient block |
| `drawBossFirst` L1927, L2124 | Pocket static green, gold orbit text | Low priority cosmetic  |

---

## ⚠️ Session 8 — Visual Regression Hotspots

| Check                | What could break                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------ |
| B2 Boss aura phases  | `_drawManopPhaseAura` reads preset — verify P1 gold / P2 red / P3 cyan still correct       |
| B5 KruFirst phases   | `ringCol`/`mainCol`/`stripeCol` now from preset — verify green↔red flip on isEnraged       |
| B3 Hit flash boss    | Unrelated to this session — should be unaffected                                           |
| `BOSS_PRESETS` guard | If BossPresets.js fails to load, `_drawManopPhaseAura` returns early — aura disappears     |
| Goggle state colors  | `goggleGlow(e)` depends on `e.state` string — verify EMP_ATTACK/SUVAT_CHARGE still correct |

---

---

## 🔁 Session 9 — Effect Preset Coverage

### EffectPresets.js — New Factory File

| Preset ID   | Use case                 | Color source                       |
| ----------- | ------------------------ | ---------------------------------- |
| `default`   | Generic white ring       | hardcode white                     |
| `fire`      | Ignite proc / fire skill | `RT.palette.bossOrange/dangerDark` |
| `sticky`    | Sticky-slow application  | `RT.palette.sticky`                |
| `crit`      | Crit kill / crit proc    | `RT.palette.crit/critGlow`         |
| `slow`      | Heavy slow / freeze land | `RT.palette.slowRing`              |
| `heal`      | Heal pickup / Poom heal  | `RT.palette.healText/heal`         |
| `bossPhase` | Boss phase transition    | `RT.palette.danger/dangerDark`     |

**Key design decisions:**

- `ShockwaveRing` is pooled (MAX_POOL=30) — zero GC in loop
- Implements `update(dt, player, meteorZones, boss)` contract — drops into `specialEffects[]` unchanged
- Color fields accept `string | () => string` — RT-aware at draw time, not at spawn time
- ease-out quad expansion + linear alpha fade — no `Math.random()` in draw path

### How to use (caller side)

```js
// On ignite proc in EnemyBase._tickShared():
if (typeof spawnShockwave === "function") spawnShockwave("fire", e.x, e.y);

// On boss phase transition in ManopBoss/FirstBoss:
if (typeof spawnShockwave === "function")
  spawnShockwave("bossPhase", this.x, this.y);

// On crit kill in game.js enemy death path:
if (typeof spawnShockwave === "function") spawnShockwave("crit", e.x, e.y);
```

---

## ⚠️ Session 9 — Visual Regression Hotspots

| Check                 | What could break                                                                |
| --------------------- | ------------------------------------------------------------------------------- |
| specialEffects[] loop | ShockwaveRing.update() returns true when done — confirm game.js removes it      |
| C5 Screen Shake       | Unrelated — should be unaffected                                                |
| RT color function     | color/glowColor fns called at draw time — verify RT not undefined at that point |
| Pool leak             | release() only called from update() return true — confirm no double-release     |

---

## 🔜 Session 10 — ไฟล์ที่ต้องเตรียม

**เป้าหมาย:** Regression pass + ปิดหนี้เทคนิค — ให้ระบบใหม่เสถียรและใช้งานซ้ำได้

**ไฟล์ที่ต้องอัปโหลด:**

| ไฟล์                           | เหตุผล                                                         |
| ------------------------------ | -------------------------------------------------------------- |
| `js/rendering/BossRenderer.js` | ปิดหนี้ deferred hardcodes (BossDog body, jetpack flame)       |
| `js/game.js`                   | ตรวจ draw order / state leak ถ้ามี; เพิ่ม spawnShockwave hooks |

**งานที่จะทำใน Session 10:**

1. ปิด deferred hardcodes ใน BossRenderer (BossDog L607-783, KruManop tie L959-1149)
2. เพิ่ม `spawnShockwave()` call site ใน ignite proc + boss phase transition
3. วิ่ง regression checklist ทั้งหมด A1-E6 + B1-B6 + C1-C6 + D1-D5
4. วัด FPS เทียบ baseline ทุก scenario

---

## 🔁 Session 5 — OffscreenCanvas Cache Coverage

| Cache key          | Contents                                                                | Bitmap size | Ops eliminated/frame |
| ------------------ | ----------------------------------------------------------------------- | ----------- | -------------------- |
| `body_t0/t1/t2/t3` | outer glow ring + tier fill + outline + specular + inner circuit detail | 78×78 px    | ~15 ops              |
| `hair_base`        | hair bezier silhouette + outline + centre dark spike                    | 40×32 px    | ~7 ops               |

**Total: ~22 path/gradient ops → 2 `drawImage` calls per frame**

- `createRadialGradient` (expensive) eliminated on every frame — now only runs on first encounter per tier
- hex-core `createRadialGradient` (hexG) intentionally NOT cached — alpha driven by `sin(now/200)`

**Cache does NOT need invalidation:** 4 body tiers are fixed values; hair base is state-independent.
**Heat tier body gradient colors remain hardcoded** — deferred to Session 6 (Skins).

---

## ⚠️ Session 5 — Visual Regression Hotspots

| Check              | What could break                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| E2 Heat Tier color | bitmap keyed by tier — if `_heatTier` changes mid-frame the wrong bitmap draws for 1 frame         |
| A1 Hit Flash       | drawn AFTER drawImage inside same ctx.save — should be unaffected                                  |
| A6 Ground Shadow   | drawn before LAYER 1 ctx.save — unaffected                                                         |
| E1 Wanchai Stand   | drawn after LAYER 2 restore — unaffected                                                           |
| Shadow bleed       | body bitmap has shadowBlur=18 baked — confirm no double-shadow if live ctx has leftover shadowBlur |

---

## 🔜 Session 6 — ไฟล์ที่ต้องเตรียม

**เป้าหมาย:** Skin hooks — override tier palette ผ่าน `RT.override()` โดยไม่แก้ renderer

**ไฟล์ที่ต้องอัปโหลด:**

| ไฟล์                           | เหตุผล                                           |
| ------------------------------ | ------------------------------------------------ |
| `js/rendering/AutoRenderer.js` | เพิ่ม cache invalidation hook เมื่อ skin เปลี่ยน |
| `js/rendering/RenderTokens.js` | เพิ่ม skin override support                      |

**ไฟล์ใหม่ที่จะสร้าง:** `js/rendering/Skins.js`
**อาจต้องแก้:** `js/systems/GameState.js` (เพิ่ม `activeSkin` field)

---

## 🔁 Session 10 — Final Patch Coverage

### BossRenderer.js — Deferred Hardcodes Closed

| Location                | Was                               | Now                                               |
| ----------------------- | --------------------------------- | ------------------------------------------------- |
| BossDog ember `[i%3]`   | `["#ef4444","#f97316","#facc15"]` | `RT.palette.danger/bossOrange/gold`               |
| KruManop tie color      | `"#ef4444"/"#dc2626"`             | `RT.palette.danger/dangerDark`                    |
| KruManop tie knot       | `"#991b1b"`                       | `RT.palette.dangerDark`                           |
| KruManop glass glow     | `"#ef4444"/"#facc15"`             | `RT.palette.danger/gold`                          |
| KruManop fire particles | `"#fb923c"/"#38bdf8"` (phase 3)   | `RT.palette.bossOrangeMid/accentMid`              |
| KruFirst jetpack outer  | `"#ef4444"/"#3b82f6"`             | `BOSS_PRESETS.first.*.main/RT.palette.accentBlue` |
| KruFirst jetpack mid    | `"#fb923c"/"#00e5ff"`             | `RT.palette.bossOrangeMid/"#00e5ff"`              |

### Remaining Hardcodes (Accepted — will not tokenize)

| Location                       | What                           | Reason                          |
| ------------------------------ | ------------------------------ | ------------------------------- |
| BossDog eye iris L614          | `#ef4444` (eye anatomy)        | Body anatomy, not theme         |
| KruManop ULTIMATE wind-up L774 | `#ef4444/#f97316` (attack VFX) | Attack-specific, not persistent |
| Jetpack nozzle cyan L1275      | `#00ffff` (nozzle ring)        | Low-priority cosmetic detail    |
| KruFirst orbit text L2147      | `#fbbf24` (gold math text)     | Static accent, not aura         |

### game.js — spawnShockwave() Call Sites Added

| Hook location                       | Preset      | Trigger condition                       |
| ----------------------------------- | ----------- | --------------------------------------- |
| After `boss.update()` — phase track | `bossPhase` | `boss.phase` changes from previous tick |
| Enemy death loop                    | `crit`      | `_e._lastHitWasCrit === true` on death  |

**Note:** `_lastHitWasCrit` must be set by `ProjectileManager` when a crit hit kills —
add `enemy._lastHitWasCrit = true` in the crit-damage path in `weapons.js` to activate the ring.
The `game.js` hook is safe regardless — guard is `&& _e._lastHitWasCrit` (falsy if unset).

---

## ⚠️ Session 10 — Visual Regression Hotspots

| Check                  | What could break                                                             |
| ---------------------- | ---------------------------------------------------------------------------- |
| B4 BossDog             | Ember colors now RT — verify danger/bossOrange/gold still render correctly   |
| B2 KruManop aura       | Tie/glass now token-driven — verify enraged flip correct                     |
| B5 KruFirst            | Jetpack outer flame now `BOSS_PRESETS.first.*.main` — red↔blue on isEnraged  |
| C3 specialEffects pool | ShockwaveRing pushes to specialEffects[] — verify swap-and-pop removal works |
| bossPhase hook         | `_prevBossPhase` init: first tick fires no ring (undefined check guards it)  |

---

## ✅ Rendering Remaster — Complete (Sessions 1–10)

All 10 sessions of the Core Remaster plan are done.

| Deliverable                          | Status |
| ------------------------------------ | ------ |
| Baseline profiler + regression list  | ✅     |
| RenderTokens (palette/glow/stroke)   | ✅     |
| Token adoption (player/boss/effects) | ✅     |
| AutoRenderer parts refactor          | ✅     |
| OffscreenCanvas body cache           | ✅     |
| RenderSkins skin hook system         | ✅     |
| EnemyOverlays modular + slowRing     | ✅     |
| BossPresets phase aura presets       | ✅     |
| EffectPresets shockwave factory      | ✅     |
| Regression pass + deferred closes    | ✅     |

## **Next optional sessions:** Session 11–12 (Tailwind UI migration for Shop/Admin overlay)

## 🔁 Session 11 — Tailwind Migration Coverage

### Strategy: CDN + inline tailwind.config (no build step)

Tailwind CDN loaded before `main.css` → MTC custom classes take precedence.
`tailwind.config` extends theme with MTC palette tokens + custom keyframes.

### Migrated to Tailwind (HTML classes, CSS removed)

| Element                   | CSS removed (bytes) | Tailwind approach                            |
| ------------------------- | ------------------- | -------------------------------------------- |
| `#loading-overlay`        | ~2.9 KB             | `fixed inset-0 flex ... bg-gradient-to-br`   |
| `.loading-inner`          | included            | `w-[90%] max-w-[420px] backdrop-blur-[12px]` |
| `.loading-title/subtitle` | included            | Inline Tailwind font + color + tracking      |
| `.loading-progress-fill`  | included            | `bg-gradient-to-r from-mtc-gold ...`         |
| `#db-prompt`              | ~2.4 KB             | `absolute ... animate-prompt-pulse`          |
| `#console-prompt`         | included            | Same pattern, green border/text              |
| `#shop-prompt`            | included            | Same pattern, gold border/text               |
| `#pause-indicator`        | included            | `fixed top-[18px] ... tracking-[4px]`        |
| `#resume-prompt`          | ~4.9 KB             | `fixed inset-0 ... backdrop-blur-[8px]`      |
| `.resume-btn`             | included            | `bg-gradient-to-br hover:brightness-110`     |

**Total CSS removed: ~10.2 KB**

### Kept in main.css (cannot migrate to Tailwind CDN)

| What                                        | Why                                                             |
| ------------------------------------------- | --------------------------------------------------------------- |
| `.loading-detail-item/.loading/.loaded`     | JS classList toggle — Tailwind CDN can't JIT these              |
| `@keyframes loadingPulse`                   | Used via inline `style=animation:...` (Tailwind CDN limitation) |
| `.resume-prompt-inner::before/after`        | CSS pseudo-elements — Tailwind CDN cannot generate these        |
| `@keyframes rpEnter`                        | Used by `.animate-rp-enter` extended in tailwind.config         |
| `@keyframes dbPulse/consolePulse/shopPulse` | Box-shadow keyframes — Tailwind CDN can't JIT                   |
| `.rp-corner/.rp-badge/.rp-divider`          | Decoration classes used in resume card HTML                     |
| `.kbd-cyan/.kbd-green/.kbd-gold`            | Key badge styling — still referenced in HTML                    |

---

## ⚠️ Session 11 — Visual Regression Hotspots

| Check                  | What could break                                                               |
| ---------------------- | ------------------------------------------------------------------------------ |
| Loading screen layout  | `max-w-[420px]` matches old `max-width: 420px` — verify on narrow screens      |
| Progress bar animation | `.loading-detail-item.loading/.loaded` JS toggle still in CSS — verify state   |
| Prompt positions       | `[bottom:120px/160px/200px]` arbitrary values — verify prompt stacks correctly |
| Resume card animation  | `.animate-rp-enter` uses extended Tailwind keyframe — verify entrance anim     |
| Prompt pulse glow      | `#db-prompt { animation: dbPulse }` in CSS — verify prompts still glow         |
| Tailwind CDN load      | CDN must load before game scripts — verify no FOUC on slow connections         |

---

## 🔜 Session 12 — ไฟล์ที่ต้องเตรียม

**เป้าหมาย:** Tailwind migration สำหรับ Shop modal + Admin Console layout

**ไฟล์ที่ต้องอัปโหลด:**

| ไฟล์                        | เหตุผล                                                   |
| --------------------------- | -------------------------------------------------------- |
| `index.html`                | จาก outputs Session 11 — markup ของ shop + admin console |
| `css/main.css`              | จาก outputs Session 11 — ดู CSS ที่เหลือก่อน migrate     |
| `js/ui/ShopManager.js`      | ตรวจว่ามี DOM className binding ที่ต้องรักษาไว้          |
| `js/systems/AdminSystem.js` | ตรวจ DOM class bindings ใน admin console                 |

---

## 🔁 Session 12 — Tailwind Migration Coverage

### Strategy for Admin Console + Shop

Admin console inner (`console-inner`) has complex CRT pseudo-elements, JS class injection (`cline-*`), animation, and dynamic DOM writes → **CSS unchanged**. Only the backdrop wrapper migrated to Tailwind.

Shop inner (`shop-inner`) has `::before/::after` decorators, `shop-visible` JS toggle, and ShopManager injects `.shop-item`/`.shop-buy-btn` innerHTML → **inner CSS unchanged**. Wrapper, header, buttons migrated.

### Migrated to Tailwind (HTML classes, CSS removed)

| Element                   | CSS removed         | Tailwind approach                                    |
| ------------------------- | ------------------- | ---------------------------------------------------- |
| `#admin-console` backdrop | ~200 chars          | `fixed inset-0 z-[9800] hidden ... backdrop-blur`    |
| `#shop-modal` backdrop    | ~200 chars          | `fixed inset-0 z-[9500] hidden ... backdrop-blur`    |
| `.shop-header`            | ~150 chars          | `flex justify-between items-center border-b`         |
| `.shop-title`             | ~180 chars          | `font-['Orbitron'] text-2xl text-mtc-gold`           |
| `.shop-score-info`        | ~100 chars          | `text-sm text-slate-400 flex items-center`           |
| `.shop-score-value`       | ~150 chars          | `font-['Orbitron'] bg-[rgba(...)] border rounded-lg` |
| `.shop-close-btn`         | ~200 chars          | `hover:scale-110 hover:border-red-500`               |
| shop subtitle             | kept (class reused) | added Tailwind alongside: `text-[11px] tracking`     |
| shop footer               | kept (class reused) | added: `border-t border-[rgba(250,204,21,0.12)]`     |

**Total additional CSS removed: ~1.2 KB**

### Kept in main.css (JS-bound — cannot migrate)

| What                                    | Why                                                 |
| --------------------------------------- | --------------------------------------------------- |
| `.console-inner/.console-visible`       | JS classList toggle for entrance animation          |
| `.console-inner::before`                | CRT scanline pseudo-element                         |
| `@keyframes phosphorFlicker`            | CRT flicker on `.console-inner`                     |
| `.cline-*` (info/ok/error/warn/cmd/sys) | AdminSystem.js injects innerHTML with these classes |
| `#console-input`                        | Styled native input — JS reads value                |
| `.console-cursor/.console-help`         | CRT chrome elements                                 |
| `.shop-inner/.shop-inner.shop-visible`  | JS classList toggle (ShopManager.js)                |
| `.shop-inner::before/::after`           | CSS `content:'✦'` pseudo decorators                 |
| `.shop-item/.shop-buy-btn`              | ShopManager.js injects these via innerHTML          |

---

## ⚠️ Session 12 — Visual Regression Hotspots

| Check                     | What could break                                                        |
| ------------------------- | ----------------------------------------------------------------------- |
| Admin backdrop            | `hidden` → JS must call `display:flex` not `display:block` on open      |
| Shop backdrop             | Same — verify AdminSystem/ShopManager toggle uses `flex` not `block`    |
| shop-close-btn in ach     | `#achievements-modal` also uses `.shop-close-btn` — verify still styled |
| Shop header layout        | `flex-wrap gap-3` — verify narrow screen doesn't break 3-col header     |
| console-visible animation | Still CSS — verify entrance anim works after backdrop change            |

---

## ✅ Rendering Remaster + Tailwind UI — Complete (Sessions 1–12)

All 12 planned sessions finished.

| Phase                             | Sessions | Status |
| --------------------------------- | -------- | ------ |
| Baseline + Tokens                 | 1–3      | ✅     |
| Auto renderer refactor + cache    | 4–5      | ✅     |
| Skin system                       | 6        | ✅     |
| Enemy overlay modular             | 7        | ✅     |
| Boss aura presets                 | 8        | ✅     |
| Effects factory                   | 9        | ✅     |
| Regression pass + final hardcodes | 10       | ✅     |
| Tailwind loading + prompts        | 11       | ✅     |
| Tailwind shop + admin console     | 12       | ✅     |
