'use strict';
const NAGA_SOUND_INTERVAL = 220;
// ════════════════════════════════════════════════════════════
// 🐍 NAGA ENTITY
// ════════════════════════════════════════════════════════════
class NagaEntity extends Entity {
    constructor(startX, startY, owner) {
        const S = BALANCE.characters.poom;
        super(startX, startY, S.nagaRadius);
        this.owner = owner;
        const n = S.nagaSegments;
        this.segments = Array.from({ length: n }, () => ({ x: startX, y: startY }));
        this.life = S.nagaDuration;
        this.maxLife = S.nagaDuration;
        this.speed = S.nagaSpeed;
        this.damage = S.nagaDamage * (owner.damageMultiplier || 1.0);
        this.active = true;

        this.lastSoundTime = 0;
    }

    update(dt, player, _meteorZones) {
        const S = BALANCE.characters.poom;

        // ── BUG-4 FIX: Compute damage live every tick from the owner's current
        //    damageMultiplier instead of reading the frozen constructor snapshot.
        //    A level-up that fires mid-summon (Naga lasts 8 s) is now reflected
        //    immediately on the very next damage tick.
        const liveDamage = S.nagaDamage * (this.owner?.damageMultiplier || 1.0);

        this.life -= dt;
        if (this.life <= 0) {
            this.active = false;
            if (this.owner) this.owner.naga = null;
            return true;
        }

        // ── Head steering — follows the mouse cursor ───────────────────────────
        const head = this.segments[0];
        const dx = mouse.wx - head.x, dy = mouse.wy - head.y;
        const d = Math.hypot(dx, dy);
        if (d > 8) {
            const step = Math.min(this.speed * dt, d);
            head.x += (dx / d) * step; head.y += (dy / d) * step;
        }

        // ── Segment chain following ────────────────────────────────────────────
        const segDist = S.nagaSegmentDistance;
        for (let i = 1; i < this.segments.length; i++) {
            const prev = this.segments[i - 1], curr = this.segments[i];
            const sdx = curr.x - prev.x, sdy = curr.y - prev.y;
            const sd = Math.hypot(sdx, sdy);
            if (sd > segDist) { curr.x = prev.x + (sdx / sd) * segDist; curr.y = prev.y + (sdy / sd) * segDist; }
        }

        // ── Enemy collision damage ─────────────────────────────────────────────
        for (const enemy of (window.enemies || [])) {
            if (enemy.dead) continue;
            for (const seg of this.segments) {
                if (dist(seg.x, seg.y, enemy.x, enemy.y) < this.radius + enemy.radius) {
                    enemy.takeDamage(liveDamage * dt, player);
                    if (Math.random() < 0.1) spawnParticles(seg.x, seg.y, 2, '#10b981');
                    const now = Date.now();
                    if (now - this.lastSoundTime >= NAGA_SOUND_INTERVAL) {
                        this.lastSoundTime = now;
                        Audio.playNagaAttack();
                    }
                    break;
                }
            }
        }

        // ── Boss collision damage ──────────────────────────────────────────────
        if (window.boss && !window.boss.dead) {
            for (const seg of this.segments) {
                if (dist(seg.x, seg.y, window.boss.x, window.boss.y) < this.radius + window.boss.radius) {
                    window.boss.takeDamage(liveDamage * dt * 0.4);
                    const now = Date.now();
                    if (now - this.lastSoundTime >= NAGA_SOUND_INTERVAL) {
                        this.lastSoundTime = now;
                        Audio.playNagaAttack();
                    }
                    break;
                }
            }
        }

        return false;
    }

