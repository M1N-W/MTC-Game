Analyze all unstaged and changed files in the current workspace. Then, perform the following tasks sequentially:

***

## STEP 1: UPDATE DOCUMENTATION (ONLY if relevant files changed)

Check changes against these rules. Update only the sections listed — nothing else.

### PROJECT\_OVERVIEW\.md

Examples: 

| เงื่อนไข                                               | Section ที่แก้       |
| ------------------------------------------------------ | -------------------- |
| ไฟล์ใหม่ถูกเพิ่ม / ไฟล์เดิมถูกลบ                       | File Structure table |
| Wave schedule ใน `WaveManager.js` เปลี่ยน              | Wave Events table    |
| Room bounds / BossBase spawn guard ใน `map.js` เปลี่ยน | MTC Room section     |
| Architecture pattern ใหม่เกิดขึ้น                      | Architecture section |

⛔ **ห้ามแตะเด็ดขาด:**

- `Recent Changes` section — change log อยู่ใน `Markdown Source/CHANGELOG.md` เท่านั้น
- numeric stats, HP, damage, cooldowns, ranges ใด ๆ
- config key values (ของอยู่ใน `js/config.js` เท่านั้น)
- Character Quick-Stats, Base Stats, Heat Tier multipliers
- Muzzle offset px values ยกเว้น `shootSingle()` pixel geometry เปลี่ยนจริง

### SKILL.md (mtc-game-conventions)

Examples: 

| เงื่อนไข                                                               | Section ที่แก้                  |
| ---------------------------------------------------------------------- | ------------------------------- |
| Constructor / alias ใหม่                                               | §2 Class Name Map               |
| `extends` chain เปลี่ยน                                                | §3 Inheritance Chain            |
| `UtilityAI`, `SquadAI`, `PlayerPatternAnalyzer` API เปลี่ยน            | §4 AI method names / load order |
| `vx/vy`, `stats.moveSpeed`, หรือ `StatusEffect` timing เปลี่ยน         | §5 Critical Property Rules      |
| `shootSingle()` offsets ใน `weapons.js` เปลี่ยน                        | §8 Muzzle Offsets table         |
| Poom input routing / WeaponSystem bypass เปลี่ยน                       | §10 Poom Special Cases          |
| Heat tier **NAMES** หรือ Q/Wanchai **BEHAVIOR** เปลี่ยน (ไม่ใช่ตัวเลข) | §11 AutoPlayer Heat Tier        |
| ไฟล์ใหม่หรือ script load order เพิ่ม                                   | §13 New Content checklist       |

### mtc-rendering.skill (Rendering Conventions)

Exam

| เงื่อนไข                                                                     | Section ที่แก้               |
| ---------------------------------------------------------------------------- | ---------------------------- |
| มีการเปลี่ยน Canvas context flow (เช่น `ctx.save()` / `ctx.restore()` block) | Core Rendering Loop          |
| มีการแก้ Layering หรือลำดับการวาดใน `PlayerRenderer.js` / `BossRenderer.js`  | Z-Index & Layering           |
| เพิ่ม/ลบ Object Pooling logic สำหรับ Visual Effects ใน `effects.js`          | Performance & Particle GC    |
| เปลี่ยนวิธีการ Caching (เช่น การใช้ `OffscreenCanvas`)                       | Rendering Decoupling / Cache |

***

## STEP 2: BUMP VERSION

1. เพิ่ม version ใน `sw.js` (CACHE\_NAME) ตาม Version Increment Criteria ใน PROJECT\_OVERVIEW\.md
2. เพิ่ม entry ใหม่ใน `Markdown Source/CHANGELOG.md` พร้อม detail ของการเปลี่ยนแปลงทั้งหมด
3. ตรวจว่าเลขใน `sw.js` และ `Markdown Source/CHANGELOG.md` ตรงกัน

⚠️ **Version bump ownership:**

- Claude/AI Agent (code / analysis / chat) → ❌ ไม่แตะเลขเวอร์ชันเด็ดขาด
  - เหตุผล: ป้องกันการ Desync ระหว่างไฟล์จากปัญหา Token/Session หมด
- IDE (Windsurf / Cursor / Roo Code / Trae/ Antigravity) commit time → ✅ bump ทุกไฟล์ในครั้งเดียว

***

## STEP 3: COMMIT AND PUSH

Generate a detailed and professional git commit message based on all changed files.

Format: <type>(<scope>): <short summary>

<body — bullet list of key changes>

Files changed: <comma-separated list>

Then execute in terminal:
git add .
git commit -m "\[Your generated commit message]"
git push
