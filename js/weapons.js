'use strict';
/**
 * 🔫 MTC: ENHANCED EDITION - Weapon System
 * Beautiful 3D-style gun models + Auto Rifle Burst Fire
 *
 * COLLISION OPTIMIZATION (v2 — Spatial Grid pass):
 *   ✅ SpatialGrid class — O(E) build, O(P×k) query (k = avg enemies/cell ≈ 4)
 *      Replaces O(P×E) brute-force enemy scan in ProjectileManager.update().
 *      Cell size: 128 px (safely larger than max collision radius ~20 px).
 *      9-cell neighbourhood query (3×3 block) prevents missed hits at cell edges.
 *   ✅ ProjectileManager.update() — reverse loop + swap-and-pop O(1) removal
 *      (replaces splice O(n); reverse order makes swap safe — index never skipped).
 *   ✅ ProjectileManager — _grid instance reused every frame (no per-frame alloc).
 *
 * ROLLBACK (1 line): in ProjectileManager.update(), swap the spatial-grid block back to:
 *   for (let enemy of enemies) { if (!enemy.dead && proj.checkCollision(enemy)) { … } }
 *   and restore splice(i,1) in place of the swap-and-pop at the bottom.
 *
 * FIXED BUGS (refactor):
 * - All BALANCE.player.weapons.* → BALANCE.characters[this.activeChar].weapons.*
 * - All BALANCE.player.critMultiplier → BALANCE.characters[this.activeChar].critMultiplier
 * - WeaponSystem stores this.activeChar, set via setActiveChar(charType) in startGame
 * - Guard clauses in updateWeaponUI / getWeaponData prevent crash when char unset
 *
 * AUDIO NOTE (Poom character sounds):
 * - Poom's shooting sound (Audio.playPoomShoot) is called inside
 * PoomPlayer.shoot() in js/entities/player.js, NOT here.
 * Reason: Poom bypasses WeaponSystem entirely — his projectile is fired
 * directly via PoomPlayer.shoot() which reads his rice* stats from BALANCE.
 * WeaponSystem only governs Kao's auto/sniper/shotgun weapon modes.
 * - Naga hit sound (Audio.playNagaAttack) is called inside
 * NagaEntity.update() in js/entities/player.js with a 220 ms cooldown
 * to prevent rapid-tick audio stacking.
 */

// ============================================================================
// 🚀 PROJECTILE CLASS (FULLY RESTORED & RICOCHET BUG FIXED)
// ============================================================================
class Projectile {
    constructor(x, y, angle, speed, damage, color, isCrit, team, options = {}) {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.damage = damage;
        this.color = color;
        this.team = team;

        this.life = (options && options.life !== undefined) ? options.life : 3;
        this.angle = angle;
        this.isCrit = isCrit;

        this.kind = options?.kind || 'bullet';
        this.size = (options && options.size !== undefined) ? options.size : (isCrit ? 24 : 14);
        this.radius = (options && options.radius !== undefined) ? options.radius : 10;
        this.pierce = (options && options.pierce !== undefined) ? options.pierce : 0;

        // --- RICOCHET PROPERTY ---
        this.bounces = (options && options.bounces !== undefined) ? options.bounces : 0;

        this.hitSet = null;
        this.symbol = options?.symbol || this.getSymbol(isCrit, team);
    }

    getSymbol(isCrit, team) {
        if (team === 'player') return isCrit ? '∑' : 'x';
        const symbols = ['sin', 'cos', 'tan', '√', 'π', '-b±√', 'dx', 'dy', 'Δ'];
        return randomChoice(symbols);
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        this.angle += dt * 2; // Preserves visual spinning effect

        // --- BULLET-PROOF RICOCHET & BOUNDARY PHYSICS ---
        const _wb = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.physics?.worldBounds)
            ? GAME_CONFIG.physics.worldBounds : 1500;
        const minX = -_wb, maxX = _wb;
        const minY = -_wb, maxY = _wb;

        let hitWall = false;

        if (this.x - this.radius < minX) {
            this.x = minX + this.radius;
            hitWall = true;
            if (this.bounces > 0) {
                this.vx *= -1;
                this.bounces--;
                this.angle = Math.atan2(this.vy, this.vx);
            }
        } else if (this.x + this.radius > maxX) {
            this.x = maxX - this.radius;
            hitWall = true;
            if (this.bounces > 0) {
                this.vx *= -1;
                this.bounces--;
                this.angle = Math.atan2(this.vy, this.vx);
            }
        }

        if (this.y - this.radius < minY) {
            this.y = minY + this.radius;
            hitWall = true;
            if (this.bounces > 0) {
                this.vy *= -1;
                this.bounces--;
                this.angle = Math.atan2(this.vy, this.vx);
            }
        } else if (this.y + this.radius > maxY) {
            this.y = maxY - this.radius;
            hitWall = true;
            if (this.bounces > 0) {
                this.vy *= -1;
                this.bounces--;
                this.angle = Math.atan2(this.vy, this.vx);
            }
        }

        if (hitWall && this.bounces <= 0) {
            this.life = 0;
        }

        if (this.kind !== 'punch' && Math.random() < 0.15) {
            spawnParticles(this.x, this.y, 1, this.color);
        }

        return this.life <= 0;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        CTX.save();
        CTX.translate(screen.x, screen.y);

