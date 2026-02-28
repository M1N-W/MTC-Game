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

        this.cooldowns = { ...(this.cooldowns || {}), dash: this.cooldowns?.dash ?? 0, stealth: this.cooldowns?.stealth ?? 0, shoot: 0, wanchai: 0, vacuum: 0, detonation: 0 };
    }

    takeDamage(amt) {
        // ── Energy Shield block (checked before Wanchai reduction) ──
        if (this.isDashing) return;
        if (this.hasShield) {
            this.hasShield = false;
            spawnFloatingText('🛡️ BLOCKED!', this.x, this.y - 40, '#8b5cf6', 22);
            spawnParticles(this.x, this.y, 20, '#c4b5fd');
            if (typeof Audio !== 'undefined' && Audio.playHit) Audio.playHit();
            return;
        }
        // ── Graph Risk: ยืนบนเลเซอร์ → รับดาเมจ x1.5 ─────────
        if (this.onGraph) {
            amt *= 1.5;
            spawnFloatingText('EXPOSED!', this.x, this.y - 40, '#ef4444', 16);
        }
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

        // ── Graph Buff: ยืนบนเลเซอร์ระยะ 3 → ดาเมจ x1.5 ──────
        if ((this.graphBuffTimer ?? 0) > 0) result.damage *= 1.5;

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
        if (this.cooldowns?.vacuum > 0) this.cooldowns.vacuum -= dt;
        if (this.cooldowns?.detonation > 0) this.cooldowns.detonation -= dt;

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

        // ── Tick graphBuffTimer ────────────────────────────────
        if ((this.graphBuffTimer ?? 0) > 0) this.graphBuffTimer = Math.max(0, this.graphBuffTimer - dt);

        // Stateless restore
        this.speedBoost = oldSpeedBoost;

        // ── Q: Vacuum Heat — ดูดศัตรูเข้ามากอง ────────────────────
        // กด Q ดึงทุกตัวในรัศมี 320px เข้าหาออโต้ทันที
        // cooldown 8 วินาที | ออกแบบให้ combo กับ Wanchai
        if (mouse?.middle !== undefined) { /* placeholder */ }
        if (keys?.q === 1 && (this.cooldowns?.vacuum ?? 0) <= 0) {
            const VACUUM_RANGE = this.stats?.vacuumRange ?? 320;
            const VACUUM_FORCE = this.stats?.vacuumForce ?? 900;
            let pulled = 0;
            for (const enemy of (window.enemies || [])) {
                if (enemy.dead) continue;
                const dx = this.x - enemy.x;
                const dy = this.y - enemy.y;
                const dist = Math.hypot(dx, dy);
                if (dist < VACUUM_RANGE && dist > 1) {
                    // ผลักเวกเตอร์เข้าหาผู้เล่น — ใช้ vx/vy ที่ enemy มีอยู่แล้ว
                    enemy.vx = (dx / dist) * VACUUM_FORCE;
                    enemy.vy = (dy / dist) * VACUUM_FORCE;
                    pulled++;
                }
            }
            // Boss ก็โดนดึงด้วย (แต่แรงน้อยลง 30%)
            if (window.boss && !window.boss.dead) {
                const dx = this.x - window.boss.x;
                const dy = this.y - window.boss.y;
                const dist = Math.hypot(dx, dy);
                if (dist < VACUUM_RANGE && dist > 1) {
                    window.boss.vx = (dx / dist) * VACUUM_FORCE * 0.3;
                    window.boss.vy = (dy / dist) * VACUUM_FORCE * 0.3;
                }
            }
            this.cooldowns.vacuum = this.stats?.vacuumCooldown ?? 8;
            if (pulled > 0 || (window.boss && !window.boss.dead)) {
                spawnParticles(this.x, this.y, 30, '#f97316');
                addScreenShake(4);
                spawnFloatingText('🔥 VACUUM HEAT!', this.x, this.y - 60, '#f97316', 22);
                if (typeof Audio !== 'undefined' && Audio.playVacuum) Audio.playVacuum();
            }
            keys.q = 0;
        }

        // ── E: Overheat Detonation — ระเบิดสแตนด์ทิ้งปิดฉาก ─────
        // กด E ระหว่าง Wanchai active เท่านั้น
        // AOE 220px, ดาเมจสูง, แต่ Wanchai สิ้นสุดทันที
        if (keys?.e === 1 && this.wanchaiActive && (this.cooldowns?.detonation ?? 0) <= 0) {
            const DET_RANGE = this.stats?.detonationRange ?? 220;
            // ดาเมจ = wanchaiDamage × 6 (burst ทิ้ง 6 หมัดพร้อมกัน)
            const detBaseDmg = (this.stats?.wanchaiDamage ?? 32) * 6 * (this.damageMultiplier || 1.0);
            let detCrit = this.baseCritChance + (this.stats?.standCritBonus ?? 0.40);
            let detIsCrit = Math.random() < detCrit;
            let detFinalDmg = detBaseDmg * (detIsCrit ? (this.stats?.critMultiplier ?? 2.0) : 1.0);

            // ── Second Wind bonus ──
            if (this.isSecondWind) detFinalDmg *= (BALANCE.player.secondWindDamageMult || 1.5);

            let totalDet = 0;
            for (const enemy of (window.enemies || [])) {
                if (enemy.dead) continue;
                const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                if (dist < DET_RANGE) {
                    enemy.takeDamage(detFinalDmg);
                    totalDet += detFinalDmg;
                    spawnParticles(enemy.x, enemy.y, 5, detIsCrit ? '#facc15' : '#dc2626');
                }
            }
            if (window.boss && !window.boss.dead) {
                const dist = Math.hypot(window.boss.x - this.x, window.boss.y - this.y);
                if (dist < DET_RANGE + window.boss.radius) {
                    window.boss.takeDamage(detFinalDmg);
                    totalDet += detFinalDmg;
                    spawnParticles(window.boss.x, window.boss.y, 8, detIsCrit ? '#facc15' : '#dc2626');
                }
            }

            // Lifesteal จากดาเมจที่ทำได้
            if (this.passiveUnlocked && totalDet > 0) {
                this.hp = Math.min(this.maxHp, this.hp + totalDet * (this.stats?.passiveLifesteal ?? 0.01));
            }

            // ── บังคับปิด Wanchai ──
            this.wanchaiActive = false;
            this.wanchaiTimer = 0;
            this.cooldowns.detonation = this.stats?.detonationCooldown ?? 5; // short CD เพราะต้องเปิด Wanchai ก่อน

            spawnParticles(this.x, this.y, 60, '#dc2626');
            addScreenShake(10);
            spawnFloatingText(
                detIsCrit ? '💥 OVERHEAT CRIT!' : '💥 OVERHEAT!',
                this.x, this.y - 70,
                detIsCrit ? '#facc15' : '#dc2626', 28
            );
            if (typeof Audio !== 'undefined' && Audio.playDetonation) Audio.playDetonation();
            keys.e = 0;
        }



        // Reset attack state every frame; proven true below if mouse is held
        this.isStandAttacking = false;

        if (!mouse || mouse.left !== 1) return; if (typeof projectileManager === 'undefined' || !projectileManager) return;

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
        if (typeof Audio !== 'undefined' && Audio.playPunch) Audio.playPunch();
    }

    // draw() ย้ายไป PlayerRenderer._drawAuto() แล้ว

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

    if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
        UIManager._setCooldownVisual('dash-icon',
            Math.max(0, this.cooldowns.dash), S.dashCooldown || 2.0);
    }

    // WARN-1 FIX: use BALANCE.characters.auto (correct path after refactor)
    const wanchaiCd = S.wanchaiCooldown || BALANCE.characters?.auto?.wanchaiCooldown || 12;
    const standEl = document.getElementById('stealth-icon');


    const skill1Emoji = document.getElementById('skill1-emoji');
    const skill1Hint = document.getElementById('skill1-hint');
    if (skill1Emoji) skill1Emoji.textContent = this.wanchaiActive ? '🥊' : '🔥';
    if (skill1Hint) skill1Hint.textContent = 'R-Click';
    if (standEl) standEl.style.borderColor = '#dc2626';
    if (standEl) standEl.style.boxShadow = this.wanchaiActive
        ? '0 0 20px rgba(220,38,38,0.80)'
        : '0 0 10px rgba(220,38,38,0.35)';

    if (this.wanchaiActive) {
        standEl?.classList.add('active');
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('stealth-icon', 0, wanchaiCd);
        }
        const iconLabelEl = standEl?.querySelector('.skill-name');
        if (iconLabelEl) iconLabelEl.textContent = `${Math.ceil(this.wanchaiTimer)}s`;
    } else {
        standEl?.classList.remove('active');
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