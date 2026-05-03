# 🎮 MTC The Game: Top-down Wave Survival Shooter

**MTC The Game** เป็นโปรเจกต์เกมแนว Wave-based Survival Shooter ที่สร้างขึ้นด้วย **Vanilla JavaScript** และ **HTML5 Canvas** โดยเน้นความลื่นไหลระดับ 60 FPS และระบบ AI ที่มีความซับซ้อน โปรเจกต์นี้ถูกออกแบบมาเพื่อท้าทายขีดจำกัดของการพัฒนาเกมบนเว็บโดยไม่พึ่งพา Framework ใดๆ

---

## 🚀 จุดเด่นของโปรเจกต์ (Portfolio Highlights)

โปรเจกต์นี้ไม่ได้เป็นเพียงแค่เกม แต่เป็นการสาธิตการแก้ปัญหาทางวิศวกรรมซอฟต์แวร์ในด้านต่างๆ:

- **High-Performance Rendering**: จัดการ Render Object จำนวนมากพร้อมกันโดยรักษาเฟรมเรตที่ 60 FPS ผ่านเทคนิค Object Pooling และ Spatial Partitioning
- **Advanced AI Architecture**: ระบบ AI ที่ใช้ Utility-based scoring และ Squad Coordination ทำให้ศัตรูมีการตัดสินใจที่ดูฉลาดและเป็นทีม
- **Vanilla JS Mastery**: เขียนด้วย ES6+ ทั้งหมดโดยไม่ใช้ Library ภายนอก เพื่อให้เข้าใจการทำงานเชิงลึกของ Browser API และ Memory Management
- **Multi-threaded Processing**: ใช้ Web Workers ในการประมวลผลข้อมูลหนักๆ (เช่น Player Pattern Analysis) เพื่อไม่ให้รบกวน Main Thread ของเกม

---

## 🏗️ สถาปัตยกรรมของระบบ (Architectural Pattern)

เพื่อให้โค้ดสามารถขยายผลและดูแลรักษาได้ง่าย ผมได้เลือกใช้โครงสร้างแบบ **System-based Architecture** ที่แยกส่วนการทำงานออกจากกันอย่างชัดเจน:

### 1. Game Loop & State Management

- **Separation of Concerns**: แยกส่วน Logic (`update`) ออกจากส่วน Rendering (`draw`) อย่างเด็ดขาด เพื่อความแม่นยำในการคำนวณและประสิทธิภาพในการวาดภาพ
- **Centralized State**: ใช้ Singleton Pattern ในการจัดการ Game State (js/systems/GameState.js) เพื่อให้เป็น Single Source of Truth ของทั้งระบบ

### 2. Advanced AI Stack

ศัตรูในเกมนี้ไม่ได้เดินเข้าหาผู้เล่นทื่อๆ แต่ทำงานผ่านเลเยอร์ต่างๆ:

- **Utility AI**: ตัดสินใจเลือก Action ตามสถานการณ์ (Health, Distance, Squad Role) โดยใช้ระบบ Scoring
- **Squad AI**: ระบบประสานงานกลุ่มที่แบ่งหน้าที่ให้ศัตรู (เช่น Assault, Flanker, Support) เพื่อโอบล้อมหรือกดดันผู้เล่น
- **Pattern Analyzer**: ใช้ Web Worker วิเคราะห์พฤติกรรมการเล่นของผู้เล่นแบบ Real-time เพื่อส่งข้อมูลกลับไปให้ AI ปรับเปลี่ยนกลยุทธ์

### 3. Performance Optimization Strategies

- **Object Pooling**: ลด Garbage Collection (GC) churn โดยการนำ Object กระสุนและ Particle กลับมาใช้ใหม่
- **Spatial Grid**: ใช้ระบบ Grid ในการจัดการ Collision Detection (O(1) query) แทนการวน Loop ตรวจสอบทุก Object
- **Viewport Culling**: วาดเฉพาะสิ่งที่อยู่บนหน้าจอเท่านั้นเพื่อประหยัดทรัพยากร GPU/CPU

---

## 📂 โครงสร้างโฟลเดอร์ที่สำคัญ

```text
js/
├── ai/          # ระบบสมองกล (UtilityAI, SquadAI, Pattern Analysis)
├── entities/    # Base classes และพฤติกรรมของ Player, Enemy, Boss
├── systems/     # ระบบแกนหลัก (WaveManager, Shop, GameState, Time)
├── workers/     # Background threads สำหรับงานคำนวณหนักๆ
├── rendering/   # Logic การวาดภาพแยกตามประเภท Entity
└── game.js      # จุดเริ่มต้นและ Orchestrator ของเกมทั้งหมด
```

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Language:** JavaScript (ES6+)
- **Graphics:** HTML5 Canvas API (2D Context)
- **Audio:** Web Audio API (พร้อมระบบ Crossfade และ Dynamic SFX)
- **Concurrency:** Web Workers API
- **Tooling:** Vanilla (No Bundlers, No Frameworks)

---

## 🏃 วิธีการรันโปรเจกต์

เนื่องจากโปรเจกต์นี้เป็น Vanilla JS คุณสามารถรันได้ทันทีโดยไม่ต้องติดตั้ง dependencies:

1. Clone repository นี้ลงมา
2. เปิดไฟล์ `index.html` ผ่าน Local Server (แนะนำให้ใช้ VS Code Live Server หรือ `npx serve`)
3. สนุกกับเกมได้เลย!

หากต้องการเปิดระบบ Firebase ในเครื่อง ให้สร้างไฟล์ `js/secrets.js` เองโดยไม่ commit ไฟล์นี้ และกำหนด `window.CONFIG_SECRETS.FIREBASE_CONFIG` ให้ตรงกับโปรเจกต์ Firebase ของคุณ

---

**MTC The Game** คือบทพิสูจน์ว่า Web Technologies พื้นฐานสามารถสร้างประสบการณ์เกมที่ซับซ้อนและลื่นไหลได้ หากมีการออกแบบสถาปัตยกรรมและการจัดการทรัพยากรที่ดีพอ
