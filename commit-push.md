Analyze all unstaged and changed files in the current workspace. Then, perform the following tasks sequentially:

---

## STEP 1: UPDATE DOCUMENTATION (ONLY if relevant files changed)

Check changes against these rules. Update only the sections listed — nothing else.

### PROJECT_OVERVIEW.md

| เงื่อนไข | Section ที่แก้ |
| --- | --- |
| ไฟล์ใหม่ถูกเพิ่ม / ไฟล์เดิมถูกลบ | File Structure table |
| Wave schedule ใน `WaveManager.js` เปลี่ยน | Wave Events table |
| Room bounds / BossBase spawn guard ใน `map.js` เปลี่ยน | MTC Room section |
| Architecture pattern ใหม่เกิดขึ้น | Architecture section |

⛔ **ห้ามแตะเด็ดขาด:**
- `Recent Changes` section — change log อยู่ใน `CHANGELOG.md` เท่านั้น
- numeric stats, HP, damage, cooldowns, ranges ใด ๆ
- config key values (ของอยู่ใน `config.js` เท่านั้น)
- Character Quick-Stats, Base Stats, Heat Tier multipliers
- Muzzle offset px values ยกเว้น `shootSingle()` pixel geometry เปลี่ยนจริง

### SKILL.md (mtc-game-conventions)

| เงื่อนไข | Section ที่แก้ |
| --- | --- |
| Constructor / alias ใหม่ | §2 Class Name Map |
| `extends` chain เปลี่ยน | §3 Inheritance Chain |
| `UtilityAI`, `SquadAI`, `PlayerPatternAnalyzer` API เปลี่ยน | §4 AI method names / load order |
| `vx/vy`, `stats.moveSpeed`, หรือ `StatusEffect` timing เปลี่ยน | §5 Critical Property Rules |
| `shootSingle()` offsets ใน `weapons.js` เปลี่ยน | §8 Muzzle Offsets table |
| Poom input routing / WeaponSystem bypass เปลี่ยน | §10 Poom Special Cases |
| Heat tier **NAMES** หรือ Q/Wanchai **BEHAVIOR** เปลี่ยน (ไม่ใช่ตัวเลข) | §11 AutoPlayer Heat Tier |
| ไฟล์ใหม่หรือ script load order เพิ่ม | §13 New Content checklist |

---

## STEP 2: BUMP VERSION

1. เพิ่ม version ใน `sw.js` (CACHE_NAME) ตาม Version Increment Criteria ใน PROJECT_OVERVIEW.md
2. เพิ่ม entry ใหม่ใน `CHANGELOG.md` พร้อม detail ของการเปลี่ยนแปลงทั้งหมด
3. ตรวจว่าเลขใน `sw.js` และ `CHANGELOG.md` ตรงกัน

⚠️ **Version bump ownership:**
- Claude (code / analysis / chat) → ❌ ไม่แตะเลขเวอร์ชันเด็ดขาด
  - เหตุผล: Claude ใช้ free plan — อาจ session หมดกลางคัน + ขึ้นแชทใหม่บ่อย → ถ้า Claude bump แล้ว IDE bump อีกรอบ เวอร์ชันใน `sw.js` / `CHANGELOG.md` / `PROJECT_OVERVIEW.md` จะ desync
- IDE (Windsurf / Cursor / Antigravity / อื่นๆ) commit time → ✅ bump ทุกไฟล์ในครั้งเดียว

---

## STEP 3: COMMIT AND PUSH

Generate a detailed and professional git commit message based on all changed files.

Format:
```
<type>(<scope>): <short summary>

<body — bullet list of key changes>

Files changed: <comma-separated list>
```

Then execute in terminal:
```
git add .
git commit -m "[Your generated commit message]"
git push
```