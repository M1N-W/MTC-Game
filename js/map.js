'use strict';
/**
 * 🏫 MTC the Game Beta Edition - Campus Map System (ARCHITECTURAL OVERHAUL)
 *
 * CHANGES:
 * - 🏗️ Architectural Level Design: No more random scatter. Objects are placed in strict grids/rows.
 * - 🏰 MTC Citadel: The MTC Room is now a physical bunker in the North with solid walls and a forcefield.
 * - 🏛️ Distinct Zones: Server Aisles (East), Library Maze (West), Symmetry Courtyard (South).
 */

let _mapNow = 0;
function _updateMapNow() { _mapNow = performance.now(); }

// ════════════════════════════════════════════════════════════
// 🎨 STANDALONE DRAW HELPERS
// ════════════════════════════════════════════════════════════
function drawDesk(w, h) {
    const pal = BALANCE.map.mapColors;
    const dp = MAP_CONFIG.objects.desk;
    CTX.fillStyle = pal.deskTop;
    CTX.beginPath(); CTX.roundRect(0, 0, w, h, 4); CTX.fill();
    CTX.strokeStyle = pal.deskLegs; CTX.lineWidth = 1; CTX.globalAlpha = 0.35;
    for (let gx = 6; gx < w - 4; gx += 10) { CTX.beginPath(); CTX.moveTo(gx, 2); CTX.lineTo(gx + 3, h - 2); CTX.stroke(); }
    CTX.globalAlpha = 1;
    CTX.fillStyle = dp.screenGlow;
    CTX.beginPath(); CTX.roundRect(3, 2, w - 6, 6, 2); CTX.fill();
    CTX.fillStyle = pal.deskLegs; CTX.fillRect(4, h, 6, 6); CTX.fillRect(w - 10, h, 6, 6);
    CTX.fillStyle = dp.monitorBody;
    CTX.beginPath(); CTX.roundRect(Math.floor(w * .1), Math.floor(h * .2), Math.floor(w * .45), Math.floor(h * .55), 2); CTX.fill();
    CTX.fillStyle = dp.monitorText;
    CTX.fillRect(Math.floor(w * .12), Math.floor(h * .22), Math.floor(w * .2), 2);
    CTX.fillRect(Math.floor(w * .12), Math.floor(h * .28), Math.floor(w * .35), 2);
    CTX.fillStyle = dp.notePaper; CTX.fillRect(Math.floor(w * .65), Math.floor(h * .25), Math.floor(w * .25), 4);
    CTX.fillStyle = dp.notePen; CTX.fillRect(Math.floor(w * .65) - 4, Math.floor(h * .25), 4, 4);
}

function drawTree(size) {
    const pal = BALANCE.map.mapColors;
    const dt = MAP_CONFIG.objects.tree;
    const t = _mapNow / 2000;
    CTX.fillStyle = dt.shadowFill;
    CTX.beginPath(); CTX.ellipse(0, size * .3, size * .7, size * .2, 0, 0, Math.PI * 2); CTX.fill();
    CTX.fillStyle = pal.treeTrunk;
    CTX.beginPath(); CTX.roundRect(-5, -size * .15, 10, size * .5, 3); CTX.fill();
    CTX.fillStyle = pal.treeDark; CTX.beginPath(); CTX.arc(0, -size * .1, size * .72, 0, Math.PI * 2); CTX.fill();
    CTX.fillStyle = pal.treeMid; CTX.beginPath(); CTX.arc(0, -size * .45, size * .58, 0, Math.PI * 2); CTX.fill();
    CTX.fillStyle = pal.treeLight; CTX.beginPath(); CTX.arc(0, -size * .78, size * .40, 0, Math.PI * 2); CTX.fill();
    CTX.fillStyle = dt.leafSparkle;
    for (let i = 0; i < 3; i++) {
        const a = t + (Math.PI * 2 / 3) * i, r = size * .3;
        CTX.beginPath(); CTX.arc(Math.cos(a) * r, -size * .45 + Math.sin(a) * r * .5, 3, 0, Math.PI * 2); CTX.fill();
    }
    CTX.strokeStyle = dt.leafHex; CTX.lineWidth = 1.5; CTX.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6, r = size * .42;
        i === 0 ? CTX.moveTo(Math.cos(a) * r, -size * .78 + Math.sin(a) * r) : CTX.lineTo(Math.cos(a) * r, -size * .78 + Math.sin(a) * r);
    }
    CTX.closePath(); CTX.stroke();
}

function drawServer(w, h) {
    const pal = BALANCE.map.mapColors;
    const ds = MAP_CONFIG.objects.server;
    const now = _mapNow;
    CTX.fillStyle = pal.serverBody;
    CTX.beginPath(); CTX.roundRect(0, 0, w, h, 5); CTX.fill();
    CTX.fillStyle = ds.inner; CTX.fillRect(4, 4, w - 8, h - 8);
    const unitH = Math.floor((h - 16) / 4);
    for (let u = 0; u < 4; u++) {
        const uy = 8 + u * unitH;
        CTX.fillStyle = ds.unitSlot;
        CTX.beginPath(); CTX.roundRect(6, uy, w - 12, unitH - 3, 2); CTX.fill();
        const blinkOffset = u * 317;
        const isOn = Math.sin((now + blinkOffset) / (400 + u * 100)) > 0;
        CTX.fillStyle = isOn ? pal.serverLightOn : pal.serverLightOff;
        CTX.shadowBlur = isOn ? 8 : 0; CTX.shadowColor = pal.serverLightOn;
        CTX.beginPath(); CTX.arc(12, uy + unitH * .45, 3, 0, Math.PI * 2); CTX.fill(); CTX.shadowBlur = 0;
        for (let d = 0; d < 3; d++) {
            const dOn = Math.sin((now + blinkOffset + d * 150) / 200) > 0.6;
            CTX.fillStyle = dOn ? ds.dataLedOn : ds.dataLedOff;
            CTX.fillRect(18 + d * 6, uy + unitH * .3, 4, 4);
        }
        CTX.strokeStyle = ds.ventStroke; CTX.lineWidth = 0.8;
        for (let vx = w - 20; vx < w - 8; vx += 3) { CTX.beginPath(); CTX.moveTo(vx, uy + 3); CTX.lineTo(vx, uy + unitH - 4); CTX.stroke(); }
    }
    CTX.fillStyle = ds.headerFill; CTX.fillRect(4, 0, w - 8, 4);
    CTX.strokeStyle = ds.headerVent; CTX.lineWidth = 0.8;
    for (let vx = 8; vx < w - 8; vx += 4) { CTX.beginPath(); CTX.moveTo(vx, 0); CTX.lineTo(vx, 4); CTX.stroke(); }
    CTX.fillStyle = ds.portFill;
    for (let p = 0; p < 3; p++) CTX.fillRect(6 + p * 10, h - 7, 7, 4);
}