        // ════════════════════════════════════════════════
        // HEAT WAVE (Auto — หมัดพุ่งออกมาจากสแตนด์)
        // ════════════════════════════════════════════════
        if (this.kind === 'heatwave') {
            CTX.rotate(this.angle);

            const now = performance.now();
            // ── ลำแสงพลังงานลากหลังหมัด ─────────────────
            const trailLen = 36;
            const trailG = CTX.createLinearGradient(-trailLen, 0, 0, 0);
            trailG.addColorStop(0, 'rgba(220,38,38,0)');
            trailG.addColorStop(0.5, 'rgba(239,68,68,0.25)');
            trailG.addColorStop(1, 'rgba(251,113,133,0.55)');
            CTX.globalAlpha = 0.9;
            CTX.strokeStyle = trailG;
            CTX.lineWidth = 12;
            CTX.lineCap = 'round';
            CTX.shadowBlur = 18; CTX.shadowColor = '#dc2626';
            CTX.beginPath(); CTX.moveTo(-trailLen, -4); CTX.lineTo(-4, -4); CTX.stroke();
            CTX.beginPath(); CTX.moveTo(-trailLen + 6, 4); CTX.lineTo(-4, 4); CTX.stroke();

            // ── กำปั้น: ฝ่ามือ (Palm) ────────────────────
            CTX.globalAlpha = 0.97;
            const palmG = CTX.createLinearGradient(-10, -13, 14, 13);
            palmG.addColorStop(0, '#fff1f2');
            palmG.addColorStop(0.35, '#fb7185');
            palmG.addColorStop(1, '#be123c');
            CTX.fillStyle = palmG;
            CTX.shadowBlur = 22; CTX.shadowColor = '#f97316';
            CTX.beginPath(); CTX.roundRect(-9, -12, 17, 24, [3, 5, 5, 3]); CTX.fill();

            // ── กำปั้น: แนวนิ้ว 4 นิ้ว (Knuckles) ────────
            CTX.shadowBlur = 0;
            CTX.fillStyle = '#fff1f2';
            CTX.strokeStyle = '#9f1239'; CTX.lineWidth = 1.2;
            for (let k = 0; k < 4; k++) {
                CTX.beginPath();
                CTX.roundRect(6, -11 + k * 6, 9, 5, [2, 3, 2, 1]);
                CTX.fill(); CTX.stroke();
            }

            // ── แสง crit/heat ที่ข้อนิ้ว ─────────────────
            const kGlow = 0.6 + Math.sin(now / 60) * 0.4;
            CTX.globalAlpha = kGlow;
            CTX.fillStyle = '#fbbf24';
            CTX.shadowBlur = 14; CTX.shadowColor = '#f97316';
            CTX.beginPath(); CTX.arc(10, -8, 3.5, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.arc(10, 4, 3.5, 0, Math.PI * 2); CTX.fill();

            // ── หัวแม่มือ (Thumb) ─────────────────────────
            CTX.globalAlpha = 0.92;
            CTX.shadowBlur = 0;
            CTX.fillStyle = '#fb7185';
            CTX.strokeStyle = '#9f1239'; CTX.lineWidth = 1;
            CTX.beginPath(); CTX.roundRect(-4, 11, 13, 6, 3); CTX.fill(); CTX.stroke();

            // ── วงแหวนพลังงาน (Impact ring) ──────────────
            const ringPhase = (now / 80) % (Math.PI * 2);
            CTX.globalAlpha = 0.45 + Math.sin(ringPhase) * 0.25;
            CTX.strokeStyle = '#fca5a5';
            CTX.lineWidth = 2;
            CTX.shadowBlur = 12; CTX.shadowColor = '#dc2626';
            CTX.beginPath(); CTX.arc(8, 0, 16 + Math.sin(ringPhase) * 3, -Math.PI * 0.4, Math.PI * 0.4); CTX.stroke();

            CTX.restore();
            return;
        }

        // ════════════════════════════════════════════════
        // WANCHAI PUNCH (Actual Fist Model)
        // ════════════════════════════════════════════════
        if (this.kind === 'punch') {
            CTX.rotate(this.angle);
            CTX.shadowBlur = 20; CTX.shadowColor = this.color;

            // Motion trails / Steam
            CTX.globalAlpha = 0.5;
            CTX.strokeStyle = this.color; CTX.lineWidth = 3;
            CTX.beginPath(); CTX.moveTo(-20, -10); CTX.lineTo(5, -10); CTX.stroke();
            CTX.beginPath(); CTX.moveTo(-25, 10); CTX.lineTo(5, 10); CTX.stroke();

            // Core Fist Base (Palm)
            CTX.globalAlpha = 0.95;
            const fg = CTX.createLinearGradient(-10, -12, 12, 12);
            fg.addColorStop(0, '#fff1f2');
            fg.addColorStop(0.4, '#fb7185');
            fg.addColorStop(1, '#be123c');
            CTX.fillStyle = fg;
            CTX.beginPath(); CTX.roundRect(-8, -12, 16, 24, 4); CTX.fill();

            // The 4 Knuckles (Front)
            CTX.fillStyle = '#fff1f2';
            CTX.strokeStyle = '#9f1239'; CTX.lineWidth = 1.5;
            for (let k = 0; k < 4; k++) {
                CTX.beginPath();
                CTX.roundRect(6, -11 + (k * 6), 8, 4.5, 2);
                CTX.fill(); CTX.stroke();
            }

            // The Thumb (Bottom side)
            CTX.fillStyle = '#fb7185';
            CTX.beginPath(); CTX.roundRect(-2, 10, 12, 6, 3); CTX.fill(); CTX.stroke();

            // Tech/Glow accents on the glove
            CTX.shadowBlur = 10; CTX.shadowColor = '#facc15';
            CTX.fillStyle = '#facc15';
            CTX.beginPath(); CTX.arc(-2, 0, 3.5, 0, Math.PI * 2); CTX.fill();

            CTX.restore();
            return;
        }

        // ════════════════════════════════════════════════
        // PLAYER PROJECTILES — weapon-specific art
        // Routing priority: isPoom > weaponKind > color-derived
        // isGolden = Ambush break / Weapon Master buff (color #facc15)
        // isCharged = Weapon Master charged sniper release (symbol '∑')
        // ════════════════════════════════════════════════
        if (this.isPoom) {
            // ── POOM — Enchanted Rice Cluster (always, regardless of isCrit/symbol) ──
            CTX.rotate(this.angle);
            const r = this.isCrit ? 11 : 7.5;
            const now = performance.now();
            // emerald magic trail
            for (let ti = 0; ti < 5; ti++) {
                const td = (ti + 1) * (r * 0.65);
                const tR = r * (0.38 - ti * 0.055);
                if (tR <= 0) continue;
                CTX.globalAlpha = (1 - ti / 5) * 0.5;
                const wispG = CTX.createRadialGradient(-td, 0, 0, -td, 0, tR);
                wispG.addColorStop(0, '#34d399'); wispG.addColorStop(1, 'rgba(16,185,129,0)');
                CTX.fillStyle = wispG;
                CTX.shadowBlur = 8; CTX.shadowColor = '#10b981';
                CTX.beginPath(); CTX.arc(-td, 0, tR, 0, Math.PI * 2); CTX.fill();
            }
            CTX.shadowBlur = 0;
            CTX.globalAlpha = 0.18; CTX.fillStyle = '#6ee7b7';
            CTX.shadowBlur = 18; CTX.shadowColor = '#10b981';
            CTX.beginPath(); CTX.arc(0, 0, r * 1.65, 0, Math.PI * 2); CTX.fill();
            CTX.shadowBlur = 0;
            const poomGrains = [
                [0, 0, r], [-r * 0.65, -r * 0.42, r * 0.72], [r * 0.55, -r * 0.48, r * 0.68],
                [-r * 0.48, r * 0.55, r * 0.63], [r * 0.38, r * 0.52, r * 0.58],
            ];
            CTX.globalAlpha = 1; CTX.shadowBlur = 10; CTX.shadowColor = '#fbbf24';
            for (const [gx, gy, gr] of poomGrains) {
                const gGrad = CTX.createRadialGradient(gx - gr * 0.25, gy - gr * 0.25, 0, gx, gy, gr);
                gGrad.addColorStop(0, '#fffbeb'); gGrad.addColorStop(0.55, '#fde68a'); gGrad.addColorStop(1, '#d97706');
                CTX.fillStyle = gGrad;
                CTX.beginPath(); CTX.arc(gx, gy, gr, 0, Math.PI * 2); CTX.fill();
            }
            CTX.shadowBlur = 0;
            const veinPulse = 0.5 + Math.sin(now / 180) * 0.5;
            CTX.globalAlpha = 0.3 + veinPulse * 0.3; CTX.fillStyle = '#6ee7b7';
            CTX.shadowBlur = 5; CTX.shadowColor = '#10b981';
            CTX.beginPath(); CTX.arc(-r * 0.18, -r * 0.2, r * 0.22, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.arc(r * 0.25, r * 0.15, r * 0.18, 0, Math.PI * 2); CTX.fill();
            CTX.shadowBlur = 0;
            if (this.isCrit) {
                CTX.globalAlpha = 0.85;
                CTX.strokeStyle = '#facc15'; CTX.lineWidth = 1.8;
                CTX.shadowBlur = 22; CTX.shadowColor = '#facc15';
                CTX.beginPath(); CTX.arc(0, 0, r + 7, 0, Math.PI * 2); CTX.stroke();
                CTX.strokeStyle = '#fef08a'; CTX.lineWidth = 1; CTX.shadowBlur = 10;
                for (let si = 0; si < 8; si++) {
                    const sa = (si / 8) * Math.PI * 2;
                    CTX.globalAlpha = 0.6 + Math.sin(now / 120 + si) * 0.3;
                    CTX.beginPath();
                    CTX.moveTo(Math.cos(sa) * (r + 3), Math.sin(sa) * (r + 3));
                    CTX.lineTo(Math.cos(sa) * (r + 11), Math.sin(sa) * (r + 11)); CTX.stroke();
                }
            }

        } else if (this.team === 'player') {
            CTX.rotate(this.angle);
            const now = performance.now();

            // ── Determine effective weapon and visual state ────────────────
            // weaponKind tagged at spawn; fall back to color-derived guess
            const wk = this.weaponKind ||
                (this.color === '#3b82f6' ? 'auto' :
                    this.color === '#f59e0b' ? 'shotgun' :
                        this.color === '#ef4444' ? 'sniper' : 'auto');
            // isGolden: Ambush break OR Weapon Master buff (color forced to #facc15)
            const isGolden = (this.color === '#facc15');
            // isCharged: Weapon Master charged sniper release (symbol '∑', sniper only)
            const isCharged = (this.symbol === '∑' && wk === 'sniper');

            // ── AUTO RIFLE — Plasma Tracer with holo rings ────────────────
            if (wk === 'auto') {
                // base color: blue unless golden
                const coreColor = isGolden ? '#facc15' : (this.isCrit ? '#facc15' : '#93c5fd');
                const glowColor = isGolden ? '#f59e0b' : (this.isCrit ? '#facc15' : '#60a5fa');
                const trailColor = isGolden ? 'rgba(251,191,36,' : 'rgba(59,130,246,';
                const trailLen = (this.isCrit || isGolden) ? 28 : 18;
                const coreW = (this.isCrit || isGolden) ? 4 : 2.5;

                const trailGrad = CTX.createLinearGradient(-trailLen, 0, 0, 0);
                trailGrad.addColorStop(0, 'rgba(0,0,0,0)');
                trailGrad.addColorStop(0.6, `${trailColor}0.2)`);
                trailGrad.addColorStop(1, `${trailColor}0.55)`);
                CTX.globalAlpha = 1;
                CTX.strokeStyle = trailGrad; CTX.lineWidth = coreW + 6; CTX.lineCap = 'butt';
                CTX.beginPath(); CTX.moveTo(-trailLen, 0); CTX.lineTo(0, 0); CTX.stroke();

                CTX.strokeStyle = coreColor; CTX.lineWidth = coreW;
                CTX.shadowBlur = (this.isCrit || isGolden) ? 22 : 14; CTX.shadowColor = glowColor;
                CTX.beginPath(); CTX.moveTo(-trailLen * 0.5, 0); CTX.lineTo(5, 0); CTX.stroke();

                CTX.fillStyle = '#ffffff';
                CTX.shadowBlur = 16; CTX.shadowColor = glowColor;
                CTX.beginPath(); CTX.arc(5, 0, coreW * 0.85, 0, Math.PI * 2); CTX.fill();
                CTX.shadowBlur = 0;

                if (isGolden) {
                    // golden shimmer rings — weapon master signature
                    const ringAngle = (now / 80) % (Math.PI * 2);
                    CTX.globalAlpha = 0.7;
                    CTX.strokeStyle = '#facc15'; CTX.lineWidth = 1;
                    CTX.shadowBlur = 10; CTX.shadowColor = '#facc15';
                    CTX.beginPath(); CTX.ellipse(0, 0, 8, 4, ringAngle, 0, Math.PI * 2); CTX.stroke();
                    CTX.globalAlpha = 0.45;
                    CTX.strokeStyle = '#fde68a'; CTX.lineWidth = 0.7;
                    CTX.beginPath(); CTX.ellipse(0, 0, 11, 3, -ringAngle * 0.7, 0, Math.PI * 2); CTX.stroke();
                } else if (this.isCrit) {
                    CTX.globalAlpha = 0.7;
                    CTX.strokeStyle = '#facc15'; CTX.lineWidth = 1;
                    CTX.shadowBlur = 10; CTX.shadowColor = '#facc15';
                    for (let sp = 0; sp < 6; sp++) {
                        const sa = (sp / 6) * Math.PI * 2;
                        CTX.beginPath();
                        CTX.moveTo(Math.cos(sa) * 5, Math.sin(sa) * 5);
                        CTX.lineTo(Math.cos(sa) * 10, Math.sin(sa) * 10); CTX.stroke();
                    }
                } else {
                    // normal holo rings
                    const ringAngle = (now / 120) % (Math.PI * 2);
                    CTX.globalAlpha = 0.55;
                    CTX.strokeStyle = '#7dd3fc'; CTX.lineWidth = 0.8;
                    CTX.beginPath(); CTX.ellipse(0, 0, 7, 3.5, ringAngle, 0, Math.PI * 2); CTX.stroke();
                    CTX.globalAlpha = 0.35;
                    CTX.strokeStyle = '#bfdbfe'; CTX.lineWidth = 0.7;
                    CTX.beginPath(); CTX.ellipse(0, 0, 9, 2.5, -ringAngle * 0.7, 0, Math.PI * 2); CTX.stroke();
                }

                // ── SHOTGUN — Molten Shrapnel ─────────────────────────────────
            } else if (wk === 'shotgun') {
                const sz = (this.isCrit || isGolden) ? 7 : 5;
                const glowColor = isGolden ? '#facc15' : '#f97316';

                CTX.globalAlpha = 0.3;
                CTX.fillStyle = isGolden ? '#facc15' : '#fbbf24';
                CTX.shadowBlur = 14; CTX.shadowColor = glowColor;
                CTX.beginPath(); CTX.ellipse(-sz, 0, sz * 2, sz, 0, 0, Math.PI * 2); CTX.fill();
                CTX.shadowBlur = 0;

                CTX.globalAlpha = 1;
                const shardG = CTX.createLinearGradient(-sz, -sz, sz, sz);
                if (isGolden) {
                    shardG.addColorStop(0, '#fef9c3'); shardG.addColorStop(0.4, '#facc15'); shardG.addColorStop(1, '#b45309');
                } else {
                    shardG.addColorStop(0, '#fef3c7'); shardG.addColorStop(0.4, '#f59e0b'); shardG.addColorStop(1, '#c2410c');
                }
                CTX.fillStyle = shardG;
                CTX.shadowBlur = (this.isCrit || isGolden) ? 22 : 10; CTX.shadowColor = glowColor;
                CTX.beginPath();
                CTX.moveTo(sz * 1.4, 0); CTX.lineTo(sz * 0.4, -sz * 1.1);
                CTX.lineTo(-sz * 0.5, -sz * 0.6); CTX.lineTo(-sz * 1.2, 0.5);
                CTX.lineTo(-sz * 0.4, sz * 0.9); CTX.lineTo(sz * 0.7, sz * 0.5);
                CTX.closePath(); CTX.fill();

                CTX.fillStyle = isGolden ? '#fef9c3' : '#fffbeb';
                CTX.shadowBlur = 8; CTX.shadowColor = glowColor;
                CTX.beginPath(); CTX.arc(0, 0, sz * 0.45, 0, Math.PI * 2); CTX.fill();
                CTX.shadowBlur = 0;

                CTX.globalAlpha = 0.7;
                CTX.fillStyle = isGolden ? '#facc15' : '#fbbf24';
                CTX.beginPath(); CTX.arc(-sz * 1.5, 1, 1.2, 0, Math.PI * 2); CTX.fill();
                CTX.globalAlpha = 0.42;
                CTX.beginPath(); CTX.arc(-sz * 2.1, -1.5, 0.9, 0, Math.PI * 2); CTX.fill();
                CTX.globalAlpha = 0.25;
                CTX.beginPath(); CTX.arc(-sz * 2.8, 0.5, 0.7, 0, Math.PI * 2); CTX.fill();

                if (this.isCrit || isGolden) {
                    CTX.globalAlpha = 0.85;
                    CTX.strokeStyle = '#facc15'; CTX.lineWidth = 1.5;
                    CTX.shadowBlur = 18; CTX.shadowColor = '#facc15';
                    CTX.beginPath(); CTX.arc(0, 0, sz + 5, 0, Math.PI * 2); CTX.stroke();
                }

                // ── SNIPER — charged golden lance (Weapon Master release) ─────
            } else if (wk === 'sniper' && isCharged) {
                CTX.globalAlpha = 0.25;
                CTX.fillStyle = '#facc15';
                CTX.beginPath(); CTX.ellipse(-16, 0, 22, 8, 0, 0, Math.PI * 2); CTX.fill();
                CTX.globalAlpha = 1;
                const cg = CTX.createLinearGradient(-28, 0, 6, 0);
                cg.addColorStop(0, 'rgba(251,191,36,0)'); cg.addColorStop(0.55, '#facc15'); cg.addColorStop(1, '#ffffff');
                CTX.strokeStyle = cg; CTX.lineWidth = 6; CTX.lineCap = 'round';
                CTX.shadowBlur = 28; CTX.shadowColor = '#facc15';
                CTX.beginPath(); CTX.moveTo(-28, 0); CTX.lineTo(6, 0); CTX.stroke();
                // energy rings
                CTX.strokeStyle = '#fde68a'; CTX.lineWidth = 1.2; CTX.shadowBlur = 8;
                for (let ri = -20; ri < 4; ri += 8) {
                    const ra = Math.max(0, (28 + ri) / 34);
                    CTX.globalAlpha = ra * 0.5;
                    CTX.beginPath(); CTX.arc(ri, 0, 4 + ra * 3, 0, Math.PI * 2); CTX.stroke();
                }
                CTX.shadowBlur = 0;

                // ── SNIPER — Railgun Needle (normal + golden ambush variant) ──
            } else if (wk === 'sniper') {
                const needleLen = (this.isCrit || isGolden) ? 38 : 28;
                const needleW = (this.isCrit || isGolden) ? 2.2 : 1.4;
                const needleColor = isGolden ? '#facc15' : (this.isCrit ? '#facc15' : '#ef4444');
                const glowColor = isGolden ? '#f59e0b' : (this.isCrit ? '#facc15' : '#ef4444');
                const coneColor = isGolden ? '#fde68a' : '#fca5a5';

                const coneCount = 3;
                for (let ci = 0; ci < coneCount; ci++) {
                    const coneLen = needleLen * (0.45 + ci * 0.2);
                    const coneW = (3 + ci * 2.5) * ((this.isCrit || isGolden) ? 1.4 : 1);
                    CTX.globalAlpha = 0.12 - ci * 0.03;
                    CTX.fillStyle = coneColor;
                    CTX.beginPath();
                    CTX.moveTo(-coneLen * 0.15, 0); CTX.lineTo(-coneLen, -coneW); CTX.lineTo(-coneLen, coneW);
                    CTX.closePath(); CTX.fill();
                }

                CTX.globalAlpha = 0.35;
                const wakeGrad = CTX.createLinearGradient(-needleLen, 0, 0, 0);
                wakeGrad.addColorStop(0, 'rgba(0,0,0,0)');
                wakeGrad.addColorStop(1, isGolden ? 'rgba(251,191,36,0.6)' : 'rgba(252,165,165,0.6)');
                CTX.strokeStyle = wakeGrad; CTX.lineWidth = needleW + 4; CTX.lineCap = 'butt';
                CTX.beginPath(); CTX.moveTo(-needleLen, 0); CTX.lineTo(0, 0); CTX.stroke();

                CTX.globalAlpha = 1;
                const needleGrad = CTX.createLinearGradient(-needleLen, 0, needleLen * 0.15, 0);
                needleGrad.addColorStop(0, isGolden ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)');
                needleGrad.addColorStop(0.7, needleColor);
                needleGrad.addColorStop(1, '#ffffff');
                CTX.strokeStyle = needleGrad; CTX.lineWidth = needleW;
                CTX.shadowBlur = (this.isCrit || isGolden) ? 24 : 16; CTX.shadowColor = glowColor;
                CTX.lineCap = 'round';
                CTX.beginPath(); CTX.moveTo(-needleLen, 0); CTX.lineTo(needleLen * 0.12, 0); CTX.stroke();

                // sharp tip — rounded dot, NO arrow-head
                CTX.fillStyle = '#ffffff';
                CTX.shadowBlur = 12; CTX.shadowColor = glowColor;
                CTX.beginPath(); CTX.arc(needleLen * 0.12, 0, needleW * 1.1, 0, Math.PI * 2); CTX.fill();
                CTX.shadowBlur = 0;

                if (this.isCrit || isGolden) {
                    CTX.globalAlpha = 0.5;
                    CTX.strokeStyle = '#facc15'; CTX.lineWidth = 0.8;
                    for (let ri = -24; ri < 0; ri += 9) {
                        CTX.beginPath(); CTX.arc(ri, 0, 3.5, 0, Math.PI * 2); CTX.stroke();
                    }
                }

                // ── FALLBACK (unknown weaponKind) — glowing dot, no arrow ─────
            } else {
                const fw = (this.isCrit || isGolden) ? 5 : 3.5;
                CTX.fillStyle = isGolden ? '#facc15' : (this.color || '#ffffff');
                CTX.shadowBlur = (this.isCrit || isGolden) ? 20 : 10;
                CTX.shadowColor = isGolden ? '#facc15' : this.color;
                CTX.beginPath(); CTX.arc(0, 0, fw, 0, Math.PI * 2); CTX.fill();
                CTX.shadowBlur = 0;
            }

            // ════════════════════════════════════════════════
            // NOTE: Poom branch above handles isPoom flag.
            // Old color-only Poom check removed — routing now
            // uses isPoom flag set at spawn (shootPoom / PoomPlayer.shoot).
            // ════════════════════════════════════════════════
        } else if (this.team === 'player' && false) {
            // dead branch — kept as merge anchor, never executes
            void 0;

            // ════════════════════════════════════════════════
            // ENEMY / FALLBACK — math symbol
            // ════════════════════════════════════════════════
        } else if (!this.isPoom) {
            CTX.rotate(this.angle);
            CTX.shadowBlur = 10; CTX.shadowColor = this.color;
            CTX.fillStyle = this.color;
            CTX.font = `bold ${this.size}px monospace`;
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(this.symbol, 0, 0);
        }

        CTX.restore();
    }

    checkCollision(entity) {
        const r = (this.radius !== undefined) ? this.radius : 10;
        return circleCollision(this.x, this.y, r, entity.x, entity.y, entity.radius);
    }
}
// ============================================================================
// 🚀 END PROJECTILE CLASS
// ============================================================================


class WeaponSystem {
    constructor() {
        this.currentWeapon = 'auto';
        this.weaponCooldown = 0;
        this.weaponsUsed = new Set(['auto']);

        this.activeChar = 'kao';

        // Burst fire state
        this.maxBurst = 3;
        this.burstDelay = 0.08;
        this.burstTimer = 0;
        this.isBursting = false;
        this.pendingBurstShots = 0;
    }

