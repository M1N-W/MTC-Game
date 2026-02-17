/**
 * 🎮 MTC: ENHANCED EDITION - Main Game Loop
 * Game state, Boss, waves, input, loop
 *
 * REFACTORED (Shop Feature — v4):
 * - ✅ MTC_SHOP_LOCATION — fixed world position for the interactive shop kiosk
 * - ✅ Proximity detection → shows shop-prompt + HUD icon
 * - ✅ 'B' key / mobile btn-shop → openShop()
 * - ✅ openShop()  → gameState = 'PAUSED', ShopManager.open()
 * - ✅ closeShop() → gameState = 'PLAYING', ShopManager.close(), reset keys
 * - ✅ buyItem(itemId) — deducts score, applies timed/instant effect
 * - ✅ Shop buff timers tick in updateGame()
 * - ✅ drawShopObject() — golden kiosk drawn on map each frame
 * - ✅ Shopaholic achievement tracking via Achievements.stats.shopPurchases
 *
 * (Database Feature — v3 — unchanged):
 * - ✅ MTC_DATABASE_SERVER — fixed world position for the interactive server object
 * - ✅ 'E' key / mobile btn-database → openExternalDatabase()
 * - ✅ gameState = 'PAUSED' when DB is opened or window loses focus (blur)
 * - ✅ resumeGame()  → restores gameState = 'PLAYING', resets keys, hides prompt
 *
 * (Drone Feature — v5 — unchanged):
 * - ✅ window.drone global — holds the active Drone instance
 * - ✅ startGame() creates a fresh Drone at player spawn
 * - ✅ updateGame() calls drone.update(dt, player)
 * - ✅ drawGame() calls drone.draw() between map objects and player
 * - ✅ endGame() nullifies window.drone to prevent stale references
 *
 * (Boss Dog Rider — v6 — NEW):
 * - ✅ Boss draws a fully animated dog underneath (4 legs, tail, head)
 * - ✅ Dog color driven by BALANCE.boss.phase2.dogColor (amber/brown)
 * - ✅ Dog legs animate via Math.sin keyed to this.dogLegTimer
 * - ✅ Enrage at HP < 50%: dog turns red, speed *= enrageSpeedMult, particles
 * - ✅ New bark() attack: emits BarkWave cone, damages + pushes player
 * - ✅ BarkWave class: expanding arc rings with glow; auto-removed after 0.6s
 * - ✅ Bark mixed into CHASE decision tree alongside Slam / Graph / Summon
 */

// ─── Game State ───────────────────────────────────────────
let gameState  = 'MENU';
let loopRunning = false;
const keys = { w: 0, a: 0, s: 0, d: 0, space: 0, q: 0, e: 0, b: 0 };

// ─── Game Objects (global) ────────────────────────────────
window.player         = null;
window.enemies        = [];
window.boss           = null;
window.powerups       = [];
window.specialEffects = [];
window.meteorZones    = [];
window.drone          = null;   // ← Engineering Drone companion
let waveStartDamage   = 0;

// ─── MTC Database Server ──────────────────────────────────
/**
 * Fixed world-space position of the interactive "MTC Database" server.
 * Placed at (350, -350) — away from spawn so players must explore to find it.
 */
const MTC_DATABASE_SERVER = {
    x: 350,
    y: -350,
    INTERACTION_RADIUS: 90   // world units — must be within this to interact
};

// ─── MTC Shop Location ────────────────────────────────────
/**
 * Fixed world-space position of the in-game shop kiosk.
 * Placed at (-350, 350) — the opposite diagonal from the database server
 * so players naturally discover both as they explore.
 */
const MTC_SHOP_LOCATION = {
    x: -350,
    y:  350,
    INTERACTION_RADIUS: 90   // world units
};

// ─── External Database URL ────────────────────────────────
const MTC_DB_URL = 'https://claude.ai/public/artifacts/9779928b-11d1-442b-b17d-2ef5045b9660';

// ══════════════════════════════════════════════════════════════
// DATABASE / PAUSE HELPERS
// ══════════════════════════════════════════════════════════════

function showResumePrompt(visible) {
    const el    = document.getElementById('resume-prompt');
    const strip = document.getElementById('pause-indicator');
    if (el)    el.style.display    = visible ? 'flex'  : 'none';
    if (strip) strip.style.display = visible ? 'block' : 'none';
}

function openExternalDatabase() {
    if (gameState !== 'PLAYING') return;
    gameState = 'PAUSED';

    window.open(MTC_DB_URL, '_blank');
    showResumePrompt(true);

    const promptEl = document.getElementById('db-prompt');
    if (promptEl) promptEl.style.display = 'none';

    if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
    if (player) spawnFloatingText('📚 MTC DATABASE', player.x, player.y - 60, '#06b6d4', 22);
}

function resumeGame() {
    if (gameState !== 'PAUSED') return;
    gameState = 'PLAYING';

    showResumePrompt(false);

    keys.w = 0; keys.a = 0; keys.s = 0; keys.d = 0;
    keys.space = 0; keys.q = 0; keys.e = 0; keys.b = 0;

    window.focus();

    if (player) spawnFloatingText('▶ RESUMED', player.x, player.y - 50, '#34d399', 18);
}

// Backward-compatible aliases
function openDatabase()   { openExternalDatabase(); }
function showMathModal()  { openExternalDatabase(); }
function closeMathModal() { resumeGame(); }

window.openExternalDatabase = openExternalDatabase;
window.openDatabase         = openDatabase;
window.resumeGame           = resumeGame;
window.showMathModal        = showMathModal;
window.closeMathModal       = closeMathModal;

// ── Window Focus / Blur Listeners ────────────────────────
window.addEventListener('blur', () => {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        // Only show the generic resume prompt if shop is NOT open
        const shopModal = document.getElementById('shop-modal');
        const shopOpen  = shopModal && shopModal.style.display === 'flex';
        if (!shopOpen) showResumePrompt(true);
    }
});

window.addEventListener('focus', () => {
    if (gameState === 'PAUSED') {
        const shopModal = document.getElementById('shop-modal');
        const shopOpen  = shopModal && shopModal.style.display === 'flex';
        if (!shopOpen) showResumePrompt(true);
    }
});

