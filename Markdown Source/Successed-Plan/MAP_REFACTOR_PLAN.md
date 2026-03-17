# MAP_REFACTOR_PLAN.md
# MTC The Game — Map Refactor Master Plan
# เวอร์ชัน: 1.0 | สร้าง: 2026-03-17
# สำหรับ: AI Agent (Trae / Claude) อ่านก่อนเริ่มทุก Session

---

## 🧭 ภาพรวม

แผนนี้แบ่งงาน Map Refactor ออกเป็น **3 Session** อิสระ
Session ก่อนหน้าต้องเสร็จก่อน Session ถัดไปจะเริ่มได้

เป้าหมายรวม:
1. Object ไม่บล็อก corridor — ศัตรูเดินลื่นทุกเส้นทาง
2. Interactive Objects ใหม่ 4 ประเภท
3. Visual upgrade ทุก zone — ไม่เพิ่ม draw call เกินงบ

---

## 📁 ไฟล์ที่เกี่ยวข้องทั้งหมด

| ไฟล์ | Session ที่แตะ | หน้าที่ |
|---|---|---|
| `js/map.js` | 1, 2, 3 | Object placement, draw helpers, MapSystem |
| `js/game.js` | 2 | `_checkProximityInteractions()`, `_tickEnvironment()` |
| `js/config/SystemConfig.js` | 3 | `MAP_CONFIG` สี/visual ของ zone/terrain |
| `js/config/BalanceConfig.js` | 2 | เพิ่ม interactive object config |
| `js/config/GameTexts.js` | 2 | เพิ่ม UI strings สำหรับ interactive objects |
| `js/systems/WaveManager.js` | 2 | เพิ่ม HackTerminal spawn-pause hook |

---

## ⚠️ Critical Constraints (อ่านก่อนเขียนโค้ดทุกครั้ง)

### ข้อห้ามเด็ดขาด
```
❌ NEVER call Math.random() inside draw()
❌ NEVER modify state inside draw()
❌ NEVER use template literal / string concat ใน hot draw path
   → ใช้ ctx.globalAlpha + solid hex string เสมอ
❌ NEVER splice() array ใน game loop → ใช้ swap-and-pop
❌ NEVER create new arrays ใน dispose/clear → .length = 0
```

### ข้อบังคับ
```
✅ Guard ทุก global access: if (typeof X === 'undefined') return;
✅ update() แยกจาก draw() อย่างเด็ดขาด
✅ Interactive object ใหม่ทุกตัว ต้อง instanceof check ก่อน cast
✅ Viewport cull ก่อน draw ทุกครั้ง (ดูตัวอย่างใน MapSystem.draw())
✅ Output ต้องเป็น minimal diff (search/replace) ห้าม full-file rewrite
```

### World Coordinate System
```
World size: 3200 × 3200 units, origin (0,0) = กลางแมพ
Arena radius: 1500 units
ทิศ: North = Y เป็นลบ, South = Y เป็นบวก, East = X เป็นบวก

Enemy radius (ค่าจริง จาก BalanceConfig.js):
  basic: 18px | tank: 25px | mage: 16px
  → Minimum corridor width: 90px (2× tank + 40px buffer)
  → Safe passage width: 120px+ (recommended)
```

---

---

# SESSION 1 — Layout & Pathfinding Fix

## 🎯 เป้าหมาย Session 1
แก้ layout ของ objects ใน `generateCampusMap()` ให้ศัตรูเดินผ่านได้ทุกโซน
ไม่ต้องแตะไฟล์อื่น

## 📁 ไฟล์ที่ต้องส่งให้ AI
```
js/map.js          ← ไฟล์เดียวที่แก้
```

## 🔍 Pre-Implementation Risk Sheet

### Blast Radius
- แก้เฉพาะ `generateCampusMap()` (map.js L.1164–1354)
- ไม่กระทบ: draw helpers, collision system, MTCRoom, lighting
- Risk: ถ้า object ใหม่ซ้อนกับ wall positions ใน BALANCE.map.wallPositions → collision loop slow

### Dependency Graph
```
generateCampusMap() → MapObject constructor → this.objects[]
                    → ExplosiveBarrel constructor
                    → MTCRoom constructor
ไม่มี dependency ข้ามไฟล์
```

### Architecture Smell ที่พบ
- `createAisles()` วาง object เป็น grid ตรงๆ โดยไม่มี corridor check → ต้องแก้ pattern ไม่ใช่แค่ค่า
- jitter ปัจจุบัน (12-20px) ยังน้อยเกินไปเทียบกับ object width (40-80px) → อาจ close corridor ถ้า jitter > gap/2

### Load Order
```
SystemConfig.js → BalanceConfig.js → map.js
map.js อ่าน: MAP_CONFIG, BALANCE (ทั้งสองต้องโหลดก่อน)
```