function drawDataPillar(w, h) {
    const pal = BALANCE.map.mapColors;
    const ddp = MAP_CONFIG.objects.datapillar;
    const now = _mapNow;
    const glow = Math.sin(now / 800) * 0.4 + 0.6;
    CTX.fillStyle = ddp.shadowFill;
    CTX.beginPath(); CTX.ellipse(w / 2, h + 4, w * .55, 7, 0, 0, Math.PI * 2); CTX.fill();
    CTX.fillStyle = ddp.baseDark; CTX.beginPath(); CTX.roundRect(-4, h - 8, w + 8, 10, 2); CTX.fill();
    CTX.fillStyle = ddp.baseLight; CTX.beginPath(); CTX.roundRect(-4, -6, w + 8, 9, 2); CTX.fill();
    const grad = CTX.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, ddp.bodyGrad[0]); grad.addColorStop(0.4, ddp.bodyGrad[1]); grad.addColorStop(1, ddp.bodyGrad[2]);
    CTX.fillStyle = grad; CTX.fillRect(0, 0, w, h - 6);
    CTX.strokeStyle = `${ddp.circuit}${glow * .8})`; CTX.lineWidth = 1.2;
    CTX.shadowBlur = 6; CTX.shadowColor = pal.pillarCircuit;
    CTX.beginPath(); CTX.moveTo(w * .35, 4); CTX.lineTo(w * .35, h * .25); CTX.lineTo(w * .6, h * .35);
    CTX.lineTo(w * .6, h * .55); CTX.lineTo(w * .3, h * .65); CTX.lineTo(w * .3, h * .85); CTX.stroke();
    CTX.beginPath(); CTX.moveTo(w * .35, h * .25); CTX.lineTo(w * .7, h * .25);
    CTX.moveTo(w * .6, h * .55); CTX.lineTo(w * .15, h * .55); CTX.stroke();
    CTX.fillStyle = pal.pillarCircuit;
    const nodes = [[w * .35, h * .25], [w * .6, h * .35], [w * .6, h * .55], [w * .3, h * .65]];
    for (const [nx, ny] of nodes) { CTX.beginPath(); CTX.arc(nx, ny, 2.5, 0, Math.PI * 2); CTX.fill(); }
    CTX.shadowBlur = 0;
    CTX.fillStyle = `${ddp.circuit}${glow})`; CTX.shadowBlur = 10; CTX.shadowColor = pal.pillarCircuit;
    CTX.beginPath(); CTX.arc(w / 2, -2, 3, 0, Math.PI * 2); CTX.fill(); CTX.shadowBlur = 0;
}

function drawBookshelf(w, h) {
    const pal = BALANCE.map.mapColors;
    const db = MAP_CONFIG.objects.bookshelf;
    const bookColors = pal.bookColors;
    CTX.fillStyle = db.frameBody; CTX.beginPath(); CTX.roundRect(0, 0, w, h, 3); CTX.fill();
    CTX.fillStyle = db.frameSide; CTX.fillRect(0, 0, 5, h); CTX.fillRect(w - 5, 0, 5, h);
    const shelfCount = 3, shelfH = (h - 6) / shelfCount;
    for (let s = 0; s < shelfCount; s++) {
        const sy = 3 + s * shelfH;
        CTX.fillStyle = db.shelfBoard; CTX.fillRect(5, sy + shelfH - 4, w - 10, 5);
        let bx = 7, bookIdx = (s * 7) % bookColors.length;
        while (bx < w - 12) {
            const bw = 8 + Math.floor(Math.abs(Math.sin(bx * .3 + s)) * 8);
            const bh = shelfH * (0.55 + Math.abs(Math.sin(bx * .7)) * .3);
            CTX.fillStyle = bookColors[bookIdx % bookColors.length];
            CTX.beginPath(); CTX.roundRect(bx, sy + shelfH - 4 - bh, bw, bh, 1); CTX.fill();
            CTX.fillStyle = db.bookGloss; CTX.fillRect(bx + 1, sy + shelfH - 4 - bh + 2, 2, bh - 4);
            CTX.fillStyle = db.bookShadow; CTX.fillRect(bx + bw * .25, sy + shelfH - 4 - bh + bh * .3, bw * .5, 1.5);
            bx += bw + 1; bookIdx++;
        }
    }
}

// ════════════════════════════════════════════════════════════
// 🗺️ MAP OBJECT CLASS
// ════════════════════════════════════════════════════════════
class MapObject {
    constructor(x, y, w, h, type) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.type = type; this.solid = (type !== 'decoration');
    }

    checkCollision(cx, cy, radius) {
        if (!this.solid) return false;
        return circleRectCollision(cx, cy, radius, this.x, this.y, this.w, this.h);
    }

    resolveCollision(entity) {
        if (!this.solid) return;
        const closestX = clamp(entity.x, this.x, this.x + this.w);
        const closestY = clamp(entity.y, this.y, this.y + this.h);
        const dx = entity.x - closestX, dy = entity.y - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < entity.radius) {
            const overlap = entity.radius - distance;
            if (distance > 0) { entity.x += (dx / distance) * overlap; entity.y += (dy / distance) * overlap; }
            else { entity.x += overlap; }
            entity.vx *= 0.5; entity.vy *= 0.5;
        }
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        CTX.save(); CTX.translate(screen.x, screen.y);
        switch (this.type) {
            case 'desk': drawDesk(this.w, this.h); break;
            case 'tree': drawTree(this.w / 2); break;
            case 'server': drawServer(this.w, this.h); break;
            case 'datapillar': drawDataPillar(this.w, this.h); break;
            case 'bookshelf': drawBookshelf(this.w, this.h); break;
            case 'blackboard': this.drawBlackboard(); break;
            case 'wall': this.drawWall(); break;
            case 'mtcwall': this.drawMTCWall(); break; // New high-tech wall
            case 'chair': this.drawChair(); break;     // กู้คืนป้องกัน Error
            case 'cabinet': this.drawCabinet(); break; // กู้คืนป้องกัน Error
        }
        CTX.restore();
    }

    drawMTCWall() {
        const now = _mapNow;
        CTX.fillStyle = '#0a0c0e'; // Dark near-black base
        CTX.beginPath(); CTX.roundRect(0, 0, this.w, this.h, 4); CTX.fill();

        CTX.strokeStyle = '#d97706'; CTX.lineWidth = 2; // Gold neon border
        CTX.stroke();

        // Pulsing neon strip in the middle
        const pulse = 0.5 + Math.sin(now / 300) * 0.5;
        CTX.fillStyle = `rgba(217, 119, 6, ${0.3 + pulse * 0.5})`;

        if (this.w > this.h) { // Horizontal wall
            CTX.fillRect(10, this.h / 2 - 2, this.w - 20, 4);
        } else { // Vertical wall
            CTX.fillRect(this.w / 2 - 2, 10, 4, this.h - 20);
        }
    }

    drawChair() {
        CTX.fillStyle = '#1c1408'; CTX.fillRect(5, 0, this.w - 10, this.h - 15);
        CTX.fillStyle = '#2d1f0a'; CTX.fillRect(0, this.h - 15, this.w, 15);
        CTX.fillStyle = '#120c04'; CTX.fillRect(3, this.h - 12, 4, 12); CTX.fillRect(this.w - 7, this.h - 12, 4, 12);
    }

    drawCabinet() {
        CTX.fillStyle = '#92400e'; CTX.fillRect(0, 0, this.w, this.h);
        CTX.fillStyle = '#78350f';
        CTX.fillRect(4, 4, this.w / 2 - 8, this.h - 8); CTX.fillRect(this.w / 2 + 4, 4, this.w / 2 - 8, this.h - 8);
        CTX.fillStyle = '#fbbf24';
        CTX.beginPath(); CTX.arc(this.w / 4, this.h / 2, 4, 0, Math.PI * 2); CTX.fill();
        CTX.beginPath(); CTX.arc(3 * this.w / 4, this.h / 2, 4, 0, Math.PI * 2); CTX.fill();
    }

    drawBlackboard() {
        const pal = BALANCE.map.mapColors;
        CTX.fillStyle = '#451a03'; CTX.beginPath(); CTX.roundRect(0, 0, this.w, this.h, 4); CTX.fill();
        CTX.fillStyle = pal.whiteboardGreen; CTX.beginPath(); CTX.roundRect(6, 5, this.w - 12, this.h - 10, 2); CTX.fill();
        CTX.fillStyle = pal.chalkWhite; CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        CTX.font = `bold ${Math.floor(this.h * .22)}px monospace`; CTX.fillText('ax²+bx+c = 0', this.w / 2, this.h * .35);
        CTX.fillStyle = '#78350f'; CTX.fillRect(6, this.h - 6, this.w - 12, 5);
    }

    drawWall() {
        const pal = BALANCE.map.mapColors;
        CTX.fillStyle = pal.wallColor; CTX.fillRect(0, 0, this.w, this.h);
        CTX.strokeStyle = pal.wallBrick; CTX.lineWidth = 1.5;
        for (let y = 0; y < this.h; y += 25) {
            for (let x = 0; x < this.w; x += 50) {
                const offset = (Math.floor(y / 25) % 2) * 25;
                CTX.strokeRect(x + offset, y, 50, 25);
            }
        }
    }
}