// ─── Draw the Database Server on the map ─────────────────
function drawDatabaseServer() {
    const screen = worldToScreen(MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
    const t    = performance.now() / 600;
    const glow = Math.abs(Math.sin(t)) * 0.5 + 0.5;

    if (player) {
        const d = dist(player.x, player.y, MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
        if (d < MTC_DATABASE_SERVER.INTERACTION_RADIUS * 2) {
            const alpha = Math.max(0, 1 - d / (MTC_DATABASE_SERVER.INTERACTION_RADIUS * 2));
            CTX.save();
            CTX.globalAlpha = alpha * 0.25 * glow;
            CTX.strokeStyle = '#06b6d4';
            CTX.lineWidth   = 2;
            CTX.setLineDash([6, 4]);
            CTX.beginPath();
            CTX.arc(screen.x, screen.y, MTC_DATABASE_SERVER.INTERACTION_RADIUS, 0, Math.PI * 2);
            CTX.stroke();
            CTX.setLineDash([]);
            CTX.restore();
        }
    }

    CTX.fillStyle = 'rgba(0,0,0,0.35)';
    CTX.beginPath();
    CTX.ellipse(screen.x, screen.y + 28, 18, 7, 0, 0, Math.PI * 2);
    CTX.fill();

    CTX.save();
    CTX.translate(screen.x, screen.y);
    CTX.shadowBlur  = 14 * glow;
    CTX.shadowColor = '#06b6d4';

    CTX.fillStyle   = '#0c1a2e';
    CTX.strokeStyle = '#06b6d4';
    CTX.lineWidth   = 2;
    CTX.beginPath();
    CTX.roundRect(-18, -26, 36, 50, 5);
    CTX.fill();
    CTX.stroke();

    for (let i = 0; i < 3; i++) {
        CTX.fillStyle = '#0f2744';
        CTX.fillRect(-14, -20 + i * 14, 28, 10);

        CTX.fillStyle = i === 0 ? '#22c55e' : '#0e7490';
        CTX.fillRect(-12, -18 + i * 14, 10, 6);

        CTX.fillStyle   = i === 1 ? `rgba(6,182,212,${glow})` : '#22c55e';
        CTX.shadowBlur  = 6;
        CTX.shadowColor = i === 1 ? '#06b6d4' : '#22c55e';
        CTX.beginPath();
        CTX.arc(10, -15 + i * 14, 3.5, 0, Math.PI * 2);
        CTX.fill();
    }

    CTX.shadowBlur = 0;
    CTX.fillStyle  = '#67e8f9';
    CTX.font       = 'bold 7px Arial';
    CTX.textAlign  = 'center';
    CTX.textBaseline = 'middle';
    CTX.fillText('MTC DATABASE', 0, 33);

    CTX.restore();
}

// ─── Proximity UI updater (DB) ────────────────────────────
function updateDatabaseServerUI() {
    if (!player) return;
    const d    = dist(player.x, player.y, MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
    const near = d < MTC_DATABASE_SERVER.INTERACTION_RADIUS;

    const promptEl  = document.getElementById('db-prompt');
    const hudIcon   = document.getElementById('db-hud-icon');
    const btnDb     = document.getElementById('btn-database');

    if (promptEl) promptEl.style.display = near ? 'block' : 'none';
    if (hudIcon)  hudIcon.style.display  = near ? 'flex'  : 'none';
    if (btnDb)    btnDb.style.display    = near ? 'flex'  : 'none';
}

// ══════════════════════════════════════════════════════════════
// 🛒 SHOP — DRAW, PROXIMITY, OPEN, CLOSE, BUY
// ══════════════════════════════════════════════════════════════

function drawShopObject() {
    const screen = worldToScreen(MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);
    const t      = performance.now() / 700;
    const glow   = Math.abs(Math.sin(t)) * 0.5 + 0.5;
    const bounce = Math.sin(performance.now() / 500) * 3;

    if (player) {
        const d = dist(player.x, player.y, MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);
        if (d < MTC_SHOP_LOCATION.INTERACTION_RADIUS * 2) {
            const alpha = Math.max(0, 1 - d / (MTC_SHOP_LOCATION.INTERACTION_RADIUS * 2));
            CTX.save();
            CTX.globalAlpha = alpha * 0.3 * glow;
            CTX.strokeStyle = '#facc15';
            CTX.lineWidth   = 2;
            CTX.setLineDash([6, 4]);
            CTX.beginPath();
            CTX.arc(screen.x, screen.y, MTC_SHOP_LOCATION.INTERACTION_RADIUS, 0, Math.PI * 2);
            CTX.stroke();
            CTX.setLineDash([]);
            CTX.restore();
        }
    }

    CTX.fillStyle = 'rgba(0,0,0,0.4)';
    CTX.beginPath();
    CTX.ellipse(screen.x, screen.y + 32, 22, 8, 0, 0, Math.PI * 2);
    CTX.fill();

    CTX.save();
    CTX.translate(screen.x, screen.y + bounce);
    CTX.shadowBlur  = 18 * glow;
    CTX.shadowColor = '#facc15';

    CTX.fillStyle   = '#78350f';
    CTX.strokeStyle = '#facc15';
    CTX.lineWidth   = 2;
    CTX.beginPath();
    CTX.roundRect(-22, 0, 44, 28, 4);
    CTX.fill();
    CTX.stroke();

    CTX.fillStyle = '#92400e';
    CTX.beginPath();
    CTX.roundRect(-22, -6, 44, 10, 3);
    CTX.fill();
    CTX.strokeStyle = '#fbbf24';
    CTX.lineWidth = 1.5;
    CTX.stroke();

    CTX.strokeStyle = '#d97706';
    CTX.lineWidth   = 3;
    CTX.beginPath(); CTX.moveTo(-18, -6); CTX.lineTo(-18, -34); CTX.stroke();
    CTX.beginPath(); CTX.moveTo( 18, -6); CTX.lineTo( 18, -34); CTX.stroke();

    CTX.fillStyle = `rgba(250,204,21,${0.85 + glow * 0.15})`;
    CTX.beginPath();
    CTX.moveTo(-26, -34);
    CTX.lineTo( 26, -34);
    CTX.lineTo( 22, -24);
    CTX.lineTo(-22, -24);
    CTX.closePath();
    CTX.fill();
    CTX.strokeStyle = '#b45309';
    CTX.lineWidth   = 1.5;
    CTX.stroke();

    CTX.fillStyle = '#f59e0b';
    for (let i = 0; i < 5; i++) {
        CTX.beginPath();
        CTX.arc(-20 + i * 10, -24, 5, 0, Math.PI);
        CTX.fill();
    }

    CTX.font          = '16px Arial';
    CTX.textAlign     = 'center';
    CTX.textBaseline  = 'middle';
    CTX.shadowBlur    = 0;
    CTX.fillText('🛒', 0, 10);

    const coinBounce = Math.sin(performance.now() / 350) * 4;
    CTX.font     = '14px Arial';
    CTX.fillText('🪙', 0, -46 + coinBounce);

    CTX.shadowBlur   = 0;
    CTX.fillStyle    = '#fbbf24';
    CTX.font         = 'bold 7px Arial';
    CTX.textAlign    = 'center';
    CTX.textBaseline = 'middle';
    CTX.fillText('MTC CO-OP STORE', 0, 38);

    CTX.restore();
}

function updateShopProximityUI() {
    if (!player) return;
    const d    = dist(player.x, player.y, MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);
    const near = d < MTC_SHOP_LOCATION.INTERACTION_RADIUS;

    const promptEl = document.getElementById('shop-prompt');
    const hudIcon  = document.getElementById('shop-hud-icon');
    const btnShop  = document.getElementById('btn-shop');

    if (promptEl) promptEl.style.display = near ? 'block' : 'none';
    if (hudIcon)  hudIcon.style.display  = near ? 'flex'  : 'none';
    if (btnShop)  btnShop.style.display  = near ? 'flex'  : 'none';
}

function openShop() {
    if (gameState !== 'PLAYING') return;
    gameState = 'PAUSED';

    const promptEl = document.getElementById('shop-prompt');
    if (promptEl) promptEl.style.display = 'none';

    ShopManager.open();

    if (player) spawnFloatingText('🛒 MTC CO-OP STORE', player.x, player.y - 70, '#facc15', 22);
    if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
}

function closeShop() {
    if (gameState !== 'PAUSED') return;
    gameState = 'PLAYING';

    ShopManager.close();
    showResumePrompt(false);

    keys.w = 0; keys.a = 0; keys.s = 0; keys.d = 0;
    keys.space = 0; keys.q = 0; keys.e = 0; keys.b = 0;

    window.focus();

    if (player) spawnFloatingText('▶ RESUMED', player.x, player.y - 50, '#34d399', 18);
}

function buyItem(itemId) {
    const item = SHOP_ITEMS[itemId];
    if (!item) { console.warn('buyItem: unknown itemId', itemId); return; }

    if (!player) return;

    const currentScore = getScore();
    if (currentScore < item.cost) {
        spawnFloatingText('คะแนนไม่พอ! 💸', player.x, player.y - 60, '#ef4444', 18);
        if (typeof Audio !== 'undefined' && Audio.playHit) Audio.playHit();
        ShopManager.updateButtons();
        return;
    }

    addScore(-item.cost);

    if (itemId === 'potion') {
        const maxHp   = player.maxHp || BALANCE.characters[player.charType]?.maxHp || 110;
        const lacking = maxHp - player.hp;
        const healAmt = Math.min(item.heal, lacking);
        if (healAmt > 0) {
            player.hp += healAmt;
            spawnFloatingText(`+${healAmt} HP 🧃`, player.x, player.y - 70, '#22c55e', 22);
            spawnParticles(player.x, player.y, 10, '#22c55e');
            if (typeof Audio !== 'undefined' && Audio.playHeal) Audio.playHeal();
        } else {
            spawnFloatingText('HP เต็มแล้ว!', player.x, player.y - 60, '#94a3b8', 16);
        }

    } else if (itemId === 'damageUp') {
        if (player.shopDamageBoostActive) {
            player.shopDamageBoostTimer += item.duration;
            spawnFloatingText('🔧 DMG เวลา +30s!', player.x, player.y - 70, '#f59e0b', 22);
        } else {
            player._baseDamageBoost   = player.damageBoost || 1.0;
            player.damageBoost        = (player.damageBoost || 1.0) * item.mult;
            player.shopDamageBoostActive = true;
            player.shopDamageBoostTimer  = item.duration;
            spawnFloatingText('🔧 DMG ×1.1!', player.x, player.y - 70, '#f59e0b', 22);
            spawnParticles(player.x, player.y, 8, '#f59e0b');
        }
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();

    } else if (itemId === 'speedUp') {
        if (player.shopSpeedBoostActive) {
            player.shopSpeedBoostTimer += item.duration;
            spawnFloatingText('👟 SPD เวลา +30s!', player.x, player.y - 70, '#06b6d4', 22);
        } else {
            player._baseMoveSpeed     = player.moveSpeed;
            player.moveSpeed          = player.moveSpeed * item.mult;
            player.shopSpeedBoostActive = true;
            player.shopSpeedBoostTimer  = item.duration;
            spawnFloatingText('👟 SPD ×1.1!', player.x, player.y - 70, '#06b6d4', 22);
            spawnParticles(player.x, player.y, 8, '#06b6d4');
        }
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
    }

    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.textContent = getScore().toLocaleString();

    Achievements.stats.shopPurchases = (Achievements.stats.shopPurchases || 0) + 1;
    Achievements.check('shopaholic');

    ShopManager.updateButtons();
}

window.openShop   = openShop;
window.closeShop  = closeShop;
window.buyItem    = buyItem;

// ══════════════════════════════════════════════════════════════
// 🐕 BARK WAVE — Sonic cone visual emitted by Bark attack
//
// Spawned into window.specialEffects by Boss.bark().
// Each frame: expands outward from origin along bossAngle,
// drawing BARK_RINGS concentric arc segments inside the cone.
// Removed automatically when timer >= duration.
// ══════════════════════════════════════════════════════════════
class BarkWave {
    /**
     * @param {number} x          World X of boss when bark fired
     * @param {number} y          World Y
     * @param {number} angle      Direction the bark travels (radians)
     * @param {number} coneHalf   Half-angle of the cone (radians)
     * @param {number} range      Max world-unit radius of the cone
     */
    constructor(x, y, angle, coneHalf, range) {
        this.x        = x;
        this.y        = y;
        this.angle    = angle;
        this.coneHalf = coneHalf;
        this.range    = range;
        this.timer    = 0;
        this.duration = 0.55;   // seconds until auto-removal
        this.rings    = 5;      // number of concentric arc rings
    }

    // update() must return true to signal removal from specialEffects
    update(dt /*, player, meteorZones — unused */) {
        this.timer += dt;
        return this.timer >= this.duration;
    }

    draw() {
        const screen   = worldToScreen(this.x, this.y);
        const progress = this.timer / this.duration; // 0 → 1
        const alpha    = 1 - progress;               // fade out over lifetime

        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);

        for (let i = 0; i < this.rings; i++) {
            // Each ring starts offset by its index and expands outward
            const frac = (progress + i / this.rings) % 1;
            const r    = frac * this.range;
            if (r < 4) continue; // skip degenerate arcs at origin

            const ringAlpha = alpha * (1 - i / this.rings) * 0.75;
            if (ringAlpha <= 0) continue;

            CTX.save();
            CTX.globalAlpha   = ringAlpha;
            CTX.strokeStyle   = i % 2 === 0 ? '#f59e0b' : '#fbbf24';
            CTX.lineWidth     = Math.max(1, 3.5 - i * 0.5);
            CTX.shadowBlur    = 12;
            CTX.shadowColor   = '#d97706';
            CTX.lineCap       = 'round';

            // Main arc in the forward cone
            CTX.beginPath();
            CTX.arc(0, 0, r, -this.coneHalf, this.coneHalf);
            CTX.stroke();

            // Left bounding ray segment
            CTX.beginPath();
            CTX.moveTo(Math.cos(-this.coneHalf) * Math.max(0, r - 25),
                       Math.sin(-this.coneHalf) * Math.max(0, r - 25));
            CTX.lineTo(Math.cos(-this.coneHalf) * r,
                       Math.sin(-this.coneHalf) * r);
            CTX.stroke();

            // Right bounding ray segment
            CTX.beginPath();
            CTX.moveTo(Math.cos(this.coneHalf) * Math.max(0, r - 25),
                       Math.sin(this.coneHalf) * Math.max(0, r - 25));
            CTX.lineTo(Math.cos(this.coneHalf) * r,
                       Math.sin(this.coneHalf) * r);
            CTX.stroke();

            CTX.restore();
        }

        // Central muzzle flash at origin
        if (progress < 0.25) {
            const flashAlpha = (1 - progress / 0.25) * 0.8;
            CTX.globalAlpha = flashAlpha;
            CTX.fillStyle   = '#fbbf24';
            CTX.shadowBlur  = 20;
            CTX.shadowColor = '#f59e0b';
            CTX.beginPath();
            CTX.arc(0, 0, 14 * (1 - progress / 0.25), 0, Math.PI * 2);
            CTX.fill();
        }

        CTX.restore();
    }
}

// ══════════════════════════════════════════════════════════════
// 👑 BOSS — "KRU MANOP THE DOG RIDER"
// ══════════════════════════════════════════════════════════════
class Boss extends Entity {
    constructor(difficulty = 1) {
        super(0, BALANCE.boss.spawnY, BALANCE.boss.radius);
        this.maxHp      = BALANCE.boss.baseHp * difficulty;
        this.hp         = this.maxHp;
        this.name       = "KRU MANOP";
        this.state      = 'CHASE';
        this.timer      = 0;
        this.moveSpeed  = BALANCE.boss.moveSpeed;
        this.difficulty = difficulty;
        this.phase      = 1;
        this.sayTimer   = 0;

        // ── Existing skill timers ──
        this.skills = {
            slam:  { cd: 0, max: BALANCE.boss.slamCooldown },
            graph: { cd: 0, max: BALANCE.boss.graphCooldown },
            log:   { cd: 0, max: BALANCE.boss.log457Cooldown },
            // 🐕 NEW — Bark Wave attack (available in all phases, priority ↑ in phase 2)
            bark:  { cd: 0, max: BALANCE.boss.phase2.barkCooldown }
        };

        // ── log457 state machine ──
        this.log457State       = null;
        this.log457Timer       = 0;
        this.log457AttackBonus = 0;
        this.isInvulnerable    = false;

        // ── 🐕 Dog Rider state (NEW) ──────────────────────────
        // isEnraged  — true once HP drops below 50%; triggers once only
        // dogLegTimer — monotonically increasing timer that drives leg sin waves
        this.isEnraged    = false;
        this.dogLegTimer  = 0;
    }

    // ──────────────────────────────────────────────────────────
    // update(dt, player)
    // ──────────────────────────────────────────────────────────
    update(dt, player) {
        if (this.dead) return;

        const dx = player.x - this.x, dy = player.y - this.y;
        const d  = dist(this.x, this.y, player.x, player.y);
        this.angle    = Math.atan2(dy, dx);
        this.timer   += dt;
        this.sayTimer += dt;

        // ── Dog leg animation timer (faster when enraged) ──
        this.dogLegTimer += dt * (this.isEnraged ? 2.5 : 1.0);

        // ── Tick all skill cooldowns ──
        for (let s in this.skills) if (this.skills[s].cd > 0) this.skills[s].cd -= dt;

        // ── Periodic speech ──
        if (this.sayTimer > BALANCE.boss.speechInterval && Math.random() < 0.1) {
            this.speak("Player at " + Math.round(player.hp) + " HP");
            this.sayTimer = 0;
        }

        // ── 🔥 ENRAGE — triggers ONCE when HP < 50% ──────────
        // Replaces the old phase2Speed transition.
        // moveSpeed is set to base × enrageSpeedMult for a sharper jump.
        if (this.hp < this.maxHp * BALANCE.boss.phase2Threshold && this.phase === 1) {
            this.phase     = 2;
            this.isEnraged = true;
            // Use enrageSpeedMult against the original base speed so the
            // value is predictable regardless of shop or status buffs.
            this.moveSpeed = BALANCE.boss.moveSpeed * BALANCE.boss.phase2.enrageSpeedMult;
            spawnFloatingText("ENRAGED!", this.x, this.y - 80, '#ef4444', 40);
            spawnFloatingText("🐕 DOG RIDER!", this.x, this.y - 120, '#d97706', 32);
            addScreenShake(20);
            spawnParticles(this.x, this.y, 35, '#ef4444');
            spawnParticles(this.x, this.y, 20, '#d97706');
            this.speak("Hop on, boy! Let's go!");
            Audio.playBossSpecial();
        }

        // ── log457 state machine (unchanged) ──
        if (this.log457State === 'charging') {
            this.log457Timer += dt;
            this.isInvulnerable = true;
            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * BALANCE.boss.log457HealRate * dt);
            if (this.log457Timer >= BALANCE.boss.log457ChargeDuration) {
                this.log457State       = 'active';
                this.log457Timer       = 0;
                this.log457AttackBonus = BALANCE.boss.log457AttackBonus;
                this.isInvulnerable    = false;
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
                this.log457State       = null;
                this.log457AttackBonus = 0;
            }
            return; // skip rest of update while stunned
        }

        // ── State machine ──
        if (this.state === 'CHASE') {
            if (!player.isInvisible) {
                this.vx = Math.cos(this.angle) * this.moveSpeed;
                this.vy = Math.sin(this.angle) * this.moveSpeed;
            } else { this.vx *= 0.95; this.vy *= 0.95; }
            this.applyPhysics(dt);

            if (this.timer > 2) {
                this.timer = 0;
                // Priority order — bark is inserted between graph and slam.
                // Phase 2 doubles bark chance since the dog is now active.
                const barkChance = this.phase === 2 ? 0.40 : 0.18;
                if      (this.skills.log.cd   <= 0 && Math.random() < 0.20) this.useLog457();
                else if (this.skills.graph.cd <= 0 && Math.random() < 0.25) this.useDeadlyGraph(player);
                else if (this.skills.bark.cd  <= 0 && Math.random() < barkChance) this.bark(player);
                else if (this.skills.slam.cd  <= 0 && Math.random() < 0.30) this.useEquationSlam();
                else this.state = Math.random() < 0.3 ? 'ULTIMATE' : 'ATTACK';
            }
        } else if (this.state === 'ATTACK') {
            this.vx *= 0.9; this.vy *= 0.9;
            const fr = this.phase === 2 ? BALANCE.boss.phase2AttackFireRate : BALANCE.boss.attackFireRate;
            const bf = fr / (1 + this.log457AttackBonus);
            if (this.timer > bf) {
                projectileManager.add(new Projectile(this.x, this.y, this.angle, BALANCE.boss.chalkProjectileSpeed, BALANCE.boss.chalkDamage, '#fff', false, 'enemy'));
                if (this.phase === 2) {
                    projectileManager.add(new Projectile(this.x, this.y, this.angle + 0.3, BALANCE.boss.chalkProjectileSpeed, BALANCE.boss.chalkDamage, '#fff', false, 'enemy'));
                    projectileManager.add(new Projectile(this.x, this.y, this.angle - 0.3, BALANCE.boss.chalkProjectileSpeed, BALANCE.boss.chalkDamage, '#fff', false, 'enemy'));
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
                    projectileManager.add(new Projectile(this.x, this.y, a, BALANCE.boss.ultimateProjectileSpeed, BALANCE.boss.ultimateDamage, '#ef4444', true, 'enemy'));
                }
                addScreenShake(15);
                spawnFloatingText("POP QUIZ!", this.x, this.y - 80, '#facc15', 40);
                Audio.playBossSpecial();
                this.state = 'CHASE';
                this.timer = -1;
            }
        }

        // ── Contact damage ──
        if (d < this.radius + player.radius) {
            player.takeDamage(BALANCE.boss.contactDamage * dt * (1 + this.log457AttackBonus));
        }

        UIManager.updateBossHUD(this);
        UIManager.updateBossSpeech(this);
    }

    // ──────────────────────────────────────────────────────────
    // 🐕 bark(player) — NEW
    // Emits a BarkWave special effect and deals instant damage +
    // pushback if the player is inside the cone.
    // ──────────────────────────────────────────────────────────
    bark(player) {
        const P2       = BALANCE.boss.phase2;
        this.skills.bark.cd = this.skills.bark.max;
        this.state = 'CHASE'; // keep chasing while barking

        const barkAngle = Math.atan2(player.y - this.y, player.x - this.x);
        const coneHalf  = Math.PI / 3.5; // ~51° half-angle → ~103° total cone

        // ── Spawn visual effect ──
        window.specialEffects.push(new BarkWave(this.x, this.y, barkAngle, coneHalf, P2.barkRange));

        // ── Damage check: is player inside cone AND within range? ──
        const dx       = player.x - this.x, dy = player.y - this.y;
        const d        = Math.hypot(dx, dy);
        if (d > 0 && d < P2.barkRange) {
            // Signed angular difference — keep result in [-PI, PI]
            const playerAngle = Math.atan2(dy, dx);
            let   diff        = playerAngle - barkAngle;
            // Wrap to [-PI, PI]
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            if (Math.abs(diff) < coneHalf) {
                // Damage
                player.takeDamage(P2.barkDamage);

                // Pushback — launches player away from boss
                const pushMag = 480;
                player.vx += (dx / d) * pushMag;
                player.vy += (dy / d) * pushMag;

                spawnFloatingText('BARK! 🐕', player.x, player.y - 55, '#f59e0b', 26);
                addScreenShake(10);
            }
        }

        spawnFloatingText('WOOF WOOF!', this.x, this.y - 100, '#d97706', 30);
        spawnParticles(this.x, this.y, 12, '#d97706');
        Audio.playBossSpecial();
        this.speak("BARK BARK BARK!");
    }

    // ──────────────────────────────────────────────────────────
    // Existing special attacks (unchanged)
    // ──────────────────────────────────────────────────────────
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
        window.specialEffects.push(new DeadlyGraph(this.x, this.y, player.x, player.y, BALANCE.boss.graphDuration));
    }

    useLog457() {
        this.skills.log.cd = this.skills.log.max;
        this.log457State   = 'charging';
        this.log457Timer   = 0;
        this.state         = 'CHASE';
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
            for (let i = 0; i < 3; i++) {
                setTimeout(() => window.powerups.push(new PowerUp(this.x + rand(-50,50), this.y + rand(-50,50))), i * 200);
            }
            window.boss = null;
            Achievements.check('boss_down');
            setTimeout(() => {
                setWave(getWave() + 1);
                if (getWave() > BALANCE.waves.maxWaves) window.endGame('victory');
                else startNextWave();
            }, BALANCE.boss.nextWaveDelay);
        }
    }

    // ──────────────────────────────────────────────────────────
    // draw()
    // Render order (all in rotated boss space):
    //   1. Enrage red aura / log charging aura
    //   2. 🐕 Dog body, legs, tail, head (drawn FIRST so boss sits on top)
    //   3. Original boss body (shirt, ruler, face, etc.)
    //   4. Enrage anger particles
    // ──────────────────────────────────────────────────────────
    draw() {
        const screen = worldToScreen(this.x, this.y);
        CTX.save();
        CTX.translate(screen.x, screen.y);

        // ── log457 charging scale + aura ──
        if (this.log457State === 'charging') {
            const sc = 1 + (this.log457Timer / 2) * 0.3;
            CTX.scale(sc, sc);
            const pu = Math.sin(this.log457Timer * 10) * 0.5 + 0.5;
            CTX.beginPath(); CTX.arc(0, 0, 70, 0, Math.PI * 2);
            CTX.fillStyle = `rgba(239, 68, 68, ${pu * 0.3})`; CTX.fill();
        }

        // ── Phase 2 / active log glow ──
        if (this.log457State === 'active')  { CTX.shadowBlur = 20; CTX.shadowColor = '#facc15'; }
        if (this.log457State === 'stunned') {
            CTX.font = 'bold 30px Arial'; CTX.textAlign = 'center'; CTX.fillText('😵', 0, -70);
        }

        // ── Ultimate windup ring ──
        if (this.state === 'ULTIMATE') {
            CTX.beginPath(); CTX.arc(0, 0, 70, 0, Math.PI * 2);
            CTX.strokeStyle = `rgba(239, 68, 68, ${Math.random()})`;
            CTX.lineWidth = 5; CTX.stroke();
        }

        // ── Phase 2 red shadow (only when not log-charging) ──
        if (this.phase === 2 && this.log457State !== 'charging') {
            CTX.shadowBlur = 20; CTX.shadowColor = '#ef4444';
        }

        // ── Rotate to face player ──
        CTX.rotate(this.angle);

        // ════════════════════════════════════════════════════
        // 🐕 DOG — drawn in rotated boss-local space BEFORE
        //          the boss body so the boss appears to sit on top.
        //
        // Coordinate system after rotate(this.angle):
        //   +x = forward (toward player)
        //   +y = down (screen space, roughly)
        //
        // Dog layout:
        //   Head  →  forward at (52, 18)
        //   Body  →  center   ( 8, 32)  elongated ellipse
        //   Tail  →  behind   (-48, 22) wagging arc
        //   4 legs attached to body corners, animated via sin
        // ════════════════════════════════════════════════════
        this._drawDog();

        // ════════════════════════════════════════════════════
        // 👑 BOSS BODY — original art (preserved exactly)
        // ════════════════════════════════════════════════════
        CTX.fillStyle = '#f8fafc'; CTX.fillRect(-30, -30, 60, 60);
        CTX.fillStyle = '#e2e8f0';
        CTX.beginPath(); CTX.moveTo(-30,-30); CTX.lineTo(-20,-20); CTX.lineTo(20,-20); CTX.lineTo(30,-30); CTX.closePath(); CTX.fill();
        CTX.fillStyle = '#ef4444';
        CTX.beginPath(); CTX.moveTo(0,-20); CTX.lineTo(6,0); CTX.lineTo(0,25); CTX.lineTo(-6,0); CTX.closePath(); CTX.fill();
        CTX.fillStyle = this.log457State === 'charging' ? '#ff0000' : '#e2e8f0';
        CTX.beginPath(); CTX.arc(0, 0, 24, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = '#94a3b8'; CTX.beginPath(); CTX.arc(0, 0, 26, Math.PI, 0); CTX.fill();
        if (this.phase === 2 || this.log457State === 'active') {
            CTX.fillStyle = '#ef4444';
            CTX.fillRect(-12,-5,10,3); CTX.fillRect(2,-5,10,3);
        }
        // Ruler
        CTX.fillStyle = '#facc15'; CTX.fillRect(25, 12, 60, 10);
        CTX.fillStyle = '#000'; CTX.font = 'bold 8px Arial'; CTX.fillText('30cm', 50, 17);

        // ── Enrage angry particles overlay on boss face ──
        if (this.isEnraged) {
            const t = performance.now() / 80;
            for (let i = 0; i < 4; i++) {
                const px = Math.sin(t * 0.9 + i * 1.57) * 18;
                const py = -Math.abs(Math.cos(t * 1.1 + i * 1.57)) * 22 - 30;
                const ps = 3 + Math.sin(t + i) * 1.5;
                CTX.globalAlpha = 0.55 + Math.sin(t + i) * 0.3;
                CTX.fillStyle   = i % 2 === 0 ? '#ef4444' : '#f97316';
                CTX.shadowBlur  = 8;
                CTX.shadowColor = '#ef4444';
                CTX.beginPath();
                CTX.arc(px, py, ps, 0, Math.PI * 2);
                CTX.fill();
            }
            CTX.globalAlpha = 1;
            CTX.shadowBlur  = 0;
        }

        CTX.restore();
    }

    // ──────────────────────────────────────────────────────────
    // _drawDog()
    // Internal helper — renders the animated dog in the
    // already-rotated boss local coordinate system.
    // Called only from draw().
    // ──────────────────────────────────────────────────────────
    _drawDog() {
        const P2       = BALANCE.boss.phase2;
        // Colors shift to red/dark-red when enraged
        const bodyCol  = this.isEnraged ? '#dc2626' : P2.dogColor;       // main body
        const darkCol  = this.isEnraged ? '#991b1b' : '#92400e';         // stroke / underside
        const lightCol = this.isEnraged ? '#ef4444' : '#b45309';         // saddle / snout patch
        const eyeCol   = this.isEnraged ? '#facc15' : '#1e293b';         // eye fill

        // Dog leg animation — two diagonal pairs swing opposite phase
        const legSpeed  = this.isEnraged ? 9 : 4.5;
        const legSwing  = Math.sin(this.dogLegTimer * legSpeed) * 10;
        const legSwing2 = -legSwing; // opposite pair

        // ── Ground shadow for dog (slightly ahead of boss shadow) ──
        CTX.save();
        CTX.globalAlpha = 0.22;
        CTX.fillStyle   = 'rgba(0,0,0,0.9)';
        CTX.beginPath();
        CTX.ellipse(8, 60, 44, 11, 0, 0, Math.PI * 2);
        CTX.fill();
        CTX.restore();

        // ── 4 Legs — drawn BEFORE body so body overlaps leg tops ──
        CTX.strokeStyle = darkCol;
        CTX.lineCap     = 'round';

        // Front-left leg  (swings with legSwing)
        CTX.lineWidth = 7;
        CTX.beginPath();
        CTX.moveTo(-10, 38);
        CTX.lineTo(-14, 55 + legSwing);
        CTX.stroke();
        // Paw
        CTX.fillStyle = darkCol;
        CTX.beginPath(); CTX.ellipse(-15, 57 + legSwing, 6, 4, 0.3, 0, Math.PI * 2); CTX.fill();

        // Front-right leg (swings opposite)
        CTX.beginPath();
        CTX.moveTo(20, 38);
        CTX.lineTo(26, 55 + legSwing2);
        CTX.stroke();
        CTX.beginPath(); CTX.ellipse(27, 57 + legSwing2, 6, 4, -0.3, 0, Math.PI * 2); CTX.fill();

        // Back-left leg  (swings opposite)
        CTX.beginPath();
        CTX.moveTo(-22, 34);
        CTX.lineTo(-28, 52 + legSwing2);
        CTX.stroke();
        CTX.beginPath(); CTX.ellipse(-29, 54 + legSwing2, 6, 4, 0.3, 0, Math.PI * 2); CTX.fill();

        // Back-right leg (swings with legSwing)
        CTX.beginPath();
        CTX.moveTo(34, 34);
        CTX.lineTo(40, 52 + legSwing);
        CTX.stroke();
        CTX.beginPath(); CTX.ellipse(41, 54 + legSwing, 6, 4, -0.3, 0, Math.PI * 2); CTX.fill();

        // ── Dog body — main ellipse ──
        CTX.fillStyle   = bodyCol;
        CTX.strokeStyle = darkCol;
        CTX.lineWidth   = 2.5;
        CTX.beginPath();
        CTX.ellipse(6, 32, 44, 20, 0, 0, Math.PI * 2);
        CTX.fill();
        CTX.stroke();

        // Saddle patch (where boss sits)
        CTX.fillStyle = lightCol;
        CTX.beginPath();
        CTX.ellipse(0, 25, 24, 11, 0, 0, Math.PI * 2);
        CTX.fill();

        // ── Dog tail — animated quadratic curve behind body ──
        const tailWag  = Math.sin(this.dogLegTimer * (this.isEnraged ? 12 : 6)) * 18;
        const tailX    = -50; // starts behind the body
        CTX.strokeStyle = darkCol;
        CTX.lineWidth   = 6;
        CTX.lineCap     = 'round';
        CTX.beginPath();
        CTX.moveTo(-40, 24);
        CTX.quadraticCurveTo(tailX - 10, 10, tailX - 5 + tailWag * 0.4, -8 + tailWag);
        CTX.stroke();
        // Fluffy tail tip
        CTX.fillStyle = bodyCol;
        CTX.beginPath();
        CTX.arc(tailX - 5 + tailWag * 0.4, -9 + tailWag, 7, 0, Math.PI * 2);
        CTX.fill();

        // ── Dog head — circle forward of body ──
        CTX.fillStyle   = bodyCol;
        CTX.strokeStyle = darkCol;
        CTX.lineWidth   = 2.5;
        CTX.beginPath();
        CTX.arc(52, 20, 18, 0, Math.PI * 2);
        CTX.fill();
        CTX.stroke();

        // Floppy ear
        CTX.fillStyle   = darkCol;
        CTX.strokeStyle = darkCol;
        CTX.lineWidth   = 1.5;
        CTX.beginPath();
        CTX.ellipse(44, 8, 9, 15, -0.5, 0, Math.PI * 2);
        CTX.fill();

        // Snout
        CTX.fillStyle   = lightCol;
        CTX.strokeStyle = darkCol;
        CTX.lineWidth   = 1.5;
        CTX.beginPath();
        CTX.ellipse(64, 23, 12, 8, 0.2, 0, Math.PI * 2);
        CTX.fill();
        CTX.stroke();

        // Nose
        CTX.fillStyle = '#1e293b';
        CTX.beginPath();
        CTX.arc(71, 20, 3.5, 0, Math.PI * 2);
        CTX.fill();

        // Dog eye (glows yellow when enraged)
        CTX.fillStyle = eyeCol;
        CTX.shadowBlur  = this.isEnraged ? 8 : 0;
        CTX.shadowColor = '#facc15';
        CTX.beginPath();
        CTX.arc(56, 13, 4, 0, Math.PI * 2);
        CTX.fill();
        // Pupil
        CTX.shadowBlur = 0;
        CTX.fillStyle  = '#1e293b';
        CTX.beginPath();
        CTX.arc(57, 13, 2, 0, Math.PI * 2);
        CTX.fill();

        // Mouth / smile / panting tongue
        CTX.strokeStyle = darkCol;
        CTX.lineWidth   = 2;
        CTX.lineCap     = 'round';
        CTX.beginPath();
        CTX.arc(63, 24, 5, 0.1, Math.PI - 0.1);
        CTX.stroke();
        // Tongue (visible when enraged — panting fast)
        if (this.isEnraged || Math.sin(this.dogLegTimer * 3) > 0.2) {
            CTX.fillStyle = '#fb7185';
            CTX.beginPath();
            CTX.ellipse(63, 32, 5, 7, 0, 0, Math.PI * 2);
            CTX.fill();
        }

        // ── Enrage aura on dog body ──
        if (this.isEnraged) {
            const t = performance.now() / 120;
            CTX.save();
            for (let i = 0; i < 5; i++) {
                const ex = Math.sin(t * 0.7 + i * 1.26) * 36;
                const ey = Math.cos(t * 0.9 + i * 1.26) * 16 + 30;
                const er = 3 + Math.sin(t * 1.5 + i) * 1.5;
                CTX.globalAlpha = 0.5 + Math.sin(t + i) * 0.3;
                CTX.fillStyle   = i % 2 === 0 ? '#ef4444' : '#f97316';
                CTX.shadowBlur  = 10;
                CTX.shadowColor = '#ef4444';
                CTX.beginPath();
                CTX.arc(ex, ey, er, 0, Math.PI * 2);
                CTX.fill();
            }
            CTX.restore();
        }
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
            document.getElementById('boss-name').innerHTML =
                `KRU MANOP - LEVEL ${Math.floor(getWave() / BALANCE.waves.bossEveryNWaves)} <span class="ai-badge">AI</span>`;
            spawnFloatingText('BOSS INCOMING!', player.x, player.y - 100, '#ef4444', 35);
            addScreenShake(15);
            Audio.playBossSpecial();
        }, BALANCE.waves.bossSpawnDelay);
    }
}