### Exit Criteria Session 1
- [ ] ทุก corridor มีความกว้างขั้นต่ำ 120px (วัดระหว่าง object edges)
- [ ] ศัตรูสามารถเดินจาก center → ทุก zone โดยไม่ติด stuck loop
- [ ] Object count รวมไม่เกิน 80 ชิ้น (performance budget)
- [ ] ไม่มี object ที่ x∈[-200,200], y∈[-500,-320] (Citadel approach clear zone)

### Rollback Plan
- `generateCampusMap()` เป็น pure function ไม่มี side effect ข้ามไฟล์
- rollback = revert `generateCampusMap()` เท่านั้น

---

## 📐 Layout Rules (กฎที่ต้องยึดถือ)

### Clear Zones — ห้ามวาง object ใดๆ เด็ดขาด
```javascript
// ตรวจสอบก่อน push ทุกครั้ง:
function _isClearZone(x, y, w, h) {
    const cx = x + w/2, cy = y + h/2;
    // Spawn area
    if (Math.hypot(cx, cy) < 300) return true;
    // Citadel approach corridor
    if (cx > -220 && cx < 220 && cy > -520 && cy < -320) return true;
    // Database approach (south face)
    if (cx > 340 && cx < 660 && cy > -460 && cy < -260) return true;
    // CoopStore approach
    if (cx > -660 && cx < -360 && cy > 320 && cy < 465) return true;
    // East gate gaps
    if (cx > 370 && cx < 520 && cy > -250 && cy < 185) return true;
    // West gate gaps
    if (cx > -530 && cx < -360 && cy > -250 && cy < 185) return true;
    return false;
}
```

### Corridor Width Rule
```
Object pairs ที่เผชิญกัน ต้องมีช่องว่าง ≥ 120px ระหว่าง edges
เช่น server (w=45) pair → xStep ≥ 45+120 = 165px minimum
เช่น bookshelf (w=80) pair → xStep ≥ 80+120 = 200px minimum
```

### U-Shape Pattern (แทน Grid)
```javascript
// แทนที่จะวาง grid 4×3:
// ❌ createAisles(x, y, 3, 4, 120, 150, 'server') // สร้าง wall
//
// ✅ ใช้ U-shape:
// วางซ้าย-ขวาของ corridor เปิดกลาง
// ตัวอย่าง Server Farm East:
const serverLeft = [
    {x: 720, y: -580}, {x: 720, y: -430}, {x: 720, y: -280},
    {x: 720, y: 60},   {x: 720, y: 210},
];
const serverRight = [
    {x: 950, y: -580}, {x: 950, y: -430}, {x: 950, y: -280},
    {x: 950, y: 60},   {x: 950, y: 210},
];
// corridor กว้าง: 950-720-45 = 185px ✅
```

---

## 🔧 การเปลี่ยนแปลงที่ต้องทำ

### 1. เพิ่ม Helper Function `_isClearZone()`
ตำแหน่ง: ใน `generateCampusMap()` ก่อน section แรก

### 2. แก้ Zone A: Server Farm East (L.1253–1258)
```
เดิม: createAisles(720, -580, 4, 3, 120, 150, 'server', 18, 1.0)
      → วาง 12 servers ใน grid → บล็อก corridor กลาง

ใหม่: วาง 2 แถวซ้าย-ขวา (x=720, x=940) โดยเปิด corridor กลาง 175px
      แต่ละแถวมี 4-5 objects ตาม y

Constraint: x=720 ถึง x=940 (gap 175px หลัง object width 45px)
           y range: -580 ถึง 250 (หลีกเลี่ยง y∈[-250,185] gate gaps)
```

### 3. แก้ Zone B: Library Archives West (L.1267–1271)
```
เดิม: createAisles(-680, -570, 5, 2, -240, 120, 'bookshelf', 14, 3.0)
      xStep=-240 → gap = 240-80 = 160px (OK แต่ jitter 14px อาจปิด)

ใหม่: xStep=-220 (ลด density), jitter ≤ 8px
      เพิ่ม explicit row spacing: yStep=140 (เดิม 120 อาจแน่น)
      desk ต้องอยู่ระหว่าง shelf pairs ไม่ใช่หน้า entrance
```

### 4. แก้ Zone C: Courtyard South (L.1275–1281)
```
เดิม: tree grid เป็นสองแถวตรงๆ → สร้าง pseudo-wall
ใหม่: tree กระจายแบบ stagger pattern (แถวคู่-คี่ offset 90px)
      desk/vending อยู่ตรงกลาง ไม่ใช่แถวตรง
```

### 5. แก้ Barrel Placement (L.1332–1354)
```
เดิม: ใช้ tooClose threshold 45px → อาจวางใกล้ corridor edge
ใหม่: เพิ่ม _isClearZone check ก่อน push barrel
      tooClose threshold เพิ่มเป็น 60px สำหรับ barrel
```

### 6. ปรับ Citadel Interior (L.1220–1224)
```
เดิม: server/datapillar วางใน y=8–80 ซึ่งอาจ overlap entrance
ใหม่: server ชิดมุม (x=mtcX+10, x=mtcX+mtcW-55), y=mtcY+15
      datapillar ถอยใน: x=mtcX+90 และ x=mtcX+185, y=mtcY+10
      ปล่อย center path กว้าง ≥ 150px สำหรับ player เดิน
```

