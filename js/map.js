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
        const sinOrb = Math.sin(now / 900);
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

        // ── 3. WALL COLUMNS (4 corners inside room) ──────────────
        const colW = 14, colH = H;
        const colPositions = [s.x, s.x + W - colW];
        for (const cpx of colPositions) {
            CTX.fillStyle = '#0c1220';
            CTX.fillRect(cpx, s.y, colW, colH);
            // Column highlight stripe
            CTX.fillStyle = `rgba(250,180,30,${0.12 + fastPulse * 0.08})`;
            CTX.fillRect(cpx + 2, s.y + 18, 2, colH - 36);
            CTX.fillRect(cpx + colW - 4, s.y + 18, 2, colH - 36);
            // Column cap lights
            CTX.fillStyle = `rgba(250,180,30,${0.6 + fastPulse * 0.4})`;
            CTX.beginPath(); CTX.arc(cpx + colW / 2, s.y + 26, 4, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.arc(cpx + colW / 2, s.y + H - 26, 4, 0, Math.PI * 2); CTX.fill();
        }

        // ── 4. CENTRAL HOLO-TABLE ────────────────────────────────
        const holoW = 140, holoH = 70;
        const holoX = cx - holoW / 2, holoY = cy - holoH / 2;

        // Table body
        CTX.fillStyle = '#0a0f1a';
        CTX.beginPath(); CTX.roundRect(holoX, holoY, holoW, holoH, 8); CTX.fill();
        // Double border (fake glow)
        if (active) {
            CTX.strokeStyle = `rgba(217,119,6,${0.18 + fastPulse * 0.12})`;
            CTX.lineWidth = 7;
            CTX.beginPath(); CTX.roundRect(holoX, holoY, holoW, holoH, 8); CTX.stroke();
        }
        CTX.strokeStyle = active ? `rgba(250,180,30,${0.65 + fastPulse * 0.35})` : 'rgba(60,30,5,0.5)';
        CTX.lineWidth = 1.5;
        CTX.beginPath(); CTX.roundRect(holoX, holoY, holoW, holoH, 8); CTX.stroke();

        if (active) {
            // Hologram projection cone
            const holoHeight = 32 + fastPulse * 8;
            CTX.fillStyle = `rgba(217,119,6,${0.07 * pulse})`;
            CTX.beginPath();
            CTX.moveTo(cx - 4, holoY - holoHeight);
            CTX.lineTo(cx - holoW * 0.38, holoY);
            CTX.lineTo(cx + holoW * 0.38, holoY);
            CTX.lineTo(cx + 4, holoY - holoHeight);
            CTX.closePath(); CTX.fill();
            // Cone edge lines
            CTX.strokeStyle = `rgba(250,180,30,${0.20 * pulse})`;
            CTX.lineWidth = 1;
            CTX.beginPath();
            CTX.moveTo(cx - 4, holoY - holoHeight); CTX.lineTo(cx - holoW * 0.38, holoY);
            CTX.moveTo(cx + 4, holoY - holoHeight); CTX.lineTo(cx + holoW * 0.38, holoY);
            CTX.stroke();

            // Hologram: double rotating hex rings
            CTX.save();
            CTX.translate(cx, holoY - 18);
            for (let ring = 0; ring < 2; ring++) {
                const r = 9 + ring * 6;
                const rot = (ring % 2 === 0 ? 1 : -1) * now / (2000 + ring * 500);
                CTX.rotate(rot);
                CTX.strokeStyle = `rgba(250,180,30,${(0.7 - ring * 0.2) + fastPulse * 0.25})`;
                CTX.lineWidth = 1.5 - ring * 0.4;
                CTX.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (Math.PI / 3) * i;
                    i === 0 ? CTX.moveTo(Math.cos(a) * r, Math.sin(a) * r)
                        : CTX.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                }
                CTX.closePath(); CTX.stroke();
            }
            // Center dot
            CTX.fillStyle = `rgba(251,191,36,${0.8 + fastPulse * 0.2})`;
            CTX.beginPath(); CTX.arc(0, 0, 2.5, 0, Math.PI * 2); CTX.fill();
            CTX.restore();

            // Status bars
            const bars = [
                { w: (holoW - 32) * (0.4 + Math.sin(now / 600) * 0.3), col: 'rgba(250,180,30,0.6)' },
                { w: (holoW - 32) * (0.4 + Math.sin(now / 800 + 1) * 0.3), col: 'rgba(34,211,238,0.55)' },
                { w: (holoW - 32) * (0.4 + Math.sin(now / 700 + 2) * 0.3), col: 'rgba(249,115,22,0.6)' },
            ];
            for (let i = 0; i < 3; i++) {
                CTX.fillStyle = 'rgba(255,255,255,0.05)';
                CTX.fillRect(holoX + 16, holoY + 12 + i * 14, holoW - 32, 5);
                CTX.fillStyle = bars[i].col;
                CTX.fillRect(holoX + 16, holoY + 12 + i * 14, bars[i].w, 5);
            }
            CTX.fillStyle = 'rgba(254,243,199,0.9)';
            CTX.font = 'bold 8px Orbitron,monospace';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText('MTC SYSTEM ONLINE', cx, holoY + holoH - 11);

            // ── Next Buff Indicator ──
            if (typeof BALANCE !== 'undefined' && BALANCE.mtcRoom && BALANCE.mtcRoom.buffCycleNames) {
                const C = BALANCE.mtcRoom;
                const nextName = C.buffCycleNames[this.buffCycleIndex];
                const nextColor = C.buffCycleColors[this.buffCycleIndex];
                const nextIcon = C.buffCycleIcons[this.buffCycleIndex];
                // Badge background
                CTX.fillStyle = `rgba(0,0,0,0.35)`;
                CTX.beginPath(); CTX.roundRect(holoX + 8, holoY + 3, holoW - 16, 11, 3); CTX.fill();
                CTX.fillStyle = nextColor;
                CTX.globalAlpha = 0.7 + fastPulse * 0.25;
                CTX.font = 'bold 7px monospace';
                CTX.fillText(`NEXT: ${nextIcon} ${nextName}`, cx, holoY + 9);
                CTX.globalAlpha = 1;
            }

            // ── Active Buff Timer (if player has one running) ──
            const pl = window.player;
            if (pl && pl.mtcBuffTimer > 0 && pl.mtcBuffType >= 0) {
                const C = BALANCE.mtcRoom;
                const buffCol = C.buffCycleColors[pl.mtcBuffType];
                const buffName = C.buffCycleNames[pl.mtcBuffType];
                const totalDur = C.buffCycleDuration[pl.mtcBuffType] || 1;
                const pct = pl.mtcBuffTimer / totalDur;
                // Progress bar under the table
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

            // ── Ambient floating orbs (left & right of table) ──
            const orbData = [
                { ox: holoX - 28, oy: cy + Math.sin(now / 900) * 8, col: '250,180,30' },
                { ox: holoX + holoW + 28, oy: cy + Math.sin(now / 900 + 2) * 8, col: '34,211,238' },
                { ox: cx, oy: holoY - holoHeight - 18 + sinOrb * 5, col: '251,191,36' },
            ];
            for (const o of orbData) {
                CTX.fillStyle = `rgba(${o.col},${0.12 + fastPulse * 0.06})`;
                CTX.beginPath(); CTX.arc(o.ox, o.oy, 10, 0, Math.PI * 2); CTX.fill();
                CTX.fillStyle = `rgba(${o.col},${0.7 + fastPulse * 0.3})`;
                CTX.beginPath(); CTX.arc(o.ox, o.oy, 3, 0, Math.PI * 2); CTX.fill();
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

        // ── 5. SIDE TERMINALS ────────────────────────────────────
        const termY = s.y + H / 2 - 24;
        const termDefs = [
            { x: s.x + colW + 6, color: '#fbbf24', rgb: '251,191,36' },
            { x: s.x + W - colW - 30, color: '#22d3ee', rgb: '34,211,238' }
        ];
        for (const term of termDefs) {
            CTX.fillStyle = '#080e1c';
            CTX.beginPath(); CTX.roundRect(term.x, termY, 24, 48, 4); CTX.fill();
            CTX.strokeStyle = active ? `rgba(${term.rgb},${0.5 + fastPulse * 0.3})` : 'rgba(30,20,5,0.5)';
            CTX.lineWidth = 1.5;
            CTX.beginPath(); CTX.roundRect(term.x, termY, 24, 48, 4); CTX.stroke();
            // Screen mini-display
            CTX.fillStyle = active ? `rgba(${term.rgb},0.08)` : 'rgba(0,0,0,0.3)';
            CTX.fillRect(term.x + 3, termY + 3, 18, 10);
            // LED dots
            for (let d = 0; d < 5; d++) {
                const isOn = active && Math.sin(now / (280 + d * 110) + d * 1.5) > 0;
                CTX.fillStyle = isOn ? term.color : '#1a0e02';
                CTX.beginPath(); CTX.arc(term.x + 12, termY + 18 + d * 7, 2.5, 0, Math.PI * 2); CTX.fill();
            }
        }

        // ── 6. ENTRANCE FORCEFIELD ───────────────────────────────
        const ffY = s.y + H;
        if (active) {
            const ffAlpha = pulse * 0.85;
            // Hex tile chain along the forcefield line
            const hexCount = 7;
            const hexSpacing = (W - 40) / (hexCount - 1);
            CTX.strokeStyle = `rgba(250,180,30,${0.18 * pulse})`;
            CTX.lineWidth = 0.8;
            for (let hi = 0; hi < hexCount; hi++) {
                const hx = s.x + 20 + hi * hexSpacing;
                CTX.beginPath();
                for (let k = 0; k < 6; k++) {
                    const ha = (Math.PI / 3) * k - Math.PI / 6;
                    const hpx = hx + Math.cos(ha) * 8, hpy = ffY + Math.sin(ha) * 8;
                    k === 0 ? CTX.moveTo(hpx, hpy) : CTX.lineTo(hpx, hpy);
                }
                CTX.closePath(); CTX.stroke();
            }
            // Outer glow line
            CTX.strokeStyle = `rgba(180,100,10,${ffAlpha * 0.45})`;
            CTX.lineWidth = 7;
            CTX.beginPath(); CTX.moveTo(s.x + 20, ffY); CTX.lineTo(s.x + W - 20, ffY); CTX.stroke();
            // Bright core
            CTX.strokeStyle = `rgba(250,180,30,${ffAlpha})`;
            CTX.lineWidth = 2;
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
        this._objectsDirty = true;
        this.initialized = true;
        console.log(`✅ Campus Map Generated Structurally: ${this.objects.length} objects`);
    }

    generateCampusMap() {
        // ════════════════════════════════════════════════════════
        // MAP REFACTOR v2 — CLEAR ZONE DISCIPLINE
        //
        // CLEAR ZONES (ห้ามวาง object ใดๆ):
        //   • Spawn area          : r < 300 จาก (0,0)
        //   • Citadel approach    : x∈[-200,200], y∈[-500,-320] (walled corridor)
        //   • Database approach   : x∈[360,640],  y∈[-440,-280] (south face)
        //   • CoopStore approach  : x∈[-640,-380], y∈[340,445]  (north approach)
        //   • East gate gaps      : x∈[390,500],  y∈[-230,-90] และ y∈[95,165]
        //   • West gate gaps      : x∈[-510,-380], y∈[-230,-90] และ y∈[95,165]
        //
        // ZONE ISLANDS:
        //   A Server Farm East   : x ≥ 680 (clear of database x=560 + east wall x=418)
        //   B Library West       : x ≤ -680 (clear of west wall x=-418)
        //   C Courtyard South    : y ≥ 580, หลีกเลี่ยง x∈[-640,-380] (shop approach)
        //   D Lecture Halls      : x<-800 y>550 และ x>700 y>550
        // ════════════════════════════════════════════════════════

        // ── Helpers ──────────────────────────────────────────────
        const detJitter = (r, c, seed, mag) => ({
            jx: Math.sin(r * 7.3 + c * 13.1 + seed) * mag,
            jy: Math.cos(r * 11.7 + c * 5.9 + seed * 1.3) * mag,
        });

        const createAisles = (startX, startY, rows, cols, xStep, yStep, type, jitter = 0, seed = 0) => {
            const sz = {
                desk: { w: 60, h: 40 }, tree: { w: 50, h: 50 },
                server: { w: 45, h: 80 }, datapillar: { w: 35, h: 70 },
                bookshelf: { w: 80, h: 40 }, vendingmachine: { w: 40, h: 70 },
            }[type];
            if (!sz) return;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const { jx, jy } = jitter > 0 ? detJitter(r, c, seed, jitter) : { jx: 0, jy: 0 };
                    this.objects.push(new MapObject(
                        startX + c * xStep + jx,
                        startY + r * yStep + jy,
                        sz.w, sz.h, type
                    ));
                }
            }
        };

        // ── 1. MTC CITADEL (North landmark) ──────────────────────
        // Interior: x=-150…150, y=-580…-340  |  Entrance open at south (y=-340)
        // Approach corridor (walled, from config): x=-200…200, y=-500…-340 → KEEP CLEAR
        const mtcX = -150, mtcY = -580, mtcW = 300, mtcH = 240;
        this.mtcRoom = new MTCRoom(mtcX, mtcY);

        const wallThick = 40;
        // Top wall + side walls (no south wall — open entrance)
        this.objects.push(new MapObject(mtcX - wallThick, mtcY - wallThick, mtcW + wallThick * 2, wallThick, 'mtcwall'));
        this.objects.push(new MapObject(mtcX - wallThick, mtcY, wallThick, mtcH, 'mtcwall'));
        this.objects.push(new MapObject(mtcX + mtcW, mtcY, wallThick, mtcH, 'mtcwall'));

        // Interior decorations — pushed into wall corners only, clear center path
        this.objects.push(new MapObject(mtcX + 14, mtcY + 20, 45, 80, 'server'));
        this.objects.push(new MapObject(mtcX + mtcW - 59, mtcY + 20, 45, 80, 'server'));
        this.objects.push(new MapObject(mtcX + 85, mtcY + 8, 35, 55, 'datapillar'));
        this.objects.push(new MapObject(mtcX + 180, mtcY + 8, 35, 55, 'datapillar'));

        // ── 2. MTC DATABASE CLUSTER (NE landmark) ────────────────
        // Building: x=440…560, y=-560…-420  |  Approach from south (y > -420) CLEAR
        // Clear zone enforced: x∈[360,640], y∈[-440,-280] — no objects here
        const dbX = 440, dbY = -560;
        this.objects.push(new MapObject(dbX, dbY, 120, 140, 'database'));
        // 2 servers BEHIND building (north of it — y < dbY)
        this.objects.push(new MapObject(dbX - 55, dbY - 15, 40, 70, 'server'));
        this.objects.push(new MapObject(dbX + 135, dbY - 15, 40, 70, 'server'));

        // ── 3. MTC CO-OP STORE (SW landmark) ─────────────────────
        // Building centered on interaction point: BALANCE.shop.x=-500, y=490
        // Approach from north (y < shopY) CLEAR:  x∈[-640,-380], y∈[340,445]
        const shopX = BALANCE.shop.x - 65;   // = -565
        const shopY = BALANCE.shop.y - 55;   // = 435
        this.objects.push(new MapObject(shopX, shopY, 130, 110, 'coopstore'));
        // Decorations ONLY south of building (y > shopY + 110 = 545), not blocking north approach
        this.objects.push(new MapObject(shopX - 55, shopY + 120, 50, 50, 'tree'));
        this.objects.push(new MapObject(shopX + 135, shopY + 120, 50, 50, 'tree'));
        this.objects.push(new MapObject(shopX - 55, shopY + 55, 40, 70, 'vendingmachine'));

        // ── 4. ZONE A: Server Farm (East) ────────────────────────
        // x ≥ 680 — clear of database east edge (x=560) + east corridor wall (x=418)
        // MOVED FURTHER EAST to avoid visual overlap with database
        createAisles(720, -580, 4, 3, 120, 150, 'server', 0, 0);   // NE cluster (moved +40px)
        createAisles(720, 60, 3, 3, 120, 150, 'server', 0, 0);   // SE cluster (moved +40px)
        createAisles(1100, -500, 3, 2, 120, 150, 'server', 0, 0);  // Far-East cluster (moved +40px)
        // Data pillars as zone markers — moved further east to clear database zone
        createAisles(680, -550, 3, 1, 0, 160, 'datapillar');  // West edge of zone A (moved +40px)
        createAisles(680, 80, 2, 1, 0, 160, 'datapillar');   // South section (moved +40px)

        // ── 5. ZONE B: Library Archives (West) ───────────────────
        // x ≤ -680 — clear of west corridor wall (x=-418), gap ≥ 262px
        createAisles(-680, -570, 5, 2, -240, 120, 'bookshelf', 0, 0);  // NW shelves
        createAisles(-680, 60, 4, 2, -240, 120, 'bookshelf', 0, 0);  // SW shelves
        // Study desks between shelf rows — stay at x=-880 to -950
        createAisles(-880, -550, 4, 1, 0, 120, 'desk');  // NW desks
        createAisles(-880, 80, 3, 1, 0, 120, 'desk');  // SW desks

        // ── 6. ZONE C: Courtyard (South) ─────────────────────────
        // y ≥ 580 — clear of shop (shopY+110=545) + shop approach (y∈[340,445])
        // MOVED FURTHER SOUTH to avoid shop approach interference
        createAisles(-750, 630, 2, 4, 200, 180, 'tree', 12, 1.0);  // SW courtyard (moved +50px)
        createAisles(250, 630, 2, 4, 185, 180, 'tree', 10, 2.0);  // SE courtyard (moved +50px)

        // ... (rest of the code remains the same)

        // ── 9. VENDING MACHINES at zone gates ────────────────────
        // Rule: must be OUTSIDE all clear zones listed at top of function
        // East gate: x ≥ 510 (outside east gate gap x∈[390,500])
        // West gate: x ≤ -530 (outside west gate gap x∈[-510,-380])
        // South gate: y ≥ 360, x outside shop approach x∈[-640,-380]
        // North: REMOVED - no vending inside citadel corridor (was blocking)
        const vendingSpots = [
            { x: 540, y: -260 },   // East gate upper (moved +20px)
            { x: 540, y: 130 },   // East gate lower (moved +20px)
            { x: -570, y: -260 },  // West gate upper (moved -20px)
            { x: -570, y: 130 },  // West gate lower (moved -20px)
            { x: -210, y: 390 },  // South approach left (moved +30px)
            { x: 165, y: 390 },  // South approach right (moved +30px)
        ];
        for (const vs of vendingSpots) {
            this.objects.push(new MapObject(vs.x, vs.y, 40, 70, 'vendingmachine'));
        }

        // ── 10. CORRIDOR LANDMARK TREES ──────────────────────────
        // Placed at zone entrances as visual landmarks, NOT inside any clear zone
        // East entrance trees: x=540-580 (east of gap), y outside gate gaps
        this.objects.push(new MapObject(550, -310, 50, 50, 'tree'));   // NE approach tree (moved +20px)
        this.objects.push(new MapObject(550, 190, 50, 50, 'tree'));   // SE approach tree (moved +20px)
        // West entrance trees: x=-630 to -660 (west of gap)
        this.objects.push(new MapObject(-630, -310, 50, 50, 'tree'));  // West approach tree (moved -20px)
        this.objects.push(new MapObject(-630, 190, 50, 50, 'tree'));  // West approach tree (moved -20px)
        // Citadel flanking trees: MOVED OUTSIDE walled corridor completely
        // Original y=-440 was INSIDE the walled corridor (y∈[-480,-370]) - BLOCKING!
        this.objects.push(new MapObject(230, -510, 50, 50, 'tree'));   // East flank (moved south)
        this.objects.push(new MapObject(-280, -510, 50, 50, 'tree'));   // West flank (moved south)

        // ... (rest of the code remains the same)

        // ── 12. EXPLOSIVE BARRELS ────────────────────────────────
        // Placed at tactical chokepoints, tooClose check prevents overlap
        const barrelSpots = [
            // East zone interior
            { x: 820, y: -220 }, { x: 820, y: 80 },
            // West zone interior
            { x: -840, y: -220 }, { x: -840, y: 80 },
            // East gate approach (just inside zone A, not in clear gap)
            { x: 560, y: -50 },
            // West gate approach
            { x: -580, y: -50 },
            // South approach (outside shop approach zone)
            { x: -225, y: 440 }, { x: 165, y: 440 },
        ];
        for (const spot of barrelSpots) {
            let tooClose = false;
            for (const obj of this.objects) {
                if (Math.hypot(obj.x - spot.x, obj.y - spot.y) < 60) { tooClose = true; break; }
            }
            if (!tooClose) this.objects.push(new ExplosiveBarrel(spot.x, spot.y));
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

        // ── 2b. ZONE FLOORS ──────────────────────────────────────
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
            ctx.strokeStyle = LM.outerColor.replace('{a}', aOuter.toFixed(3));
            ctx.lineWidth = LM.ringWidth;
            ctx.setLineDash([18, 10]);
            ctx.lineDashOffset = -rotOuter * rOuter;
            ctx.beginPath(); ctx.arc(ox, oy, rOuter, 0, Math.PI * 2); ctx.stroke();

            // Inner ring (cyan, counter-clockwise)
            ctx.strokeStyle = LM.innerColor.replace('{a}', aInner.toFixed(3));
            ctx.setLineDash([12, 14]);
            ctx.lineDashOffset = -rotInner * rInner;
            ctx.beginPath(); ctx.arc(ox, oy, rInner, 0, Math.PI * 2); ctx.stroke();

            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
            ctx.shadowBlur = 0;

            // Spokes — faint lines from inner to outer ring
            ctx.strokeStyle = `rgba(250,180,30,${(LM.spokeAlpha * pulse).toFixed(3)})`;
            ctx.lineWidth = 1;
            for (let i = 0; i < LM.spokeCount; i++) {
                const angle = rotOuter + (Math.PI * 2 / LM.spokeCount) * i;
                ctx.beginPath();
                ctx.moveTo(ox + Math.cos(angle) * rInner, oy + Math.sin(angle) * rInner);
                ctx.lineTo(ox + Math.cos(angle) * rOuter, oy + Math.sin(angle) * rOuter);
                ctx.stroke();
            }

            // Center dot
            ctx.fillStyle = `rgba(250,180,30,${(0.7 + pulse * 0.3).toFixed(3)})`;
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

            // Floor tint
            ctx.fillStyle = z.floorColor;
            ctx.fillRect(tl.x, tl.y, sw, sh);

            // Ortho grid — one stroke batch
            const worldGS = z.gridSize;
            const startCol = Math.floor(z.x / worldGS) * worldGS;
            const startRow = Math.floor(z.y / worldGS) * worldGS;
            ctx.strokeStyle = z.gridColor;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            for (let wx = startCol; wx <= z.x + z.w + worldGS; wx += worldGS) {
                const sx = worldToScreen(wx, 0).x;
                ctx.moveTo(sx, tl.y); ctx.lineTo(sx, br.y);
            }
            for (let wy = startRow; wy <= z.y + z.h + worldGS; wy += worldGS) {
                const sy = worldToScreen(0, wy).y;
                ctx.moveTo(tl.x, sy); ctx.lineTo(br.x, sy);
            }
            ctx.stroke();

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
                const metrics = ctx.measureText(z.label);
                const lw = metrics.width;
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
                const COUNT = 7;
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
            else if (type === 'green') { tInner = `rgba(74,222,128,${tAlpha})`; tOuter = 'rgba(34,197,94,0)'; }
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