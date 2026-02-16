/**
 * 🎮 MTC: ENHANCED EDITION - Main Game Loop (FIXED V2)
 * Game state, Boss, waves, input, loop
 * 
 * FIXED BUGS:
 * - ✅ Auto-fire now works continuously when holding mouse
 * - ✅ Proper burst fire for auto rifle
 * - ✅ All weapon types work correctly
 */

// Game State
let gameState = 'MENU';
let loopRunning = false; //เมื่อรีสตาร์ทเกมแล้วจะไม่เกิด Loop ที่ทำให้เกมช้าลง
const keys = { w: 0, a: 0, s: 0, d: 0, space: 0, q: 0 };

// Game objects (global for easy access)
window.player = null;
window.enemies = [];
window.boss = null;
window.powerups = [];
window.specialEffects = [];
window.meteorZones = [];
let waveStartDamage = 0;

// ==================== BOSS ====================
class Boss extends Entity {
    constructor(difficulty = 1) {
        super(0, -600, 50);
        this.maxHp = BALANCE.boss.baseHp * difficulty;
        this.hp = this.maxHp;
        this.name = "KRU MANOP";
        this.state = 'CHASE';
        this.timer = 0;
        this.moveSpeed = BALANCE.boss.moveSpeed;
        this.difficulty = difficulty;
        this.phase = 1;
        this.sayTimer = 0;
        this.skills = {
            slam: { cd: 0, max: BALANCE.boss.slamCooldown },
            graph: { cd: 0, max: BALANCE.boss.graphCooldown },
            log: { cd: 0, max: BALANCE.boss.log457Cooldown }
        };
        this.log457State = null;
        this.log457Timer = 0;
        this.log457AttackBonus = 0;
        this.isInvulnerable = false;
    }
    
    update(dt, player) {
        if (this.dead) return;
        
        const dx = player.x - this.x, dy = player.y - this.y, d = dist(this.x, this.y, player.x, player.y);
        this.angle = Math.atan2(dy, dx);
        this.timer += dt;
        this.sayTimer += dt;
        
        for (let s in this.skills) if (this.skills[s].cd > 0) this.skills[s].cd -= dt;
        
        if (this.sayTimer > 10 && Math.random() < 0.1) {
            this.speak("Player at " + Math.round(player.hp) + " HP");
            this.sayTimer = 0;
        }
        
        if (this.hp < this.maxHp * BALANCE.boss.phase2Threshold && this.phase === 1) {
            this.phase = 2;
            this.moveSpeed = BALANCE.boss.phase2Speed;
            spawnFloatingText("ENRAGED!", this.x, this.y - 80, '#ef4444', 40);
            addScreenShake(20);
            this.speak("Enough playing around!");
            Audio.playBossSpecial();
        }
        
        if (this.log457State === 'charging') {
            this.log457Timer += dt;
            this.isInvulnerable = true;
            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.1 * dt);
            if (this.log457Timer >= BALANCE.boss.log457ChargeDuration) {
                this.log457State = 'active';
                this.log457Timer = 0;
                this.log457AttackBonus = BALANCE.boss.log457AttackBonus;
                this.isInvulnerable = false;
                addScreenShake(20);
                spawnFloatingText("67! 67! 67!", this.x, this.y - 80, '#facc15', 35);
                this.speak("0.6767!");
            }
        } else if (this.log457State === 'active') {
            this.log457Timer += dt;
            this.log457AttackBonus += BALANCE.boss.log457AttackGrowth * dt;
            if (this.log457Timer >= BALANCE.boss.log457ActiveDuration) {
                this.log457State = 'stunned';
                this.log457Timer = 0;
                this.vx = 0; this.vy = 0;
                spawnFloatingText("STUNNED!", this.x, this.y - 60, '#94a3b8', 30);
            }
        } else if (this.log457State === 'stunned') {
            this.log457Timer += dt;
            this.vx = 0; this.vy = 0;
            if (this.log457Timer >= BALANCE.boss.log457StunDuration) {
                this.log457State = null;
                this.log457AttackBonus = 0;
            }
            return;
        }
        