---

---

# SESSION 2 — Interactive Objects

## 🎯 เป้าหมาย Session 2
เพิ่ม 4 Interactive Object types ใหม่ในแมพ
แต่ละตัวมี visual, interaction (กด E), และ game mechanic

## 📁 ไฟล์ที่ต้องส่งให้ AI
```
output/map.js (จาก Session 1)
js/game.js
js/systems/WaveManager.js
js/config/BalanceConfig.js
js/config/GameTexts.js  (ถ้ามี — ถ้าไม่มีให้ข้ามส่วน GameTexts)
```

## 🔍 Pre-Implementation Risk Sheet

### Blast Radius
- map.js: เพิ่ม class ใหม่ + draw helper + placement ใน generateCampusMap
- game.js: แก้ `_checkProximityInteractions()` (L.360–406) + `_tickEnvironment()` (L.503)
- WaveManager.js: เพิ่ม 1 บรรทัด guard ใน `updateWaveEvent()` trickle block (L.244–257)
- BalanceConfig.js: เพิ่ม config block ใน BALANCE object

### Dependency Graph
```
MapObject (map.js)
  ├── HackTerminal extends MapObject
  ├── MedStation   extends MapObject
  ├── AmmoCrate    extends MapObject
  └── PowerNode    extends MapObject

game.js _checkProximityInteractions()
  └── reads: mapSystem.objects, keys.e, dist(), window.player

WaveManager.js updateWaveEvent()
  └── reads: window.hackTerminalActive (new flag)

BALANCE.interactiveObjects (new block in BalanceConfig.js)
  └── consumed by: all 4 new classes
```

### Architecture Smell ที่พบ
- `_checkProximityInteractions()` ใช้ hardcoded `MTC_DATABASE_SERVER` + `MTC_SHOP_LOCATION`
  → interactive objects ใหม่ควร loop ผ่าน `mapSystem.objects` แทน hardcode
- Game.js ไม่มี generic interactive object tick loop → ต้องเพิ่มใน `_tickEnvironment()`
  แต่ไม่ใช่ใน enemy loop (ผิด separation of concerns)

### Load Order
```
BalanceConfig.js → SystemConfig.js → map.js → game.js
interactive object classes ต้อง define ใน map.js (ก่อน game.js อ่าน)
```

### Exit Criteria Session 2
- [ ] กด E ใกล้ HackTerminal → trickle หยุด 8 วินาที → resume ปกติ
- [ ] กด E ใกล้ MedStation → regen 25% HP (ครั้งเดียวต่อ wave)
- [ ] กด E ใกล้ AmmoCrate → energy +50 (ทุก wave reset)
- [ ] เดินเข้า radius 150px ของ PowerNode → player.damageBoost +10%
- [ ] ไม่มี GC allocation ใน draw path ของทั้ง 4 classes

### Rollback Plan
1. ลบ 4 classes ใหม่ออกจาก map.js
2. revert `_checkProximityInteractions()` ใน game.js
3. ลบ 1 บรรทัดใน WaveManager.js trickle block
4. ลบ BALANCE.interactiveObjects block

---

## 🎮 Interactive Object Specs

### 1. HackTerminal
```javascript
// ขนาด: w=50, h=70
// Visual: hologram screen สีเขียวไซยาน, เสาฐาน, circuit lines
// สี (hex เท่านั้น): body='#0a1a1a', screen='#00ff88', glow='#00cc66'
// Light source: type='green', radius=80 (เพิ่มใน drawLighting)

// State fields:
this.type = 'hackterminal';
this.cooldown = 0;          // วินาที, เริ่มที่ 0 = พร้อมใช้
this.COOLDOWN_MAX = 60;     // 60s cooldown หลังใช้
this.isActive = false;      // กำลัง hack อยู่
this.activeTimer = 0;       // เหลือเวลา hack

// Mechanic:
// กด E ที่ radius < 80px → set window.hackTerminalActive = true
//                        → activeTimer = 8.0
// update(dt): ถ้า isActive → activeTimer -= dt → ถ้า ≤ 0 → isActive=false
//             cooldown -= dt (clamp ≥ 0)
// WaveManager hook (L.244): if (_trickle.active && window.hackTerminalActive) return; // pause trickle

// Placement: 1 ตัวในแต่ละ major zone (4 ตัวรวม)
// ตำแหน่ง: x=820, y=-350  (Server Farm East)
//           x=-820, y=-350  (Library West)
//           x=0,    y=650   (Courtyard South — center)
//           x=750,  y=580   (Lecture Hall R)
```