function spawnEnemies(count) {
    for (let i = 0; i < count; i++) {
        const angle    = Math.random() * Math.PI * 2;
        const distance = BALANCE.waves.spawnDistance;
        let x = player.x + Math.cos(angle) * distance;
        let y = player.y + Math.sin(angle) * distance;
        const safe = mapSystem.findSafeSpawn(x, y, BALANCE.enemy.radius);
        x = safe.x; y = safe.y;
        const r = Math.random();
        if      (r < BALANCE.waves.mageSpawnChance) window.enemies.push(new MageEnemy(x, y));
        else if (r < BALANCE.waves.mageSpawnChance + BALANCE.waves.tankSpawnChance) window.enemies.push(new TankEnemy(x, y));
        else    window.enemies.push(new Enemy(x, y));
    }
}

// ==================== GAME LOOP ====================
function gameLoop(now) {
    const dt = getDeltaTime(now);

    if (gameState === 'PLAYING') {
        updateGame(dt);
        drawGame();
    } else if (gameState === 'PAUSED') {
        drawGame();
        const shopModal = document.getElementById('shop-modal');
        if (shopModal && shopModal.style.display === 'flex') {
            ShopManager.tick();
        }
    }

    requestAnimationFrame(gameLoop);
}

function updateGame(dt) {
    updateCamera(player.x, player.y);
    updateMouseWorld();

    // ── Shop buff timers ──
    if (player.shopDamageBoostActive) {
        player.shopDamageBoostTimer -= dt;
        if (player.shopDamageBoostTimer <= 0) {
            player.shopDamageBoostActive = false;
            if (player._baseDamageBoost !== undefined) {
                player.damageBoost = player._baseDamageBoost;
            } else {
                player.damageBoost = 1.0;
            }
            spawnFloatingText('DMG Boost หมดแล้ว', player.x, player.y - 50, '#94a3b8', 14);
        }
    }

    if (player.shopSpeedBoostActive) {
        player.shopSpeedBoostTimer -= dt;
        if (player.shopSpeedBoostTimer <= 0) {
            player.shopSpeedBoostActive = false;
            if (player._baseMoveSpeed !== undefined) {
                player.moveSpeed = player._baseMoveSpeed;
            }
            spawnFloatingText('SPD Boost หมดแล้ว', player.x, player.y - 50, '#94a3b8', 14);
        }
    }

    // ── Database server: check E key ──
    const dToServer = dist(player.x, player.y, MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
    if (dToServer < MTC_DATABASE_SERVER.INTERACTION_RADIUS && keys.e === 1) {
        keys.e = 0;
        openExternalDatabase();
        return;
    }

    // ── Shop: check B key ──
    const dToShop = dist(player.x, player.y, MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);
    if (dToShop < MTC_SHOP_LOCATION.INTERACTION_RADIUS && keys.b === 1) {
        keys.b = 0;
        openShop();
        return;
    }

    player.update(dt, keys, mouse);

    // ── Weapon system (non-Poom) ──
    if (!(player instanceof PoomPlayer)) {
        weaponSystem.update(dt);
        const burstProjectiles = weaponSystem.updateBurst(player, player.damageBoost);
        if (burstProjectiles && burstProjectiles.length > 0) projectileManager.add(burstProjectiles);
        if (mouse.left === 1 && gameState === 'PLAYING') {
            if (weaponSystem.canShoot()) {
                const projectiles = weaponSystem.shoot(player, player.damageBoost);
                if (projectiles && projectiles.length > 0) projectileManager.add(projectiles);
            }
        }
    }

    // ── Poom input ──
    if (player instanceof PoomPlayer) {
        if (mouse.left === 1 && gameState === 'PLAYING') shootPoom(player);
        if (mouse.right === 1) {
            if (player.cooldowns.eat <= 0 && !player.isEatingRice) player.eatRice();
            mouse.right = 0;
        }
        if (keys.q === 1) {
            if (player.cooldowns.naga <= 0) player.summonNaga();
            keys.q = 0;
        }
        UIManager.updateSkillIcons(player);
    }

    // ── 🤖 Drone update ──
    if (window.drone && player && !player.dead) {
        window.drone.update(dt, player);
    }

    if (boss) boss.update(dt, player);

    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].update(dt, player);
        if (enemies[i].dead) enemies.splice(i, 1);
    }

    if (getWave() % BALANCE.waves.bossEveryNWaves !== 0 && enemies.length === 0 && !boss) {
        if (Achievements.stats.damageTaken === waveStartDamage && getEnemiesKilled() >= BALANCE.waves.minKillsForNoDamage) {
            Achievements.check('no_damage');
        }
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
        if (dist(meteorZones[i].x, meteorZones[i].y, player.x, player.y) < meteorZones[i].radius) {
            player.takeDamage(meteorZones[i].damage * dt);
        }
        if (meteorZones[i].life <= 0) meteorZones.splice(i, 1);
    }

    mapSystem.update([player, ...enemies, boss].filter(e => e && !e.dead));
    particleSystem.update(dt);
    floatingTextSystem.update(dt);
    updateScreenShake();
    Achievements.checkAll();

    // ── Proximity UI ──
    updateDatabaseServerUI();
    updateShopProximityUI();
}

