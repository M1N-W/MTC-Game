#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Encoding Check Script for MTC Game
Prevents UTF-8 double-encoding issues from being committed

Usage:
    python scripts/check_encoding.py [file1.js file2.js ...]
    python scripts/check_encoding.py --all
    python scripts/check_encoding.py --staged
"""

import os
import re
import sys
import subprocess
from pathlib import Path

# UTF-8 double-encoding corruption patterns
CORRUPTION_PATTERNS = [
    (re.compile(r'เธ[\x80-\xbf]'), 'Thai char to + continuation bytes'),
    (re.compile(r'เน[\x80-\xbf]'), 'Thai char e + continuation bytes'),
    (re.compile(r'๐[\x90-\xbf][\x80-\xbf]'), 'Emoji corruption pattern'),
    (re.compile(r'Ÿ[\x80-\xbf]'), 'Latin corruption y'),
    (re.compile(r'Â[\x80-\xbf]'), 'Latin corruption A'),
]

# Files to check by default
DEFAULT_PATTERNS = ['**/*.js', '**/*.css', '**/*.html', '**/*.md']


def check_file(filepath):
    """Check a single file for encoding corruption"""
    try:
        with open(filepath, 'rb') as f:
            content_bytes = f.read()
    except Exception as e:
        return [(f"Cannot read file: {e}", 0, '')]
    
    # Decode as UTF-8
    try:
        content = content_bytes.decode('utf-8')
    except UnicodeDecodeError:
        # Try with replacement
        content = content_bytes.decode('utf-8', errors='replace')
    
    issues = []
    
    for pattern, description in CORRUPTION_PATTERNS:
        matches = list(pattern.finditer(content))
        for match in matches:
            # Get line number
            line_num = content[:match.start()].count('\n') + 1
            # Get context
            start = max(0, match.start() - 30)
            end = min(len(content), match.end() + 30)
            context = content[start:end].replace('\n', ' ')
            issues.append((description, line_num, context, match.group()))
    
    return issues


def get_git_root():
    """Find git root directory"""
    try:
        result = subprocess.run(
            ['git', 'rev-parse', '--show-toplevel'],
            capture_output=True, text=True, check=True
        )
        return result.stdout.strip()
    except:
        return os.getcwd()


def get_staged_files():
    """Get list of staged files from git"""
    try:
        result = subprocess.run(
            ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACM'],
            capture_output=True, text=True, check=True
        )
        return result.stdout.strip().split('\n') if result.stdout.strip() else []
    except:
        return []


def get_all_source_files(root_dir):
    """Get all source files matching patterns"""
    files = []
    for pattern in DEFAULT_PATTERNS:
        files.extend(Path(root_dir).glob(pattern))
    return [str(f) for f in files if f.is_file()]


def main():
    root_dir = get_git_root()
    os.chdir(root_dir)
    
    # Determine which files to check
    if len(sys.argv) > 1:
        if sys.argv[1] == '--all':
            files_to_check = get_all_source_files(root_dir)
        elif sys.argv[1] == '--staged':
            files_to_check = get_staged_files()
        elif sys.argv[1] == '--help':
            print(__doc__)
            sys.exit(0)
        else:
            files_to_check = sys.argv[1:]
    else:
        # Default: check staged files if any, otherwise check all
        staged = get_staged_files()
        if staged:
            files_to_check = staged
        else:
            files_to_check = get_all_source_files(root_dir)
    
    # Filter to only relevant extensions
    extensions = ('.js', '.css', '.html', '.md', '.json')
    files_to_check = [f for f in files_to_check if f.endswith(extensions)]
    
    if not files_to_check:
        print("No files to check")
        sys.exit(0)
    
    print(f"Checking {len(files_to_check)} file(s)...")
    print("=" * 70)
    
    total_issues = 0
    files_with_issues = []
    
    for filepath in files_to_check:
        if not os.path.exists(filepath):
            continue
        
        issues = check_file(filepath)
        
        if issues:
            files_with_issues.append(filepath)
            print(f"\n✗ {filepath}")
            for desc, line_num, context, match in issues[:5]:  # Show first 5 issues
                print(f"  Line {line_num}: {desc}")
                print(f"    Context: ...{context}...")
                print(f"    Match: {repr(match)}")
            if len(issues) > 5:
                print(f"  ... and {len(issues) - 5} more issues")
            total_issues += len(issues)
        else:
            print(f"✓ {filepath}")
    
    print("\n" + "=" * 70)
    
    if total_issues > 0:
        print(f"❌ FOUND {total_issues} ENCODING ISSUE(S) in {len(files_with_issues)} file(s)")
        print("\nTo fix:")
        print("  1. Restore from git: git checkout HEAD -- <file>")
        print("  2. Or restore from old commit: python scripts/restore_clean_encoding.py")
        sys.exit(1)
    else:
        print("✅ ALL FILES CLEAN - No UTF-8 encoding corruption detected!")
        sys.exit(0)


if __name__ == '__main__':
    main()