### 2. MedStation
```javascript
// ขนาด: w=55, h=55
// Visual: cross icon แดง, กล่องขาว-เทา, indicator light
// สี: body='#1a1a1a', cross='#ef4444', light='#22c55e'
// Light source: type='warm', radius=60

this.type = 'medstation';
this.usedThisWave = false;  // reset เมื่อ wave เริ่ม (ดู §Reset Logic)
this.HEAL_PCT = 0.25;       // 25% of player.maxHp

// Mechanic:
// กด E ที่ radius < 70px && !this.usedThisWave
// → player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.25)
// → this.usedThisWave = true
// → spawnFloatingText('+HP', ..., '#22c55e')

// Reset: ใน game.js startNextWave() callback หรือ WaveManager.startNextWave()
// → mapSystem.objects.forEach(o => { if (o.type==='medstation') o.usedThisWave=false; })
// → เพิ่มใน game.js ที่ L.593 (wave clear trigger) หรือ WaveManager.startNextWave()

// Placement: 2 ตัว ในโซนที่เข้าถึงง่าย
// ตำแหน่ง: x=-370, y=200   (West corridor)
//           x=310,  y=-200  (East corridor)
```

### 3. AmmoCrate
```javascript
// ขนาด: w=45, h=45
// Visual: metal box ลาย hazard, glowing lid
// สี: body='#3d2b00', stripes='#f59e0b', lid='#fcd34d'
// ไม่มี light source (เล็กเกินไป)

this.type = 'ammocrate';
this.usedThisWave = false;
this.ENERGY_RESTORE = 50;   // restore energy 50 units

// Mechanic:
// กด E ที่ radius < 60px && !this.usedThisWave
// → player.energy = Math.min(player.maxEnergy, player.energy + 50)
// → this.usedThisWave = true
// → spawnFloatingText('+ENERGY', ..., '#f59e0b')
// Reset: เหมือน MedStation

// Placement: 4 ตัว กระจาย zone boundaries
// ตำแหน่ง: x=540, y=-50   (East gate)
//           x=-570, y=-50  (West gate)
//           x=-200, y=420  (South approach L)
//           x=160,  y=420  (South approach R)
```

### 4. PowerNode
```javascript
// ขนาด: w=30, h=80
// Visual: crystal pillar ม่วง, pulsing aura rings
// สี: body='#2d0a4e', crystal='#a855f7', aura='#c084fc'
// Light source: type='cool', radius=100 (ม่วง → map ไปเป็น cool)
// ⚠️ ปัจจุบัน drawLighting ไม่มี 'purple' type → ใช้ 'cool' แทน

this.type = 'powernode';
this.AURA_RADIUS = 150;     // ระยะที่ buff ทำงาน
this.DAMAGE_BONUS = 0.10;   // +10% damage
this._playerWasInside = false; // ป้องกัน apply ซ้ำทุก frame

// Mechanic (passive — ไม่ต้องกด E):
// ทุก frame ใน update(dt): 
//   inRange = dist(player.x, player.y, cx, cy) < AURA_RADIUS
//   ถ้า inRange && !_playerWasInside → apply buff
//   ถ้า !inRange && _playerWasInside → remove buff
//   _playerWasInside = inRange
// Buff: player._powerNodeBuff = true (flag สำหรับ track)
//       player.damageBoost *= (1 + DAMAGE_BONUS) → apply
//       ตอน remove: player.damageBoost /= (1 + DAMAGE_BONUS)
// ⚠️ ใช้ multiplication/division แทน addition เพื่อ compose กับ shop buffs

// Placement: 3 ตัว ใน tactical positions
// ตำแหน่ง: x=0, y=0        (arena center — สูงสุด ดีที่สุด)
//           x=830, y=-490  (NE — Server Farm deep)
//           x=-850, y=-490 (NW — Library deep)
```

---

## 🔧 การ Implement ใน game.js

### `_checkProximityInteractions()` — เพิ่ม interactive object loop

```javascript
// เพิ่มหลัง shop check (ท้าย function, ก่อน closing brace)
// ตำแหน่ง: หลัง L.405 ใน game.js

if (typeof window.mapSystem === 'undefined') return;
const _p = window.player;
for (const obj of window.mapSystem.objects) {
    if (!obj || obj.dead) continue;
    const _cx = obj.x + (obj.w || 0) * 0.5;
    const _cy = obj.y + (obj.h || 0) * 0.5;
    const _d = dist(_p.x, _p.y, _cx, _cy);

    if (obj.type === 'hackterminal' && !obj.isActive && obj.cooldown <= 0 && _d < 80 && keys.e === 1) {
        keys.e = 0;
        obj.isActive = true;
        obj.activeTimer = BALANCE.interactiveObjects.hackTerminal.duration;
        obj.cooldown = BALANCE.interactiveObjects.hackTerminal.cooldown;
        window.hackTerminalActive = true;
        spawnFloatingText('⚡ HACK!', _cx, _cy - 40, '#00ff88', 22);
        if (typeof addScreenShake === 'function') addScreenShake(4);
        return;
    }
    if (obj.type === 'medstation' && !obj.usedThisWave && _d < 70 && keys.e === 1) {
        keys.e = 0;
        obj.usedThisWave = true;
        const healed = Math.floor(_p.maxHp * BALANCE.interactiveObjects.medStation.healPct);
        _p.hp = Math.min(_p.maxHp, _p.hp + healed);
        spawnFloatingText(`+${healed} HP`, _cx, _cy - 40, '#22c55e', 22);
        spawnParticles(_cx, _cy, 12, '#22c55e');
        return;
    }
    if (obj.type === 'ammocrate' && !obj.usedThisWave && _d < 60 && keys.e === 1) {
        keys.e = 0;
        obj.usedThisWave = true;
        const restored = BALANCE.interactiveObjects.ammoCrate.energyRestore;
        _p.energy = Math.min(_p.maxEnergy || 100, (_p.energy || 0) + restored);
        spawnFloatingText(`+${restored} EN`, _cx, _cy - 40, '#f59e0b', 22);
        spawnParticles(_cx, _cy, 8, '#f59e0b');
        return;
    }
}
```

