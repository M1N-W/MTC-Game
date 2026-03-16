'use strict';

/**
 * js/entities/boss/DomainExpansion.js
 * 💠 DOMAIN EXPANSION: METRICS-MANIPULATION
 * Boss Manop Ultimate singleton.
 */

// Domain Expansion configuration — now centralized in BALANCE.boss.domainExpansion
const _DE = BALANCE.boss.domainExpansion || {};
const _DC = {
    ARENA_RADIUS: 1500,
    GRID_SIZE: 120,
    CELL_SIZE: 60,
    CAST_DUR: 2.2,
    WARN_DUR: 1.5,
    WARN_DUR_MIN: 0.50,           // BUG-FIX B1: was undefined → NaN cycleTimer → cycles never advanced
    WARN_DUR_DECAY: 0.18,
    EXPLODE_DUR: 0.45,
    END_DUR: 1.8,                 // BUG-FIX B2: was undefined → ending phase never exited, globalA=NaN
    TOTAL_CYCLES: 6,
    DANGER_PCT: _DE.dangerPct || 0.62,
    DANGER_PCT_MAX: _DE.dangerPctMax || 0.84,
    DANGER_PCT_STEP: _DE.dangerPctStep || 0.04,
    CELL_DAMAGE: _DE.cellDamage || 28,
    CELL_SLOW_DUR: _DE.cellSlowDur || 1.8,
    CELL_SLOW_FACTOR: _DE.cellSlowFactor || 0.45,
    COOLDOWN: _DE.cooldown || 45.0,
    HIT_RADIUS: _DE.hitRadius || 0.58,
    RAIN_COLS: _DE.rainCols || 32,
    BOSS_VOLLEY_CYCLE: _DE.bossVolleyCycle || 3,
    BOSS_VOLLEY_COUNT: 8,
    LOCK_PUSH: 80,                // pixels/s push force when entity tries to leave domain
    // BUG-FIX B3: COLS/ROWS were undefined → _initCells() loop ran 0 times → cells=[] → no grid
    get COLS() { return Math.ceil((this.ARENA_RADIUS * 2) / this.CELL_SIZE); },  // 50
    get ROWS() { return Math.ceil((this.ARENA_RADIUS * 2) / this.CELL_SIZE); },  // 50
};

const _RAIN_POOL = '0123456789ABCDEFΑΒΓΔΩΣΨXYZμσπ∑∫∂∇+-×÷=≠≤≥ΦΘΛ';
function _rainChar() { return _RAIN_POOL[Math.floor(Math.random() * _RAIN_POOL.length)]; }
function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
}

