"use strict";
// ══════════════════════════════════════════════════════════════════
//  js/ui/CanvasHUD.js  —  extracted from ui.js in v3.44.4
//  Phase 4 of HIGH #2 (see Markdown Source/Successed-Plan/HIGH2-…).
//
//  CanvasHUD owns every ctx.* draw call that belongs to the game HUD:
//    * Combo counter (addCombo / drawCombo)
//    * Confused-state warning banner
//    * Tactical minimap / radar (offscreen-cached at ~15 Hz)
//
//  Extraction is a pure move — no behaviour change.  The class is
//  registered on window.CanvasHUD and game.js continues to invoke
//  CanvasHUD.draw(ctx, dt) once per frame.
//
//  Dependencies (read at call-time, so load order only needs to make
//  them exist before the first frame):
//    window.UIManager.injectCooldownStyles  — ui.js
//    window.UIManager._minimapFrame         — UIManager static counter
//    window.player, enemies, boss, isFogWave,
//      MTC_DATABASE_SERVER, MTC_SHOP_LOCATION — runtime globals
//    lerpColorHex                           — utils.js
//    GAME_TEXTS                             — game-texts.js
// ══════════════════════════════════════════════════════════════════

// ── Combo state (module scope) ─────────────────────────────────────
// Previously lived at module scope in ui.js.  Moved here because the
// drawCombo / updateCombo methods close over them.  addCombo() is kept
// as a backward-compat export on window — external game code can still
// call `addCombo()` if it ever starts doing so (currently unused).
let comboCount = 0;
let comboTimer = 0;
let comboScale = 1.0;
let comboShake = 0.0;
const comboShakeDecay = 4.5;
const comboScaleDecay = 6.0;

// Respect user's motion preference — canvas shake is not governed by CSS.
// Cached at module load; matchMedia listener would be overkill for this.
const _PREFERS_REDUCED_MOTION =
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function addCombo() {
    comboCount++;
    comboTimer = 2.0;
    comboScale = 1.6;
    comboShake = Math.min(1.0, 0.15 + comboCount / 30);
    try { if (typeof Audio !== 'undefined' && Audio.playCombo) Audio.playCombo(); } catch (e) { }
}

class CanvasHUD {

    // -- Frame entry point -----------------------------------
    static draw(ctx, dt) {
        // UIManager may not be loaded yet on the very first call; guard.
        if (typeof window.UIManager?.injectCooldownStyles === 'function') {
            window.UIManager.injectCooldownStyles(); // no-op after first call
        }
        CanvasHUD.updateCombo(dt);
        CanvasHUD.drawCombo(ctx);
        if (!ctx || !ctx.canvas) return;
        CanvasHUD.drawConfusedWarning(ctx); // before minimap
        CanvasHUD.drawMinimap(ctx);         // always on top
    }

