---
description: Auto-sync version from sw.js to all documentation
---

# Version Sync Workflow

## 🎯 Goal

แก้เวอร์ชันแค่ใน `sw.js` ที่เดียว แล้ว sync ไปยังไฟล์อื่นๆ อัตโนมัติ

## Single Source of Truth

```
sw.js (CACHE_NAME)
       │
       ├──► CHANGELOG.md (auto-add entry)
       │
       ├──► PROJECT_OVERVIEW.md (auto-update)
       │
       └──► VersionManager.js (runtime via postMessage)
```

## Usage

### 1. Update Version (Manual)

Edit `sw.js` line 1:

```javascript
const CACHE_NAME = "mtc-cache-v3.42.2"; // Bug fix: encoding corruption
```

### 2. Sync to Documentation (Auto)

```bash
# Sync version to all docs
python scripts/version-sync.py

# Preview only (no changes)
python scripts/version-sync.py --dry-run

# Override version
python scripts/version-sync.py --version=3.42.2
```

### 3. Commit All Changes

```bash
git add sw.js
git add Markdown Source/CHANGELOG.md

git add Markdown Source/Information/PROJECT_OVERVIEW.md
git commit -m "v3.42.2: Bug fix encoding corruption"
```

## Pre-Commit Auto-Sync

Pre-commit hook จะ sync อัตโนมัติถ้า sw.js เปลี่ยน:

```bash
# .git/hooks/pre-commit (already installed)
python scripts/version-sync.py --staged
```

## Version Format

```
v{MAJOR}.{MINOR}.{PATCH}

Examples:
- v3.42.1 → v3.42.2 (patch - bug fix)
- v3.42.9 → v3.43.0 (minor - new feature)
- v3.99.9 → v4.0.0 (major - breaking change)
```

## Memory Aid

> **"แก้ sw.js จบ ที่เหลือ script จัดการ"**

1. แก้ `CACHE_NAME` ใน `sw.js`
2. รัน `python scripts/version-sync.py`
3. Commit ทั้งหมด
