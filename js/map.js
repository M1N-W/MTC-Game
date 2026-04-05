'use strict';
/**
 * js/map.js
 * ════════════════════════════════════════════════════════════════
 * MTC Campus Map System — world geometry, objects, terrain & lighting
 *
 * Owns:
 *  - All static map objects (desks, trees, pillars, explosive barrels, etc.)
 *  - MTCRoom  — safe zone bunker (north) with HP regen + forcefield
 *  - MapSystem — singleton that manages object placement, update loop,
 *                terrain draw (hex grid + circuit paths + zone auras),
 *                and dynamic lighting overlay
 *
 * World layout (3200 × 3200 units, origin at center):
 *  North  — MTC Citadel (MTCRoom safe zone)
 *  East   — Server Aisles  (drawServer / drawDataPillar clusters)
 *  West   — Library Maze   (drawBookshelf / drawDatabase clusters)
 *  South  — Symmetry Courtyard (drawCoopStore / drawVendingMachine)
 *  Center — open arena with hex grid floor
 *
 * Globals exported (window.*):
 *  window.mapSystem        — MapSystem singleton instance
 *  window.MapSystem        — class ref (WaveManager / AdminSystem spawn)
 *  window.MapObject        — class ref (instanceof checks)
 *  window.MTCRoom          — class ref
 *  window.ExplosiveBarrel  — class ref (ProjectileManager hit detection)
 *
 * ── TABLE OF CONTENTS ──────────────────────────────────────────
 *  Ctrl+G → line number (VS Code) | Ctrl+F → method name
 *
 *  ── SHARED TIMING ─────────────────────────────────────────────
 *  L.11   _mapNow / _updateMapNow()      shared perf timestamp (avoids per-draw calls)
 *
 *  ── STANDALONE DRAW HELPERS (ctx primitives, no state) ────────
 *  L.17   drawDesk(w, h)
 *  L.42   drawTree(size)
 *  L.66   drawServer(w, h)
 *  L.98   drawDataPillar(w, h)
 *  L.124  drawBookshelf(w, h)
 *  L.154  drawDatabase(w, h)
 *  L.242  drawCoopStore(w, h)
 *  L.359  drawVendingMachine(w, h)
 *
 *  ── MAP OBJECTS ───────────────────────────────────────────────
 *  L.437  class MapObject               base: x/y/w/h, draw(), collision rect
 *           L.462  draw()               dispatcher → type-specific sub-draw
 *           L.483  drawMTCWall()
 *           L.526  drawChair()
 *           L.532  drawCabinet()
 *           L.541  drawBlackboard()
 *           L.586  drawWall()
 *  L.641  class ExplosiveBarrel         extends MapObject — hp, isExploded flag
 *           L.647  draw()               barrel sprite + low-HP warning glow
 *  ⚠️  ExplosiveBarrel hit detection lives in game.js _tickBarrelExplosions()
 *      — NOT inside this file. AoE explosion handled there, not in draw/update.
 *
 *  ── MTC ROOM (Safe Zone) ──────────────────────────────────────
 *  L.687  class MTCRoom
 *           L.700  update(dt, player)   HP regen when player inside, forcefield pulse
 *           L.767  draw()               bunker walls + hologram rings + buff indicators
 *
 *  ── MAP SYSTEM (Singleton) ────────────────────────────────────
 *  L.1123 class MapSystem
 *           L.1132 init()               place all objects + mtcRoom init
 *           L.1312 update(entities, dt) push entities out of solid objects (collision)
 *           L.1322 drawTerrain(ctx, camera)
 *                    └─ 1. Arena boundary ring
 *                    └─ 2. Tech-hex grid            ← perf: corners pre-computed, no string alloc
 *                    └─ 2b. Zone floors
 *                    └─ 3. Circuit paths + packets  ← throttled: draw every 2nd frame
 *                    └─ 4. Zone auras
 *                    └─ 5. Lighting map overlay
 *           L.1552 drawZoneFloors(ctx)  colored floor tiles per zone
 *           L.1660 draw()               all MapObjects + mtcRoom draw
 *           L.1679 drawLighting(...)    radial light sources → composite shadow overlay
 *
 * ── PERF NOTES ─────────────────────────────────────────────────
 *  Hex grid (drawTerrain §2): corners pre-computed (6× cos/sin outside loop).
 *  Fill/stroke colors parsed once from MAP_CONFIG strings — no .replace()/.toFixed() per cell.
 *  Circuit packets: _terrainFrame & 1 gate — renders every other frame only.
 *  drawLighting: composite overlay drawn once per frame at full canvas size — keep light
 *  source count low (< 12) to avoid GPU fillRect overdraw cost.
 *
 * ════════════════════════════════════════════════════════════════
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
    // Bottom + left edge shadow (depth)
    CTX.fillStyle = 'rgba(0,0,0,0.30)';
    CTX.fillRect(0, h - 3, w, 3);
    CTX.fillStyle = 'rgba(0,0,0,0.15)';
    CTX.fillRect(0, 0, 2, h);
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

// ════════════════════════════════════════════════════════════
// 🗄️  MTC DATABASE SERVER CLUSTER
// Structure: central mainframe tower + 2 flanking server racks
// + holographic display panel + cable conduits
// ════════════════════════════════════════════════════════════
function drawDatabase(w, h) {
    const pal = BALANCE.map.mapColors;
    const now = _mapNow;
    const pulse = 0.5 + Math.sin(now / 700) * 0.5;
    const fastPulse = 0.5 + Math.sin(now / 280) * 0.5;

    // ── Shadow ──
    CTX.fillStyle = 'rgba(0,0,0,0.45)';
    CTX.beginPath(); CTX.ellipse(w / 2, h + 8, w * 0.6, 10, 0, 0, Math.PI * 2); CTX.fill();

    // ── Mainframe body (central tower) ──
    CTX.fillStyle = pal.dbBody;
    CTX.beginPath(); CTX.roundRect(0, 0, w, h, 6); CTX.fill();

    // Outer frame glow
    CTX.strokeStyle = `rgba(251,191,36,${0.25 + pulse * 0.25})`;
    CTX.lineWidth = 2;
    CTX.beginPath(); CTX.roundRect(0, 0, w, h, 6); CTX.stroke();

    // ── Header banner ──
    CTX.fillStyle = `rgba(20,14,2,0.95)`;
    CTX.beginPath(); CTX.roundRect(0, 0, w, 14, [6, 6, 0, 0]); CTX.fill();
    CTX.strokeStyle = `rgba(251,191,36,${0.5 + fastPulse * 0.3})`;
    CTX.lineWidth = 1;
    CTX.beginPath(); CTX.moveTo(0, 14); CTX.lineTo(w, 14); CTX.stroke();

    // Banner text
    CTX.fillStyle = `rgba(253,224,71,${0.8 + pulse * 0.2})`;
    CTX.font = 'bold 7px monospace';
    CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
    CTX.fillText('MTC DATABASE', w / 2, 7);

    // ── Server rack units (4 rows) ──
    const rackStartY = 18, unitH = Math.floor((h - rackStartY - 16) / 4);
    for (let u = 0; u < 4; u++) {
        const uy = rackStartY + u * unitH;
        CTX.fillStyle = pal.dbBody;
        CTX.beginPath(); CTX.roundRect(6, uy, w - 12, unitH - 2, 2); CTX.fill();
        CTX.strokeStyle = 'rgba(251,191,36,0.12)';
        CTX.lineWidth = 0.7;
        CTX.beginPath(); CTX.roundRect(6, uy, w - 12, unitH - 2, 2); CTX.stroke();

        // Status LED
        const blinkOffset = u * 413;
        const isOn = Math.sin((now + blinkOffset) / (350 + u * 90)) > 0;
        CTX.fillStyle = isOn ? pal.dbRackOn : pal.dbRackOff;
        CTX.shadowBlur = isOn ? 8 : 0; CTX.shadowColor = '#fbbf24';
        CTX.beginPath(); CTX.arc(13, uy + unitH * 0.45, 3, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;

        // Data LEDs (3)
        for (let d = 0; d < 4; d++) {
            const dOn = Math.sin((now + blinkOffset + d * 130) / 180) > 0.5;
            CTX.fillStyle = dOn ? '#f59e0b' : '#3d2a00';
            CTX.fillRect(20 + d * 6, uy + unitH * 0.3, 4, 4);
        }

        // Activity bar
        const actW = (w - 40) * (0.3 + Math.sin(now / (500 + u * 150) + u) * 0.3 + 0.1);
        CTX.fillStyle = 'rgba(0,0,0,0.35)';
        CTX.fillRect(w - 36, uy + unitH * 0.3, w - 44, 4);
        CTX.fillStyle = `rgba(251,191,36,${0.5 + pulse * 0.3})`;
        CTX.fillRect(w - 36, uy + unitH * 0.3, Math.max(2, actW * 0.5), 4);

        // Vent lines (right side)
        CTX.strokeStyle = 'rgba(251,191,36,0.08)'; CTX.lineWidth = 0.7;
        for (let vx = w - 20; vx < w - 8; vx += 3) {
            CTX.beginPath(); CTX.moveTo(vx, uy + 3); CTX.lineTo(vx, uy + unitH - 4); CTX.stroke();
        }
    }

    // ── Bottom port strip ──
    CTX.fillStyle = '#10080a';
    CTX.fillRect(4, h - 12, w - 8, 10);
    CTX.fillStyle = pal.dbRackOn;
    for (let p = 0; p < 4; p++) CTX.fillRect(6 + p * 11, h - 9, 8, 4);

    // ── Top glow LED bar ──
    CTX.fillStyle = `rgba(251,191,36,${0.6 + fastPulse * 0.4})`;
    CTX.shadowBlur = 12; CTX.shadowColor = '#fbbf24';
    CTX.beginPath(); CTX.roundRect(8, 1, w - 16, 3, 1); CTX.fill();
    CTX.shadowBlur = 0;
}

// ════════════════════════════════════════════════════════════
// 🛒  MTC CO-OP STORE
// Structure: shop front with counter, shelves, signboard + awning
// ════════════════════════════════════════════════════════════
function drawCoopStore(w, h) {
    const pal = BALANCE.map.mapColors;
    const now = _mapNow;
    const pulse = 0.5 + Math.sin(now / 800) * 0.5;
    const fastPulse = 0.5 + Math.sin(now / 300) * 0.5;
    const blinkSlow = Math.sin(now / 1200) > 0;

    // ── Shadow ──
    CTX.fillStyle = 'rgba(0,0,0,0.40)';
    CTX.beginPath(); CTX.ellipse(w / 2, h + 8, w * 0.6, 10, 0, 0, Math.PI * 2); CTX.fill();

    // ── Main building body ──
    CTX.fillStyle = pal.shopBody;
    CTX.beginPath(); CTX.roundRect(0, 0, w, h, 5); CTX.fill();

    // Side walls (darker)
    CTX.fillStyle = 'rgba(0,0,0,0.25)';
    CTX.fillRect(0, 0, 6, h);
    CTX.fillRect(w - 6, 0, 6, h);

    // ── Awning (top accent stripe) ──
    const awningColors = ['#f97316', '#0f0a04', '#f97316', '#0f0a04', '#f97316'];
    const stripeW = w / awningColors.length;
    for (let i = 0; i < awningColors.length; i++) {
        CTX.fillStyle = awningColors[i];
        CTX.globalAlpha = 0.85;
        CTX.fillRect(i * stripeW, 0, stripeW, 10);
    }
    CTX.globalAlpha = 1;
    CTX.strokeStyle = `rgba(249,115,22,${0.6 + fastPulse * 0.3})`;
    CTX.lineWidth = 1.5;
    CTX.beginPath(); CTX.moveTo(0, 10); CTX.lineTo(w, 10); CTX.stroke();

    // ── Sign board ──
    const signH = 18;
    CTX.fillStyle = 'rgba(10,6,0,0.9)';
    CTX.beginPath(); CTX.roundRect(8, 12, w - 16, signH, 3); CTX.fill();
    CTX.strokeStyle = `rgba(249,115,22,${0.55 + pulse * 0.35})`;
    CTX.lineWidth = 1.5;
    CTX.beginPath(); CTX.roundRect(8, 12, w - 16, signH, 3); CTX.stroke();

    // Sign text
    CTX.fillStyle = `rgba(252,211,77,${0.85 + pulse * 0.15})`;
    CTX.font = 'bold 8px monospace';
    CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
    CTX.fillText('🛒 CO-OP STORE', w / 2, 12 + signH / 2);

    // ── Glass window / display case ──
    const winY = 34, winH = Math.floor(h * 0.32);
    CTX.fillStyle = `rgba(249,115,22,${0.06 + pulse * 0.04})`;
    CTX.beginPath(); CTX.roundRect(8, winY, w - 16, winH, 3); CTX.fill();
    CTX.strokeStyle = `rgba(249,115,22,${0.30 + pulse * 0.15})`;
    CTX.lineWidth = 1;
    CTX.beginPath(); CTX.roundRect(8, winY, w - 16, winH, 3); CTX.stroke();

    // Items in window (4 item slots)
    const itemCols = 4, itemPadX = (w - 16 - 8) / itemCols;
    const itemColors = ['#f59e0b', '#22d3ee', '#f97316', '#a78bfa'];
    const itemIcons = ['⚡', '🔵', '🔥', '💜'];
    for (let i = 0; i < itemCols; i++) {
        const ix = 12 + i * itemPadX, iy = winY + 4;
        const iw = itemPadX - 4, ih = winH - 8;
        CTX.fillStyle = 'rgba(0,0,0,0.4)';
        CTX.beginPath(); CTX.roundRect(ix, iy, iw, ih, 2); CTX.fill();
        CTX.fillStyle = itemColors[i];
        CTX.globalAlpha = 0.4 + pulse * 0.2;
        CTX.beginPath(); CTX.roundRect(ix + 1, iy + 1, iw - 2, ih - 2, 2); CTX.fill();
        CTX.globalAlpha = 0.85;
        CTX.font = `${Math.floor(ih * 0.45)}px serif`;
        CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        CTX.fillText(itemIcons[i], ix + iw / 2, iy + ih / 2);
        CTX.globalAlpha = 1;
    }

    // ── Counter / service desk ──
    const counterY = winY + winH + 6;
    const counterH = Math.floor(h * 0.20);
    CTX.fillStyle = pal.shopCounter;
    CTX.beginPath(); CTX.roundRect(6, counterY, w - 12, counterH, 3); CTX.fill();
    CTX.strokeStyle = `rgba(249,115,22,${0.3 + pulse * 0.15})`;
    CTX.lineWidth = 1;
    CTX.beginPath(); CTX.roundRect(6, counterY, w - 12, counterH, 3); CTX.stroke();

    // Counter top surface highlight
    CTX.fillStyle = 'rgba(249,115,22,0.08)';
    CTX.fillRect(8, counterY + 2, w - 16, 4);

    // Register / terminal
    CTX.fillStyle = '#0a0600';
    CTX.beginPath(); CTX.roundRect(w * 0.6, counterY + 4, w * 0.32, counterH - 8, 2); CTX.fill();
    CTX.strokeStyle = `rgba(249,115,22,${0.4 + fastPulse * 0.25})`;
    CTX.lineWidth = 1;
    CTX.beginPath(); CTX.roundRect(w * 0.6, counterY + 4, w * 0.32, counterH - 8, 2); CTX.stroke();
    // Register screen
    CTX.fillStyle = `rgba(249,115,22,${0.10 + pulse * 0.06})`;
    CTX.fillRect(w * 0.62, counterY + 6, w * 0.28, counterH - 14);

    // ── Bottom shelf strip ──
    const shelfY = h - 14;
    CTX.fillStyle = pal.shopShelf;
    CTX.fillRect(6, shelfY, w - 12, 6);
    // Shelf items (small dots)
    for (let s = 0; s < 5; s++) {
        const sx = 12 + s * ((w - 24) / 5);
        CTX.fillStyle = itemColors[s % itemColors.length];
        CTX.globalAlpha = 0.7 + (blinkSlow && s === 2 ? 0.3 : 0);
        CTX.beginPath(); CTX.arc(sx, shelfY - 5, 4, 0, Math.PI * 2); CTX.fill();
        CTX.globalAlpha = 1;
    }

    // ── Top orange LED bar ──
    CTX.fillStyle = `rgba(249,115,22,${0.65 + fastPulse * 0.35})`;
    CTX.shadowBlur = 12; CTX.shadowColor = '#f97316';
    CTX.beginPath(); CTX.roundRect(8, 1, w - 16, 3, 1); CTX.fill();
    CTX.shadowBlur = 0;
}

function drawVendingMachine(w, h) {
    const now = _mapNow;
    const pulse = 0.5 + Math.sin(now / 600) * 0.5;
    const blinkFast = Math.sin(now / 250) > 0;

    // Shadow
    CTX.fillStyle = 'rgba(0,0,0,0.35)';
    CTX.beginPath(); CTX.ellipse(w / 2, h + 5, w * 0.55, 7, 0, 0, Math.PI * 2); CTX.fill();

    // Body — deep charcoal with slight blue tint
    CTX.fillStyle = '#0d1520';
    CTX.beginPath(); CTX.roundRect(0, 0, w, h, 5); CTX.fill();

    // Side stripe (neon teal)
    const stripeGrad = CTX.createLinearGradient(0, 0, w, 0);
    stripeGrad.addColorStop(0, 'rgba(6,182,212,0)');
    stripeGrad.addColorStop(0.3, `rgba(6,182,212,${0.35 + pulse * 0.25})`);
    stripeGrad.addColorStop(0.7, `rgba(6,182,212,${0.35 + pulse * 0.25})`);
    stripeGrad.addColorStop(1, 'rgba(6,182,212,0)');
    CTX.fillStyle = stripeGrad;
    CTX.fillRect(0, Math.floor(h * 0.45), w, 4);

    // Display screen
    CTX.fillStyle = `rgba(6,182,212,${0.07 + pulse * 0.05})`;
    CTX.beginPath(); CTX.roundRect(5, 5, w - 10, Math.floor(h * 0.42), 3); CTX.fill();
    CTX.strokeStyle = `rgba(34,211,238,${0.4 + pulse * 0.3})`;
    CTX.lineWidth = 1;
    CTX.beginPath(); CTX.roundRect(5, 5, w - 10, Math.floor(h * 0.42), 3); CTX.stroke();

    // Screen content — product slots (3 cols x 2 rows)
    const itemColors = ['#f59e0b', '#22d3ee', '#f97316', '#a78bfa', '#4ade80', '#fb7185'];
    const cols = 3, rows = 2;
    const itemW = Math.floor((w - 22) / cols);
    const itemH = Math.floor((Math.floor(h * 0.42) - 14) / rows);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const ix = 8 + c * (itemW + 2), iy = 8 + r * (itemH + 2);
            CTX.fillStyle = 'rgba(0,0,0,0.4)';
            CTX.beginPath(); CTX.roundRect(ix, iy, itemW, itemH, 2); CTX.fill();
            CTX.fillStyle = itemColors[(r * cols + c) % itemColors.length];
            CTX.globalAlpha = 0.55 + pulse * 0.15;
            CTX.beginPath(); CTX.roundRect(ix + 2, iy + 2, itemW - 4, itemH - 4, 1); CTX.fill();
            CTX.globalAlpha = 1;
        }
    }

    // Coin slot
    CTX.fillStyle = '#1a2030';
    CTX.beginPath(); CTX.roundRect(Math.floor(w * 0.6), Math.floor(h * 0.52), Math.floor(w * 0.32), Math.floor(h * 0.12), 2); CTX.fill();
    CTX.fillStyle = `rgba(251,191,36,${0.5 + pulse * 0.3})`;
    CTX.fillRect(Math.floor(w * 0.68), Math.floor(h * 0.565), Math.floor(w * 0.16), 2);

    // Button panel (3 buttons)
    const btnY = Math.floor(h * 0.52);
    for (let b = 0; b < 3; b++) {
        const isLit = blinkFast && b === Math.floor(now / 800) % 3;
        CTX.fillStyle = isLit ? '#22d3ee' : '#0a1525';
        CTX.shadowBlur = isLit ? 8 : 0; CTX.shadowColor = '#22d3ee';
        CTX.beginPath(); CTX.arc(7 + b * 11, btnY + 8, 4, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;
    }

    // Dispenser tray
    CTX.fillStyle = '#060e1a';
    CTX.beginPath(); CTX.roundRect(4, h - 14, w - 8, 12, 2); CTX.fill();
    CTX.strokeStyle = 'rgba(34,211,238,0.2)';
    CTX.lineWidth = 1;
    CTX.beginPath(); CTX.roundRect(4, h - 14, w - 8, 12, 2); CTX.stroke();

    // Top LED strip
    CTX.fillStyle = `rgba(34,211,238,${0.6 + pulse * 0.4})`;
    CTX.shadowBlur = 10; CTX.shadowColor = '#22d3ee';
    CTX.beginPath(); CTX.roundRect(8, 1, w - 16, 3, 1); CTX.fill();
    CTX.shadowBlur = 0;
}

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
            // ── Push entity out ───────────────────────────────────────────
            let nx = 0, ny = 1; // surface normal (up by default when distance===0)
            if (distance > 0) {
                nx = dx / distance; ny = dy / distance;
                entity.x += nx * overlap; entity.y += ny * overlap;
            } else {
                entity.x += overlap;
            }
            // ── Cancel velocity components moving INTO the surface ────────
            // vx/vy: physics velocity (player, projectiles)
            const vDot = (entity.vx || 0) * nx + (entity.vy || 0) * ny;
            if (vDot < 0) { entity.vx -= vDot * nx; entity.vy -= vDot * ny; }
            // _aiMoveX/_aiMoveY: AI movement direction (enemies, boss)
            // Without this, AI re-enters the object every frame after push-out.
            if (entity._aiMoveX !== undefined) {
                const aDot = entity._aiMoveX * nx + entity._aiMoveY * ny;
                if (aDot < 0) { entity._aiMoveX -= aDot * nx; entity._aiMoveY -= aDot * ny; }
                // Extra positional boost along the escape normal so AI clears the
                // surface in fewer frames. Scaled by overlap depth — deep stuck = bigger nudge.
                const boostDist = Math.min(overlap * 2.0, entity.radius * 0.5);
                entity.x += nx * boostDist;
                entity.y += ny * boostDist;
            }
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
            case 'vendingmachine': drawVendingMachine(this.w, this.h); break;
            case 'database': drawDatabase(this.w, this.h); break;
            case 'coopstore': drawCoopStore(this.w, this.h); break;
        }
        CTX.restore();
    }

    drawMTCWall() {
        const now = _mapNow;
        const W = this.w, H = this.h;
        const isHoriz = W > H;
        const pulse = 0.5 + Math.sin(now / 300) * 0.5;

        // Base
        CTX.fillStyle = '#080c12';
        CTX.beginPath(); CTX.roundRect(0, 0, W, H, 3); CTX.fill();

        // Gold neon border
        CTX.strokeStyle = `rgba(217,119,6,${0.6 + pulse * 0.3})`;
        CTX.lineWidth = 1.5;
        CTX.beginPath(); CTX.roundRect(0, 0, W, H, 3); CTX.stroke();

        // Panel separation lines
        CTX.strokeStyle = 'rgba(30,20,5,0.6)';
        CTX.lineWidth = 1;
        CTX.beginPath();
        if (isHoriz) {
            const step = Math.max(30, Math.floor(W / 4));
            for (let x = step; x < W - 4; x += step) { CTX.moveTo(x, 3); CTX.lineTo(x, H - 3); }
        } else {
            const step = Math.max(20, Math.floor(H / 4));
            for (let y = step; y < H - 4; y += step) { CTX.moveTo(3, y); CTX.lineTo(W - 3, y); }
        }
        CTX.stroke();

        // Circuit trace + neon strip
        CTX.strokeStyle = `rgba(217,119,6,${0.25 + pulse * 0.40})`;
        CTX.lineWidth = 2;
        CTX.shadowBlur = 8; CTX.shadowColor = '#d97706';
        CTX.beginPath();
        if (isHoriz) { CTX.moveTo(10, H / 2); CTX.lineTo(W - 10, H / 2); }
        else { CTX.moveTo(W / 2, 10); CTX.lineTo(W / 2, H - 10); }
        CTX.stroke(); CTX.shadowBlur = 0;

        // Rivet dots at corners
        CTX.fillStyle = `rgba(217,119,6,${0.5 + pulse * 0.3})`;
        const rv = [[3, 3], [W - 5, 3], [3, H - 5], [W - 5, H - 5]];
        for (const [rx, ry] of rv) { CTX.beginPath(); CTX.arc(rx, ry, 2, 0, Math.PI * 2); CTX.fill(); }
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
        const now = _mapNow;
        // Frame
        CTX.fillStyle = '#2d1505';
        CTX.beginPath(); CTX.roundRect(0, 0, this.w, this.h, 4); CTX.fill();
        // Board surface
        CTX.fillStyle = pal.whiteboardGreen;
        CTX.beginPath(); CTX.roundRect(5, 4, this.w - 10, this.h - 10, 2); CTX.fill();
        // Board edge highlight
        CTX.strokeStyle = 'rgba(255,255,255,0.06)'; CTX.lineWidth = 1;
        CTX.beginPath(); CTX.roundRect(5, 4, this.w - 10, this.h - 10, 2); CTX.stroke();

        // Chalk text
        CTX.fillStyle = pal.chalkWhite;
        CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        CTX.font = `bold ${Math.floor(this.h * .20)}px monospace`;
        CTX.globalAlpha = 0.92;
        CTX.fillText('ax²+bx+c = 0', this.w / 2, this.h * .32);
        CTX.font = `${Math.floor(this.h * .14)}px monospace`;
        CTX.globalAlpha = 0.65;
        CTX.fillText('x = (-b±√Δ)/2a', this.w / 2, this.h * .57);
        CTX.globalAlpha = 1;

        // Blinking cursor
        if (Math.sin(now / 500) > 0) {
            CTX.fillStyle = 'rgba(255,255,255,0.7)';
            CTX.fillRect(this.w * 0.68, this.h * 0.57 - 5, 2, 10);
        }

        // Chalk tray
        CTX.fillStyle = '#5c2a0a';
        CTX.fillRect(5, this.h - 8, this.w - 10, 6);
        // Chalk sticks
        const chalkCols = ['rgba(255,255,255,0.8)', 'rgba(255,200,100,0.7)', 'rgba(150,220,255,0.7)'];
        for (let i = 0; i < 3; i++) {
            CTX.fillStyle = chalkCols[i];
            CTX.beginPath(); CTX.roundRect(this.w * 0.25 + i * 16, this.h - 7, 12, 4, 1); CTX.fill();
        }

        // Chalk dust smudge
        CTX.fillStyle = 'rgba(255,255,255,0.04)';
        CTX.beginPath(); CTX.ellipse(this.w * 0.5, this.h - 9, 40, 4, 0, 0, Math.PI * 2); CTX.fill();
    }

    drawWall() {
        const pal = BALANCE.map.mapColors;
        const W = this.w, H = this.h;
        const faceW = Math.min(6, Math.floor(W * 0.12));

        // Drop shadow
        CTX.fillStyle = 'rgba(0,0,0,0.45)';
        CTX.fillRect(4, 5, W, H);

        // ── 3D side face (right edge depth) ──
        CTX.fillStyle = 'rgba(0,0,0,0.35)';
        CTX.fillRect(W - faceW, 0, faceW, H);

        // Base face
        CTX.fillStyle = pal.wallColor;
        CTX.fillRect(0, 0, W - faceW, H);

        // ── Brick rows — 2-tone mortar ──
        const seed = W * 7 + H * 13;
        CTX.lineWidth = 0.8;
        for (let row = 0; row < Math.ceil(H / 20); row++) {
            const ry = row * 20;
            const offset = (row % 2) * 25;
            CTX.strokeStyle = row % 2 === 0 ? pal.wallBrick : 'rgba(0,0,0,0.28)';
            CTX.beginPath();
            for (let bx = -25; bx < W + 25; bx += 50) { CTX.rect(bx + offset, ry, 50, 20); }
            CTX.stroke();
            // Subtle brick face highlight (top edge each brick)
            CTX.fillStyle = 'rgba(255,255,255,0.025)';
            CTX.fillRect(0, ry + 1, W - faceW, 2);
        }

        // ── Top cap — metal edge ──
        CTX.fillStyle = 'rgba(255,255,255,0.10)';
        CTX.fillRect(0, 0, W - faceW, 4);
        CTX.fillStyle = 'rgba(255,255,255,0.04)';
        CTX.fillRect(0, 4, W - faceW, 2);

        // ── Left corner post ──
        CTX.fillStyle = 'rgba(255,255,255,0.06)';
        CTX.fillRect(0, 0, 3, H);

        // Moss/damage spots — deterministic (no Math.random in draw)
        CTX.fillStyle = 'rgba(0,0,0,0.20)';
        for (let i = 0; i < 4; i++) {
            const px = ((seed * (i + 1) * 31) % (W - faceW - 8)) + 2;
            const py = ((seed * (i + 1) * 17) % (H - 8)) + 2;
            CTX.fillRect(px, py, 6 + (i % 3) * 3, 4 + (i % 2) * 3);
        }
    }
}

// ════════════════════════════════════════════════════════════
// 🛢️ EXPLOSIVE BARREL
// ════════════════════════════════════════════════════════════
class ExplosiveBarrel extends MapObject {
    constructor(x, y) {
        super(x, y, 30, 38, 'barrel');
        this.hp = 50; this.maxHp = 50; this.isExploded = false; this.radius = 28; // ลด 35→28 เดินผ่านได้ง่ายขึ้น
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
        // ── Buff Terminal state ────────────────────────────────
        this.buffCycleIndex = 0;   // which buff is up next (cycles 0→1→2→0)
    }

    update(dt, player) {
        this.cooldown = Math.max(0, this.cooldown - dt);
        const inside = this.checkPlayerInside(player.x, player.y);
        const C = BALANCE.mtcRoom;

        if (inside && this.cooldown <= 0) {
            if (!this.isPlayerInside) {
                this.isPlayerInside = true; this.playerStayTime = 0;

                // ── 1. Dash Reset (always on entry) ───────────────
                if (C.dashResetOnEntry && player.cooldowns) {
                    player.cooldowns.dash = 0;
                    spawnFloatingText('⚡ DASH RESET', player.x + 40, player.y - 45, '#22d3ee', 16);
                }

                // ── 2. Crisis Protocol ─────────────────────────────
                if (player.hp / player.maxHp <= C.crisisHpPct) {
                    player.hp = Math.min(player.maxHp, player.hp + C.crisisHealBonus);
                    spawnParticles(player.x, player.y, 18, '#ef4444');
                    spawnParticles(player.x, player.y, 12, '#fbbf24');
                    spawnFloatingText('🚨 CRISIS PROTOCOL', player.x, player.y - 90, '#ef4444', 22);
                    if (typeof Audio !== 'undefined') Audio.playSound('heal');
                }

                // ── 3. Rotating Buff Terminal ─────────────────────
                if (typeof player.applyMtcBuff === 'function') {
                    player.applyMtcBuff(this.buffCycleIndex);
                    // Emit buff particles
                    const buffColor = C.buffCycleColors[this.buffCycleIndex];
                    spawnParticles(player.x, player.y - 20, 20, buffColor);
                    if (typeof Audio !== 'undefined') Audio.playMtcBuff();
                    // Advance cycle
                    this.buffCycleIndex = (this.buffCycleIndex + 1) % 3;
                }

                spawnFloatingText('SAFE ZONE!', player.x, player.y - 60, '#fbbf24', 25);
                if (window.UIManager) window.UIManager.showVoiceBubble('เข้าสู่ MTC Room - เริ่มกระบวนการฟื้นฟู', player.x, player.y - 40);
                if (typeof Audio !== 'undefined') Audio.playMtcEntry();
            }
            this.playerStayTime += dt;

            // HP regen
            if (player.hp < player.maxHp) {
                player.hp = Math.min(player.maxHp, player.hp + this.healRate * dt);
                if (Math.random() < 0.25) spawnParticles(player.x + rand(-20, 20), player.y + rand(-20, 20), 1, '#4ade80');
            }
            // Energy regen
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
        if (window.UIManager) window.UIManager.showVoiceBubble('MTC Room เข้าสู่สถานะ Cooldown', player.x, player.y - 40);
        // Push south out the entrance
        player.vx = 0; player.vy = 250;
    }

    draw() {
        const s = worldToScreen(this.x, this.y);
        const W = this.w, H = this.h;
        const now = _mapNow;
        const cx = s.x + W / 2, cy = s.y + H / 2;
        const active = this.cooldown <= 0;

        // ── Pre-compute sin values ONCE ──
        const sinSlow = Math.sin(now / 350);
        const sinFast = Math.sin(now / 180);
        const sinBlink = Math.sin(now / 200);
        const pulse = active ? (sinSlow * 0.3 + 0.7) : 0.2;
        const fastPulse = active ? (sinFast * 0.5 + 0.5) : 0;
        const scanLine = (now / 8) % H;

        CTX.save();

        // ── 1. FLOOR ─────────────────────────────────────────────
        CTX.beginPath(); CTX.rect(s.x, s.y, W, H); CTX.clip();

        // Base fill — deep navy
        CTX.fillStyle = '#060b18';
        CTX.fillRect(s.x, s.y, W, H);

        // Radial ambient glow from center (no shadowBlur — radial gradient)
        const floorGrad = CTX.createRadialGradient(cx, cy, 0, cx, cy, W * 0.7);
        floorGrad.addColorStop(0, `rgba(217,119,6,${0.09 * pulse})`);
        floorGrad.addColorStop(0.5, `rgba(100,50,5,${0.05 * pulse})`);
        floorGrad.addColorStop(1, 'rgba(0,0,0,0)');
        CTX.fillStyle = floorGrad;
        CTX.fillRect(s.x, s.y, W, H);

        // Diamond grid (45° rotated squares) — single batch
        CTX.beginPath();
        CTX.strokeStyle = 'rgba(217,119,6,0.10)';
        CTX.lineWidth = 0.7;
        const dg = 32; // diamond grid spacing
        for (let ty = -dg; ty <= H + dg; ty += dg) {
            for (let tx = -dg; tx <= W + dg; tx += dg) {
                CTX.moveTo(s.x + tx, s.y + ty - dg / 2);
                CTX.lineTo(s.x + tx + dg / 2, s.y + ty);
                CTX.lineTo(s.x + tx, s.y + ty + dg / 2);
                CTX.lineTo(s.x + tx - dg / 2, s.y + ty);
                CTX.closePath();
            }
        }
        CTX.stroke();

        // Scan line
        if (active) {
            CTX.fillStyle = `rgba(217,119,6,${0.09 * pulse})`;
            CTX.fillRect(s.x, s.y + scanLine - 3, W, 6);
        }

        // Corner brackets — 4 corners, one path
        const bS = 20;
        CTX.beginPath();
        CTX.strokeStyle = `rgba(250,180,30,${0.55 + fastPulse * 0.35})`;
        CTX.lineWidth = 2;
        CTX.moveTo(s.x + 6, s.y + 6 + bS); CTX.lineTo(s.x + 6, s.y + 6); CTX.lineTo(s.x + 6 + bS, s.y + 6);
        CTX.moveTo(s.x + W - 6 - bS, s.y + 6); CTX.lineTo(s.x + W - 6, s.y + 6); CTX.lineTo(s.x + W - 6, s.y + 6 + bS);
        CTX.moveTo(s.x + 6, s.y + H - 6 - bS); CTX.lineTo(s.x + 6, s.y + H - 6); CTX.lineTo(s.x + 6 + bS, s.y + H - 6);
        CTX.moveTo(s.x + W - 6 - bS, s.y + H - 6); CTX.lineTo(s.x + W - 6, s.y + H - 6); CTX.lineTo(s.x + W - 6, s.y + H - 6 - bS);
        CTX.stroke();

        CTX.restore(); // end floor clip

        // ── 2. CITADEL HEADER BAR (top banner) ───────────────────
        {
            const barH = 18;
            CTX.fillStyle = `rgba(20,12,2,0.92)`;
            CTX.beginPath(); CTX.roundRect(s.x, s.y, W, barH, [4, 4, 0, 0]); CTX.fill();
            CTX.strokeStyle = `rgba(250,180,30,${0.4 + fastPulse * 0.3})`;
            CTX.lineWidth = 1;
            CTX.beginPath(); CTX.roundRect(s.x, s.y, W, barH, [4, 4, 0, 0]); CTX.stroke();
            // Banner text
            CTX.fillStyle = `rgba(254,243,199,${0.75 + pulse * 0.2})`;
            CTX.font = 'bold 8px Orbitron,monospace';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText('◈  MTC CITADEL  ◈', cx, s.y + barH / 2);
        }

        // ── 3. SIDE RAILS (replaces busy wall columns) ────────────
        // Two thin vertical accent lines — structural, not decorative clutter.
        const railPositions = [s.x + 6, s.x + W - 8];
        for (const rx of railPositions) {
            CTX.fillStyle = `rgba(250,180,30,${0.18 + fastPulse * 0.10})`;
            CTX.fillRect(rx, s.y + 22, 2, H - 44);
            // Single cap dot top + bottom
            CTX.fillStyle = `rgba(250,180,30,${0.55 + fastPulse * 0.35})`;
            CTX.beginPath(); CTX.arc(rx + 1, s.y + 28, 3, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.arc(rx + 1, s.y + H - 28, 3, 0, Math.PI * 2); CTX.fill();
        }

        // ── 4. CENTRAL HOLO-TABLE ────────────────────────────────
        const holoW = 140, holoH = 70;
        const holoX = cx - holoW / 2, holoY = cy - holoH / 2;

        // Table body
        CTX.fillStyle = '#0a0f1a';
        CTX.beginPath(); CTX.roundRect(holoX, holoY, holoW, holoH, 8); CTX.fill();
        // Border
        CTX.strokeStyle = active ? `rgba(250,180,30,${0.55 + fastPulse * 0.30})` : 'rgba(60,30,5,0.5)';
        CTX.lineWidth = 1.5;
        CTX.beginPath(); CTX.roundRect(holoX, holoY, holoW, holoH, 8); CTX.stroke();

        if (active) {
            // Single hex ring above table (replaces spinning double-ring + cone)
            CTX.save();
            CTX.translate(cx, holoY - 16);
            const hexR = 10;
            CTX.strokeStyle = `rgba(250,180,30,${0.65 + fastPulse * 0.25})`;
            CTX.lineWidth = 1.5;
            CTX.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i + now / 3000;
                i === 0 ? CTX.moveTo(Math.cos(a) * hexR, Math.sin(a) * hexR)
                    : CTX.lineTo(Math.cos(a) * hexR, Math.sin(a) * hexR);
            }
            CTX.closePath(); CTX.stroke();
            CTX.fillStyle = `rgba(251,191,36,${0.7 + fastPulse * 0.3})`;
            CTX.beginPath(); CTX.arc(0, 0, 2, 0, Math.PI * 2); CTX.fill();
            CTX.restore();

            // Status label
            CTX.fillStyle = 'rgba(254,243,199,0.85)';
            CTX.font = 'bold 8px Orbitron,monospace';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText('MTC SYSTEM ONLINE', cx, holoY + holoH - 11);

            // ── Next Buff Indicator ──
            if (typeof BALANCE !== 'undefined' && BALANCE.mtcRoom && BALANCE.mtcRoom.buffCycleNames) {
                const C = BALANCE.mtcRoom;
                const nextName = C.buffCycleNames[this.buffCycleIndex];
                const nextColor = C.buffCycleColors[this.buffCycleIndex];
                const nextIcon = C.buffCycleIcons[this.buffCycleIndex];
                CTX.fillStyle = 'rgba(0,0,0,0.35)';
                CTX.beginPath(); CTX.roundRect(holoX + 8, holoY + 3, holoW - 16, 11, 3); CTX.fill();
                CTX.fillStyle = nextColor;
                CTX.globalAlpha = 0.7 + fastPulse * 0.25;
                CTX.font = 'bold 7px monospace';
                CTX.fillText(`NEXT: ${nextIcon} ${nextName}`, cx, holoY + 9);
                CTX.globalAlpha = 1;
            }

            // ── Active Buff Timer ──
            const pl = window.player;
            if (pl && pl.mtcBuffTimer > 0 && pl.mtcBuffType >= 0) {
                const C = BALANCE.mtcRoom;
                const buffCol = C.buffCycleColors[pl.mtcBuffType];
                const buffName = C.buffCycleNames[pl.mtcBuffType];
                const totalDur = C.buffCycleDuration[pl.mtcBuffType] || 1;
                const pct = pl.mtcBuffTimer / totalDur;
                CTX.fillStyle = 'rgba(0,0,0,0.4)';
                CTX.fillRect(holoX + 6, holoY + holoH + 4, holoW - 12, 5);
                CTX.fillStyle = buffCol;
                CTX.globalAlpha = 0.85;
                CTX.fillRect(holoX + 6, holoY + holoH + 4, (holoW - 12) * pct, 5);
                CTX.globalAlpha = 0.7;
                CTX.fillStyle = buffCol;
                CTX.font = '7px monospace';
                CTX.textAlign = 'center'; CTX.textBaseline = 'top';
                CTX.fillText(`${buffName} ${pl.mtcBuffTimer.toFixed(1)}s`, cx, holoY + holoH + 11);
                CTX.globalAlpha = 1;
            }

            // ── Combat Lock Badge (shown when player is inside) ──
            if (this.isPlayerInside) {
                CTX.fillStyle = 'rgba(239,68,68,0.18)';
                CTX.beginPath(); CTX.roundRect(holoX + 8, holoY + holoH - 22, holoW - 16, 12, 3); CTX.fill();
                CTX.fillStyle = `rgba(239,68,68,${0.75 + fastPulse * 0.25})`;
                CTX.font = 'bold 7px monospace';
                CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
                CTX.fillText('⚔️  COMBAT LOCKED', cx, holoY + holoH - 16);
            }
        } else {
            // Rebooting state
            CTX.fillStyle = 'rgba(239,68,68,0.10)';
            CTX.beginPath(); CTX.roundRect(holoX + 4, holoY + 4, holoW - 8, holoH - 8, 6); CTX.fill();
            CTX.fillStyle = '#ef4444';
            CTX.font = 'bold 9px monospace';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(`REBOOTING: ${Math.ceil(this.cooldown)}s`, cx, cy);
            if (sinBlink > 0) {
                CTX.fillStyle = 'rgba(239,68,68,0.75)';
                CTX.font = 'bold 12px monospace';
                CTX.fillText('⚠', cx, cy - 20);
            }
        }

        // ── 5. (side terminals removed — visual simplification) ──

        // ── 6. ENTRANCE FORCEFIELD ───────────────────────────────
        const ffY = s.y + H;
        if (active) {
            const ffAlpha = pulse * 0.85;
            // Outer glow line
            CTX.strokeStyle = `rgba(180,100,10,${ffAlpha * 0.45})`;
            CTX.lineWidth = 7;
            CTX.beginPath(); CTX.moveTo(s.x + 20, ffY); CTX.lineTo(s.x + W - 20, ffY); CTX.stroke();
            // Bright core
            CTX.strokeStyle = `rgba(250,180,30,${ffAlpha})`;
            CTX.lineWidth = 2;
            CTX.beginPath(); CTX.moveTo(s.x + 20, ffY); CTX.lineTo(s.x + W - 20, ffY); CTX.stroke();
            // Inner highlight
            CTX.strokeStyle = `rgba(255,230,120,${ffAlpha * 0.4})`;
            CTX.lineWidth = 1;
            CTX.beginPath(); CTX.moveTo(s.x + 20, ffY); CTX.lineTo(s.x + W - 20, ffY); CTX.stroke();
            // Energy posts
            for (const px of [s.x + 20, s.x + W - 20]) {
                CTX.fillStyle = `rgba(250,180,30,${0.28 + fastPulse * 0.22})`;
                CTX.beginPath(); CTX.arc(px, ffY, 8, 0, Math.PI * 2); CTX.fill();
                CTX.fillStyle = `rgba(251,191,36,${0.85 + fastPulse * 0.15})`;
                CTX.beginPath(); CTX.arc(px, ffY, 3, 0, Math.PI * 2); CTX.fill();
            }
            // SAFE ZONE label
            CTX.fillStyle = 'rgba(180,100,10,0.18)';
            CTX.beginPath(); CTX.roundRect(cx - 72, ffY - 22, 144, 18, 5); CTX.fill();
            CTX.fillStyle = `rgba(250,180,30,${0.75 + pulse * 0.25})`;
            CTX.font = 'bold 8px Orbitron,monospace';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText('⚕  SAFE ZONE ACTIVE', cx, ffY - 13);

            // ── Entrance arrow (bouncing, below forcefield) ──────
            const arrowBounce = Math.sin(now / 400) * 5;
            const arrowY = ffY + 18 + arrowBounce;
            CTX.fillStyle = `rgba(250,180,30,${0.55 + pulse * 0.35})`;
            CTX.beginPath();
            CTX.moveTo(cx, arrowY + 12);
            CTX.lineTo(cx - 10, arrowY);
            CTX.lineTo(cx - 4, arrowY);
            CTX.lineTo(cx - 4, arrowY - 8);
            CTX.lineTo(cx + 4, arrowY - 8);
            CTX.lineTo(cx + 4, arrowY);
            CTX.lineTo(cx + 10, arrowY);
            CTX.closePath();
            CTX.fill();
        } else {
            // COOLDOWN state — red barrier + timer
            CTX.strokeStyle = 'rgba(239,68,68,0.55)';
            CTX.lineWidth = 3;
            CTX.setLineDash([8, 6]);
            CTX.beginPath(); CTX.moveTo(s.x + 16, ffY); CTX.lineTo(s.x + W - 16, ffY); CTX.stroke();
            CTX.setLineDash([]);
            // Cooldown label below entrance
            CTX.fillStyle = 'rgba(30,5,5,0.75)';
            CTX.beginPath(); CTX.roundRect(cx - 58, ffY + 4, 116, 16, 4); CTX.fill();
            CTX.fillStyle = `rgba(239,68,68,${0.8 + sinBlink * 0.2})`;
            CTX.font = 'bold 8px monospace';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(`⛔ COOLDOWN ${Math.ceil(this.cooldown)}s`, cx, ffY + 12);
        }

        // ── 7. PLAYER INSIDE TIMER ───────────────────────────────
        if (this.isPlayerInside) {
            const timeLeft = this.maxStayTime - this.playerStayTime;
            const timerPct = timeLeft / this.maxStayTime;
            const timerColor = timerPct > 0.5 ? '#fbbf24' : timerPct > 0.25 ? '#f59e0b' : '#ef4444';
            const timerCx = cx, timerCy = s.y + H - 44;
            CTX.strokeStyle = 'rgba(255,255,255,0.08)';
            CTX.lineWidth = 5;
            CTX.beginPath(); CTX.arc(timerCx, timerCy, 18, 0, Math.PI * 2); CTX.stroke();
            CTX.strokeStyle = timerColor;
            CTX.lineWidth = 5;
            CTX.beginPath(); CTX.arc(timerCx, timerCy, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * timerPct); CTX.stroke();
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
// PERF: static grid cell size — matches SpatialGrid in weapons.js for consistency
const _MAP_GRID_CELL = 128;

class MapSystem {
    constructor() {
        this.objects = [];
        this.mtcRoom = null;
        this.initialized = false;
        this._lightCanvas = null;
        this._lightCtx = null;
        // PERF Phase 1: static spatial grid for map objects (never move)
        this._staticGrid = new Map(); // cellKey → MapObject[]
        this._staticGridResults = [];  // reusable query result buffer
        this._terrainCacheCanvas = null;
        this._terrainCacheCtx = null;
        this._terrainCacheReady = false;
        this._terrainCacheOriginX = 0;
        this._terrainCacheOriginY = 0;
        this._zoneLabelWidths = Object.create(null);
        this._hexOffX = new Float32Array(6);
        this._hexOffY = new Float32Array(6);
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            this._hexOffX[i] = Math.cos(angle);
            this._hexOffY[i] = Math.sin(angle);
        }
    }

    // PERF Phase 1: build the static grid from this.objects
    // Called once after generateCampusMap(). Objects never move so this is valid forever.
    _buildStaticGrid() {
        this._staticGrid.clear();
        const C = _MAP_GRID_CELL;
        for (let i = 0; i < this.objects.length; i++) {
            const obj = this.objects[i];
            // Register object in every cell it overlaps
            const x0 = Math.floor(obj.x / C);
            const x1 = Math.floor((obj.x + obj.w) / C);
            const y0 = Math.floor(obj.y / C);
            const y1 = Math.floor((obj.y + obj.h) / C);
            for (let cx = x0; cx <= x1; cx++) {
                for (let cy = y0; cy <= y1; cy++) {
                    const key = ((cx & 0xFFFF) << 16) | (cy & 0xFFFF);
                    let cell = this._staticGrid.get(key);
                    if (!cell) { cell = []; this._staticGrid.set(key, cell); }
                    cell.push(obj);
                }
            }
        }
    }

    // PERF Phase 1: return nearby map objects within a square radius of (wx, wy)
    // Uses 3×3 cell neighbourhood — fast O(k) where k << total objects
    queryNearby(wx, wy, radius) {
        const C = _MAP_GRID_CELL;
        const results = this._staticGridResults;
        results.length = 0;
        const seen = this._staticGridSeen || (this._staticGridSeen = new Set());
        seen.clear();
        const minCx = Math.floor((wx - radius) / C);
        const maxCx = Math.floor((wx + radius) / C);
        const minCy = Math.floor((wy - radius) / C);
        const maxCy = Math.floor((wy + radius) / C);
        for (let cx = minCx; cx <= maxCx; cx++) {
            for (let cy = minCy; cy <= maxCy; cy++) {
                const key = ((cx & 0xFFFF) << 16) | (cy & 0xFFFF);
                const cell = this._staticGrid.get(key);
                if (!cell) continue;
                for (let i = 0; i < cell.length; i++) {
                    const obj = cell[i];
                    if (!seen.has(obj)) { seen.add(obj); results.push(obj); }
                }
            }
        }
        return results;
    }

    init() {
        if (this.initialized) return;
        this.objects = [];

        if (!this._lightCanvas) {
            this._lightCanvas = document.createElement('canvas');
            this._lightCtx = this._lightCanvas.getContext('2d');
        }
        if (!this._terrainCacheCanvas) {
            this._terrainCacheCanvas = document.createElement('canvas');
            this._terrainCacheCtx = this._terrainCacheCanvas.getContext('2d');
        }

        this.generateCampusMap();
        this._buildStaticGrid(); // PERF Phase 1: build once after map generation
        this._sortedObjects = null;
        this._objectsDirty = true;
        this._terrainCacheReady = false;
        this.initialized = true;
        // console.log(`✅ Campus Map Generated Structurally: ${this.objects.length} objects`);
    }

    _ensureTerrainCache() {
        if (this._terrainCacheReady || typeof MAP_CONFIG === 'undefined' || !this._terrainCacheCtx) return;

        const _wb =
            typeof GAME_CONFIG !== "undefined" && GAME_CONFIG.physics?.worldBounds
                ? GAME_CONFIG.physics.worldBounds
                : 1500;
        const pad = 160;
        const minX = -_wb - pad;
        const minY = -_wb - pad;
        const width = _wb * 2 + pad * 2;
        const height = _wb * 2 + pad * 2;

        const tc = this._terrainCacheCanvas;
        const tctx = this._terrainCacheCtx;
        if (tc.width !== width || tc.height !== height) {
            tc.width = width;
            tc.height = height;
        } else {
            tctx.clearRect(0, 0, width, height);
        }

        this._terrainCacheOriginX = minX;
        this._terrainCacheOriginY = minY;
        this._cacheStaticHexGrid(tctx);
        this._cacheStaticZoneFloors(tctx);
        this._terrainCacheReady = true;
    }

    _cacheStaticHexGrid(ctx) {
        const H = MAP_CONFIG.hex;
        const HEX_SIZE = H.size;
        const HEX_W = HEX_SIZE * 2;
        const HEX_H = Math.sqrt(3) * HEX_SIZE;
        const COL_STEP = HEX_W * 0.75;
        const ROW_STEP = HEX_H;
        const colStart = Math.floor(this._terrainCacheOriginX / COL_STEP) - 1;
        const rowStart = Math.floor(this._terrainCacheOriginY / ROW_STEP) - 1;
        const colEnd = colStart + Math.ceil((this._terrainCacheCanvas.width + HEX_W * 2) / COL_STEP) + 2;
        const rowEnd = rowStart + Math.ceil((this._terrainCacheCanvas.height + HEX_H * 2) / ROW_STEP) + 2;
        const fillRGB = H.fillColor.substring(5, H.fillColor.lastIndexOf(','));
        const strokeRGB = H.strokeColor.substring(5, H.strokeColor.lastIndexOf(','));
        const fillBase = H.fillAlpha;
        const strokeBase = H.strokeAlpha;
        const falloffR = H.falloffRadius;

        ctx.save();
        ctx.lineWidth = 0.9;
        for (let col = colStart; col <= colEnd; col++) {
            for (let row = rowStart; row <= rowEnd; row++) {
                const wx = col * COL_STEP;
                const wy = row * ROW_STEP + (col % 2 === 0 ? 0 : HEX_H * 0.5);
                const distW = Math.sqrt(wx * wx + wy * wy);
                const falloff = Math.max(0, 1 - distW / falloffR);
                if (falloff < 0.02) continue;

                const cx = wx - this._terrainCacheOriginX;
                const cy = wy - this._terrainCacheOriginY;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const px = cx + this._hexOffX[i] * HEX_SIZE;
                    const py = cy + this._hexOffY[i] * HEX_SIZE;
                    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
                if ((Math.abs(col) + Math.abs(row)) % 3 === 0) {
                    ctx.fillStyle = `rgba(${fillRGB},${fillBase * falloff})`;
                    ctx.fill();
                }
                ctx.strokeStyle = `rgba(${strokeRGB},${strokeBase * falloff})`;
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    _cacheStaticZoneFloors(ctx) {
        if (!MAP_CONFIG.zones) return;

        const zoneKeys = Object.keys(MAP_CONFIG.zones);
        ctx.save();
        ctx.font = 'bold 11px monospace';
        for (let zi = 0; zi < zoneKeys.length; zi++) {
            const z = MAP_CONFIG.zones[zoneKeys[zi]];
            const x = z.x - this._terrainCacheOriginX;
            const y = z.y - this._terrainCacheOriginY;
            const sw = z.w;
            const sh = z.h;
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, sw, sh);
            ctx.clip();

            ctx.fillStyle = z.floorColor;
            ctx.fillRect(x, y, sw, sh);

            const worldGS = z.gridSize;
            const startCol = Math.floor(z.x / worldGS) * worldGS;
            const startRow = Math.floor(z.y / worldGS) * worldGS;
            ctx.strokeStyle = z.gridColor;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            for (let wx = startCol; wx <= z.x + z.w + worldGS; wx += worldGS) {
                const sx = wx - this._terrainCacheOriginX;
                ctx.moveTo(sx, y);
                ctx.lineTo(sx, y + sh);
            }
            for (let wy = startRow; wy <= z.y + z.h + worldGS; wy += worldGS) {
                const sy = wy - this._terrainCacheOriginY;
                ctx.moveTo(x, sy);
                ctx.lineTo(x + sw, sy);
            }
            ctx.stroke();
            this._zoneLabelWidths[zoneKeys[zi]] = ctx.measureText(z.label).width;
            ctx.restore();
        }
        ctx.restore();
    }

    _drawStaticTerrain(ctx, camera) {
        if (!this._terrainCacheReady || !this._terrainCacheCanvas) return;
        const tc = this._terrainCacheCanvas;
        const srcW = Math.min(CANVAS.width, tc.width);
        const srcH = Math.min(CANVAS.height, tc.height);
        const maxSrcX = Math.max(0, tc.width - srcW);
        const maxSrcY = Math.max(0, tc.height - srcH);
        const srcX = Math.min(maxSrcX, Math.max(0, Math.floor(camera.x - this._terrainCacheOriginX)));
        const srcY = Math.min(maxSrcY, Math.max(0, Math.floor(camera.y - this._terrainCacheOriginY)));
        ctx.drawImage(tc, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
    }

    // Returns true if (x,y,w,h) overlaps any reserved clear zone.
    // Landmark walls bypass this check; all cluster objects must pass it.
    _isClearZone(x, y, w = 0, h = 0) {
        const zones = [
            { type: 'circle', x: 0, y: 0, r: 300 },          // Spawn area
            { type: 'rect', x: -200, y: -500, w: 400, h: 180 },  // Citadel corridor
            { type: 'rect', x: 360, y: -440, w: 280, h: 160 },  // Database approach
            { type: 'rect', x: -640, y: 340, w: 260, h: 105 },  // Shop approach
            { type: 'rect', x: 390, y: -230, w: 110, h: 140 },  // East gate N gap
            { type: 'rect', x: 390, y: 95, w: 110, h: 70 },  // East gate S gap
            { type: 'rect', x: -510, y: -230, w: 130, h: 140 },  // West gate N gap
            { type: 'rect', x: -510, y: 95, w: 130, h: 70 },  // West gate S gap
        ];
        for (const zone of zones) {
            if (zone.type === 'circle') {
                if (Math.hypot(x - zone.x, y - zone.y) < zone.r) return true;
            } else {
                if (x + w > zone.x && x < zone.x + zone.w &&
                    y + h > zone.y && y < zone.y + zone.h) return true;
            }
        }
        return false;
    }

    generateCampusMap() {
        // ════════════════════════════════════════════════════════
        // MAP v3 — ZONE-ALIGNED PLACEMENT (backport from v3.40.6)
        //
        // Zone boundaries (world coords):
        //   serverFarm  : x:430→1230,   y:-680→20   (800×700)
        //   library     : x:-1230→-430, y:-680→20   (800×700)
        //   courtyard   : x:-600→600,   y:400→1050  (1200×650)
        //   lectureHallL: x:-1100→-680, y:500→900   (420×400)
        //   lectureHallR: x:680→1100,   y:500→900   (420×400)
        //   database    : x:330→670,    y:-660→-320 (340×340)
        //   shop        : x:-670→-330,  y:320→660   (340×340)
        //
        // CLEAR ZONES — enforced by _isClearZone():
        //   Spawn area : r < 300 from (0,0)
        //   Citadel corridor, Database/Shop approaches, East/West gate gaps
        // ════════════════════════════════════════════════════════

        // ── Helper: place a center-anchored grid, skip clear zones ──
        const createCluster = (config) => {
            const { centerX, centerY, rows, cols, xSpacing, ySpacing, type, jitter = 0 } = config;
            const sz = BALANCE.map.objectSizes[type];
            if (!sz) return;
            const startX = centerX - ((cols - 1) * xSpacing) / 2;
            const startY = centerY - ((rows - 1) * ySpacing) / 2;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const jx = (Math.random() - 0.5) * jitter;
                    const jy = (Math.random() - 0.5) * jitter;
                    const objX = startX + c * xSpacing + jx;
                    const objY = startY + r * ySpacing + jy;
                    if (!this._isClearZone(objX, objY, sz.w, sz.h))
                        this.objects.push(new MapObject(objX, objY, sz.w, sz.h, type));
                }
            }
        };

        // ── 1. MTC CITADEL (North landmark) ──────────────────────
        const mtcX = -150, mtcY = -580, mtcW = 300, mtcH = 240;
        this.mtcRoom = new MTCRoom(mtcX, mtcY);
        const wallThick = 40;
        // Landmark walls bypass _isClearZone — they must always spawn
        this.objects.push(new MapObject(mtcX - wallThick, mtcY - wallThick, mtcW + wallThick * 2, wallThick, 'mtcwall'));
        this.objects.push(new MapObject(mtcX - wallThick, mtcY, wallThick, mtcH, 'mtcwall'));
        this.objects.push(new MapObject(mtcX + mtcW, mtcY, wallThick, mtcH, 'mtcwall'));
        // Interior corners — individually checked
        if (!this._isClearZone(mtcX + 14, mtcY + 20, 45, 80))
            this.objects.push(new MapObject(mtcX + 14, mtcY + 20, 45, 80, 'server'));
        if (!this._isClearZone(mtcX + mtcW - 59, mtcY + 20, 45, 80))
            this.objects.push(new MapObject(mtcX + mtcW - 59, mtcY + 20, 45, 80, 'server'));
        if (!this._isClearZone(mtcX + 85, mtcY + 8, 35, 55))
            this.objects.push(new MapObject(mtcX + 85, mtcY + 8, 35, 55, 'datapillar'));
        if (!this._isClearZone(mtcX + 180, mtcY + 8, 35, 55))
            this.objects.push(new MapObject(mtcX + 180, mtcY + 8, 35, 55, 'datapillar'));

        // ── 2. MTC DATABASE (NE landmark) ─────────────────────────
        const dbX = 440, dbY = -560;
        this.objects.push(new MapObject(dbX, dbY, 120, 140, 'database'));
        if (!this._isClearZone(dbX - 55, dbY - 15, 40, 70))
            this.objects.push(new MapObject(dbX - 55, dbY - 15, 40, 70, 'server'));
        if (!this._isClearZone(dbX + 135, dbY - 15, 40, 70))
            this.objects.push(new MapObject(dbX + 135, dbY - 15, 40, 70, 'server'));

        // ── 3. CO-OP STORE (SW landmark) ──────────────────────────
        const shopX = BALANCE.shop.x - 65;   // -565
        const shopY = BALANCE.shop.y - 55;   // 435
        this.objects.push(new MapObject(shopX, shopY, 130, 110, 'coopstore'));
        if (!this._isClearZone(shopX - 55, shopY + 120, 50, 50))
            this.objects.push(new MapObject(shopX - 55, shopY + 120, 50, 50, 'tree'));
        if (!this._isClearZone(shopX + 135, shopY + 120, 50, 50))
            this.objects.push(new MapObject(shopX + 135, shopY + 120, 50, 50, 'tree'));
        if (!this._isClearZone(shopX - 55, shopY + 55, 40, 70))
            this.objects.push(new MapObject(shopX - 55, shopY + 55, 40, 70, 'vendingmachine'));

        // ── 4. ZONE A: Server Farm (East) ─────────────────────────
        // 3 aisles (N/M/S) × 4 servers + datapillar east wall
        createCluster({ centerX: 800, centerY: -530, rows: 1, cols: 4, xSpacing: 120, ySpacing: 0, type: 'server' });
        createCluster({ centerX: 800, centerY: -330, rows: 1, cols: 4, xSpacing: 120, ySpacing: 0, type: 'server' });
        createCluster({ centerX: 800, centerY: -130, rows: 1, cols: 4, xSpacing: 120, ySpacing: 0, type: 'server' });
        createCluster({ centerX: 1120, centerY: -330, rows: 5, cols: 1, xSpacing: 0, ySpacing: 135, type: 'datapillar' });

        // ── 5. ZONE B: Library Archives (West) ────────────────────
        // 4 bookshelf rows + reading desks in aisles
        createCluster({ centerX: -830, centerY: -540, rows: 1, cols: 4, xSpacing: 120, ySpacing: 0, type: 'bookshelf' });
        createCluster({ centerX: -830, centerY: -455, rows: 1, cols: 2, xSpacing: 100, ySpacing: 0, type: 'desk' });
        createCluster({ centerX: -830, centerY: -370, rows: 1, cols: 4, xSpacing: 120, ySpacing: 0, type: 'bookshelf' });
        createCluster({ centerX: -830, centerY: -200, rows: 1, cols: 4, xSpacing: 120, ySpacing: 0, type: 'bookshelf' });
        createCluster({ centerX: -830, centerY: -130, rows: 1, cols: 2, xSpacing: 100, ySpacing: 0, type: 'desk' });
        createCluster({ centerX: -830, centerY: -80, rows: 1, cols: 2, xSpacing: 120, ySpacing: 0, type: 'bookshelf' });

        // ── 6. ZONE C: Courtyard (South) ──────────────────────────
        // 4 corner groves (NW/NE/SW/SE) + back hedge; center lane clear
        createCluster({ centerX: -400, centerY: 540, rows: 2, cols: 2, xSpacing: 80, ySpacing: 80, type: 'tree' });
        createCluster({ centerX: 400, centerY: 540, rows: 2, cols: 2, xSpacing: 80, ySpacing: 80, type: 'tree' });
        createCluster({ centerX: -400, centerY: 840, rows: 2, cols: 2, xSpacing: 80, ySpacing: 80, type: 'tree' });
        createCluster({ centerX: 400, centerY: 840, rows: 2, cols: 2, xSpacing: 80, ySpacing: 80, type: 'tree' });
        createCluster({ centerX: 0, centerY: 970, rows: 1, cols: 5, xSpacing: 160, ySpacing: 0, type: 'tree' });

        // ── 7. LECTURE HALLS ──────────────────────────────────────
        createCluster({ centerX: -890, centerY: 720, rows: 3, cols: 2, xSpacing: 85, ySpacing: 80, type: 'desk' });
        createCluster({ centerX: 890, centerY: 720, rows: 3, cols: 2, xSpacing: 85, ySpacing: 80, type: 'desk' });

        // ── 9. VENDING MACHINES at zone gates ─────────────────────
        const vendingSpots = [
            { x: 550, y: -250 },  // East wall gate
            { x: -550, y: -250 },  // West wall gate
            { x: 0, y: 550 },  // Courtyard south entrance
        ];
        for (const vs of vendingSpots) {
            if (!this._isClearZone(vs.x, vs.y, 40, 70))
                this.objects.push(new MapObject(vs.x, vs.y, 40, 70, 'vendingmachine'));
        }

        // ── 10. EXPLOSIVE BARRELS (tactical chokepoints) ──────────
        const barrelSpots = [
            { x: 830, y: -430 },  // serverFarm — between N and M aisles
            { x: 830, y: -50 },  // serverFarm — south side
            { x: -830, y: -430 },  // library — north aisle flank
            { x: -830, y: -50 },  // library — south side
            { x: 560, y: -50 },  // east gate approach
            { x: -580, y: -50 },  // west gate approach
            { x: -225, y: 460 },  // courtyard N approach
            { x: 165, y: 460 },  // courtyard N approach
            { x: 720, y: 520 },  // lectureHallR approach
            { x: -900, y: 520 },  // lectureHallL approach
        ];
        for (const spot of barrelSpots) {
            let tooClose = false;
            for (const obj of this.objects) {
                if (Math.hypot(obj.x - spot.x, obj.y - spot.y) < 45) { tooClose = true; break; }
            }
            if (!tooClose && !this._isClearZone(spot.x, spot.y, 30, 38))
                this.objects.push(new ExplosiveBarrel(spot.x, spot.y));
        }
    }

    update(entities, dt = 0) {
        // PERF Phase 1: query only nearby objects per entity instead of all objects
        for (const entity of entities) {
            if (entity.dead) continue;
            const r = (entity.radius || 20) + 48; // 48px margin covers object half-widths
            const nearby = this.queryNearby(entity.x, entity.y, r);
            for (let i = 0; i < nearby.length; i++) nearby[i].resolveCollision(entity);
        }
        if (this.mtcRoom && window.player) {
            this.mtcRoom.update(dt, window.player);
        }
    }

    drawTerrain(ctx, camera) {
        if (typeof MAP_CONFIG === 'undefined') return;
        this._ensureTerrainCache();

        // ── Frame counter for animation throttling ────────────────────
        this._terrainFrame = ((this._terrainFrame || 0) + 1) & 0xFF; // 0–255 wrap

        const C = MAP_CONFIG;
        const ws = (wx, wy) => worldToScreen(wx, wy);
        const t = _mapNow * 0.001; // use shared timestamp — no extra performance.now() call

        // ── 1. ARENA BOUNDARY ────────────────────────────────────
        {
            const A = C.arena;
            const origin = ws(0, 0);
            const edgePt = ws(A.radius, 0);
            const radiusSS = Math.abs(edgePt.x - origin.x);

            // Perf: globalAlpha + solid color — no .replace()+toFixed() string alloc per frame
            ctx.save();
            ctx.globalAlpha = A.haloAlphaBase + Math.sin(t * 0.6) * 0.03;
            ctx.strokeStyle = A.haloColorBase;
            ctx.lineWidth = 52; ctx.beginPath(); ctx.arc(origin.x, origin.y, radiusSS, 0, Math.PI * 2); ctx.stroke();

            ctx.globalAlpha = A.midAlphaBase + Math.sin(t * 0.9) * 0.04;
            ctx.strokeStyle = A.midColorBase;
            ctx.lineWidth = 20; ctx.beginPath(); ctx.arc(origin.x, origin.y, radiusSS, 0, Math.PI * 2); ctx.stroke();

            ctx.globalAlpha = A.rimAlphaBase + Math.sin(t * 1.4) * 0.12;
            ctx.strokeStyle = A.rimColorBase;
            ctx.lineWidth = 3; ctx.shadowBlur = A.rimGlowBlur; ctx.shadowColor = A.rimGlowColor;
            ctx.beginPath(); ctx.arc(origin.x, origin.y, radiusSS, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;

            ctx.globalAlpha = A.dashAlphaBase + Math.sin(t * 1.8) * 0.10;
            ctx.strokeStyle = A.dashColorBase;
            ctx.lineWidth = 1.5; ctx.setLineDash([6, 30]); ctx.lineDashOffset = -(t * 18) % 36;
            ctx.beginPath(); ctx.arc(origin.x, origin.y, radiusSS + 10, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]); ctx.lineDashOffset = 0;
            ctx.restore();
        }

        // ── 2. Static cached terrain (hex grid + zone floor base) ─────
        this._drawStaticTerrain(ctx, camera);

        // ── 2b. ZONE FLOOR overlays ─────────────────────────────
        this.drawZoneFloors(ctx);

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
            // ── Packet throttle: render every 2nd frame — imperceptible at 60fps ──
            const _drawPackets = (this._terrainFrame & 1) === 0;
            if (_drawPackets && total > 1) {
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

        // ── 4. ZONE AURAS ─────────────────────────
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

        drawZoneAura({ worldX: -150 + 150, worldY: -580 + 120, innerRgb: '250, 180, 30', outerRgb: '100, 50, 5', radius: 350, phase: 0.5 });
        drawZoneAura(C.auras.database);
        drawZoneAura(C.auras.shop);
        drawZoneAura(C.auras.origin);

                // ── 5. CENTER LANDMARK ────────────────────────────────────
        // Two counter-rotating rings at (0,0) — persistent directional
        // reference for players, marks the spawn point visually.
        if (C.landmark) {
            const LM = C.landmark;
            const { x: ox, y: oy } = ws(0, 0);
            const edgePt = ws(LM.outerRadius, 0);
            const rOuter = Math.abs(edgePt.x - ox);
            const rInner = rOuter * (LM.innerRadius / LM.outerRadius);

            const pulse = 0.5 + Math.sin(t * LM.pulseSpeed) * 0.5;
            const aOuter = LM.outerAlphaBase + pulse * 0.30;
            const aInner = LM.innerAlphaBase + pulse * 0.25;
            const rotOuter = t * LM.rotSpeedOuter;
            const rotInner = t * LM.rotSpeedInner;

            ctx.save();

            // Glow backdrop
            ctx.shadowBlur = LM.glowBlur;
            ctx.shadowColor = LM.glowColor;

            // Outer ring (gold, clockwise)
            // Perf: globalAlpha + solid color — no .replace()+toFixed() string alloc per frame
            ctx.strokeStyle = LM.outerColorBase;
            ctx.globalAlpha = aOuter;
            ctx.lineWidth = LM.ringWidth;
            ctx.setLineDash([18, 10]);
            ctx.lineDashOffset = -rotOuter * rOuter;
            ctx.beginPath(); ctx.arc(ox, oy, rOuter, 0, Math.PI * 2); ctx.stroke();

            // Inner ring (cyan, counter-clockwise)
            ctx.strokeStyle = LM.innerColorBase;
            ctx.globalAlpha = aInner;
            ctx.setLineDash([12, 14]);
            ctx.lineDashOffset = -rotInner * rInner;
            ctx.beginPath(); ctx.arc(ox, oy, rInner, 0, Math.PI * 2); ctx.stroke();

            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
            ctx.shadowBlur = 0;

            // Spokes — faint lines from inner to outer ring
            ctx.strokeStyle = LM.spokeColorBase;
            ctx.globalAlpha = LM.spokeAlpha * pulse;
            ctx.lineWidth = 1;
            for (let i = 0; i < LM.spokeCount; i++) {
                const angle = rotOuter + (Math.PI * 2 / LM.spokeCount) * i;
                ctx.beginPath();
                ctx.moveTo(ox + Math.cos(angle) * rInner, oy + Math.sin(angle) * rInner);
                ctx.lineTo(ox + Math.cos(angle) * rOuter, oy + Math.sin(angle) * rOuter);
                ctx.stroke();
            }

            // Center dot
            ctx.fillStyle = LM.spokeColorBase;
            ctx.globalAlpha = 0.7 + pulse * 0.3;
            ctx.shadowBlur = 10; ctx.shadowColor = LM.glowColor;
            ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            ctx.restore();
        }
    }

    drawZoneFloors(ctx) {
        if (typeof MAP_CONFIG === 'undefined' || !MAP_CONFIG.zones) return;
        const t = _mapNow * 0.001;
        const zoneKeys = Object.keys(MAP_CONFIG.zones);

        for (let zi = 0; zi < zoneKeys.length; zi++) {
            const z = MAP_CONFIG.zones[zoneKeys[zi]];
            const tl = worldToScreen(z.x, z.y);
            const br = worldToScreen(z.x + z.w, z.y + z.h);
            const sw = br.x - tl.x, sh = br.y - tl.y;
            if (sw <= 0 || sh <= 0) continue;
            // Viewport cull
            if (br.x < 0 || tl.x > CANVAS.width || br.y < 0 || tl.y > CANVAS.height) continue;

            ctx.save();
            ctx.beginPath(); ctx.rect(tl.x, tl.y, sw, sh); ctx.clip();

            // Pulsing inner border accent
            const pulse = 0.5 + Math.sin(t * 1.2 + zi) * 0.5;
            ctx.strokeStyle = z.accentColor;
            ctx.globalAlpha = 0.08 + pulse * 0.12;
            ctx.lineWidth = 3;
            ctx.strokeRect(tl.x + 2, tl.y + 2, sw - 4, sh - 4);

            // Zone label — pill badge, top-left corner
            {
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                const labelAlpha = 0.70 + pulse * 0.20;
                const lw = this._zoneLabelWidths[zoneKeys[zi]] ?? ctx.measureText(z.label).width;
                const px = 6, py = 5, lh = 13;
                const pillX = tl.x + 8, pillY = tl.y + 6;

                // Pill background
                ctx.globalAlpha = 0.30 + pulse * 0.10;
                ctx.fillStyle = 'rgba(0,0,0,0.55)';
                ctx.beginPath();
                ctx.roundRect(pillX - px, pillY - py * 0.5, lw + px * 2, lh + py, 5);
                ctx.fill();

                // Pill border (zone accent)
                ctx.globalAlpha = 0.20 + pulse * 0.12;
                ctx.strokeStyle = z.accentColor;
                ctx.lineWidth = 1;
                ctx.stroke();

                // Label text
                ctx.globalAlpha = labelAlpha;
                ctx.fillStyle = z.accentColor;
                ctx.fillText(z.label, pillX, pillY);

                ctx.globalAlpha = 1;
            }

            ctx.globalAlpha = 1;

            // ── Ambient micro-particles (deterministic, no Math.random) ──
            // Each zone gets 7 small dots whose positions oscillate with sin/cos.
            // PHI-spaced seeds prevent all dots pulsing in sync.
            if (z.ambientColor) {
                const PHI = 2.399; // golden-angle increment
                const COUNT = 4;
                ctx.save();
                ctx.beginPath(); ctx.rect(tl.x, tl.y, sw, sh); ctx.clip();
                for (let i = 0; i < COUNT; i++) {
                    const seed = i * PHI;
                    // World position oscillates slowly within zone bounds
                    const wx = z.x + z.w * (0.15 + 0.70 * ((Math.sin(seed * 3.7) + 1) * 0.5))
                        + Math.sin(t * 0.4 + seed) * 18;
                    const wy = z.y + z.h * (0.15 + 0.70 * ((Math.cos(seed * 2.9) + 1) * 0.5))
                        + Math.cos(t * 0.5 + seed * 1.3) * 14;
                    const ss = worldToScreen(wx, wy);
                    const alpha = 0.25 + Math.sin(t * 1.1 + seed) * 0.20;
                    const r = 2.5 + Math.sin(t * 0.8 + seed * 2) * 1.0;
                    ctx.globalAlpha = Math.max(0, alpha);
                    ctx.fillStyle = z.ambientColor;
                    ctx.beginPath(); ctx.arc(ss.x, ss.y, r, 0, Math.PI * 2); ctx.fill();
                }
                ctx.globalAlpha = 1;
                ctx.restore();
            }

            ctx.restore();
        }
    }

    draw() {
        _updateMapNow();
        // Draw floor/base of MTC room FIRST (so walls appear on top)
        if (this.mtcRoom) this.mtcRoom.draw();

        const CULL = 80; // ลด 120→80 objects เล็กไม่ต้องรอ margin ใหญ่
        // Re-sort only when objects change (dirty flag) — ป้องกัน sort ทุกเฟรม
        if (!this._sortedObjects || this._objectsDirty) {
            this._sortedObjects = [...this.objects].sort((a, b) => a.y - b.y);
            this._objectsDirty = false;
        }
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
        const sizeChanged = lc.width !== CANVAS.width || lc.height !== CANVAS.height;
        if (sizeChanged) { lc.width = CANVAS.width; lc.height = CANVAS.height; }

        // PERF Phase 2: throttle full redraw to every 2nd frame (~30Hz refresh).
        // Lighting changes gradually — 30Hz is visually indistinguishable from 60Hz.
        // On skip frames, blit the cached canvas directly and return early.
        this._lightFrame = ((this._lightFrame || 0) + 1) & 0xFF;
        if (!sizeChanged && (this._lightFrame & 1) !== 0) {
            CTX.drawImage(lc, 0, 0);
            return;
        }

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
            else if (type === 'green') { tInner = `rgba(74,222,128,${tAlpha})`; tOuter = 'rgba(34,197,94,0)'; }
            else { tInner = `rgba(210,225,255,${tAlpha * .7})`; tOuter = 'rgba(180,205,255,0)'; }
            const tint = lctx.createRadialGradient(x, y, 0, x, y, tintR);
            tint.addColorStop(0, tInner); tint.addColorStop(1, tOuter);
            lctx.fillStyle = tint; lctx.beginPath(); lctx.arc(x, y, tintR, 0, Math.PI * 2); lctx.fill();
        };

        if (player && !player.dead) punchLight(player.x, player.y, L.playerLightRadius, 'warm', player.isDashing ? 1.25 : 1.0);

        if (Array.isArray(projectiles)) {
            const PROJ_MARGIN = L.projectileLightRadius + 60;
            for (const proj of projectiles) {
                if (!proj || proj.dead) continue;
                const ss = toSS(proj.x, proj.y);
                if (ss.x < -PROJ_MARGIN || ss.x > lc.width + PROJ_MARGIN ||
                    ss.y < -PROJ_MARGIN || ss.y > lc.height + PROJ_MARGIN) continue;
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
            else if (obj.type === 'server') punchLight(obj.x + obj.w * .5, obj.y + obj.h * .4, L.serverRackLightRadius, 'warm');
            else if (obj.type === 'tree') punchLight(obj.x + obj.w * .5, obj.y + obj.h * .2, 45, 'green');
            else if (obj.type === 'database') punchLight(obj.x + obj.w * .5, obj.y + obj.h * .3, L.mtcServerLightRadius, 'warm');
            else if (obj.type === 'coopstore') punchLight(obj.x + obj.w * .5, obj.y + obj.h * .3, L.shopLightRadius, 'warm');
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
        this.objects = surviving; this._sortedObjects = null; this._objectsDirty = true;

        if (this.mtcRoom) {
            const r = this.mtcRoom;
            if (lineHitsAABB(startX, startY, endX, endY, r.x, r.y, r.w, r.h)) {
                const rcx = r.x + r.w * 0.5, rcy = r.y + r.h * 0.5;
                if (typeof spawnParticles === 'function') { spawnParticles(rcx, rcy, 15, '#38bdf8'); spawnParticles(rcx, rcy, 5, '#ff4500'); }
                if (typeof spawnFloatingText === 'function') spawnFloatingText('🛡️ SHIELD HIT!', rcx, rcy - 35, '#38bdf8', 22);
            }
        }
    }

    clear() { this.objects = []; this.mtcRoom = null; this.initialized = false; this._sortedObjects = null; this._objectsDirty = true; }
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