        if (this.state === 'CHASE') {
            if (!player.isInvisible) {
                this.vx = Math.cos(this.angle) * this.moveSpeed;
                this.vy = Math.sin(this.angle) * this.moveSpeed;
            } else { this.vx *= 0.95; this.vy *= 0.95; }
            this.applyPhysics(dt);
            
            if (this.timer > 2) {
                this.timer = 0;
                if (this.skills.log.cd <= 0 && Math.random() < 0.2) this.useLog457();
                else if (this.skills.graph.cd <= 0 && Math.random() < 0.25) this.useDeadlyGraph(player);
                else if (this.skills.slam.cd <= 0 && Math.random() < 0.3) this.useEquationSlam();
                else this.state = Math.random() < 0.3 ? 'ULTIMATE' : 'ATTACK';
            }
        } else if (this.state === 'ATTACK') {
            this.vx *= 0.9; this.vy *= 0.9;
            const fr = this.phase === 2 ? 0.05 : 0.1, bf = fr / (1 + this.log457AttackBonus);
            if (this.timer > bf) {
                projectileManager.add(new Projectile(this.x, this.y, this.angle, 600, BALANCE.boss.chalkDamage, '#fff', false, 'enemy'));
                if (this.phase === 2) {
                    projectileManager.add(new Projectile(this.x, this.y, this.angle + 0.3, 600, BALANCE.boss.chalkDamage, '#fff', false, 'enemy'));
                    projectileManager.add(new Projectile(this.x, this.y, this.angle - 0.3, 600, BALANCE.boss.chalkDamage, '#fff', false, 'enemy'));
                }
                this.timer = 0;
                if (Math.random() < 0.08) this.state = 'CHASE';
            }
        } else if (this.state === 'ULTIMATE') {
            this.vx = 0; this.vy = 0;
            if (this.timer > 1) {
                const bullets = this.phase === 2 ? BALANCE.boss.phase2UltimateBullets : BALANCE.boss.ultimateBullets;
                for (let i = 0; i < bullets; i++) {
                    const a = (Math.PI * 2 / bullets) * i;
                    projectileManager.add(new Projectile(this.x, this.y, a, 400, BALANCE.boss.ultimateDamage, '#ef4444', true, 'enemy'));
                }
                addScreenShake(15);
                spawnFloatingText("POP QUIZ!", this.x, this.y - 80, '#facc15', 40);
                Audio.playBossSpecial();
                this.state = 'CHASE';
                this.timer = -1;
            }
        }
        