    setActiveChar(charType) {
        this.activeChar = charType || 'kao';
    }

    getCharWeapons() {
        const charData = BALANCE.characters[this.activeChar];

        if (!charData) {
            console.warn(`[WeaponSystem] Unknown char "${this.activeChar}". Falling back to kao.`);
            return BALANCE.characters.kao.weapons;
        }

        if (charData.weapons) return charData.weapons;

        const S = charData;
        const riceWeapon = {
            name: '🍙 ข้าวเหนียว',
            damage: S.riceDamage ?? 42.5,
            cooldown: S.riceCooldown ?? 0.46,
            range: S.riceRange ?? 750,
            speed: S.riceSpeed ?? 600,
            spread: 0,
            pellets: 1,
            color: S.riceColor ?? '#ffffff',
            icon: '🍙'
        };
        return { auto: riceWeapon, sniper: riceWeapon, shotgun: riceWeapon };
    }

    switchWeapon() {
        const weapons = ['auto', 'sniper', 'shotgun'];
        const idx = weapons.indexOf(this.currentWeapon);
        this.currentWeapon = weapons[(idx + 1) % 3];
        this.weaponsUsed.add(this.currentWeapon);
        this.updateWeaponUI();
        Audio.playWeaponSwitch();
        Achievements.stats.weaponsUsed = this.weaponsUsed;
        if (this.weaponsUsed.size >= 3) Achievements.check('weapon_master');
    }