    draw() {
        const lifeRatio = this.life / this.maxLife;
        const now = performance.now();

        for (let i = this.segments.length - 1; i >= 1; i--) {
            const seg = this.segments[i];
            const screen = worldToScreen(seg.x, seg.y);
            const t = i / (this.segments.length - 1);
            const r = this.radius * (1 - t * 0.55);
            const alpha = lifeRatio * (1 - t * 0.3);

            CTX.save();
            CTX.globalAlpha = Math.max(0.1, alpha);

            if (i === this.segments.length - 1) {
                const prevSeg = this.segments[i - 1];
                const tailAngle = Math.atan2(seg.y - prevSeg.y, seg.x - prevSeg.x);
                CTX.translate(screen.x, screen.y);
                CTX.rotate(tailAngle);
                // Split tail fin — upper + lower lobe
                const tailG = CTX.createLinearGradient(-r, 0, r * 3, 0);
                tailG.addColorStop(0, '#064e3b');
                tailG.addColorStop(0.4, '#059669');
                tailG.addColorStop(1, '#065f46');
                CTX.fillStyle = tailG;
                CTX.shadowBlur = 6; CTX.shadowColor = '#10b981';
                // Upper lobe
                CTX.beginPath();
                CTX.moveTo(-r * 0.5, -r * 0.1);
                CTX.quadraticCurveTo(r * 0.6, -r * 0.2, r * 2.8, -r * 0.7);
                CTX.quadraticCurveTo(r * 1.4, -r * 0.1, r * 0.6, 0);
                CTX.closePath(); CTX.fill();
                // Lower lobe
                CTX.beginPath();
                CTX.moveTo(-r * 0.5, r * 0.1);
                CTX.quadraticCurveTo(r * 0.6, r * 0.2, r * 2.8, r * 0.7);
                CTX.quadraticCurveTo(r * 1.4, r * 0.1, r * 0.6, 0);
                CTX.closePath(); CTX.fill();
                // Tail tip glow dots
                const tp = 0.5 + Math.sin(now / 190) * 0.4;
                CTX.fillStyle = `rgba(251,191,36,${tp * 0.65})`;
                CTX.shadowBlur = 7 * tp; CTX.shadowColor = '#fbbf24';
                CTX.beginPath(); CTX.arc(r * 2.6, -r * 0.55, 1.4, 0, Math.PI * 2); CTX.fill();
                CTX.beginPath(); CTX.arc(r * 2.6, r * 0.55, 1.4, 0, Math.PI * 2); CTX.fill();
                CTX.shadowBlur = 0;
            } else {
                const isEven = i % 2 === 0;
                // ── Segment base gradient ─────────────────────
                const scaleGrad = CTX.createRadialGradient(
                    screen.x - r * 0.3, screen.y - r * 0.3, 0,
                    screen.x, screen.y, r
                );
                scaleGrad.addColorStop(0, isEven ? '#6ee7b7' : '#34d399');
                scaleGrad.addColorStop(0.45, isEven ? '#10b981' : '#059669');
                scaleGrad.addColorStop(1, '#064e3b');
                CTX.fillStyle = scaleGrad;
                CTX.shadowBlur = 8 + Math.sin(now / 280 + i) * 3;
                CTX.shadowColor = '#10b981';
                CTX.beginPath(); CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2); CTX.fill();
                CTX.shadowBlur = 0;

                // ── Belly stripe (lighter central band) ───────
                if (r > 5) {
                    const segA = Math.atan2(
                        this.segments[Math.min(i + 1, this.segments.length - 1)].y - this.segments[Math.max(i - 1, 0)].y,
                        this.segments[Math.min(i + 1, this.segments.length - 1)].x - this.segments[Math.max(i - 1, 0)].x
                    );
                    CTX.save();
                    CTX.translate(screen.x, screen.y); CTX.rotate(segA);
                    CTX.beginPath(); CTX.arc(0, 0, r, 0, Math.PI * 2); CTX.clip();
                    const bellyG = CTX.createLinearGradient(-r, 0, r, 0);
                    bellyG.addColorStop(0, 'rgba(0,0,0,0)');
                    bellyG.addColorStop(0.38, 'rgba(167,243,208,0.22)');
                    bellyG.addColorStop(0.5, 'rgba(209,250,229,0.35)');
                    bellyG.addColorStop(0.62, 'rgba(167,243,208,0.22)');
                    bellyG.addColorStop(1, 'rgba(0,0,0,0)');
                    CTX.fillStyle = bellyG; CTX.fillRect(-r, -r, r * 2, r * 2);
                    CTX.restore();
                }

                // ── Scale arc cross-marks ──────────────────────
                if (r > 7) {
                    CTX.save();
                    CTX.translate(screen.x, screen.y);
                    CTX.beginPath(); CTX.arc(0, 0, r, 0, Math.PI * 2); CTX.clip();
                    CTX.strokeStyle = 'rgba(4,120,87,0.4)'; CTX.lineWidth = 0.9;
                    for (let arc = 0; arc < 3; arc++) {
                        CTX.beginPath();
                        CTX.arc(0, -r * 0.2 + arc * r * 0.45, r * 0.8, Math.PI, Math.PI * 2);
                        CTX.stroke();
                    }
                    CTX.restore();
                }

                // ── Thai gold ring every 4th segment ──────────
                if (i % 4 === 0 && r > 6) {
                    const rp = 0.5 + Math.sin(now / 240 + i * 0.6) * 0.4;
                    CTX.strokeStyle = `rgba(251,191,36,${rp * 0.75})`;
                    CTX.lineWidth = 1.5;
                    CTX.shadowBlur = 6 * rp; CTX.shadowColor = '#fbbf24';
                    CTX.beginPath(); CTX.arc(screen.x, screen.y, r * 0.87, 0, Math.PI * 2); CTX.stroke();
                    CTX.shadowBlur = 0;
                }
            }
            CTX.restore();
        }

