#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Restore Clean Encoding from Git History
Extracts clean UTF-8 content from a known-good git commit

Usage:
    python scripts/restore_clean_encoding.py --commit=42b705a --files=js/balance.js,js/game-texts.js
    python scripts/restore_clean_encoding.py --auto  # Auto-detect and fix corrupted files
"""

import os
import re
import sys
import subprocess
import argparse
from pathlib import Path


def get_git_content(commit, filepath):
    """Get file content from a specific git commit"""
    try:
        result = subprocess.run(
            ['git', 'show', f'{commit}:{filepath}'],
            capture_output=True, check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"✗ Error reading {filepath} from {commit}: {e}")
        return None


def extract_section(config_text, section_name, start_marker):
    """Extract a section from config.js content"""
    pattern = rf'{re.escape(start_marker)}\s*[=:]\s*(\{{|\[)'
    match = re.search(pattern, config_text)
    if not match:
        return None
    
    start_char = match.group(1)
    start_pos = match.end() - 1
    
    # Count braces/brackets to find matching end
    count = 1
    pos = start_pos + 1
    while count > 0 and pos < len(config_text):
        if config_text[pos] == start_char:
            count += 1
        elif (start_char == '{' and config_text[pos] == '}') or \
             (start_char == '[' and config_text[pos] == ']'):
            count -= 1
        pos += 1
    
    return config_text[match.start():pos]


def fix_file_from_git(filepath, commit='42b705a'):
    """Fix a single file using clean version from git"""
    print(f"\nFixing: {filepath}")
    
    # Get clean content from git
    content = get_git_content(commit, filepath)
    if content is None:
        return False
    
    # Check if it's a new file (doesn't exist in old commit)
    if content == b'':
        print(f"  ⚠ File didn't exist in {commit}, may need manual fix")
        return False
    
    try:
        # Try to decode as UTF-8
        text = content.decode('utf-8')
    except UnicodeDecodeError:
        text = content.decode('utf-8', errors='replace')
        print(f"  ⚠ Had decode errors, using replacement characters")
    
    # Check for corruption in the extracted content
    corrupt_pattern = re.compile(r'เธ[\x80-\xbf]|เน[\x80-\xbf]')
    if corrupt_pattern.search(text):
        print(f"  ⚠ Even the old commit has corruption - need earlier commit")
        return False
    
    # Backup current file
    backup_path = f"{filepath}.backup"
    if os.path.exists(filepath) and not os.path.exists(backup_path):
        os.rename(filepath, backup_path)
        print(f"  Created backup: {backup_path}")
    
    # Write clean content
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)
    
    print(f"  ✓ Fixed with clean UTF-8 encoding")
    return True


def fix_split_files(commit='42b705a'):
    """Fix files that were split from config.js"""
    # Get old config.js
    config_bytes = get_git_content(commit, 'js/config.js')
    if config_bytes is None:
        print("✗ Could not read old config.js")
        return False
    
    try:
        config_text = config_bytes.decode('utf-8')
    except UnicodeDecodeError:
        config_text = config_bytes.decode('utf-8', errors='replace')
    
    fixes = [
        ('js/balance.js', [
            ('WAVE_SCHEDULE', r'const WAVE_SCHEDULE'),
            ('BALANCE', r'const BALANCE'),
            ('GAME_CONFIG', r'const GAME_CONFIG'),
            ('VISUALS', r'const VISUALS'),
            ('ACHIEVEMENT_DEFS', r'const ACHIEVEMENT_DEFS'),
            ('MAP_CONFIG', r'const MAP_CONFIG'),
        ]),
        ('js/shop-items.js', [
            ('SHOP_ITEMS', r'const SHOP_ITEMS'),
        ]),
        ('js/game-texts.js', [
            ('TEXTS', r'(?:const|var)?\s*TEXTS\s*[=:]\s*\{'),
        ]),
    ]
    
    success = True
    for filepath, sections in fixes:
        print(f"\nBuilding {filepath} from config.js sections...")
        
        extracted = []
        for section_name, pattern in sections:
            section = extract_section(config_text, section_name, pattern)
            if section:
                extracted.append(section)
                print(f"  ✓ Extracted {section_name}")
            else:
                print(f"  ✗ Could not find {section_name}")
        
        if not extracted:
            print(f"  ✗ No sections extracted")
            success = False
            continue
        
        # Build new content
        header = f"'use strict';\n/**\n * {filepath}\n * Auto-extracted from config.js (commit {commit})\n */\n\n"
        body = '\n\n'.join(extracted)
        footer = f"\n\nwindow.{sections[0][0]} = {sections[0][0]};\n"
        
        # Backup and write
        backup_path = f"{filepath}.backup"
        if os.path.exists(filepath) and not os.path.exists(backup_path):
            os.rename(filepath, backup_path)
            print(f"  Created backup: {backup_path}")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(header + body + footer)
        
        print(f"  ✓ Written {filepath}")
    
    return success


def main():
    parser = argparse.ArgumentParser(
        description='Restore clean UTF-8 encoding from git history'
    )
    parser.add_argument(
        '--commit', 
        default='42b705a',
        help='Git commit hash with clean encoding (default: 42b705a)'
    )
    parser.add_argument(
        '--files',
        help='Comma-separated list of files to fix'
    )
    parser.add_argument(
        '--auto',
        action='store_true',
        help='Auto-detect corrupted files and fix them'
    )
    parser.add_argument(
        '--split-files',
        action='store_true',
        help='Fix files split from config.js (balance.js, shop-items.js, game-texts.js)'
    )
    
    args = parser.parse_args()
    
    if args.split_files:
        success = fix_split_files(args.commit)
        sys.exit(0 if success else 1)
    
    if args.files:
        files = [f.strip() for f in args.files.split(',')]
        success = True
        for f in files:
            if not fix_file_from_git(f, args.commit):
                success = False
        sys.exit(0 if success else 1)
    
    if args.auto:
        print("Auto-detection not implemented - use --files or --split-files")
        sys.exit(1)
    
    parser.print_help()


if __name__ == '__main__':
    main()