    updateWeaponUI() {
        try {
            if (this.activeChar === 'poom') {
                const nameEl = document.getElementById('weapon-name');
                if (nameEl) { nameEl.textContent = '🍙 ข้าวเหนียว'; nameEl.style.color = '#ffffff'; }
                return;
            }

            if (this.activeChar === 'auto') {
                const nameEl = document.getElementById('weapon-name');
                if (nameEl) { nameEl.textContent = '🔥 HEAT WAVE'; nameEl.style.color = '#dc2626'; }
                return;
            }

            const weapons = this.getCharWeapons();
            const weaponData = weapons[this.currentWeapon];
            if (!weaponData) {
                console.warn(`[WeaponSystem] Weapon "${this.currentWeapon}" not in char "${this.activeChar}".`);
                return;
            }
            const nameEl = document.getElementById('weapon-name');
            if (nameEl) { nameEl.textContent = weaponData.name; nameEl.style.color = weaponData.color; }
        } catch (err) {
            console.error('[WeaponSystem] updateWeaponUI failed:', err);
        }
    }

    getCurrentWeapon() { return this.currentWeapon; }

    getWeaponData() {
        return this.getCharWeapons()[this.currentWeapon];
    }

    update(dt) {
        if (this.weaponCooldown > 0) this.weaponCooldown -= dt;

        if (this.isBursting && this.burstTimer > 0) {
            this.burstTimer -= dt;
            if (this.burstTimer <= 0 && this.pendingBurstShots > 0) {
                this.pendingBurstShots--;
                if (this.pendingBurstShots > 0) {
                    this.burstTimer = this.burstDelay;
                } else {
                    this.isBursting = false;
                    this.weaponCooldown = this.getCharWeapons().auto.cooldown;
                }
            }
        }
    }

    canShoot() { return this.weaponCooldown <= 0 && !this.isBursting; }

    shoot(player, damageMultiplier = 1) {
        if (!this.canShoot()) return [];
        const projectiles = [];

        if (this.currentWeapon === 'auto') {
            projectiles.push(...this.shootSingle(player, damageMultiplier));
            this.isBursting = true;
            this.burstTimer = this.burstDelay;
            this.pendingBurstShots = this.maxBurst - 1;
        } else {
            projectiles.push(...this.shootSingle(player, damageMultiplier));
            this.weaponCooldown = this.getWeaponData().cooldown;
        }
        return projectiles;
    }

    updateBurst(player, damageMultiplier = 1) {
        if (!this.isBursting || this.burstTimer > 0 || this.pendingBurstShots <= 0) return [];
        const shot = this.shootSingle(player, damageMultiplier);
        this.burstTimer = this.burstDelay;
        this.pendingBurstShots--;
        if (this.pendingBurstShots <= 0) {
            this.isBursting = false;
            this.weaponCooldown = this.getCharWeapons().auto.cooldown;
        }
        return shot;
    }

    shootSingle(player, damageMultiplier = 1) {
        const weapon = this.getWeaponData();
        const projectiles = [];

        let baseDamage = weapon.damage * damageMultiplier;
        const damageResult = player.dealDamage(baseDamage);
        let damage = damageResult.damage;
        let isCrit = damageResult.isCrit;
        let color = weapon.color;

        if (player.ambushReady) {
            const critMult = BALANCE.characters[this.activeChar]?.critMultiplier ?? 2.5;
            damage *= critMult;
            isCrit = true; color = '#facc15';
            player.ambushReady = false; player.breakStealth();
            spawnParticles(player.x, player.y, 15, '#facc15');
            Achievements.stats.crits++;
            Achievements.check('crit_master');
        } else if (player.isInvisible) {
            player.breakStealth();
        }

        if (player.onGraph) {
            damage *= 1.67;
            if (!isCrit) color = '#f59e0b';
            spawnFloatingText(GAME_TEXTS.combat.highGround, player.x, player.y - 40, '#f59e0b', 16);
        }

        damage *= player.damageMultiplier || 1.0;

        const offset = 28;
        for (let i = 0; i < weapon.pellets; i++) {
            const spread = (Math.random() - 0.5) * weapon.spread;
            const angle = player.angle + spread;
            const sx = player.x + Math.cos(angle) * offset;
            const sy = player.y + Math.sin(angle) * offset;

            let projOptions = {};
            if (this.currentWeapon === 'sniper') {
                projOptions.bounces = 2;
                projOptions.life = 5;
            } else if (this.currentWeapon === 'shotgun') {
                projOptions.bounces = 1;
                projOptions.life = 2.5;
            }

            const p = new Projectile(sx, sy, angle, weapon.speed, damage / weapon.pellets, color, isCrit, 'player', projOptions);
            p.weaponKind = this.currentWeapon;
            projectiles.push(p);
        }

        player.vx -= Math.cos(player.angle) * 50;
        player.vy -= Math.sin(player.angle) * 50;

        // 🔫 Battle Scars: ดีดปลอกกระสุน (auto / sniper / shotgun เท่านั้น)
        if (typeof shellCasingSystem !== 'undefined' &&
            (this.currentWeapon === 'auto' || this.currentWeapon === 'sniper' || this.currentWeapon === 'shotgun')) {
            const shellCount = this.currentWeapon === 'shotgun' ? 3 : 1;
            const shellSpeed = this.currentWeapon === 'sniper' ? 160 : 120;
            for (let _s = 0; _s < shellCount; _s++) {
                shellCasingSystem.spawn(player.x, player.y, player.angle, shellSpeed);
            }
        }

        Audio.playShoot(this.currentWeapon);
        return projectiles;
    }