        if (d < this.radius + player.radius) player.takeDamage(25 * dt * (1 + this.log457AttackBonus));
        UIManager.updateBossHUD(this);
        UIManager.updateBossSpeech(this);
    }
    
    useEquationSlam() {
        this.skills.slam.cd = this.skills.slam.max;
        this.state = 'CHASE';
        addScreenShake(15);
        spawnFloatingText("EQUATION SLAM!", this.x, this.y - 80, '#facc15', 30);
        this.speak("Equation Slam!");
        Audio.playBossSpecial();
        window.specialEffects.push(new EquationSlam(this.x, this.y));
    }
    
    useDeadlyGraph(player) {
        this.skills.graph.cd = this.skills.graph.max;
        this.state = 'CHASE';
        spawnFloatingText("DEADLY GRAPH!", this.x, this.y - 80, '#3b82f6', 30);
        this.speak("Feel the power of y=x!");
        Audio.playBossSpecial();
        // ⭐ ส่งค่า graphDuration จาก config ไปด้วย
        window.specialEffects.push(new DeadlyGraph(this.x, this.y, player.x, player.y, BALANCE.boss.graphDuration));
    }
    
    useLog457() {
        this.skills.log.cd = this.skills.log.max;
        this.log457State = 'charging';
        this.log457Timer = 0;
        this.state = 'CHASE';
        spawnFloatingText("log 4.57 = ?", this.x, this.y - 80, '#ef4444', 30);
        Audio.playBossSpecial();
    }
    
    async speak(context) {
        try {
            const text = await Gemini.getBossTaunt(context);
            if (text) UIManager.showBossSpeech(text);
        } catch (e) { console.warn('Speech failed:', e); }
    }
    
    takeDamage(amt) {
        if (this.isInvulnerable) {
            spawnFloatingText('INVINCIBLE!', this.x, this.y - 40, '#facc15', 20);
            return;
        }
        this.hp -= amt;
        if (this.hp <= 0) {
            this.dead = true; this.hp = 0;
            spawnParticles(this.x, this.y, 60, '#dc2626');
            spawnFloatingText("CLASS DISMISSED!", this.x, this.y, '#facc15', 35);
            addScore(BALANCE.score.boss * this.difficulty);
            UIManager.updateBossHUD(null);
            Audio.playAchievement();
            for (let i = 0; i < 3; i++) setTimeout(() => window.powerups.push(new PowerUp(this.x + rand(-50, 50), this.y + rand(-50, 50))), i * 200);
            window.boss = null;
            Achievements.check('boss_down');
            setTimeout(() => { 
                setWave(getWave() + 1);
                if (getWave() > 5) window.endGame('victory');
                else startNextWave();
            }, 2000);
        }
    }
    
    draw() {
        const screen = worldToScreen(this.x, this.y);
        CTX.save();
        CTX.translate(screen.x, screen.y);
        
        if (this.log457State === 'charging') {
            const sc = 1 + (this.log457Timer / 2) * 0.3;
            CTX.scale(sc, sc);
            const pu = Math.sin(this.log457Timer * 10) * 0.5 + 0.5;
            CTX.beginPath(); CTX.arc(0, 0, 70, 0, Math.PI * 2);
            CTX.fillStyle = `rgba(239, 68, 68, ${pu * 0.3})`;
            CTX.fill();
        }
        
        if (this.log457State === 'active') { CTX.shadowBlur = 20; CTX.shadowColor = '#facc15'; }
        if (this.log457State === 'stunned') { CTX.font = 'bold 30px Arial'; CTX.textAlign = 'center'; CTX.fillText('😵', 0, -70); }
        if (this.state === 'ULTIMATE') {
            CTX.beginPath(); CTX.arc(0, 0, 70, 0, Math.PI * 2);
            CTX.strokeStyle = `rgba(239, 68, 68, ${Math.random()})`;
            CTX.lineWidth = 5; CTX.stroke();
        }
        if (this.phase === 2 && this.log457State !== 'charging') { CTX.shadowBlur = 20; CTX.shadowColor = '#ef4444'; }
        
        CTX.rotate(this.angle);
        CTX.fillStyle = '#f8fafc'; CTX.fillRect(-30, -30, 60, 60);
        CTX.fillStyle = '#e2e8f0'; CTX.beginPath(); CTX.moveTo(-30, -30); CTX.lineTo(-20, -20);
        CTX.lineTo(20, -20); CTX.lineTo(30, -30); CTX.closePath(); CTX.fill();
        CTX.fillStyle = '#ef4444'; CTX.beginPath(); CTX.moveTo(0, -20); CTX.lineTo(6, 0);
        CTX.lineTo(0, 25); CTX.lineTo(-6, 0); CTX.closePath(); CTX.fill();
        CTX.fillStyle = this.log457State === 'charging' ? '#ff0000' : '#e2e8f0';
        CTX.beginPath(); CTX.arc(0, 0, 24, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = '#94a3b8'; CTX.beginPath(); CTX.arc(0, 0, 26, Math.PI, 0); CTX.fill();
        
        if (this.phase === 2 || this.log457State === 'active') {
            CTX.fillStyle = '#ef4444';
            CTX.fillRect(-12, -5, 10, 3);
            CTX.fillRect(2, -5, 10, 3);
        }
        
        CTX.fillStyle = '#facc15'; CTX.fillRect(25, 12, 60, 10);
        CTX.fillStyle = '#000'; CTX.font = 'bold 8px Arial'; CTX.fillText('30cm', 50, 17);
        CTX.restore();
    }
}

// ==================== WAVE SYSTEM ====================
function startNextWave() {
    resetEnemiesKilled();
    waveStartDamage = Achievements.stats.damageTaken;
    setElementText('wave-badge', `WAVE ${getWave()}`);
    spawnFloatingText(`WAVE ${getWave()}`, player.x, player.y - 100, '#8b5cf6', 40);
    
    const count = BALANCE.waves.enemiesBase + (getWave() - 1) * BALANCE.waves.enemiesPerWave;
    spawnEnemies(count);
    
    if (getWave() % BALANCE.waves.bossEveryNWaves === 0) {
        setTimeout(() => {
            window.boss = new Boss(Math.floor(getWave() / BALANCE.waves.bossEveryNWaves));
            UIManager.updateBossHUD(window.boss);
            document.getElementById('boss-name').innerHTML = `KRU MANOP - LEVEL ${Math.floor(getWave() / BALANCE.waves.bossEveryNWaves)} <span class="ai-badge">AI</span>`;
            spawnFloatingText('BOSS INCOMING!', player.x, player.y - 100, '#ef4444', 35);
            addScreenShake(15);
            Audio.playBossSpecial();
        }, 3000);
    }
}

function spawnEnemies(count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 800;
        let x = player.x + Math.cos(angle) * distance;
        let y = player.y + Math.sin(angle) * distance;
        
        const safe = mapSystem.findSafeSpawn(x, y, 20);
        x = safe.x; y = safe.y;
        
        const r = Math.random();
        if (r < BALANCE.waves.mageSpawnChance) window.enemies.push(new MageEnemy(x, y));
        else if (r < BALANCE.waves.mageSpawnChance + BALANCE.waves.tankSpawnChance) window.enemies.push(new TankEnemy(x, y));
        else window.enemies.push(new Enemy(x, y));
    }
}

