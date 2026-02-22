'use strict';

// ════════════════════════════════════════════════════════════
// 🔥 AUTO PLAYER — Thermodynamic Brawler + Stand "Wanchai"
// ════════════════════════════════════════════════════════════
class AutoPlayer extends Player {
    constructor(x = 0, y = 0) {
        super('auto');
        this.x = x;
        this.y = y;

        this.wanchaiActive = false;
        this.wanchaiTimer = 0;

        this._punchTimer = 0;
        this._heatTimer = 0;

        // ── NEW: Stand Rush State ────────────────────────────────
        this.isStandAttacking = false;
        this.standAttackTimer = 0;
        this.lastPunchSoundTime = 0;

        this.cooldowns = { ...(this.cooldowns || {}), dash: this.cooldowns?.dash ?? 0, stealth: this.cooldowns?.stealth ?? 0, shoot: 0, wanchai: 0 };
    }

    takeDamage(amt) {
        const reduction = this.wanchaiActive ? (this.stats?.standDamageReduction ?? 0.5) : 0;
        const scaled = amt * (1 - reduction);
        super.takeDamage(scaled);
    }

    dealDamage(baseDamage) {
        // Temporarily boost baseCritChance during calculation if Stand is active
        const originalCrit = this.baseCritChance;
        if (this.wanchaiActive) {
            this.baseCritChance += (this.stats?.standCritBonus ?? 0.50);
        }

        const result = super.dealDamage(baseDamage);

        // Restore original crit for state safety
        this.baseCritChance = originalCrit;

        return result;
    }

    _activateWanchai() {
        // WARN-1 FIX: BALANCE was refactored — correct path is
        // BALANCE.characters.auto, not the stale BALANCE.player.auto
        const dur = this.stats?.wanchaiDuration ?? BALANCE.characters?.auto?.wanchaiDuration ?? 3.0;
        const cd = this.stats?.wanchaiCooldown ?? BALANCE.characters?.auto?.wanchaiCooldown ?? 12;

        this.wanchaiActive = true;
        this.wanchaiTimer = dur;
        this.cooldowns.wanchai = cd;
        this._punchTimer = 0;

        if (typeof spawnFloatingText === 'function') {
            spawnFloatingText('STAND: WANCHAI!', this.x, this.y - 90, '#dc2626', 34);
        }
        if (typeof spawnParticles === 'function') {
            spawnParticles(this.x, this.y, 18, '#dc2626', 'steam');
        }
    }