### `_tickEnvironment(dt)` — เพิ่ม interactive object updates

```javascript
// เพิ่มใน _tickEnvironment(dt) ก่อน return
// หรือสร้าง _tickInteractiveObjects(dt) แล้วเรียกจาก updateGame()

if (typeof window.mapSystem !== 'undefined' && window.player) {
    const _ip = window.player;
    let _anyPowerNode = false;
    for (const obj of window.mapSystem.objects) {
        if (!obj) continue;
        const _cx = obj.x + (obj.w || 0) * 0.5;
        const _cy = obj.y + (obj.h || 0) * 0.5;

        if (obj.type === 'hackterminal') {
            if (obj.cooldown > 0) obj.cooldown -= dt;
            if (obj.isActive) {
                obj.activeTimer -= dt;
                if (obj.activeTimer <= 0) {
                    obj.isActive = false;
                    window.hackTerminalActive = false;
                }
            }
        }
        if (obj.type === 'powernode') {
            const _inRange = dist(_ip.x, _ip.y, _cx, _cy) < BALANCE.interactiveObjects.powerNode.auraRadius;
            if (_inRange) _anyPowerNode = true;
            if (_inRange && !obj._playerWasInside) {
                obj._playerWasInside = true;
                _ip.damageBoost = (_ip.damageBoost || 1.0) * (1 + BALANCE.interactiveObjects.powerNode.damageMult);
                _ip._powerNodeActive = true;
                spawnFloatingText('⚡+DMG', _cx, _cy - 50, '#c084fc', 18);
            } else if (!_inRange && obj._playerWasInside) {
                obj._playerWasInside = false;
                _ip.damageBoost = (_ip.damageBoost || 1.0) / (1 + BALANCE.interactiveObjects.powerNode.damageMult);
                _ip._powerNodeActive = false;
            }
        }
    }
    // ถ้าออกจาก PowerNode ทุกตัว clear flag
    if (!_anyPowerNode && _ip._powerNodeActive) {
        _ip._powerNodeActive = false;
    }
}
```

### Wave Reset Hook — MedStation/AmmoCrate reset
```javascript
// เพิ่มใน game.js ที่ wave clear trigger (L.591-593)
// หลัง setWave(getWave() + 1);

if (typeof window.mapSystem !== 'undefined') {
    for (const _obj of window.mapSystem.objects) {
        if (_obj.usedThisWave !== undefined) _obj.usedThisWave = false;
    }
}
```

---

## 🔧 การแก้ WaveManager.js

```javascript
// แก้ updateWaveEvent() L.244-257
// เพิ่ม 1 บรรทัด guard ใน trickle block:

if (_trickle.active) {
    if (window.hackTerminalActive) return; // ← เพิ่มบรรทัดนี้ (pause trickle)
    _trickle.timer -= dt;
    // ... rest unchanged
}
```

---

## 🔧 BALANCE.interactiveObjects (เพิ่มใน BalanceConfig.js)

```javascript
// เพิ่มใน BALANCE object ก่อน closing brace:
interactiveObjects: {
    hackTerminal: {
        duration: 8.0,       // วินาที ที่ spawn หยุด
        cooldown: 60.0,      // วินาที cooldown
        interactRadius: 80,
    },
    medStation: {
        healPct: 0.25,       // 25% maxHp
        interactRadius: 70,
    },
    ammoCrate: {
        energyRestore: 50,
        interactRadius: 60,
    },
    powerNode: {
        auraRadius: 150,
        damageMult: 0.10,    // +10%
    },
},
```

---

---

# SESSION 3 — Visual Upgrade

## 🎯 เป้าหมาย Session 3
อัปเกรด visual ของแมพโดยไม่เพิ่ม draw call เกินงบ
กฎ: ≤ 5 เพิ่ม draw call ต่อ frame | ≤ 2 gradient ใหม่ต่อ frame

## 📁 ไฟล์ที่ต้องส่งให้ AI
```
output/map.js (จาก Session 2)
js/config/SystemConfig.js (MAP_CONFIG — สีปัจจุบันอยู่ที่นี่)
```

## 🔍 Pre-Implementation Risk Sheet

### Blast Radius
- map.js: drawZoneFloors(), drawTerrain(), draw helpers (drawDesk, drawBookshelf)
- drawLighting(): เพิ่ม light sources สำหรับ interactive objects ใหม่
- ไม่กระทบ: collision, update logic, game.js

