---
description: Pre-commit encoding check for Thai text and Unicode
---

# Encoding Check Workflow

Run this before every commit to prevent UTF-8 double-encoding issues.

## Quick Check Command

```bash
# Check all JS/CSS/HTML files for encoding corruption
python -c "
import os, re
corrupt = re.compile(r'เธ[\\x80-\\xbf]|เน[\\x80-\\xbf]|๐[\\x90-\\xbf][\\x80-\\xbf]')
files = [f for f in os.popen('git diff --name-only HEAD').read().split('\\n') if f.endswith(('.js', '.css', '.html'))]
for f in files:
    if os.path.exists(f):
        with open(f, 'rb') as file:
            content = file.read().decode('utf-8', errors='replace')
        matches = corrupt.findall(content)
        if matches:
            print(f'✗ {f}: {len(matches)} corruption patterns')
            exit(1)
print('✓ All files clean')
"
```

## Git Pre-Commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Prevent UTF-8 encoding corruption

echo "Checking file encodings..."

python3 << 'PYTHON'
import os, re, sys

corruption_pattern = re.compile(r'เธ[\x80-\xbf]|เน[\x80-\xbf]|๐[\x90-\xbf][\x80-\xbf]')

staged_files = os.popen('git diff --cached --name-only --diff-filter=ACM').read().strip().split('\n')
files_to_check = [f for f in staged_files if f.endswith(('.js', '.css', '.html', '.md'))]

has_error = False
for filepath in files_to_check:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'rb') as f:
        content = f.read().decode('utf-8', errors='replace')
    
    matches = corruption_pattern.findall(content)
    if matches:
        print(f'✗ {filepath}: UTF-8 corruption detected!')
        print(f'   Patterns: {set(matches[:5])}')
        has_error = True

if has_error:
    print('\n❌ COMMIT BLOCKED: Encoding corruption found!')
    print('   Fix with: python scripts/fix_encoding.py')
    sys.exit(1)
else:
    print('✓ Encoding check passed')
    sys.exit(0)
PYTHON
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

## IDE Configuration

### VS Code / Windsurf Settings

Add to `.vscode/settings.json`:

```json
{
  "files.encoding": "utf8",
  "files.autoGuessEncoding": false,
  "editor.defaultFormatter": null,
  "[javascript]": {
    "files.encoding": "utf8"
  },
  "[css]": {
    "files.encoding": "utf8"
  },
  "[html]": {
    "files.encoding": "utf8"
  }
}
```

### EditorConfig

Create `.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{js,css,html}]
indent_style = space
indent_size = 4
charset = utf-8
```

## Safe File Migration Checklist

When splitting/combining files:

- [ ] อ่านไฟล์ต้นฉบับด้วย UTF-8 encoding เท่านั้น
- [ ] ไม่ใช้ copy-paste ผ่าน clipboard (อาจมี encoding ปัญหา)
- [ ] ใช้ byte-level copy หรือ Python script เข้าอย่างจงใจ
- [ ] ตรวจสอบทันทีหลัง migrate: `python scripts/check_encoding.py`
- [ ] ตรวจสอบ Thai text 3-5 ตำแหน่งแบบสุ่ม

## Recovery Script

หากเกิดปัญหา ใช้ script นี้:

```bash
# Restore from git backup
python scripts/restore_clean_encoding.py --source=42b705a --files=js/balance.js,js/game-texts.js,js/shop-items.js
```
