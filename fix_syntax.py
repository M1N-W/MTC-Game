#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Fix syntax errors in PoomPlayer.js - remove orphaned code"""

file_path = r'c:\Mawin-Game\MTC-Game\js\entities\player\PoomPlayer.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the entire orphaned section from line 420 onwards
# This is corrupted draw() code that shouldn't be there
orphaned_start = '''    addSpeedBoost() { this.speedBoostTimer = this.stats.speedOnHitDuration; }

    // ════════════════════════════════════════════════════════════
    // 🌾 STICKY RICE STACK SYSTEM
    // ════════════════════════════════════════════════════════════

    /**
     * Update sticky stack expiration using timestamps (not dt accumulation)
     * CONSTRAINT: Must be called once per frame in update()
     * CONSTRAINT: Uses performance.now() for frame-independent behavior
     */
        // ════════════════════════════════════════════════════════════
        // POOM — Anti-Flip v12'''

# Find where SESSION B marker is
session_b_marker = '    // ════════════════════════════════════════════════════════════\n    // 🌾 SESSION B: STICKY ADAPTER'

start_idx = content.find(orphaned_start)
end_idx = content.find(session_b_marker)

if start_idx != -1 and end_idx != -1:
    # Keep everything before the orphaned code and everything from SESSION B onwards
    content = content[:start_idx] + '    addSpeedBoost() { this.speedBoostTimer = this.stats.speedOnHitDuration; }\n\n' + content[end_idx:]
    print(f'Removed orphaned code from {start_idx} to {end_idx}')
else:
    print(f'Markers not found: start={start_idx}, end={end_idx}')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('✓ Fixed syntax errors')
