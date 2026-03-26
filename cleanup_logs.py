import os

def comment_logs(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple replacement for console.log
    # We want to comment them out, but be careful with existing comments or multiline
    # For this task, we'll just prefix them with // if they are at the start of a line (ignoring whitespace)
    lines = content.splitlines()
    new_lines = []
    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith('console.log('):
            indent = line[:len(line) - len(stripped)]
            new_lines.append(f"{indent}// {stripped}")
        else:
            new_lines.append(line)
    
    with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(new_lines) + '\n')
    print(f"Processed {filepath}")

files = [
    r"c:\Mawin-Game\MTC-Game\js\game.js",
    r"c:\Mawin-Game\MTC-Game\js\audio.js",
    r"c:\Mawin-Game\MTC-Game\js\entities\player\PoomPlayer.js",
    r"c:\Mawin-Game\MTC-Game\js\entities\boss\boss_attacks_first.js",
    r"c:\Mawin-Game\MTC-Game\js\entities\boss\boss_attacks_manop.js",
    r"c:\Mawin-Game\MTC-Game\js\input.js",
    r"c:\Mawin-Game\MTC-Game\js\utils.js",
    r"c:\Mawin-Game\MTC-Game\js\map.js",
    r"c:\Mawin-Game\MTC-Game\js\menu.js",
    r"c:\Mawin-Game\MTC-Game\js\systems\AdminSystem.js"
]

for f in files:
    comment_logs(f)
