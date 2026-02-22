'use strict';

// ══════════════════════════════════════════════════════════════
// 🛒 SHOP SYSTEM (extracted from game.js)
// ══════════════════════════════════════════════════════════════

// ─── MTC Shop Location ────────────────────────────────────────
const MTC_SHOP_LOCATION = {
    x: -350,
    y:  350,
    INTERACTION_RADIUS: 90
};

window.MTC_SHOP_LOCATION = MTC_SHOP_LOCATION;

// ══════════════════════════════════════════════════════════════
// 🛒 SHOP — DRAW, PROXIMITY, OPEN, CLOSE, BUY
// ══════════════════════════════════════════════════════════════

function drawShopObject() {
    const screen  = worldToScreen(MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);
    const t       = performance.now() / 700;
    const glow    = Math.abs(Math.sin(t)) * 0.5 + 0.5;
    const bounce  = Math.sin(performance.now() / 500) * 3;

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
    CTX.lineWidth   = 1.5;
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

    CTX.font         = '16px Arial';
    CTX.textAlign    = 'center';
    CTX.textBaseline = 'middle';
    CTX.shadowBlur   = 0;
    CTX.fillText('🛒', 0, 10);

    const coinBounce = Math.sin(performance.now() / 350) * 4;
    CTX.font = '14px Arial';
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
    if (window.gameState !== 'PLAYING') return;
    setGameState('PAUSED');

    const promptEl = document.getElementById('shop-prompt');
    if (promptEl) promptEl.style.display = 'none';

    ShopManager.open();

    if (player) spawnFloatingText(GAME_TEXTS.shop.open, player.x, player.y - 70, '#facc15', 22);
    if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
}

function closeShop() {
    if (window.gameState !== 'PAUSED') return;
    setGameState('PLAYING');

    ShopManager.close();
    showResumePrompt(false);

    keys.w = 0; keys.a = 0; keys.s = 0; keys.d = 0;
    keys.space = 0; keys.q = 0; keys.e = 0; keys.b = 0; keys.f = 0;

    window.focus();

    if (player) spawnFloatingText(GAME_TEXTS.shop.resumed, player.x, player.y - 50, '#34d399', 18);
}

