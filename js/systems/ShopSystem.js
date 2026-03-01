'use strict';

// ══════════════════════════════════════════════════════════════
// 🛒 SHOP SYSTEM (extracted from game.js)
// ══════════════════════════════════════════════════════════════

// ─── MTC Shop Location ────────────────────────────────────────
const MTC_SHOP_LOCATION = {
    x: -350,
    y: 350,
    INTERACTION_RADIUS: 90
};

window.MTC_SHOP_LOCATION = MTC_SHOP_LOCATION;

// ══════════════════════════════════════════════════════════════
// 🛒 SHOP — DRAW, PROXIMITY, OPEN, CLOSE, BUY
// ══════════════════════════════════════════════════════════════

function drawShopObject() {
    const screen = worldToScreen(MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);
    const t = performance.now() / 700;
    const glow = Math.abs(Math.sin(t)) * 0.5 + 0.5;
    const bounce = Math.sin(performance.now() / 500) * 3;

    if (window.player) {
        const d = dist(window.player.x, window.player.y, MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);
        if (d < MTC_SHOP_LOCATION.INTERACTION_RADIUS * 2) {
            const alpha = Math.max(0, 1 - d / (MTC_SHOP_LOCATION.INTERACTION_RADIUS * 2));
            CTX.save();
            CTX.globalAlpha = alpha * 0.3 * glow;
            CTX.strokeStyle = '#facc15';
            CTX.lineWidth = 2;
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
    CTX.shadowBlur = 18 * glow;
    CTX.shadowColor = '#facc15';

    CTX.fillStyle = '#78350f';
    CTX.strokeStyle = '#facc15';
    CTX.lineWidth = 2;
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
    CTX.lineWidth = 3;
    CTX.beginPath(); CTX.moveTo(-18, -6); CTX.lineTo(-18, -34); CTX.stroke();
    CTX.beginPath(); CTX.moveTo(18, -6); CTX.lineTo(18, -34); CTX.stroke();

    CTX.fillStyle = `rgba(250,204,21,${0.85 + glow * 0.15})`;
    CTX.beginPath();
    CTX.moveTo(-26, -34);
    CTX.lineTo(26, -34);
    CTX.lineTo(22, -24);
    CTX.lineTo(-22, -24);
    CTX.closePath();
    CTX.fill();
    CTX.strokeStyle = '#b45309';
    CTX.lineWidth = 1.5;
    CTX.stroke();

    CTX.fillStyle = '#f59e0b';
    for (let i = 0; i < 5; i++) {
        CTX.beginPath();
        CTX.arc(-20 + i * 10, -24, 5, 0, Math.PI);
        CTX.fill();
    }

    CTX.font = '16px Arial';
    CTX.textAlign = 'center';
    CTX.textBaseline = 'middle';
    CTX.shadowBlur = 0;
    CTX.fillText('🛒', 0, 10);

    const coinBounce = Math.sin(performance.now() / 350) * 4;
    CTX.font = '14px Arial';
    CTX.fillText('🪙', 0, -46 + coinBounce);

    CTX.shadowBlur = 0;
    CTX.fillStyle = '#fbbf24';
    CTX.font = 'bold 7px Arial';
    CTX.textAlign = 'center';
    CTX.textBaseline = 'middle';
    CTX.fillText('MTC CO-OP STORE', 0, 38);

    CTX.restore();
}

function updateShopProximityUI() {
    if (!window.player) return;
    const d = dist(window.player.x, window.player.y, MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);
    const near = d < MTC_SHOP_LOCATION.INTERACTION_RADIUS;

    const promptEl = document.getElementById('shop-prompt');
    const hudIcon = document.getElementById('shop-hud-icon');
    const btnShop = document.getElementById('btn-shop');

    if (promptEl) promptEl.style.display = near ? 'block' : 'none';
    if (hudIcon) hudIcon.style.display = near ? 'flex' : 'none';
    if (btnShop) btnShop.style.display = near ? 'flex' : 'none';
}

function openShop() {
    if (window.gameState !== 'PLAYING') return;
    setGameState('PAUSED');

    const promptEl = document.getElementById('shop-prompt');
    if (promptEl) promptEl.style.display = 'none';

    ShopManager.open();

    if (window.player) spawnFloatingText(GAME_TEXTS.shop.open, window.player.x, window.player.y - 70, '#facc15', 22);
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

    if (window.player) spawnFloatingText(GAME_TEXTS.shop.resumed, window.player.x, window.player.y - 50, '#34d399', 18);
}

// ══════════════════════════════════════════════════════════════
// 🎲 ROGUELITE SHOP — Roll / Reroll / Buy
// ══════════════════════════════════════════════════════════════

window.currentShopOffers = [];

const SHOP_SLOT_COUNT = 3;
const REROLL_COST = 200;

function rollShopItems() {
    const pool = [...SHOP_ITEMS];
    window.currentShopOffers = [];
    for (let i = 0; i < SHOP_SLOT_COUNT && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        window.currentShopOffers.push({ item: pool[idx], soldOut: false });
        // swap-and-pop — O(1), no GC churn
        pool[idx] = pool[pool.length - 1];
        pool.pop();
    }
}

function rerollShop() {
    if (!window.player) return;
    const score = typeof getScore === 'function' ? getScore() : 0;
    if (score < REROLL_COST) {
        spawnFloatingText('คะแนนไม่พอ Reroll!', window.player.x, window.player.y - 60, '#ef4444', 18);
        return;
    }
    addScore(-REROLL_COST);
    rollShopItems();
    ShopManager.renderItems();
    if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
}

function buyItem(slotIndex) {
    const offer = window.currentShopOffers[slotIndex];
    if (!offer || offer.soldOut) return;
    if (!window.player) return;

    const item = offer.item;
    const currentScore = typeof getScore === 'function' ? getScore() : 0;
    if (currentScore < item.cost) {
        spawnFloatingText(GAME_TEXTS.shop.notEnoughScore, window.player.x, window.player.y - 60, '#ef4444', 18);
        if (typeof Audio !== 'undefined' && Audio.playHit) Audio.playHit();
        return;
    }

    addScore(-item.cost);
    offer.soldOut = true;

    const p = window.player;

    if (item.id === 'potion') {
        const lacking = p.maxHp - p.hp;
        const healAmt = Math.min(item.heal, lacking);
        if (healAmt > 0) {
            p.hp += healAmt;
            spawnFloatingText(GAME_TEXTS.shop.healPickup(healAmt), p.x, p.y - 70, '#22c55e', 22);
            spawnParticles(p.x, p.y, 10, '#22c55e');
            if (typeof Audio !== 'undefined' && Audio.playHeal) Audio.playHeal();
        } else {
            spawnFloatingText(GAME_TEXTS.shop.hpFull, p.x, p.y - 60, '#94a3b8', 16);
        }

    } else if (item.id === 'shield') {
        if (p.hasShield) {
            addScore(item.cost); // refund
            offer.soldOut = false;
            spawnFloatingText('มีโล่อยู่แล้ว!', p.x, p.y - 60, '#94a3b8', 16);
            ShopManager.renderItems();
            return;
        }
        p.hasShield = true;
        spawnFloatingText('🛡️ SHIELD ACTIVE!', p.x, p.y - 70, '#8b5cf6', 22);
        spawnParticles(p.x, p.y, 15, '#8b5cf6');
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();

    } else if (item.id === 'maxHp') {
        p.maxHp += item.hpBonus;
        p.hp += item.hpBonus;
        spawnFloatingText(`❤️ Max HP +${item.hpBonus}!`, p.x, p.y - 70, '#f87171', 22);
        spawnParticles(p.x, p.y, 10, '#f87171');
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();

    } else if (item.id === 'dmgUp') {
        p._baseDamageBoost = p._baseDamageBoost || p.damageBoost || 1.0;
        p.damageBoost = (p.damageBoost || 1.0) * (1 + item.dmgPct);
        spawnFloatingText(`⚔️ DMG +${Math.round(item.dmgPct * 100)}%!`, p.x, p.y - 70, '#f59e0b', 22);
        spawnParticles(p.x, p.y, 8, '#f59e0b');
        if (p.damageBoost >= (p._baseDamageBoost * 1.5)) Achievements.check('shop_max');
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();

    } else if (item.id === 'speedUp') {
        p._baseMoveSpeed = p._baseMoveSpeed || p.moveSpeed;
        p.moveSpeed *= (1 + item.speedPct);
        spawnFloatingText(`💨 Speed +${Math.round(item.speedPct * 100)}%!`, p.x, p.y - 70, '#06b6d4', 22);
        spawnParticles(p.x, p.y, 8, '#06b6d4');
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();

    } else if (item.id === 'cdr') {
        // Compound each purchase: floor at 10% of base (never zero)
        p.skillCooldownMult = Math.max(0.1, (p.skillCooldownMult || 1.0) * (1 - item.cdrPct));
        spawnFloatingText(`🔮 CDR -${Math.round(item.cdrPct * 100)}%!`, p.x, p.y - 70, '#a78bfa', 22);
        spawnParticles(p.x, p.y, 8, '#a78bfa');
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
    }

    Achievements.stats.shopPurchases = (Achievements.stats.shopPurchases || 0) + 1;
    Achievements.check('shopaholic');

    ShopManager.renderItems();
}

// Initial roll so offers are ready before first shop open
rollShopItems();

window.drawShopObject = drawShopObject;
window.updateShopProximityUI = updateShopProximityUI;
window.openShop = openShop;
window.closeShop = closeShop;
window.buyItem = buyItem;
window.rollShopItems = rollShopItems;
window.rerollShop = rerollShop;