### Architecture Smell ที่พบ
- drawLighting() ใช้ `rgba(${r},${g},${b},${a.toFixed(3)})` ที่ L.1755 → GC alloc ทุก frame
  แต่อยู่นอก hot path (1 ครั้งต่อ frame เท่านั้น) → acceptable
- drawZoneFloors ใช้ flat fillRect → ควรเพิ่ม pattern แบบ cached offscreen canvas

### Exit Criteria Session 3
- [ ] ทุก zone มี visual identity ชัดเจน (สี + pattern ต่างกัน)
- [ ] Interactive objects ใหม่มี light source ใน drawLighting()
- [ ] FPS ≥ 60 กับ 40 enemies บนหน้าจอ (ไม่แย่ลงจาก baseline)
- [ ] ไม่มี dynamic string allocation ใน draw hot path

---

## 🎨 Visual Upgrade Specs

### 1. Zone Floor Enhancement — `drawZoneFloors(ctx)`

แต่ละ zone เพิ่ม **grid pattern + corner accent**:

```javascript
// Pattern: วาด grid lines เบาๆ แทนที่จะเป็น flat color
// ใช้ MAP_CONFIG.zones[zoneName].gridColor + gridSize
// ตัวอย่าง Server Farm:
//   grid สีไซยานอ่อน, gridSize=36, strokeAlpha=0.25
//   corner accent: สี่เหลี่ยมมุม 20×20px, เส้น กว้าง 1.5px

// ⚠️ Performance: อย่า loop pixel-by-pixel
// วาด horizontal lines + vertical lines แยก beginPath
// จำนวน lines ต่อ zone ≤ 30 เส้น

// Zone accent colors (จาก MAP_CONFIG.zones ที่มีอยู่):
// serverFarm: gridColor='rgba(6, 182, 212, 0.25)'   accentColor='rgba(34, 211, 238, 0.35)'
// library:    gridColor='rgba(251, 191, 36, 0.22)'  accentColor='rgba(253, 224, 71, 0.30)'
// courtyard:  gridColor='rgba(74, 222, 128, 0.20)'  accentColor='rgba(134, 239, 172, 0.28)'
// lectureL/R: gridColor='rgba(192, 132, 252, 0.18)' accentColor='rgba(216, 180, 254, 0.22)'
```

### 2. Zone Label Enhancement
```javascript
// เพิ่ม ambient glow ด้านหลัง label text
// ใช้ MAP_CONFIG.zones[zoneName].ambientColor ที่มีอยู่แล้ว
// วิธี: วาด text ด้วย shadowBlur=20 ก่อน แล้ววาด text ปกติทับ
// ⚠️ Set shadowBlur=0 หลังวาดเสมอ
```

### 3. Draw Helper Upgrades

#### drawDesk() — เพิ่ม detail
```javascript
// เพิ่ม 3 items บนโต๊ะ (keyboard, mouse, cup)
// ใช้ ctx.fillRect เท่านั้น (ไม่ใช้ arc/roundRect ใหม่)
// keyboard: สี่เหลี่ยมเล็ก w*0.3 × h*0.15 บน desk surface
// cup: วงกลม radius=3 มุมขวาบน
// ทุก color ต้องเป็น solid hex หรือ rgba ที่ pre-computed
```

#### drawBookshelf() — spine detail
```javascript
// เพิ่ม title text บน spine บางเล่ม (ทุก 3 เล่ม)
// ใช้ ctx.font = '3px monospace', ตัวอักษร 1-2 ตัว
// สี: pal.bookColors[(bookIdx+2) % bookColors.length] ที่ alpha 0.6
// ⚠️ เพิ่ม fillText max 5 ครั้งต่อ bookshelf (ไม่ทุก book)
```

#### drawTree() — night sparkle
```javascript
// sparkle เดิมหมุน แต่ใช้ Math.random ใน draw — ❌
// ปัจจุบัน L.130-133 ใช้ t (shared timestamp) → OK แล้ว ✅
// เพิ่ม firefly effect: 2 จุดเล็กๆ กระพริบด้วย sin(t*3 + offset)
// offset ใช้ obj.x * 0.01 (deterministic per-tree)
```

### 4. Interactive Objects Visual (วาดใน draw helper ใหม่)

#### drawHackTerminal(w, h) — standalone draw helper
```javascript
// Structure:
// 1. Shadow ellipse (rgba(0,0,0,0.4))
// 2. Base pedestal: fillRect สีเข้ม w×h*0.2, ล่างสุด
// 3. Main body: roundRect w×h*0.75, '#0a1a1a', border '#00cc66'
// 4. Screen: roundRect w*0.7×h*0.45, สี '#001a0d'
//    - scan lines: 3 เส้น fillRect สูง 1px, rgba(0,255,136,0.15)
//    - cursor blink: sin(_mapNow/400) > 0 → small rect
// 5. Status LED: arc radius=4, บน top-right
//    - พร้อมใช้ → '#00ff88' + shadowBlur=10
//    - cooldown → '#334d40' (ไม่มี glow)
// 6. Hologram rings (ถ้า isActive):
//    - 2 วง arc ขนาด r=w*0.7 และ r=w, สี rgba(0,255,136,0.15)
//    - rotate ด้วย _mapNow/2000 (ใช้ ctx.save/rotate/restore)
// ⚠️ MapObject.draw() switch เพิ่ม case 'hackterminal'
```