// ==================== GAME LOOP ====================
function gameLoop(now) {
    const dt = getDeltaTime(now);
    
    if (gameState === 'PLAYING') {
        updateGame(dt);
        drawGame();
    }
    
    requestAnimationFrame(gameLoop);
}

function updateGame(dt) {
    updateCamera(player.x, player.y);
    updateMouseWorld();
    
    player.update(dt, keys, mouse);
    
    weaponSystem.update(dt);
    
    const burstProjectiles = weaponSystem.updateBurst(player, player.damageBoost);
    if (burstProjectiles && burstProjectiles.length > 0) {
        projectileManager.add(burstProjectiles);
    }
    
    if (mouse.left === 1 && gameState === 'PLAYING') {
        if (weaponSystem.canShoot()) {
            const projectiles = weaponSystem.shoot(player, player.damageBoost);
            if (projectiles && projectiles.length > 0) {
                projectileManager.add(projectiles);
            }
        }
    }
    
    if (boss) boss.update(dt, player);
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].update(dt, player);
        if (enemies[i].dead) enemies.splice(i, 1);
    }
    
    if (getWave() % BALANCE.waves.bossEveryNWaves !== 0 && enemies.length === 0 && !boss) {
        if (Achievements.stats.damageTaken === waveStartDamage && getEnemiesKilled() >= 5) Achievements.check('no_damage');
        setWave(getWave() + 1);
        Achievements.check('wave_1');
        startNextWave();
    }
    
    for (let i = specialEffects.length - 1; i >= 0; i--) {
        const remove = specialEffects[i].update(dt, player, meteorZones);
        if (remove) specialEffects.splice(i, 1);
    }
    
    projectileManager.update(dt, player, enemies, boss);
    
    for (let i = powerups.length - 1; i >= 0; i--) {
        if (powerups[i].update(dt, player)) powerups.splice(i, 1);
    }
    
    for (let i = meteorZones.length - 1; i >= 0; i--) {
        meteorZones[i].life -= dt;
        
        const d = dist(meteorZones[i].x, meteorZones[i].y, player.x, player.y);
        if (d < meteorZones[i].radius) {
            player.takeDamage(meteorZones[i].damage * dt);
        }
        
        if (meteorZones[i].life <= 0) meteorZones.splice(i, 1);
    }
    
    mapSystem.update([player, ...enemies, boss].filter(e => e && !e.dead));
    particleSystem.update(dt);
    floatingTextSystem.update(dt);
    updateScreenShake();
    Achievements.checkAll();
}