    drawWeaponOnPlayer(player) {
        CTX.save();
        CTX.translate(15, 10);
        CTX.fillStyle = 'rgba(0, 0, 0, 0.3)';
        CTX.fillRect(2, 2, 26, 10);
        drawKaoGunEnhanced(CTX, this.currentWeapon, !!(player && player.isWeaponMaster));
        CTX.restore();
    }

    drawAutoRifle(weapon) {
        const g = CTX.createLinearGradient(0, -6, 0, 6);
        g.addColorStop(0, '#2563eb'); g.addColorStop(0.5, '#3b82f6'); g.addColorStop(1, '#1e40af');
        CTX.fillStyle = g; CTX.fillRect(0, -5, 24, 10);
        CTX.fillStyle = '#1e293b'; CTX.fillRect(4, -7, 16, 2);
        CTX.fillStyle = '#334155'; CTX.fillRect(8, 2, 6, 8);
        CTX.fillStyle = '#0f172a'; CTX.fillRect(20, -2, 8, 4);
        CTX.fillStyle = '#60a5fa'; CTX.shadowBlur = 8; CTX.shadowColor = '#60a5fa';
        CTX.fillRect(27, -1, 2, 2); CTX.shadowBlur = 0;
        CTX.fillStyle = '#1e40af'; CTX.fillRect(-6, -3, 8, 6);
        CTX.fillStyle = '#1e293b'; CTX.fillRect(10, 5, 4, 6);
        CTX.strokeStyle = '#60a5fa'; CTX.lineWidth = 1;
        CTX.strokeRect(2, -4, 4, 8); CTX.strokeRect(14, -4, 4, 8);
        CTX.fillStyle = '#fff'; CTX.font = 'bold 5px Arial'; CTX.textAlign = 'center'; CTX.fillText('MTC', 12, 1);
    }

    drawSniper(weapon) {
        const g = CTX.createLinearGradient(0, -5, 0, 5);
        g.addColorStop(0, '#dc2626'); g.addColorStop(0.5, '#ef4444'); g.addColorStop(1, '#991b1b');
        CTX.fillStyle = g; CTX.fillRect(0, -4, 28, 8);
        CTX.fillStyle = '#1e293b'; CTX.fillRect(10, -10, 8, 5);
        CTX.fillStyle = '#3b82f6'; CTX.shadowBlur = 10; CTX.shadowColor = '#3b82f6';
        CTX.beginPath(); CTX.arc(14, -7, 2, 0, Math.PI * 2); CTX.fill(); CTX.shadowBlur = 0;
        CTX.fillStyle = '#0f172a'; CTX.fillRect(24, -2, 12, 4);
        CTX.fillStyle = '#ef4444'; CTX.shadowBlur = 12; CTX.shadowColor = '#ef4444';
        CTX.fillRect(35, -1, 2, 2); CTX.shadowBlur = 0;
        CTX.fillStyle = '#7c2d12'; CTX.fillRect(-8, -2, 10, 4);
        CTX.strokeStyle = '#475569'; CTX.lineWidth = 2;
        CTX.beginPath(); CTX.moveTo(20, 4); CTX.lineTo(18, 10); CTX.moveTo(22, 4); CTX.lineTo(24, 10); CTX.stroke();
        CTX.fillStyle = '#fff'; CTX.font = 'bold 4px Arial'; CTX.textAlign = 'center'; CTX.fillText('SNIPER', 14, 1);
    }

    drawShotgun(weapon) {
        const g = CTX.createLinearGradient(0, -6, 0, 6);
        g.addColorStop(0, '#ea580c'); g.addColorStop(0.5, '#f59e0b'); g.addColorStop(1, '#c2410c');
        CTX.fillStyle = g; CTX.fillRect(0, -6, 22, 12);
        CTX.fillStyle = '#78350f'; CTX.fillRect(8, -4, 6, 8);
        CTX.fillStyle = '#0f172a'; CTX.fillRect(18, -4, 10, 8);
        CTX.fillStyle = '#1e293b'; CTX.fillRect(27, -3, 2, 6);
        CTX.fillStyle = '#fb923c'; CTX.shadowBlur = 10; CTX.shadowColor = '#f59e0b';
        CTX.beginPath(); CTX.arc(29, 0, 2, 0, Math.PI * 2); CTX.fill(); CTX.shadowBlur = 0;
        CTX.fillStyle = '#92400e'; CTX.fillRect(-8, -4, 10, 8);
        CTX.strokeStyle = '#78350f'; CTX.lineWidth = 1;
        for (let i = -6; i < 2; i += 2) { CTX.beginPath(); CTX.moveTo(-8, i); CTX.lineTo(-2, i); CTX.stroke(); }
        CTX.fillStyle = '#dc2626';
        CTX.fillRect(4, -7, 3, 2); CTX.fillRect(10, -7, 3, 2); CTX.fillRect(16, -7, 3, 2);
        CTX.fillStyle = '#fff'; CTX.font = 'bold 4px Arial'; CTX.textAlign = 'center'; CTX.fillText('12G', 11, 1);
    }
}

// ============================================================================
// 🗺️ SPATIAL GRID — O(P×k) collision broadphase (replaces O(P×E) brute force)
// ============================================================================
/**
 * SpatialGrid
 *
 * Divides the game world into fixed-size cells (CELL = 128 px).
 * Enemies are inserted every frame; each projectile then queries only the
 * 3×3 neighbourhood of cells it overlaps — typically 3–8 enemies instead
 * of the full list.
 *
 * Complexity:
 *   Build  : O(E)       — one Map.set per enemy
 *   Query  : O(1)       — up to 9 cell lookups, each O(k), k = avg enemies/cell
 *   Total  : O(E + P×k) vs O(P×E) brute force
 *
 * At P=40, E=60, k≈4 → ~200 checks/frame vs ~2400 checks/frame (12× faster).
 *
 * Usage (ProjectileManager.update, called every frame):
 *   const grid = new SpatialGrid();
 *   grid.build(enemies);
 *   const candidates = grid.query(proj.x, proj.y, proj.radius);
 */
class SpatialGrid {
    // Cell size must be ≥ the largest collision radius in the game.
    // Enemy radius ≈ 20 px, projectile radius ≤ 18 px → 128 is safely larger.
    static CELL = 128;

    constructor() {
        // Plain object used as a hash map: key = "cx,cy" → Enemy[]
        // Reuse the same Map instance across frames to avoid GC pressure.
        this._cells = new Map();
    }

    /** Convert world coordinate to grid cell index (integer). */
    _cellCoord(v) {
        return Math.floor(v / SpatialGrid.CELL);
    }

    /**
     * Populate the grid with the current enemy list.
     * Must be called once per frame before any query().
     * @param {Array} enemies  Live enemy array from GameState
     */
    build(enemies) {
        this._cells.clear();
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e.dead) continue;
            const key = `${this._cellCoord(e.x)},${this._cellCoord(e.y)}`;
            let cell = this._cells.get(key);
            if (!cell) { cell = []; this._cells.set(key, cell); }
            cell.push(e);
        }
    }

    /**
     * Return all enemies in the 3×3 block of cells surrounding (wx, wy).
     * De-duplication is NOT needed here: an enemy can only be in one cell
     * (centre-point insertion), so the 9-cell scan has no duplicates.
     *
     * Boundary safety: cellCoord clamps naturally — no extra guard needed
     * because the Map simply returns undefined for empty cells.
     *
     * @param {number} wx   Projectile world X
     * @param {number} wy   Projectile world Y
     * @returns {Array}     Flat list of candidate enemies (may be empty)
     */
    query(wx, wy) {
        const cx = this._cellCoord(wx);
        const cy = this._cellCoord(wy);
        const results = [];

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const cell = this._cells.get(`${cx + dx},${cy + dy}`);
                if (cell) {
                    for (let i = 0; i < cell.length; i++) results.push(cell[i]);
                }
            }
        }
        return results;
    }
}