// ════════════════════════════════════════════════════════════
// 🛢️ EXPLOSIVE BARREL
// ════════════════════════════════════════════════════════════
class ExplosiveBarrel extends MapObject {
    constructor(x, y) {
        super(x, y, 30, 38, 'barrel');
        this.hp = 50; this.maxHp = 50; this.isExploded = false; this.radius = 35;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        const cx = screen.x + this.w / 2, cy = screen.y + this.h / 2;
        const now = _mapNow, W = this.w, H = this.h;

        CTX.save(); CTX.translate(screen.x, screen.y);
        CTX.fillStyle = 'rgba(0,0,0,0.30)'; CTX.beginPath(); CTX.ellipse(W / 2, H + 5, W * 0.55, 6, 0, 0, Math.PI * 2); CTX.fill();

        const hpFrac = this.hp / this.maxHp;
        const bodyR = Math.round(140 + (1 - hpFrac) * 80), bodyG = Math.round(20 + (1 - hpFrac) * 40);
        CTX.fillStyle = `rgb(${bodyR},${bodyG},20)`; CTX.strokeStyle = '#1c0a00'; CTX.lineWidth = 2;
        CTX.beginPath(); CTX.roundRect(0, 4, W, H - 8, 5); CTX.fill(); CTX.stroke();

        CTX.fillStyle = `rgb(${Math.round(bodyR * 0.7)},${Math.round(bodyG * 0.7)},15)`;
        CTX.beginPath(); CTX.roundRect(2, 0, W - 4, 8, 3); CTX.fill(); CTX.stroke();
        CTX.beginPath(); CTX.roundRect(2, H - 8, W - 4, 8, 3); CTX.fill(); CTX.stroke();

        CTX.save(); CTX.beginPath(); CTX.roundRect(1, 5, W - 2, H - 10, 4); CTX.clip();
        CTX.fillStyle = 'rgba(250,204,21,0.75)';
        for (let i = -2; i < 6; i++) {
            const sx = i * 18;
            CTX.beginPath(); CTX.moveTo(sx, 5); CTX.lineTo(sx + 9, 5); CTX.lineTo(sx + 9 - (H - 10) * 0.5, H - 5); CTX.lineTo(sx - (H - 10) * 0.5, H - 5); CTX.fill();
        }
        CTX.restore();
        CTX.font = '12px Arial'; CTX.textAlign = 'center'; CTX.textBaseline = 'middle'; CTX.fillText('⚠️', W / 2, H / 2);
        CTX.restore();

        if (this.hp < this.maxHp) {
            const pct = Math.max(0, this.hp / this.maxHp);
            const barCol = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';
            CTX.fillStyle = 'rgba(0,0,0,0.60)'; CTX.fillRect(cx - 17, screen.y - 10, 34, 5);
            CTX.fillStyle = barCol; CTX.fillRect(cx - 17, screen.y - 10, 34 * pct, 5);
            CTX.strokeStyle = 'rgba(0,0,0,0.80)'; CTX.lineWidth = 1; CTX.strokeRect(cx - 17, screen.y - 10, 34, 5);
        }
    }
}

// ════════════════════════════════════════════════════════════
// 🏰 THE MTC CITADEL (Safe Zone Revamped)
// ════════════════════════════════════════════════════════════
class MTCRoom {
    constructor(x, y) {
        this.x = x; this.y = y;
        // The logical trigger area (inside the bunker walls)
        this.w = 300; this.h = 240;
        this.healRate = BALANCE.mtcRoom.healRate;
        this.maxStayTime = BALANCE.mtcRoom.maxStayTime;
        this.cooldownTime = BALANCE.mtcRoom.cooldownTime;
        this.playerStayTime = 0; this.cooldown = 0; this.isPlayerInside = false;
    }

    update(dt, player) {
        this.cooldown = Math.max(0, this.cooldown - dt);
        const inside = this.checkPlayerInside(player.x, player.y);

        if (inside && this.cooldown <= 0) {
            if (!this.isPlayerInside) {
                this.isPlayerInside = true; this.playerStayTime = 0;
                spawnFloatingText('SAFE ZONE!', player.x, player.y - 60, '#fbbf24', 25);
                showVoiceBubble('เข้าสู่ MTC Room - เริ่มกระบวนการฟื้นฟู', player.x, player.y - 40);
            }
            this.playerStayTime += dt;
            if (player.hp < player.maxHp) {
                player.hp = Math.min(player.maxHp, player.hp + this.healRate * dt);
                if (Math.random() < 0.3) spawnParticles(player.x + rand(-20, 20), player.y + rand(-20, 20), 1, '#fbbf24');
            }
            if (player.energy < player.maxEnergy) player.energy = Math.min(player.maxEnergy, player.energy + 30 * dt);
            if (this.playerStayTime >= this.maxStayTime) this.kickOut(player);
        } else {
            if (this.isPlayerInside) this.isPlayerInside = false;
        }
    }

    checkPlayerInside(px, py) {
        return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
    }

    kickOut(player) {
        this.isPlayerInside = false; this.cooldown = this.cooldownTime;
        spawnFloatingText('พลังงานหมด!', player.x, player.y - 60, '#f59e0b', 20);
        showVoiceBubble('MTC Room เข้าสู่สถานะ Cooldown', player.x, player.y - 40);
        // Push south out the entrance
        player.vx = 0; player.vy = 250;
    }