    update(dt, keys, mouse) {
        if (this.cooldowns?.wanchai > 0) this.cooldowns.wanchai -= dt;
        if (this.cooldowns?.shoot > 0) this.cooldowns.shoot -= dt;

        if (this.wanchaiActive) {
            this.wanchaiTimer -= dt;
            if (this.wanchaiTimer <= 0) {
                this.wanchaiActive = false;
                this.wanchaiTimer = 0;
            }
        }

        if (mouse?.right === 1) {
            const energyCost = this.stats?.wanchaiEnergyCost ?? 35;
            if (!this.wanchaiActive && (this.cooldowns?.wanchai ?? 0) <= 0 && (this.energy ?? 0) >= energyCost) {
                this.energy = Math.max(0, (this.energy ?? 0) - energyCost);
                this._activateWanchai();
            }
            mouse.right = 0;
        }

        const oldSpeedBoost = this.speedBoost;
        // Apply Awakening speed buff instead of slowing down
        if (this.wanchaiActive) this.speedBoost = (this.speedBoost || 1) * (this.stats?.standSpeedMod ?? 1.5);

        super.update(dt, keys, mouse);

        // Stateless restore
        this.speedBoost = oldSpeedBoost;

        // Reset attack state every frame; proven true below if mouse is held
        this.isStandAttacking = false;

        if (!mouse || mouse.left !== 1) return;
        if (typeof projectileManager === 'undefined' || !projectileManager) return;

        // ── NEW: Stand Rush Hitbox Logic ─────────────────────────
        if (this.wanchaiActive) {
            this.isStandAttacking = true;
            this.standAttackTimer += dt;

            const punchRate = this.stats?.wanchaiPunchRate ?? 0.06;
            this._punchTimer -= dt;

            if (this._punchTimer <= 0) {
                this._punchTimer = punchRate;

                const rushRange = 130;
                const coneHalfAngle = 0.6; // Roughly 34 degrees either side

                // Calculate base damage
                let baseDmg = (this.stats?.wanchaiDamage ?? 12) * (this.damageMultiplier || 1.0);

                // ── Second Wind Damage Multiplier (Stand Rush bypasses dealDamage) ──
                if (this.isSecondWind) {
                    baseDmg *= (BALANCE.player.secondWindDamageMult || 1.5);
                }

                // Apply Awakening Crit Buff directly to flurry punches
                let critChance = this.baseCritChance;
                if (this.passiveUnlocked) critChance += (this.stats?.passiveCritBonus ?? 0);
                critChance += (this.stats?.standCritBonus ?? 0.50); // Add the Stand Crit Buff

                let isCrit = false;
                let finalDmg = baseDmg;
                if (Math.random() < critChance) {
                    finalDmg *= (this.stats?.critMultiplier ?? 2.0);
                    isCrit = true;
                    if (this.passiveUnlocked) this.goldenAuraTimer = 1;
                    if (typeof Achievements !== 'undefined' && Achievements.stats) {
                        Achievements.stats.crits++;
                        if (Achievements.check) Achievements.check('crit_master');
                    }
                }

                let totalDamageDealt = 0;

                // Damage standard enemies in cone
                for (const enemy of (window.enemies || [])) {
                    if (enemy.dead) continue;
                    const dx = enemy.x - this.x;
                    const dy = enemy.y - this.y;
                    const dist = Math.hypot(dx, dy);

                    if (dist < rushRange) {
                        let angleToEnemy = Math.atan2(dy, dx);
                        let angleDiff = Math.abs(angleToEnemy - this.angle);
                        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

                        if (angleDiff < coneHalfAngle) {
                            const enemyHitX = enemy.x;
                            const enemyHitY = enemy.y;
                            enemy.takeDamage(finalDmg);
                            totalDamageDealt += finalDmg;
                            if (typeof spawnParticles === 'function') {
                                // Flurry turns golden on critical hits
                                spawnParticles(enemyHitX, enemyHitY, 2, isCrit ? '#facc15' : '#ef4444');
                            }
                        }
                    }
                }

                // Damage boss in cone
                if (window.boss && !window.boss.dead) {
                    const dx = window.boss.x - this.x;
                    const dy = window.boss.y - this.y;
                    const dist = Math.hypot(dx, dy);

                    if (dist < rushRange + window.boss.radius) {
                        let angleToEnemy = Math.atan2(dy, dx);
                        let angleDiff = Math.abs(angleToEnemy - this.angle);
                        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

                        if (angleDiff < coneHalfAngle) {
                            const bossHitX = window.boss.x;
                            const bossHitY = window.boss.y;
                            window.boss.takeDamage(finalDmg);
                            totalDamageDealt += finalDmg;
                            if (typeof spawnParticles === 'function') {
                                spawnParticles(bossHitX, bossHitY, 2, isCrit ? '#facc15' : '#ef4444');
                            }
                        }
                    }
                }

                // Apply Lifesteal if passive is unlocked and damage was dealt
                if (this.passiveUnlocked && totalDamageDealt > 0) {
                    const healAmount = totalDamageDealt * (this.stats?.passiveLifesteal ?? 0.02);
                    this.hp = Math.min(this.maxHp, this.hp + healAmount);
                }

                if (typeof addScreenShake === 'function') addScreenShake(3);

                // ── PLAY RAPID PUNCH SOUND ──
                const nowTime = Date.now();
                if (nowTime - this.lastPunchSoundTime > 60) {
                    if (typeof Audio !== 'undefined' && Audio.playStandRush) {
                        Audio.playStandRush();
                    }
                    this.lastPunchSoundTime = nowTime;
                }
            }
            return;
        }

        const heatCd = this.stats?.heatWaveCooldown ?? 0.28;
        if ((this.cooldowns?.shoot ?? 0) > 0) return;
        this.cooldowns.shoot = heatCd;

        if (typeof projectileManager.spawnHeatWave === 'function') {
            projectileManager.spawnHeatWave(this, this.angle);
        } else {
            try {
                projectileManager.add(new Projectile(this.x, this.y, this.angle, 900, 22, '#dc2626', false, 'player'));
            } catch (e) { }
        }
    }