// ============================================================================
// 🚀 PROJECTILE MANAGER — with Hit-Stop + Screen Shake on impact
// ============================================================================
class ProjectileManager {
    constructor() {
        this.projectiles = [];
        // Spatial grid — reused every frame to avoid allocation churn
        this._grid = new SpatialGrid();
    }

    add(projectile) {
        if (Array.isArray(projectile)) this.projectiles.push(...projectile);
        else if (projectile) this.projectiles.push(projectile);
    }

    update(dt, player, enemies, boss) {
        // ── PERF: build spatial grid once per frame ───────────────────────────
        // O(E) build cost is always cheaper than O(P×E) brute-force scanning.
        // Only player projectiles need the grid; enemy→player checks are 1:1.
        this._grid.build(enemies);

        const projs = this.projectiles;

        // ── PERF: reverse loop + swap-and-pop O(1) removal ───────────────────
        // Iterating backwards means the swap never displaces an unchecked index:
        // when projs[i] is swapped with projs[last] and popped, the new item at
        // index i has already been visited (it came from a higher index that we
        // already processed in a previous iteration).
        for (let i = projs.length - 1; i >= 0; i--) {
            const proj = projs[i];
            const expired = proj.update(dt);
            let hit = false;

            // Ensure hit memory exists for piercing projectiles
            if (proj.pierce > 0 && !proj.hitSet) proj.hitSet = new Set();

            if (proj.team === 'player') {

                // ── PLAYER → BOSS collision ───────────────────────────────────
                if (boss && !boss.dead && proj.checkCollision(boss)) {
                    if (!proj.hitSet || !proj.hitSet.has(boss)) {
                        boss.takeDamage(proj.damage);

                        if (typeof addScreenShake === 'function') addScreenShake(proj.isCrit ? 5 : 2);
                        if (typeof triggerHitStop === 'function') triggerHitStop(proj.isCrit ? 60 : 20);

                        spawnFloatingText(Math.round(proj.damage), proj.x, proj.y - 20, 'white', 18);
                        if (typeof spawnHitMarker === 'function') spawnHitMarker(proj.x, proj.y);
                        if (proj.kind === 'punch' && typeof spawnWanchaiPunchText === 'function') {
                            spawnWanchaiPunchText(proj.x, proj.y);
                        }
                        player.addSpeedBoost();
                        if (proj.pierce > 0) {
                            proj.hitSet?.add(boss);
                            proj.pierce -= 1;
                        } else {
                            hit = true;
                        }
                    }
                }

                // ── PLAYER → ENEMY collision — SPATIAL GRID broadphase ────────
                // Query returns only enemies in the 3×3 cell neighbourhood of
                // the projectile.  Boundary safety is guaranteed by the grid:
                // cells outside the map simply have no entries in the HashMap.
                if (!hit) {
                    const candidates = this._grid.query(proj.x, proj.y);
                    for (let j = 0; j < candidates.length; j++) {
                        const enemy = candidates[j];
                        if (enemy.dead) continue;
                        if (!proj.checkCollision(enemy)) continue;
                        if (proj.hitSet && proj.hitSet.has(enemy)) continue;

                        enemy.takeDamage(proj.damage, player);
                        if (typeof proj.onHit === 'function') proj.onHit(enemy);

                        if (enemy.dead) {
                            if (typeof triggerHitStop === 'function') triggerHitStop(40);
                            if (typeof addScreenShake === 'function') addScreenShake(4);
                        } else if (proj.isCrit) {
                            if (typeof triggerHitStop === 'function') triggerHitStop(30);
                            if (typeof addScreenShake === 'function') addScreenShake(3);
                        }

                        spawnFloatingText(Math.round(proj.damage), proj.x, proj.y - 20, 'white', 16);
                        if (typeof spawnHitMarker === 'function') spawnHitMarker(proj.x, proj.y);
                        if (proj.kind === 'punch' && typeof spawnWanchaiPunchText === 'function') {
                            spawnWanchaiPunchText(proj.x, proj.y);
                        }
                        player.addSpeedBoost();
                        if (proj.pierce > 0) {
                            proj.hitSet?.add(enemy);
                            proj.pierce -= 1;
                        } else {
                            hit = true;
                            break;
                        }
                    }
                }

            } else if (proj.team === 'enemy') {
                if (proj.checkCollision(player) && !player.isInvisible && !player.isFreeStealthy) {
                    player.takeDamage(proj.damage);
                    hit = true;
                }
            }

            if (hit || expired) {
                if (hit) spawnParticles(proj.x, proj.y, 5, proj.color);
                // ── PERF: swap-and-pop O(1) — reverse loop makes this safe ───
                projs[i] = projs[projs.length - 1];
                projs.pop();
            }
        }
    }

    draw() { for (let p of this.projectiles) p.draw(); }
    clear() { this.projectiles = []; }
    getAll() { return this.projectiles; }

    spawnWanchaiPunch(x, y, angle) {
        const a = angle ?? 0;
        const sx = x + Math.cos(a) * 28;
        const sy = y + Math.sin(a) * 28;
        const p = new Projectile(sx, sy, a, 1500, 70, '#fb7185', false, 'player', {
            kind: 'punch',
            life: 0.15,
            size: 18,
            radius: 16,
            pierce: 0
        });
        this.add(p);
    }

    spawnHeatWave(player, angle) {
        const a = angle ?? player?.angle ?? 0;
        const range = player?.stats?.heatWaveRange ?? BALANCE.player?.auto?.heatWaveRange ?? 150;

        // ── BUG-3 FIX: Read base damage from config instead of hardcoding 34.
        const damageBase = player?.stats?.weapons?.auto?.damage
            ?? BALANCE.characters?.auto?.weapons?.auto?.damage
            ?? 34;

        const dmgMult = (player?.damageBoost || 1) * (player?.damageMultiplier || 1);

        let damage = damageBase * dmgMult;
        try {
            if (player && typeof player.dealDamage === 'function') {
                const res = player.dealDamage(damage);
                damage = res?.damage ?? damage;
            }
        } catch (e) { }

        const speed = Math.max(600, range * 9);
        const sx = player.x + Math.cos(a) * 22;
        const sy = player.y + Math.sin(a) * 22;

        const p = new Projectile(sx, sy, a, speed, damage, '#dc2626', false, 'player', {
            kind: 'heatwave',
            life: Math.max(0.12, range / speed) * 3,
            size: 18,
            radius: 18,
            pierce: 2,
            bounces: 3
        });
        this.add(p);
    }
}

var weaponSystem = new WeaponSystem();
var projectileManager = new ProjectileManager();

// ════════════════════════════════════════════════════════════
// 🎨 STANDALONE WEAPON ART FUNCTIONS
// ════════════════════════════════════════════════════════════