        if (this.segments.length > 0) {
            const head = this.segments[0];
            const hs = worldToScreen(head.x, head.y);
            const r = this.radius;
            const headAlpha = lifeRatio;

            let headAngle = 0;
            if (this.segments.length > 1) {
                const neck = this.segments[1];
                headAngle = Math.atan2(head.y - neck.y, head.x - neck.x);
            }

            CTX.save();
            CTX.translate(hs.x, hs.y);
            CTX.rotate(headAngle);
            CTX.globalAlpha = Math.max(0.15, headAlpha);

            const auraR = r * 1.8 + Math.sin(now / 120) * 3;
            CTX.globalAlpha = headAlpha * (0.4 + Math.sin(now / 160) * 0.2);
            CTX.strokeStyle = '#34d399'; CTX.lineWidth = 2;
            CTX.shadowBlur = 16 + Math.sin(now / 130) * 8; CTX.shadowColor = '#10b981';
            CTX.beginPath(); CTX.arc(0, 0, auraR, 0, Math.PI * 2); CTX.stroke();

            CTX.globalAlpha = Math.max(0.15, headAlpha);

            const headGrad = CTX.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r * 1.1);
            headGrad.addColorStop(0, '#34d399');
            headGrad.addColorStop(0.5, '#059669');
            headGrad.addColorStop(1, '#064e3b');
            CTX.fillStyle = headGrad;
            CTX.shadowBlur = 20; CTX.shadowColor = '#10b981';
            CTX.beginPath();
            CTX.moveTo(r * 1.3, 0);
            CTX.quadraticCurveTo(r * 1.0, -r * 0.8, 0, -r * 0.85);
            CTX.quadraticCurveTo(-r * 0.7, -r * 0.9, -r, -r * 0.55);
            CTX.quadraticCurveTo(-r * 1.1, 0, -r, r * 0.55);
            CTX.quadraticCurveTo(-r * 0.7, r * 0.9, 0, r * 0.85);
            CTX.quadraticCurveTo(r * 1.0, r * 0.8, r * 1.3, 0);
            CTX.closePath(); CTX.fill();
            CTX.shadowBlur = 0;