#### drawMedStation(w, h) — standalone draw helper
```javascript
// 1. Shadow
// 2. Box: roundRect '#1c1c1c', border '#333'
// 3. Cross: 2 fillRect (vertical + horizontal), '#ef4444'
// 4. Glass cover: roundRect rgba(255,255,255,0.05)
// 5. Status light: arc top-center
//    - usedThisWave=false → '#22c55e' glow
//    - usedThisWave=true  → '#4b5563' (depleted)
```

#### drawAmmoCrate(w, h) — standalone draw helper
```javascript
// 1. Shadow
// 2. Body: roundRect '#3d2b00', hazard stripes via path
//    stripes: 3 diagonal rect วาดด้วย ctx.rotate(45deg) + clip
//    ⚠️ หรือใช้ fillRect เฉียงแบบ approximate (ง่ายกว่า ไม่ต้อง rotate)
// 3. Lid: fillRect บน '#fcd34d' (สว่าง)
// 4. Latch: 2 fillRect เล็กๆ สีเข้ม
// 5. Indicator: กระพริบด้วย sin(_mapNow/300) > 0
//    - usedThisWave=false → '#f59e0b'
//    - used → '#4b5563'
```

#### drawPowerNode(w, h) — standalone draw helper
```javascript
// 1. Aura ring (ถ้า player อยู่ใกล้ — pass state via obj._playerWasInside)
//    ctx.globalAlpha = 0.12 + sin(_mapNow/600)*0.06
//    arc radius = BALANCE.interactiveObjects.powerNode.auraRadius (world unit)
//    ⚠️ aura radius ต้องแปลงเป็น screen space ก่อน: auraRadiusSS = auraRadius * camera.zoom
//    หรือ skip aura ใน draw helper แล้ว draw แยกใน MapSystem.draw() ที่รู้ camera
// 2. Shadow
// 3. Crystal body: gradient linear '#2d0a4e' → '#7e22ce'
//    roundRect 0,0,w,h*0.85
// 4. Crystal tip: polygon 6-sided สีสว่าง '#c084fc'
// 5. Pulse rings: 2 arcs เล็ก ที่ center, alpha oscillate
// 6. Glow: shadowBlur=15, shadowColor='#a855f7' (set/unset ทันที)
```

### 5. Lighting Update — `drawLighting()` ใน MapSystem

```javascript
// เพิ่มใน loop ที่ scan this.objects (map.js L.1790-1800)
// ต่อท้ายหลัง else if (obj.type === 'coopstore')

else if (obj.type === 'hackterminal') {
    punchLight(obj.x + obj.w * .5, obj.y + obj.h * .3, 80, 'green');
}
else if (obj.type === 'medstation') {
    punchLight(obj.x + obj.w * .5, obj.y + obj.h * .3, 60, 'cool');
}
else if (obj.type === 'powernode') {
    punchLight(obj.x + obj.w * .5, obj.y + obj.h * .3, 100, 'cool');
}
// AmmoCrate ไม่มี light (เล็กเกินไป)
```

---

---

## 🗺️ Object Placement Summary (รวมทุก Session)

### Placement Map — coordinate (x, y) center point

```
ZONE A — SERVER FARM EAST (x≥680)
  Server left column:  x=720, y=-580,-430,-280, 60, 210
  Server right column: x=940, y=-580,-430,-280, 60, 210
  DataPillar markers:  x=680, y=-550,-390,-230, 80
  HackTerminal:        x=820, y=-350
  Tree scatter:        x=580, y=-380 / x=600, y=100

ZONE B — LIBRARY ARCHIVES WEST (x≤-680)
  Bookshelf left:      x=-680, y=-570,-430,-290,-150 (single column)
  Bookshelf right:     x=-880, y=-570,-430,-290,-150 (single column)
  Desk between rows:   x=-780, y=-520,-380,-240,-100
  HackTerminal:        x=-820, y=-350
  Tree scatter:        x=-615, y=-370 / x=-625, y=110

ZONE C — COURTYARD SOUTH (y≥580)
  Tree stagger L:  (-750,630),(-650,720),(-550,630),(-450,720)
  Tree stagger R:  (250,630),(350,720),(450,630),(550,720)
  Desk center:     (-160,680),(100,680)
  Vending:         (-55,750),(15,750)
  HackTerminal:    (0, 650)

ZONE D — LECTURE HALLS
  R: bookshelf (720,540),(850,540) + desk (720,720),(850,720) + HackTerminal (750,580)
  L: bookshelf (-900,540),(-1030,540) + desk (-900,720),(-1030,720)

CENTER COVER (r=300-400)
  Server:       (-370,-100),(310,90)
  Vending:      (-100,310)
  DataPillar:   (60,-330)
  PowerNode:    (0, 0)

INTERACTIVE (ใหม่ Session 2)
  MedStation:   (-370,200),(310,-200)
  AmmoCrate:    (540,-50),(-570,-50),(-200,420),(160,420)
  PowerNode:    (0,0),(830,-490),(-850,-490)
  HackTerminal: (820,-350),(-820,-350),(0,650),(750,580)

BARRELS (tactical chokepoints)
  (820,-220),(820,80),(-840,-220),(-840,80)
  (560,-50),(-580,-50)
  (-225,440),(165,440)
  (-280,-180),(250,180)
  (700,520),(-870,520)
```

