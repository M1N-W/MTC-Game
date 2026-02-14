# 🎮 MTC: ENHANCED EDITION

## 📁 Modular Structure

```
mtc-enhanced-edition/
├── index.html           Main entry point
└── js/
    ├── config.js       ⚙️ All game balance settings
    ├── utils.js        🛠️ Helper functions
    ├── audio.js        🔊 Sound system (3 weapon sounds)
    ├── weapons.js      🔫 Weapon system (Auto/Sniper/Shotgun)
    ├── map.js          🏫 School map objects
    ├── effects.js      💥 Particles & special effects
    ├── ui.js           📊 Achievements & HUD
    ├── ai.js           🤖 Gemini API (optional)
    ├── entities.js     👾 Player, Enemies, Boss
    └── game.js         🎮 Main game loop
```

## 🚀 Quick Start

### Method 1: Open Directly
```bash
# Just open index.html in browser
open index.html
```

### Method 2: Local Server (recommended for development)
```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server

# Then visit: http://localhost:8000
```

## ⚙️ Configuration

Edit `js/config.js` to change game balance:
- Player stats (HP, speed, damage)
- Enemy stats (HP, spawn rates)
- Boss stats (HP, skills)
- Weapon stats (damage, fire rate)
- Map density

## 🎯 New Features

1. **3 Weapon Types** (Q to switch)
   - Auto Rifle: Fast, balanced
   - Sniper: Slow, high damage (2x)
   - Shotgun: Close range, highest damage (3x)

2. **School Map Theme**
   - Desks, chairs, cabinets
   - Blackboards with equations
   - Collision-enabled objects

3. **Improved Audio**
   - Different sounds per weapon
   - Less harsh, better quality
   - Volume reduced 40%

4. **Fixed Speech Bubble**
   - Now follows boss correctly
   - Proper positioning

5. **Balanced Gameplay**
   - Dash distance reduced
   - Enemy stats rebalanced
   - Fair difficulty curve

6. **New Achievement**
   - Weapon Master (use all 3 weapons)

## 🎮 Controls

**Keyboard:**
- WASD - Move
- Mouse - Aim
- Left Click - Shoot
- Right Click - Stealth
- Space - Dash
- Q - Switch Weapon

**Mobile:**
- Joystick - Move
- Buttons - Shoot/Dash/Stealth

## 📊 Stats Comparison

### Master vs Enhanced

| Feature | Master | Enhanced |
|---------|--------|----------|
| Weapons | 1 | 3 |
| Map Objects | None | ~30 |
| Dash Distance | 200px | 180px |
| Audio Quality | OK | Improved |
| Speech Bubble | Buggy | Fixed |
| Balance | Good | Better |

## 🔧 Troubleshooting

**Files not loading?**
- Use local server (http-server or Python)
- Check browser console for errors
- Ensure all files in correct folders

**Game not starting?**
- Check console for errors
- Verify all .js files loaded
- Try hard refresh (Ctrl+F5)

**Performance issues?**
- Reduce map.objectDensity in config.js
- Lower particle counts
- Disable shadows (edit CSS)

## 📝 Customization Examples

**Make player faster:**
```javascript
// js/config.js
player: {
    moveSpeed: 400,  // was 320
    dashSpeed: 700   // was 550
}
```

**Add more map objects:**
```javascript
// js/config.js
map: {
    objectDensity: 0.5  // was 0.3
}
```

**Buff shotgun:**
```javascript
// js/config.js
weapons: {
    shotgun: {
        damage: 80,  // was 66
        range: 500   // was 400
    }
}
```

## 🐛 Known Issues

- Map objects may occasionally overlap
- Very rare collision edge cases
- AI API requires key (optional feature)

## 📜 License

Made for MTC Game Project
Educational/Personal Use

---

**Enjoy the Enhanced Edition!** 🎉
