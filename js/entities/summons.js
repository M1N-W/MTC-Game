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
                    // Cosmic Balance: naga hits ignite enemies
                    if (this.owner?._cosmicBalance && !enemy.dead) {
                        const burnDPS = BALANCE.characters.poom.cosmicNagaBurnDPS || 22;
                        enemy.isBurning = true;
                        enemy.burnTimer = Math.max(enemy.burnTimer || 0, 0.8);
                        enemy.burnDamage = burnDPS;
                    }
                    if (Math.random() < 0.1) spawnParticles(seg.x, seg.y, 2, '#10b981');
                    const now = performance.now();
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
                    const now = performance.now();
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
        const n = this.segments.length;

        // ── PASS 1: connector tubes between segments (drawn first, underneath) ──
        for (let i = n - 1; i >= 1; i--) {
            const a = this.segments[i], b = this.segments[i - 1];
            const sa = worldToScreen(a.x, a.y), sb = worldToScreen(b.x, b.y);
            const t = i / (n - 1);
            const rA = this.radius * (1 - t * 0.60);
            const rB = this.radius * (1 - (t - 1 / (n - 1)) * 0.60);
            const alpha = lifeRatio * (0.75 - t * 0.25);
            CTX.save();
            CTX.globalAlpha = Math.max(0.05, alpha);
            CTX.strokeStyle = '#059669';
            CTX.lineWidth = (rA + rB) * 0.95;
            CTX.lineCap = 'round';
            CTX.shadowBlur = 6; CTX.shadowColor = '#10b981';
            CTX.beginPath(); CTX.moveTo(sa.x, sa.y); CTX.lineTo(sb.x, sb.y); CTX.stroke();
            CTX.shadowBlur = 0;
            CTX.restore();
        }

        // ── PASS 2: body segments ─────────────────────────────
        for (let i = n - 1; i >= 1; i--) {
            const seg = this.segments[i];
            const screen = worldToScreen(seg.x, seg.y);
            const t = i / (n - 1);
            const r = this.radius * (1 - t * 0.60);
            const alpha = lifeRatio * (0.88 - t * 0.22);

            CTX.save();
            CTX.globalAlpha = Math.max(0.08, alpha);

            if (i === n - 1) {
                // ── Tail fin ──────────────────────────────────
                const prevSeg = this.segments[i - 1];
                const tailAngle = Math.atan2(seg.y - prevSeg.y, seg.x - prevSeg.x);
                CTX.translate(screen.x, screen.y);
                CTX.rotate(tailAngle);
                const tailG = CTX.createLinearGradient(-r, 0, r * 3.2, 0);
                tailG.addColorStop(0, '#064e3b');
                tailG.addColorStop(0.35, '#059669');
                tailG.addColorStop(1, 'rgba(6,78,59,0)');
                CTX.fillStyle = tailG;
                CTX.shadowBlur = 8; CTX.shadowColor = '#10b981';
                CTX.beginPath();
                CTX.moveTo(-r * 0.4, 0);
                CTX.quadraticCurveTo(r * 0.5, -r * 0.9, r * 3.2, -r * 0.5);
                CTX.quadraticCurveTo(r * 1.6, 0, r * 3.2, r * 0.5);
                CTX.quadraticCurveTo(r * 0.5, r * 0.9, -r * 0.4, 0);
                CTX.closePath(); CTX.fill();
                // Fin tip jewel
                const tp = 0.55 + Math.sin(now / 180) * 0.45;
                CTX.fillStyle = `rgba(251,191,36,${tp * 0.80})`;
                CTX.shadowBlur = 10 * tp; CTX.shadowColor = '#fbbf24';
                CTX.beginPath(); CTX.arc(r * 3.0, 0, 2.2, 0, Math.PI * 2); CTX.fill();
                CTX.shadowBlur = 0;

            } else {
                // ── Body segment ──────────────────────────────
                const isEven = i % 2 === 0;

                // Base scale gradient
                const scaleGrad = CTX.createRadialGradient(
                    screen.x - r * 0.35, screen.y - r * 0.35, r * 0.05,
                    screen.x, screen.y, r
                );
                scaleGrad.addColorStop(0, isEven ? '#a7f3d0' : '#6ee7b7');
                scaleGrad.addColorStop(0.40, isEven ? '#10b981' : '#059669');
                scaleGrad.addColorStop(0.80, '#065f46');
                scaleGrad.addColorStop(1, '#022c22');
                CTX.fillStyle = scaleGrad;
                CTX.shadowBlur = 10 + Math.sin(now / 260 + i) * 4;
                CTX.shadowColor = '#10b981';
                CTX.beginPath(); CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2); CTX.fill();
                CTX.shadowBlur = 0;

                // Belly stripe (perpendicular to travel direction)
                if (r > 6) {
                    const segA = Math.atan2(
                        this.segments[Math.min(i + 1, n - 1)].y - this.segments[Math.max(i - 1, 0)].y,
                        this.segments[Math.min(i + 1, n - 1)].x - this.segments[Math.max(i - 1, 0)].x
                    );
                    CTX.save();
                    CTX.translate(screen.x, screen.y); CTX.rotate(segA);
                    CTX.beginPath(); CTX.arc(0, 0, r, 0, Math.PI * 2); CTX.clip();
                    const bellyG = CTX.createLinearGradient(-r, 0, r, 0);
                    bellyG.addColorStop(0, 'rgba(0,0,0,0)');
                    bellyG.addColorStop(0.35, 'rgba(167,243,208,0.18)');
                    bellyG.addColorStop(0.5, 'rgba(236,253,245,0.42)');
                    bellyG.addColorStop(0.65, 'rgba(167,243,208,0.18)');
                    bellyG.addColorStop(1, 'rgba(0,0,0,0)');
                    CTX.fillStyle = bellyG; CTX.fillRect(-r, -r, r * 2, r * 2);
                    CTX.restore();
                }

                // Dorsal spine ridge — triangular spikes along back
                if (r > 8) {
                    const spineA = Math.atan2(
                        this.segments[Math.max(i - 1, 0)].y - seg.y,
                        this.segments[Math.max(i - 1, 0)].x - seg.x
                    );
                    const perpX = Math.cos(spineA + Math.PI / 2);
                    const perpY = Math.sin(spineA + Math.PI / 2);
                    const fwdX = Math.cos(spineA);
                    const fwdY = Math.sin(spineA);
                    const sp = 0.45 + Math.sin(now / 220 + i * 0.8) * 0.30;
                    const spikeH = r * (0.28 + Math.sin(now / 220 + i * 0.8) * 0.07);
                    const spikeW = r * 0.13;
                    const baseR = r * 0.46;
                    CTX.fillStyle = `rgba(52,211,153,${sp * 0.88})`;
                    CTX.shadowBlur = 7 * sp; CTX.shadowColor = '#34d399';
                    CTX.beginPath();
                    CTX.moveTo(screen.x + perpX * baseR - fwdX * spikeW, screen.y + perpY * baseR - fwdY * spikeW);
                    CTX.lineTo(screen.x + perpX * (baseR + spikeH), screen.y + perpY * (baseR + spikeH));
                    CTX.lineTo(screen.x + perpX * baseR + fwdX * spikeW, screen.y + perpY * baseR + fwdY * spikeW);
                    CTX.closePath(); CTX.fill();
                    CTX.shadowBlur = 0;
                }

                // Thai gold ring every 3rd segment (denser than before)
                if (i % 3 === 0 && r > 7) {
                    const rp = 0.45 + Math.sin(now / 220 + i * 0.55) * 0.45;
                    CTX.strokeStyle = `rgba(251,191,36,${rp * 0.85})`;
                    CTX.lineWidth = r > 12 ? 2.0 : 1.4;
                    CTX.shadowBlur = 8 * rp; CTX.shadowColor = '#fbbf24';
                    CTX.beginPath(); CTX.arc(screen.x, screen.y, r * 0.84, 0, Math.PI * 2); CTX.stroke();
                    CTX.shadowBlur = 0;
                }

                // Scale arc texture (only on thick segments)
                if (r > 10) {
                    CTX.save();
                    CTX.translate(screen.x, screen.y);
                    CTX.beginPath(); CTX.arc(0, 0, r, 0, Math.PI * 2); CTX.clip();
                    CTX.strokeStyle = 'rgba(4,120,87,0.35)'; CTX.lineWidth = 0.8;
                    for (let arc = 0; arc < 3; arc++) {
                        CTX.beginPath();
                        CTX.arc(0, -r * 0.15 + arc * r * 0.42, r * 0.82, Math.PI, Math.PI * 2);
                        CTX.stroke();
                    }
                    CTX.restore();
                }

                // Venom drip — animated drop beneath every 4th segment
                if (r > 9 && i % 4 === 2) {
                    const dripPhase = ((now / 720) + i * 0.55) % 1.0;
                    const dripDist = r * 0.55 + dripPhase * r * 1.9;
                    const dripAlpha = Math.max(0, 1 - dripPhase * 1.1) * lifeRatio * 0.65;
                    const dripR = Math.max(0.8, r * 0.13 * (1 - dripPhase * 0.55));
                    if (dripAlpha > 0.05) {
                        CTX.fillStyle = `rgba(16,185,129,${dripAlpha})`;
                        CTX.shadowBlur = 5 * dripAlpha; CTX.shadowColor = '#10b981';
                        CTX.beginPath(); CTX.arc(screen.x, screen.y + dripDist, dripR, 0, Math.PI * 2); CTX.fill();
                        // Elongated drip trail
                        CTX.globalAlpha *= 0.5;
                        CTX.beginPath(); CTX.arc(screen.x, screen.y + dripDist - dripR * 1.5, dripR * 0.6, 0, Math.PI * 2); CTX.fill();
                        CTX.globalAlpha = Math.max(0.08, alpha); // restore alpha
                        CTX.shadowBlur = 0;
                    }
                }
            }
            CTX.restore();
        }

        // ── PASS 3: head ──────────────────────────────────────
        if (n > 0) {
            const head = this.segments[0];
            const hs = worldToScreen(head.x, head.y);
            const r = this.radius;
            const headAlpha = lifeRatio;

            let headAngle = 0;
            if (n > 1) {
                headAngle = Math.atan2(head.y - this.segments[1].y, head.x - this.segments[1].x);
            }

            CTX.save();
            CTX.translate(hs.x, hs.y);
            CTX.rotate(headAngle);
            CTX.globalAlpha = Math.max(0.15, headAlpha);

            // Outer aura ring
            const auraR = r * 2.0 + Math.sin(now / 115) * 4;
            CTX.globalAlpha = headAlpha * (0.30 + Math.sin(now / 155) * 0.15);
            CTX.strokeStyle = '#34d399'; CTX.lineWidth = 2.5;
            CTX.shadowBlur = 20 + Math.sin(now / 125) * 10; CTX.shadowColor = '#10b981';
            CTX.beginPath(); CTX.arc(0, 0, auraR, 0, Math.PI * 2); CTX.stroke();
            CTX.shadowBlur = 0;
            CTX.globalAlpha = Math.max(0.15, headAlpha);

            // Head shape — wider snout, flatter profile
            const headGrad = CTX.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.05, 0, 0, r * 1.15);
            headGrad.addColorStop(0, '#a7f3d0');
            headGrad.addColorStop(0.30, '#34d399');
            headGrad.addColorStop(0.65, '#059669');
            headGrad.addColorStop(1, '#022c22');
            CTX.fillStyle = headGrad;
            CTX.shadowBlur = 24; CTX.shadowColor = '#10b981';
            CTX.beginPath();
            CTX.moveTo(r * 1.45, 0);
            CTX.quadraticCurveTo(r * 1.15, -r * 0.75, r * 0.1, -r * 0.90);
            CTX.quadraticCurveTo(-r * 0.55, -r * 0.95, -r * 1.05, -r * 0.50);
            CTX.quadraticCurveTo(-r * 1.20, 0, -r * 1.05, r * 0.50);
            CTX.quadraticCurveTo(-r * 0.55, r * 0.95, r * 0.1, r * 0.90);
            CTX.quadraticCurveTo(r * 1.15, r * 0.75, r * 1.45, 0);
            CTX.closePath(); CTX.fill();
            CTX.shadowBlur = 0;

            // ── Mouth / fangs / tongue ─────────────────────────
            const mouthOpen = Math.max(0, Math.sin(now / 380)) * r * 0.28;
            // Dark inner mouth gap
            CTX.fillStyle = '#001208';
            CTX.beginPath();
            CTX.ellipse(r * 1.28, 0, r * 0.18, mouthOpen + r * 0.04, 0, 0, Math.PI * 2);
            CTX.fill();
            // Fangs (visible when mouth opens)
            if (mouthOpen > r * 0.04) {
                const fY = mouthOpen * 0.65;
                CTX.fillStyle = '#f0f9ff';
                CTX.shadowBlur = 4; CTX.shadowColor = 'rgba(148,163,184,0.5)';
                CTX.beginPath(); // upper fang
                CTX.moveTo(r * 1.18, -fY * 0.25);
                CTX.lineTo(r * 1.28, -fY * 0.12);
                CTX.lineTo(r * 1.23, fY * 0.80);
                CTX.closePath(); CTX.fill();
                CTX.beginPath(); // lower fang
                CTX.moveTo(r * 1.18, fY * 0.25);
                CTX.lineTo(r * 1.28, fY * 0.12);
                CTX.lineTo(r * 1.23, -fY * 0.80);
                CTX.closePath(); CTX.fill();
                CTX.shadowBlur = 0;
            }
            // Forked tongue (darts out phase-locked to mouth)
            const tongueOut = Math.max(0, Math.sin(now / 380 - 0.55));
            if (tongueOut > 0.15) {
                CTX.save();
                CTX.globalAlpha = headAlpha * tongueOut;
                const tLen = r * 0.60 * tongueOut;
                CTX.strokeStyle = '#ef4444'; CTX.lineWidth = 2.2; CTX.lineCap = 'round';
                CTX.shadowBlur = 8; CTX.shadowColor = '#dc2626';
                CTX.beginPath(); CTX.moveTo(r * 1.38, 0); CTX.lineTo(r * 1.38 + tLen * 0.65, 0); CTX.stroke();
                CTX.beginPath(); CTX.moveTo(r * 1.38 + tLen * 0.65, 0); CTX.lineTo(r * 1.38 + tLen, -r * 0.17); CTX.stroke();
                CTX.beginPath(); CTX.moveTo(r * 1.38 + tLen * 0.65, 0); CTX.lineTo(r * 1.38 + tLen, r * 0.17); CTX.stroke();
                CTX.shadowBlur = 0;
                CTX.restore();
            }

            // Crown jewel on forehead
            const crownP = 0.65 + Math.sin(now / 140) * 0.35;
            CTX.fillStyle = `rgba(251,191,36,${crownP})`;
            CTX.shadowBlur = 28 * crownP; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.ellipse(0, -r * 0.68, r * 0.18, r * 0.13, 0, 0, Math.PI * 2); CTX.fill();
            // Crown inner highlight
            CTX.fillStyle = `rgba(255,251,235,${crownP * 0.70})`;
            CTX.shadowBlur = 0;
            CTX.beginPath(); CTX.ellipse(-r * 0.02, -r * 0.70, r * 0.07, r * 0.05, 0, 0, Math.PI * 2); CTX.fill();

            // Horns — taller, more elegant
            CTX.strokeStyle = '#fbbf24'; CTX.lineWidth = 3.5; CTX.lineCap = 'round';
            CTX.shadowBlur = 12; CTX.shadowColor = '#f59e0b';
            CTX.beginPath();
            CTX.moveTo(-r * 0.25, -r * 0.60);
            CTX.quadraticCurveTo(-r * 0.65, -r * 1.55, -r * 0.05, -r * 2.10);
            CTX.stroke();
            CTX.beginPath();
            CTX.moveTo(r * 0.25, -r * 0.60);
            CTX.quadraticCurveTo(r * 0.65, -r * 1.55, r * 0.05, -r * 2.10);
            CTX.stroke();
            // Horn tips glow
            CTX.fillStyle = '#fef08a'; CTX.shadowBlur = 18; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(-r * 0.05, -r * 2.10, 3.0, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.arc(r * 0.05, -r * 2.10, 3.0, 0, Math.PI * 2); CTX.fill();
            CTX.shadowBlur = 0;

            // Mane strands — more, longer, greener
            const manePhase = now / 190;
            CTX.lineWidth = 2.8; CTX.lineCap = 'round';
            const maneStrands = [
                { baseY: -r * 0.45, cp1x: -r * 1.8, cp1y: -r * 0.3, endX: -r * 1.6, endY: r * 0.6, phase: 0.0 },
                { baseY: -r * 0.10, cp1x: -r * 2.0, cp1y: r * 0.5, endX: -r * 1.4, endY: r * 1.2, phase: 0.6 },
                { baseY: r * 0.30, cp1x: -r * 1.6, cp1y: r * 1.1, endX: -r * 0.9, endY: r * 1.8, phase: 1.2 },
                { baseY: r * 0.65, cp1x: -r * 1.1, cp1y: r * 1.6, endX: -r * 0.5, endY: r * 2.2, phase: 1.8 },
                { baseY: -r * 0.45, cp1x: r * 1.8, cp1y: -r * 0.3, endX: r * 1.6, endY: r * 0.6, phase: 0.3 },
                { baseY: -r * 0.10, cp1x: r * 2.0, cp1y: r * 0.5, endX: r * 1.4, endY: r * 1.2, phase: 0.9 },
                { baseY: r * 0.30, cp1x: r * 1.6, cp1y: r * 1.1, endX: r * 0.9, endY: r * 1.8, phase: 1.5 },
                { baseY: r * 0.65, cp1x: r * 1.1, cp1y: r * 1.6, endX: r * 0.5, endY: r * 2.2, phase: 2.1 },
            ];
            for (const ms of maneStrands) {
                const isLeft = ms.cp1x < 0;
                const flutter = Math.sin(manePhase + ms.phase) * r * 0.40;
                const side = isLeft ? -1 : 1;
                const mAlpha = headAlpha * (0.55 + Math.sin(manePhase + ms.phase) * 0.30);
                CTX.globalAlpha = Math.max(0, mAlpha);
                CTX.strokeStyle = '#6ee7b7'; CTX.shadowBlur = 9; CTX.shadowColor = '#10b981';
                CTX.beginPath();
                CTX.moveTo(0, ms.baseY);
                CTX.quadraticCurveTo(ms.cp1x + flutter * side, ms.cp1y, ms.endX + flutter * side * 0.5, ms.endY);
                CTX.stroke();
            }
            CTX.globalAlpha = Math.max(0.15, headAlpha);
            CTX.shadowBlur = 0;

            // Eyes — larger, more intense
            const eyeGlow = 0.70 + Math.sin(now / 130) * 0.30;
            CTX.fillStyle = `rgba(245,158,11,${eyeGlow})`;
            CTX.shadowBlur = 32 * eyeGlow; CTX.shadowColor = '#f59e0b';
            CTX.beginPath(); CTX.ellipse(r * 0.38, -r * 0.32, r * 0.32, r * 0.22, 0, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.ellipse(r * 0.38, r * 0.32, r * 0.32, r * 0.22, 0, 0, Math.PI * 2); CTX.fill();
            CTX.shadowBlur = 0;
            // Slit pupils
            CTX.fillStyle = '#0f172a';
            CTX.beginPath(); CTX.ellipse(r * 0.42, -r * 0.32, r * 0.09, r * 0.18, 0, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.ellipse(r * 0.42, r * 0.32, r * 0.09, r * 0.18, 0, 0, Math.PI * 2); CTX.fill();
            // Eye shine
            CTX.fillStyle = `rgba(255,251,235,${eyeGlow * 0.75})`;
            CTX.beginPath(); CTX.arc(r * 0.34, -r * 0.37, r * 0.08, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.arc(r * 0.34, r * 0.27, r * 0.08, 0, Math.PI * 2); CTX.fill();

            // ── Low-life danger pulse ──────────────────────────
            if (lifeRatio < 0.30) {
                const dangerP = 0.5 + Math.sin(now / 90) * 0.5;
                CTX.save();
                CTX.globalAlpha = ((0.30 - lifeRatio) / 0.30) * dangerP * 0.80;
                CTX.strokeStyle = '#ef4444'; CTX.lineWidth = 3.5;
                CTX.shadowBlur = 24; CTX.shadowColor = '#dc2626';
                CTX.beginPath(); CTX.arc(0, 0, r * 1.70, 0, Math.PI * 2); CTX.stroke();
                CTX.shadowBlur = 0;
                CTX.restore();
            }

            CTX.restore();

            // Timer label above head
            CTX.save();
            CTX.globalAlpha = headAlpha * 0.85;
            CTX.fillStyle = '#34d399';
            CTX.font = 'bold 10px Arial'; CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.shadowBlur = 6; CTX.shadowColor = '#10b981';
            CTX.fillText(`${this.life.toFixed(1)}s`, hs.x, hs.y - r * 2.6);
            CTX.shadowBlur = 0;
            CTX.restore();

            // Head pulse ring
            const pulse = 0.55 + Math.sin(now / 125) * 0.45;
            CTX.save();
            CTX.globalAlpha = lifeRatio * (0.40 + pulse * 0.45);
            CTX.strokeStyle = '#34d399'; CTX.lineWidth = 1.8;
            CTX.shadowBlur = 14 * pulse; CTX.shadowColor = '#10b981';
            CTX.beginPath(); CTX.arc(hs.x, hs.y, this.radius * 1.75, 0, Math.PI * 2); CTX.stroke();
            CTX.shadowBlur = 0;
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

        // ── Arms + rotors (quad) ─────────────────────────────
        const armAngle = this.orbitAngle * 2.5;
        const spin = this.wasOverdrive ? this.bobTimer * 22 : this.bobTimer * 9;
        CTX.save(); CTX.rotate(armAngle);
        for (let qi = 0; qi < 4; qi++) {
            CTX.save(); CTX.rotate((qi / 4) * Math.PI * 2);
            const AL = 22;
            // Arm strut (double-line)
            CTX.strokeStyle = '#334155'; CTX.lineWidth = 3.5;
            CTX.beginPath(); CTX.moveTo(0, 0); CTX.lineTo(AL, 0); CTX.stroke();
            CTX.strokeStyle = '#475569'; CTX.lineWidth = 1.8;
            CTX.beginPath(); CTX.moveTo(0, 0); CTX.lineTo(AL, 0); CTX.stroke();
            // Cross brace details
            CTX.strokeStyle = 'rgba(51,65,85,0.55)'; CTX.lineWidth = 0.8;
            CTX.beginPath(); CTX.moveTo(AL * 0.38, -2); CTX.lineTo(AL * 0.38, 2); CTX.stroke();
            CTX.beginPath(); CTX.moveTo(AL * 0.68, -2); CTX.lineTo(AL * 0.68, 2); CTX.stroke();
            // Nacelle
            CTX.fillStyle = '#293548'; CTX.strokeStyle = '#475569'; CTX.lineWidth = 1;
            CTX.beginPath(); CTX.arc(AL, 0, 5, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
            CTX.fillStyle = this.wasOverdrive ? `rgba(${rgbBase},0.55)` : '#3d4f63';
            CTX.beginPath(); CTX.arc(AL, 0, 2.5, 0, Math.PI * 2); CTX.fill();
            // Engine exhaust glow beneath nacelle
            const exhAlpha = 0.30 + Math.sin(this.bobTimer * 3.2 + qi * 1.57) * 0.15;
            const exhG = CTX.createRadialGradient(AL, 4, 0, AL, 7, 9);
            exhG.addColorStop(0, this.wasOverdrive ? `rgba(${rgbBase},${exhAlpha * 1.5})` : `rgba(0,229,255,${exhAlpha})`);
            exhG.addColorStop(1, 'rgba(0,0,0,0)');
            CTX.fillStyle = exhG;
            CTX.beginPath(); CTX.ellipse(AL, 5, 4.5, 7, 0, 0, Math.PI * 2); CTX.fill();
            // Blades (3 per nacelle, alternating direction)
            CTX.save(); CTX.translate(AL, 0); CTX.rotate(spin * (qi % 2 === 0 ? 1 : -1));
            for (let blade = 0; blade < 3; blade++) {
                const a = (blade / 3) * Math.PI * 2;
                const bladeG = CTX.createLinearGradient(0, 0, Math.cos(a) * 10, Math.sin(a) * 10);
                bladeG.addColorStop(0, this.wasOverdrive ? `rgba(${rgbBase},0.95)` : 'rgba(148,163,184,0.9)');
                bladeG.addColorStop(1, 'rgba(0,0,0,0)');
                CTX.strokeStyle = bladeG; CTX.lineWidth = 2.2;
                CTX.beginPath(); CTX.moveTo(0, 0); CTX.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); CTX.stroke();
            }
            CTX.restore();
            CTX.restore();
        }
        CTX.restore();

        // ── Rotating scan beam ───────────────────────────────
        const scanAngle = performance.now() / 920;
        CTX.save(); CTX.rotate(scanAngle);
        const beamLen = R + 40;
        const beamAlpha = 0.11 + Math.sin(performance.now() / 240) * 0.05;
        const beamG = CTX.createLinearGradient(0, 0, beamLen, 0);
        beamG.addColorStop(0, `rgba(${rgbBase},${beamAlpha + 0.10})`);
        beamG.addColorStop(0.65, `rgba(${rgbBase},${beamAlpha})`);
        beamG.addColorStop(1, 'rgba(0,0,0,0)');
        CTX.fillStyle = beamG;
        CTX.beginPath(); CTX.moveTo(0, 0); CTX.arc(0, 0, beamLen, -0.09, 0.09); CTX.closePath(); CTX.fill();
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

        // Hex vertex rivets
        CTX.fillStyle = '#475569';
        for (let vi = 0; vi < 6; vi++) {
            const va = (vi / 6) * Math.PI * 2 - Math.PI / 6;
            CTX.beginPath(); CTX.arc(Math.cos(va) * R, Math.sin(va) * R, 1.5, 0, Math.PI * 2); CTX.fill();
        }
        // Center cross structural detail
        CTX.strokeStyle = 'rgba(71,85,105,0.22)'; CTX.lineWidth = 0.6;
        CTX.beginPath(); CTX.moveTo(-R * 0.75, 0); CTX.lineTo(R * 0.75, 0); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(0, -R * 0.75); CTX.lineTo(0, R * 0.75); CTX.stroke();

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

        // Overdrive indicator arc + shockwave ring
        if (this.wasOverdrive) {
            CTX.save();
            CTX.globalAlpha = 0.55 + Math.sin(performance.now() / 150) * 0.25;
            CTX.strokeStyle = `rgba(${rgbBase},0.8)`;
            CTX.lineWidth = 2;
            CTX.shadowBlur = 12; CTX.shadowColor = glowColor;
            CTX.beginPath(); CTX.arc(bodyScreen.x, bodyScreen.y, S.radius + 7, Math.PI * 1.1, Math.PI * 1.9); CTX.stroke();
            CTX.restore();
            // Expanding shockwave ring
            const swPhase = (performance.now() % 900) / 900;
            const swR = (S.radius + 6) + swPhase * 24;
            CTX.save();
            CTX.globalAlpha = (1 - swPhase) * 0.60;
            CTX.strokeStyle = `rgba(${rgbBase},1.0)`;
            CTX.lineWidth = 2.5;
            CTX.shadowBlur = 16; CTX.shadowColor = glowColor;
            CTX.beginPath(); CTX.arc(bodyScreen.x, bodyScreen.y, swR, 0, Math.PI * 2); CTX.stroke();
            CTX.shadowBlur = 0;
            CTX.restore();
        }
    }
}
// ════════════════════════════════════════════════════════════
// 🦅 GARUDA ENTITY
// ════════════════════════════════════════════════════════════
const _GS = { ORBIT: 0, DIVE: 1, RETURN: 2 };

class GarudaEntity extends Entity {
    constructor(px, py, owner) {
        super(px, py, 18);
        this.owner = owner;
        const S = BALANCE.characters.poom;
        this.life = S.garudaDuration;
        this.maxLife = S.garudaDuration;
        this.active = true;
        this.orbitAngle = 0;
        this.facing = 0;
        this.state = _GS.ORBIT;
        this.diveCooldown = 0.5;
        this.diveTarget = null;
        this._trail = [];   // [{x,y,life,maxLife}]
    }

    _findNearest() {
        let best = null, bd = Infinity;
        for (const e of (window.enemies || [])) {
            if (e.dead) continue;
            const d = Math.hypot(e.x - this.x, e.y - this.y);
            if (d < bd) { bd = d; best = e; }
        }
        if (window.boss && !window.boss.dead) {
            const d = Math.hypot(window.boss.x - this.x, window.boss.y - this.y);
            if (d < bd) best = window.boss;
        }
        return best;
    }

    update(dt, player, _meteorZones) {
        const S = BALANCE.characters.poom;
        this.life -= dt;
        if (this.life <= 0) {
            this.active = false;
            if (this.owner) this.owner.garuda = null;
            return true;
        }

        const owner = this.owner;
        const cosmic = owner?._cosmicBalance ?? false;
        const orbitR = S.garudaOrbitRadius * (cosmic ? S.cosmicGarudaRadiusMult : 1);

        // ── Trail decay (swap-pop) ─────────────────────────
        for (let i = this._trail.length - 1; i >= 0; i--) {
            this._trail[i].life -= dt;
            if (this._trail[i].life <= 0) {
                this._trail[i] = this._trail[this._trail.length - 1];
                this._trail.pop();
            }
        }

        if (this.state === _GS.ORBIT) {
            if (!owner) { this.active = false; return true; }   // owner null guard
            this.orbitAngle += S.garudaOrbitSpeed * dt;
            this.x = owner.x + Math.cos(this.orbitAngle) * orbitR;
            this.y = owner.y + Math.sin(this.orbitAngle) * orbitR;
            this.facing = this.orbitAngle + Math.PI * 0.5;
            this.diveCooldown -= dt;
            if (this.diveCooldown <= 0) {
                const t = this._findNearest();
                if (t) { this.diveTarget = t; this.state = _GS.DIVE; }
                else { this.diveCooldown = S.garudaDiveCooldown; }
            }

        } else if (this.state === _GS.DIVE) {
            if (!this.diveTarget || this.diveTarget.dead) {
                this.state = _GS.RETURN;
                this.diveCooldown = S.garudaDiveCooldown;
                return false;
            }
            const tx = this.diveTarget.x, ty = this.diveTarget.y;
            const dx = tx - this.x, dy = ty - this.y;
            const d = Math.hypot(dx, dy);
            this.facing = Math.atan2(dy, dx);

            if (Math.random() < 0.55) {
                this._trail.push({ x: this.x, y: this.y, life: 0.28, maxLife: 0.28 });
            }

            if (d < 26) {
                let dmg = S.garudaDamage * (owner?.damageMultiplier || 1);
                if (owner?.isEatingRice) dmg *= S.garudaEatRiceBonus;
                if (cosmic) dmg *= 1.20;

                const isBoss = this.diveTarget === window.boss;
                if (isBoss) {
                    this.diveTarget.takeDamage(dmg * 0.45);
                } else {
                    this.diveTarget.takeDamage(dmg, owner);
                }
                spawnParticles(tx, ty, 18, '#f97316');
                spawnFloatingText(Math.round(dmg), tx, ty - 40, '#fbbf24', 18);
                if (typeof Audio !== 'undefined' && Audio.playNagaAttack) Audio.playNagaAttack();
                this.diveTarget = null;
                this.state = _GS.RETURN;
                this.diveCooldown = S.garudaDiveCooldown;

            } else {
                const step = Math.min(S.garudaDiveSpeed * dt, d);
                this.x += (dx / d) * step;
                this.y += (dy / d) * step;
            }

        } else {    // RETURN
            if (!owner) { this.active = false; return true; }   // owner null guard
            const tx = owner.x + Math.cos(this.orbitAngle) * orbitR;
            const ty = owner.y + Math.sin(this.orbitAngle) * orbitR;
            const dx = tx - this.x, dy = ty - this.y;
            const d = Math.hypot(dx, dy);
            if (d < 18) {
                this.state = _GS.ORBIT;
            } else {
                this.facing = Math.atan2(dy, dx);
                const step = Math.min(S.garudaReturnSpeed * dt, d);
                this.x += (dx / d) * step;
                this.y += (dy / d) * step;
            }
        }

        return false;
    }

    draw() {
        if (typeof CTX === 'undefined') return;
        const sc = worldToScreen(this.x, this.y);
        if (!sc) return;
        // Viewport cull — DISABLED for debug
        // if (sc.x < -60 || sc.x > (CTX.canvas?.width ?? 9999) + 60 ||
        //     sc.y < -60 || sc.y > (CTX.canvas?.height ?? 9999) + 60) return;
        console.log('[Garuda.draw] sc:', sc.x.toFixed(0), sc.y.toFixed(0), 'canvas:', CTX.canvas?.width, CTX.canvas?.height, 'state:', this.state);

        const now = performance.now();
        const lifeRatio = this.life / this.maxLife;
        const isDiving = this.state === _GS.DIVE;
        const pulse = 0.75 + Math.sin(now / 120) * 0.25;

        // ── Fire trail ─────────────────────────────────────────
        for (const t of this._trail) {
            const ts = worldToScreen(t.x, t.y);
            if (!ts) continue;
            const a = (t.life / t.maxLife) * 0.75;
            const r = 5 + (1 - t.life / t.maxLife) * 4;
            CTX.save();
            CTX.globalAlpha = a * lifeRatio;
            CTX.shadowBlur = 10; CTX.shadowColor = '#f97316';
            const tg = CTX.createRadialGradient(ts.x, ts.y, 0, ts.x, ts.y, r);
            tg.addColorStop(0, '#fbbf24');
            tg.addColorStop(1, 'rgba(239,68,68,0)');
            CTX.fillStyle = tg;
            CTX.beginPath(); CTX.arc(ts.x, ts.y, r, 0, Math.PI * 2); CTX.fill();
            CTX.restore();
        }

        CTX.save();
        CTX.translate(sc.x, sc.y);
        CTX.rotate(this.facing);
        CTX.globalAlpha = lifeRatio * 0.95;

        const BL = isDiving ? 10 : 16;
        const BW = isDiving ? 5 : 9;
        const WL = isDiving ? 18 : 28;

        CTX.shadowBlur = 20 * pulse; CTX.shadowColor = '#f97316';

        // ── Wings ───────────────────────────────────────────────
        CTX.strokeStyle = `rgba(251,191,36,${0.6 + pulse * 0.3})`;
        CTX.lineWidth = 2.5;
        if (isDiving) {
            // Swept-back wings
            CTX.beginPath();
            CTX.moveTo(-BL * 0.3, 0);
            CTX.quadraticCurveTo(-BL * 0.5, -BW * 0.5, -WL * 0.9, BW * 0.6);
            CTX.stroke();
            CTX.beginPath();
            CTX.moveTo(-BL * 0.3, 0);
            CTX.quadraticCurveTo(-BL * 0.5, BW * 0.5, -WL * 0.9, -BW * 0.6);
            CTX.stroke();
        } else {
            // Spread wings
            CTX.beginPath();
            CTX.moveTo(0, -BW * 0.4);
            CTX.quadraticCurveTo(-BL * 0.3, -WL * 0.5, -WL, -WL * 0.3);
            CTX.stroke();
            CTX.beginPath();
            CTX.moveTo(0, BW * 0.4);
            CTX.quadraticCurveTo(-BL * 0.3, WL * 0.5, -WL, WL * 0.3);
            CTX.stroke();
            // Wing tip feathers
            CTX.globalAlpha = lifeRatio * 0.45;
            CTX.lineWidth = 1.5;
            for (let f = 0; f < 3; f++) {
                const ft = (f + 1) / 4;
                CTX.beginPath();
                CTX.moveTo(-WL * ft * 0.85, -WL * ft * 0.25);
                CTX.lineTo(-WL * ft * 0.85 - 5, -WL * ft * 0.55);
                CTX.stroke();
                CTX.beginPath();
                CTX.moveTo(-WL * ft * 0.85, WL * ft * 0.25);
                CTX.lineTo(-WL * ft * 0.85 - 5, WL * ft * 0.55);
                CTX.stroke();
            }
            CTX.globalAlpha = lifeRatio * 0.95;
            CTX.lineWidth = 2.5;
        }

        // ── Body (teardrop ellipse) ─────────────────────────────
        const bodyG = CTX.createLinearGradient(-BL, 0, BL, 0);
        bodyG.addColorStop(0, '#ef4444');
        bodyG.addColorStop(0.5, '#f97316');
        bodyG.addColorStop(1, '#fbbf24');
        CTX.fillStyle = bodyG;
        CTX.shadowBlur = 0;
        CTX.beginPath();
        CTX.ellipse(0, 0, BL, BW, 0, 0, Math.PI * 2);
        CTX.fill();

        // ── Eye ────────────────────────────────────────────────
        CTX.fillStyle = '#fbbf24';
        CTX.shadowBlur = 8 * pulse; CTX.shadowColor = '#fbbf24';
        CTX.beginPath(); CTX.arc(BL * 0.55, 0, 2.5, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = '#0f172a';
        CTX.shadowBlur = 0;
        CTX.beginPath(); CTX.arc(BL * 0.55, 0, 1.2, 0, Math.PI * 2); CTX.fill();

        // ── Cosmic Balance aura ring ────────────────────────────
        if (this.owner?._cosmicBalance) {
            CTX.globalAlpha = lifeRatio * (0.3 + pulse * 0.2);
            CTX.strokeStyle = '#fbbf24';
            CTX.lineWidth = 1.5;
            CTX.shadowBlur = 12; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.ellipse(0, 0, BL + 7, BW + 7, 0, 0, Math.PI * 2); CTX.stroke();
        }

        CTX.restore();
    }
}

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.NagaEntity = NagaEntity;
window.GarudaEntity = GarudaEntity;
window.Drone = Drone;
window.DroneEntity = Drone;   // alias — Debug.html checks 'DroneEntity'