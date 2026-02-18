/**
 * 🏫 MTC: ENHANCED EDITION - Campus Map System (VISUAL REWORK)
 * Procedural Art Campus Map — MTC Room as Classroom + Smart Objects
 *
 * CHANGES FROM ORIGINAL:
 * - ✅ Standalone draw helpers: drawDesk(), drawTree(), drawServer(), drawDataPillar(), drawBookshelf()
 * - ✅ MTC Room: Classroom floor tiles, organised desks, whiteboard with maths, server rack
 * - ✅ Smart Objects: Tech Trees, Data Pillars, Outdoor Bookshelves
 * - ✅ Zone-based generation: Garden (NW), Tech Building (NE), Library (SW), East Campus (SE)
 * - ✅ Collision / physics logic left 100% intact
 *
 * LIGHTING ENGINE (v7 — NEW):
 * - ✅ MapSystem holds a single persistent offscreen <canvas> — never recreated per frame
 * - ✅ drawLighting(player, projectiles, extraLights) paints a darkness overlay with
 *       cut-out light circles using globalCompositeOperation = 'destination-out'
 * - ✅ Light types: 'warm' (amber torch), 'cool' (cyan tech), 'neutral' (white)
 * - ✅ Coloured tint pass (source-over) adds atmospheric hue inside each lit area
 * - ✅ DataPillar + Server map objects automatically emit cool ambient light
 * - ✅ Called AFTER CTX.restore() in drawGame() → HUD always stays fully bright
 */

// ═══════════════════════════════════════════════════════════
// 🎨 STANDALONE DRAW HELPERS (Procedural Art — no images)
// All helpers draw at (0,0) relative to a CTX.save/translate context
// ═══════════════════════════════════════════════════════════

/**
 * 🪑 drawDesk — Wooden student desk with textbook and pencil
 * @param {number} w  object width   @param {number} h  object height
 */
function drawDesk(w, h) {
    const pal = BALANCE.map.mapColors;

    // Desk surface (warm wood)
    CTX.fillStyle = pal.deskTop;
    CTX.beginPath();
    CTX.roundRect(0, 0, w, h, 4);
    CTX.fill();

    // Wood grain lines
    CTX.strokeStyle = pal.deskLegs;
    CTX.lineWidth = 1;
    CTX.globalAlpha = 0.35;
    for (let gx = 6; gx < w - 4; gx += 10) {
        CTX.beginPath();
        CTX.moveTo(gx, 2);
        CTX.lineTo(gx + 3, h - 2);
        CTX.stroke();
    }
    CTX.globalAlpha = 1;

    // Desktop surface highlight
    CTX.fillStyle = 'rgba(255,255,220,0.18)';
    CTX.beginPath();
    CTX.roundRect(3, 2, w - 6, 6, 2);
    CTX.fill();

    // Legs (two small rectangles below)
    CTX.fillStyle = pal.deskLegs;
    CTX.fillRect(4, h, 6, 6);
    CTX.fillRect(w - 10, h, 6, 6);

    // Textbook on desk (small blue rectangle)
    CTX.fillStyle = '#1e40af';
    CTX.beginPath();
    CTX.roundRect(Math.floor(w * 0.1), Math.floor(h * 0.2), Math.floor(w * 0.45), Math.floor(h * 0.55), 2);
    CTX.fill();
    CTX.fillStyle = '#93c5fd';
    CTX.fillRect(Math.floor(w * 0.12), Math.floor(h * 0.22), Math.floor(w * 0.2), 2);
    CTX.fillRect(Math.floor(w * 0.12), Math.floor(h * 0.28), Math.floor(w * 0.35), 2);

    // Pencil
    CTX.fillStyle = '#fbbf24';
    CTX.fillRect(Math.floor(w * 0.65), Math.floor(h * 0.25), Math.floor(w * 0.25), 4);
    CTX.fillStyle = '#f87171';
    CTX.fillRect(Math.floor(w * 0.65) - 4, Math.floor(h * 0.25), 4, 4);
}

/**
 * 🌳 drawTree — Geometric Tech Tree (3-tier circles, pastel-green)
 * @param {number} size  radius of bottom tier (matches collision box)
 */
function drawTree(size) {
    const pal = BALANCE.map.mapColors;
    const t = performance.now() / 2000;

    // Shadow
    CTX.fillStyle = 'rgba(0,0,0,0.25)';
    CTX.beginPath();
    CTX.ellipse(0, size * 0.3, size * 0.7, size * 0.2, 0, 0, Math.PI * 2);
    CTX.fill();

    // Trunk
    CTX.fillStyle = pal.treeTrunk;
    CTX.beginPath();
    CTX.roundRect(-5, -size * 0.15, 10, size * 0.5, 3);
    CTX.fill();

    // Bottom foliage tier (darkest)
    CTX.fillStyle = pal.treeDark;
    CTX.beginPath();
    CTX.arc(0, -size * 0.1, size * 0.72, 0, Math.PI * 2);
    CTX.fill();

    // Mid foliage tier
    CTX.fillStyle = pal.treeMid;
    CTX.beginPath();
    CTX.arc(0, -size * 0.45, size * 0.58, 0, Math.PI * 2);
    CTX.fill();

    // Top foliage tier (lightest)
    CTX.fillStyle = pal.treeLight;
    CTX.beginPath();
    CTX.arc(0, -size * 0.78, size * 0.40, 0, Math.PI * 2);
    CTX.fill();

    // Sparkle highlights (animated)
    CTX.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 3; i++) {
        const a = t + (Math.PI * 2 / 3) * i;
        const r = size * 0.3;
        CTX.beginPath();
        CTX.arc(Math.cos(a) * r, -size * 0.45 + Math.sin(a) * r * 0.5, 3, 0, Math.PI * 2);
        CTX.fill();
    }

    // Hexagonal outline on top tier (tech-tree aesthetic)
    CTX.strokeStyle = 'rgba(134,239,172,0.6)';
    CTX.lineWidth = 1.5;
    CTX.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const r = size * 0.42;
        const px = Math.cos(a) * r;
        const py = -size * 0.78 + Math.sin(a) * r;
        i === 0 ? CTX.moveTo(px, py) : CTX.lineTo(px, py);
    }
    CTX.closePath();
    CTX.stroke();
}