function drawGame() {
    const grad = CTX.createLinearGradient(0, 0, 0, CANVAS.height);
    grad.addColorStop(0, GAME_CONFIG.visual.bgColorTop);
    grad.addColorStop(1, GAME_CONFIG.visual.bgColorBottom);
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
        CTX.beginPath(); CTX.arc(screen.x, screen.y, z.radius, 0, Math.PI * 2); CTX.fill();
    }

    mapSystem.draw();
    drawDatabaseServer();
    drawShopObject();
    powerups.forEach(p => p.draw());
    specialEffects.forEach(e => e.draw());

    if (window.drone) window.drone.draw();

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
    CTX.strokeStyle = GAME_CONFIG.visual.gridColor;
    CTX.lineWidth = 1;
    CTX.beginPath();
    for (let x = ox; x < CANVAS.width; x += sz) { CTX.moveTo(x, 0); CTX.lineTo(x, CANVAS.height); }
    for (let y = oy; y < CANVAS.height; y += sz) { CTX.moveTo(0, y); CTX.lineTo(CANVAS.width, y); }
    CTX.stroke();
}

// ==================== POOM ATTACK SYSTEM ====================
function shootPoom(player) {
    const S = BALANCE.characters.poom;
    if (player.cooldowns.shoot > 0) return;
    const attackSpeedMult  = player.isEatingRice ? 0.7 : 1.0;
    player.cooldowns.shoot = S.riceCooldown * attackSpeedMult;
    const { damage, isCrit } = player.dealDamage(S.riceDamage * player.damageBoost);
    projectileManager.add(new Projectile(player.x, player.y, player.angle, S.riceSpeed, damage, S.riceColor, false, 'player'));
    if (isCrit) {
        spawnFloatingText('สาดข้าว! CRIT!', player.x, player.y - 45, '#fbbf24', 20);
        spawnParticles(player.x, player.y, 5, '#ffffff');
    }
    player.speedBoostTimer = S.speedOnHitDuration;
}

