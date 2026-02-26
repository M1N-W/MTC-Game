#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Fix syntax errors - remove all orphaned code after addSpeedBoost"""

file_path = r'c:\Mawin-Game\MTC-Game\js\entities\player\PoomPlayer.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the line with addSpeedBoost
new_lines = []
found_speed_boost = False
skip_orphaned = False

for i, line in enumerate(lines):
    if 'addSpeedBoost()' in line and 'speedBoostTimer' in line:
        new_lines.append(line)
        found_speed_boost = True
        skip_orphaned = True
        continue
    
    # After addSpeedBoost, skip until we find applyStickyTo method
    if skip_orphaned:
        if 'applyStickyTo(enemy)' in line:
            skip_orphaned = False
            # Add proper spacing before the method
            new_lines.append('\n')
            new_lines.append('    // ════════════════════════════════════════════════════════════\n')
            new_lines.append('    // 🌾 SESSION B: STICKY ADAPTER - Bridge to StatusEffect Framework\n')
            new_lines.append('    // ════════════════════════════════════════════════════════════\n')
            new_lines.append('\n')
            new_lines.append('    /**\n')
            new_lines.append('     * Apply sticky status effect to enemy using new StatusEffect framework\n')
            new_lines.append('     * This is the adapter method that bridges old system to new framework\n')
            new_lines.append('     * @param {object} enemy - Enemy instance\n')
            new_lines.append('     */\n')
            new_lines.append(line)
        continue
    
    new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('✓ Removed orphaned code and fixed syntax')
