'use strict';

// ════════════════════════════════════════════════════════════
// 🌾 POOM PLAYER
// ════════════════════════════════════════════════════════════
class PoomPlayer extends Entity {
    constructor() {
        const stats = BALANCE.characters.poom;
        super(0, 0, stats.radius);

        this.charId = 'poom';
        this.stats = stats;

        this.hp = stats.hp; this.maxHp = stats.maxHp;
        this.energy = stats.energy; this.maxEnergy = stats.maxEnergy;

        this.cooldowns = { dash: 0, eat: 0, naga: 0, shoot: 0, ritual: 0 };

        this.isDashing = false; this.isInvisible = false; this.ambushReady = false;
        this.passiveUnlocked = false; this.stealthUseCount = 0; this.goldenAuraTimer = 0;

        this.walkCycle = 0;
        this.damageBoost = 1; this.speedBoost = 1; this.speedBoostTimer = 0;
        this.dashGhosts = [];

        // ── Timeout Management ───────────────────────────────────
        this.dashTimeouts = [];

        // ── Stand-Aura & Afterimage system ────────────────────
        this.standGhosts = [];
        this.auraRotation = 0;
        this._auraFrame = 0;

        this.onGraph = false;
        this.isConfused = false; this.confusedTimer = 0;
        this.isBurning = false; this.burnTimer = 0; this.burnDamage = 0;

        this.isEatingRice = false; this.eatRiceTimer = 0;
        this.currentSpeedMult = 1;
        this.nagaCount = 0;
        this.naga = null;

        // ── Session C: Legacy sticky system removed - using StatusEffect framework ──
        this.ritualPoints = 0;
        this.nagaRiteState = {
            active: false,
            castRemaining: 0,
            windowRemaining: 0,
            cooldownRemaining: 0
        };

        // ── Collision Awareness state ──────────────────────────
        this.obstacleBuffTimer = 0;
        this.lastObstacleWarning = 0;

        // ── Combo System Initialization ─────────────────────────
        this.comboCount = 0;
        this.comboTimer = 0;
        this.COMBO_MAX_TIME = 3.0;
        this.COMBO_MAX_STACKS = 50;

        this.level = 1; this.exp = 0;
        this.expToNextLevel = stats.expToNextLevel;
        this.baseCritChance = stats.critChance;

        // ── RPG Scaling Multipliers ─────────────────────────────
        this._damageMultiplier = 1.0;
        Object.defineProperty(this, 'damageMultiplier', {
            get: function () {
                const combo = this.comboCount || 0;
                return this._damageMultiplier * (1 + (combo * 0.01));
            },
            set: function (val) {
                const comboMult = 1 + ((this.comboCount || 0) * 0.01);
                const diff = val - (this._damageMultiplier * comboMult);
                this._damageMultiplier += diff;
            }
        });
        this.cooldownMultiplier = 1.0;
    }

    // ── Second Wind: computed live, no timer needed ──────────
    get isSecondWind() {
        return this.hp > 0 && (this.hp / this.maxHp) <= (BALANCE.player.secondWindHpPct || 0.2);
    }

    update(dt, keys, mouse) {
        const S = this.stats;
        const PHY = BALANCE.physics;

        // ── Combo System Update ────────────────────────────────
        if (this.comboCount > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.comboCount = 0;
                this.comboTimer = 0;
            }
        }

        if (this.isBurning) {
            this.burnTimer -= dt; this.hp -= this.burnDamage * dt;
            if (this.burnTimer <= 0) this.isBurning = false;
            if (Math.random() < 0.3) spawnParticles(this.x + rand(-15, 15), this.y + rand(-15, 15), 1, '#f59e0b');
        }
        if (this.isConfused) {
            this.confusedTimer -= dt;
            if (this.confusedTimer <= 0) { this.isConfused = false; this.confusedTimer = 0; }
        }
        if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;
        // ── goldenAuraTimer tick (was missing from PoomPlayer) ──
        if (this.goldenAuraTimer > 0) {
            this.goldenAuraTimer -= dt;
            if (Math.random() < 0.5) spawnParticles(this.x + rand(-25, 25), this.y + rand(-25, 25), 1, '#fbbf24');
        }

        if (this.isEatingRice) {
            this.eatRiceTimer -= dt;
            this.currentSpeedMult = S.eatRiceSpeedMult;
            if (Math.random() < 0.2) spawnParticles(this.x + rand(-20, 20), this.y + rand(-20, 20), 1, '#fbbf24');
            if (this.eatRiceTimer <= 0) {
                this.isEatingRice = false;
                this.currentSpeedMult = 1;
                spawnFloatingText('หมดฤทธิ์!', this.x, this.y - 40, '#94a3b8', 14);
            }
        }