// DomainExpansion extends DomainBase (boss_attacks_shared.js)
const DomainExpansion = Object.assign(Object.create(DomainBase), {
    // ── Manop-specific state ──────────────────────────────────
    cycleTimer: 0, cyclePhase: 'warn', cycleCount: 0,
    cells: [], _indices: [],
    _crackLines: [],    // screen crack visual during casting
    // Phase 3 Rework additions
    _subPhase: 'A',          // 'A' (cycles 1-2) | 'B' (cycles 3-4) | 'C' (cycles 5-6)
    _safeCellShifts: [],     // pre-seeded array of safe-cell index deltas per cycle (B only)
    _domainChalkTimer: 0,    // countdown to next chalk volley (subPhase B)

    trigger(boss) {
        if (!this.canTrigger()) return;
        // Domain covers entire map — anchor to world centre
        this._beginCast(boss, _DC.CAST_DUR);
        this.originX = 0;
        this.originY = 0;
        // Reset Manop-specific state
        this._subPhase = 'A';
        this._domainChalkTimer = 0;
        // Pre-seed safe cell shifts for subPhase B (cycles 3-4, index 2-3)
        // 6 values — one per cycle — deterministic, non-zero offsets
        this._safeCellShifts = [0, 0, 17, 31, 53, 11];
        this._initRain({ pool: _RAIN_POOL, cols: _DC.RAIN_COLS });
        this._announceKaijo(boss, 'METRICS-MANIPULATION', 'METRICS-MANIPULATION', '#d946ef', '#facc15', 'Metrics!');
        if (typeof spawnParticles === 'function') {
            spawnParticles(boss.x, boss.y, 35, '#d946ef');
            spawnParticles(boss.x, boss.y, 20, '#facc15');
            spawnParticles(boss.x, boss.y, 15, '#ffffff');
        }
        console.log('[DomainExpansion] 💠 METRICS-MANIPULATION TRIGGERED');
    },

    update(dt, boss, player) {
        if (this.phase === 'idle') { if (this.cooldownTimer > 0) this.cooldownTimer -= dt; return; }
        // Tick flash timer
        if (this._flashTimer > 0) this._flashTimer -= dt;
        // Tick player slow debuff
        if (typeof window !== 'undefined' && window.player && window.player._domainSlowActive) {
            window.player._domainSlowTimer -= dt;
            if (window.player._domainSlowTimer <= 0) {
                window.player._domainSlowActive = false;
                window.player.stats.moveSpeed = window.player._domainSlowBase || window.player.stats.moveSpeed;
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText('SPEED RESTORED', window.player.x, window.player.y - 60, '#22c55e', 16);
            }
        }
        // Boundary wall message for player (visual only — physics handled by applyPhysics)
        if (this.phase === 'active' && typeof window !== 'undefined' && window.player && !window.player.dead) {
            const p = window.player;
            const R = _DC.ARENA_RADIUS;
            if (Math.hypot(p.x, p.y) > R - p.radius - 10 && !p._domainWallMsg) {
                p._domainWallMsg = true;
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText('⛔ ออกไม่ได้!', p.x, p.y - 50, '#d946ef', 18);
                setTimeout(() => { if (p) p._domainWallMsg = false; }, 1200);
            }
        }
        if (!boss || boss.dead) { this._abort(boss); return; }
        this.timer -= dt;

        switch (this.phase) {
            case 'casting':
                if (this.timer <= 0) {
                    this.phase = 'active'; this.cycleCount = 0;
                    this.cyclePhase = 'warn'; this.cycleTimer = _DC.WARN_DUR;
                    this._initCells(); this._rollCells();
                    if (typeof addScreenShake === 'function') addScreenShake(28);
                    if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
                    if (typeof spawnFloatingText === 'function' && player)
                        spawnFloatingText('⚠ DOMAIN ACTIVE', player.x, player.y - 100, '#ef4444', 28);
                }
                break;

            case 'active':
                this.cycleTimer -= dt;

                // ── SubPhase B: chalk volley tick ─────────────────
                if (this._subPhase === 'B' && this.cyclePhase === 'warn' &&
                    boss && !boss.dead && typeof projectileManager !== 'undefined') {
                    const _DEcfg = BALANCE.boss.domainExpansion || {};
                    const chalkInterval = _DEcfg.subPhaseB_chalkInterval ?? 0.8;
                    const chalkCount = _DEcfg.subPhaseB_chalkCount ?? 3;
                    const chalkSpeed = _DEcfg.subPhaseB_chalkSpeed ?? 460;
                    const chalkDmg = _DEcfg.subPhaseB_chalkDamage ?? 18;
                    this._domainChalkTimer -= dt;
                    if (this._domainChalkTimer <= 0) {
                        this._domainChalkTimer = chalkInterval;
                        for (let _ci = 0; _ci < chalkCount; _ci++) {
                            const _ca = (Math.PI * 2 / chalkCount) * _ci;
                            projectileManager.add(new Projectile(boss.x, boss.y, _ca, chalkSpeed, chalkDmg, '#fef08a', false, 'enemy'));
                        }
                        if (typeof addScreenShake === 'function') addScreenShake(5);
                    }
                }

                if (this.cyclePhase === 'warn' && this.cycleTimer <= 0) {
                    this.cyclePhase = 'explode'; this.cycleTimer = _DC.EXPLODE_DUR;
                    this._doExplosions(player);
                } else if (this.cyclePhase === 'explode' && this.cycleTimer <= 0) {
                    this.cycleCount++;
                    if (this.cycleCount >= _DC.TOTAL_CYCLES) {
                        this.phase = 'ending'; this.timer = _DC.END_DUR;
                        boss._domainCasting = false;
                        if (typeof addScreenShake === 'function') addScreenShake(20);
                        if (typeof spawnFloatingText === 'function' && player)
                            spawnFloatingText('Domain Lifted', player.x, player.y - 90, '#d946ef', 26);
                        if (window.UIManager)
                            window.UIManager.showVoiceBubble('...แค่นั้นแหละ.', boss.x, boss.y - 50);
                    } else {
                        // ── Compute subPhase for next cycle ──────
                        if (this.cycleCount <= 2) this._subPhase = 'A';
                        else if (this.cycleCount <= 4) this._subPhase = 'B';
                        else this._subPhase = 'C';

                        // Reset chalk timer when entering B
                        if (this._subPhase === 'B') this._domainChalkTimer = 0;

                        // ── SubPhase transition announcements ────
                        if (this.cycleCount === 2 && typeof spawnFloatingText === 'function' && player) {
                            spawnFloatingText('📐 LOG457 OVERDRIVE', player.x, player.y - 110, '#facc15', 26);
                            setTimeout(() => {
                                if (typeof spawnFloatingText === 'function' && player)
                                    spawnFloatingText('SAFE CELL MOVES!', player.x, player.y - 148, '#fbbf24', 20);
                            }, 500);
                            if (typeof addScreenShake === 'function') addScreenShake(16);
                        } else if (this.cycleCount === 4 && typeof spawnFloatingText === 'function' && player) {
                            spawnFloatingText('💀 DOMAIN COLLAPSE', player.x, player.y - 110, '#ef4444', 28);
                            if (typeof addScreenShake === 'function') addScreenShake(22);
                        }

                        this.cyclePhase = 'warn';
                        // SubPhase A gets longer warn; B/C use normal decay
                        const _DEcfg2 = BALANCE.boss.domainExpansion || {};
                        const baseWarn = (this._subPhase === 'A')
                            ? (_DEcfg2.subPhaseA_warnDur ?? 2.0)
                            : _DC.WARN_DUR;
                        const decayedWarn = Math.max(_DC.WARN_DUR_MIN, baseWarn - this.cycleCount * _DC.WARN_DUR_DECAY);
                        this.cycleTimer = decayedWarn;
                        this._rollCells();

                        // ── Boss volley on B/C (cycle 3+) ────────
                        if (this.cycleCount >= _DC.BOSS_VOLLEY_CYCLE && boss && !boss.dead && typeof projectileManager !== 'undefined') {
                            const n = _DC.BOSS_VOLLEY_COUNT;
                            for (let _vi = 0; _vi < n; _vi++) {
                                const _va = (Math.PI * 2 / n) * _vi;
                                projectileManager.add(new Projectile(boss.x, boss.y, _va, 520, 20, '#d946ef', true, 'enemy'));
                            }
                            if (typeof addScreenShake === 'function') addScreenShake(12);
                        }

                        // ── SubPhase C: 30% chance TeacherFury ───
                        if (this._subPhase === 'C' && boss && !boss.dead) {
                            const _DEcfg3 = BALANCE.boss.domainExpansion || {};
                            const furyChance = _DEcfg3.subPhaseC_teacherFuryChance ?? 0.30;
                            if (Math.random() < furyChance && typeof boss.useTeacherFury === 'function') {
                                boss.useTeacherFury(player);
                            }
                        }
                    }
                }
                break;

            case 'ending':
                if (this.timer <= 0) {
                    this.cells = []; this._crackLines = [];
                    this._subPhase = 'A'; this._domainChalkTimer = 0; this._safeCellShifts = [];
                    this._endDomain(boss, _DC.COOLDOWN);
                    console.log('[DomainExpansion] Domain ended — cooldown 45 s');
                }
                break;
        }
    },

    draw(ctx) {
        if (this.phase === 'idle' || !ctx) return;
        if (typeof worldToScreen !== 'function') return;
        const W = ctx.canvas.width, H = ctx.canvas.height;
        const now = performance.now() / 1000;

        let globalA = 1.0;
        if (this.phase === 'casting') globalA = 1.0 - this.timer / _DC.CAST_DUR;
        else if (this.phase === 'ending') globalA = this.timer / _DC.END_DUR;
        globalA = Math.max(0, Math.min(1, globalA));

        ctx.save();

        // ── 1. Dark overlay ──────────────────────────────────
        ctx.globalAlpha = globalA * 0.80;
        ctx.fillStyle = 'rgba(2,0,14,1)';
        ctx.fillRect(0, 0, W, H);

        // ── 2. Matrix rain — denser, dual-colour ────────────
        this._drawRain(ctx, now, W, H, globalA, ['#d946ef', '#d946ef', '#d97706']);

        // ── 3. Domain border — circular arena ring ────────────
        if (this.phase === 'active' || this.phase === 'ending') {
            const originSS = worldToScreen(this.originX, this.originY);
            const edgeSS = worldToScreen(this.originX + _DC.ARENA_RADIUS, this.originY);
            const radiusSS = Math.abs(edgeSS.x - originSS.x);
            const bCX = originSS.x, bCY = originSS.y;
            const pulse = 0.55 + Math.sin(now * 5) * 0.45;
            const dangerPct = Math.min(_DC.DANGER_PCT_MAX, _DC.DANGER_PCT + this.cycleCount * _DC.DANGER_PCT_STEP);
            const tintR = Math.floor(180 + (dangerPct - _DC.DANGER_PCT) / (_DC.DANGER_PCT_MAX - _DC.DANGER_PCT) * 75);
            const borderCol = `rgb(${tintR},0,255)`;

            // ── Inner energy tendrils rotating around border ──
            const tendrilCount = 8;
            for (let ti = 0; ti < tendrilCount; ti++) {
                const baseAngle = (ti / tendrilCount) * Math.PI * 2 + now * 0.8;
                const wobble = Math.sin(now * 3 + ti * 1.3) * 0.18;
                const ta = baseAngle + wobble;
                const innerR = radiusSS * 0.85;
                const tx1 = bCX + Math.cos(ta) * innerR;
                const ty1 = bCY + Math.sin(ta) * innerR;
                const tx2 = bCX + Math.cos(ta + Math.PI * 0.18) * radiusSS;
                const ty2 = bCY + Math.sin(ta + Math.PI * 0.18) * radiusSS;
                ctx.globalAlpha = globalA * (0.25 + pulse * 0.20);
                ctx.strokeStyle = borderCol;
                ctx.lineWidth = 1.5;
                ctx.shadowBlur = 8; ctx.shadowColor = borderCol;
                ctx.beginPath(); ctx.moveTo(tx1, ty1); ctx.lineTo(tx2, ty2); ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Outer glow ring
            ctx.globalAlpha = globalA * (0.55 + pulse * 0.45);
            ctx.shadowBlur = 32 * pulse; ctx.shadowColor = borderCol;
            ctx.strokeStyle = borderCol; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(bCX, bCY, radiusSS, 0, Math.PI * 2); ctx.stroke();

            // Inner dashed ring
            ctx.globalAlpha = globalA * 0.35;
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(217,70,239,0.4)'; ctx.lineWidth = 1.5;
            ctx.setLineDash([12, 8]);
            ctx.beginPath(); ctx.arc(bCX, bCY, radiusSS - 8, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);

            // Rotating rune symbols around the circle
            const runeSymbols = ['Σ', 'Ψ', 'Ω', '∇', 'Φ', '∫', 'Δ', 'Λ', 'θ', 'π', 'μ', '∂'];
            ctx.font = 'bold 14px serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            for (let ri = 0; ri < runeSymbols.length; ri++) {
                const rAngle = (ri / runeSymbols.length) * Math.PI * 2 + now * 0.5;
                const rAlpha = 0.55 + Math.sin(now * 2.5 + ri) * 0.35;
                const rx = bCX + Math.cos(rAngle) * (radiusSS + 18);
                const ry = bCY + Math.sin(rAngle) * (radiusSS + 18);
                ctx.globalAlpha = globalA * rAlpha;
                ctx.fillStyle = '#d946ef';
                ctx.shadowBlur = 8; ctx.shadowColor = '#d946ef';
                ctx.fillText(runeSymbols[ri], rx, ry);
            }
            ctx.shadowBlur = 0;

            // Cycle counter chip — top of screen
            if (this.phase === 'active') {
                const warnDurCurrent = Math.max(_DC.WARN_DUR_MIN, _DC.WARN_DUR - this.cycleCount * _DC.WARN_DUR_DECAY);
                const warnProg = this.cyclePhase === 'warn' ? (1.0 - this.cycleTimer / warnDurCurrent) : 1.0;
                const chipX = bCX, chipY = bCY - radiusSS - 28;
                ctx.globalAlpha = globalA * 0.92;
                ctx.font = 'bold 11px "Orbitron",Arial';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = 'rgba(2,0,14,0.9)';
                ctx.fillRect(chipX - 58, chipY - 12, 116, 24);
                ctx.strokeStyle = borderCol; ctx.lineWidth = 1.5;
                ctx.strokeRect(chipX - 58, chipY - 12, 116, 24);
                ctx.fillStyle = borderCol;
                ctx.globalAlpha = globalA * 0.5;
                ctx.fillRect(chipX - 56, chipY - 10, 112 * warnProg, 20);
                ctx.globalAlpha = globalA * 0.92;
                ctx.fillStyle = '#f0abfc';
                ctx.shadowBlur = 6; ctx.shadowColor = '#d946ef';
                ctx.fillText(`CYCLE ${this.cycleCount + 1} / ${_DC.TOTAL_CYCLES}`, chipX, chipY);
                ctx.shadowBlur = 0;
                ctx.globalAlpha = globalA * 0.70;
                ctx.font = 'bold 9px "Orbitron",Arial';
                ctx.fillStyle = tintR > 210 ? '#ef4444' : '#facc15';
                ctx.fillText(`DANGER ${Math.round(dangerPct * 100)}%`, chipX, chipY + 18);
            }
        }

        // ── 4. Grid cells ────────────────────────────────────
        if ((this.phase === 'active' || this.phase === 'ending') && this.cells.length) {
            const warnDurCurrent = Math.max(_DC.WARN_DUR_MIN, _DC.WARN_DUR - this.cycleCount * _DC.WARN_DUR_DECAY);
            const warnProgress = this.cyclePhase === 'warn' ? (1.0 - this.cycleTimer / warnDurCurrent) : 1.0;
            const explodeProgress = this.cyclePhase === 'explode' ? (1.0 - this.cycleTimer / _DC.EXPLODE_DUR) : 0;
            const fastPulse = 0.5 + Math.sin(now * (4 + warnProgress * 10)) * 0.5;
            const isLate = warnProgress > 0.60;

            const isEnding = this.phase === 'ending';
            const collapsePct = isEnding ? (1.0 - globalA) : 0;  // 0→1 as domain fades

            const SHADOW_BUDGET = 80;  // max cells allowed to use shadowBlur
            let visibleCount = 0;
            for (const cell of this.cells) {
                const tl0 = worldToScreen(cell.wx, cell.wy);
                const br0 = worldToScreen(cell.wx + _DC.CELL_SIZE, cell.wy + _DC.CELL_SIZE);
                if (br0.x >= 0 && tl0.x <= W && br0.y >= 0 && tl0.y <= H) visibleCount++;
            }
            const useShadow = visibleCount <= SHADOW_BUDGET;

            for (const cell of this.cells) {
                // Collapse: shift cell toward origin during ending
                let drawWx = cell.wx, drawWy = cell.wy;
                if (isEnding && collapsePct > 0) {
                    const cellCX = cell.wx + _DC.CELL_SIZE / 2;
                    const cellCY = cell.wy + _DC.CELL_SIZE / 2;
                    drawWx = cellCX + (this.originX - cellCX) * collapsePct * 0.6 - _DC.CELL_SIZE / 2;
                    drawWy = cellCY + (this.originY - cellCY) * collapsePct * 0.6 - _DC.CELL_SIZE / 2;
                }

                const tl = worldToScreen(drawWx, drawWy);
                const br = worldToScreen(drawWx + _DC.CELL_SIZE, drawWy + _DC.CELL_SIZE);
                const sw = br.x - tl.x, sh = br.y - tl.y;
                if (br.x < 0 || tl.x > W || br.y < 0 || tl.y > H || sw < 2 || sh < 2) continue;
                const mx = tl.x + sw / 2, my = tl.y + sh / 2;

                if (cell.dangerous) {
                    if (this.cyclePhase === 'explode') {
                        // ── Explosion flash ───────────────────
                        const ef = 1.0 - explodeProgress;
                        ctx.globalAlpha = globalA * ef * 0.98;
                        const eg = ctx.createRadialGradient(mx, my, 0, mx, my, sw * 0.72);
                        eg.addColorStop(0, `rgba(255,255,220,${ef})`);
                        eg.addColorStop(0.4, `rgba(239,68,68,${ef * 0.9})`);
                        eg.addColorStop(1, `rgba(217,70,239,0)`);
                        ctx.fillStyle = eg;
                        ctx.fillRect(tl.x, tl.y, sw, sh);
                        // Bright border
                        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
                        ctx.shadowBlur = useShadow ? 18 : 0; ctx.shadowColor = '#ef4444';
                        ctx.globalAlpha = globalA * ef * 0.85;
                        ctx.strokeRect(tl.x + 1, tl.y + 1, sw - 2, sh - 2);
                        // Shockwave ring expanding from cell
                        const swRing = explodeProgress * sw * 1.8;
                        ctx.globalAlpha = globalA * (1.0 - explodeProgress) * 0.7;
                        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2;
                        ctx.shadowBlur = useShadow ? 12 : 0; ctx.shadowColor = '#facc15';
                        ctx.beginPath(); ctx.arc(mx, my, swRing * 0.5, 0, Math.PI * 2); ctx.stroke();
                        ctx.shadowBlur = 0;
                    } else {
                        // ── Warning ───────────────────────────
                        const baseCol = isLate ? '#ef4444' : '#d97706';
                        const glowCol = isLate ? '#ef4444' : '#facc15';
                        if (useShadow) {
                            const wg = ctx.createRadialGradient(mx, my, 0, mx, my, sw * 0.72);
                            const fillA = 0.18 + warnProgress * 0.45 * fastPulse;
                            wg.addColorStop(0, isLate ? `rgba(239,68,68,${fillA * 1.4})` : `rgba(251,146,60,${fillA})`);
                            wg.addColorStop(1, `rgba(0,0,0,0)`);
                            ctx.globalAlpha = globalA;
                            ctx.fillStyle = wg;
                        } else {
                            const fillA = (0.18 + warnProgress * 0.45 * fastPulse) * 0.85;
                            ctx.globalAlpha = globalA * fillA;
                            ctx.fillStyle = isLate ? '#ef4444' : '#d97706';
                        }
                        ctx.fillRect(tl.x, tl.y, sw, sh);
                        // Animated border
                        ctx.strokeStyle = baseCol; ctx.lineWidth = isLate ? 2.5 : 1.8;
                        ctx.shadowBlur = useShadow ? (isLate ? (8 + fastPulse * 10) : 4) : 0;
                        ctx.shadowColor = glowCol;
                        ctx.globalAlpha = globalA * (0.4 + fastPulse * 0.6);
                        ctx.strokeRect(tl.x + 1, tl.y + 1, sw - 2, sh - 2);
                        ctx.shadowBlur = 0;
                        // Corner tick marks
                        ctx.strokeStyle = glowCol; ctx.lineWidth = 1.5;
                        ctx.globalAlpha = globalA * 0.85;
                        const tl2 = 7;
                        [[tl.x, tl.y, 1, 1], [tl.x + sw, tl.y, -1, 1], [tl.x, tl.y + sh, 1, -1], [tl.x + sw, tl.y + sh, -1, -1]].forEach(([bx, by, sx2, sy2]) => {
                            ctx.beginPath(); ctx.moveTo(bx + sx2 * tl2, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by + sy2 * tl2); ctx.stroke();
                        });
                        // Crack lines
                        if (useShadow && warnProgress > 0.35) {
                            const crackProg = (warnProgress - 0.35) / 0.65;
                            const crackLen = sw * 0.3 * crackProg;
                            ctx.globalAlpha = globalA * crackProg * 0.75;
                            ctx.strokeStyle = isLate ? '#fca5a5' : '#fde68a';
                            ctx.lineWidth = 1;
                            ctx.shadowBlur = 4; ctx.shadowColor = glowCol;
                            const seed = Math.abs(Math.round(cell.wx * 0.1 + cell.wy * 0.07));
                            for (let ci = 0; ci < 3; ci++) {
                                const ca = ((seed * 37 + ci * 120) % 360) * Math.PI / 180;
                                ctx.beginPath();
                                ctx.moveTo(mx, my);
                                ctx.lineTo(mx + Math.cos(ca) * crackLen, my + Math.sin(ca) * crackLen);
                                ctx.stroke();
                            }
                            ctx.shadowBlur = 0;
                        }
                        // Countdown bar
                        const barW = Math.max(0, (sw - 4) * (1.0 - warnProgress));
                        ctx.globalAlpha = globalA * 0.9;
                        const barG = ctx.createLinearGradient(tl.x + 2, 0, tl.x + 2 + barW, 0);
                        barG.addColorStop(0, isLate ? '#ef4444' : '#facc15');
                        barG.addColorStop(1, isLate ? '#fbbf24' : '#d97706');
                        ctx.fillStyle = barG;
                        ctx.fillRect(tl.x + 2, tl.y + sh - 6, barW, 5);
                        // Math formula + ⚠ icon
                        if (sw >= 14) {
                            const formulas = ['∑x²', 'dy/dx', 'log(x)', 'f\'(x)', 'det(A)', 'eigenλ', 'μ+σ', '∫f dx'];
                            const fi = Math.abs(Math.round(cell.wx + cell.wy) % formulas.length);
                            const formulaAlpha = isLate ? (0.30 + fastPulse * 0.35) : 0.18;
                            ctx.globalAlpha = globalA * formulaAlpha;
                            ctx.font = `bold ${Math.max(8, Math.floor(sw * 0.15))}px "Courier New",monospace`;
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            ctx.fillStyle = isLate ? '#fca5a5' : '#fde68a';
                            ctx.fillText(formulas[fi], mx, my + sh * 0.15);
                            // ⚠ icon
                            const iconSize = Math.max(10, Math.floor(sh * 0.38));
                            ctx.globalAlpha = globalA * (0.6 + fastPulse * 0.4);
                            ctx.font = `${iconSize}px Arial`;
                            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            ctx.fillStyle = '#fff';
                            ctx.shadowBlur = useShadow ? (isLate ? 10 : 4) : 0; ctx.shadowColor = glowCol;
                            ctx.fillText('⚠', mx, my - sh * 0.12);
                            ctx.shadowBlur = 0;
                        }
                    }
                } else {
                    // ── Safe cell ─────────────────────────────
                    ctx.globalAlpha = globalA * 0.12;
                    ctx.fillStyle = '#22c55e'; ctx.fillRect(tl.x, tl.y, sw, sh);
                    ctx.globalAlpha = globalA * 0.35;
                    ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1.5;
                    ctx.shadowBlur = useShadow ? 6 : 0; ctx.shadowColor = '#22c55e';
                    ctx.strokeRect(tl.x + 1, tl.y + 1, sw - 2, sh - 2);
                    ctx.shadowBlur = 0;
                    if (useShadow && sw >= 14) {
                        const sSeed = Math.abs(Math.round(cell.wx * 0.13 + cell.wy * 0.09));
                        const sPhase = (sSeed % 100) / 100;
                        const sX = mx + Math.sin(now * 2.2 + sPhase * 6.28) * sw * 0.22;
                        const sY = my + Math.cos(now * 1.8 + sPhase * 6.28) * sh * 0.22;
                        ctx.globalAlpha = globalA * (0.4 + Math.sin(now * 3 + sPhase * 6.28) * 0.3);
                        ctx.fillStyle = '#86efac';
                        ctx.shadowBlur = 8; ctx.shadowColor = '#4ade80';
                        ctx.beginPath(); ctx.arc(sX, sY, 2.5, 0, Math.PI * 2); ctx.fill();
                        ctx.shadowBlur = 0;
                        const iconSize2 = Math.max(8, Math.floor(sh * 0.30));
                        ctx.globalAlpha = globalA * 0.55;
                        ctx.font = `bold ${iconSize2}px Arial`;
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillStyle = '#4ade80';
                        ctx.fillText('✓', mx, my);
                    }
                }
            }
        }

        // ── 5. Casting animation ─────────────────────────────
        if (this.phase === 'casting') {
            const elapsed = _DC.CAST_DUR - this.timer;
            const ringScreen = worldToScreen(this.originX, this.originY);

            const arenaEdgeSS = worldToScreen(_DC.ARENA_RADIUS, 0);
            const arenaOriginSS = worldToScreen(0, 0);
            const arenaSSRadius = Math.abs(arenaEdgeSS.x - arenaOriginSS.x);
            for (let ri = 0; ri < 3; ri++) {
                const delay = ri * 0.5;
                if (elapsed < delay) continue;
                const rProg = Math.min(1.0, (elapsed - delay) / (_DC.CAST_DUR - delay));
                const ringR = rProg * arenaSSRadius * 1.05;
                ctx.globalAlpha = globalA * (1.0 - rProg) * (0.5 - ri * 0.12);
                ctx.strokeStyle = ri === 0 ? '#d946ef' : ri === 1 ? '#facc15' : '#ffffff';
                ctx.lineWidth = 3 - ri * 0.8;
                ctx.shadowBlur = 24 - ri * 6; ctx.shadowColor = '#d946ef';
                ctx.beginPath(); ctx.arc(ringScreen.x, ringScreen.y, ringR, 0, Math.PI * 2); ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Pillar of light rising from boss
            if (elapsed > 0.3) {
                const pillarProg = Math.min(1.0, (elapsed - 0.3) / 1.0);
                const pillarH = H * pillarProg;
                const pillarW = 60 + pillarProg * 40;
                const pg = ctx.createLinearGradient(ringScreen.x, ringScreen.y, ringScreen.x, ringScreen.y - pillarH);
                pg.addColorStop(0, `rgba(217,70,239,${0.7 * pillarProg})`);
                pg.addColorStop(0.5, `rgba(250,204,21,${0.35 * pillarProg})`);
                pg.addColorStop(1, `rgba(217,70,239,0)`);
                ctx.globalAlpha = globalA * pillarProg;
                ctx.fillStyle = pg;
                ctx.shadowBlur = 40; ctx.shadowColor = '#d946ef';
                ctx.fillRect(ringScreen.x - pillarW / 2, ringScreen.y - pillarH, pillarW, pillarH);
                ctx.shadowBlur = 0;
                ctx.globalAlpha = globalA * pillarProg * 0.6;
                ctx.strokeStyle = '#f0abfc'; ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(ringScreen.x - pillarW / 2, ringScreen.y);
                ctx.lineTo(ringScreen.x - pillarW * 0.1, ringScreen.y - pillarH);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(ringScreen.x + pillarW / 2, ringScreen.y);
                ctx.lineTo(ringScreen.x + pillarW * 0.1, ringScreen.y - pillarH);
                ctx.stroke();
            }

            // Chromatic aberration scan lines
            if (elapsed > 0.8) {
                const caProg = Math.min(1.0, (elapsed - 0.8) / 1.2);
                const lineCount = Math.floor(caProg * 12);
                for (let li = 0; li < lineCount; li++) {
                    const ly = (li / lineCount) * H + Math.sin(now * 8 + li) * 15;
                    ctx.globalAlpha = globalA * 0.08 * caProg;
                    ctx.fillStyle = li % 3 === 0 ? '#d946ef' : li % 3 === 1 ? '#facc15' : '#38bdf8';
                    ctx.fillRect(0, ly, W, 2);
                }
            }

            // Screen crack lines
            if (elapsed > 0.5 && this._crackLines.length === 0) {
                for (let ci = 0; ci < 8; ci++) {
                    const cx2 = W * (0.3 + Math.random() * 0.4);
                    const cy2 = H * (0.3 + Math.random() * 0.4);
                    const len = 40 + Math.random() * 100;
                    const angle = Math.random() * Math.PI * 2;
                    this._crackLines.push({ x: cx2, y: cy2, dx: Math.cos(angle) * len, dy: Math.sin(angle) * len });
                }
            }
            if (elapsed > 0.5 && this._crackLines.length > 0) {
                const crackA = Math.min(1.0, (elapsed - 0.5) / 0.8) * 0.55;
                ctx.strokeStyle = '#d946ef'; ctx.lineWidth = 1.5;
                ctx.shadowBlur = 10; ctx.shadowColor = '#d946ef';
                for (const cl of this._crackLines) {
                    ctx.globalAlpha = globalA * crackA;
                    ctx.beginPath(); ctx.moveTo(cl.x, cl.y); ctx.lineTo(cl.x + cl.dx, cl.y + cl.dy); ctx.stroke();
                    ctx.globalAlpha = globalA * crackA * 0.5;
                    ctx.beginPath(); ctx.moveTo(cl.x + cl.dx * 0.5, cl.y + cl.dy * 0.5);
                    ctx.lineTo(cl.x + cl.dx * 0.5 + cl.dy * 0.4, cl.y + cl.dy * 0.5 - cl.dx * 0.4); ctx.stroke();
                }
                ctx.shadowBlur = 0;
            }

            // 領域展開 kanji
            if (elapsed > 0.35) {
                const ta = Math.min(1.0, (elapsed - 0.35) / 0.45);
                const sc = 0.78 + ta * 0.22;
                const fontSize = Math.round(52 * sc);
                ctx.globalAlpha = globalA * ta * 0.45;
                ctx.font = `bold ${fontSize}px serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#38bdf8';
                ctx.fillText('領域展開', W / 2 - 3, H / 2 - 42 + 2);
                ctx.fillStyle = '#ef4444';
                ctx.fillText('領域展開', W / 2 + 3, H / 2 - 42 - 2);
                ctx.globalAlpha = globalA * ta;
                ctx.fillStyle = '#f0abfc';
                ctx.shadowBlur = 40; ctx.shadowColor = '#d946ef';
                ctx.fillText('領域展開', W / 2, H / 2 - 42);
                ctx.shadowBlur = 0;
            }
            // METRICS-MANIPULATION subtitle
            if (elapsed > 1.05) {
                const tb = Math.min(1.0, (elapsed - 1.05) / 0.55);
                ctx.globalAlpha = globalA * tb;
                ctx.font = `900 ${Math.round(36 * (0.88 + tb * 0.12))}px "Orbitron","Bebas Neue",Arial`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.shadowBlur = 28; ctx.shadowColor = '#facc15';
                ctx.fillStyle = '#fef08a';
                ctx.fillText('METRICS-MANIPULATION', W / 2, H / 2 + 28);
                ctx.shadowBlur = 0;
                ctx.globalAlpha = globalA * tb * 0.8;
                ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2;
                const ulW = tb * 280;
                ctx.beginPath(); ctx.moveTo(W / 2 - ulW / 2, H / 2 + 50); ctx.lineTo(W / 2 + ulW / 2, H / 2 + 50); ctx.stroke();
            }
            // Final white flash
            if (elapsed > _DC.CAST_DUR - 0.35) {
                const tf = (elapsed - (_DC.CAST_DUR - 0.35)) / 0.35;
                ctx.globalAlpha = globalA * tf * 0.70;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, W, H);
                ctx.globalAlpha = globalA * tf * 0.45;
                ctx.fillStyle = '#d946ef';
                ctx.fillRect(0, 0, W, H);
            }
        }

        // ── 6. Full-screen hit flash (purple) ────────────────
        if (this._flashTimer > 0) {
            ctx.globalAlpha = Math.min(this._flashTimer / 0.12, 1.0) * 0.55;
            ctx.fillStyle = '#d946ef';
            ctx.fillRect(0, 0, W, H);
        }

        // ── 7. Slow debuff HUD indicator ─────────────────────
        if (typeof window !== 'undefined' && window.player && window.player._domainSlowActive) {
            const slowPulse = 0.5 + Math.sin(now * 6) * 0.5;
            ctx.globalAlpha = globalA * 0.28 * slowPulse;
            ctx.fillStyle = '#d946ef';
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = globalA * (0.6 + slowPulse * 0.35);
            ctx.font = 'bold 14px "Orbitron",Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillStyle = '#f0abfc';
            ctx.shadowBlur = 12; ctx.shadowColor = '#d946ef';
            ctx.fillText('🔮 SLOWED', W / 2, 12);
            ctx.shadowBlur = 0;
        }

        // ── 8. SubPhase label (top-right corner) ─────────────
        if (this.phase === 'active') {
            const subLabels = {
                A: { text: 'PHASE A — EQUATION RAIN', col: '#a78bfa' },
                B: { text: 'PHASE B — LOG457 OVERDRIVE', col: '#facc15' },
                C: { text: 'PHASE C — DOMAIN COLLAPSE', col: '#ef4444' },
            };
            const sl = subLabels[this._subPhase];
            if (sl) {
                const subPulse = 0.7 + Math.sin(now * 4) * 0.3;
                ctx.globalAlpha = globalA * subPulse * 0.85;
                ctx.font = 'bold 13px "Orbitron",Arial';
                ctx.textAlign = 'right'; ctx.textBaseline = 'top';
                ctx.fillStyle = sl.col;
                ctx.shadowBlur = 14; ctx.shadowColor = sl.col;
                ctx.fillText(sl.text, W - 14, 14);
                ctx.shadowBlur = 0;
            }
        }

        ctx.restore();
    },

    // ── Private ────────────────────────────────────────────────
    _initCells() {
        this.cells = []; this._indices = [];
        const half = (_DC.COLS * _DC.CELL_SIZE) / 2;
        const R = _DC.ARENA_RADIUS;
        const halfCell = _DC.CELL_SIZE / 2;
        for (let r = 0; r < _DC.ROWS; r++)
            for (let col = 0; col < _DC.COLS; col++) {
                const wx = this.originX - half + col * _DC.CELL_SIZE;
                const wy = this.originY - half + r * _DC.CELL_SIZE;
                const ccx = wx + halfCell, ccy = wy + halfCell;
                if (Math.hypot(ccx - this.originX, ccy - this.originY) > R) continue;
                this.cells.push({ wx, wy, dangerous: false, exploded: false });
            }
        this._indices = new Array(this.cells.length);
    },
    _rollCells() {
        const _DEcfg = BALANCE.boss.domainExpansion || {};
        const stepOverride = (this._subPhase === 'B' || this._subPhase === 'C')
            ? (_DEcfg.subPhaseB_dangerPctStep ?? 0.06)
            : _DC.DANGER_PCT_STEP;
        const dangerPct = Math.min(_DC.DANGER_PCT_MAX, _DC.DANGER_PCT + this.cycleCount * stepOverride);
        const n = this.cells.length, dangCount = Math.floor(n * dangerPct);
        for (let i = 0; i < n; i++) this._indices[i] = i;
        _shuffle(this._indices);
        for (let i = 0; i < n; i++) {
            this.cells[this._indices[i]].dangerous = i < dangCount;
            this.cells[this._indices[i]].exploded = false;
        }
        if ((this._subPhase === 'B') && this._safeCellShifts.length > 0 && n > 0) {
            const shift = this._safeCellShifts[Math.min(this.cycleCount, this._safeCellShifts.length - 1)];
            if (shift > 0) {
                const safeIdx = this._indices.findIndex((_, pos) => pos >= dangCount);
                const shiftedIdx = (this._indices[safeIdx] + shift) % n;
                this.cells[this._indices[safeIdx]].dangerous = true;
                this.cells[shiftedIdx].dangerous = false;
            }
        }
    },
    _doExplosions(player) {
        for (const cell of this.cells) {
            if (!cell.dangerous) continue;
            cell.exploded = true;
            const cx = cell.wx + _DC.CELL_SIZE / 2, cy = cell.wy + _DC.CELL_SIZE / 2;
            if (typeof spawnParticles === 'function') {
                spawnParticles(cx, cy, 10, '#ef4444');
                spawnParticles(cx, cy, 5, '#facc15');
            }
            if (player && !player.dead) {
                const pd = Math.hypot(player.x - cx, player.y - cy);
                if (pd < _DC.CELL_SIZE * _DC.HIT_RADIUS) {
                    player.takeDamage(_DC.CELL_DAMAGE);
                    if (!player._domainSlowActive) {
                        player._domainSlowActive = true;
                        player._domainSlowTimer = _DC.CELL_SLOW_DUR;
                        player._domainSlowBase = player.stats.moveSpeed;
                        player.stats.moveSpeed *= _DC.CELL_SLOW_FACTOR;
                    } else {
                        player._domainSlowTimer = _DC.CELL_SLOW_DUR;
                    }
                    if (typeof spawnFloatingText === 'function') {
                        spawnFloatingText(`💥 ${_DC.CELL_DAMAGE}`, player.x, player.y - 55, '#ef4444', 20);
                        spawnFloatingText('🔮 SLOWED!', player.x, player.y - 80, '#d946ef', 18);
                    }
                    if (typeof addScreenShake === 'function') addScreenShake(10);
                    if (typeof Audio !== 'undefined' && Audio.playHit) Audio.playHit();
                    DomainExpansion._flashTimer = 0.12;
                }
            }
        }
    },
    _abort(boss) {
        this.cells = []; this._crackLines = [];
        this._subPhase = 'A'; this._domainChalkTimer = 0; this._safeCellShifts = [];
        this.cycleCount = 0; this.cycleTimer = 0; this.cyclePhase = 'warn';
        Object.getPrototypeOf(this).abort.call(this, boss);
        console.log('[DomainExpansion] Aborted — boss dead');
    },
});

window.DomainExpansion = DomainExpansion;
DomainExpansion._DC_RADIUS = _DC.ARENA_RADIUS;