function drawGame() {
    const grad = CTX.createLinearGradient(0, 0, 0, CANVAS.height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
    CTX.fillStyle = grad;
    CTX.fillRect(0, 0, CANVAS.width, CANVAS.height);
    
    CTX.save();
    const shake = getScreenShakeOffset();
    CTX.translate(shake.x, shake.y);
    
    drawGrid();
    
    for (let z of meteorZones) {
        const screen = worldToScreen(z.x, z.y);
        const a = Math.sin(performance.now() / 200) * 0.3 + 0.7;
        CTX.fillStyle = `rgba(239, 68, 68, ${a * 0.4})`;
        CTX.beginPath();
        CTX.arc(screen.x, screen.y, z.radius, 0, Math.PI * 2);
        CTX.fill();
    }
    
    mapSystem.draw();
    powerups.forEach(p => p.draw());
    specialEffects.forEach(e => e.draw());
    player.draw();
    enemies.forEach(e => e.draw());
    if (boss && !boss.dead) boss.draw();
    projectileManager.draw();
    particleSystem.draw();
    floatingTextSystem.draw();
    
    CTX.restore();
}

function drawGrid() {
    const sz = GAME_CONFIG.physics.gridSize;
    const ox = -getCamera().x % sz;
    const oy = -getCamera().y % sz;
    
    CTX.strokeStyle = 'rgba(30, 41, 59, 0.5)';
    CTX.lineWidth = 1;
    CTX.beginPath();
    for (let x = ox; x < CANVAS.width; x += sz) {
        CTX.moveTo(x, 0);
        CTX.lineTo(x, CANVAS.height);
    }
    for (let y = oy; y < CANVAS.height; y += sz) {
        CTX.moveTo(0, y);
        CTX.lineTo(CANVAS.width, y);
    }
    CTX.stroke();
}

// ==================== INIT & START ====================
async function initAI() {
    const brief = document.getElementById('mission-brief');
    
    if (!brief) {
        console.warn('⚠️ mission-brief element not found');
        return;
    }
    
    brief.textContent = "กำลังโหลดภารกิจ...";
    
    try {
        const name = await Gemini.getMissionName();
        brief.textContent = `ภารกิจ "${name}"`;
    } catch (e) {
        console.warn('Failed to get mission name:', e);
        brief.textContent = 'ภารกิจ "พิชิตครูมานพ"';
    }
}

function startGame() {
    console.log('🎮 Starting game...');
    Audio.init();
    player = new Player();
    enemies = [];
    powerups = [];
    specialEffects = [];
    meteorZones = [];
    boss = null;
    UIManager.updateBossHUD(null);// ซ่อนหลอดเลือดบอสตอนเริ่มเกมใหม่
    resetScore();
    setWave(1);
    projectileManager.clear();
    particleSystem.clear();
    floatingTextSystem.clear();
    mapSystem.init();
    weaponSystem.updateWeaponUI();
    
    Achievements.stats.damageTaken = 0;
    waveStartDamage = 0;
    
    hideElement('overlay');
    hideElement('report-card');
    
    startNextWave();
    gameState = 'PLAYING';
    resetTime();
    
    console.log('✅ Game started!');
    if (!loopRunning) {
        loopRunning = true;
        requestAnimationFrame(gameLoop);
    }
}

async function endGame(result) {
    gameState = 'GAMEOVER';
    
    if (result === 'victory') {
        showElement('victory-screen');
        setElementText('final-score', `SCORE ${getScore()}`);
        setElementText('final-wave', `WAVES CLEARED ${getWave() - 1}`);
    } else {
        showElement('overlay');
        const titleEl = document.querySelector('.title');
        if (titleEl) {
            titleEl.innerHTML = `GAME OVER<br><span class="subtitle">SCORE ${getScore()} | WAVE ${getWave()}</span>`;
        }
        
        const rc = document.getElementById('report-card');
        if (rc) rc.style.display = 'block';
        
        const ld = document.getElementById('ai-loading');
        if (ld) ld.style.display = 'block';
        
        try {
            const comment = await Gemini.getReportCard(getScore(), getWave());
            if (ld) ld.style.display = 'none';
            
            const reportText = document.getElementById('report-text');
            if (reportText) {
                reportText.textContent = comment;
            }
        } catch (e) {
            console.warn('Failed to get AI report card:', e);
            if (ld) ld.style.display = 'none';
            
            const reportText = document.getElementById('report-text');
            if (reportText) {
                reportText.textContent = "ตั้งใจเรียนให้มากกว่านี้นะ...";
            }
        }
    }
}

// ==================== INPUT ====================
window.addEventListener('keydown', e => {
    if (gameState !== 'PLAYING') return;
    if (e.code === 'KeyW') keys.w = 1;
    if (e.code === 'KeyS') keys.s = 1;
    if (e.code === 'KeyA') keys.a = 1;
    if (e.code === 'KeyD') keys.d = 1;
    if (e.code === 'Space') { keys.space = 1; e.preventDefault(); }
    if (e.code === 'KeyQ') keys.q = 1;
});

window.addEventListener('keyup', e => {
    if (e.code === 'KeyW') keys.w = 0;
    if (e.code === 'KeyS') keys.s = 0;
    if (e.code === 'KeyA') keys.a = 0;
    if (e.code === 'KeyD') keys.d = 0;
    if (e.code === 'Space') keys.space = 0;
    if (e.code === 'KeyQ') { 
        if (gameState === 'PLAYING') {
            weaponSystem.switchWeapon(); 
        }
        keys.q = 0; 
    }
});

window.addEventListener('mousemove', e => {
    if (!CANVAS) return;
    const r = CANVAS.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    updateMouseWorld();
});

window.addEventListener('mousedown', e => {
    if (!CANVAS) return;
    if (e.button === 0) {
        mouse.left = 1;
        console.log('🖱️ Mouse down - auto-fire active');
    }
    if (e.button === 2) mouse.right = 1;
    e.preventDefault();
});

window.addEventListener('mouseup', e => {
    if (e.button === 0) {
        mouse.left = 0;
        console.log('🖱️ Mouse up - auto-fire stopped');
    }
    if (e.button === 2) mouse.right = 0;
});

window.addEventListener('contextmenu', e => e.preventDefault());

// ==================== EXPOSE TO GLOBAL ====================
window.startGame = startGame;
window.endGame = endGame;

// Init on load
window.onload = () => {
    console.log('🚀 Initializing game...');
    initCanvas();
    initAI();
};