        let ax = 0, ay = 0, isTouchMove = false;
        if (window.touchJoystickLeft && window.touchJoystickLeft.active) {
            ax = window.touchJoystickLeft.nx; ay = window.touchJoystickLeft.ny; isTouchMove = true;
        } else {
            if (keys.w) ay -= 1; if (keys.s) ay += 1;
            if (keys.a) ax -= 1; if (keys.d) ax += 1;
        }
        if (this.isConfused) { ax *= -1; ay *= -1; }
        if (ax || ay) {
            if (!isTouchMove) { const len = Math.hypot(ax, ay); ax /= len; ay /= len; }
            this.walkCycle += dt * 15;
        } else { this.walkCycle = 0; }

        let speedMult = this.currentSpeedMult * this.speedBoost;
        if (this.speedBoostTimer > 0) speedMult += S.speedOnHit / S.moveSpeed;
        if (this.obstacleBuffTimer > 0) speedMult *= BALANCE.player.obstacleBuffPower;

        // ── Apply Combo Speed Buff ──
        speedMult *= (1 + ((this.comboCount || 0) * 0.01));
        // ── Second Wind Speed Buff ──
        if (this.isSecondWind) {
            speedMult *= (BALANCE.player.secondWindSpeedMult || 1.3);
            if (Math.random() < 0.1) spawnParticles(this.x + rand(-15, 15), this.y + rand(-15, 15), 1, '#ef4444');
        }

        if (!this.isDashing) {
            this.vx += ax * PHY.acceleration * dt;
            this.vy += ay * PHY.acceleration * dt;
            this.vx *= PHY.friction;
            this.vy *= PHY.friction;
            const cs = Math.hypot(this.vx, this.vy);
            if (cs > S.moveSpeed * speedMult) {
                const scale = S.moveSpeed * speedMult / cs;
                this.vx *= scale; this.vy *= scale;
            }
        }
        this.applyPhysics(dt);
        this.x = clamp(this.x, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);
        this.y = clamp(this.y, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);

        if (!this.isDashing) {
            this.checkObstacleProximity(ax, ay, dt, '#fcd34d');
        }

        if (this.cooldowns.dash > 0) this.cooldowns.dash -= dt;
        if (this.cooldowns.eat > 0) this.cooldowns.eat -= dt;
        if (this.cooldowns.naga > 0) this.cooldowns.naga -= dt;
        if (this.cooldowns.shoot > 0) this.cooldowns.shoot -= dt;
        if (this.cooldowns.ritual > 0) this.cooldowns.ritual -= dt; // ── Phase 3 Session 2 ──