// ==================== INIT & START ====================
async function initAI() {
    const brief = document.getElementById('mission-brief');
    if (!brief) { console.warn('⚠️ mission-brief not found'); return; }
    brief.textContent = "กำลังโหลดภารกิจ...";
    try {
        const name = await Gemini.getMissionName();
        brief.textContent = `ภารกิจ "${name}"`;
    } catch (e) {
        console.warn('Failed to get mission name:', e);
        brief.textContent = 'ภารกิจ "พิชิตครูมานพ"';
    }
}

function startGame(charType = 'kao') {
    console.log('🎮 Starting game... charType:', charType);
    Audio.init();

    const saveData = getSaveData();
    console.log('[MTC Save] Loaded save data:', saveData);

    UIManager.updateHighScoreDisplay(saveData.highScore);

    player = charType === 'poom' ? new PoomPlayer() : new Player(charType);

    enemies = []; powerups = []; specialEffects = []; meteorZones = [];
    boss = null;

    // ── Reset shop buff state on every fresh start ──
    player.shopDamageBoostActive = false;
    player.shopDamageBoostTimer  = 0;
    player._baseDamageBoost      = undefined;
    player.shopSpeedBoostActive  = false;
    player.shopSpeedBoostTimer   = 0;
    player._baseMoveSpeed        = undefined;

    // ── 🤖 Create the Engineering Drone ──
    window.drone = new Drone();
    window.drone.x = player.x;
    window.drone.y = player.y;
    spawnFloatingText('🤖 DRONE ONLINE', player.x, player.y - 90, '#00e5ff', 20);
    console.log('🤖 Engineering Drone initialised');

    UIManager.updateBossHUD(null);
    resetScore();
    setWave(1);
    projectileManager.clear();
    particleSystem.clear();
    floatingTextSystem.clear();
    mapSystem.init();

    weaponSystem.setActiveChar(charType);
    try {
        weaponSystem.updateWeaponUI();
    } catch (err) {
        console.error('[startGame] updateWeaponUI threw — continuing anyway:', err);
    }
    UIManager.setupCharacterHUD(player);

    Achievements.stats.damageTaken    = 0;
    Achievements.stats.shopPurchases  = 0;
    waveStartDamage = 0;

    hideElement('overlay');
    hideElement('report-card');

    UIManager.resetGameOverUI();

    showResumePrompt(false);
    ShopManager.close();

    startNextWave();
    gameState = 'PLAYING';
    resetTime();

    const mobileUI = document.getElementById('mobile-ui');
    if (mobileUI) {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        mobileUI.style.display = isTouchDevice ? 'block' : 'none';
    }
    window.focus();

    console.log('✅ Game started!');
    if (!loopRunning) {
        loopRunning = true;
        requestAnimationFrame(gameLoop);
    }
}