    draw() {
        const s = worldToScreen(this.x, this.y);
        const W = this.w, H = this.h;
        const now = _mapNow;
        const cx = s.x + W / 2, cy = s.y + H / 2;
        const active = this.cooldown <= 0;

        // ── Pre-compute all Math.sin() ONCE ──
        const sinSlow = Math.sin(now / 350);   // pulse ~0.7-1.0
        const sinFast = Math.sin(now / 180);   // fastPulse ~0-1
        const sinBlink = Math.sin(now / 200);   // blink warning
        const pulse = active ? (sinSlow * 0.3 + 0.7) : 0.2;
        const fastPulse = active ? (sinFast * 0.5 + 0.5) : 0;
        const scanLine = (now / 8) % H;

        CTX.save();

        // ── 1. Floor (single-pass grid, no shadowBlur) ──
        CTX.beginPath(); CTX.rect(s.x, s.y, W, H); CTX.clip();
        CTX.fillStyle = '#080f1e';
        CTX.fillRect(s.x, s.y, W, H);

        // Single combined grid path — far cheaper than many stroke() calls
        CTX.beginPath();
        CTX.strokeStyle = 'rgba(217,119,6,0.13)';
        CTX.lineWidth = 0.8;
        for (let ty = 0; ty <= H; ty += 40) { CTX.moveTo(s.x, s.y + ty); CTX.lineTo(s.x + W, s.y + ty); }
        for (let tx = 0; tx <= W; tx += 40) { CTX.moveTo(s.x + tx, s.y); CTX.lineTo(s.x + tx, s.y + H); }
        CTX.stroke(); // ONE stroke call for all grid lines

        // Scan line (active only, no gradient — use flat semi-transparent rect)
        if (active) {
            CTX.fillStyle = `rgba(217,119,6,${0.07 * pulse})`;
            CTX.fillRect(s.x, s.y + scanLine - 4, W, 8);
        }

        // Corner brackets (all in one path)
        const bSize = 16;
        CTX.beginPath();
        CTX.strokeStyle = `rgba(250,180,30,${0.45 + fastPulse * 0.35})`;
        CTX.lineWidth = 1.5;
        // TL
        CTX.moveTo(s.x + 4, s.y + 4 + bSize); CTX.lineTo(s.x + 4, s.y + 4); CTX.lineTo(s.x + 4 + bSize, s.y + 4);
        // TR
        CTX.moveTo(s.x + W - 4 - bSize, s.y + 4); CTX.lineTo(s.x + W - 4, s.y + 4); CTX.lineTo(s.x + W - 4, s.y + 4 + bSize);
        // BL
        CTX.moveTo(s.x + 4, s.y + H - 4 - bSize); CTX.lineTo(s.x + 4, s.y + H - 4); CTX.lineTo(s.x + 4 + bSize, s.y + H - 4);
        // BR
        CTX.moveTo(s.x + W - 4 - bSize, s.y + H - 4); CTX.lineTo(s.x + W - 4, s.y + H - 4); CTX.lineTo(s.x + W - 4, s.y + H - 4 - bSize);
        CTX.stroke(); // ONE stroke call for all brackets

        CTX.restore(); // end floor clip

        // ── 2. Central Holo-Table (no shadowBlur — use bright stroke instead) ──
        const holoW = 130, holoH = 65;
        const holoX = cx - holoW / 2, holoY = cy - holoH / 2;

        CTX.fillStyle = '#0f1208';
        CTX.beginPath(); CTX.roundRect(holoX, holoY, holoW, holoH, 8); CTX.fill();

        // Border glow: fake it with thick+thin double stroke (no shadowBlur needed)
        if (active) {
            CTX.strokeStyle = `rgba(217,119,6,${0.15 + fastPulse * 0.1})`;
            CTX.lineWidth = 6;
            CTX.beginPath(); CTX.roundRect(holoX, holoY, holoW, holoH, 8); CTX.stroke();
        }
        CTX.strokeStyle = active ? `rgba(250,180,30,${0.6 + fastPulse * 0.4})` : '#2d1f0a';
        CTX.lineWidth = 1.5;
        CTX.beginPath(); CTX.roundRect(holoX, holoY, holoW, holoH, 8); CTX.stroke();

        // Hologram cone above table (no shadowBlur)
        if (active) {
            const holoHeight = 28 + fastPulse * 6;
            CTX.fillStyle = `rgba(217,119,6,${0.06 * pulse})`;
            CTX.beginPath();
            CTX.moveTo(cx - 3, holoY - holoHeight);
            CTX.lineTo(cx - holoW * 0.35, holoY);
            CTX.lineTo(cx + holoW * 0.35, holoY);
            CTX.lineTo(cx + 3, holoY - holoHeight);
            CTX.closePath(); CTX.fill();

            // Rotating hex (no shadowBlur — use opacity instead)
            CTX.save();
            CTX.translate(cx, holoY - 16);
            CTX.rotate(now / 2000);
            CTX.strokeStyle = `rgba(250,180,30,${0.6 + fastPulse * 0.3})`;
            CTX.lineWidth = 1.5;
            CTX.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i;
                i === 0 ? CTX.moveTo(Math.cos(a) * 10, Math.sin(a) * 10) : CTX.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
            }
            CTX.closePath(); CTX.stroke();
            CTX.restore();
        }

        // Table screen content
        CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        if (active) {
            // Status bars (precompute sin values)
            const bars = [
                { w: (holoW - 30) * (0.4 + Math.sin(now / 600) * 0.3), col: 'rgba(250,180,30,0.55)' },
                { w: (holoW - 30) * (0.4 + Math.sin(now / 800 + 1) * 0.3), col: 'rgba(217,119,6,0.55)' },
                { w: (holoW - 30) * (0.4 + Math.sin(now / 700 + 2) * 0.3), col: 'rgba(249,115,22,0.55)' },
            ];
            for (let i = 0; i < 3; i++) {
                CTX.fillStyle = 'rgba(255,255,255,0.06)';
                CTX.fillRect(holoX + 15, holoY + 12 + i * 14, holoW - 30, 5);
                CTX.fillStyle = bars[i].col;
                CTX.fillRect(holoX + 15, holoY + 12 + i * 14, bars[i].w, 5);
            }
            CTX.fillStyle = 'rgba(254,243,199,0.9)';
            CTX.font = 'bold 9px monospace';
            CTX.fillText('MTC SYSTEM ONLINE', cx, holoY + holoH - 12);
        } else {
            CTX.fillStyle = 'rgba(239,68,68,0.12)';
            CTX.beginPath(); CTX.roundRect(holoX + 4, holoY + 4, holoW - 8, holoH - 8, 6); CTX.fill();
            CTX.fillStyle = '#ef4444';
            CTX.font = 'bold 9px monospace';
            CTX.fillText(`REBOOTING: ${Math.ceil(this.cooldown)}s`, cx, cy);
            if (sinBlink > 0) {
                CTX.fillStyle = 'rgba(239,68,68,0.7)';
                CTX.font = 'bold 11px monospace';
                CTX.fillText('⚠', cx, cy - 18);
            }
        }