function drawPoomWeapon(ctx) {
    const now = performance.now();
    ctx.save();
    ctx.translate(12, 6);

    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(-18, -8);
    ctx.bezierCurveTo(-22, 2, -14, 12, -8, 8);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const bodyGrad = ctx.createLinearGradient(0, -8, 0, 8);
    bodyGrad.addColorStop(0, '#4ade80');
    bodyGrad.addColorStop(0.35, '#16a34a');
    bodyGrad.addColorStop(0.65, '#15803d');
    bodyGrad.addColorStop(1, '#14532d');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath(); ctx.roundRect(-14, -7, 28, 14, 3); ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.roundRect(-14, -7, 28, 14, 3); ctx.clip();

    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
    for (let wx = -28; wx <= 28; wx += 6) {
        ctx.beginPath(); ctx.moveTo(wx, -7); ctx.lineTo(wx + 14, 7); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    for (let wx = -28; wx <= 28; wx += 6) {
        ctx.beginPath(); ctx.moveTo(wx + 14, -7); ctx.lineTo(wx, 7); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.8;
    for (let gy = -5; gy <= 5; gy += 5) {
        ctx.beginPath(); ctx.moveTo(-14, gy); ctx.lineTo(14, gy); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(-14, -7, 28, 5);

    ctx.fillStyle = 'rgba(20,83,45,0.40)';
    for (let dxi = -12; dxi <= 12; dxi += 6) {
        for (let dyi = -5; dyi <= 5; dyi += 5) {
            ctx.beginPath(); ctx.arc(dxi, dyi, 1.2, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.restore();

    const ringPulse = 0.6 + Math.sin(now / 300) * 0.4;
    const ringPositions = [-8, 0, 8];
    for (const rx of ringPositions) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(rx - 1.5, -8, 3, 16);
        ctx.fillStyle = `rgba(0,229,255,${ringPulse * 0.9})`;
        ctx.shadowBlur = 7; ctx.shadowColor = '#00e5ff';
        ctx.fillRect(rx - 1, -8.5, 2, 2.5);
        ctx.fillRect(rx - 1, 6, 2, 2.5);
        ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.roundRect(14, -4.5, 10, 9, 2); ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.fillRect(14, -2.5, 10, 5);

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(24, -6); ctx.lineTo(24, 6); ctx.lineTo(31, 3); ctx.lineTo(31, -3);
    ctx.closePath(); ctx.fill();

    const emitGlow = 0.5 + Math.sin(now / 200) * 0.5;
    ctx.strokeStyle = `rgba(74,222,128,${emitGlow})`;
    ctx.lineWidth = 1.8; ctx.shadowBlur = 14; ctx.shadowColor = '#4ade80';
    ctx.beginPath(); ctx.arc(31, 0, 4, -Math.PI / 2, Math.PI / 2); ctx.stroke();

    const steamPhase = now / 350;
    for (let si = 0; si < 3; si++) {
        const st = (steamPhase + si * 0.55) % 1;
        const sy = (si - 1) * 4;
        const sx = 31 + st * 18;
        const sAlph = Math.max(0, (1 - st) * emitGlow * 0.7);
        ctx.globalAlpha = sAlph;
        ctx.fillStyle = '#bbf7d0';
        ctx.shadowBlur = 6; ctx.shadowColor = '#4ade80';
        ctx.beginPath(); ctx.arc(sx, sy, 2 + st * 2.5, 0, Math.PI * 2); ctx.fill();
    }
    for (let bi = 0; bi < 2; bi++) {
        const bt = (steamPhase * 1.3 + bi * 0.7) % 1;
        const bAlph = Math.max(0, (1 - bt) * emitGlow * 0.5);
        ctx.globalAlpha = bAlph;
        ctx.fillStyle = `rgba(74,222,128,${bAlph})`;
        ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.arc(33 + bt * 12, (bi - 0.5) * 7 * bt, 1.5 + bt * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    ctx.fillStyle = `rgba(187,247,208,${emitGlow})`;
    ctx.shadowBlur = 10; ctx.shadowColor = '#4ade80';
    ctx.beginPath(); ctx.arc(31, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#78350f';
    ctx.beginPath(); ctx.roundRect(-22, -5, 9, 10, 2); ctx.fill();
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-22, -3, 9, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
    for (let gly = -4; gly <= 4; gly += 2) {
        ctx.beginPath(); ctx.moveTo(-22, gly); ctx.lineTo(-13, gly); ctx.stroke();
    }

    ctx.restore();
}

function drawKaoGunEnhanced(ctx, weaponType, isAwakened = false) {
    const now = performance.now();
    ctx.save();

    if (weaponType === 'sniper') {
        const now2 = now;
        const powerPulse = 0.5 + Math.sin(now2 / 200) * 0.5;

        ctx.fillStyle = '#1e3a5f';
        ctx.beginPath(); ctx.roundRect(-14, -4, 12, 8, 2); ctx.fill();
        ctx.strokeStyle = 'rgba(147,197,253,0.3)'; ctx.lineWidth = 0.8;
        for (let gls = -13; gls < -4; gls += 2.5) {
            ctx.beginPath(); ctx.moveTo(gls, -4); ctx.lineTo(gls, 4); ctx.stroke();
        }

        const recvG = ctx.createLinearGradient(0, -5, 0, 5);
        recvG.addColorStop(0, '#334155');
        recvG.addColorStop(0.5, '#1e293b');
        recvG.addColorStop(1, '#0f172a');
        ctx.fillStyle = recvG;
        ctx.beginPath(); ctx.roundRect(-2, -5, 20, 10, 2); ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.roundRect(18, -2.5, 26, 5, 1.5); ctx.fill();
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(18, -1.5); ctx.lineTo(44, -1.5); ctx.stroke();
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.roundRect(42, -3.5, 6, 7, 2); ctx.fill();
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 0.8;
        for (let si = 43; si < 48; si += 1.5) {
            ctx.beginPath(); ctx.moveTo(si, -3.5); ctx.lineTo(si, 3.5); ctx.stroke();
        }
        const muzzle = 0.4 + Math.sin(now2 / 300) * 0.3;
        ctx.fillStyle = `rgba(0,229,255,${muzzle})`;
        ctx.shadowBlur = 6; ctx.shadowColor = '#00e5ff';
        ctx.beginPath(); ctx.arc(49, 0, 2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        const lineGrad = ctx.createLinearGradient(-2, 0, 44, 0);
        lineGrad.addColorStop(0, `rgba(0,229,255,0)`);
        lineGrad.addColorStop(0.15, `rgba(0,229,255,${powerPulse * 0.7})`);
        lineGrad.addColorStop(0.8, `rgba(96,165,250,${powerPulse})`);
        lineGrad.addColorStop(1, `rgba(147,197,253,0.3)`);
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 1.8;
        ctx.shadowBlur = 10 * powerPulse; ctx.shadowColor = '#00e5ff';
        ctx.beginPath(); ctx.moveTo(-2, -5.5); ctx.lineTo(44, -5.5); ctx.stroke();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = `rgba(96,165,250,${powerPulse * 0.6})`;
        ctx.lineWidth = 0.8; ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.moveTo(2, 5.5); ctx.lineTo(42, 5.5); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.roundRect(6, -13, 16, 9, 2); ctx.fill();
        ctx.fillStyle = '#334155';
        ctx.beginPath(); ctx.roundRect(5, -5, 18, 2, 1); ctx.fill();
        ctx.fillStyle = '#0ea5e9';
        ctx.shadowBlur = 14; ctx.shadowColor = '#0284c7';
        ctx.beginPath(); ctx.arc(14, -9, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(11, -9); ctx.lineTo(17, -9);
        ctx.moveTo(14, -12); ctx.lineTo(14, -6);
        ctx.stroke();
        ctx.fillStyle = `rgba(224,242,254,${0.6 + Math.sin(now2 / 180) * 0.4})`;
        ctx.shadowBlur = 6; ctx.shadowColor = '#00e5ff';
        ctx.beginPath(); ctx.arc(14, -9, 1, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#475569';
        ctx.beginPath(); ctx.arc(8, -9, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(20, -9, 1.5, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#1e3a5f';
        ctx.beginPath(); ctx.roundRect(8, 5, 4, 9, 1); ctx.fill();
        ctx.beginPath(); ctx.roundRect(22, 5, 4, 7, 1); ctx.fill();

        ctx.fillStyle = 'rgba(147,197,253,0.8)'; ctx.font = 'bold 4px Arial'; ctx.textAlign = 'center';
        ctx.fillText('KAO-SR', 8, 2);

    } else if (weaponType === 'shotgun') {
        const g = ctx.createLinearGradient(0, -7, 0, 7);
        g.addColorStop(0, '#f59e0b'); g.addColorStop(0.5, '#ea580c'); g.addColorStop(1, '#c2410c');
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(0, -6, 22, 12, 3); ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.roundRect(18, -5.5, 12, 5, 1); ctx.fill();
        ctx.beginPath(); ctx.roundRect(18, 0.5, 12, 5, 1); ctx.fill();
        const sFlash = 0.45 + Math.sin(now / 200) * 0.35;
        ctx.fillStyle = `rgba(251,146,60,${sFlash})`; ctx.shadowBlur = 10; ctx.shadowColor = '#f59e0b';
        ctx.beginPath(); ctx.arc(30, -3, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(30, 3, 2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#78350f'; ctx.beginPath(); ctx.roundRect(-10, -4, 12, 8, 2); ctx.fill();
        ctx.fillStyle = '#92400e'; ctx.fillRect(-10, -2, 12, 3);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
        for (let i = -9; i < 0; i += 2) { ctx.beginPath(); ctx.moveTo(i, -4); ctx.lineTo(i, 4); ctx.stroke(); }
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(2, -8, 3, 2); ctx.fillRect(9, -8, 3, 2); ctx.fillRect(16, -8, 3, 2);
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(8, 6, 5, 0, Math.PI); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 4px Arial'; ctx.textAlign = 'center';
        ctx.fillText('12G', 11, 1);

    } else {
        const g = ctx.createLinearGradient(0, -6, 0, 6);
        g.addColorStop(0, '#3b82f6'); g.addColorStop(0.5, '#2563eb'); g.addColorStop(1, '#1e40af');
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(0, -5, 26, 10, 2); ctx.fill();
        ctx.fillStyle = '#1e293b'; ctx.fillRect(2, -7, 18, 2);
        ctx.fillStyle = '#334155'; ctx.fillRect(4, -8.5, 4, 1.5); ctx.fillRect(12, -8.5, 4, 1.5);
        ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.roundRect(22, -2.5, 10, 5, 1); ctx.fill();
        const aFlash = 0.45 + Math.sin(now / 180) * 0.35;
        ctx.fillStyle = `rgba(96,165,250,${aFlash})`; ctx.shadowBlur = 10; ctx.shadowColor = '#60a5fa';
        ctx.beginPath(); ctx.arc(32, 0, 2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.roundRect(8, 5, 8, 9, 1); ctx.fill();
        ctx.fillStyle = '#334155'; ctx.fillRect(9, 6, 6, 4);
        ctx.fillStyle = '#1e40af'; ctx.beginPath(); ctx.roundRect(-8, -3.5, 10, 7, 2); ctx.fill();
        ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1;
        ctx.strokeRect(2, -4, 5, 8); ctx.strokeRect(14, -4, 5, 8);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 5px Arial'; ctx.textAlign = 'center';
        ctx.fillText('MTC', 12, 1);
    }

    // ── Awakened (Weapon Master) overlays ─────────────────────────────────────
    if (isAwakened) {
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;

        if (weaponType === 'sniper') {
            // Railgun energy rings along barrel
            const rRingPhase = (now / 300) % (Math.PI * 2);
            for (let ri = 0; ri < 3; ri++) {
                const rx = 10 + ri * 12;
                const rAlpha = 0.55 + Math.sin(rRingPhase + ri * 1.2) * 0.35;
                ctx.globalAlpha = rAlpha;
                ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.2;
                ctx.shadowBlur = 8; ctx.shadowColor = '#0ea5e9';
                ctx.beginPath(); ctx.ellipse(rx, 0, 2.5, 5.5, 0, 0, Math.PI * 2); ctx.stroke();
            }
            // laser sight — faint line from muzzle
            ctx.globalAlpha = 0.28;
            const laserGrad = ctx.createLinearGradient(49, 0, 130, 0);
            laserGrad.addColorStop(0, '#ef4444');
            laserGrad.addColorStop(1, 'rgba(239,68,68,0)');
            ctx.strokeStyle = laserGrad; ctx.lineWidth = 0.8;
            ctx.shadowBlur = 6; ctx.shadowColor = '#ef4444';
            ctx.beginPath(); ctx.moveTo(49, 0); ctx.lineTo(130, 0); ctx.stroke();

        } else if (weaponType === 'shotgun') {
            // heat glow on barrels — glowing red-hot metal
            const heatFlicker = 0.6 + Math.sin(now / 80) * 0.4;
            ctx.globalAlpha = heatFlicker * 0.7;
            ctx.fillStyle = '#dc2626';
            ctx.shadowBlur = 16; ctx.shadowColor = '#f97316';
            ctx.beginPath(); ctx.arc(27, -3, 3.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(27, 3, 3.5, 0, Math.PI * 2); ctx.fill();
            // steam wisps — 2 small upward curves from barrel
            ctx.globalAlpha = 0.35 + Math.sin(now / 150) * 0.2;
            ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 1; ctx.lineCap = 'round';
            ctx.shadowBlur = 4; ctx.shadowColor = '#f59e0b';
            ctx.beginPath(); ctx.moveTo(24, -7); ctx.quadraticCurveTo(26, -13, 22, -17); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(30, -7); ctx.quadraticCurveTo(33, -14, 30, -19); ctx.stroke();

        } else {
            // Auto — floating holo parts above gun
            const hPhase = (now / 500) % (Math.PI * 2);
            const hFloat = Math.sin(hPhase) * 2.5;
            // floating module — small rect hovering above receiver
            ctx.globalAlpha = 0.75;
            ctx.fillStyle = 'rgba(96,165,250,0.25)';
            ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 0.9;
            ctx.shadowBlur = 10; ctx.shadowColor = '#60a5fa';
            ctx.beginPath(); ctx.roundRect(8, -15 + hFloat, 10, 5, 1.5); ctx.fill(); ctx.stroke();
            // connection beams — two dotted lines to gun body
            ctx.globalAlpha = 0.45;
            ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 0.7;
            ctx.setLineDash([1.5, 2]);
            ctx.beginPath(); ctx.moveTo(9, -10 + hFloat); ctx.lineTo(9, -7); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(17, -10 + hFloat); ctx.lineTo(17, -7); ctx.stroke();
            ctx.setLineDash([]);
            // LED dot on module
            ctx.globalAlpha = 0.9 + Math.sin(now / 120) * 0.1;
            ctx.fillStyle = '#38bdf8';
            ctx.shadowBlur = 8; ctx.shadowColor = '#0ea5e9';
            ctx.beginPath(); ctx.arc(13, -12.5 + hFloat, 1.5, 0, Math.PI * 2); ctx.fill();
        }

        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    ctx.restore();
}

window.Projectile = Projectile;
window.WeaponSystem = WeaponSystem;
window.ProjectileManager = ProjectileManager;
window.weaponSystem = weaponSystem;
window.projectileManager = projectileManager;
window.drawPoomWeapon = drawPoomWeapon;
window.drawKaoGunEnhanced = drawKaoGunEnhanced;

function drawAutoWeapon(ctx, wanchaiActive = false, ventGlow = 0.3) {
    const now = performance.now();
    ctx.save();
    ctx.translate(12, 4);

    const heat = wanchaiActive ? 1.0 : ventGlow;
    const firePulse = Math.max(0, 0.4 + Math.sin(now / 160) * 0.6);

    const bg = ctx.createLinearGradient(0, -9, 0, 9);
    bg.addColorStop(0, '#fca5a5');
    bg.addColorStop(0.35, '#dc2626');
    bg.addColorStop(0.7, '#991b1b');
    bg.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(-11, -8, 26, 16, 4); ctx.fill();
    ctx.strokeStyle = '#450a0a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(-11, -8, 26, 16, 4); ctx.stroke();

    const pistonPositions = [-6, 0, 6];
    for (let pi = 0; pi < pistonPositions.length; pi++) {
        const px = pistonPositions[pi];
        const pistonPhase = Math.sin(now / 100 + pi * 1.2);
        const pistonOffset = pistonPhase * 2 * heat;

        ctx.fillStyle = '#450a0a';
        ctx.beginPath(); ctx.roundRect(px - 2, -7, 4, 14, 1); ctx.fill();
        ctx.fillStyle = '#9f1239';
        ctx.beginPath(); ctx.roundRect(px - 1, -6 + pistonOffset, 2, 7 - pistonOffset, 0); ctx.fill();
        ctx.fillStyle = '#fca5a5';
        ctx.beginPath(); ctx.roundRect(px - 2.5, -6 + pistonOffset, 5, 3, 1); ctx.fill();
    }

    for (let ep = -1; ep <= 1; ep += 2) {
        const epx = ep * 7;
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.roundRect(epx - 1.5, -13, 3, 7, 1); ctx.fill();
        ctx.fillStyle = '#334155';
        ctx.beginPath(); ctx.roundRect(epx - 2.5, -9, 5, 2, 0); ctx.fill();

        if (heat > 0.2) {
            const fireAlpha = heat * firePulse * 0.8;
            ctx.globalAlpha = fireAlpha;
            ctx.shadowBlur = 12 * heat; ctx.shadowColor = '#fb923c';
            ctx.fillStyle = '#fb923c';
            const fx = epx + (Math.sin(now / 80 + ep) * 1.5);
            const fy = -14 - heat * firePulse * 4;
            ctx.beginPath(); ctx.arc(fx, fy, Math.max(0, 2.5 * heat * firePulse), 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fde68a';
            ctx.globalAlpha = fireAlpha * 0.5;
            ctx.beginPath(); ctx.arc(fx, fy - 3, Math.max(0, 2 * heat), 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }

    ctx.shadowBlur = 6 * heat; ctx.shadowColor = '#fb923c';
    for (let vi = 0; vi < 4; vi++) {
        const ventAlpha = heat * (0.4 + vi * 0.1) * (0.6 + Math.sin(now / 130 + vi) * 0.4);
        ctx.fillStyle = `rgba(251,146,60,${ventAlpha})`;
        ctx.fillRect(-11, -5 + vi * 3.5, 3, 2);
        ctx.fillRect(19, -5 + vi * 3.5, 3, 2);
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#7f1d1d';
    for (let k = -7; k <= 7; k += 4) {
        ctx.beginPath();
        ctx.moveTo(k - 2, -8);
        ctx.lineTo(k + 2, -8);
        ctx.lineTo(k, -13 - heat * firePulse * 2);
        ctx.closePath(); ctx.fill();
    }

    const coreGlow = heat * firePulse;
    ctx.fillStyle = `rgba(251,113,133,${coreGlow})`;
    ctx.shadowBlur = 12 * coreGlow; ctx.shadowColor = '#dc2626';
    ctx.beginPath(); ctx.arc(3, 0, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 4px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('AUTO', 1, 1.5);

    ctx.restore();
}

window.drawAutoWeapon = drawAutoWeapon;
// ─────────────────────────────────────────────
// ProjectileRenderer SHIM
// drawAll() delegates to each Projectile's own draw() method
// (class was removed during Collision Optimization v2 — restored as thin wrapper)
// ─────────────────────────────────────────────
class ProjectileRenderer {
    static drawAll(projectiles, ctx) {
        for (let i = 0; i < projectiles.length; i++) {
            projectiles[i].draw();
        }
    }
}
window.ProjectileRenderer = ProjectileRenderer;