            CTX.strokeStyle = '#fbbf24'; CTX.lineWidth = 3; CTX.lineCap = 'round';
            CTX.shadowBlur = 10; CTX.shadowColor = '#f59e0b';
            CTX.beginPath();
            CTX.moveTo(-r * 0.3, -r * 0.65);
            CTX.quadraticCurveTo(-r * 0.6, -r * 1.4, -r * 0.1, -r * 1.8);
            CTX.stroke();
            CTX.beginPath();
            CTX.moveTo(r * 0.3, -r * 0.65);
            CTX.quadraticCurveTo(r * 0.6, -r * 1.4, r * 0.1, -r * 1.8);
            CTX.stroke();
            CTX.fillStyle = '#fef08a'; CTX.shadowBlur = 14; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(-r * 0.1, -r * 1.8, 2.5, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.arc(r * 0.1, -r * 1.8, 2.5, 0, Math.PI * 2); CTX.fill();
            CTX.shadowBlur = 0;

            const manePhase = now / 200;
            CTX.lineWidth = 2.5; CTX.lineCap = 'round';
            const maneStrands = [
                { side: -1, baseY: -r * 0.4, cp1x: -r * 1.6, cp1y: -r * 0.2, endX: -r * 1.4, endY: r * 0.5, phase: 0 },
                { side: -1, baseY: -r * 0.1, cp1x: -r * 1.8, cp1y: r * 0.4, endX: -r * 1.2, endY: r * 1.0, phase: 0.7 },
                { side: -1, baseY: r * 0.3, cp1x: -r * 1.4, cp1y: r * 1.0, endX: -r * 0.8, endY: r * 1.5, phase: 1.4 },
                { side: 1, baseY: -r * 0.4, cp1x: r * 1.6, cp1y: -r * 0.2, endX: r * 1.4, endY: r * 0.5, phase: 0.3 },
                { side: 1, baseY: -r * 0.1, cp1x: r * 1.8, cp1y: r * 0.4, endX: r * 1.2, endY: r * 1.0, phase: 1.0 },
                { side: 1, baseY: r * 0.3, cp1x: r * 1.4, cp1y: r * 1.0, endX: r * 0.8, endY: r * 1.5, phase: 1.7 },
            ];
            for (const ms of maneStrands) {
                const flutter = Math.sin(manePhase + ms.phase) * r * 0.35;
                const mAlpha = headAlpha * (0.5 + Math.sin(manePhase + ms.phase) * 0.3);
                CTX.globalAlpha = Math.max(0, mAlpha);
                CTX.strokeStyle = '#6ee7b7'; CTX.shadowBlur = 8; CTX.shadowColor = '#10b981';
                CTX.beginPath();
                CTX.moveTo(0, ms.baseY);
                CTX.quadraticCurveTo(ms.cp1x + flutter * ms.side, ms.cp1y, ms.endX + flutter * ms.side * 0.5, ms.endY);
                CTX.stroke();
            }
            CTX.globalAlpha = Math.max(0.15, headAlpha);
            CTX.shadowBlur = 0;

            const eyeGlow = 0.6 + Math.sin(now / 180) * 0.4;
            const eyeColor = `rgba(245,158,11,${eyeGlow})`;
            CTX.fillStyle = eyeColor;
            CTX.shadowBlur = 16 * eyeGlow; CTX.shadowColor = '#f59e0b';
            CTX.beginPath(); CTX.ellipse(r * 0.35, -r * 0.3, r * 0.28, r * 0.2, 0, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.ellipse(r * 0.35, r * 0.3, r * 0.28, r * 0.2, 0, 0, Math.PI * 2); CTX.fill();
            CTX.fillStyle = '#0f172a'; CTX.shadowBlur = 0;
            CTX.beginPath(); CTX.ellipse(r * 0.38, -r * 0.3, r * 0.08, r * 0.16, 0, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.ellipse(r * 0.38, r * 0.3, r * 0.08, r * 0.16, 0, 0, Math.PI * 2); CTX.fill();
            CTX.fillStyle = `rgba(255,251,235,${eyeGlow * 0.7})`;
            CTX.beginPath(); CTX.arc(r * 0.32, -r * 0.34, r * 0.07, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.arc(r * 0.32, r * 0.26, r * 0.07, 0, Math.PI * 2); CTX.fill();

            CTX.restore();
            CTX.save();
            CTX.globalAlpha = headAlpha * 0.85;
            CTX.fillStyle = '#34d399';
            CTX.font = 'bold 10px Arial'; CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(`${this.life.toFixed(1)}s`, hs.x, hs.y - r * 2.4);
            CTX.restore();

            const pulse = 0.6 + Math.sin(now / 130) * 0.4;
            CTX.save();
            CTX.globalAlpha = lifeRatio * (0.5 + pulse * 0.4);
            CTX.strokeStyle = '#34d399'; CTX.lineWidth = 1.5;
            CTX.shadowBlur = 12 * pulse; CTX.shadowColor = '#10b981';
            CTX.beginPath(); CTX.arc(hs.x, hs.y, this.radius * 1.6, 0, Math.PI * 2); CTX.stroke();
            CTX.restore();
        }
    }
}

// ════════════════════════════════════════════════════════════
// 🤖 DRONE
// ════════════════════════════════════════════════════════════
class Drone extends Entity {
    constructor() {
        const S = BALANCE.drone;
        super(0, 0, S.radius);
        this.shootCooldown = 0;
        this.targetAngle = 0;
        this.hasTarget = false;
        this.bobTimer = Math.random() * Math.PI * 2;
        this.orbitAngle = 0;
        this.lockTimer = 0;
    }

    update(dt, player) {
        const S = BALANCE.drone;
        this.bobTimer += dt * S.bobSpeed;
        this.orbitAngle += dt * S.orbitSpeed;
        this.lockTimer += dt;
        if (this.shootCooldown > 0) this.shootCooldown -= dt;

        // ── Overdrive State Tracking (with Linger Timer) ──
        // Initialize timer if not exists
        if (typeof this.overdriveTimer === 'undefined') this.overdriveTimer = 0;

        // Check if player has reached the required combo
        if (player && (player.comboCount || 0) >= (S.overdriveCombo || 15)) {
            this.overdriveTimer = S.overdriveLinger || 4.0; // Refresh timer while combo is maintained
        } else if (this.overdriveTimer > 0) {
            this.overdriveTimer -= dt; // Linger countdown when combo drops
        }

        const isOverdrive = this.overdriveTimer > 0;

        if (isOverdrive && !this.wasOverdrive) {
            spawnFloatingText(GAME_TEXTS.combat.droneOverdrive || '🔥 OVERDRIVE!', this.x, this.y - 30, '#facc15', 22);
            spawnParticles(this.x, this.y, 20, '#facc15');

            // FIX: Was calling Achievements.unlock('drone_master') — passing a raw
            //      string instead of an achievement object caused unlock() to store
            //      `undefined` in the Set (ach.id on a string is undefined) and
            //      rendered a popup with undefined title/desc on every overdrive.
            //      Now we increment the stat and call check() like every other achievement.
            if (typeof Achievements !== 'undefined') {
                Achievements.stats.droneOverdrives++;
                Achievements.check('drone_master');
            }
        }
        this.wasOverdrive = isOverdrive;

        const targetX = player.x + Math.cos(this.orbitAngle) * S.orbitRadius;
        const targetY = player.y + Math.sin(this.orbitAngle) * S.orbitRadius
            + Math.sin(this.bobTimer) * S.bobAmplitude;
        const lerpFactor = 1 - Math.pow(S.lerpBase, dt);
        this.x += (targetX - this.x) * lerpFactor;
        this.y += (targetY - this.y) * lerpFactor;

        this.hasTarget = false;
        if (this.shootCooldown <= 0) {
            const target = this._findNearestEnemy();
            if (target) {
                this.targetAngle = Math.atan2(target.y - this.y, target.x - this.x);
                this.hasTarget = true;
                this.lockTimer = 0;

                const color = this.wasOverdrive ? S.overdriveColor : S.projectileColor;
                const dmg = this.wasOverdrive ? S.damage * 1.5 : S.damage;
                const fRate = this.wasOverdrive ? S.overdriveFireRate : S.fireRate;

                if (this.wasOverdrive) {
                    // Spread Fire (3 projectiles)
                    for (let i = -1; i <= 1; i++) {
                        projectileManager.add(new Projectile(
                            this.x, this.y, this.targetAngle + (i * 0.25),
                            S.projectileSpeed * 1.2, dmg, color, false, 'player'
                        ));
                    }
                    spawnParticles(this.x, this.y, 6, color);
                } else {
                    // Normal Fire
                    projectileManager.add(new Projectile(
                        this.x, this.y, this.targetAngle,
                        S.projectileSpeed, S.damage, S.projectileColor, false, 'player'
                    ));
                    spawnParticles(this.x, this.y, 2, S.projectileColor);
                }

                this.shootCooldown = 1.0 / fRate;
                if (typeof Audio !== 'undefined' && Audio.playShoot) Audio.playShoot();
            }
        }
    }

    _findNearestEnemy() {
        const S = BALANCE.drone;
        let nearest = null, nearestDist = S.range;
        for (const e of (window.enemies || [])) {
            if (e.dead) continue;
            const d = dist(this.x, this.y, e.x, e.y);
            if (d < nearestDist) { nearestDist = d; nearest = e; }
        }
        if (window.boss && !window.boss.dead) {
            const d = dist(this.x, this.y, window.boss.x, window.boss.y);
            if (d < nearestDist) nearest = window.boss;
        }
        return nearest;
    }

    draw() {
        const S = BALANCE.drone;
        const bobOffset = Math.sin(this.bobTimer) * S.bobAmplitude;
        const groundScreen = worldToScreen(this.x, this.y);
        const bodyScreen = worldToScreen(this.x, this.y + bobOffset);

        // Dynamic Colors based on Overdrive state
        const mainColor = this.wasOverdrive ? (S.overdriveColor || '#facc15') : '#00e5ff';
        const glowColor = this.wasOverdrive ? (S.overdriveGlow || '#f59e0b') : '#00e5ff';
        const rgbBase = this.wasOverdrive ? '250,204,21' : '0,229,255'; // for rgba()

        const shadowAlpha = 0.15 + (1 - (bobOffset + S.bobAmplitude) / (S.bobAmplitude * 2)) * 0.2;
        const shadowScale = 0.8 + (1 - (bobOffset + S.bobAmplitude) / (S.bobAmplitude * 2)) * 0.2;
        CTX.save();
        CTX.globalAlpha = Math.max(0.05, shadowAlpha);
        CTX.fillStyle = 'rgba(0,0,0,0.6)';
        CTX.beginPath();
        CTX.ellipse(groundScreen.x, groundScreen.y + 22, 16 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
        CTX.fill(); CTX.restore();

        if (this.hasTarget) {
            const arcAlpha = 0.5 + Math.sin(this.lockTimer * 12) * 0.3;
            CTX.save(); CTX.globalAlpha = arcAlpha; CTX.strokeStyle = mainColor;
            CTX.lineWidth = 1.5; CTX.shadowBlur = 8; CTX.shadowColor = glowColor;
            CTX.beginPath();
            CTX.arc(bodyScreen.x, bodyScreen.y, S.radius + 8, this.targetAngle - 0.6, this.targetAngle + 0.6);
            CTX.stroke(); CTX.restore();
        }

        CTX.save();
        CTX.translate(bodyScreen.x, bodyScreen.y);

        const glowPulse = 0.6 + Math.sin(this.bobTimer * 2) * 0.4;
        const R = S.radius;

        // ── Arms + rotors ────────────────────────────────────
        const armAngle = this.orbitAngle * 2.5;
        CTX.save(); CTX.rotate(armAngle);
        for (let side = -1; side <= 1; side += 2) {
            // Tapered arm strut
            CTX.strokeStyle = '#334155'; CTX.lineWidth = 3.5;
            CTX.beginPath(); CTX.moveTo(side * 3, 0); CTX.lineTo(side * 20, -3); CTX.stroke();
            CTX.strokeStyle = '#475569'; CTX.lineWidth = 1.8;
            CTX.beginPath(); CTX.moveTo(side * 3, 0); CTX.lineTo(side * 20, -3); CTX.stroke();
            // Rotor nacelle
            CTX.fillStyle = '#293548'; CTX.strokeStyle = '#475569'; CTX.lineWidth = 1;
            CTX.beginPath(); CTX.arc(side * 20, -3, 5, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
            CTX.fillStyle = this.wasOverdrive ? `rgba(${rgbBase},0.55)` : '#3d4f63';
            CTX.beginPath(); CTX.arc(side * 20, -3, 2.5, 0, Math.PI * 2); CTX.fill();
            // Blades — tapered gradient
            const spin = this.wasOverdrive ? this.bobTimer * 22 : this.bobTimer * 9;
            CTX.save(); CTX.translate(side * 20, -3); CTX.rotate(spin * side);
            for (let blade = 0; blade < 4; blade++) {
                const a = (blade / 4) * Math.PI * 2;
                const bladeG = CTX.createLinearGradient(0, 0, Math.cos(a) * 10, Math.sin(a) * 10);
                bladeG.addColorStop(0, this.wasOverdrive ? `rgba(${rgbBase},0.95)` : 'rgba(148,163,184,0.9)');
                bladeG.addColorStop(1, 'rgba(0,0,0,0)');
                CTX.strokeStyle = bladeG; CTX.lineWidth = 2.2;
                CTX.beginPath(); CTX.moveTo(0, 0); CTX.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); CTX.stroke();
            }
            CTX.restore();
        }
        CTX.restore();

        // ── Outer octagon glow ring ──────────────────────────
        CTX.shadowBlur = 16 * glowPulse; CTX.shadowColor = glowColor;
        CTX.strokeStyle = `rgba(${rgbBase},${0.3 + glowPulse * 0.2})`; CTX.lineWidth = 1;
        CTX.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
            if (i === 0) CTX.moveTo(Math.cos(a) * (R + 4.5), Math.sin(a) * (R + 4.5));
            else CTX.lineTo(Math.cos(a) * (R + 4.5), Math.sin(a) * (R + 4.5));
        }
        CTX.closePath(); CTX.stroke(); CTX.shadowBlur = 0;

        // ── Main hex body ────────────────────────────────────
        const bodyG = CTX.createRadialGradient(-R * 0.3, -R * 0.3, 0, 0, 0, R);
        bodyG.addColorStop(0, '#2d3f52');
        bodyG.addColorStop(0.6, '#1e293b');
        bodyG.addColorStop(1, '#0f172a');
        CTX.fillStyle = bodyG; CTX.strokeStyle = '#334155'; CTX.lineWidth = 1.5;
        CTX.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
            if (i === 0) CTX.moveTo(Math.cos(a) * R, Math.sin(a) * R);
            else CTX.lineTo(Math.cos(a) * R, Math.sin(a) * R);
        }
        CTX.closePath(); CTX.fill(); CTX.stroke();

        // Armor panel insets
        CTX.fillStyle = 'rgba(15,23,42,0.6)'; CTX.strokeStyle = 'rgba(71,85,105,0.35)'; CTX.lineWidth = 0.7;
        CTX.beginPath(); CTX.roundRect(-R * 0.55, -R * 0.6, R * 1.1, R * 0.5, 2); CTX.fill(); CTX.stroke();
        CTX.beginPath(); CTX.roundRect(-R * 0.55, R * 0.1, R * 1.1, R * 0.5, 2); CTX.fill(); CTX.stroke();

        // Top antenna
        CTX.strokeStyle = '#475569'; CTX.lineWidth = 1.2;
        CTX.beginPath(); CTX.moveTo(0, -R); CTX.lineTo(0, -R - 8); CTX.stroke();
        CTX.fillStyle = this.wasOverdrive ? `rgba(${rgbBase},0.9)` : '#64748b';
        CTX.shadowBlur = this.wasOverdrive ? 8 : 0; CTX.shadowColor = glowColor;
        CTX.beginPath(); CTX.arc(0, -R - 9, 2, 0, Math.PI * 2); CTX.fill(); CTX.shadowBlur = 0;

        // ── Central eye sensor ───────────────────────────────
        CTX.shadowBlur = 18 * glowPulse; CTX.shadowColor = glowColor;
        CTX.strokeStyle = `rgba(${rgbBase},${0.55 + glowPulse * 0.45})`; CTX.lineWidth = 1.5;
        CTX.beginPath(); CTX.arc(0, 0, 6.5, 0, Math.PI * 2); CTX.stroke();
        const eyeG = CTX.createRadialGradient(0, 0, 0, 0, 0, 6);
        eyeG.addColorStop(0, `rgba(${rgbBase},${0.85 * glowPulse})`);
        eyeG.addColorStop(1, `rgba(${rgbBase},0.15)`);
        CTX.fillStyle = eyeG; CTX.beginPath(); CTX.arc(0, 0, 6, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = 'rgba(255,255,255,0.9)'; CTX.shadowBlur = 3;
        CTX.beginPath(); CTX.arc(-1.8, -1.8, 1.2, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;

        // LED status strip
        const ledCols = this.wasOverdrive
            ? [`rgba(${rgbBase},0.9)`, `rgba(${rgbBase},0.9)`, `rgba(${rgbBase},0.9)`]
            : ['#22c55e', '#64748b', '#64748b'];
        for (let li = 0; li < 3; li++) {
            const lp = 0.55 + Math.sin(performance.now() / 190 + li * 1.1) * 0.4;
            CTX.fillStyle = ledCols[li];
            CTX.shadowBlur = this.wasOverdrive ? 7 * lp : 3; CTX.shadowColor = ledCols[li];
            CTX.globalAlpha = this.wasOverdrive ? lp : 0.8;
            CTX.beginPath(); CTX.arc(-4 + li * 4, R * 0.55, 1.5, 0, Math.PI * 2); CTX.fill();
        }
        CTX.globalAlpha = 1; CTX.shadowBlur = 0;

        // ── Turret barrel ────────────────────────────────────
        CTX.save(); CTX.rotate(this.targetAngle);
        // Mount base
        CTX.fillStyle = '#293548'; CTX.strokeStyle = '#475569'; CTX.lineWidth = 0.8;
        CTX.beginPath(); CTX.roundRect(2, -3.5, 16, 7, 2); CTX.fill(); CTX.stroke();
        // Barrel slot detail
        CTX.strokeStyle = 'rgba(71,85,105,0.5)'; CTX.lineWidth = 0.7;
        for (let bd = 5; bd < 16; bd += 4) { CTX.beginPath(); CTX.moveTo(bd, -3.5); CTX.lineTo(bd, 3.5); CTX.stroke(); }
        // Muzzle tip
        CTX.fillStyle = this.hasTarget ? mainColor : '#1e293b';
        CTX.shadowBlur = this.hasTarget ? 10 : 0; CTX.shadowColor = mainColor;
        CTX.beginPath(); CTX.roundRect(17, -2.5, 5, 5, [0, 2, 2, 0]); CTX.fill();
        CTX.shadowBlur = 0;
        CTX.restore();

        CTX.restore();

        // Overdrive indicator arc (replaces text label)
        if (this.wasOverdrive) {
            CTX.save();
            CTX.globalAlpha = 0.55 + Math.sin(performance.now() / 150) * 0.25;
            CTX.strokeStyle = `rgba(${rgbBase},0.8)`;
            CTX.lineWidth = 2;
            CTX.shadowBlur = 12; CTX.shadowColor = glowColor;
            CTX.beginPath(); CTX.arc(bodyScreen.x, bodyScreen.y, S.radius + 7, Math.PI * 1.1, Math.PI * 1.9); CTX.stroke();
            CTX.restore();
        }
    }
}
// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.NagaEntity = NagaEntity;
window.Drone = Drone;
window.DroneEntity = Drone;   // alias — Debug.html checks 'DroneEntity'