    // ── Combo UI ──────────────────────────────────────────────
    static updateCombo(dt) {
        if (comboTimer > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0) {
                comboTimer = 0; comboCount = 0;
                comboScale = 1; comboShake = 0;
            }
        }
        comboScale += (1 - comboScale) * Math.min(1, dt * comboScaleDecay);
        comboShake = Math.max(0, comboShake - dt * comboShakeDecay);
    }

    static drawCombo(ctx) {
        if (!ctx || comboCount <= 0) return;
        const canvas = ctx.canvas;
        const x = canvas.width / 2;
        const y = Math.max(90, canvas.height * 0.22);
        const baseFont = 72;
        const rawSize = baseFont * comboScale + Math.min(28, comboCount * 0.8);
        const size = Math.round(Math.min(112, rawSize));

        ctx.save();
        ctx.font = `bold ${size}px "Orbitron", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

        const gWidth = Math.max(240, size * 4);
        const grad = ctx.createLinearGradient(x - gWidth / 2, y - 30, x + gWidth / 2, y + 30);
        const t = Math.min(comboCount / 30, 1);
        grad.addColorStop(0, lerpColorHex('#FFD54A', '#FF3B3B', t));
        grad.addColorStop(1, lerpColorHex('#FFE08A', '#FF6B6B', Math.min(1, t + 0.18)));
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 22;

        const maxShake = Math.min(12, comboCount * 0.6);
        const shakeAmp = _PREFERS_REDUCED_MOTION ? 0 : maxShake * comboShake;
        const shakeX = (Math.random() - 0.5) * shakeAmp;
        const shakeY = (Math.random() - 0.5) * shakeAmp;
        ctx.translate(x + shakeX, y + shakeY);

        const mainText = `${comboCount} ${GAME_TEXTS.ui.hits}`;
        ctx.fillText(mainText, 0, -size * 0.14);
        ctx.lineWidth = Math.max(4, size * 0.07);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.strokeText(mainText, 0, -size * 0.14);

        let special = '';
        if (comboCount > 20) special = GAME_TEXTS.ui.godlike;
        else if (comboCount > 10) special = GAME_TEXTS.ui.unstoppable;
        if (special) {
            const smallSize = Math.max(18, Math.round(size * 0.44));
            ctx.font = `bold ${smallSize}px "Orbitron", sans-serif`;
            ctx.fillText(special, 0, Math.round(size * 0.62));
            ctx.lineWidth = Math.max(3, smallSize * 0.08);
            ctx.strokeText(special, 0, Math.round(size * 0.62));
        }
        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════
    // 😵 CONFUSED STATE WARNING BANNER
    // ════════════════════════════════════════════════════════════
    static drawConfusedWarning(ctx) {
        if (!ctx || !ctx.canvas) return;
        if (!window.player || !window.player.isConfused) return;

        const canvas = ctx.canvas;
        const now = performance.now();
        const flashVisible = Math.sin(now / 125) > 0;
        if (!flashVisible) return;

        const W = canvas.width;
        const H = canvas.height;
        const cx = W / 2;
        const cy = H - 270;
        const text = GAME_TEXTS.ui.confusedWarning;
        const fontSize = 17;
        const padX = 22;
        const padY = 11;
        const radius = 10;

        ctx.save();

        ctx.font = `bold ${fontSize}px "Orbitron", Arial, sans-serif`;
        const textW = ctx.measureText(text).width;
        const pillW = textW + padX * 2;
        const pillH = fontSize + padY * 2;
        const pillX = cx - pillW / 2;
        const pillY = cy - pillH / 2;

        ctx.shadowBlur = 28;
        ctx.shadowColor = '#ef4444';

        ctx.fillStyle = 'rgba(127, 29, 29, 0.88)';
        CanvasHUD._roundRect(ctx, pillX, pillY, pillW, pillH, radius);
        ctx.fill();

        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fca5a5';
        ctx.strokeStyle = 'rgba(252, 165, 165, 0.90)';
        ctx.lineWidth = 2;
        CanvasHUD._roundRect(ctx, pillX, pillY, pillW, pillH, radius);
        ctx.stroke();

        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cx, cy);

        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════
    // 🎯 TACTICAL MINIMAP / RADAR — Clickable Compact Adaptive Pod
    // ════════════════════════════════════════════════════════════
    static drawMinimap(ctx) {
        if (!ctx || !ctx.canvas) return;

        const UI = window.UIManager;
        if (UI) {
            if (!UI._minimapFrame) UI._minimapFrame = 0;
            UI._minimapFrame++;
        }

        const canvas = ctx.canvas;
        const radarRadius = 56;
        const scale = 0.08;
        const PAD_TOP = radarRadius + 8;
        const PAD_BOT = radarRadius + 8;
        const BOX_W = (radarRadius + 8) * 2;
        const BOX_H = PAD_TOP + PAD_BOT;
        const cx = Math.max(
            BOX_W / 2 + 12,
            Math.min(canvas.width - BOX_W / 2 - 135, canvas.width - 205)
        );
        const cy = 76;
        const now = Date.now();
        const THROTTLE_MS = 66; // ~15 Hz

        let mc = CanvasHUD._minimapCache;
        if (!mc || mc.w !== BOX_W || mc.h !== BOX_H) {
            const c = document.createElement('canvas');
            c.width = BOX_W; c.height = BOX_H;
            mc = CanvasHUD._minimapCache = { canvas: c, ctx: c.getContext('2d'), w: BOX_W, h: BOX_H, lastAt: 0 };
        }

        if (now - mc.lastAt >= THROTTLE_MS) {
            mc.lastAt = now;
            const bctx = mc.ctx;
            bctx.save();
            bctx.setTransform(1, 0, 0, 1, 0, 0);
            bctx.clearRect(0, 0, BOX_W, BOX_H);
            bctx.translate(BOX_W / 2 - cx, PAD_TOP - cy);
            CanvasHUD._minimapRender(bctx, cx, cy, radarRadius, scale, now);
            bctx.restore();
            CanvasHUD._syncRadarHitbox(canvas, cx, cy, radarRadius);
        }

        ctx.drawImage(mc.canvas, cx - BOX_W / 2, cy - PAD_TOP);
    }

    static _ensureRadarStyles() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('tactical-map-styles')) return;
        const style = document.createElement('style');
        style.id = 'tactical-map-styles';
        style.textContent = `
            #radar-hit-btn {
                position: fixed;
                border-radius: 50%;
                border: 1px solid transparent;
                background: transparent;
                padding: 0;
                margin: 0;
                cursor: pointer;
                z-index: 25;
                pointer-events: auto;
                transition: box-shadow 0.16s ease, border-color 0.16s ease;
                -webkit-tap-highlight-color: transparent;
            }
            #radar-hit-btn:hover,
            #radar-hit-btn:focus-visible {
                outline: none;
                border-color: rgba(34, 211, 238, 0.75);
                box-shadow: 0 0 18px rgba(34, 211, 238, 0.45), inset 0 0 12px rgba(34, 211, 238, 0.18);
            }
            #tactical-map-modal {
                position: fixed;
                inset: 0;
                z-index: 130;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 18px;
                background: rgba(2, 6, 18, 0.84);
                -webkit-backdrop-filter: blur(8px);
                backdrop-filter: blur(8px);
                pointer-events: auto;
            }
            .tm-panel {
                position: relative;
                width: min(920px, 95vw);
                max-height: 92vh;
                overflow-y: auto;
                background: linear-gradient(160deg, rgba(10, 17, 32, 0.97) 0%, rgba(5, 9, 19, 0.98) 100%);
                border: 1.5px solid rgba(34, 211, 238, 0.45);
                box-shadow: 0 24px 60px rgba(0, 0, 0, 0.85), 0 0 36px rgba(34, 211, 238, 0.16);
                padding: 18px 20px;
                color: #e0f2fe;
                clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
                -webkit-clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
            }
            .tm-header {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                padding-bottom: 12px;
                margin-bottom: 16px;
                border-bottom: 1px solid rgba(34, 211, 238, 0.22);
            }
            .tm-title-wrap {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 10px;
            }
            .tm-title {
                font-family: "Orbitron", sans-serif;
                font-size: 16px;
                font-weight: 900;
                letter-spacing: 2px;
                color: #67e8f9;
            }
            .tm-chip {
                font-family: "Share Tech Mono", monospace;
                font-size: 11px;
                font-weight: 700;
                padding: 3px 9px;
                border-radius: 3px;
                background: rgba(15, 23, 42, 0.9);
                border: 1px solid rgba(148, 163, 184, 0.35);
                color: #e0f2fe;
            }
            .tm-wp-chip {
                cursor: pointer;
                border-style: dashed;
                transition: background 0.15s, border-color 0.15s;
            }
            .tm-wp-chip:hover {
                background: rgba(30, 41, 59, 0.95);
            }
            .tm-close {
                background: rgba(239, 68, 68, 0.12);
                border: 1px solid rgba(239, 68, 68, 0.5);
                color: #fca5a5;
                font-family: "Orbitron", monospace;
                font-size: 11px;
                font-weight: 700;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                transition: background 0.15s, transform 0.12s;
            }
            .tm-close:hover {
                background: rgba(239, 68, 68, 0.28);
                transform: scale(1.03);
            }
            .tm-body {
                display: grid;
                grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
                gap: 18px;
                align-items: start;
            }
            @media (max-width: 780px) {
                .tm-body {
                    grid-template-columns: 1fr;
                }
            }
            .tm-map-wrap {
                display: flex;
                justify-content: center;
                align-items: center;
                background: rgba(3, 7, 16, 0.88);
                border: 1px solid rgba(34, 211, 238, 0.25);
                border-radius: 6px;
                padding: 10px;
            }
            #tactical-map-canvas {
                width: min(100%, 480px);
                height: auto;
                aspect-ratio: 1 / 1;
                display: block;
                border-radius: 4px;
                cursor: crosshair;
            }
            .tm-legend {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .tm-sec {
                background: rgba(8, 14, 28, 0.82);
                border: 1px solid rgba(148, 163, 184, 0.2);
                border-radius: 6px;
                padding: 12px 14px;
            }
            .tm-sec-title {
                font-family: "Orbitron", monospace;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 1.5px;
                color: #22d3ee;
                margin-bottom: 10px;
            }
            .tm-list {
                display: flex;
                flex-direction: column;
                gap: 7px;
            }
            .tm-item {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                font-size: 12px;
                line-height: 1.35;
            }
            .tm-sym {
                width: 18px;
                text-align: center;
                flex-shrink: 0;
                font-weight: 900;
                font-size: 13px;
            }
            .tm-item-name {
                font-family: "Orbitron", monospace;
                font-size: 10.5px;
                font-weight: 700;
                color: #f8fafc;
            }
            .tm-item-desc {
                font-family: "Rajdhani", "Inter", sans-serif;
                font-size: 12.5px;
                color: #94a3b8;
            }
            .tm-modes {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 7px;
            }
            .tm-mode-card {
                background: rgba(15, 23, 42, 0.72);
                border-left: 3px solid var(--tm-col, #22d3ee);
                padding: 6px 8px;
                border-radius: 3px;
            }
            .tm-mode-name {
                font-family: "Orbitron", monospace;
                font-size: 9.5px;
                font-weight: 800;
                color: var(--tm-col, #22d3ee);
                margin-bottom: 2px;
            }
            .tm-mode-desc {
                font-family: "Rajdhani", "Inter", sans-serif;
                font-size: 11.5px;
                color: #cbd5e1;
                line-height: 1.25;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    static _ensureGlobalMapKey() {
        if (typeof document === 'undefined' || CanvasHUD._mapKeyWired) return;
        CanvasHUD._mapKeyWired = true;
        document.addEventListener('keydown', function (e) {
            const consoleInput = document.getElementById('console-input');
            if (consoleInput && document.activeElement === consoleInput) return;

            if (CanvasHUD._mapOpen) {
                if (e.ctrlKey || e.metaKey || e.altKey) return;
                e.stopPropagation();
                if (e.code === 'Escape' || e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
                    e.preventDefault();
                    CanvasHUD.closeFullMap();
                }
                return;
            }

            if ((e.code === 'KeyM' || e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const tag = document.activeElement ? document.activeElement.tagName : '';
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                if (typeof GameState === 'undefined' || GameState.phase === 'PLAYING') {
                    e.preventDefault();
                    e.stopPropagation();
                    CanvasHUD.openFullMap();
                }
            }
        });
    }

    static _syncRadarHitbox(canvas, cx, cy, radarRadius) {
        if (typeof document === 'undefined' || !canvas) return;
        CanvasHUD._ensureRadarStyles();
        CanvasHUD._ensureGlobalMapKey();

        let btn = document.getElementById('radar-hit-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'radar-hit-btn';
            btn.type = 'button';
            btn.title = 'Click or press [M] for Full Tactical Map';
            btn.setAttribute('aria-label', 'Open Full Tactical Map');
            btn.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();
                CanvasHUD.openFullMap();
            };
            const host = document.getElementById('ui-layer') || document.body;
            if (!host) return;
            host.appendChild(btn);
        }

        const isPlaying = (typeof GameState === 'undefined' || GameState.phase === 'PLAYING') && !CanvasHUD._mapOpen;
        if (!isPlaying) {
            if (btn.style.display !== 'none') btn.style.display = 'none';
            return;
        }

        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const sx = rect.width / canvas.width;
        const sy = rect.height / canvas.height;
        const left = Math.round(rect.left + (cx - radarRadius) * sx);
        const top = Math.round(rect.top + (cy - radarRadius) * sy);
        const w = Math.round(radarRadius * 2 * sx);
        const h = Math.round(radarRadius * 2 * sy);

        if (btn.style.display !== 'block') btn.style.display = 'block';
        if (btn._lx !== left || btn._ty !== top || btn._lw !== w || btn._lh !== h) {
            btn._lx = left; btn._ty = top; btn._lw = w; btn._lh = h;
            btn.style.left = `${left}px`;
            btn.style.top = `${top}px`;
            btn.style.width = `${w}px`;
            btn.style.height = `${h}px`;
        }
    }

    static _ensureFullMapModal() {
        if (typeof document === 'undefined') return null;
        CanvasHUD._ensureRadarStyles();
        CanvasHUD._ensureGlobalMapKey();

        let modal = document.getElementById('tactical-map-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'tactical-map-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', 'Tactical Campus Map');
        modal.onclick = function (e) {
            if (e.target === modal) CanvasHUD.closeFullMap();
        };

        const panel = document.createElement('div');
        panel.className = 'tm-panel';

        const header = document.createElement('div');
        header.className = 'tm-header';

        const titleWrap = document.createElement('div');
        titleWrap.className = 'tm-title-wrap';
        const title = document.createElement('div');
        title.className = 'tm-title';
        title.textContent = '◈ MTC CAMPUS // TACTICAL MAP';
        const sectorChip = document.createElement('span');
        sectorChip.className = 'tm-chip';
        sectorChip.id = 'tm-sector-chip';
        const modeChip = document.createElement('span');
        modeChip.className = 'tm-chip';
        modeChip.id = 'tm-mode-chip';
        const wpChip = document.createElement('button');
        wpChip.type = 'button';
        wpChip.className = 'tm-chip tm-wp-chip';
        wpChip.id = 'tm-waypoint-chip';
        wpChip.textContent = '📍 CLICK MAP TO PIN WAYPOINT';
        wpChip.onclick = function () { CanvasHUD.clearWaypoint(); };
        titleWrap.appendChild(title);
        titleWrap.appendChild(sectorChip);
        titleWrap.appendChild(modeChip);
        titleWrap.appendChild(wpChip);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'tm-close';
        closeBtn.textContent = '[M / ESC] ✕ CLOSE';
        closeBtn.onclick = function () { CanvasHUD.closeFullMap(); };

        header.appendChild(titleWrap);
        header.appendChild(closeBtn);
        panel.appendChild(header);

        const body = document.createElement('div');
        body.className = 'tm-body';

        const mapWrap = document.createElement('div');
        mapWrap.className = 'tm-map-wrap';
        const mapCanvas = document.createElement('canvas');
        mapCanvas.id = 'tactical-map-canvas';
        mapCanvas.width = 500;
        mapCanvas.height = 500;
        mapCanvas.onclick = function (e) {
            const rect = mapCanvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const cx = (e.clientX - rect.left) * (mapCanvas.width / rect.width);
            const cy = (e.clientY - rect.top) * (mapCanvas.height / rect.height);
            const worldX = ((cx / mapCanvas.width) - 0.5) * 3200;
            const worldY = ((cy / mapCanvas.height) - 0.5) * 3200;

            if (CanvasHUD._waypoint && Math.hypot(worldX - CanvasHUD._waypoint.x, worldY - CanvasHUD._waypoint.y) <= 140) {
                CanvasHUD.clearWaypoint();
                return;
            }

            const portal = (typeof PortalSystem !== 'undefined' && typeof PortalSystem.getSnapshot === 'function')
                ? PortalSystem.getSnapshot() : null;
            const snapTargets = [
                { x: 0, y: -460, label: 'SAFE ZONE', color: '#10b981' },
            ];
            if (window.MTC_DATABASE_SERVER) {
                snapTargets.push({ x: window.MTC_DATABASE_SERVER.x, y: window.MTC_DATABASE_SERVER.y, label: 'DATABASE', color: '#38bdf8' });
            }
            if (window.MTC_SHOP_LOCATION) {
                snapTargets.push({ x: window.MTC_SHOP_LOCATION.x, y: window.MTC_SHOP_LOCATION.y, label: 'CO-OP SHOP', color: '#facc15' });
            }
            if (portal && portal.active && Number.isFinite(portal.x) && Number.isFinite(portal.y)) {
                snapTargets.push({ x: portal.x, y: portal.y, label: 'WAVE GATE', color: portal.isBossWave ? '#facc15' : '#22d3ee' });
            }

            let best = null;
            let bestDist = 165;
            for (let i = 0; i < snapTargets.length; i++) {
                const t = snapTargets[i];
                const d = Math.hypot(worldX - t.x, worldY - t.y);
                if (d <= bestDist) {
                    best = t;
                    bestDist = d;
                }
            }

            if (best) {
                CanvasHUD.setWaypoint(best.x, best.y, best.label, best.color);
                return;
            }

            const dist = Math.hypot(worldX, worldY);
            const tx = dist > 1450 ? worldX * (1450 / dist) : worldX;
            const ty = dist > 1450 ? worldY * (1450 / dist) : worldY;
            const sector = CanvasHUD._detectPlayerSector(tx, ty);
            CanvasHUD.setWaypoint(tx, ty, sector.name, '#38bdf8');
        };
        mapWrap.appendChild(mapCanvas);

        const legend = document.createElement('div');
        legend.className = 'tm-legend';

        // Section 1: Symbols
        const symSec = document.createElement('div');
        symSec.className = 'tm-sec';
        const symTitle = document.createElement('div');
        symTitle.className = 'tm-sec-title';
        symTitle.textContent = 'MAP & RADAR SYMBOLS';
        const symList = document.createElement('div');
        symList.className = 'tm-list';

        const symbolEntries = [
            { sym: '▶', col: '#34d399', name: 'YOU (ผู้เล่น)', desc: 'ตำแหน่งปัจจุบันและทิศทางที่กำลังเล็ง' },
            { sym: '⬡', col: '#22d3ee', name: 'WAVE GATE (ประตูมิติ)', desc: 'ทางเข้าเวฟถัดไป (เส้นประสีฟ้า/ทองนำทาง)' },
            { sym: '✚', col: '#10b981', name: 'MTC CITADEL (SAFE ZONE)', desc: 'ฟื้นฟู HP/Focus + รับบัฟหมุนเวียน (ส้ม = คูลดาวน์)' },
            { sym: '■', col: '#38bdf8', name: 'MTC DATABASE & ADMIN', desc: 'กด [E] ดูฐานข้อมูล / กด [F] เปิด Admin Terminal' },
            { sym: '■', col: '#facc15', name: 'CO-OP STORE (ร้านค้า)', desc: 'กด [B] ซื้อไอเทมอัปเกรดด้วย Credits' },
            { sym: '●', col: '#ef4444', name: 'BASIC ENEMY', desc: 'ศัตรูทั่วไป (ระยะประชิดและยิงไกล)' },
            { sym: '◆', col: '#c084fc', name: 'MAGE / TANK (■ ส้ม)', desc: 'สี่เหลี่ยมข้าวหลามตัดม่วง = Mage · สี่เหลี่ยมส้ม = Tank' },
            { sym: '◎', col: '#e879f9', name: 'BOSS (บอสประจำเวฟ)', desc: 'เป้าหมายระดับบอสพร้อมเส้นล็อกเป้า' },
            { sym: '▲', col: '#f97316', name: 'EXPLOSIVE BARREL', desc: 'ถังระเบิดยุทธวิธี ยิงทำลายศัตรูเป็นวงกว้าง' },
        ];
        for (let i = 0; i < symbolEntries.length; i++) {
            const it = symbolEntries[i];
            const row = document.createElement('div');
            row.className = 'tm-item';
            const sym = document.createElement('span');
            sym.className = 'tm-sym';
            sym.style.color = it.col;
            sym.textContent = it.sym;
            const info = document.createElement('div');
            const nm = document.createElement('div');
            nm.className = 'tm-item-name';
            nm.textContent = it.name;
            const ds = document.createElement('div');
            ds.className = 'tm-item-desc';
            ds.textContent = it.desc;
            info.appendChild(nm);
            info.appendChild(ds);
            row.appendChild(sym);
            row.appendChild(info);
            symList.appendChild(row);
        }
        symSec.appendChild(symTitle);
        symSec.appendChild(symList);

        // Section 2: Adaptive Wave Modes
        const modeSec = document.createElement('div');
        modeSec.className = 'tm-sec';
        const modeTitle = document.createElement('div');
        modeTitle.className = 'tm-sec-title';
        modeTitle.textContent = 'ADAPTIVE WAVE MODES';
        const modeGrid = document.createElement('div');
        modeGrid.className = 'tm-modes';
        const modes = [
            { name: 'SONAR (FOG)', col: '#38bdf8', desc: 'เห็นโซนและหมุดสถานที่ตลอด ศัตรูขึ้นเมื่อคลื่นกวาดผ่าน' },
            { name: 'SPEED WAVE', col: '#f59e0b', desc: 'เรดาร์สแกนเร็วขึ้น 2 เท่า พร้อมหางทิศศัตรู' },
            { name: 'GLITCH WAVE', col: '#c084fc', desc: 'ขอบม่วงไซเบอร์ เตือนเวฟรบกวน/สลับปุ่ม' },
            { name: 'BOSS / GATE', col: '#f43f5e', desc: 'ล็อกเป้าบอสหรือขีดเส้นประนำทางสู่ประตูมิติ' },
        ];
        for (let i = 0; i < modes.length; i++) {
            const m = modes[i];
            const card = document.createElement('div');
            card.className = 'tm-mode-card';
            card.style.setProperty('--tm-col', m.col);
            const mn = document.createElement('div');
            mn.className = 'tm-mode-name';
            mn.textContent = m.name;
            const md = document.createElement('div');
            md.className = 'tm-mode-desc';
            md.textContent = m.desc;
            card.appendChild(mn);
            card.appendChild(md);
            modeGrid.appendChild(card);
        }
        modeSec.appendChild(modeTitle);
        modeSec.appendChild(modeGrid);

        legend.appendChild(symSec);
        legend.appendChild(modeSec);

        body.appendChild(mapWrap);
        body.appendChild(legend);
        panel.appendChild(body);
        modal.appendChild(panel);
        document.body.appendChild(modal);
        return modal;
    }

    static _renderFullMapCanvas() {
        const canvas = document.getElementById('tactical-map-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        const half = W * 0.5;
        const worldSpan = 3200;
        const s = W / worldSpan;
        const wx = (x) => half + x * s;
        const wy = (y) => half + y * s;

        const player = (typeof window !== 'undefined' && window.player) ? window.player : { x: 0, y: 0, angle: 0 };
        const portal = (typeof PortalSystem !== 'undefined' && typeof PortalSystem.getSnapshot === 'function')
            ? PortalSystem.getSnapshot() : null;
        const mode = CanvasHUD._resolveRadarMode(portal);
        const sector = CanvasHUD._detectPlayerSector(player.x || 0, player.y || 0);

        const sectorChip = document.getElementById('tm-sector-chip');
        if (sectorChip) {
            sectorChip.textContent = `SECTOR: ${sector.name}`;
            sectorChip.style.color = sector.color;
            sectorChip.style.borderColor = sector.color;
        }
        const modeChip = document.getElementById('tm-mode-chip');
        if (modeChip) {
            const waveNum = typeof window.getWave === 'function' ? window.getWave() : (window.currentWave || 1);
            modeChip.textContent = mode.tag ? `WAVE ${waveNum} · ${mode.tag}` : `WAVE ${waveNum} · STANDARD`;
            modeChip.style.color = mode.accent;
            modeChip.style.borderColor = mode.accent;
        }
        const wpChip = document.getElementById('tm-waypoint-chip');
        if (wpChip) {
            const wp = CanvasHUD._waypoint;
            if (wp) {
                wpChip.textContent = `📍 WP: ${wp.label} [✕ CLEAR]`;
                wpChip.style.color = wp.color || '#38bdf8';
                wpChip.style.borderColor = wp.color || '#38bdf8';
            } else {
                wpChip.textContent = '📍 CLICK MAP TO PIN WAYPOINT';
                wpChip.style.color = '#94a3b8';
                wpChip.style.borderColor = 'rgba(148, 163, 184, 0.35)';
            }
        }

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#040814';
        ctx.fillRect(0, 0, W, H);

        // Coordinate grid every 400 world units
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.08)';
        ctx.lineWidth = 1;
        for (let g = -1200; g <= 1200; g += 400) {
            const gx = wx(g);
            const gy = wy(g);
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
        }

        // Arena dome boundary (radius = 1500)
        ctx.strokeStyle = 'rgba(250, 180, 30, 0.55)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.arc(wx(0), wy(0), 1500 * s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Campus Sectors
        const zones = [
            { x: 430, y: -680, w: 800, h: 700, fill: 'rgba(34, 211, 238, 0.10)', stroke: '#22d3ee', label: 'SERVER FARM', tc: '#67e8f9' },
            { x: -1230, y: -680, w: 800, h: 700, fill: 'rgba(245, 158, 11, 0.10)', stroke: '#f59e0b', label: 'ARCHIVES', tc: '#fcd34d' },
            { x: -600, y: 400, w: 1200, h: 650, fill: 'rgba(74, 222, 128, 0.08)', stroke: '#4ade80', label: 'BIOTECH GARDEN', tc: '#86efac' },
            { x: -1100, y: 500, w: 420, h: 400, fill: 'rgba(192, 132, 252, 0.10)', stroke: '#c084fc', label: 'LECTURE A', tc: '#e9d5ff' },
            { x: 680, y: 500, w: 420, h: 400, fill: 'rgba(192, 132, 252, 0.10)', stroke: '#c084fc', label: 'LECTURE B', tc: '#e9d5ff' },
            { x: -150, y: -580, w: 300, h: 240, fill: 'rgba(16, 185, 129, 0.18)', stroke: '#10b981', label: 'MTC CITADEL', tc: '#6ee7b7' },
        ];
        ctx.font = 'bold 9.5px "Orbitron", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < zones.length; i++) {
            const z = zones[i];
            const rx = wx(z.x);
            const ry = wy(z.y);
            const rw = z.w * s;
            const rh = z.h * s;
            ctx.fillStyle = z.fill;
            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeStyle = z.stroke;
            ctx.globalAlpha = 0.55;
            ctx.lineWidth = 1.2;
            ctx.strokeRect(rx, ry, rw, rh);
            ctx.globalAlpha = 0.92;
            ctx.fillStyle = z.tc;
            ctx.fillText(z.label, rx + rw * 0.5, ry + (i === 5 ? 12 : rh * 0.5));
            ctx.globalAlpha = 1;
        }

        // Circuit lines
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.beginPath(); ctx.moveTo(wx(0), wy(0)); ctx.lineTo(wx(500), wy(0)); ctx.lineTo(wx(500), wy(-490)); ctx.stroke();
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.5)';
        ctx.beginPath(); ctx.moveTo(wx(0), wy(0)); ctx.lineTo(wx(-500), wy(0)); ctx.lineTo(wx(-500), wy(490)); ctx.stroke();

        // Origin Hub ring
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(wx(0), wy(0), 90 * s, 0, Math.PI * 2); ctx.stroke();
        ctx.font = 'bold 8px "Share Tech Mono", monospace';
        ctx.fillStyle = 'rgba(253, 224, 71, 0.75)';
        ctx.fillText('CENTRAL HUB', wx(0), wy(130));

        // Explosive barrels
        if (window.mapSystem && Array.isArray(window.mapSystem.objects)) {
            ctx.fillStyle = '#f97316';
            for (let i = 0; i < window.mapSystem.objects.length; i++) {
                const obj = window.mapSystem.objects[i];
                if (!obj || obj.type !== 'barrel' || obj.isExploded) continue;
                const bx = wx(obj.x + (obj.w || 30) * 0.5);
                const by = wy(obj.y + (obj.h || 38) * 0.5);
                ctx.beginPath();
                ctx.moveTo(bx, by - 4); ctx.lineTo(bx + 3.5, by + 3); ctx.lineTo(bx - 3.5, by + 3);
                ctx.closePath();
                ctx.fill();
            }
        }

        // Key Landmarks
        const drawPin = (x, y, col, label, shape) => {
            const px = wx(x);
            const py = wy(y);
            ctx.save();
            ctx.translate(px, py);
            ctx.fillStyle = col;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            if (shape === 'cross') {
                ctx.fillRect(-2.5, -7, 5, 14);
                ctx.fillRect(-7, -2.5, 14, 5);
            } else if (shape === 'hex') {
                ctx.strokeStyle = col;
                ctx.lineWidth = 2.2;
                ctx.fillStyle = 'rgba(8, 12, 24, 0.92)';
                ctx.beginPath();
                for (let k = 0; k < 6; k++) {
                    const a = (Math.PI / 3) * k - Math.PI / 2;
                    const rx = Math.cos(a) * 8;
                    const ry = Math.sin(a) * 8;
                    k === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
                }
                ctx.closePath(); ctx.fill(); ctx.stroke();
            } else {
                ctx.fillRect(-6, -6, 12, 12);
                ctx.strokeRect(-6, -6, 12, 12);
            }
            ctx.font = 'bold 9px "Share Tech Mono", monospace';
            ctx.fillStyle = '#f8fafc';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(label, 0, 9);
            ctx.restore();
        };

        const safeRoom = window.mapSystem && window.mapSystem.mtcRoom;
        const safeReady = !safeRoom || safeRoom.cooldown <= 0;
        drawPin(0, -460, safeReady ? '#10b981' : '#f59e0b', safeReady ? 'SAFE ZONE' : 'SAFE (CD)', 'cross');
        if (window.MTC_DATABASE_SERVER) drawPin(window.MTC_DATABASE_SERVER.x, window.MTC_DATABASE_SERVER.y, '#38bdf8', 'DB / ADMIN [E/F]', 'square');
        if (window.MTC_SHOP_LOCATION) drawPin(window.MTC_SHOP_LOCATION.x, window.MTC_SHOP_LOCATION.y, '#facc15', 'CO-OP SHOP [B]', 'square');

        if (portal && portal.active && Number.isFinite(portal.x) && Number.isFinite(portal.y)) {
            const pCol = portal.isBossWave ? '#facc15' : '#22d3ee';
            ctx.strokeStyle = pCol;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(wx(player.x || 0), wy(player.y || 0));
            ctx.lineTo(wx(portal.x), wy(portal.y));
            ctx.stroke();
            ctx.setLineDash([]);
            drawPin(portal.x, portal.y, pCol, `WAVE ${portal.targetWave} GATE`, 'hex');
        }

        // Enemies & Boss
        if (Array.isArray(window.enemies)) {
            for (const e of window.enemies) {
                if (!e || e.dead) continue;
                const ex = wx(e.x), ey = wy(e.y);
                ctx.save();
                if (e.type === 'mage') {
                    ctx.fillStyle = '#c084fc';
                    ctx.beginPath(); ctx.moveTo(ex, ey - 5); ctx.lineTo(ex + 3.5, ey); ctx.lineTo(ex, ey + 5); ctx.lineTo(ex - 3.5, ey); ctx.closePath(); ctx.fill();
                } else if (e.type === 'tank') {
                    ctx.fillStyle = '#fb923c';
                    ctx.fillRect(ex - 4, ey - 4, 8, 8);
                } else {
                    ctx.fillStyle = '#ef4444';
                    ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI * 2); ctx.fill();
                }
                ctx.restore();
            }
        }
        if (window.boss && !window.boss.dead) {
            const bx = wx(window.boss.x), by = wy(window.boss.y);
            ctx.strokeStyle = '#f5d0fe';
            ctx.lineWidth = 1.8;
            ctx.fillStyle = '#e879f9';
            ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.font = 'bold 9px Orbitron, monospace';
            ctx.fillStyle = '#fdf4ff';
            ctx.fillText('BOSS', bx, by - 13);
        }

        // Active Waypoint navigation line & reticle
        if (CanvasHUD._waypoint) {
            const wp = CanvasHUD._waypoint;
            const wpx = wx(wp.x);
            const wpy = wy(wp.y);
            const wpCol = wp.color || '#38bdf8';
            ctx.save();
            ctx.strokeStyle = wpCol;
            ctx.lineWidth = 1.6;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(wx(player.x || 0), wy(player.y || 0));
            ctx.lineTo(wpx, wpy);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.translate(wpx, wpy);
            ctx.strokeStyle = wpCol;
            ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = wpCol;
            ctx.beginPath();
            ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.font = 'bold 9px "Orbitron", monospace';
            ctx.fillStyle = wpCol;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`WP // ${wp.label}`, 0, -15);
            ctx.restore();
        }

        // Player
        const plx = wx(player.x || 0);
        const ply = wy(player.y || 0);
        ctx.save();
        ctx.translate(plx, ply);
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
        if (player.angle !== undefined) ctx.rotate(player.angle + Math.PI / 2);
        ctx.fillStyle = '#34d399';
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
        ctx.restore();

        // Compass labels
        ctx.font = 'bold 11px Orbitron, monospace';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
        ctx.textAlign = 'center';
        ctx.fillText('N', half, 14);
        ctx.fillText('S', half, H - 14);
        ctx.fillText('W', 14, half);
        ctx.fillText('E', W - 14, half);
    }

    static setWaypoint(x, y, label = 'WAYPOINT', color = '#38bdf8') {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        CanvasHUD._waypoint = { x: Number(x), y: Number(y), label: String(label || 'WAYPOINT'), color: color || '#38bdf8' };
        if (CanvasHUD._mapOpen) CanvasHUD._renderFullMapCanvas();
        return true;
    }

    static clearWaypoint() {
        const had = !!CanvasHUD._waypoint;
        CanvasHUD._waypoint = null;
        if (CanvasHUD._mapOpen) CanvasHUD._renderFullMapCanvas();
        return had;
    }

    static getWaypoint() {
        return CanvasHUD._waypoint ? { ...CanvasHUD._waypoint } : null;
    }

    static clear() {
        CanvasHUD._mapOpen = false;
        CanvasHUD._waypoint = null;
        if (typeof document !== 'undefined') {
            const modal = document.getElementById('tactical-map-modal');
            if (modal) modal.style.display = 'none';
            const btn = document.getElementById('radar-hit-btn');
            if (btn) btn.style.display = 'none';
        }
    }

    static openFullMap() {
        if (CanvasHUD._mapOpen) return false;
        if (typeof GameState !== 'undefined' && GameState.phase !== 'PLAYING') return false;
        const modal = CanvasHUD._ensureFullMapModal();
        if (!modal) return false;

        CanvasHUD._mapOpen = true;
        if (typeof window._resetAllInput === 'function') window._resetAllInput();
        if (typeof CANVAS !== 'undefined' && CANVAS && CANVAS.classList) {
            CANVAS.classList.remove('gameplay-cursor-hidden');
            CANVAS.style.cursor = 'default';
        }
        const hitBtn = document.getElementById('radar-hit-btn');
        if (hitBtn) hitBtn.style.display = 'none';

        CanvasHUD._renderFullMapCanvas();
        modal.style.display = 'flex';
        if (typeof GameState !== 'undefined') GameState.setPhase('PAUSED');
        return true;
    }

    static closeFullMap() {
        if (!CanvasHUD._mapOpen) return false;
        CanvasHUD._mapOpen = false;
        const modal = document.getElementById('tactical-map-modal');
        if (modal) modal.style.display = 'none';
        if (typeof CANVAS !== 'undefined' && CANVAS && CANVAS.style.cursor === 'default') {
            CANVAS.style.cursor = '';
        }
        if (typeof GameState !== 'undefined' && GameState.phase === 'PAUSED') {
            GameState.setPhase('PLAYING');
        }
        const hitBtn = document.getElementById('radar-hit-btn');
        if (hitBtn && (typeof GameState === 'undefined' || GameState.phase === 'PLAYING')) {
            hitBtn.style.display = 'block';
        }
        return true;
    }

    static toggleFullMap() {
        return CanvasHUD._mapOpen ? CanvasHUD.closeFullMap() : CanvasHUD.openFullMap();
    }

    static _detectPlayerSector(px, py) {
        if (px >= -150 && px <= 150 && py >= -580 && py <= -340) return { name: 'CITADEL', color: '#10b981' };
        if (px >= 330 && px <= 670 && py >= -660 && py <= -320) return { name: 'DATABASE', color: '#38bdf8' };
        if (px >= -670 && px <= -330 && py >= 320 && py <= 660) return { name: 'CO-OP SHOP', color: '#facc15' };
        if (px >= 430 && px <= 1230 && py >= -680 && py <= 20) return { name: 'SERVER FARM', color: '#22d3ee' };
        if (px >= -1230 && px <= -430 && py >= -680 && py <= 20) return { name: 'ARCHIVES', color: '#f59e0b' };
        if (px >= -1100 && px <= -680 && py >= 500 && py <= 900) return { name: 'LECTURE A', color: '#c084fc' };
        if (px >= 680 && px <= 1100 && py >= 500 && py <= 900) return { name: 'LECTURE B', color: '#c084fc' };
        if (px >= -600 && px <= 600 && py >= 400 && py <= 1050) return { name: 'GARDEN', color: '#4ade80' };
        if (Math.hypot(px, py) <= 180) return { name: 'CENTRAL HUB', color: '#fbbf24' };

        const dirY = py < -250 ? 'N' : (py > 250 ? 'S' : '');
        const dirX = px < -250 ? 'W' : (px > 250 ? 'E' : '');
        const bearing = dirY + dirX;
        return { name: bearing ? `ARENA [${bearing}]` : 'ARENA', color: '#94a3b8' };
    }

    static _resolveRadarMode(portal) {
        const hasBoss = !!(window.boss && !window.boss.dead);
        const isGlitch = !!(window.isGlitchWave || (typeof GameState !== 'undefined' && GameState.isGlitchWave));
        const isFog = !!window.isFogWave;
        const isSpeed = !!window.isSpeedWave;
        const hasPortal = !!(portal && portal.active && Number.isFinite(portal.x) && Number.isFinite(portal.y));

        if (hasBoss) return { id: 'boss', tag: 'BOSS', accent: '#f43f5e', sweep: '#e879f9', sweepRgb: '232,121,249', rpm: 0.44 };
        if (isGlitch) return { id: 'glitch', tag: 'GLITCH', accent: '#c084fc', sweep: '#c084fc', sweepRgb: '192,132,252', rpm: 0.50 };
        if (isFog) return { id: 'sonar', tag: 'SONAR', accent: '#06b6d4', sweep: '#38bdf8', sweepRgb: '56,189,248', rpm: 0.45 };
        if (isSpeed) return { id: 'speed', tag: 'SPEED', accent: '#f59e0b', sweep: '#fbbf24', sweepRgb: '251,191,36', rpm: 0.72 };
        if (hasPortal) return { id: 'gate', tag: 'GATE', accent: portal.isBossWave ? '#facc15' : '#22d3ee', sweep: '#22d3ee', sweepRgb: '34,211,238', rpm: 0.34 };
        return { id: 'normal', tag: '', accent: '#22c55e', sweep: '#86efac', sweepRgb: '72,187,120', rpm: 0.34 };
    }

    static _minimapRender(ctx, cx, cy, radarRadius, scale, now) {
        const player = (typeof window !== 'undefined' && window.player)
            ? window.player : { x: 0, y: 0 };
        const portal = (typeof PortalSystem !== 'undefined' && typeof PortalSystem.getSnapshot === 'function')
            ? PortalSystem.getSnapshot()
            : null;
        const mode = CanvasHUD._resolveRadarMode(portal);

        const toRadar = (wx, wy, maxR = radarRadius - 5) => {
            const rx = cx + (wx - player.x) * scale;
            const ry = cy + (wy - player.y) * scale;
            const dx = rx - cx, dy = ry - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d <= maxR) return { x: rx, y: ry, clamped: false, angle: Math.atan2(dy, dx) };
            return { x: cx + dx * (maxR / d), y: cy + dy * (maxR / d), clamped: true, angle: Math.atan2(dy, dx) };
        };

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        CanvasHUD._minimapDrawShell(ctx, cx, cy, radarRadius, now, mode);

        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius - 1, 0, Math.PI * 2); ctx.clip();

        CanvasHUD._minimapDrawContent(ctx, cx, cy, radarRadius, scale, now, player, toRadar, mode, portal);

        ctx.restore();
        CanvasHUD._minimapDrawKeyBadge(ctx, cx, cy, radarRadius, mode);
        ctx.restore();
    }

    static _minimapDrawKeyBadge(ctx, cx, cy, radarRadius, mode) {
        const bw = 18;
        const bh = 9;
        const bx = cx - bw * 0.5;
        const by = cy + radarRadius - 1 - bh * 0.5;
        ctx.save();
        ctx.fillStyle = 'rgba(6, 11, 22, 0.96)';
        ctx.strokeStyle = mode.accent;
        ctx.lineWidth = 1;
        CanvasHUD._roundRect(ctx, bx, by, bw, bh, 3);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 6px "Orbitron", monospace';
        ctx.fillStyle = '#e0f2fe';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('M', cx, by + bh * 0.5 + 0.5);
        ctx.restore();
    }

    static _minimapDrawShell(ctx, cx, cy, radarRadius, now, mode) {
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius + 3.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 11, 22, 0.55)'; ctx.fill();

        ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 11, 22, 0.88)'; ctx.fill();

        const borderSin = Math.sin(now / 600);
        ctx.lineWidth = 1.6 + borderSin * 0.35;
        ctx.globalAlpha = 0.85 + borderSin * 0.12;
        ctx.strokeStyle = mode.accent;
        ctx.shadowBlur = 9 + borderSin * 3;
        ctx.shadowColor = mode.accent;
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        ctx.lineWidth = 0.7;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.20)';
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius - 3, 0, Math.PI * 2); ctx.stroke();

        // Compact cardinal compass labels
        ctx.font = 'bold 6.5px "Orbitron", monospace';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.72)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('N', cx, cy - radarRadius + 7);
        ctx.fillText('S', cx, cy + radarRadius - 12);
        ctx.fillText('E', cx + radarRadius - 7, cy);
        ctx.fillText('W', cx - radarRadius + 7, cy);
    }

    static _minimapDrawGeography(ctx, cx, cy, scale, player) {
        const px = player.x || 0;
        const py = player.y || 0;
        const wx = (x) => cx + (x - px) * scale;
        const wy = (y) => cy + (y - py) * scale;

        ctx.save();
        // Arena dome rim
        ctx.strokeStyle = 'rgba(250, 180, 30, 0.28)';
        ctx.lineWidth = 0.9;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(wx(0), wy(0), 1500 * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Clean blueprint sector outlines (no inner text to keep radar uncluttered)
        const zones = [
            { x: 430, y: -680, w: 800, h: 700, fill: 'rgba(34, 211, 238, 0.05)', stroke: 'rgba(34, 211, 238, 0.28)' },
            { x: -1230, y: -680, w: 800, h: 700, fill: 'rgba(245, 158, 11, 0.05)', stroke: 'rgba(245, 158, 11, 0.28)' },
            { x: -600, y: 400, w: 1200, h: 650, fill: 'rgba(74, 222, 128, 0.04)', stroke: 'rgba(74, 222, 128, 0.25)' },
            { x: -1100, y: 500, w: 420, h: 400, fill: 'rgba(192, 132, 252, 0.05)', stroke: 'rgba(192, 132, 252, 0.25)' },
            { x: 680, y: 500, w: 420, h: 400, fill: 'rgba(192, 132, 252, 0.05)', stroke: 'rgba(192, 132, 252, 0.25)' },
            { x: -150, y: -580, w: 300, h: 240, fill: 'rgba(16, 185, 129, 0.09)', stroke: 'rgba(16, 185, 129, 0.42)' },
        ];

        ctx.lineWidth = 0.75;
        for (let i = 0; i < zones.length; i++) {
            const z = zones[i];
            const sx = wx(z.x);
            const sy = wy(z.y);
            const sw = z.w * scale;
            const sh = z.h * scale;
            ctx.fillStyle = z.fill;
            ctx.fillRect(sx, sy, sw, sh);
            ctx.strokeStyle = z.stroke;
            ctx.strokeRect(sx, sy, sw, sh);
        }

        // Subtle navigation conduits to Database and Shop
        ctx.lineWidth = 0.85;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.beginPath();
        ctx.moveTo(wx(0), wy(0));
        ctx.lineTo(wx(500), wy(0));
        ctx.lineTo(wx(500), wy(-490));
        ctx.stroke();

        ctx.strokeStyle = 'rgba(249, 115, 22, 0.28)';
        ctx.beginPath();
        ctx.moveTo(wx(0), wy(0));
        ctx.lineTo(wx(-500), wy(0));
        ctx.lineTo(wx(-500), wy(490));
        ctx.stroke();

        ctx.restore();
    }

    static _minimapDrawLandmark(ctx, cx, cy, toRadar, radarRadius, wx, wy, color, glow, tag, shape, pulse) {
        const { x: lx, y: ly, clamped, angle } = toRadar(wx, wy, radarRadius - 6);
        ctx.save();
        ctx.shadowBlur = 6 * pulse;
        ctx.shadowColor = glow;
        if (clamped) {
            // Perimeter compass pin + micro tag nudged inward so it sits cleanly on the rim
            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(angle);
            ctx.globalAlpha = 0.85 + pulse * 0.15;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(4.5, 0); ctx.lineTo(-2, -3); ctx.lineTo(-2, 3);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            if (tag) {
                const tx = lx - Math.cos(angle) * 11;
                const ty = ly - Math.sin(angle) * 9;
                ctx.shadowBlur = 0;
                ctx.font = 'bold 5.5px "Share Tech Mono", monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.9;
                ctx.fillText(tag, tx, ty);
            }
        } else {
            ctx.translate(lx, ly);
            ctx.globalAlpha = 0.88 + pulse * 0.12;
            if (shape === 'cross') {
                ctx.fillStyle = color;
                ctx.fillRect(-1.3, -3.8, 2.6, 7.6);
                ctx.fillRect(-3.8, -1.3, 7.6, 2.6);
            } else if (shape === 'hex') {
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.fillStyle = 'rgba(8, 12, 24, 0.92)';
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (Math.PI / 3) * i - Math.PI / 2;
                    const rx = Math.cos(a) * 4.5;
                    const ry = Math.sin(a) * 4.5;
                    i === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else if (shape === 'diamond') {
                const dr = 4.2;
                ctx.fillStyle = color;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 0.9;
                ctx.beginPath();
                ctx.moveTo(0, -dr);
                ctx.lineTo(dr, 0);
                ctx.lineTo(0, dr);
                ctx.lineTo(-dr, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, 1.3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                const sz = 3.2;
                ctx.fillStyle = color;
                ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 0.7;
                ctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
            }
            if (tag) {
                ctx.shadowBlur = 0;
                ctx.font = 'bold 5.5px "Share Tech Mono", monospace';
                ctx.fillStyle = '#f8fafc';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(tag, 0, 4.5);
            }
        }
        ctx.restore();
    }

    static _minimapDrawContent(ctx, cx, cy, radarRadius, scale, now, player, toRadar, mode, portal) {
        // 1. Blueprint campus geography (always visible for navigation, even in Fog/Sonar)
        CanvasHUD._minimapDrawGeography(ctx, cx, cy, scale, player);

        // 2. Radar range rings & crosshairs
        ctx.lineWidth = 0.65;
        [radarRadius * 0.35, radarRadius * 0.70].forEach(r => {
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${mode.sweepRgb}, 0.14)`; ctx.stroke();
        });
        ctx.strokeStyle = `rgba(${mode.sweepRgb}, 0.16)`; ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(cx - radarRadius + 2, cy); ctx.lineTo(cx + radarRadius - 2, cy);
        ctx.moveTo(cx, cy - radarRadius + 2); ctx.lineTo(cx, cy + radarRadius - 2);
        ctx.stroke();

        // 3. Adaptive Mode FX (Sonar pulse ring in Fog Wave, glitch lines in Glitch Wave)
        if (mode.id === 'sonar') {
            const sonarPhase = (now % 1600) / 1600;
            ctx.save();
            ctx.globalAlpha = (1 - sonarPhase) * 0.45;
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(cx, cy, sonarPhase * radarRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        } else if (mode.id === 'glitch') {
            ctx.save();
            for (let g = 0; g < 4; g++) {
                const seed = Math.floor(now / 90) + g * 3571;
                const gy = cy - radarRadius + (((seed * 1664525 + 1013904223) & 0x7fffffff) % (radarRadius * 2));
                ctx.globalAlpha = 0.16;
                ctx.fillStyle = g % 2 === 0 ? '#c084fc' : '#22d3ee';
                ctx.fillRect(cx - radarRadius, gy, radarRadius * 2, 1.5);
            }
            ctx.restore();
        }

        // 4. Radar sweep beam (faster in Speed Wave)
        const sweepAngle = ((now / 1000) * mode.rpm * Math.PI * 2) % (Math.PI * 2);
        const trailArc = Math.PI * 2 / 3;
        const TRAIL_STEPS = 18;
        ctx.fillStyle = `rgb(${mode.sweepRgb})`;
        for (let i = 0; i < TRAIL_STEPS; i++) {
            const frac = i / TRAIL_STEPS;
            const aStart = sweepAngle - trailArc * (1 - frac);
            const aEnd = sweepAngle - trailArc * (1 - frac - 1 / TRAIL_STEPS);
            ctx.globalAlpha = frac * frac * (mode.id === 'sonar' ? 0.24 : 0.15);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radarRadius - 1, aStart, aEnd);
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.strokeStyle = mode.sweep; ctx.lineWidth = 1.3;
        ctx.shadowBlur = 5; ctx.shadowColor = mode.sweep;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweepAngle) * (radarRadius - 1),
            cy + Math.sin(sweepAngle) * (radarRadius - 1));
        ctx.stroke();
        ctx.restore();

        // 5. Waypoint line to Active Gate or Custom User Waypoint
        if (portal && portal.active && Number.isFinite(portal.x) && Number.isFinite(portal.y)) {
            const gp = toRadar(portal.x, portal.y, radarRadius - 6);
            ctx.save();
            ctx.strokeStyle = portal.isBossWave ? 'rgba(250, 204, 21, 0.55)' : 'rgba(34, 211, 238, 0.55)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(gp.x, gp.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        if (CanvasHUD._waypoint) {
            const wp = CanvasHUD._waypoint;
            const dToWp = Math.hypot((player.x || 0) - wp.x, (player.y || 0) - wp.y);
            if (dToWp <= 95) {
                CanvasHUD._waypoint = null;
            } else {
                const gp = toRadar(wp.x, wp.y, radarRadius - 6);
                ctx.save();
                ctx.strokeStyle = wp.color || '#38bdf8';
                ctx.globalAlpha = 0.72;
                ctx.lineWidth = 1.1;
                ctx.setLineDash([3, 2]);
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(gp.x, gp.y);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
                CanvasHUD._minimapDrawLandmark(
                    ctx, cx, cy, toRadar, radarRadius,
                    wp.x, wp.y, wp.color || '#38bdf8', wp.color || '#38bdf8',
                    'WP', 'diamond', 0.85
                );
            }
        }

        // 6. Key Landmarks (SAFE / DB / SHOP / GATE)
        const safeRoom = window.mapSystem && window.mapSystem.mtcRoom;
        const safeReady = !safeRoom || safeRoom.cooldown <= 0;
        const safePulse = 0.65 + Math.sin(now / 600) * 0.35;
        CanvasHUD._minimapDrawLandmark(
            ctx, cx, cy, toRadar, radarRadius,
            0, -460,
            safeReady ? '#10b981' : '#f59e0b',
            safeReady ? '#10b981' : '#f59e0b',
            'SAFE', 'cross', safePulse
        );

        if (window.MTC_DATABASE_SERVER) {
            const S = window.MTC_DATABASE_SERVER;
            const dbPulse = 0.65 + Math.sin(now / 550) * 0.35;
            CanvasHUD._minimapDrawLandmark(ctx, cx, cy, toRadar, radarRadius, S.x, S.y, '#38bdf8', '#60a5fa', 'DB', 'square', dbPulse);
        }

        if (window.MTC_SHOP_LOCATION) {
            const SH = window.MTC_SHOP_LOCATION;
            const shPulse = 0.65 + Math.sin(now / 700 + 1.2) * 0.35;
            CanvasHUD._minimapDrawLandmark(ctx, cx, cy, toRadar, radarRadius, SH.x, SH.y, '#facc15', '#f59e0b', 'SHOP', 'square', shPulse);
        }

        if (portal && portal.active && Number.isFinite(portal.x) && Number.isFinite(portal.y)) {
            const pPulse = 0.6 + Math.sin(now / 260) * 0.4;
            const pCol = portal.isBossWave ? '#facc15' : '#22d3ee';
            CanvasHUD._minimapDrawLandmark(ctx, cx, cy, toRadar, radarRadius, portal.x, portal.y, pCol, pCol, 'GATE', 'hex', pPulse);
        }

        // 7. Field Powerups
        if (Array.isArray(window.powerups)) {
            ctx.save();
            ctx.fillStyle = '#4ade80';
            for (let i = 0; i < window.powerups.length; i++) {
                const pu = window.powerups[i];
                if (!pu) continue;
                const { x: px, y: py, clamped } = toRadar(pu.x, pu.y, radarRadius - 6);
                if (clamped) continue;
                ctx.beginPath();
                ctx.arc(px, py, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // 8. Enemies (sonar-pinged in Fog Wave, motion-tailed in Speed Wave)
        if (Array.isArray(window.enemies)) {
            for (const e of window.enemies) {
                if (!e || e.dead) continue;
                const { x: ex, y: ey, clamped: ec, angle: ea } = toRadar(e.x, e.y, radarRadius - 5);
                let blipAlpha = 1;
                if (mode.id === 'sonar') {
                    let angDiff = Math.abs(((sweepAngle - ea + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
                    blipAlpha = angDiff < 0.75 ? 1.0 : Math.max(0.16, 1 - (angDiff - 0.75) * 0.65);
                }

                ctx.save();
                ctx.globalAlpha = blipAlpha;
                if (ec) {
                    ctx.translate(ex, ey);
                    ctx.rotate(ea);
                    const arrowColor = e.type === 'mage'
                        ? 'rgba(192,132,252,0.92)'
                        : (e.type === 'tank' ? 'rgba(251,146,60,0.92)' : 'rgba(239,68,68,0.92)');
                    ctx.fillStyle = arrowColor;
                    ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-1.5, -2.5); ctx.lineTo(-1.5, 2.5);
                    ctx.closePath(); ctx.fill();
                } else {
                    if (mode.id === 'speed') {
                        const tailAng = Math.atan2(cy - ey, cx - ex);
                        ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(ex, ey);
                        ctx.lineTo(ex - Math.cos(tailAng) * 6, ey - Math.sin(tailAng) * 6);
                        ctx.stroke();
                    }
                    if (e.type === 'mage') {
                        ctx.translate(ex, ey); ctx.rotate(now / 800);
                        const r = 3.8;
                        ctx.fillStyle = '#c084fc'; ctx.strokeStyle = '#f3e8ff';
                        ctx.lineWidth = 0.8;
                        ctx.beginPath();
                        ctx.moveTo(0, -r); ctx.lineTo(r * 0.6, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.6, 0);
                        ctx.closePath(); ctx.fill(); ctx.stroke();
                    } else if (e.type === 'tank') {
                        const r = 3.2;
                        ctx.fillStyle = '#fb923c'; ctx.strokeStyle = '#ffedd5';
                        ctx.lineWidth = 0.8;
                        ctx.beginPath(); ctx.rect(ex - r, ey - r, r * 2, r * 2); ctx.fill(); ctx.stroke();
                    } else {
                        ctx.fillStyle = '#ef4444';
                        ctx.beginPath(); ctx.arc(ex, ey, 2.8, 0, Math.PI * 2); ctx.fill();
                    }
                }
                ctx.restore();
            }
        }

        // 9. Boss
        if (window.boss && !window.boss.dead) {
            const t = (now % 1000) / 1000;
            const pulse = 0.5 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.8;
            const { x: bx, y: by, clamped: bc, angle: ba } = toRadar(window.boss.x, window.boss.y, radarRadius - 8);
            ctx.save();
            ctx.shadowBlur = 10 * pulse; ctx.shadowColor = '#e879f9';
            if (bc) {
                ctx.translate(bx, by);
                ctx.rotate(ba);
                ctx.globalAlpha = 0.8 + pulse * 0.2;
                ctx.fillStyle = '#e879f9';
                ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-1, -4); ctx.lineTo(-1, 4); ctx.closePath(); ctx.fill();
            } else {
                ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by); ctx.stroke();
                ctx.setLineDash([]);

                ctx.globalAlpha = 0.85 + 0.15 * pulse;
                ctx.fillStyle = '#e879f9';
                ctx.beginPath(); ctx.arc(bx, by, 4.5 * pulse, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 0.5;
                ctx.strokeStyle = '#f5d0fe'; ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.arc(bx, by, 7 + 2 * pulse, 0, Math.PI * 2); ctx.stroke();
                ctx.globalAlpha = 0.95;
                ctx.fillStyle = '#fdf4ff';
                ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                ctx.fillText('BOSS', bx, by - 9);
            }
            ctx.restore();
        }

        // 10. Player pointer at center
        ctx.save();
        ctx.translate(cx, cy);
        if (player.angle !== undefined) ctx.rotate(player.angle + Math.PI / 2);
        ctx.shadowBlur = 7; ctx.shadowColor = '#34d399';
        ctx.fillStyle = 'rgba(52,214,88,0.98)';
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(4.5, 4.5); ctx.lineTo(-4.5, 4.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath(); ctx.arc(0, -3.5, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    static _roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
        } else {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        }
    }
}

if (typeof window !== 'undefined') {
    window.CanvasHUD = CanvasHUD;
    window.addCombo = addCombo;
}