function buyItem(itemId) {
    const item = SHOP_ITEMS[itemId];
    if (!item) { console.warn('buyItem: unknown itemId', itemId); return; }
    if (!player) return;

    const currentScore = getScore();
    if (currentScore < item.cost) {
        spawnFloatingText(GAME_TEXTS.shop.notEnoughScore, player.x, player.y - 60, '#ef4444', 18);
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
            spawnFloatingText(GAME_TEXTS.shop.healPickup(healAmt), player.x, player.y - 70, '#22c55e', 22);
            spawnParticles(player.x, player.y, 10, '#22c55e');
            if (typeof Audio !== 'undefined' && Audio.playHeal) Audio.playHeal();
        } else {
            spawnFloatingText(GAME_TEXTS.shop.hpFull, player.x, player.y - 60, '#94a3b8', 16);
        }

    } else if (itemId === 'damageUp') {
        // ── Progressive Damage Buff — stacks up to +50 % then penalises ──
        // Tier ladder:  base → ×1.1 → ×1.2 → ×1.3 → ×1.4 → ×1.5 (cap)
        // Buying at cap: subtracts 5 s from the remaining timer (min 5 s).
        if (!player.shopDamageBoostActive) {
            // ── First purchase — initialise buff at 1.1× ──────────────
            player._baseDamageBoost      = player.damageBoost || 1.0;
            player.damageBoost           = player._baseDamageBoost * 1.1;
            player.shopDamageBoostActive = true;
            player.shopDamageBoostTimer  = item.duration;
            const tierPct = Math.round((player.damageBoost / player._baseDamageBoost) * 100);
            spawnFloatingText(`⚔️ Damage ${tierPct}%!`, player.x, player.y - 70, '#f59e0b', 22);
            spawnParticles(player.x, player.y, 8, '#f59e0b');
        } else {
            const cap = player._baseDamageBoost * 1.5;
            // Round to 2 dp to avoid floating-point drift at the cap check
            const current = Math.round(player.damageBoost * 100) / 100;
            const capRnd  = Math.round(cap * 100) / 100;

            if (current < capRnd) {
                // ── Under cap — add one tier (+0.1× of base) and reset timer ──
                player.damageBoost += player._baseDamageBoost * 0.1;
                player.damageBoost  = Math.min(player.damageBoost, cap); // clamp
                player.shopDamageBoostTimer = item.duration;
                const tierPct = Math.round((player.damageBoost / player._baseDamageBoost) * 100);
                spawnFloatingText(`⚔️ Damage ${tierPct}%!`, player.x, player.y - 70, '#f59e0b', 22);
                spawnParticles(player.x, player.y, 8, '#f59e0b');
            } else {
                // ── At cap — impose a 5 s duration penalty ────────────────
                player.shopDamageBoostTimer = Math.max(5, player.shopDamageBoostTimer - 5);
                spawnFloatingText('⚠️ MAX STACKS! Duration Penalty!', player.x, player.y - 70, '#ef4444', 20);
            }
        }
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();

    } else if (itemId === 'speedUp') {
        // ── Progressive Speed Buff — stacks up to +50 % then penalises ──
        // Tier ladder:  base → ×1.1 → ×1.2 → ×1.3 → ×1.4 → ×1.5 (cap)
        // Buying at cap: subtracts 5 s from the remaining timer (min 5 s).
        if (!player.shopSpeedBoostActive) {
            // ── First purchase — initialise buff at 1.1× ──────────────
            player._baseMoveSpeed        = player.moveSpeed;
            player.moveSpeed             = player._baseMoveSpeed * 1.1;
            player.shopSpeedBoostActive  = true;
            player.shopSpeedBoostTimer   = item.duration;
            const tierPct = Math.round((player.moveSpeed / player._baseMoveSpeed) * 100);
            spawnFloatingText(`💨 Speed ${tierPct}%!`, player.x, player.y - 70, '#06b6d4', 22);
            spawnParticles(player.x, player.y, 8, '#06b6d4');
        } else {
            const cap = player._baseMoveSpeed * 1.5;
            // Round to 2 dp to avoid floating-point drift at the cap check
            const current = Math.round(player.moveSpeed * 100) / 100;
            const capRnd  = Math.round(cap * 100) / 100;

            if (current < capRnd) {
                // ── Under cap — add one tier (+0.1× of base) and reset timer ──
                player.moveSpeed += player._baseMoveSpeed * 0.1;
                player.moveSpeed  = Math.min(player.moveSpeed, cap); // clamp
                player.shopSpeedBoostTimer = item.duration;
                const tierPct = Math.round((player.moveSpeed / player._baseMoveSpeed) * 100);
                spawnFloatingText(`💨 Speed ${tierPct}%!`, player.x, player.y - 70, '#06b6d4', 22);
                spawnParticles(player.x, player.y, 8, '#06b6d4');
            } else {
                // ── At cap — impose a 5 s duration penalty ────────────────
                player.shopSpeedBoostTimer = Math.max(5, player.shopSpeedBoostTimer - 5);
                spawnFloatingText('⚠️ MAX STACKS! Duration Penalty!', player.x, player.y - 70, '#ef4444', 20);
            }
        }
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
    }

    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.textContent = getScore().toLocaleString();

    Achievements.stats.shopPurchases = (Achievements.stats.shopPurchases || 0) + 1;
    Achievements.check('shopaholic');

    ShopManager.updateButtons();
}

window.drawShopObject       = drawShopObject;
window.updateShopProximityUI = updateShopProximityUI;
window.openShop  = openShop;
window.closeShop = closeShop;
window.buyItem   = buyItem;