/**
 * 🖥️ drawServer — Server rack cabinet with blinking status lights
 * @param {number} w object width   @param {number} h object height
 */
function drawServer(w, h) {
    const pal = BALANCE.map.mapColors;
    const now = performance.now();

    // Cabinet body
    CTX.fillStyle = pal.serverBody;
    CTX.beginPath();
    CTX.roundRect(0, 0, w, h, 5);
    CTX.fill();

    // Front panel
    CTX.fillStyle = '#263451';
    CTX.fillRect(4, 4, w - 8, h - 8);

    // Four server unit slots
    const unitH = Math.floor((h - 16) / 4);
    for (let u = 0; u < 4; u++) {
        const uy = 8 + u * unitH;

        // Unit chassis
        CTX.fillStyle = '#1c2a3e';
        CTX.beginPath();
        CTX.roundRect(6, uy, w - 12, unitH - 3, 2);
        CTX.fill();

        // Status light (blinking)
        const blinkOffset = u * 317;
        const isOn = Math.sin((now + blinkOffset) / (400 + u * 100)) > 0;
        CTX.fillStyle = isOn ? pal.serverLightOn : pal.serverLightOff;
        CTX.shadowBlur = isOn ? 8 : 0;
        CTX.shadowColor = pal.serverLightOn;
        CTX.beginPath();
        CTX.arc(12, uy + unitH * 0.45, 3, 0, Math.PI * 2);
        CTX.fill();
        CTX.shadowBlur = 0;

        // Drive activity LEDs
        for (let d = 0; d < 3; d++) {
            const dOn = Math.sin((now + blinkOffset + d * 150) / 200) > 0.6;
            CTX.fillStyle = dOn ? '#3b82f6' : '#1d3155';
            CTX.fillRect(18 + d * 6, uy + unitH * 0.3, 4, 4);
        }

        // Vent grill
        CTX.strokeStyle = '#1a2738';
        CTX.lineWidth = 0.8;
        for (let vx = w - 20; vx < w - 8; vx += 3) {
            CTX.beginPath();
            CTX.moveTo(vx, uy + 3);
            CTX.lineTo(vx, uy + unitH - 4);
            CTX.stroke();
        }
    }

    // Top ventilation grill
    CTX.fillStyle = '#334155';
    CTX.fillRect(4, 0, w - 8, 4);
    CTX.strokeStyle = '#475569';
    CTX.lineWidth = 0.8;
    for (let vx = 8; vx < w - 8; vx += 4) {
        CTX.beginPath(); CTX.moveTo(vx, 0); CTX.lineTo(vx, 4); CTX.stroke();
    }

    // Cable ports at bottom
    CTX.fillStyle = '#0ea5e9';
    for (let p = 0; p < 3; p++) {
        CTX.fillRect(6 + p * 10, h - 7, 7, 4);
    }
}

/**
 * 🏛️ drawDataPillar — Stone pillar with glowing circuit-pattern overlay
 * @param {number} w object width   @param {number} h object height
 */
function drawDataPillar(w, h) {
    const pal = BALANCE.map.mapColors;
    const now = performance.now();
    const glow = Math.sin(now / 800) * 0.4 + 0.6;

    // Pillar shadow
    CTX.fillStyle = 'rgba(0,0,0,0.3)';
    CTX.beginPath();
    CTX.ellipse(w / 2, h + 4, w * 0.55, 7, 0, 0, Math.PI * 2);
    CTX.fill();

    // Base slab
    CTX.fillStyle = '#334155';
    CTX.beginPath();
    CTX.roundRect(-4, h - 8, w + 8, 10, 2);
    CTX.fill();

    // Capital (top slab)
    CTX.fillStyle = '#475569';
    CTX.beginPath();
    CTX.roundRect(-4, -6, w + 8, 9, 2);
    CTX.fill();

    // Main column with gradient
    const grad = CTX.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#334155');
    grad.addColorStop(0.4, '#64748b');
    grad.addColorStop(1, '#475569');
    CTX.fillStyle = grad;
    CTX.fillRect(0, 0, w, h - 6);

    // Circuit traces
    CTX.strokeStyle = `rgba(6, 182, 212, ${glow * 0.8})`;
    CTX.lineWidth = 1.2;
    CTX.shadowBlur = 6;
    CTX.shadowColor = pal.pillarCircuit;

    CTX.beginPath();
    CTX.moveTo(w * 0.35, 4);
    CTX.lineTo(w * 0.35, h * 0.25);
    CTX.lineTo(w * 0.6, h * 0.35);
    CTX.lineTo(w * 0.6, h * 0.55);
    CTX.lineTo(w * 0.3, h * 0.65);
    CTX.lineTo(w * 0.3, h * 0.85);
    CTX.stroke();

    CTX.beginPath();
    CTX.moveTo(w * 0.35, h * 0.25);
    CTX.lineTo(w * 0.7, h * 0.25);
    CTX.moveTo(w * 0.6, h * 0.55);
    CTX.lineTo(w * 0.15, h * 0.55);
    CTX.stroke();

    // Junction nodes
    CTX.fillStyle = pal.pillarCircuit;
    const nodes = [
        [w * 0.35, h * 0.25], [w * 0.6, h * 0.35],
        [w * 0.6, h * 0.55], [w * 0.3, h * 0.65]
    ];
    for (const [nx, ny] of nodes) {
        CTX.beginPath();
        CTX.arc(nx, ny, 2.5, 0, Math.PI * 2);
        CTX.fill();
    }
    CTX.shadowBlur = 0;

    // Glowing dot on capital
    CTX.fillStyle = `rgba(6,182,212,${glow})`;
    CTX.shadowBlur = 10;
    CTX.shadowColor = pal.pillarCircuit;
    CTX.beginPath();
    CTX.arc(w / 2, -2, 3, 0, Math.PI * 2);
    CTX.fill();
    CTX.shadowBlur = 0;
}

