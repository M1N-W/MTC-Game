# 🔄 Auto Version Sync System

## Overview

ระบบอัตโนมัติสำหรับ sync เวอร์ชัน จาก `sw.js` ไปยังเอกสารอื่นๆ

**หลักการ:** แก้ `sw.js` ที่เดียว ที่เหลือ sync อัตโนมัติ

```
sw.js (CACHE_NAME = "mtc-cache-vX.X.X")
    │
    ├──► CHANGELOG.md ──► เพิ่ม entry ใหม่
    │
    ├──► PROJECT_OVERVIEW.md ──► อัพเดท version
    │
    └──► VersionManager.js ──► อ่าน runtime จาก SW
```

## Quick Usage

### 1. Update Version in sw.js

```javascript
// sw.js line 1
const CACHE_NAME = "mtc-cache-v3.42.2"; // Bug fix: encoding corruption
```

### 2. Commit → Auto-Sync

```bash
git add sw.js
git commit -m "v3.42.2: Fixed encoding"

# Pre-commit hook จะ:
# 1. Detect sw.js change
# 2. Auto-sync to CHANGELOG.md
# 3. Auto-sync to PROJECT_OVERVIEW.md
# 4. Auto-stage ไฟล์ที่แก้ไข
```

### 3. Manual Sync (ถ้าต้องการ)

```bash
python scripts/version-sync.py

# Options:
python scripts/version-sync.py --dry-run     # Preview only
python scripts/version-sync.py --version=3.42.2  # Override version
```

## Files Created

| File | Purpose |
|------|---------|
| `scripts/version-sync.py` | Sync script |
| `scripts/check_encoding.py` | Check encoding corruption |
| `scripts/restore_clean_encoding.py` | Restore from git history |
| `.git/hooks/pre-commit` | Auto-run checks + version sync |
| `.editorconfig` | Enforce UTF-8 in editors |
| `.windsurf/workflows/version-sync.md` | Workflow guide |
| `.windsurf/workflows/encoding-check.md` | Encoding check guide |
| `Markdown Source/Information/ENCODING-GUIDE.md` | Full documentation |

## Version Increment Rules

```
PATCH (+0.00.01): Bug fixes, encoding fixes, small tweaks
MINOR (+0.01.00): New features, refactors, new files
MAJOR (+1.00.00): Breaking changes (rarely used)

Examples:
- v3.42.1 → v3.42.2 (this encoding fix)
- v3.42.9 → v3.43.0 (new feature)
```

## Safety Features

1. **Pre-commit hook blocks bad commits:**
   - Encoding corruption detected
   - Must fix before commit allowed

2. **Auto-backups:**
   - `.backup` files created before modification
   - Can restore if something goes wrong

3. **Dry-run mode:**
   - Preview changes before applying
   - Use `--dry-run` flag

## Emergency Recovery

```bash
# Restore from backup
cp js/game-texts.js.backup js/game-texts.js

# Or restore from git
git checkout 42b705a -- js/game-texts.js

# Or use script
python scripts/restore_clean_encoding.py --files=js/game-texts.js
```

## Summary

✅ **แก้ sw.js จบ → ที่เหลือ auto**  
✅ **Pre-commit hook ป้องกัน encoding bug**  
✅ **Backup auto ทุกการแก้ไข**  
✅ **Recovery tools พร้อม**
