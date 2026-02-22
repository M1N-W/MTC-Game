# 🎮 MTC the Game (Beta Edition)

A high-octane, top-down survival action game built entirely from scratch using **HTML5 Canvas** and **Vanilla JavaScript**. No external game engines, just pure code, math, and passion.

![Version](https://img.shields.io/badge/version-Beta_v2.1-blue.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Tech Stack](https://img.shields.io/badge/tech-HTML5_|_Vanilla_JS-f0db4f.svg)
![AI](https://img.shields.io/badge/AI-Gemini_Integration-8a2be2.svg)

## ✨ Core Features

* **Custom Canvas Engine:** A lightweight, highly optimized 2D rendering engine featuring dynamic lighting, procedural day/night cycles, and a custom particle/weather system.
* **Gemini AI Integration:** Real-time dynamic game interactions. The AI generates unique mission names, sarcastic boss taunts based on the player's performance, and personalized post-game report cards. (Includes a robust 3-layer offline fallback system).
* **3 Unique Playable Characters:**
    * **👨🏻‍🎓 Kao:** The tactical marksman. Switches between Auto Rifle, Sniper, and Shotgun. Masters the art of stealth.
    * **🔥 Auto:** The close-quarters brawler. Utilizes the "Heat Wave" and the devastating "Wanchai Stand" combo.
    * **🌾 Poom:** The summoner. Throws sticky rice for critical hits and summons a protective Naga spirit.
* **Dynamic Wave Manager:** Survive endless waves that dynamically shift the battlefield with **Fog Waves** (radar offline), **Speed Waves**, and screen-distorting **Glitch Waves**.
* **Epic Boss Fights:**
    * **👑 Kru Manop:** The ruthless math teacher with 3 distinct phases (Base, Dog Rider, Goldfish Lover).
    * **⚛️ Kru First:** The agile physics master. Features Vector-telegraphed SUVAT Charges, Gravitational Shockwaves, and a unique "Pork Sandwich" parry mechanic.
* **Tactical HUD & Systems:** Features a real-time minimap (Radar), an interactive Shop system for mid-game buffs, and a robust Achievement tracking system.
* **Developer Admin Console:** A fully functional, Unix-style terminal (`F` key) for executing God-mode commands, manipulating waves, and debugging.

## 🕹️ Controls

| Key | Action |
| :--- | :--- |
| **W, A, S, D** | Move |
| **Mouse Left Click**| Shoot / Attack |
| **Mouse Right Click**| Character Ultimate Skill |
| **Spacebar** | Dash (i-frames) |
| **B** | Open MTC Co-op Shop (when near shop) |
| **E** | Access MTC Database (when near server) |
| **F** | Open Admin Terminal |
| **Q** | Secondary Skill (Poom's Naga) |

## 🚀 How to Run

1. Clone the repository to your local machine.
2. No Node.js, Webpack, or npm install required! This is pure Vanilla JS.
3. Simply open `index.html` in any modern web browser.
4. *(Optional)* To enable Gemini AI features, ensure you have a valid API key configured in `js/config.js` or `js/secrets.js`.

## 🏗️ Architecture Highlights

* **Object-Oriented Design:** Clean inheritance structures (`PlayerBase` -> `KaoPlayer`, `Enemy` -> `BossFirst`).
* **Centralized Localization (i18n):** All user-facing texts and AI prompts are managed strictly within `config.js` (`GAME_TEXTS`) for easy maintenance and future translations.
* **State Management:** Decoupled UI and Game Loop architecture preventing memory leaks during scene transitions.

---
*Developed with dedication by Mawin. Preparing for the ultimate migration to Godot.*