---

## 🔄 Session Handoff Checklist

### ก่อนส่ง output ของแต่ละ Session
```
Session 1 output:
  [ ] map.js — generateCampusMap() แก้ครบ
  [ ] console.log ยืนยัน object count ≤ 80
  [ ] ไม่มี syntax error (ทดสอบ parse ด้วย new Function หรือ browser DevTools)

Session 2 output:
  [ ] map.js — 4 classes ใหม่ + draw helpers + placement
  [ ] game.js — _checkProximityInteractions() + _tickEnvironment() + wave reset
  [ ] WaveManager.js — 1 บรรทัด guard เพิ่ม
  [ ] BalanceConfig.js — BALANCE.interactiveObjects block เพิ่ม
  [ ] window.hackTerminalActive init = false ที่ top of WaveManager.js

Session 3 output:
  [ ] map.js — visual upgrade ครบ + lighting update
  [ ] SystemConfig.js — MAP_CONFIG อัปเดต (ถ้ามีค่าใหม่)
  [ ] ไม่มี Math.random() ใน draw path ใหม่
  [ ] shadowBlur reset = 0 หลังทุก glow effect
```

---

## 📊 Performance Budget

| System | Budget | เกณฑ์ |
|---|---|---|
| Object count total | ≤ 80 | วัดจาก mapSystem.objects.length |
| New draw calls/frame | ≤ 5 | สำหรับ interactive objects ทั้งหมด |
| New gradient/frame | ≤ 2 | createRadialGradient/createLinearGradient |
| Light sources total | ≤ 16 | รวม existing + ใหม่ (drawLighting budget) |
| String alloc in draw | 0 | ห้าม template literal ใน hot path |
| GC alloc in update | 0 | ห้าม new Array/Object ใน ticking objects |

---

## 🚨 Known Gotchas & Anti-Patterns

```
1. MapObject.draw() uses CTX (global) — ไม่ใช่ ctx parameter
   draw helpers เช่น drawDesk(w,h) ใช้ CTX โดยตรง ✅

2. drawLighting() runs on _lightCtx ไม่ใช่ CTX
   punchLight() ใช้ lctx ที่ bind ใน closure ✅

3. Interactive object update ต้องอยู่ใน updateGame() ไม่ใช่ draw()
   → เพิ่มใน _tickEnvironment(dt) หรือ function แยก

4. ห้ามใช้ keys.e ใน update() ของ MapObject โดยตรง
   → input อ่านได้เฉพาะใน game.js

5. PowerNode damageBoost multiplication ต้อง guard:
   ถ้า player.damageBoost undefined → default 1.0 ก่อน multiply

6. HackTerminal isActive flag ต้อง reset ถ้า wave จบและ timer ยังค้าง:
   เพิ่มใน wave reset hook: window.hackTerminalActive = false

7. ExplosiveBarrel extends MapObject และมี instanceof check ใน game.js
   → interactive objects ใหม่ต้อง extends MapObject ด้วย
   → ใช้ this.type string check ใน game.js (ไม่ใช่ instanceof) เพื่อความยืดหยุ่น

8. เพิ่ม case ใน MapObject.draw() switch สำหรับทุก type ใหม่:
   case 'hackterminal': drawHackTerminal(this.w, this.h); break;
   case 'medstation':   drawMedStation(this.w, this.h); break;
   case 'ammocrate':    drawAmmoCrate(this.w, this.h); break;
   case 'powernode':    drawPowerNode(this.w, this.h, this._playerWasInside); break;

9. checkCollision() ใน MapObject ทำงานอัตโนมัติตาม AABB (x,y,w,h)
   → interactive objects ใหม่ไม่ต้อง override เว้นแต่จะทำให้ walkthrough ได้
   PowerNode: ขนาดเล็ก (30×80) → collision จะ block ศัตรู (OK — เป็น pillar)
   AmmoCrate (45×45): มี collision → วางในที่ไม่ block main path

10. ถ้า Session รันบน Claude.ai (ไม่ใช่ Trae) → output เป็น search/replace blocks เท่านั้น
    ห้าม output full file เพราะ map.js ยาว 1879+ บรรทัด
```

---

*MAP_REFACTOR_PLAN.md | MTC The Game v3.39.4+ | อัปเดตตาม codebase เมื่อ architecture เปลี่ยน*
