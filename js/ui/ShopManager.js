"use strict";
// ══════════════════════════════════════════════════════════════════
//  js/ui/ShopManager.js  —  extracted from ui.js in v3.44.4
//  Phase 3 of HIGH #2 (see Markdown Source/Successed-Plan/HIGH2-…).
//
//  ShopManager is a self-contained modal controller. It reads
//  `window.currentShopOffers` (populated by ShopSystem.js) and writes
//  markup into #shop-modal + #shop-items. Extraction is a PURE move:
//    * exposed as `window.ShopManager` (unchanged global)
//    * no API changes, no behaviour changes
//    * ShopSystem.js continues to call ShopManager.renderItems() etc.
//
//  Dependencies (read-only globals):
//    window.currentShopOffers  — populated by ShopSystem each wave
//    window.getScore           — score.js
//    window.player             — game.js (for speedWave badge)
// ══════════════════════════════════════════════════════════════════

class ShopManager {

    static open() {
        ShopManager.renderItems();
        const modal = document.getElementById('shop-modal');
        if (modal) {
            modal.style.display = 'flex';
            requestAnimationFrame(() => {
                const inner = modal.querySelector('.shop-inner');
                if (inner) inner.classList.add('shop-visible');
            });
        }
    }

    static close() {
        const modal = document.getElementById('shop-modal');
        if (!modal) return;
        const inner = modal.querySelector('.shop-inner');
        if (inner) inner.classList.remove('shop-visible');
        setTimeout(() => { modal.style.display = 'none'; }, 260);
    }

    static renderItems() {
        const container = document.getElementById('shop-items');
        if (!container) return;
        container.innerHTML = '';

        const offers = window.currentShopOffers || [];
        const currentScore = typeof getScore === 'function' ? getScore() : 0;

        const scoreDisplay = document.getElementById('shop-score-display');
        if (scoreDisplay) scoreDisplay.textContent = currentScore.toLocaleString();

        offers.forEach((offer, idx) => {
            const { item, soldOut } = offer;
            const canAfford = !soldOut && currentScore >= item.cost;
            const typeLabel = item.type === 'permanent'
                ? `<span class="shop-duration" style="color:#a78bfa;">♾ ถาวร</span>`
                : `<span class="shop-duration" style="color:#22c55e;">⚡ ทันที</span>`;

            // Char-specific badge
            const charLabels = {
                kao:  { label: 'KAO',  color: '#facc15' },
                poom: { label: 'POOM', color: '#4ade80' },
                auto: { label: 'AUTO', color: '#fb923c' },
                pat:  { label: 'PAT',  color: '#7ec8e3' },
            };
            const charBadge = item.charReq
                ? `<span class="shop-card-char-badge" style="background:${charLabels[item.charReq]?.color ?? '#94a3b8'}22; border-color:${charLabels[item.charReq]?.color ?? '#94a3b8'}; color:${charLabels[item.charReq]?.color ?? '#94a3b8'};">${charLabels[item.charReq]?.label ?? item.charReq.toUpperCase()} ONLY</span>`
                : '';

            const card = document.createElement('div');
            card.className = `shop-card${soldOut ? ' shop-card-disabled' : ''}`;
            card.id = `shop-card-slot-${idx}`;
            card.setAttribute('data-item-id', item.id);
            if (item.charReq) card.style.setProperty('--shop-char-color', charLabels[item.charReq]?.color ?? '#94a3b8');

            // Active buff badge for items with timers
            // BUG 2/3 FIX: read shopSpeedBoostTimer — the property game.js actually ticks
            const activeBadge = (item.id === 'speedWave' && window.player?.shopSpeedBoostActive && window.player?.shopSpeedBoostTimer > 0)
                ? `<span class="shop-card-active-badge">⚡ ${Math.ceil(window.player.shopSpeedBoostTimer)}s</span>`
                : '';

            card.innerHTML = `
                ${charBadge}
                ${activeBadge}
                <div class="shop-card-icon" style="color:${item.color};${soldOut ? 'filter:grayscale(1) opacity(.35);' : ''}">${item.icon}</div>
                <div class="shop-card-name">${item.name}</div>
                <div class="shop-card-desc">${soldOut ? '<span style="color:#64748b;">— SOLD OUT —</span>' : item.desc}</div>
                ${typeLabel}
                <div class="shop-card-cost">
                    <span class="shop-cost-icon">🏆</span>
                    <span class="shop-cost-value">${item.cost.toLocaleString()}</span>
                </div>
                <button
                    class="shop-buy-btn"
                    onclick="buyItem(${idx})"
                    style="border-color:${item.color}; --shop-btn-color:${item.color};"
                    ${soldOut || !canAfford ? 'disabled' : ''}
                >${soldOut ? 'SOLD OUT' : 'BUY'}</button>
            `;
            container.appendChild(card);
        });
    }

    // Kept for backward-compat call-sites (tick, etc.)
    static updateButtons() { ShopManager.renderItems(); }

    // BUG 3 FIX: tick() updates countdown badge in-place — no full DOM re-render,
    // and works correctly while game is PAUSED (shop open state).
    static tick() {
        const p = window.player;
        if (!p) return;
        const badge = document.querySelector('[data-item-id="speedWave"] .shop-card-active-badge');
        if (badge) {
            if (p.shopSpeedBoostActive && p.shopSpeedBoostTimer > 0) {
                badge.textContent = `⚡ ${Math.ceil(p.shopSpeedBoostTimer)}s`;
            } else {
                badge.textContent = '';
            }
        }
    }
}

if (typeof window !== 'undefined') window.ShopManager = ShopManager;