        // ── 3. Side Terminals (no shadowBlur — LED dot uses bright color only) ──
        const termY = s.y + H / 2 - 22;
        const termDefs = [
            { x: s.x + 18, color: '#fbbf24', rgb: '251,191,36' },
            { x: s.x + W - 42, color: '#f97316', rgb: '249,115,22' }
        ];
        for (const term of termDefs) {
            CTX.fillStyle = '#0f0c04';
            CTX.beginPath(); CTX.roundRect(term.x, termY, 24, 44, 4); CTX.fill();
            CTX.strokeStyle = active ? `rgba(${term.rgb},${0.5 + fastPulse * 0.3})` : '#2d1f0a';
            CTX.lineWidth = 1.5; CTX.stroke();
            // All LED dots in one pass per terminal — batch by on/off state
            CTX.fillStyle = '#451a03'; // default off
            for (let d = 0; d < 4; d++) {
                const isOn = active && Math.sin(now / (300 + d * 120) + d * 1.5) > 0;
                CTX.fillStyle = isOn ? term.color : '#451a03';
                CTX.beginPath(); CTX.arc(term.x + 12, termY + 8 + d * 9, 3, 0, Math.PI * 2); CTX.fill();
            }
        }

        // ── 4. Entrance Forcefield (no shadowBlur — use double-line trick) ──
        if (active) {
            const ffAlpha = pulse * 0.8;
            // Soft outer line
            CTX.strokeStyle = `rgba(180,100,10,${ffAlpha * 0.4})`;
            CTX.lineWidth = 6;
            CTX.beginPath(); CTX.moveTo(s.x + 20, s.y + H); CTX.lineTo(s.x + W - 20, s.y + H); CTX.stroke();
            // Bright core line
            CTX.strokeStyle = `rgba(250,180,30,${ffAlpha})`;
            CTX.lineWidth = 2;
            CTX.beginPath(); CTX.moveTo(s.x + 20, s.y + H); CTX.lineTo(s.x + W - 20, s.y + H); CTX.stroke();

            // Energy posts (2 dots, no shadowBlur)
            for (const px of [s.x + 20, s.x + W - 20]) {
                CTX.fillStyle = `rgba(250,180,30,${0.25 + fastPulse * 0.2})`;
                CTX.beginPath(); CTX.arc(px, s.y + H, 7, 0, Math.PI * 2); CTX.fill();
                CTX.fillStyle = `rgba(251,191,36,${0.8 + fastPulse * 0.2})`;
                CTX.beginPath(); CTX.arc(px, s.y + H, 3, 0, Math.PI * 2); CTX.fill();
            }

            // SAFE ZONE label
            CTX.fillStyle = `rgba(180,100,10,0.15)`;
            CTX.beginPath(); CTX.roundRect(cx - 68, s.y + H - 21, 136, 17, 5); CTX.fill();
            CTX.fillStyle = `rgba(250,180,30,${0.7 + pulse * 0.3})`;
            CTX.font = 'bold 9px Orbitron,monospace';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText('⚕ SAFE ZONE ACTIVE', cx, s.y + H - 13);
        }

        // ── 5. Player Inside Timer (arc, no shadowBlur) ──
        if (this.isPlayerInside) {
            const timeLeft = this.maxStayTime - this.playerStayTime;
            const timerPct = timeLeft / this.maxStayTime;
            const timerColor = timerPct > 0.5 ? '#fbbf24' : timerPct > 0.25 ? '#f59e0b' : '#ef4444';
            const timerCx = cx, timerCy = s.y + H - 42;

            // Track ring
            CTX.strokeStyle = 'rgba(255,255,255,0.08)';
            CTX.lineWidth = 5;
            CTX.beginPath(); CTX.arc(timerCx, timerCy, 18, 0, Math.PI * 2); CTX.stroke();
            // Progress arc
            CTX.strokeStyle = timerColor;
            CTX.lineWidth = 5;
            CTX.beginPath();
            CTX.arc(timerCx, timerCy, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * timerPct);
            CTX.stroke();
            // Timer text
            CTX.fillStyle = timerColor;
            CTX.font = `bold ${timeLeft < 3 ? '13' : '11'}px monospace`;
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(timeLeft.toFixed(1), timerCx, timerCy);
        }
    }
}

// ════════════════════════════════════════════════════════════
// 🗺️ MAP SYSTEM
// ════════════════════════════════════════════════════════════
class MapSystem {
    constructor() {
        this.objects = [];
        this.mtcRoom = null;
        this.initialized = false;
        this._lightCanvas = null;
        this._lightCtx = null;
    }

    init() {
        if (this.initialized) return;
        this.objects = [];

        if (!this._lightCanvas) {
            this._lightCanvas = document.createElement('canvas');
            this._lightCtx = this._lightCanvas.getContext('2d');
        }

        this.generateCampusMap();
        this._sortedObjects = null;
        this.initialized = true;
        console.log(`✅ Campus Map Generated Structurally: ${this.objects.length} objects`);
    }