    draw() {
        // ════════════════════════════════════════════════════════════
        // AUTO — Anti-Flip v12
        // LAYER 1: Body (mirror via scale, no rotation).
        // LAYER 2: Weapon + Fists (full rotate + conditional Y-flip).
        // ════════════════════════════════════════════════════════════
        const screen = worldToScreen(this.x, this.y);
        const now = performance.now();
        if (typeof CTX === 'undefined' || !CTX) return;

        // ── Orientation helper ────────────────────────────────────
        const isFacingLeft = Math.abs(this.angle) > Math.PI / 2;
        const facingSign = isFacingLeft ? -1 : 1;

        // ── Ground shadow ─────────────────────────────────────────
        CTX.save();
        CTX.globalAlpha = 0.25;
        CTX.fillStyle = 'rgba(0,0,0,0.8)';
        CTX.beginPath(); CTX.ellipse(screen.x, screen.y + 16, 17, 6, 0, 0, Math.PI * 2); CTX.fill();
        CTX.restore();

        // ── Wanchai Stand (world-space, independent of body) ──────
        if (this.wanchaiActive) {
            const bob = Math.sin(now / 130) * 7;
            const sx = screen.x - Math.cos(this.angle) * 30;
            const sy = screen.y - Math.sin(this.angle) * 30 - 30 + bob;
            CTX.save(); CTX.translate(sx, sy);
            const wA = 0.55 + Math.sin(now / 160) * 0.15;
            CTX.globalAlpha = 0.35 + Math.sin(now / 200) * 0.15;
            CTX.strokeStyle = '#ef4444'; CTX.lineWidth = 3.5;
            CTX.shadowBlur = 30; CTX.shadowColor = '#dc2626';
            CTX.beginPath(); CTX.arc(0, 0, 38 + Math.sin(now / 140) * 4, 0, Math.PI * 2); CTX.stroke();
            CTX.globalAlpha = wA * 0.65;
            const tL = -14, tT = -19, tW = 28, tH = 38;
            CTX.save();
            CTX.beginPath(); CTX.roundRect(tL, tT, tW, tH, 6); CTX.clip();
            for (let ly = tT; ly <= tT + tH; ly += 4) {
                const la = 0.4 + 0.5 * Math.abs(Math.sin(now / 80 + ly * 0.15));
                CTX.strokeStyle = `rgba(248,113,113,${la})`; CTX.lineWidth = 1.2;
                CTX.shadowBlur = 4; CTX.shadowColor = '#ef4444';
                CTX.beginPath(); CTX.moveTo(tL, ly); CTX.lineTo(tL + tW, ly); CTX.stroke();
            }
            CTX.restore();
            CTX.globalAlpha = wA;
            CTX.strokeStyle = 'rgba(220,38,38,0.80)'; CTX.lineWidth = 2;
            CTX.shadowBlur = 16; CTX.shadowColor = '#dc2626';
            CTX.beginPath(); CTX.roundRect(tL, tT, tW, tH, 6); CTX.stroke();
            for (let side = -1; side <= 1; side += 2) {
                CTX.globalAlpha = wA * 0.7; CTX.strokeStyle = 'rgba(220,38,38,0.70)'; CTX.lineWidth = 1.5; CTX.shadowBlur = 10;
                CTX.beginPath(); CTX.roundRect(side * 22 - 5, -8, 10, 22, 5); CTX.stroke();
            }
            CTX.globalAlpha = wA * 0.75; CTX.shadowBlur = 18; CTX.shadowColor = '#dc2626';
            CTX.strokeStyle = 'rgba(254,202,202,0.60)'; CTX.lineWidth = 2;
            CTX.beginPath(); CTX.arc(0, -28, 12, 0, Math.PI * 2); CTX.stroke();
            CTX.fillStyle = 'rgba(220,38,38,0.70)';
            for (let si = -2; si <= 2; si++) {
                CTX.beginPath(); CTX.moveTo(si * 5 - 3, -37); CTX.lineTo(si * 5 + 3, -37);
                CTX.lineTo(si * 5, -42 + Math.abs(si) * 2); CTX.closePath(); CTX.fill();
            }
            const eg = 0.7 + Math.sin(now / 110) * 0.3;
            CTX.globalAlpha = eg; CTX.fillStyle = '#f87171'; CTX.shadowBlur = 12; CTX.shadowColor = '#ef4444';
            CTX.beginPath(); CTX.arc(-4, -28, 2.5, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.arc(4, -28, 2.5, 0, Math.PI * 2); CTX.fill();
            CTX.restore();

            // ── NEW: Stand Rush Animation ─────────────────────────────
            if (this.isStandAttacking) {
                CTX.save();
                CTX.translate(screen.x, screen.y);
                CTX.rotate(this.angle);

                // Draw rapid chaotic fists
                CTX.shadowBlur = 12;
                CTX.shadowColor = '#dc2626';
                for (let i = 0; i < 8; i++) {
                    const fistX = 40 + Math.random() * 80;    // Forward distance
                    const fistY = (Math.random() - 0.5) * 70; // Cone spread
                    const scale = 0.5 + Math.random() * 0.7;

                    CTX.fillStyle = 'rgba(239, 68, 68, 0.85)';
                    CTX.beginPath();
                    CTX.ellipse(fistX, fistY, 14 * scale, 9 * scale, 0, 0, Math.PI * 2);
                    CTX.fill();

                    // Trailing motion lines
                    CTX.strokeStyle = 'rgba(248, 113, 113, 0.5)';
                    CTX.lineWidth = 4 * scale;
                    CTX.beginPath();
                    CTX.moveTo(fistX - 25 * scale, fistY);
                    CTX.lineTo(fistX, fistY);
                    CTX.stroke();
                }

                // Dynamic Jittering Manga Text
                CTX.rotate(-this.angle); // Un-rotate so text stays readable

                const textScale = 1 + Math.sin(now / 30) * 0.15; // Rapid pulsing
                const jitterX = (Math.random() - 0.5) * 6;
                const jitterY = (Math.random() - 0.5) * 6;

                CTX.translate(0, -75); // Float above the fray
                CTX.scale(textScale, textScale);

                CTX.font = '900 28px "Arial Black", Arial, sans-serif';
                CTX.textAlign = 'center';
                CTX.lineWidth = 5;
                CTX.strokeStyle = '#000000'; // Hard black outline
                CTX.strokeText('วันชัย วันชัย วันชัย!', jitterX, jitterY);

                CTX.fillStyle = '#facc15'; // Bright yellow fill
                CTX.fillText('วันชัย วันชัย วันชัย!', jitterX, jitterY);

                CTX.restore();
            }
        }

        // Breathing squash/stretch
        const breatheAuto = Math.sin(Date.now() / 200);
        const speed = Math.hypot(this.vx, this.vy);
        const moveT = Math.min(1, speed / 180);
        const bobT = Math.sin(this.walkCycle * 0.9);
        const stretchX = 1 + breatheAuto * 0.025 + moveT * bobT * 0.09;
        const stretchY = 1 - breatheAuto * 0.025 - moveT * Math.abs(bobT) * 0.065;

        const attackIntensity = this.wanchaiActive ? 1.0
            : Math.min(1, (Math.abs(this.vx) + Math.abs(this.vy)) / 150 + 0.2);
        const ventGlow = Math.max(0, attackIntensity * (0.5 + Math.sin(now / 180) * 0.5));

        const R = 15;

        // ════════════════════════════════════════════════════════════
        // LAYER 1 — BODY (horizontal mirror only, no rotation)
        // ════════════════════════════════════════════════════════════
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.scale(stretchX * facingSign, stretchY);

        // Silhouette glow ring — crimson
        CTX.shadowBlur = 18; CTX.shadowColor = 'rgba(220,38,38,0.75)';
        CTX.strokeStyle = 'rgba(220,38,38,0.55)';
        CTX.lineWidth = 2.8;
        CTX.beginPath(); CTX.arc(0, 0, R + 3, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur = 0;

        // Bean body — dark crimson
        const bG = CTX.createRadialGradient(-4, -4, 1, 0, 0, R);
        bG.addColorStop(0, '#7f1d1d');
        bG.addColorStop(0.5, '#5a0e0e');
        bG.addColorStop(1, '#2d0606');
        CTX.fillStyle = bG;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.fill();

        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.stroke();

        CTX.fillStyle = 'rgba(255,255,255,0.09)';
        CTX.beginPath(); CTX.arc(-5, -6, 6, 0, Math.PI * 2); CTX.fill();

        // Heat vents
        CTX.shadowBlur = 10 * ventGlow; CTX.shadowColor = '#fb923c';
        for (let vi = 0; vi < 3; vi++) {
            const va = ventGlow * (0.45 + vi * 0.18);
            CTX.fillStyle = `rgba(251,146,60,${va})`;
            CTX.beginPath(); CTX.roundRect(-R, -4 + vi * 5, 4, 2.5, 1); CTX.fill();
            CTX.beginPath(); CTX.roundRect(R - 4, -4 + vi * 5, 4, 2.5, 1); CTX.fill();
        }
        CTX.shadowBlur = 0;

        // Power core
        const cP = Math.max(0, 0.4 + Math.sin(now / 200) * 0.5) * (this.wanchaiActive ? 1.5 : 1);
        CTX.fillStyle = `rgba(239,68,68,${Math.min(1, cP)})`;
        CTX.shadowBlur = 10 * cP; CTX.shadowColor = '#dc2626';
        CTX.beginPath(); CTX.arc(0, 3, 3.5, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;

        // Anime-Spiky Hair
        CTX.fillStyle = '#1a0505';
        CTX.beginPath();
        CTX.moveTo(-(R - 1), -1);
        CTX.quadraticCurveTo(-R - 1, -R * 0.6, -R * 0.4, -R - 2);
        CTX.quadraticCurveTo(0, -R - 4, R * 0.4, -R - 2);
        CTX.quadraticCurveTo(R + 1, -R * 0.6, R - 1, -1);
        CTX.quadraticCurveTo(R * 0.5, 2, 0, 2.5);
        CTX.quadraticCurveTo(-R * 0.5, 2, -(R - 1), -1);
        CTX.closePath(); CTX.fill();

        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2;
        CTX.beginPath();
        CTX.moveTo(-(R - 1), -1);
        CTX.quadraticCurveTo(-R - 1, -R * 0.6, -R * 0.4, -R - 2);
        CTX.quadraticCurveTo(0, -R - 4, R * 0.4, -R - 2);
        CTX.quadraticCurveTo(R + 1, -R * 0.6, R - 1, -1);
        CTX.quadraticCurveTo(R * 0.5, 2, 0, 2.5);
        CTX.quadraticCurveTo(-R * 0.5, 2, -(R - 1), -1);
        CTX.closePath(); CTX.stroke();

        CTX.fillStyle = '#5c1010';
        CTX.beginPath();
        CTX.moveTo(-5, -R - 2);
        CTX.quadraticCurveTo(-1, -R - 5, 4, -R - 2);
        CTX.quadraticCurveTo(2, -R + 2, -2, -R + 1);
        CTX.quadraticCurveTo(-4, -R, -5, -R - 2);
        CTX.closePath(); CTX.fill();

        const spikeData = [
            [-11, -2, 12, '#3d0909'],
            [-5, -1, 9, '#450a0a'],
            [1, 0, 11, '#450a0a'],
            [7, 1, 8, '#3d0909'],
            [12, 2, 6, '#2d0606'],
        ];
        for (const [bx, tipOff, h, col] of spikeData) {
            const wobble = Math.sin(now / 380 + bx * 0.4) * 1.2;
            CTX.fillStyle = col;
            CTX.beginPath();
            CTX.moveTo(bx - 3.5, -R - 1);
            CTX.lineTo(bx + 3.5, -R - 1);
            CTX.lineTo(bx + tipOff + wobble, -R - 1 - h - wobble * 0.4);
            CTX.closePath(); CTX.fill();
            CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 1.5;
            CTX.beginPath();
            CTX.moveTo(bx - 3.5, -R - 1);
            CTX.lineTo(bx + 3.5, -R - 1);
            CTX.lineTo(bx + tipOff + wobble, -R - 1 - h - wobble * 0.4);
            CTX.closePath(); CTX.stroke();
        }

        CTX.shadowBlur = this.wanchaiActive ? 16 : 6;
        CTX.shadowColor = '#f97316';
        const emberColors = ['#f97316', '#ef4444', '#fb923c', '#f87171', '#fca5a5'];
        spikeData.forEach(([bx, tipOff, h], idx) => {
            const wobble = Math.sin(now / 380 + bx * 0.4) * 1.2;
            const tx = bx + tipOff + wobble;
            const ty = -R - 1 - h - wobble * 0.4;
            const eA = (this.wanchaiActive ? 0.9 : 0.6) + Math.sin(now / 200 + idx) * 0.25;
            CTX.fillStyle = emberColors[idx % emberColors.length];
            CTX.globalAlpha = Math.max(0, Math.min(1, eA));
            CTX.beginPath(); CTX.arc(tx, ty, 2, 0, Math.PI * 2); CTX.fill();
        });
        CTX.globalAlpha = 1; CTX.shadowBlur = 0;

        CTX.restore(); // ── end LAYER 1 ──

        // ════════════════════════════════════════════════════════════
        // LAYER 2 — WEAPON + FISTS (full 360° rotation)
        // scale(1,-1) when isFacingLeft keeps gun right-side up.
        // ════════════════════════════════════════════════════════════
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);
        if (isFacingLeft) CTX.scale(1, -1); // ← Anti-flip critical fix

        if (typeof drawAutoWeapon === 'function') {
            drawAutoWeapon(CTX, this.wanchaiActive, ventGlow);
        }

        const fistGlow = ventGlow * 0.8 + (this.wanchaiActive ? 0.6 : 0);
        CTX.shadowBlur = 10 * fistGlow; CTX.shadowColor = '#dc2626';

        CTX.fillStyle = '#4a0e0e';
        CTX.strokeStyle = '#1e293b';
        CTX.lineWidth = 2.5;
        CTX.beginPath(); CTX.arc(R + 8, 3, 7, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
        CTX.fillStyle = '#7f1d1d';
        CTX.beginPath(); CTX.arc(R + 6, 1, 3.5, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = '#2d0606'; CTX.lineWidth = 1.2;
        CTX.beginPath(); CTX.moveTo(R + 3, 1); CTX.lineTo(R + 13, 1); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(R + 3, 4); CTX.lineTo(R + 13, 4); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(R + 3, 6.5); CTX.lineTo(R + 13, 6.5); CTX.stroke();
        const fistEmber = Math.max(0, 0.5 + Math.sin(now / 160) * 0.4) * (this.wanchaiActive ? 1 : 0.6);
        CTX.fillStyle = `rgba(251,146,60,${fistEmber})`;
        CTX.shadowBlur = 8 * fistEmber; CTX.shadowColor = '#fb923c';
        CTX.beginPath(); CTX.roundRect(R + 4, 2.5, 8, 1.5, 1); CTX.fill();
        CTX.shadowBlur = 0;

        CTX.fillStyle = '#3d0808';
        CTX.strokeStyle = '#1e293b';
        CTX.lineWidth = 2.5;
        CTX.shadowBlur = 6 * fistGlow; CTX.shadowColor = '#dc2626';
        CTX.beginPath(); CTX.arc(-(R + 7), -1, 6, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
        CTX.fillStyle = '#5c1010';
        CTX.beginPath(); CTX.arc(-(R + 9), -2, 2.5, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;

        CTX.restore(); // ── end LAYER 2 ──

        // Heat shimmer particles
        if (typeof spawnParticles === 'function' &&
            (Math.abs(this.vx) + Math.abs(this.vy)) > 60 &&
            Math.random() < 0.1) {
            spawnParticles(this.x + rand(-10, 10), this.y + rand(-10, 10), 1, '#fb7185', 'steam');
        }

        // Level badge
        if (this.level > 1) {
            CTX.fillStyle = 'rgba(185,28,28,0.92)';
            CTX.beginPath(); CTX.arc(screen.x + 22, screen.y - 22, 9, 0, Math.PI * 2); CTX.fill();
            CTX.fillStyle = '#fff';
            CTX.font = 'bold 9px Arial';
            CTX.textAlign = 'center';
            CTX.textBaseline = 'middle';
            CTX.fillText(this.level, screen.x + 22, screen.y - 22);
        }
    }
}

// ════════════════════════════════════════════════════════════
// 🔥 AUTO PLAYER — Prototype Overrides
// ════════════════════════════════════════════════════════════
AutoPlayer.prototype.updateUI = function () {
    const S = this.stats;

    const hpEl = document.getElementById('hp-bar');
    const enEl = document.getElementById('en-bar');
    if (hpEl) hpEl.style.width = `${this.hp / this.maxHp * 100}%`;
    if (enEl) enEl.style.width = `${this.energy / this.maxEnergy * 100}%`;

    const dp = Math.min(100, (1 - this.cooldowns.dash / (S.dashCooldown || 2.0)) * 100);
    const dashEl = document.getElementById('dash-cd');
    if (dashEl) dashEl.style.height = `${100 - dp}%`;
    if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
        UIManager._setCooldownVisual('dash-icon',
            Math.max(0, this.cooldowns.dash), S.dashCooldown || 2.0);
    }

    // WARN-1 FIX: use BALANCE.characters.auto (correct path after refactor)
    const wanchaiCd = S.wanchaiCooldown || BALANCE.characters?.auto?.wanchaiCooldown || 12;
    const standEl = document.getElementById('stealth-icon');
    const standCdEl = document.getElementById('stealth-cd');

    const skill1Emoji = document.getElementById('skill1-emoji');
    const skill1Hint = document.getElementById('skill1-hint');
    if (skill1Emoji) skill1Emoji.textContent = this.wanchaiActive ? '🥊' : '🔥';
    if (skill1Hint) skill1Hint.textContent = 'STAND';
    if (standEl) standEl.style.borderColor = '#dc2626';
    if (standEl) standEl.style.boxShadow = this.wanchaiActive
        ? '0 0 20px rgba(220,38,38,0.80)'
        : '0 0 10px rgba(220,38,38,0.35)';

    if (this.wanchaiActive) {
        standEl?.classList.add('active');
        if (standCdEl) standCdEl.style.height = '0%';
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('stealth-icon', 0, wanchaiCd);
        }
        const iconLabelEl = standEl?.querySelector('.skill-name');
        if (iconLabelEl) iconLabelEl.textContent = `${Math.ceil(this.wanchaiTimer)}s`;
    } else {
        standEl?.classList.remove('active');
        if (standCdEl) {
            const sp = Math.min(100, (1 - (this.cooldowns.wanchai ?? 0) / wanchaiCd) * 100);
            standCdEl.style.height = `${100 - sp}%`;
        }
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('stealth-icon',
                Math.max(0, this.cooldowns.wanchai ?? 0), wanchaiCd);
        }
    }

    const levelEl = document.getElementById('player-level');
    if (levelEl) levelEl.textContent = `Lv.${this.level}`;
    const expBar = document.getElementById('exp-bar');
    if (expBar) expBar.style.width = `${(this.exp / this.expToNextLevel) * 100}%`;

    const passiveEl = document.getElementById('passive-skill');
    if (passiveEl) {
        if (this.passiveUnlocked) {
            passiveEl.classList.add('unlocked');
            passiveEl.style.opacity = '1';
        } else if (this.level >= (S.passiveUnlockLevel ?? 5)) {
            passiveEl.style.display = 'flex';
            passiveEl.style.opacity = '0.5';
        }
    }
};
// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.AutoPlayer = AutoPlayer;