async function endGame(result) {
    gameState = 'GAMEOVER';

    const mobileUI = document.getElementById('mobile-ui');
    if (mobileUI) mobileUI.style.display = 'none';

    showResumePrompt(false);
    ShopManager.close();

    window.drone = null;

    {
        const runScore  = getScore();
        const existing  = getSaveData();
        if (runScore > existing.highScore) {
            updateSaveData({ highScore: runScore });
            console.log(`[MTC Save] 🏆 New high score: ${runScore}`);
            UIManager.updateHighScoreDisplay(runScore);
        } else {
            UIManager.updateHighScoreDisplay(existing.highScore);
        }
    }

    if (result === 'victory') {
        showElement('victory-screen');
        setElementText('final-score', `SCORE ${getScore()}`);
        setElementText('final-wave',  `WAVES CLEARED ${getWave() - 1}`);
    } else {
        const finalScore = getScore();
        const finalWave  = getWave();

        showElement('overlay');
        UIManager.showGameOver(finalScore, finalWave);

        const ld = document.getElementById('ai-loading');
        if (ld) ld.style.display = 'block';
        const reportText = document.getElementById('report-text');
        try {
            const comment = await Gemini.getReportCard(finalScore, finalWave);
            if (ld) ld.style.display = 'none';
            if (reportText) reportText.textContent = comment;
        } catch (e) {
            console.warn('Failed to get AI report card:', e);
            if (ld) ld.style.display = 'none';
            if (reportText) reportText.textContent = 'ตั้งใจเรียนให้มากกว่านี้นะ...';
        }
    }
}