    generateCampusMap() {
        // ── 1. The MTC Citadel (North Base) ──
        // Move safe zone to top center
        const mtcX = -150, mtcY = -700, mtcW = 300, mtcH = 240;
        this.mtcRoom = new MTCRoom(mtcX, mtcY);

        // Build Physical High-Tech Walls around the MTC Room (U-Shape)
        const wallThick = 40;
        // Top wall
        this.objects.push(new MapObject(mtcX - wallThick, mtcY - wallThick, mtcW + wallThick * 2, wallThick, 'mtcwall'));
        // Left wall
        this.objects.push(new MapObject(mtcX - wallThick, mtcY, wallThick, mtcH, 'mtcwall'));
        // Right wall
        this.objects.push(new MapObject(mtcX + mtcW, mtcY, wallThick, mtcH, 'mtcwall'));

        // Add decorative servers inside the citadel (top corners)
        this.objects.push(new MapObject(mtcX + 10, mtcY + 10, 45, 80, 'server'));
        this.objects.push(new MapObject(mtcX + mtcW - 55, mtcY + 10, 45, 80, 'server'));


        // ── 2. Structural Zone Generation ──
        // Helper to place rows of objects neatly
        const createAisles = (startX, startY, rows, cols, xStep, yStep, type, jitter = 0) => {
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const sz = {
                        desk: { w: 60, h: 40 }, tree: { w: 50, h: 50 },
                        server: { w: 45, h: 80 }, datapillar: { w: 35, h: 70 },
                        bookshelf: { w: 80, h: 40 }
                    }[type];
                    let jx = (Math.random() - 0.5) * jitter;
                    let jy = (Math.random() - 0.5) * jitter;
                    this.objects.push(new MapObject(startX + c * xStep + jx, startY + r * yStep + jy, sz.w, sz.h, type));
                }
            }
        };

        // Zone A: Server Farm (East Sector) - Neat rows
        createAisles(400, -300, 4, 3, 120, 150, 'server');
        createAisles(800, -300, 4, 3, 120, 150, 'server');
        // Add data pillars at the ends of aisles
        createAisles(330, -260, 4, 1, 0, 150, 'datapillar');

        // Zone B: Library Archives (West Sector) - Maze-like long shelves
        createAisles(-850, -300, 5, 2, 250, 120, 'bookshelf');
        createAisles(-1150, -300, 5, 2, 250, 120, 'bookshelf');
        // Study desks between shelves
        createAisles(-980, -280, 4, 1, 0, 120, 'desk');

        // Zone C: The Grand Courtyard (South Sector) - Symmetrical Trees
        createAisles(-400, 500, 3, 5, 200, 200, 'tree', 15); // Slight jitter for organics

        // Zone D: Lecture Halls (Bottom Left & Right corners)
        createAisles(-1000, 600, 3, 3, 100, 100, 'desk');
        this.objects.push(new MapObject(-950, 480, 150, 80, 'blackboard')); // Teacher area

        createAisles(700, 600, 3, 3, 100, 100, 'desk');
        this.objects.push(new MapObject(750, 480, 150, 80, 'blackboard')); // Teacher area


        // ── 3. Arena Boundaries ──
        for (const wall of BALANCE.map.wallPositions) {
            this.objects.push(new MapObject(wall.x, wall.y, wall.w, wall.h, 'wall'));
        }

        // ── 4. Strategic Explosive Barrels ──
        // Placed in choke points and aisle intersections
        const barrelSpots = [
            { x: 350, y: -100 }, { x: 750, y: -100 }, // Near servers
            { x: 350, y: 150 }, { x: 750, y: 150 },
            { x: -600, y: -150 }, { x: -900, y: -150 }, // Near library
            { x: -600, y: 150 }, { x: -900, y: 150 },
            { x: -250, y: 400 }, { x: 250, y: 400 }, // Entering courtyard
            { x: 0, y: -300 } // Defensive barrel below Citadel
        ];

        for (let spot of barrelSpots) {
            // Check collision just in case
            let tooClose = false;
            for (const obj of this.objects) {
                if (Math.hypot(obj.x - spot.x, obj.y - spot.y) < 60) { tooClose = true; break; }
            }
            if (!tooClose) {
                this.objects.push(new ExplosiveBarrel(spot.x, spot.y));
            }
        }
    }

    update(entities, dt = 0) {
        for (const entity of entities) {
            if (entity.dead) continue;
            for (const obj of this.objects) obj.resolveCollision(entity);
        }
        if (this.mtcRoom && window.player) {
            this.mtcRoom.update(dt, window.player);
        }
    }

    drawTerrain(ctx, camera) {
        if (typeof MAP_CONFIG === 'undefined') return;

        const C = MAP_CONFIG;
        const ws = (wx, wy) => worldToScreen(wx, wy);
        const t = performance.now() * 0.001;

        // ── 1. ARENA BOUNDARY ────────────────────────────────────
        {
            const A = C.arena;
            const origin = ws(0, 0);
            const edgePt = ws(A.radius, 0);
            const radiusSS = Math.abs(edgePt.x - origin.x);

            ctx.save();
            ctx.strokeStyle = A.haloColor.replace('{a}', (A.haloAlphaBase + Math.sin(t * 0.6) * 0.03).toFixed(3));
            ctx.lineWidth = 52; ctx.beginPath(); ctx.arc(origin.x, origin.y, radiusSS, 0, Math.PI * 2); ctx.stroke();

            ctx.strokeStyle = A.midColor.replace('{a}', (A.midAlphaBase + Math.sin(t * 0.9) * 0.04).toFixed(3));
            ctx.lineWidth = 20; ctx.beginPath(); ctx.arc(origin.x, origin.y, radiusSS, 0, Math.PI * 2); ctx.stroke();

            ctx.strokeStyle = A.rimColor.replace('{a}', (A.rimAlphaBase + Math.sin(t * 1.4) * 0.12).toFixed(3));
            ctx.lineWidth = 3; ctx.shadowBlur = A.rimGlowBlur; ctx.shadowColor = A.rimGlowColor;
            ctx.beginPath(); ctx.arc(origin.x, origin.y, radiusSS, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;

            ctx.strokeStyle = A.dashColor.replace('{a}', (A.dashAlphaBase + Math.sin(t * 1.8) * 0.10).toFixed(3));
            ctx.lineWidth = 1.5; ctx.setLineDash([6, 30]); ctx.lineDashOffset = -(t * 18) % 36;
            ctx.beginPath(); ctx.arc(origin.x, origin.y, radiusSS + 10, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]); ctx.lineDashOffset = 0;
            ctx.restore();
        }

        // ── 2. TECH-HEX GRID ─────────────────────────────────────
        {
            const H = C.hex;
            const HEX_SIZE = H.size, HEX_W = HEX_SIZE * 2, HEX_H = Math.sqrt(3) * HEX_SIZE;
            const COL_STEP = HEX_W * 0.75, ROW_STEP = HEX_H;

            const viewL = camera.x - CANVAS.width * 0.5, viewT = camera.y - CANVAS.height * 0.5;
            const colStart = Math.floor(viewL / COL_STEP) - 1, colEnd = colStart + Math.ceil((CANVAS.width + HEX_W * 2) / COL_STEP) + 2;
            const rowStart = Math.floor(viewT / ROW_STEP) - 1, rowEnd = rowStart + Math.ceil((CANVAS.height + HEX_H * 2) / ROW_STEP) + 2;

            ctx.save(); ctx.lineWidth = 0.9;
            for (let col = colStart; col <= colEnd; col++) {
                for (let row = rowStart; row <= rowEnd; row++) {
                    const wx = col * COL_STEP, wy = row * ROW_STEP + (col % 2 === 0 ? 0 : HEX_H * 0.5);
                    const distW = Math.sqrt(wx * wx + wy * wy);
                    const falloff = Math.max(0, 1 - distW / H.falloffRadius);
                    if (falloff < 0.02) continue;

                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const angle = (Math.PI / 3) * i, corner = ws(wx + HEX_SIZE * Math.cos(angle), wy + HEX_SIZE * Math.sin(angle));
                        i === 0 ? ctx.moveTo(corner.x, corner.y) : ctx.lineTo(corner.x, corner.y);
                    }
                    ctx.closePath();

                    if ((Math.abs(col) + Math.abs(row)) % 3 === 0) {
                        ctx.fillStyle = H.fillColor.replace('{a}', (H.fillAlpha * falloff).toFixed(3)); ctx.fill();
                    }
                    ctx.strokeStyle = H.strokeColor.replace('{a}', (H.strokeAlpha * falloff).toFixed(3)); ctx.stroke();
                }
            }
            ctx.restore();
        }

        // ── 3. CIRCUIT PATHS ─────────────────────────────────────
        const drawCircuitPath = (pathCfg) => {
            const P = C.paths, pc = pathCfg;
            const A = ws(pc.from.x, pc.from.y), B = ws(pc.to.x, pc.to.y), M = ws(pc.to.x, pc.from.y);
            ctx.save();

            ctx.strokeStyle = pc.glowColor; ctx.lineWidth = P.glowWidth;
            ctx.globalAlpha = P.glowAlphaBase + Math.sin(t * 1.2 + pc.phase) * 0.05;
            ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(M.x, M.y); ctx.lineTo(B.x, B.y); ctx.stroke();

            ctx.lineWidth = P.glowWidth * 0.5; ctx.globalAlpha = (P.glowAlphaBase + 0.08) + Math.sin(t * 0.8 + pc.phase) * 0.06;
            ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(M.x, M.y); ctx.lineTo(B.x, B.y); ctx.stroke();

            ctx.strokeStyle = pc.coreColor; ctx.lineWidth = P.coreWidth;
            ctx.globalAlpha = P.coreAlphaBase + Math.sin(t * 2.2 + pc.phase) * 0.15;
            ctx.shadowBlur = P.coreGlowBlur; ctx.shadowColor = pc.glowColor;
            ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(M.x, M.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.shadowBlur = 0;

            const seg1Len = Math.hypot(M.x - A.x, M.y - A.y), seg2Len = Math.hypot(B.x - M.x, B.y - M.y), total = seg1Len + seg2Len;
            if (total > 1) {
                for (let p = 0; p < P.packetCount; p++) {
                    const progress = ((t * P.packetSpeed + pc.phase * 0.25 + p * (1 / P.packetCount)) % 1 + 1) % 1;
                    const travelled = progress * total;
                    let px, py;
                    if (travelled <= seg1Len) { const u = travelled / seg1Len; px = A.x + (M.x - A.x) * u; py = A.y + (M.y - A.y) * u; }
                    else { const u = (travelled - seg1Len) / seg2Len; px = M.x + (B.x - M.x) * u; py = M.y + (B.y - M.y) * u; }

                    ctx.fillStyle = pc.coreColor; ctx.shadowBlur = P.coreGlowBlur; ctx.shadowColor = pc.glowColor;
                    ctx.globalAlpha = 0.30; ctx.beginPath(); ctx.arc(px, py, P.packetAuraRadius, 0, Math.PI * 2); ctx.fill();
                    ctx.globalAlpha = 0.95; ctx.beginPath(); ctx.arc(px, py, P.packetRadius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
                }
            }

            ctx.globalAlpha = 0.85 + Math.sin(t * 2.5 + pc.phase) * 0.10; ctx.fillStyle = pc.coreColor;
            ctx.shadowBlur = 12; ctx.shadowColor = pc.glowColor;
            ctx.beginPath(); ctx.arc(M.x, M.y, P.elbowRadius, 0, Math.PI * 2); ctx.fill();

            ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(A.x, A.y, P.elbowRadius - 1, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
            ctx.restore();
        };

        // Note: Paths might need adjusting in config.js based on new object locations if you want them to lead specifically to zones.
        drawCircuitPath(C.paths.database);
        drawCircuitPath(C.paths.shop);

        // ── 4. ZONE AURAS ─────────────────────────────────────────
        const drawZoneAura = (auraCfg) => {
            const S = C.auras, ac = auraCfg;
            const sc = ws(ac.worldX, ac.worldY), edgePt = ws(ac.worldX + ac.radius, ac.worldY);
            const rSS = Math.abs(edgePt.x - sc.x), pulse = 0.50 + Math.sin(t * 1.5 + ac.phase) * 0.18;

            if (!isFinite(sc.x) || !isFinite(sc.y) || !isFinite(rSS) || rSS <= 0) return;

            ctx.save();
            const grad = ctx.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, rSS);
            grad.addColorStop(0, `rgba(${ac.innerRgb}, ${(S.innerAlphaBase * pulse).toFixed(3)})`);
            grad.addColorStop(0.50, `rgba(${ac.innerRgb}, ${(S.midAlphaBase * pulse).toFixed(3)})`);
            grad.addColorStop(0.80, `rgba(${ac.outerRgb}, ${(S.outerAlphaBase * pulse).toFixed(3)})`);
            grad.addColorStop(1, `rgba(${ac.outerRgb}, 0)`);
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(sc.x, sc.y, rSS, 0, Math.PI * 2); ctx.fill();

            ctx.globalAlpha = S.rimAlphaBase * pulse; ctx.strokeStyle = `rgba(${ac.innerRgb}, 1)`;
            ctx.lineWidth = S.rimWidth; ctx.shadowBlur = S.rimGlowBlur; ctx.shadowColor = `rgba(${ac.innerRgb}, 0.9)`;
            ctx.beginPath(); ctx.arc(sc.x, sc.y, rSS, 0, Math.PI * 2); ctx.stroke();

            ctx.globalAlpha = S.dashAlphaBase * pulse; ctx.shadowBlur = 0;
            ctx.setLineDash([8, 14]); ctx.lineDashOffset = -(t * 12 + ac.phase * 8) % 22;
            ctx.beginPath(); ctx.arc(sc.x, sc.y, rSS * S.dashOuterMult, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]); ctx.lineDashOffset = 0;
            ctx.restore();
        };

        // If you want an aura under the Citadel
        drawZoneAura({ worldX: -150 + 150, worldY: -700 + 120, innerRgb: '250, 180, 30', outerRgb: '100, 50, 5', radius: 350, phase: 0.5 });
        drawZoneAura(C.auras.database);
        drawZoneAura(C.auras.shop);
        drawZoneAura(C.auras.origin);
    }

    draw() {
        _updateMapNow();
        // Draw floor/base of MTC room FIRST (so walls appear on top)
        if (this.mtcRoom) this.mtcRoom.draw();

        const CULL = 120;
        if (!this._sortedObjects) this._sortedObjects = [...this.objects].sort((a, b) => a.y - b.y);
        for (const obj of this._sortedObjects) {
            const screen = worldToScreen(obj.x, obj.y);
            if (screen.x + obj.w < -CULL || screen.x > CANVAS.width + CULL) continue;
            if (screen.y + obj.h < -CULL || screen.y > CANVAS.height + CULL) continue;
            obj.draw();
        }
    }

    drawLighting(player, projectiles = [], extraLights = []) {
        const L = BALANCE.LIGHTING;
        const darkness = 1.0 - L.ambientLight;
        if (darkness < 0.02) return;

        const lc = this._lightCanvas, lctx = this._lightCtx;
        if (lc.width !== CANVAS.width || lc.height !== CANVAS.height) { lc.width = CANVAS.width; lc.height = CANVAS.height; }

        const shake = getScreenShakeOffset();
        const toSS = (wx, wy) => { const s = worldToScreen(wx, wy); return { x: s.x + shake.x, y: s.y + shake.y }; };

        lctx.globalCompositeOperation = 'source-over';
        lctx.clearRect(0, 0, lc.width, lc.height);
        lctx.fillStyle = `rgba(${L.nightR},${L.nightG},${L.nightB},${darkness.toFixed(3)})`;
        lctx.fillRect(0, 0, lc.width, lc.height);

        const punchLight = (wx, wy, radius, type = 'neutral', intensity = 1.0) => {
            const { x, y } = toSS(wx, wy);
            const r = radius * intensity;

            lctx.globalCompositeOperation = 'destination-out';
            const erase = lctx.createRadialGradient(x, y, 0, x, y, r);
            erase.addColorStop(0, 'rgba(0,0,0,1)'); erase.addColorStop(0.38, 'rgba(0,0,0,0.92)');
            erase.addColorStop(0.65, 'rgba(0,0,0,0.55)'); erase.addColorStop(0.88, 'rgba(0,0,0,0.18)'); erase.addColorStop(1, 'rgba(0,0,0,0)');
            lctx.fillStyle = erase; lctx.beginPath(); lctx.arc(x, y, r, 0, Math.PI * 2); lctx.fill();

            lctx.globalCompositeOperation = 'source-over';
            const tintR = r * 0.55, tAlpha = 0.11 * darkness;
            let tInner, tOuter;
            if (type === 'warm') { tInner = `rgba(255,190,70,${tAlpha})`; tOuter = 'rgba(255,140,30,0)'; }
            else if (type === 'cool') { tInner = `rgba(60,220,255,${tAlpha})`; tOuter = 'rgba(0,180,255,0)'; }
            else { tInner = `rgba(210,225,255,${tAlpha * .7})`; tOuter = 'rgba(180,205,255,0)'; }
            const tint = lctx.createRadialGradient(x, y, 0, x, y, tintR);
            tint.addColorStop(0, tInner); tint.addColorStop(1, tOuter);
            lctx.fillStyle = tint; lctx.beginPath(); lctx.arc(x, y, tintR, 0, Math.PI * 2); lctx.fill();
        };

        if (player && !player.dead) punchLight(player.x, player.y, L.playerLightRadius, 'warm', player.isDashing ? 1.25 : 1.0);

        if (typeof window.projectiles !== 'undefined' && Array.isArray(window.projectiles)) {
            for (const proj of window.projectiles) {
                if (!proj || proj.dead) continue;
                punchLight(proj.x, proj.y, L.projectileLightRadius, proj.team === 'player' ? 'cool' : 'warm');
            }
        }

        const MAX_LIGHT_RADIUS = Math.max(L.dataPillarLightRadius, L.serverRackLightRadius) + 40;
        for (const obj of this.objects) {
            if (obj.type === 'datapillar' || obj.type === 'server') {
                const cx = obj.x + obj.w * .5, cy = obj.type === 'datapillar' ? obj.y - 5 : obj.y + obj.h * .4, sp = toSS(cx, cy);
                if (sp.x + MAX_LIGHT_RADIUS < 0 || sp.x - MAX_LIGHT_RADIUS > lc.width) continue;
                if (sp.y + MAX_LIGHT_RADIUS < 0 || sp.y - MAX_LIGHT_RADIUS > lc.height) continue;
            }
            if (obj.type === 'datapillar') punchLight(obj.x + obj.w * .5, obj.y - 5, L.dataPillarLightRadius, 'cool');
            else if (obj.type === 'server') punchLight(obj.x + obj.w * .5, obj.y + obj.h * .4, L.serverRackLightRadius, 'cool');
        }

        for (const light of extraLights) punchLight(light.x, light.y, light.radius || 100, light.type || 'neutral', light.intensity || 1.0);

        if (this.mtcRoom) {
            const rx = this.mtcRoom.x + this.mtcRoom.w * .5, ry = this.mtcRoom.y + this.mtcRoom.h * .5;
            punchLight(rx, ry, 280, 'cool', 1.2); // Cool base light for Citadel
        }

        lctx.globalCompositeOperation = 'source-over'; CTX.drawImage(lc, 0, 0);
    }

    damageArea(startX, startY, endX, endY) {
        const lineHitsAABB = (x1, y1, x2, y2, rx, ry, rw, rh) => {
            const dx = x2 - x1, dy = y2 - y1;
            let tMin = 0, tMax = 1;
            if (Math.abs(dx) < 1e-9) { if (x1 < rx || x1 > rx + rw) return false; }
            else {
                const invDx = 1 / dx; let t1 = (rx - x1) * invDx, t2 = (rx + rw - x1) * invDx;
                if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
                tMin = Math.max(tMin, t1); tMax = Math.min(tMax, t2); if (tMin > tMax) return false;
            }
            if (Math.abs(dy) < 1e-9) { if (y1 < ry || y1 > ry + rh) return false; }
            else {
                const invDy = 1 / dy; let t1 = (ry - y1) * invDy, t2 = (ry + rh - y1) * invDy;
                if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
                tMin = Math.max(tMin, t1); tMax = Math.min(tMax, t2); if (tMin > tMax) return false;
            }
            return true;
        };

        const surviving = [];
        for (const obj of this.objects) {
            // Indestructible Citadel Walls
            if (obj.type === 'mtcwall') { surviving.push(obj); continue; }

            if (lineHitsAABB(startX, startY, endX, endY, obj.x, obj.y, obj.w, obj.h)) {
                const cx = obj.x + obj.w * 0.5, cy = obj.y + obj.h * 0.5;
                if (typeof spawnParticles === 'function') {
                    const dustColor = obj.type === 'wall' ? '#94a3b8' : obj.type === 'tree' ? '#4ade80' : '#e2e8f0';
                    spawnParticles(cx, cy, 20, dustColor); spawnParticles(cx, cy, 8, '#ff4500');
                }
                if (typeof spawnFloatingText === 'function') spawnFloatingText('💥 DESTROYED', cx, cy - 24, '#f97316', 20);
                if (typeof addScreenShake === 'function') addScreenShake(5);
            } else { surviving.push(obj); }
        }
        this.objects = surviving; this._sortedObjects = null;

        if (this.mtcRoom) {
            const r = this.mtcRoom;
            if (lineHitsAABB(startX, startY, endX, endY, r.x, r.y, r.w, r.h)) {
                const rcx = r.x + r.w * 0.5, rcy = r.y + r.h * 0.5;
                if (typeof spawnParticles === 'function') { spawnParticles(rcx, rcy, 15, '#38bdf8'); spawnParticles(rcx, rcy, 5, '#ff4500'); }
                if (typeof spawnFloatingText === 'function') spawnFloatingText('🛡️ SHIELD HIT!', rcx, rcy - 35, '#38bdf8', 22);
            }
        }
    }

    clear() { this.objects = []; this.mtcRoom = null; this.initialized = false; this._sortedObjects = null; }
    getObjects() { return this.objects; }
    isBlocked(x, y, radius = 0) { for (const obj of this.objects) if (obj.checkCollision(x, y, radius)) return true; return false; }
    findSafeSpawn(preferredX, preferredY, radius) {
        for (let i = 0; i < 50; i++) {
            const angle = (Math.PI * 2 / 50) * i, distance = 100 + i * 50;
            const x = preferredX + Math.cos(angle) * distance, y = preferredY + Math.sin(angle) * distance;
            if (!this.isBlocked(x, y, radius)) return { x, y };
        }
        return { x: preferredX, y: preferredY };
    }
}

const mapSystem = new MapSystem();
window.mapSystem = mapSystem;
window.MapSystem = MapSystem;
window.MapObject = MapObject;
window.MTCRoom = MTCRoom;
window.ExplosiveBarrel = ExplosiveBarrel;

if (typeof module !== 'undefined' && module.exports) { module.exports = { MapObject, MTCRoom, MapSystem, mapSystem, ExplosiveBarrel }; }