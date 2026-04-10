#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Version Sync System for MTC Game

Reads version from sw.js (single source of truth) and syncs to:
- CHANGELOG.md (adds new version entry if missing)
- PROJECT_OVERVIEW.md (updates version reference)

Usage:
    python scripts/version-sync.py              # Auto-sync all files
    python scripts/version-sync.py --dry-run    # Preview changes only
    python scripts/version-sync.py --version=3.42.2  # Use specific version
"""

import os
import re
import sys
import argparse
from datetime import datetime
from pathlib import Path


def get_version_from_swjs(sw_path='sw.js'):
    """Extract version from sw.js CACHE_NAME"""
    with open(sw_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Match patterns like: const CACHE_NAME = "mtc-cache-v3.42.1"
    match = re.search(r'["\']mtc-cache-v([\d.]+)["\']', content)
    if match:
        return match.group(1)
    
    # Alternative pattern
    match = re.search(r'CACHE_NAME.*?v([\d.]+)', content)
    if match:
        return match.group(1)
    
    raise ValueError(f"Could not find version in {sw_path}")


def get_comment_from_swjs(sw_path='sw.js'):
    """Extract version comment from sw.js"""
    with open(sw_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    if lines:
        # Get comment from first line after version declaration
        first_line = lines[0]
        match = re.search(r'//\s*(.+)', first_line)
        if match:
            return match.group(1).strip()
    
    return "Version update"


def update_changelog(version, comment, changelog_path='Markdown Source/CHANGELOG.md', dry_run=False):
    """Add new version entry to CHANGELOG.md if not exists"""
    with open(changelog_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if version already exists
    version_header = f"## v{version}"
    if version_header in content:
        print(f"  ℹ CHANGELOG.md already has v{version}")
        return False
    
    # Create new entry
    today = datetime.now().strftime("%B %d, %Y")
    new_entry = f"""## v{version} — {comment}
*Released: {today}*

### 🐛 Bug Fixes
- Fixed UTF-8 encoding corruption in Thai text and emojis across game files.
- Restored proper character encoding from git history.

---

"""
    
    # Insert after the header (before first ## v)
    lines = content.split('\n')
    header_end = 0
    for i, line in enumerate(lines):
        if line.startswith('## v'):
            header_end = i
            break
    
    new_lines = lines[:header_end] + [new_entry] + lines[header_end:]
    new_content = '\n'.join(new_lines)
    
    if dry_run:
        print(f"  [DRY-RUN] Would add v{version} to CHANGELOG.md")
        return True
    
    # Backup
    backup_path = f"{changelog_path}.backup"
    if not os.path.exists(backup_path):
        os.rename(changelog_path, backup_path)
        print(f"  Created backup: {backup_path}")
    
    with open(changelog_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"  ✓ Added v{version} to CHANGELOG.md")
    return True


def update_project_overview(version, po_path='Markdown Source/Information/PROJECT_OVERVIEW.md', dry_run=False):
    """Update version reference in PROJECT_OVERVIEW.md"""
    with open(po_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find and replace version in the header
    old_pattern = r'(`mtc-cache-v[\d.]+`)'
    match = re.search(old_pattern, content)
    
    if not match:
        print(f"  ⚠ Could not find version pattern in {po_path}")
        return False
    
    old_version_str = match.group(1)
    new_version_str = f'`mtc-cache-v{version}`'
    
    if old_version_str == new_version_str:
        print(f"  ℹ PROJECT_OVERVIEW.md already has v{version}")
        return False
    
    new_content = content.replace(old_version_str, new_version_str)
    
    if dry_run:
        print(f"  [DRY-RUN] Would update version in PROJECT_OVERVIEW.md")
        return True
    
    # Backup
    backup_path = f"{po_path}.backup"
    if not os.path.exists(backup_path):
        os.rename(po_path, backup_path)
        print(f"  Created backup: {backup_path}")
    
    with open(po_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"  ✓ Updated version in PROJECT_OVERVIEW.md")
    return True


def main():
    parser = argparse.ArgumentParser(
        description='Sync version from sw.js to all documentation'
    )
    parser.add_argument(
        '--version',
        help='Override version (default: read from sw.js)'
    )
    parser.add_argument(
        '--comment',
        help='Override comment (default: read from sw.js)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without applying'
    )
    
    args = parser.parse_args()
    
    # Get version from sw.js or args
    try:
        version = args.version or get_version_from_swjs()
        print(f"📦 Version: v{version}")
    except ValueError as e:
        print(f"✗ Error: {e}")
        sys.exit(1)
    
    # Get comment
    comment = args.comment or get_comment_from_swjs() or "Version update"
    print(f"📝 Comment: {comment}")
    
    print("\n" + "="*60)
    
    # Update files
    changed = False
    
    print(f"\n1. Updating CHANGELOG.md...")
    if update_changelog(version, comment, dry_run=args.dry_run):
        changed = True
    
    print(f"\n2. Updating PROJECT_OVERVIEW.md...")
    if update_project_overview(version, dry_run=args.dry_run):
        changed = True
    
    print("\n" + "="*60)
    
    if args.dry_run:
        print("🏃 DRY-RUN: No changes were made")
    elif changed:
        print("✅ Version synced successfully!")
        print("\nNext steps:")
        print("  1. Review the changes")
        print("  2. git add Markdown Source/CHANGELOG.md")
        print("  3. git add Markdown Source/Information/PROJECT_OVERVIEW.md")
        print("  4. git commit -m 'v{version}: Version sync'")
    else:
        print("ℹ All files already up to date")
    
    return 0 if not args.dry_run else 0


if __name__ == '__main__':
    sys.exit(main())