// ==================== INPUT ====================
window.addEventListener('keydown', e => {
    if (gameState === 'PAUSED') {
        const shopModal = document.getElementById('shop-modal');
        const shopOpen  = shopModal && shopModal.style.display === 'flex';

        if (shopOpen && e.code === 'Escape') { closeShop(); return; }
        if (!shopOpen) { resumeGame(); return; }
        return;
    }

    if (gameState !== 'PLAYING') return;

    if (e.code === 'KeyW')   keys.w     = 1;
    if (e.code === 'KeyS')   keys.s     = 1;
    if (e.code === 'KeyA')   keys.a     = 1;
    if (e.code === 'KeyD')   keys.d     = 1;
    if (e.code === 'Space') { keys.space = 1; e.preventDefault(); }
    if (e.code === 'KeyQ')   keys.q     = 1;
    if (e.code === 'KeyE')   keys.e     = 1;
    if (e.code === 'KeyB')   keys.b     = 1;
});

window.addEventListener('keyup', e => {
    if (e.code === 'KeyW')  keys.w     = 0;
    if (e.code === 'KeyS')  keys.s     = 0;
    if (e.code === 'KeyA')  keys.a     = 0;
    if (e.code === 'KeyD')  keys.d     = 0;
    if (e.code === 'Space') keys.space = 0;
    if (e.code === 'KeyE')  keys.e     = 0;
    if (e.code === 'KeyB')  keys.b     = 0;
    if (e.code === 'KeyQ') {
        if (gameState === 'PLAYING') {
            if (player instanceof PoomPlayer) keys.q = 0;
            else { weaponSystem.switchWeapon(); keys.q = 0; }
        } else { keys.q = 0; }
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
    if (e.button === 0) mouse.left  = 1;
    if (e.button === 2) mouse.right = 1;
    e.preventDefault();
});

window.addEventListener('mouseup', e => {
    if (e.button === 0) mouse.left  = 0;
    if (e.button === 2) mouse.right = 0;
});

window.addEventListener('contextmenu', e => e.preventDefault());

// ==================== EXPOSE TO GLOBAL ====================
window.startGame = startGame;
window.endGame   = endGame;

window.onload = () => {
    console.log('🚀 Initializing game...');
    initCanvas();
    initAI();
};

// ==========================================================
// 📱 MOBILE TWIN-STICK CONTROLS
// ==========================================================
window.touchJoystickLeft  = { active: false, id: null, originX: 0, originY: 0, nx: 0, ny: 0 };
window.touchJoystickRight = { active: false, id: null, originX: 0, originY: 0, nx: 0, ny: 0 };

function initMobileControls() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    const maxRadius = 60;
    const zoneL  = document.getElementById('joystick-left-zone');
    const baseL  = document.getElementById('joystick-left-base');
    const stickL = document.getElementById('joystick-left-stick');
    const zoneR  = document.getElementById('joystick-right-zone');
    const baseR  = document.getElementById('joystick-right-base');
    const stickR = document.getElementById('joystick-right-stick');

    function startJoystick(e, joystick, baseElem, stickElem, zoneElem, isRight = false) {
        if (gameState !== 'PLAYING') return;
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (joystick.id === null) {
                joystick.id = touch.identifier; joystick.active = true;
                joystick.originX = touch.clientX; joystick.originY = touch.clientY;
                const zr = zoneElem.getBoundingClientRect();
                baseElem.style.display = 'block';
                baseElem.style.left = (touch.clientX - zr.left) + 'px';
                baseElem.style.top  = (touch.clientY - zr.top)  + 'px';
                stickElem.style.transform = 'translate(-50%, -50%)';
                if (isRight) mouse.left = 1;
                break;
            }
        }
    }

    function moveJoystick(e, joystick, stickElem) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joystick.id) {
                let dx = touch.clientX - joystick.originX;
                let dy = touch.clientY - joystick.originY;
                const d = Math.hypot(dx, dy);
                if (d > maxRadius) { dx = (dx / d) * maxRadius; dy = (dy / d) * maxRadius; }
                joystick.nx = dx / maxRadius; joystick.ny = dy / maxRadius;
                stickElem.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            }
        }
    }

    function endJoystick(e, joystick, baseElem, stickElem, isRight = false) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joystick.id) {
                joystick.active = false; joystick.id = null;
                joystick.nx = 0; joystick.ny = 0;
                baseElem.style.display = 'none';
                stickElem.style.transform = 'translate(-50%, -50%)';
                if (isRight) mouse.left = 0;
            }
        }
    }

    zoneL.addEventListener('touchstart',  (e) => startJoystick(e, window.touchJoystickLeft,  baseL,  stickL, zoneL),        { passive: false });
    zoneL.addEventListener('touchmove',   (e) => moveJoystick(e,  window.touchJoystickLeft,  stickL),                        { passive: false });
    zoneL.addEventListener('touchend',    (e) => endJoystick(e,   window.touchJoystickLeft,  baseL,  stickL),                { passive: false });
    zoneL.addEventListener('touchcancel', (e) => endJoystick(e,   window.touchJoystickLeft,  baseL,  stickL),                { passive: false });

    zoneR.addEventListener('touchstart',  (e) => startJoystick(e, window.touchJoystickRight, baseR,  stickR, zoneR, true),  { passive: false });
    zoneR.addEventListener('touchmove',   (e) => moveJoystick(e,  window.touchJoystickRight, stickR),                        { passive: false });
    zoneR.addEventListener('touchend',    (e) => endJoystick(e,   window.touchJoystickRight, baseR,  stickR, true),          { passive: false });
    zoneR.addEventListener('touchcancel', (e) => endJoystick(e,   window.touchJoystickRight, baseR,  stickR, true),          { passive: false });

    const btnDash     = document.getElementById('btn-dash');
    const btnSkill    = document.getElementById('btn-skill');
    const btnSwitch   = document.getElementById('btn-switch');
    const btnNaga     = document.getElementById('btn-naga');
    const btnDatabase = document.getElementById('btn-database');
    const btnShop     = document.getElementById('btn-shop');

    if (btnDash) {
        btnDash.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); keys.space = 1; }, { passive: false });
        btnDash.addEventListener('touchend',   (e) => { e.preventDefault(); e.stopPropagation(); keys.space = 0; }, { passive: false });
    }
    if (btnSkill) {
        btnSkill.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); mouse.right = 1; }, { passive: false });
        btnSkill.addEventListener('touchend',   (e) => { e.preventDefault(); e.stopPropagation(); mouse.right = 0; }, { passive: false });
    }
    if (btnSwitch) {
        btnSwitch.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING' && weaponSystem) weaponSystem.switchWeapon();
        }, { passive: false });
    }
    if (btnNaga) {
        btnNaga.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING' && player instanceof PoomPlayer) {
                if (player.cooldowns.naga <= 0) player.summonNaga();
            }
        }, { passive: false });
    }

    if (btnDatabase) {
        btnDatabase.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING') openExternalDatabase();
            else if (gameState === 'PAUSED') resumeGame();
        }, { passive: false });
    }

    if (btnShop) {
        btnShop.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING') openShop();
            else if (gameState === 'PAUSED') {
                const shopModal = document.getElementById('shop-modal');
                if (shopModal && shopModal.style.display === 'flex') closeShop();
            }
        }, { passive: false });
    }

    document.addEventListener('touchmove', function(e) {
        if (!e.target.closest('.joystick-zone') && !e.target.closest('.action-btn')) {
            e.preventDefault();
        }
    }, { passive: false });
}

window.addEventListener('DOMContentLoaded', initMobileControls);