/**
 * 📚 drawBookshelf — Outdoor bookshelf with colourful spine rows
 * @param {number} w object width   @param {number} h object height
 */
function drawBookshelf(w, h) {
    const pal = BALANCE.map.mapColors;
    const bookColors = pal.bookColors;

    // Back panel
    CTX.fillStyle = '#78350f';
    CTX.beginPath();
    CTX.roundRect(0, 0, w, h, 3);
    CTX.fill();

    // Side panels
    CTX.fillStyle = '#92400e';
    CTX.fillRect(0, 0, 5, h);
    CTX.fillRect(w - 5, 0, 5, h);

    const shelfCount = 3;
    const shelfH = (h - 6) / shelfCount;

    for (let s = 0; s < shelfCount; s++) {
        const sy = 3 + s * shelfH;

        // Shelf board
        CTX.fillStyle = '#a16207';
        CTX.fillRect(5, sy + shelfH - 4, w - 10, 5);

        // Books — variable widths & heights
        let bx = 7;
        let bookIdx = (s * 7) % bookColors.length;
        while (bx < w - 12) {
            const bw = 8 + Math.floor(Math.abs(Math.sin(bx * 0.3 + s)) * 8);
            const bh = shelfH * (0.55 + Math.abs(Math.sin(bx * 0.7)) * 0.3);
            const color = bookColors[bookIdx % bookColors.length];

            CTX.fillStyle = color;
            CTX.beginPath();
            CTX.roundRect(bx, sy + shelfH - 4 - bh, bw, bh, 1);
            CTX.fill();

            // Spine highlight
            CTX.fillStyle = 'rgba(255,255,255,0.2)';
            CTX.fillRect(bx + 1, sy + shelfH - 4 - bh + 2, 2, bh - 4);

            // Spine title line
            CTX.fillStyle = 'rgba(0,0,0,0.3)';
            CTX.fillRect(bx + bw * 0.25, sy + shelfH - 4 - bh + bh * 0.3, bw * 0.5, 1.5);

            bx += bw + 1;
            bookIdx++;
        }
    }

    // Top rail
    CTX.fillStyle = '#a16207';
    CTX.fillRect(0, 0, w, 4);
}

