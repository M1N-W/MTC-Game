'use strict';
const NAGA_SOUND_INTERVAL = 220;
// ════════════════════════════════════════════════════════════
// 🐍 NAGA ENTITY
// ════════════════════════════════════════════════════════════
class NagaEntity extends Entity {
    constructor(startX, startY, owner) {
        const S = BALANCE.characters.poom;
        super(startX, startY, S.nagaRadius);
        this.owner    = owner;
        const n       = S.nagaSegments;
        this.segments = Array.from({ length: n }, () => ({ x: startX, y: startY }));
        this.life     = S.nagaDuration;
        this.maxLife  = S.nagaDuration;
        this.speed    = S.nagaSpeed;
        this.damage   = S.nagaDamage * (owner.damageMultiplier || 1.0);
        this.active   = true;

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
            head.x += (dx/d)*step; head.y += (dy/d)*step;
        }

        // ── Segment chain following ────────────────────────────────────────────
        const segDist = S.nagaSegmentDistance;
        for (let i = 1; i < this.segments.length; i++) {
            const prev = this.segments[i-1], curr = this.segments[i];
            const sdx = curr.x - prev.x, sdy = curr.y - prev.y;
            const sd = Math.hypot(sdx, sdy);
            if (sd > segDist) { curr.x = prev.x+(sdx/sd)*segDist; curr.y = prev.y+(sdy/sd)*segDist; }
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
            const seg    = this.segments[i];
            const screen = worldToScreen(seg.x, seg.y);
            const t      = i / (this.segments.length - 1);
            const r      = this.radius * (1 - t * 0.55);
            const alpha  = lifeRatio * (1 - t * 0.3);

            CTX.save();
            CTX.globalAlpha = Math.max(0.1, alpha);

            if (i === this.segments.length - 1) {
                const prevSeg   = this.segments[i - 1];
                const tailAngle = Math.atan2(seg.y - prevSeg.y, seg.x - prevSeg.x);
                CTX.translate(screen.x, screen.y);
                CTX.rotate(tailAngle);
                CTX.fillStyle = '#065f46';
                CTX.shadowBlur = 4; CTX.shadowColor = '#10b981';
                CTX.beginPath();
                CTX.moveTo(-r, -r * 0.4);
                CTX.lineTo( r, -r * 0.4);
                CTX.lineTo( r * 2.5, 0);
                CTX.lineTo( r, r * 0.4);
                CTX.lineTo(-r, r * 0.4);
                CTX.closePath(); CTX.fill();
            } else {
                const isEven = i % 2 === 0;
                const scaleGrad = CTX.createRadialGradient(
                    screen.x - r * 0.25, screen.y - r * 0.25, 0,
                    screen.x, screen.y, r
                );
                scaleGrad.addColorStop(0, isEven ? '#34d399' : '#10b981');
                scaleGrad.addColorStop(0.6, isEven ? '#10b981' : '#059669');
                scaleGrad.addColorStop(1, '#064e3b');
                CTX.fillStyle = scaleGrad;
                CTX.shadowBlur  = 8 + Math.sin(now / 300 + i) * 3;
                CTX.shadowColor = '#10b981';
                CTX.beginPath(); CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2); CTX.fill();
                if (r > 7) {
                    CTX.strokeStyle = 'rgba(6,78,59,0.55)';
                    CTX.lineWidth   = 1.2;
                    CTX.beginPath(); CTX.arc(screen.x, screen.y, r * 0.65, 0, Math.PI * 2); CTX.stroke();
                }
            }
            CTX.restore();
        }

        if (this.segments.length > 0) {
            const head    = this.segments[0];
            const hs      = worldToScreen(head.x, head.y);
            const r       = this.radius;
            const headAlpha = lifeRatio;

            let headAngle = 0;
            if (this.segments.length > 1) {
                const neck = this.segments[1];
                headAngle  = Math.atan2(head.y - neck.y, head.x - neck.x);
            }

            CTX.save();
            CTX.translate(hs.x, hs.y);
            CTX.rotate(headAngle);
            CTX.globalAlpha = Math.max(0.15, headAlpha);

            const auraR = r * 1.8 + Math.sin(now / 120) * 3;
            CTX.globalAlpha = headAlpha * (0.4 + Math.sin(now / 160) * 0.2);
            CTX.strokeStyle = '#34d399'; CTX.lineWidth = 2;
            CTX.shadowBlur  = 16 + Math.sin(now / 130) * 8; CTX.shadowColor = '#10b981';
            CTX.beginPath(); CTX.arc(0, 0, auraR, 0, Math.PI * 2); CTX.stroke();

            CTX.globalAlpha = Math.max(0.15, headAlpha);

            const headGrad = CTX.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r * 1.1);
            headGrad.addColorStop(0, '#34d399');
            headGrad.addColorStop(0.5, '#059669');
            headGrad.addColorStop(1, '#064e3b');
            CTX.fillStyle = headGrad;
            CTX.shadowBlur  = 20; CTX.shadowColor = '#10b981';
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
            CTX.shadowBlur  = 10; CTX.shadowColor = '#f59e0b';
            CTX.beginPath();
            CTX.moveTo(-r * 0.3, -r * 0.65);
            CTX.quadraticCurveTo(-r * 0.6, -r * 1.4, -r * 0.1, -r * 1.8);
            CTX.stroke();
            CTX.beginPath();
            CTX.moveTo( r * 0.3, -r * 0.65);
            CTX.quadraticCurveTo( r * 0.6, -r * 1.4, r * 0.1, -r * 1.8);
            CTX.stroke();
            CTX.fillStyle = '#fef08a'; CTX.shadowBlur = 14; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(-r * 0.1, -r * 1.8, 2.5, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.arc( r * 0.1, -r * 1.8, 2.5, 0, Math.PI * 2); CTX.fill();
            CTX.shadowBlur = 0;

            const manePhase = now / 200;
            CTX.lineWidth = 2.5; CTX.lineCap = 'round';
            const maneStrands = [
                { side: -1, baseY: -r * 0.4, cp1x: -r * 1.6, cp1y: -r * 0.2, endX: -r * 1.4, endY: r * 0.5, phase: 0 },
                { side: -1, baseY: -r * 0.1, cp1x: -r * 1.8, cp1y:  r * 0.4, endX: -r * 1.2, endY: r * 1.0, phase: 0.7 },
                { side: -1, baseY:  r * 0.3, cp1x: -r * 1.4, cp1y:  r * 1.0, endX: -r * 0.8, endY: r * 1.5, phase: 1.4 },
                { side:  1, baseY: -r * 0.4, cp1x:  r * 1.6, cp1y: -r * 0.2, endX:  r * 1.4, endY: r * 0.5, phase: 0.3 },
                { side:  1, baseY: -r * 0.1, cp1x:  r * 1.8, cp1y:  r * 0.4, endX:  r * 1.2, endY: r * 1.0, phase: 1.0 },
                { side:  1, baseY:  r * 0.3, cp1x:  r * 1.4, cp1y:  r * 1.0, endX:  r * 0.8, endY: r * 1.5, phase: 1.7 },
            ];
            for (const ms of maneStrands) {
                const flutter = Math.sin(manePhase + ms.phase) * r * 0.35;
                const mAlpha  = headAlpha * (0.5 + Math.sin(manePhase + ms.phase) * 0.3);
                CTX.globalAlpha = Math.max(0, mAlpha);
                CTX.strokeStyle = '#6ee7b7'; CTX.shadowBlur = 8; CTX.shadowColor = '#10b981';
                CTX.beginPath();
                CTX.moveTo(0, ms.baseY);
                CTX.quadraticCurveTo(ms.cp1x + flutter * ms.side, ms.cp1y, ms.endX + flutter * ms.side * 0.5, ms.endY);
                CTX.stroke();
            }
            CTX.globalAlpha = Math.max(0.15, headAlpha);
            CTX.shadowBlur  = 0;

            const eyeGlow  = 0.6 + Math.sin(now / 180) * 0.4;
            const eyeColor = `rgba(245,158,11,${eyeGlow})`;
            CTX.fillStyle = eyeColor;
            CTX.shadowBlur  = 16 * eyeGlow; CTX.shadowColor = '#f59e0b';
            CTX.beginPath(); CTX.ellipse(r * 0.35, -r * 0.3, r * 0.28, r * 0.2, 0, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.ellipse(r * 0.35,  r * 0.3, r * 0.28, r * 0.2, 0, 0, Math.PI * 2); CTX.fill();
            CTX.fillStyle = '#0f172a'; CTX.shadowBlur = 0;
            CTX.beginPath(); CTX.ellipse(r * 0.38, -r * 0.3, r * 0.08, r * 0.16, 0, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.ellipse(r * 0.38,  r * 0.3, r * 0.08, r * 0.16, 0, 0, Math.PI * 2); CTX.fill();
            CTX.fillStyle = `rgba(255,251,235,${eyeGlow * 0.7})`;
            CTX.beginPath(); CTX.arc(r * 0.32, -r * 0.34, r * 0.07, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.arc(r * 0.32,  r * 0.26, r * 0.07, 0, Math.PI * 2); CTX.fill();

            CTX.restore();
            CTX.save();
            CTX.globalAlpha = headAlpha * 0.85;
            CTX.fillStyle   = '#34d399';
            CTX.font = 'bold 10px Arial'; CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(`${this.life.toFixed(1)}s`, hs.x, hs.y - r * 2.4);
            CTX.restore();

            const pulse = 0.6 + Math.sin(now / 130) * 0.4;
            CTX.save();
            CTX.globalAlpha  = lifeRatio * (0.5 + pulse * 0.4);
            CTX.strokeStyle  = '#34d399'; CTX.lineWidth = 1.5;
            CTX.shadowBlur   = 12 * pulse; CTX.shadowColor = '#10b981';
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
        this.targetAngle   = 0;
        this.hasTarget     = false;
        this.bobTimer      = Math.random() * Math.PI * 2;
        this.orbitAngle    = 0;
        this.lockTimer     = 0;
    }

    update(dt, player) {
        const S = BALANCE.drone;
        this.bobTimer   += dt * S.bobSpeed;
        this.orbitAngle += dt * S.orbitSpeed;
        this.lockTimer  += dt;
        if (this.shootCooldown > 0) this.shootCooldown -= dt;

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
                this.hasTarget   = true;
                this.lockTimer   = 0;
                projectileManager.add(new Projectile(
                    this.x, this.y, this.targetAngle,
                    S.projectileSpeed, S.damage, S.projectileColor, false, 'player'
                ));
                this.shootCooldown = 1.0 / S.fireRate;
                spawnParticles(this.x, this.y, 2, S.projectileColor);
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
        const S         = BALANCE.drone;
        const bobOffset = Math.sin(this.bobTimer) * S.bobAmplitude;
        const groundScreen = worldToScreen(this.x, this.y);
        const bodyScreen   = worldToScreen(this.x, this.y + bobOffset);

        const shadowAlpha = 0.15 + (1-(bobOffset+S.bobAmplitude)/(S.bobAmplitude*2))*0.2;
        const shadowScale = 0.8  + (1-(bobOffset+S.bobAmplitude)/(S.bobAmplitude*2))*0.2;
        CTX.save();
        CTX.globalAlpha = Math.max(0.05, shadowAlpha);
        CTX.fillStyle   = 'rgba(0,0,0,0.6)';
        CTX.beginPath();
        CTX.ellipse(groundScreen.x, groundScreen.y+22, 16*shadowScale, 5*shadowScale, 0,0,Math.PI*2);
        CTX.fill(); CTX.restore();

        if (this.hasTarget) {
            const arcAlpha = 0.5+Math.sin(this.lockTimer*12)*0.3;
            CTX.save(); CTX.globalAlpha=arcAlpha; CTX.strokeStyle='#00e5ff';
            CTX.lineWidth=1.5; CTX.shadowBlur=8; CTX.shadowColor='#00e5ff';
            CTX.beginPath();
            CTX.arc(bodyScreen.x,bodyScreen.y,S.radius+8,this.targetAngle-0.6,this.targetAngle+0.6);
            CTX.stroke(); CTX.restore();
        }

        CTX.save();
        CTX.translate(bodyScreen.x, bodyScreen.y);

        const armAngle = this.orbitAngle * 2.5;
        CTX.save(); CTX.rotate(armAngle);
        for (let side=-1; side<=1; side+=2) {
            CTX.strokeStyle='#475569'; CTX.lineWidth=2.5;
            CTX.beginPath(); CTX.moveTo(0,0); CTX.lineTo(side*19,-3); CTX.stroke();
            CTX.fillStyle='#64748b';
            CTX.beginPath(); CTX.arc(side*19,-3,3.5,0,Math.PI*2); CTX.fill();
            const spin=this.bobTimer*8;
            CTX.save(); CTX.translate(side*19,-3); CTX.rotate(spin*side);
            CTX.strokeStyle='rgba(148,163,184,0.75)'; CTX.lineWidth=2;
            for(let blade=0;blade<4;blade++){
                const a=(blade/4)*Math.PI*2;
                CTX.beginPath(); CTX.moveTo(0,0); CTX.lineTo(Math.cos(a)*8,Math.sin(a)*8); CTX.stroke();
            }
            CTX.restore();
        }
        CTX.restore();

        const glowPulse=0.6+Math.sin(this.bobTimer*2)*0.4;
        CTX.shadowBlur=10*glowPulse; CTX.shadowColor='#00e5ff';
        CTX.fillStyle='#1e293b'; CTX.strokeStyle='#334155'; CTX.lineWidth=1.5;
        CTX.beginPath();
        for(let i=0;i<6;i++){
            const a=(i/6)*Math.PI*2-Math.PI/6, r=S.radius;
            if(i===0) CTX.moveTo(Math.cos(a)*r,Math.sin(a)*r);
            else      CTX.lineTo(Math.cos(a)*r,Math.sin(a)*r);
        }
        CTX.closePath(); CTX.fill(); CTX.stroke();

        CTX.strokeStyle=`rgba(0,229,255,${0.5+glowPulse*0.5})`;
        CTX.lineWidth=1.5; CTX.shadowBlur=14*glowPulse; CTX.shadowColor='#00e5ff';
        CTX.beginPath(); CTX.arc(0,0,5,0,Math.PI*2); CTX.stroke();
        CTX.fillStyle=`rgba(0,229,255,${0.7*glowPulse})`;
        CTX.beginPath(); CTX.arc(0,0,3,0,Math.PI*2); CTX.fill();
        CTX.fillStyle='rgba(255,255,255,0.8)';
        CTX.beginPath(); CTX.arc(-1,-1,1,0,Math.PI*2); CTX.fill();
        CTX.shadowBlur=0;

        CTX.save(); CTX.rotate(this.targetAngle);
        CTX.fillStyle='#475569'; CTX.strokeStyle='#64748b'; CTX.lineWidth=1;
        CTX.beginPath(); CTX.roundRect(4,-2.5,11,5,2); CTX.fill(); CTX.stroke();
        CTX.fillStyle=this.hasTarget?'#00e5ff':'#334155';
        CTX.fillRect(13,-1.5,3,3);
        CTX.restore();

        CTX.restore();

        CTX.save(); CTX.globalAlpha=0.45; CTX.fillStyle='#94a3b8';
        CTX.font='bold 6px Arial'; CTX.textAlign='center'; CTX.textBaseline='middle';
        CTX.fillText('DRONE', bodyScreen.x, bodyScreen.y+S.radius+9);
        CTX.restore();
    }
}
// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.NagaEntity   = NagaEntity;
window.Drone        = Drone;
window.DroneEntity  = Drone;   // alias — Debug.html checks 'DroneEntity'