        // ── Update Sticky Stack Expiration ─────────────────────
        spawnParticles(this.x, this.y, 30, '#fbbf24');
        spawnFloatingText('กินข้าวเหนียว!', this.x, this.y - 50, '#fbbf24', 22);
        showVoiceBubble('อร่อยแท้ๆ!', this.x, this.y - 40);
        addScreenShake(5); Audio.playPowerUp();
    }

    summonNaga() {
        const S = this.stats;
        this.cooldowns.naga = S.nagaCooldown * this.cooldownMultiplier;
        this.naga = new NagaEntity(this.x, this.y, this);
        window.specialEffects.push(this.naga);
        spawnParticles(this.x, this.y, 40, '#10b981');
        spawnFloatingText('อัญเชิญพญานาค!', this.x, this.y - 60, '#10b981', 24);
        showVoiceBubble('ขอพรพญานาค!', this.x, this.y - 40);
        addScreenShake(10); Audio.playAchievement();
        this.nagaCount++;
        if (this.nagaCount >= 3) Achievements.check('naga_summoner');
    }

    // ════════════════════════════════════════════════════════════
    // 🌾 RITUAL BURST — Phase 3 Session 1
    // Consumes all sticky stacks and deals bonus damage to each
    // stacked enemy. Triggered by Shift+R.
    // CONSTRAINT: Only runs on key press, never every frame.
    // CONSTRAINT: Does not affect projectile or slow logic.
    // ════════════════════════════════════════════════════════════
    ritualBurst() {
        // ── Session C: Temporary stub - Session D will implement StatusEffect integration ──
        console.log('[Poom] ritualBurst called - awaiting Session D implementation');
        // TODO Session D: Iterate world.enemies, read enemy.getStatus('sticky'), deal damage, remove status

        // ── Phase 3 Session 2: set cooldown after confirmed consume ──
        // Placed here (not at call site) so empty-stack early return
        // above does NOT trigger cooldown.
        this.cooldowns.ritual = GAME_CONFIG?.abilities?.ritual?.cooldown || 20;

        spawnParticles(this.x, this.y, 30, '#00ff88');
        spawnFloatingText('RITUAL BURST!', this.x, this.y - 50, '#00ff88', 22);
        addScreenShake(6);
    }

    dash(ax, ay) {
        const S = this.stats;
        if (this.isDashing) return;
        this.isDashing = true;
        this.cooldowns.dash = S.dashCooldown * this.cooldownMultiplier;
        const angle = (ax === 0 && ay === 0) ? this.angle : Math.atan2(ay, ax);
        let dashSpeed = S.dashDistance / 0.2;
        let currentScale = 1.0;
        if (typeof window.timeScale === 'number' && Number.isFinite(window.timeScale)) {
            currentScale = window.timeScale;
        }
        currentScale = Math.min(10.0, Math.max(0.1, currentScale));
        if (currentScale < 1.0) {
            const matrixMult = (1 / currentScale) * 1.5;
            dashSpeed *= matrixMult;
        }
        this.vx = Math.cos(angle) * dashSpeed;
        this.vy = Math.sin(angle) * dashSpeed;
        for (let i = 0; i < 5; i++) {
            const timeoutId = setTimeout(() => {
                if (!this.dead) this.dashGhosts.push({ x: this.x, y: this.y, angle: this.angle, life: 1 });
                const idx = this.dashTimeouts.indexOf(timeoutId);
                if (idx > -1) this.dashTimeouts.splice(idx, 1);
            }, i * 30);
            this.dashTimeouts.push(timeoutId);
        }
        spawnParticles(this.x, this.y, 15, '#fbbf24');
        Audio.playDash(); Achievements.stats.dashes++; Achievements.check('speedster');
        const dashEndTimeoutId = setTimeout(() => { if (!this.dead) this.isDashing = false; }, 200);
        this.dashTimeouts.push(dashEndTimeoutId);
    }

    takeDamage(amt) {
        if (this.naga && !this.naga.dead && this.naga.active) return;
        if (this.isDashing) return;
        // ── Energy Shield block ──────────────────────────────────
        if (this.hasShield) {
            this.hasShield = false;
            spawnFloatingText('🛡️ BLOCKED!', this.x, this.y - 40, '#8b5cf6', 22);
            spawnParticles(this.x, this.y, 20, '#c4b5fd');
            if (typeof Audio !== 'undefined' && Audio.playHit) Audio.playHit();
            return;
        }
        if (this.onGraph) { amt *= 2; spawnFloatingText('EXPOSED!', this.x, this.y - 40, '#ef4444', 16); }
        this.hp -= amt; this.hp = Math.max(0, this.hp);
        spawnFloatingText(Math.round(amt), this.x, this.y - 30, '#ef4444');
        spawnParticles(this.x, this.y, 8, '#ef4444');
        addScreenShake(8); Audio.playHit();
        Achievements.stats.damageTaken += amt;
        if (this.hp <= 0) window.endGame('defeat');
    }

    dealDamage(baseDamage) {
        const S = this.stats;
        let damage = baseDamage, isCrit = false;
        let critChance = this.baseCritChance;
        if (this.isEatingRice) critChance += S.eatRiceCritBonus;
        if (Math.random() < critChance) {
            damage *= S.critMultiplier; isCrit = true;
            if (this.passiveUnlocked) this.goldenAuraTimer = 1;
            Achievements.stats.crits++; Achievements.check('crit_master');
        }
        // ── Second Wind Damage Multiplier ──
        if (this.isSecondWind) {
            damage *= (BALANCE.player.secondWindDamageMult || 1.5);
        }
        // ── Passive Lifesteal ──
        if (this.passiveUnlocked) {
            const healAmount = damage * S.passiveLifesteal;
            this.hp = Math.min(this.maxHp, this.hp + healAmount);
            if (Math.random() < 0.3) spawnFloatingText(`+${Math.round(healAmount)}`, this.x, this.y - 35, '#10b981', 12);
        }
        return { damage, isCrit };
    }

    heal(amt) {
        this.hp = Math.min(this.maxHp, this.hp + amt);
        spawnFloatingText(`+${amt} HP`, this.x, this.y - 30, '#10b981');
        spawnParticles(this.x, this.y, 10, '#10b981'); Audio.playHeal();
    }

    addSpeedBoost() { this.speedBoostTimer = this.stats.speedOnHitDuration; }

    // ════════════════════════════════════════════════════════════
    // 🌾 STICKY RICE STACK SYSTEM
    // ════════════════════════════════════════════════════════════

    /**
     * Update sticky stack expiration using timestamps (not dt accumulation)
     * CONSTRAINT: Must be called once per frame in update()
     * CONSTRAINT: Uses performance.now() for frame-independent behavior
     */
        // ════════════════════════════════════════════════════════════
        // POOM — Anti-Flip v12
        // LAYER 1: Body (mirror via scale, no rotation).
        // LAYER 2: Kratib weapon + Hands (full rotate + conditional Y-flip).
        // ════════════════════════════════════════════════════════════
        const S = this.stats;

        // ── Orientation helper ────────────────────────────────────
        const isFacingLeft = Math.abs(this.angle) > Math.PI / 2;
        const facingSign = isFacingLeft ? -1 : 1;

        _standAura_draw(this, 'poom');

        // ── Dash ghost trail ──────────────────────────────────────
        for (const img of this.dashGhosts) {
            const s = worldToScreen(img.x, img.y);
            const ghostFacing = Math.abs(img.angle) > Math.PI / 2 ? -1 : 1;
            CTX.save();
            CTX.translate(s.x, s.y);
            CTX.scale(ghostFacing, 1);
            CTX.globalAlpha = img.life * 0.3;
            CTX.fillStyle = '#fbbf24';
            CTX.beginPath(); CTX.roundRect(-15, -12, 30, 24, 8); CTX.fill();
            CTX.restore();
        }

        const screen = worldToScreen(this.x, this.y);

        CTX.fillStyle = 'rgba(0,0,0,0.3)';
        CTX.beginPath(); CTX.ellipse(screen.x, screen.y + 25, 18, 8, 0, 0, Math.PI * 2); CTX.fill();

        // Eating-rice power aura
        if (this.isEatingRice) {
            const t = performance.now() / 200;
            const auraSize = 38 + Math.sin(t) * 6;
            const auraAlpha = 0.4 + Math.sin(t * 1.5) * 0.15;
            CTX.save();
            CTX.globalAlpha = auraAlpha;
            CTX.strokeStyle = '#fbbf24'; CTX.lineWidth = 4;
            CTX.shadowBlur = 25; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(screen.x, screen.y, auraSize, 0, Math.PI * 2); CTX.stroke();
            CTX.globalAlpha = auraAlpha * 0.35;
            CTX.beginPath(); CTX.arc(screen.x, screen.y, auraSize + 12, 0, Math.PI * 2); CTX.stroke();
            CTX.restore();
        }

        // Naga invincibility shield
        if (this.naga && this.naga.active) {
            const gt = performance.now() / 350;
            const shieldR = 36 + Math.sin(gt) * 4;
            const shieldA = 0.25 + Math.sin(gt * 1.3) * 0.12;
            CTX.save();
            CTX.globalAlpha = shieldA;
            CTX.strokeStyle = '#fbbf24'; CTX.lineWidth = 2.5;
            CTX.shadowBlur = 18; CTX.shadowColor = '#f59e0b';
            CTX.setLineDash([4, 4]);
            CTX.beginPath(); CTX.arc(screen.x, screen.y, shieldR, 0, Math.PI * 2); CTX.stroke();
            CTX.setLineDash([]);
            CTX.globalAlpha = shieldA * 0.4;
            CTX.beginPath(); CTX.arc(screen.x, screen.y, shieldR + 8, 0, Math.PI * 2); CTX.stroke();
            CTX.restore();
        }

        if (this.isConfused) { CTX.font = 'bold 24px Arial'; CTX.textAlign = 'center'; CTX.fillText('😵', screen.x, screen.y - 44); }
        if (this.isBurning) { CTX.font = 'bold 20px Arial'; CTX.fillText('🔥', screen.x + 20, screen.y - 35); }
        if (this.isEatingRice) { CTX.font = 'bold 18px Arial'; CTX.textAlign = 'center'; CTX.fillText('🍚', screen.x, screen.y - 44); }

        // Naga channeling aura + connection tether
        const nagaEntity = window.specialEffects &&
            window.specialEffects.find(e => e instanceof NagaEntity);
        const isChanneling = !!nagaEntity;
        if (isChanneling) {
            const ct = performance.now() / 220;
            const cr = 42 + Math.sin(ct) * 7;
            const ca = 0.55 + Math.sin(ct * 1.6) * 0.25;
            CTX.save();
            CTX.globalAlpha = ca;
            CTX.strokeStyle = '#10b981';
            CTX.lineWidth = 3.5 + Math.sin(ct * 2.1) * 1.5;
            CTX.shadowBlur = 24 + Math.sin(ct) * 10;
            CTX.shadowColor = '#10b981';
            CTX.beginPath(); CTX.arc(screen.x, screen.y, cr, 0, Math.PI * 2); CTX.stroke();
            CTX.globalAlpha = ca * 0.55;
            CTX.lineWidth = 1.5;
            CTX.shadowBlur = 10;
            CTX.beginPath(); CTX.arc(screen.x, screen.y, cr - 12, 0, Math.PI * 2); CTX.stroke();
            if (Math.random() < 0.35) {
                const sa = Math.random() * Math.PI * 2;
                CTX.globalAlpha = 0.9;
                CTX.fillStyle = '#34d399';
                CTX.shadowBlur = 8; CTX.shadowColor = '#10b981';
                CTX.beginPath(); CTX.arc(screen.x + Math.cos(sa) * cr, screen.y + Math.sin(sa) * cr, 2, 0, Math.PI * 2); CTX.fill();
            }
            CTX.restore();

            if (nagaEntity.segments && nagaEntity.segments.length > 0) {
                const nagaHead = nagaEntity.segments[0];
                const nagaScreen = worldToScreen(nagaHead.x, nagaHead.y);
                const lifeAlpha = Math.min(1, nagaEntity.life / nagaEntity.maxLife);
                const SEGS = 10;
                const pts = [];
                for (let i = 0; i <= SEGS; i++) {
                    const t = i / SEGS;
                    const bx = screen.x + (nagaScreen.x - screen.x) * t;
                    const by = screen.y + (nagaScreen.y - screen.y) * t;
                    const jAmp = Math.sin(t * Math.PI) * (8 + Math.sin(performance.now() / 80 + i) * 4);
                    const perp = Math.atan2(nagaScreen.y - screen.y, nagaScreen.x - screen.x) + Math.PI / 2;
                    const jit = (Math.random() - 0.5) * 2 * jAmp;
                    pts.push({ x: bx + Math.cos(perp) * jit, y: by + Math.sin(perp) * jit });
                }
                pts[0] = { x: screen.x, y: screen.y };
                pts[SEGS] = { x: nagaScreen.x, y: nagaScreen.y };

                const drawThread = (lw, alpha, color, blur) => {
                    CTX.save();
                    CTX.globalAlpha = lifeAlpha * alpha;
                    CTX.strokeStyle = color;
                    CTX.lineWidth = lw;
                    CTX.lineCap = 'round';
                    CTX.lineJoin = 'round';
                    CTX.shadowBlur = blur;
                    CTX.shadowColor = '#10b981';
                    CTX.beginPath();
                    CTX.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i <= SEGS; i++) CTX.lineTo(pts[i].x, pts[i].y);
                    CTX.stroke();
                    CTX.restore();
                };
                drawThread(5, 0.25, '#10b981', 18);
                drawThread(1.5, 0.85, '#6ee7b7', 8);

                CTX.save();
                CTX.globalAlpha = lifeAlpha * (0.7 + Math.sin(performance.now() / 120) * 0.3);
                CTX.fillStyle = '#34d399';
                CTX.shadowBlur = 14; CTX.shadowColor = '#10b981';
                CTX.beginPath(); CTX.arc(screen.x, screen.y, 4, 0, Math.PI * 2); CTX.fill();
                CTX.restore();
            }
        }

        // Breathing squash/stretch
        const now2 = performance.now();
        const breathePoom = Math.sin(Date.now() / 200);
        const speed2 = Math.hypot(this.vx, this.vy);
        const moveT2 = Math.min(1, speed2 / 190);
        const bobT2 = Math.sin(this.walkCycle);
        const stretchX2 = 1 + breathePoom * 0.035 + moveT2 * bobT2 * 0.12;
        const stretchY2 = 1 - breathePoom * 0.035 - moveT2 * Math.abs(bobT2) * 0.09;

        const R2 = 13;

        // ════════════════════════════════════════════════════════════
        // LAYER 1 — BODY (horizontal mirror only, no rotation)
        // ════════════════════════════════════════════════════════════
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.scale(stretchX2 * facingSign, stretchY2);

        // Outer glow ring — purple (matches basic Enemy's corrupted-purple style)
        CTX.shadowBlur = 10; CTX.shadowColor = 'rgba(168,85,247,0.65)';
        CTX.strokeStyle = 'rgba(168,85,247,0.45)';
        CTX.lineWidth = 2;
        CTX.beginPath(); CTX.arc(0, 0, R2 + 2, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur = 0;

        // Base body — dark warm-brown radial gradient
        const poomBodyG = CTX.createRadialGradient(-3, -3, 1, 0, 0, R2);
        poomBodyG.addColorStop(0, '#3d2a14');
        poomBodyG.addColorStop(0.55, '#241808');
        poomBodyG.addColorStop(1, '#120d04');
        CTX.fillStyle = poomBodyG;
        CTX.beginPath(); CTX.arc(0, 0, R2, 0, Math.PI * 2); CTX.fill();

        // Thick sticker outline — matches enemy style
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, R2, 0, Math.PI * 2); CTX.stroke();

        // School uniform — clipped to body circle
        CTX.save();
        CTX.beginPath(); CTX.arc(0, 0, R2, 0, Math.PI * 2); CTX.clip();
        // White shirt top half
        CTX.fillStyle = 'rgba(241,245,249,0.90)';
        CTX.fillRect(-R2, -R2, R2 * 2, R2);
        // Khaki shorts bottom half
        CTX.fillStyle = 'rgba(120,113,85,0.85)';
        CTX.fillRect(-R2, 0, R2 * 2, R2);
        // Pha Khao Ma belt band — red with plaid lines
        CTX.fillStyle = 'rgba(185,28,28,0.92)';
        CTX.fillRect(-R2, -2, R2 * 2, 6);
        CTX.strokeStyle = 'rgba(255,255,255,0.55)'; CTX.lineWidth = 1;
        for (let px = -R2; px < R2; px += 3) {
            CTX.beginPath(); CTX.moveTo(px, -2); CTX.lineTo(px, 4); CTX.stroke();
        }
        CTX.beginPath(); CTX.moveTo(-R2, 1); CTX.lineTo(R2, 1); CTX.stroke();
        // Shirt center seam
        CTX.strokeStyle = 'rgba(148,163,184,0.70)'; CTX.lineWidth = 1;
        CTX.beginPath(); CTX.moveTo(0, -R2); CTX.lineTo(0, -2); CTX.stroke();
        CTX.restore();

        // Specular highlight — top-left
        CTX.fillStyle = 'rgba(255,255,255,0.08)';
        CTX.beginPath(); CTX.arc(-R2 * 0.35, -R2 * 0.35, R2 * 0.30, 0, Math.PI * 2); CTX.fill();

        // Shirt pocket (small blue-tinted rect)
        CTX.save();
        CTX.beginPath(); CTX.arc(0, 0, R2, 0, Math.PI * 2); CTX.clip();
        CTX.fillStyle = 'rgba(203,213,225,0.80)';
        CTX.fillRect(-6, -9, 4, 5);
        CTX.fillStyle = 'rgba(59,130,246,0.75)';
        CTX.fillRect(3, -8, 4, 1.5);
        CTX.restore();

        // Thai Kranok pattern accent
        const kranokT2 = now2 / 500;
        const kranokAlpha = 0.55 + Math.sin(kranokT2 * 1.3) * 0.25;
        CTX.save();
        CTX.beginPath(); CTX.arc(0, 0, R2 - 1, 0, Math.PI * 2); CTX.clip();
        CTX.globalAlpha = kranokAlpha;
        CTX.strokeStyle = '#fef3c7'; CTX.lineWidth = 1.1;
        CTX.shadowBlur = 6 + Math.sin(kranokT2 * 2) * 3;
        CTX.shadowColor = '#fbbf24';
        CTX.beginPath();
        CTX.moveTo(-8, 7); CTX.quadraticCurveTo(-9, 1, -4, -1);
        CTX.quadraticCurveTo(-1, -2, -3, 3); CTX.stroke();
        CTX.beginPath();
        CTX.moveTo(-4, -1); CTX.quadraticCurveTo(-6, -4, -3, -5);
        CTX.quadraticCurveTo(-1, -6, -2, -3); CTX.stroke();
        CTX.beginPath();
        CTX.moveTo(8, 7); CTX.quadraticCurveTo(9, 1, 4, -1);
        CTX.quadraticCurveTo(1, -2, 3, 3); CTX.stroke();
        CTX.beginPath();
        CTX.moveTo(4, -1); CTX.quadraticCurveTo(6, -4, 3, -5);
        CTX.quadraticCurveTo(1, -6, 2, -3); CTX.stroke();
        CTX.globalAlpha = kranokAlpha * 0.95;
        CTX.fillStyle = 'rgba(255,251,235,0.90)';
        CTX.shadowBlur = 8; CTX.shadowColor = '#fbbf24';
        CTX.beginPath();
        CTX.moveTo(0, -5); CTX.lineTo(2.5, -1); CTX.lineTo(0, 3); CTX.lineTo(-2.5, -1);
        CTX.closePath(); CTX.fill();
        CTX.fillStyle = 'rgba(254,243,199,0.85)'; CTX.shadowBlur = 3;
        for (const [dx2, dy2] of [[-5, 8], [0, 9], [5, 8]]) {
            CTX.beginPath(); CTX.arc(dx2, dy2, 1.2, 0, Math.PI * 2); CTX.fill();
        }
        CTX.restore(); // end kranok clip
        CTX.globalAlpha = 1;

        // Messy Spiky Hair
        CTX.fillStyle = '#1c0f05';
        CTX.beginPath();
        CTX.moveTo(-R2, -2);
        CTX.quadraticCurveTo(-R2 - 1, -R2 * 1.1, 0, -R2 - 7);
        CTX.quadraticCurveTo(R2 + 1, -R2 * 1.1, R2, -2);
        CTX.quadraticCurveTo(R2 * 0.6, -1, 0, 0);
        CTX.quadraticCurveTo(-R2 * 0.6, -1, -R2, -2);
        CTX.closePath(); CTX.fill();

        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2;
        CTX.beginPath();
        CTX.moveTo(-R2, -2);
        CTX.quadraticCurveTo(-R2 - 1, -R2 * 1.1, 0, -R2 - 7);
        CTX.quadraticCurveTo(R2 + 1, -R2 * 1.1, R2, -2);
        CTX.quadraticCurveTo(R2 * 0.6, -1, 0, 0);
        CTX.quadraticCurveTo(-R2 * 0.6, -1, -R2, -2);
        CTX.closePath(); CTX.stroke();

        CTX.fillStyle = '#3b1a07';
        CTX.beginPath();
        CTX.moveTo(-6, -R2 - 4);
        CTX.quadraticCurveTo(-1, -R2 - 8, 4, -R2 - 5);
        CTX.quadraticCurveTo(2, -R2 - 1, -2, -R2);
        CTX.quadraticCurveTo(-5, -R2, -6, -R2 - 4);
        CTX.closePath(); CTX.fill();

        CTX.fillStyle = '#15080a';
        const hairSpikes = [
            { bx: -9, angle: -2.4, len: 7 },
            { bx: -4, angle: -2.0, len: 9 },
            { bx: 1, angle: -1.57, len: 10 },
            { bx: 6, angle: -1.1, len: 8 },
            { bx: 10, angle: -0.8, len: 6 },
        ];
        for (const sp of hairSpikes) {
            const tipX = sp.bx + Math.cos(sp.angle) * sp.len;
            const tipY = -R2 - 5 + Math.sin(sp.angle) * sp.len;
            const wob = Math.sin(now2 / 500 + sp.bx) * 1.2;
            CTX.fillStyle = '#15080a';
            CTX.beginPath();
            CTX.moveTo(sp.bx - 3, -R2 - 3);
            CTX.lineTo(sp.bx + 3, -R2 - 3);
            CTX.lineTo(tipX + wob, tipY - wob * 0.5);
            CTX.closePath(); CTX.fill();
            CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 1.5;
            CTX.beginPath();
            CTX.moveTo(sp.bx - 3, -R2 - 3);
            CTX.lineTo(sp.bx + 3, -R2 - 3);
            CTX.lineTo(tipX + wob, tipY - wob * 0.5);
            CTX.closePath(); CTX.stroke();
        }

        // ── Energy Shield visual ring ────────────────────────────
        if (this.hasShield) {
            const shieldT = performance.now() / 200;
            CTX.save();
            CTX.globalAlpha = 0.6 + Math.sin(shieldT) * 0.2;
            CTX.strokeStyle = '#8b5cf6';
            CTX.lineWidth = 3;
            CTX.shadowBlur = 15;
            CTX.shadowColor = '#8b5cf6';
            CTX.beginPath();
            CTX.arc(0, 0, 25, 0, Math.PI * 2);
            CTX.stroke();
            CTX.fillStyle = 'rgba(139, 92, 246, 0.15)';
            CTX.fill();
            CTX.restore();
        }

        CTX.restore(); // ── end LAYER 1 ──

        // ════════════════════════════════════════════════════════════
        // LAYER 2 — WEAPON + HANDS (full 360° rotation)
        // scale(1,-1) when isFacingLeft keeps kratib right-side up.
        // ════════════════════════════════════════════════════════════
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);
        if (isFacingLeft) CTX.scale(1, -1); // ← Anti-flip critical fix

        if (typeof drawPoomWeapon === 'function') drawPoomWeapon(CTX);

        // Floating Hands — Prajioud white rope/armband detail
        const pR = 5;
        CTX.fillStyle = '#d97706';
        CTX.strokeStyle = '#1e293b';
        CTX.lineWidth = 2.5;
        CTX.shadowBlur = 6; CTX.shadowColor = '#f59e0b';
        CTX.beginPath(); CTX.arc(R2 + 6, 1, pR, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
        CTX.shadowBlur = 0;
        CTX.save();
        CTX.beginPath(); CTX.arc(R2 + 6, 1, pR, 0, Math.PI * 2); CTX.clip();
        CTX.fillStyle = 'rgba(255,255,255,0.80)';
        CTX.fillRect(R2 + 1, -1.5, 10, 1.5);
        CTX.fillRect(R2 + 1, 1.5, 10, 1.2);
        CTX.fillStyle = 'rgba(220,38,38,0.60)';
        CTX.fillRect(R2 + 1, 0.1, 10, 0.8);
        CTX.restore();

        CTX.fillStyle = '#b45309';
        CTX.strokeStyle = '#1e293b';
        CTX.lineWidth = 2.5;
        CTX.shadowBlur = 4; CTX.shadowColor = '#f59e0b';
        CTX.beginPath(); CTX.arc(-(R2 + 5), 1, pR - 1, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
        CTX.shadowBlur = 0;
        CTX.save();
        CTX.beginPath(); CTX.arc(-(R2 + 5), 1, pR - 1, 0, Math.PI * 2); CTX.clip();
        CTX.fillStyle = 'rgba(255,255,255,0.75)';
        CTX.fillRect(-(R2 + 10), -1, 10, 1.3);
        CTX.fillRect(-(R2 + 10), 1.5, 10, 1.1);
        CTX.restore();

        CTX.restore(); // ── end LAYER 2 ──

        // Level badge
        if (this.level > 1) {
            CTX.fillStyle = 'rgba(217,119,6,0.92)';
            CTX.beginPath(); CTX.arc(screen.x + 20, screen.y - 20, 9, 0, Math.PI * 2); CTX.fill();
            CTX.fillStyle = '#fff';
            CTX.font = 'bold 9px Arial';
            CTX.textAlign = 'center';
            CTX.textBaseline = 'middle';
            CTX.fillText(this.level, screen.x + 20, screen.y - 20);
        }
    }

    updateUI() {
        const S = this.stats;
        const hpBar = document.getElementById('hp-bar');
        const enBar = document.getElementById('en-bar');
        if (hpBar) hpBar.style.width = `${this.hp / this.maxHp * 100}%`;
        if (enBar) enBar.style.width = `${this.energy / this.maxEnergy * 100}%`;

        const dpEl = document.getElementById('dash-cd');
        if (dpEl) {
            const dp = Math.min(100, (1 - this.cooldowns.dash / S.dashCooldown) * 100);
            dpEl.style.height = `${100 - dp}%`;
        }
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('dash-icon',
                Math.max(0, this.cooldowns.dash), S.dashCooldown);
        }

        const eatCd = document.getElementById('eat-cd');
        const eatIcon = document.getElementById('eat-icon');
        if (eatCd) {
            if (this.isEatingRice) { eatCd.style.height = '0%'; eatIcon?.classList.add('active'); }
            else {
                eatIcon?.classList.remove('active');
                const ep = Math.min(100, (1 - this.cooldowns.eat / S.eatRiceCooldown) * 100);
                eatCd.style.height = `${100 - ep}%`;
            }
        }
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('eat-icon',
                this.isEatingRice ? 0 : Math.max(0, this.cooldowns.eat),
                S.eatRiceCooldown);
        }

        const nagaCd = document.getElementById('naga-cd');
        if (nagaCd) {
            const np = Math.min(100, (1 - this.cooldowns.naga / S.nagaCooldown) * 100);
            nagaCd.style.height = `${100 - np}%`;
        }
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('naga-icon',
                Math.max(0, this.cooldowns.naga), S.nagaCooldown);
        }

        // ── Phase 3 Session 3: Ritual cooldown — mirrored in ui.js updateSkillIcons ──
        const ritualCd = document.getElementById('ritual-cd');
        if (ritualCd) {
            const maxRcd = GAME_CONFIG?.abilities?.ritual?.cooldown || 20;
            const rp = Math.min(100, (1 - this.cooldowns.ritual / maxRcd) * 100);
            ritualCd.style.height = `${100 - rp}%`;
        }

        const levelEl = document.getElementById('player-level');
        if (levelEl) levelEl.textContent = `Lv.${this.level}`;
        const expBar = document.getElementById('exp-bar');
        if (expBar) expBar.style.width = `${(this.exp / this.expToNextLevel) * 100}%`;
    }
}

// ════════════════════════════════════════════════════════════
// ✅ WARN 5 FIX — Share checkObstacleProximity with PoomPlayer
// ════════════════════════════════════════════════════════════
PoomPlayer.prototype.checkObstacleProximity = Player.prototype.checkObstacleProximity;

// ════════════════════════════════════════════════════════════
// ✅ Option B — Share identical Player methods with PoomPlayer
// ════════════════════════════════════════════════════════════
PoomPlayer.prototype.heal = Player.prototype.heal;
PoomPlayer.prototype.gainExp = Player.prototype.gainExp;
PoomPlayer.prototype.levelUp = Player.prototype.levelUp;
PoomPlayer.prototype.addSpeedBoost = Player.prototype.addSpeedBoost;
PoomPlayer.prototype.checkPassiveUnlock = Player.prototype.checkPassiveUnlock;
// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.PoomPlayer = PoomPlayer;