// ═══════════════════════════════════════════════════════════
// 🗺️ MAP OBJECT CLASS
// ═══════════════════════════════════════════════════════════
class MapObject {
    constructor(x, y, w, h, type) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.type = type;
        this.solid = type !== 'decoration';
    }

    checkCollision(cx, cy, radius) {
        if (!this.solid) return false;
        return circleRectCollision(cx, cy, radius, this.x, this.y, this.w, this.h);
    }

    resolveCollision(entity) {
        if (!this.solid) return;

        const closestX = clamp(entity.x, this.x, this.x + this.w);
        const closestY = clamp(entity.y, this.y, this.y + this.h);

        const dx = entity.x - closestX;
        const dy = entity.y - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < entity.radius) {
            const overlap = entity.radius - distance;
            if (distance > 0) {
                entity.x += (dx / distance) * overlap;
                entity.y += (dy / distance) * overlap;
            } else {
                entity.x += overlap;
            }
            entity.vx *= 0.5;
            entity.vy *= 0.5;
        }
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);

        CTX.save();
        CTX.translate(screen.x, screen.y);

        switch (this.type) {
            case 'desk':        drawDesk(this.w, this.h);               break;
            case 'tree':        drawTree(this.w / 2);                   break;
            case 'server':      drawServer(this.w, this.h);             break;
            case 'datapillar':  drawDataPillar(this.w, this.h);         break;
            case 'bookshelf':   drawBookshelf(this.w, this.h);          break;
            case 'blackboard':  this.drawBlackboard();                  break;
            case 'wall':        this.drawWall();                        break;
            // Legacy types kept for compatibility
            case 'chair':       this.drawChair();                       break;
            case 'cabinet':     this.drawCabinet();                     break;
        }

        CTX.restore();
    }

    // ── Legacy draw methods (unchanged) ─────────────────────
    drawChair() {
        CTX.fillStyle = '#475569';
        CTX.fillRect(5, 0, this.w - 10, this.h - 15);
        CTX.fillStyle = '#64748b';
        CTX.fillRect(0, this.h - 15, this.w, 15);
        CTX.fillStyle = '#334155';
        CTX.fillRect(3, this.h - 12, 4, 12);
        CTX.fillRect(this.w - 7, this.h - 12, 4, 12);
    }

    drawCabinet() {
        CTX.fillStyle = '#92400e';
        CTX.fillRect(0, 0, this.w, this.h);
        CTX.fillStyle = '#78350f';
        CTX.fillRect(4, 4, this.w / 2 - 8, this.h - 8);
        CTX.fillRect(this.w / 2 + 4, 4, this.w / 2 - 8, this.h - 8);
        CTX.fillStyle = '#fbbf24';
        CTX.beginPath(); CTX.arc(this.w / 4, this.h / 2, 4, 0, Math.PI * 2); CTX.fill();
        CTX.beginPath(); CTX.arc(3 * this.w / 4, this.h / 2, 4, 0, Math.PI * 2); CTX.fill();
    }

    // ── Active draw methods ──────────────────────────────────
    drawBlackboard() {
        const pal = BALANCE.map.mapColors;

        // Board frame (dark wood)
        CTX.fillStyle = '#451a03';
        CTX.beginPath();
        CTX.roundRect(0, 0, this.w, this.h, 4);
        CTX.fill();

        // Chalk surface (deep green)
        CTX.fillStyle = pal.whiteboardGreen;
        CTX.beginPath();
        CTX.roundRect(6, 5, this.w - 12, this.h - 10, 2);
        CTX.fill();

        // Subtle chalk texture
        CTX.globalAlpha = 0.06;
        CTX.fillStyle = '#ffffff';
        for (let i = 0; i < 30; i++) {
            CTX.fillRect(
                8 + Math.floor(Math.abs(Math.sin(i * 13)) * (this.w - 20)),
                7 + Math.floor(Math.abs(Math.cos(i * 7)) * (this.h - 14)),
                2, 1
            );
        }
        CTX.globalAlpha = 1;

        // Math equations
        CTX.fillStyle = pal.chalkWhite;
        CTX.textAlign = 'center';
        CTX.textBaseline = 'middle';
        CTX.font = `bold ${Math.floor(this.h * 0.22)}px monospace`;
        CTX.fillText('ax²+bx+c = 0', this.w / 2, this.h * 0.35);

        CTX.font = `${Math.floor(this.h * 0.16)}px monospace`;
        CTX.fillText('∫f(x)dx', this.w * 0.28, this.h * 0.72);
        CTX.fillText('lim x→∞', this.w * 0.72, this.h * 0.72);

        // Chalk tray
        CTX.fillStyle = '#78350f';
        CTX.fillRect(6, this.h - 6, this.w - 12, 5);
        const chalkColors = ['#f0ebe0', '#f87171', '#fbbf24', '#86efac'];
        for (let c = 0; c < 4; c++) {
            CTX.fillStyle = chalkColors[c];
            CTX.fillRect(12 + c * 18, this.h - 5, 14, 3);
        }

        // Eraser dust
        CTX.fillStyle = 'rgba(240,235,224,0.4)';
        CTX.fillRect(this.w * 0.55, this.h - 5, 22, 3);
    }

    drawWall() {
        const pal = BALANCE.map.mapColors;
        CTX.fillStyle = pal.wallColor;
        CTX.fillRect(0, 0, this.w, this.h);
        CTX.strokeStyle = pal.wallBrick;
        CTX.lineWidth = 1.5;

        const brickW = 50, brickH = 25;
        for (let y = 0; y < this.h; y += brickH) {
            for (let x = 0; x < this.w; x += brickW) {
                const offset = (Math.floor(y / brickH) % 2) * (brickW / 2);
                CTX.strokeRect(x + offset, y, brickW, brickH);
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════
// 🏫 MTC ROOM (Safe Zone — Classroom Interior)
// ═══════════════════════════════════════════════════════════
class MTCRoom {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = BALANCE.mtcRoom.size;
        this.h = BALANCE.mtcRoom.size;
        this.healRate = BALANCE.mtcRoom.healRate;
        this.maxStayTime = BALANCE.mtcRoom.maxStayTime;
        this.cooldownTime = BALANCE.mtcRoom.cooldownTime;
        this.playerStayTime = 0;
        this.cooldown = 0;
        this.isPlayerInside = false;
    }

    // ── Logic (unchanged) ───────────────────────────────────
    update(dt, player) {
        this.cooldown = Math.max(0, this.cooldown - dt);

        const inside = this.checkPlayerInside(player.x, player.y);

        if (inside && this.cooldown <= 0) {
            if (!this.isPlayerInside) {
                this.isPlayerInside = true;
                this.playerStayTime = 0;
                spawnFloatingText('SAFE ZONE!', player.x, player.y - 60, '#10b981', 25);
                UIManager.showVoiceBubble('เข้าสู่ MTC Room - กำลังรักษา...', player.x, player.y - 40);
            }

            this.playerStayTime += dt;

            if (player.hp < player.maxHp) {
                const healAmount = this.healRate * dt;
                player.hp = Math.min(player.maxHp, player.hp + healAmount);
                if (Math.random() < 0.3) {
                    spawnParticles(player.x + rand(-20, 20), player.y + rand(-20, 20), 1, '#10b981');
                }
            }

            if (player.energy < player.maxEnergy) {
                player.energy = Math.min(player.maxEnergy, player.energy + 30 * dt);
            }

            if (this.playerStayTime >= this.maxStayTime) {
                this.kickOut(player);
            }
        } else {
            if (this.isPlayerInside) {
                this.isPlayerInside = false;
            }
        }
    }

    checkPlayerInside(px, py) {
        return px >= this.x && px <= this.x + this.w &&
               py >= this.y && py <= this.y + this.h;
    }

    kickOut(player) {
        this.isPlayerInside = false;
        this.cooldown = this.cooldownTime;
        spawnFloatingText('เวลาหมด!', player.x, player.y - 60, '#f59e0b', 20);
        UIManager.showVoiceBubble('ออกจาก MTC Room แล้ว', player.x, player.y - 40);

        const centerX = this.x + this.w / 2;
        const centerY = this.y + this.h / 2;
        const angle = Math.atan2(player.y - centerY, player.x - centerX);
        player.vx = Math.cos(angle) * 200;
        player.vy = Math.sin(angle) * 200;
    }

    // ── Visuals (REWORKED — Classroom Interior) ─────────────
    draw() {
        const s = worldToScreen(this.x, this.y);
        const W = this.w, H = this.h;
        const pal = BALANCE.map.mapColors;
        const now = performance.now();

        CTX.save();

        // ── 1. FLOOR — parquet tile pattern ──
        const tileSize = 30;
        CTX.save();
        CTX.beginPath();
        CTX.rect(s.x, s.y, W, H);
        CTX.clip();

        for (let ty = 0; ty < H; ty += tileSize) {
            for (let tx = 0; tx < W; tx += tileSize) {
                const alt = (Math.floor(tx / tileSize) + Math.floor(ty / tileSize)) % 2;
                CTX.fillStyle = alt ? pal.floor : pal.floorAlt;
                CTX.fillRect(s.x + tx, s.y + ty, tileSize, tileSize);
            }
        }
        // Grout lines
        CTX.strokeStyle = 'rgba(0,0,0,0.12)';
        CTX.lineWidth = 0.8;
        for (let ty = 0; ty <= H; ty += tileSize) {
            CTX.beginPath(); CTX.moveTo(s.x, s.y + ty); CTX.lineTo(s.x + W, s.y + ty); CTX.stroke();
        }
        for (let tx = 0; tx <= W; tx += tileSize) {
            CTX.beginPath(); CTX.moveTo(s.x + tx, s.y); CTX.lineTo(s.x + tx, s.y + H); CTX.stroke();
        }
        CTX.restore();

        // ── 2. WHITEBOARD — top wall ──
        const wbX = s.x + 20, wbY = s.y + 8, wbW = W - 40, wbH = 48;

        // Frame (dark wood)
        CTX.fillStyle = '#3d1c00';
        CTX.beginPath(); CTX.roundRect(wbX - 4, wbY - 4, wbW + 8, wbH + 8, 3); CTX.fill();

        // Chalk surface
        CTX.fillStyle = pal.whiteboardGreen;
        CTX.beginPath(); CTX.roundRect(wbX, wbY, wbW, wbH, 2); CTX.fill();

        // Equations on board
        CTX.fillStyle = pal.chalkWhite;
        CTX.font = 'bold 11px monospace';
        CTX.textAlign = 'center';
        CTX.textBaseline = 'middle';
        CTX.fillText('MTC  •  Math & Computer Engineering', s.x + W / 2, wbY + 12);
        CTX.font = '10px monospace';
        CTX.fillText('y = mx + c    |    ∑n²    |    P(A∩B)', s.x + W / 2, wbY + 28);
        CTX.font = 'bold 9px monospace';
        CTX.fillStyle = '#86efac';
        CTX.fillText('>>> print(\"Hello, MTC!\")   →   O(log n)', s.x + W / 2, wbY + 42);

        // Chalk tray
        CTX.fillStyle = '#4a2000';
        CTX.fillRect(wbX, wbY + wbH, wbW, 5);
        const chalks = [pal.chalkWhite, '#fca5a5', '#fde68a', '#86efac'];
        chalks.forEach((c, i) => {
            CTX.fillStyle = c;
            CTX.fillRect(wbX + 10 + i * 20, wbY + wbH + 1, 14, 3);
        });

        // ── 3. STUDENT DESKS — 2 rows × 3 cols ──
        const deskW = 44, deskH = 28;
        const deskStartX = s.x + 18;
        const deskStartY = s.y + 76;
        const deskCols = 3, deskRows = 2;
        const deskColGap = (W - 36 - deskCols * deskW) / (deskCols - 1);
        const deskRowGap = 38;

        for (let row = 0; row < deskRows; row++) {
            for (let col = 0; col < deskCols; col++) {
                const dx = deskStartX + col * (deskW + deskColGap);
                const dy = deskStartY + row * (deskH + deskRowGap);
                CTX.save();
                CTX.translate(dx, dy);
                drawDesk(deskW, deskH);
                CTX.restore();
            }
        }

        // ── 4. SERVER RACK — bottom-right corner ──
        CTX.save();
        CTX.translate(s.x + W - 60, s.y + H - 80);
        drawServer(48, 68);
        CTX.restore();

        // ── 5. TEACHER'S DESK — bottom-left ──
        CTX.save();
        CTX.translate(s.x + 16, s.y + H - 54);
        drawDesk(72, 36);
        // Mug on teacher desk
        CTX.fillStyle = '#1e40af';
        CTX.beginPath(); CTX.arc(62, 10, 8, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = '#93c5fd';
        CTX.beginPath(); CTX.arc(62, 10, 5, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = '#1e40af';
        CTX.lineWidth = 2;
        CTX.beginPath(); CTX.arc(71, 12, 5, -0.5, 1.2); CTX.stroke();
        CTX.restore();

        // ── 6. ROOM BORDER ──
        const pulse = this.cooldown > 0 ? 1 : (Math.sin(now / 350) * 0.3 + 0.7);
        CTX.strokeStyle = this.cooldown > 0 ? '#64748b' : '#10b981';
        CTX.lineWidth = 3;
        CTX.globalAlpha = pulse;
        if (this.cooldown > 0) CTX.setLineDash([10, 6]);
        CTX.strokeRect(s.x, s.y, W, H);
        CTX.setLineDash([]);
        CTX.globalAlpha = 1;

        // Corner accent brackets
        const cornerLen = 18;
        CTX.strokeStyle = this.cooldown > 0 ? '#94a3b8' : '#34d399';
        CTX.lineWidth = 3;
        const corners = [
            [s.x, s.y, 1, 1], [s.x + W, s.y, -1, 1],
            [s.x, s.y + H, 1, -1], [s.x + W, s.y + H, -1, -1]
        ];
        for (const [cx, cy, sx2, sy2] of corners) {
            CTX.beginPath();
            CTX.moveTo(cx + sx2 * cornerLen, cy);
            CTX.lineTo(cx, cy);
            CTX.lineTo(cx, cy + sy2 * cornerLen);
            CTX.stroke();
        }

        // ── 7. SIGN / STATUS ──
        if (this.cooldown > 0) {
            CTX.fillStyle = 'rgba(15,23,42,0.82)';
            CTX.beginPath(); CTX.roundRect(s.x + W / 2 - 65, s.y + H / 2 - 18, 130, 36, 8); CTX.fill();
            CTX.fillStyle = '#94a3b8';
            CTX.font = 'bold 11px Orbitron, monospace';
            CTX.textAlign = 'center';
            CTX.textBaseline = 'middle';
            CTX.fillText('MTC ROOM', s.x + W / 2, s.y + H / 2 - 6);
            CTX.font = 'bold 12px Arial';
            CTX.fillStyle = '#f59e0b';
            CTX.fillText(`CD ${Math.ceil(this.cooldown)}s`, s.x + W / 2, s.y + H / 2 + 10);
        } else {
            CTX.fillStyle = 'rgba(16,185,129,0.18)';
            CTX.beginPath(); CTX.roundRect(s.x + W / 2 - 58, s.y + H - 26, 116, 20, 6); CTX.fill();
            CTX.fillStyle = `rgba(52,211,153,${pulse})`;
            CTX.font = 'bold 10px Orbitron, monospace';
            CTX.textAlign = 'center';
            CTX.textBaseline = 'middle';
            CTX.fillText('⚕ SAFE ZONE — ฟื้นฟู HP', s.x + W / 2, s.y + H - 16);
        }

        // Timer when player inside
        if (this.isPlayerInside) {
            const timeLeft = this.maxStayTime - this.playerStayTime;
            CTX.fillStyle = '#fbbf24';
            CTX.font = 'bold 20px Arial';
            CTX.textAlign = 'center';
            CTX.textBaseline = 'middle';
            CTX.fillText(`⏱ ${timeLeft.toFixed(1)}s`, s.x + W / 2, s.y + H - 44);
        }

        CTX.restore();
    }
}

// ═══════════════════════════════════════════════════════════
// 🗺️ MAP SYSTEM — Zone-based generation
// ═══════════════════════════════════════════════════════════
class MapSystem {
    constructor() {
        this.objects = [];
        this.mtcRoom = null;
        this.initialized = false;

        // ── Lighting engine ──────────────────────────────────
        // Offscreen canvas created ONCE here so it is never
        // re-allocated during gameplay.  Resized lazily if the
        // main CANVAS dimensions change (e.g. window resize).
        this._lightCanvas = document.createElement('canvas');
        this._lightCtx    = this._lightCanvas.getContext('2d');
    }

    init() {
        if (this.initialized) return;

        this.objects = [];
        this.generateCampusMap();

        // MTC Room at center-left (position unchanged from original)
        this.mtcRoom = new MTCRoom(-400, -100);

        this.initialized = true;
        console.log(`✅ Campus Map: ${this.objects.length} objects + MTC Room`);
    }

    /**
     * generateCampusMap — Zone-based procedural layout
     *
     * Zones (world coords, map = -1500 to +1500):
     *   NW  Garden      x: -1400 → -500   y: -1400 → -450  — Trees + Bookshelves
     *   NE  Tech Block  x:  500  → 1400   y: -1400 → -450  — DataPillars + Servers
     *   SW  Lib Alley   x: -1400 → -500   y:  450  → 1400  — Bookshelves + Desks
     *   SE  East Campus x:  500  → 1400   y:  450  → 1400  — Desks + Trees
     *   Mid corridors — sparse accent objects (pillars / trees)
     */
    generateCampusMap() {
        // Object size registry
        const sizes = {
            desk:       { w: 60,  h: 40  },
            tree:       { w: 50,  h: 50  },
            server:     { w: 45,  h: 80  },
            datapillar: { w: 35,  h: 70  },
            bookshelf:  { w: 80,  h: 40  },
            blackboard: { w: 150, h: 80  }
        };

        // Helper: scatter objects inside a rectangular zone with min-separation check
        const placeZone = (xMin, xMax, yMin, yMax, types, count, minSep = 220) => {
            let placed = 0, tries = 0;
            while (placed < count && tries < count * 15) {
                tries++;
                const x = xMin + Math.random() * (xMax - xMin);
                const y = yMin + Math.random() * (yMax - yMin);

                // Clear spawn area
                if (Math.abs(x) < 180 && Math.abs(y) < 180) continue;
                // Clear MTC Room area
                if (x > -520 && x < -80 && y > -220 && y < 220) continue;

                // Minimum separation from existing objects
                let tooClose = false;
                for (const obj of this.objects) {
                    if (Math.hypot(obj.x - x, obj.y - y) < minSep) { tooClose = true; break; }
                }
                if (tooClose) continue;

                const type = types[Math.floor(Math.random() * types.length)];
                const sz = sizes[type];
                this.objects.push(new MapObject(x, y, sz.w, sz.h, type));
                placed++;
            }
        };

        // ── NW Garden — Trees + Bookshelves ──
        placeZone(-1400, -500, -1400, -450, ['tree', 'tree', 'tree', 'bookshelf'], 10, 200);
        placeZone(-1400, -500, -1400, -450, ['tree'], 6, 180);

        // ── NE Tech Block — DataPillars + Servers ──
        placeZone(500, 1400, -1400, -450, ['datapillar', 'datapillar', 'server'], 8, 210);
        placeZone(500, 1400, -1400, -450, ['datapillar'], 5, 180);

        // ── SW Outdoor Library — Bookshelves + Desks ──
        placeZone(-1400, -500, 450, 1400, ['bookshelf', 'bookshelf', 'desk'], 8, 200);
        placeZone(-1400, -500, 450, 1400, ['tree'], 4, 220);

        // ── SE East Campus — Desks + Trees ──
        placeZone(500, 1400, 450, 1400, ['desk', 'desk', 'tree'], 9, 190);
        placeZone(500, 1400, 450, 1400, ['bookshelf'], 3, 250);

        // ── Mid corridors (sparse) ──
        placeZone(-450, 450, -1400, -600, ['datapillar', 'tree'], 4, 350);
        placeZone(-450, 450,  600,  1400, ['tree', 'bookshelf'],   4, 350);
        placeZone(-1400, -600, -300, 300, ['datapillar', 'tree'],  4, 350);
        placeZone(600, 1400, -300, 300,   ['datapillar', 'server'], 4, 350);

        // ── Fixed landmarks ──

        // Central blackboard north of spawn
        this.objects.push(new MapObject(-75, -620, 150, 80, 'blackboard'));

        // Data pillar gateposts flanking the central plaza
        this.objects.push(new MapObject(-220, -240, 35, 70, 'datapillar'));
        this.objects.push(new MapObject( 160, -240, 35, 70, 'datapillar'));

        // Feature trees at plaza corners
        const treePosts = [[-480, -430], [430, -430], [-480, 380], [430, 380]];
        for (const [tx, ty] of treePosts) {
            this.objects.push(new MapObject(tx, ty, 50, 50, 'tree'));
        }

        // ── Map edge walls (unchanged from config) ──
        for (const wall of BALANCE.map.wallPositions) {
            this.objects.push(new MapObject(wall.x, wall.y, wall.w, wall.h, 'wall'));
        }
    }

    update(entities) {
        // Collision resolution (unchanged)
        for (const entity of entities) {
            if (entity.dead) continue;
            for (const obj of this.objects) {
                obj.resolveCollision(entity);
            }
        }

        // MTC Room update (unchanged)
        if (this.mtcRoom && window.player) {
            this.mtcRoom.update(getDeltaTime(performance.now()), window.player);
        }
    }

    draw() {
        // MTC Room floor drawn first (behind objects)
        if (this.mtcRoom) {
            this.mtcRoom.draw();
        }

        // ── View-cull constants ───────────────────────────────
        // Objects whose bounding box is entirely outside this
        // margin around the canvas are skipped.  120 px gives
        // a comfortable safety margin for large objects (bookshelves
        // are 80 px wide; trees can extend ~50 px above their anchor).
        // The sort is still done on the full list so draw order is
        // correct the moment objects scroll into view.
        const CULL = 120;

        // Y-sort for rough depth order, frustum cull
        const sorted = [...this.objects].sort((a, b) => a.y - b.y);
        for (const obj of sorted) {
            const screen = worldToScreen(obj.x, obj.y);
            // X-axis: skip if right edge is left of canvas-margin
            //         OR left edge is right of canvas+margin
            if (screen.x + obj.w < -CULL || screen.x > CANVAS.width  + CULL) continue;
            // Y-axis: same test for vertical axis
            if (screen.y + obj.h < -CULL || screen.y > CANVAS.height + CULL) continue;
            obj.draw();
        }
    }

    // ═══════════════════════════════════════════════════════
    // 💡 drawLighting(player, projectiles, extraLights)
    //
    // Paints a full-screen darkness overlay with radial
    // "cut-out" light circles at every light source.
    //
    // Technique (single persistent offscreen canvas):
    //   1. Resize offscreen canvas to match main canvas if needed
    //   2. Fill with dark night colour at (1 - ambientLight) opacity
    //   3. Set composite = 'destination-out'
    //      → drawing erases the darkness, revealing the world beneath
    //   4. Draw radial gradients (opaque centre → transparent edge)
    //      at each light-source position (in shaken screen coords)
    //   5. Set composite = 'source-over'
    //      → draw warm/cool tint disc to add atmospheric colour
    //   6. Blit offscreen canvas onto main CTX at (0,0) in screen space
    //
    // Called AFTER CTX.restore() in drawGame() so it covers the
    // entire canvas and the HUD (which lives in HTML) remains bright.
    //
    // @param {Entity|null}   player       — the player entity
    // @param {Projectile[]}  projectiles  — array of live projectiles
    // @param {LightDef[]}    extraLights  — [{x,y,radius,type}] from game.js
    // ═══════════════════════════════════════════════════════
    drawLighting(player, projectiles = [], extraLights = []) {
        const L        = BALANCE.LIGHTING;
        const darkness = 1.0 - L.ambientLight;

        // Skip the whole pass during bright daytime — no cost at all
        if (darkness < 0.02) return;

        const lc   = this._lightCanvas;
        const lctx = this._lightCtx;

        // ── Lazy resize (handles window resize events) ───────
        if (lc.width !== CANVAS.width || lc.height !== CANVAS.height) {
            lc.width  = CANVAS.width;
            lc.height = CANVAS.height;
        }

        // Shake offset — needed so light positions stay anchored
        // to world objects even during screen-shake events.
        const shake = getScreenShakeOffset();

        // ── Helper: world → shaken screen coords ─────────────
        const toSS = (wx, wy) => {
            const s = worldToScreen(wx, wy);
            return { x: s.x + shake.x, y: s.y + shake.y };
        };

        // ── ① Fill darkness overlay ───────────────────────────
        lctx.globalCompositeOperation = 'source-over';
        lctx.clearRect(0, 0, lc.width, lc.height);
        lctx.fillStyle = `rgba(${L.nightR},${L.nightG},${L.nightB},${darkness.toFixed(3)})`;
        lctx.fillRect(0, 0, lc.width, lc.height);

        // ── Core light-punch helper ───────────────────────────
        // type: 'warm' | 'cool' | 'neutral'
        // intensity: radius scale multiplier (default 1.0)
        const punchLight = (wx, wy, radius, type = 'neutral', intensity = 1.0) => {
            const { x, y } = toSS(wx, wy);
            const r         = radius * intensity;

            // — Step A: destination-out erase ——————————————
            lctx.globalCompositeOperation = 'destination-out';
            const erase = lctx.createRadialGradient(x, y, 0, x, y, r);
            erase.addColorStop(0,    'rgba(0,0,0,1)');
            erase.addColorStop(0.38, 'rgba(0,0,0,0.92)');
            erase.addColorStop(0.65, 'rgba(0,0,0,0.55)');
            erase.addColorStop(0.88, 'rgba(0,0,0,0.18)');
            erase.addColorStop(1,    'rgba(0,0,0,0)');
            lctx.fillStyle = erase;
            lctx.beginPath();
            lctx.arc(x, y, r, 0, Math.PI * 2);
            lctx.fill();

            // — Step B: coloured atmospheric tint ——————————
            // Drawn source-over so it only affects the revealed (non-dark) area
            lctx.globalCompositeOperation = 'source-over';
            const tintR  = r * 0.55;
            const tAlpha = 0.11 * darkness; // tint fades proportionally to darkness
            let   tInner, tOuter;

            if (type === 'warm') {
                // Amber / torch — player, shop kiosk
                tInner = `rgba(255,190,70,${tAlpha})`;
                tOuter = 'rgba(255,140,30,0)';
            } else if (type === 'cool') {
                // Cyan / tech — database server, data pillars, drone projectiles
                tInner = `rgba(60,220,255,${tAlpha})`;
                tOuter = 'rgba(0,180,255,0)';
            } else {
                // Neutral white — generic fallback
                tInner = `rgba(210,225,255,${tAlpha * 0.7})`;
                tOuter = 'rgba(180,205,255,0)';
            }

            const tint = lctx.createRadialGradient(x, y, 0, x, y, tintR);
            tint.addColorStop(0, tInner);
            tint.addColorStop(1, tOuter);
            lctx.fillStyle = tint;
            lctx.beginPath();
            lctx.arc(x, y, tintR, 0, Math.PI * 2);
            lctx.fill();
        };

        // ── ② Player light — warm torch glow ─────────────────
        if (player && !player.dead) {
            // Slightly larger radius when the player dashes (dramatic)
            const dashMult = player.isDashing ? 1.25 : 1.0;
            punchLight(player.x, player.y, L.playerLightRadius, 'warm', dashMult);
        }

        // ── ③ Projectile lights ───────────────────────────────
        // Player bullets (cyan drone shots, white bullets) → cool
        // Enemy / boss bullets                              → warm
        for (const proj of projectiles) {
            if (!proj || proj.dead) continue;
            const lightType = (proj.team === 'player') ? 'cool' : 'warm';
            punchLight(proj.x, proj.y, L.projectileLightRadius, lightType);
        }

        // ── ④ Map-object ambient lights ───────────────────────
        // Only emitters with actual visual glow get a light radius.
        // VIEW CULL: skip objects whose screen position is more than
        // MAX_LIGHT_RADIUS pixels outside the canvas — their gradient
        // can never reach visible pixels so the draw is pure waste.
        const MAX_LIGHT_RADIUS = Math.max(
            L.dataPillarLightRadius, L.serverRackLightRadius
        ) + 40; // 40 px safety margin

        for (const obj of this.objects) {
            if (obj.type === 'datapillar' || obj.type === 'server') {
                // Quick screen-space cull before touching the gradient API
                const cx = obj.x + obj.w * 0.5;
                const cy = obj.type === 'datapillar' ? obj.y - 5 : obj.y + obj.h * 0.4;
                const sp = toSS(cx, cy);
                if (sp.x + MAX_LIGHT_RADIUS < 0 || sp.x - MAX_LIGHT_RADIUS > lc.width)  continue;
                if (sp.y + MAX_LIGHT_RADIUS < 0 || sp.y - MAX_LIGHT_RADIUS > lc.height) continue;
            }

            if (obj.type === 'datapillar') {
                // Glowing circuit top of pillar
                punchLight(
                    obj.x + obj.w * 0.5,
                    obj.y - 5,            // capital top position
                    L.dataPillarLightRadius,
                    'cool'
                );
            } else if (obj.type === 'server') {
                // Cold server-room glow from blinking status lights
                punchLight(
                    obj.x + obj.w * 0.5,
                    obj.y + obj.h * 0.4,
                    L.serverRackLightRadius,
                    'cool'
                );
            }
        }

        // ── ⑤ Extra lights passed from game.js ───────────────
        // (MTC Database Server, Shop Kiosk, etc.)
        for (const light of extraLights) {
            punchLight(
                light.x,
                light.y,
                light.radius  || 100,
                light.type    || 'neutral',
                light.intensity || 1.0
            );
        }

        // ── ⑥ MTC Room interior — warm safe-zone lamp ─────────
        if (this.mtcRoom) {
            // Centre of classroom
            const rx = this.mtcRoom.x + this.mtcRoom.w * 0.5;
            const ry = this.mtcRoom.y + this.mtcRoom.h * 0.5;
            punchLight(rx, ry, 180, 'warm', 1.1);
        }

        // ── ⑦ Reset composite and blit to main canvas ─────────
        lctx.globalCompositeOperation = 'source-over';
        CTX.drawImage(lc, 0, 0);
    }

    clear() {
        this.objects = [];
        this.mtcRoom = null;
        this.initialized = false;
        // Keep _lightCanvas alive — it will be resized on next init()
    }

    getObjects() {
        return this.objects;
    }

    isBlocked(x, y, radius = 0) {
        for (const obj of this.objects) {
            if (obj.checkCollision(x, y, radius)) return true;
        }
        return false;
    }

    findSafeSpawn(preferredX, preferredY, radius) {
        const maxAttempts = 50;

        for (let i = 0; i < maxAttempts; i++) {
            const angle = (Math.PI * 2 / maxAttempts) * i;
            const distance = 100 + i * 50;
            const x = preferredX + Math.cos(angle) * distance;
            const y = preferredY + Math.sin(angle) * distance;

            if (!this.isBlocked(x, y, radius)) return { x, y };
        }

        return { x: preferredX, y: preferredY };
    }
}

const mapSystem = new MapSystem();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MapObject, MTCRoom, MapSystem, mapSystem };
}