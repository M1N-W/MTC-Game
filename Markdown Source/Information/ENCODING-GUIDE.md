# 🔤 UTF-8 Encoding Guide for MTC Game

## ⚠️ The Problem

### What Happened in Commit 7395dc5

During the refactoring that split `js/config.js` into separate files (`balance.js`, `shop-items.js`, `game-texts.js`), **UTF-8 double-encoding corruption** occurred:

```
Original Thai text: "คะแนน" (correct UTF-8)
    ↓ (misinterpreted as Latin-1/Windows-1252)
Corrupted: "เธเธฐเนเธเธ..." (mojibake)
```

### Technical Explanation

1. **UTF-8** encodes Thai characters as multi-byte sequences (e.g., "ค" = `0xE0B884`)
2. **Latin-1** (Windows-1252) is a single-byte encoding
3. When UTF-8 bytes are read as Latin-1, each byte becomes a separate character
4. Re-encoding as UTF-8 creates **irreversible corruption** (mojibake)

### Visual Example

| Stage | Bytes | Display |
|-------|-------|---------|
| Correct UTF-8 | `E0 B8 84` | "ค" |
| Read as Latin-1 | `E0`→à, `B8`→¸, `84`→„ | "à¸„" |
| Re-encoded to UTF-8 | `C3 A0 C2 B8 C2 84` | "เธ" |

## 🛡️ Prevention System

### 1. Pre-Commit Hook (Automatic)

A git hook has been installed that blocks commits with encoding corruption:

```bash
# The hook is at: .git/hooks/pre-commit
# It runs automatically before every commit
```

**What it does:**
- Checks all staged JS/CSS/HTML files
- Detects UTF-8 corruption patterns
- Blocks the commit if corruption found
- Suggests fix commands

### 2. Manual Check Script

```bash
# Check specific files
python scripts/check_encoding.py js/game-texts.js js/shop-items.js

# Check all source files
python scripts/check_encoding.py --all

# Check only staged files (for pre-commit)
python scripts/check_encoding.py --staged
```

### 3. Restore from Clean Git History

If corruption is detected:

```bash
# Restore specific file from last good commit
python scripts/restore_clean_encoding.py --files=js/game-texts.js

# Fix all split config files
python scripts/restore_clean_encoding.py --split-files

# Use different commit if needed
python scripts/restore_clean_encoding.py --commit=abc1234 --files=js/balance.js
```

## ⚙️ Editor Configuration

### EditorConfig (Recommended)

The `.editorconfig` file enforces UTF-8 encoding in supported editors:

```ini
[*.{js,css,html}]
charset = utf-8
```

**VS Code:** Install "EditorConfig" extension  
**JetBrains IDEs:** Built-in support  
**Vim:** Install `editorconfig-vim` plugin

### VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "files.encoding": "utf8",
  "files.autoGuessEncoding": false,
  "[javascript]": {
    "files.encoding": "utf8"
  }
}
```

### Windows Notepad Users

⚠️ **Notepad has issues with UTF-8.** When saving:
1. Use "Save As"
2. Select "Encoding: UTF-8" (NOT "UTF-8 BOM")
3. Or better: Use VS Code, Notepad++, or Sublime Text

## 📋 Safe Workflow for File Migration

When splitting/combining files with Thai text:

1. **Read files as UTF-8 bytes, not text**
   ```python
   with open('file.js', 'rb') as f:
       content = f.read()
   ```

2. **Write as UTF-8 without BOM**
   ```python
   with open('newfile.js', 'w', encoding='utf-8') as f:
       f.write(content)
   ```

3. **Never copy-paste Thai text through clipboard**
   - Clipboard may convert encoding
   - Use file-level copy or Python scripts

4. **Verify immediately after migration**
   ```bash
   python scripts/check_encoding.py --files=newfile.js
   ```

5. **Check Thai text visually**
   - Open file and verify 3-5 Thai text strings
   - Look for "เธ" or "๐" characters (signs of corruption)

## 🔍 Detection Patterns

### Signs of UTF-8 Corruption

| Corruption Pattern | Example | Meaning |
|-------------------|---------|---------|
| `เธ` followed by high byte | `เธ` | Thai character corruption |
| `เน` followed by high byte | `เน€` | Thai vowel corruption |
| `๐` followed by bytes | `๐Ÿ` | Emoji corruption |
| `Ÿ` or `Â` | `Ÿ˜` | Latin-1 corruption |

### Common Corrupted Sequences

```
คะแนน → เธเธฐเนเธเธ
ไม่พอ → เนเธกเนเธเธ­
เต็มแล้ว → เน€เธ•เน‡เธ¡เนเธฅเน‰เธง
💥 → ๐Ÿ’¥
🛒 → ๐Ÿ›’
```

## 🚨 Emergency Recovery

If you've committed corrupted files:

1. **Don't panic** - git history has clean versions

2. **Find last clean commit**
   ```bash
   git log --oneline -- js/game-texts.js
   # Look for commit before the corruption
   ```

3. **Restore clean version**
   ```bash
   git checkout 42b705a -- js/game-texts.js
   # or
   python scripts/restore_clean_encoding.py --files=js/game-texts.js
   ```

4. **Re-apply your changes** (if any beyond the split)
   - Use diff tools to identify actual changes
   - Manually re-apply to clean file

5. **Commit the fix**
   ```bash
   git add js/game-texts.js
   git commit -m "v3.42.2: Fix UTF-8 encoding corruption"
   ```

## 📚 References

- [UTF-8 on Wikipedia](https://en.wikipedia.org/wiki/UTF-8)
- [Mojibake](https://en.wikipedia.org/wiki/Mojibake)
- [Git hooks documentation](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- [EditorConfig](https://editorconfig.org/)

## ✅ Checklist for Code Reviews

Before approving PRs with Thai text:

- [ ] Thai text displays correctly in diff view
- [ ] No "เธ" or "๐" characters visible in Thai text
- [ ] Emojis render properly (not as gibberish)
- [ ] `scripts/check_encoding.py --all` passes
- [ ] Files are saved as UTF-8 without BOM
