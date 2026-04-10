'use strict';
/**
 * js/shop-items.js
 * Extracted shop catalog constants from the former config bundle.
 */

// โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
// ๐’ SHOP ITEMS
// โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
const SHOP_ITEMS = [
    {
        id: 'potion', name: 'Energy Drink', icon: '๐ง',
        cost: 300, type: 'instant', heal: 60,
        desc: 'เธเธทเนเธเธเธนเน€เธฅเธทเธญเธ” 60 เธซเธเนเธงเธข', color: '#22c55e'
    },
    {
        id: 'shield', name: 'Energy Shield', icon: '๐ก๏ธ',
        cost: 600, type: 'instant',
        desc: 'เธเธฅเนเธญเธเธเธฒเธฃเนเธเธกเธ•เธตเธเธฃเธฑเนเธเธ•เนเธญเนเธเธซเธเธถเนเธเธเธฃเธฑเนเธ', color: '#8b5cf6'
    },
    {
        id: 'maxHp', name: 'Vital Supplement', icon: 'โค๏ธ',
        cost: 500, type: 'permanent', hpBonus: 15,
        desc: 'เน€เธเธดเนเธกเน€เธฅเธทเธญเธ”เธชเธนเธเธชเธธเธ” 15 เธซเธเนเธงเธข', color: '#f87171'
    },
    {
        id: 'dmgUp', name: 'Weapon Tuner', icon: '๐”ง',
        cost: 800, type: 'permanent', dmgPct: 0.05,
        desc: 'เน€เธเธดเนเธกเธ”เธฒเน€เธกเธ 5%', color: '#f59e0b'
    },
    {
        id: 'speedUp', name: 'Lightweight Boots', icon: '๐‘',
        cost: 500, type: 'permanent', speedPct: 0.05,
        desc: 'เน€เธเธดเนเธกเธเธงเธฒเธกเน€เธฃเนเธง 5%', color: '#06b6d4'
    },
    {
        id: 'cdr', name: 'Focus Crystal', icon: '๐”ฎ',
        cost: 700, type: 'permanent', cdrPct: 0.05,
        desc: 'เธฅเธ”เธเธนเธฅเธ”เธฒเธงเธเนเธชเธเธดเธฅ 5%', color: '#a78bfa'
    },
    // โ”€โ”€ Defensive โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    {
        id: 'reflectArmor', name: 'Reflect Armor', icon: '๐ช',
        cost: 900, type: 'permanent', reflectPct: 0.15,
        desc: 'เธชเธฐเธ—เนเธญเธ 15% เธ”เธฒเน€เธกเธเธเธฅเธฑเธเธซเธฒเธจเธฑเธ•เธฃเธน', color: '#818cf8'
    },
    {
        id: 'shieldBubble', name: 'Shield Bubble', icon: '๐ซง',
        cost: 500, type: 'instant', bubbleHits: 3,
        desc: 'เธเธฅเนเธญเธเธเธฒเธฃเนเธเธกเธ•เธต 3 เธเธฃเธฑเนเธ', color: '#7dd3fc'
    },
    // โ”€โ”€ Utility โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    {
        id: 'speedWave', name: 'Adrenaline Wave', icon: 'โก',
        cost: 400, type: 'instant', speedMult: 1.30, duration: 8,
        desc: 'เน€เธเธดเนเธกเธเธงเธฒเธกเน€เธฃเนเธง +30% เน€เธเนเธเน€เธงเธฅเธฒ 8 เธงเธดเธเธฒเธ—เธต', color: '#fbbf24'
    },
    {
        id: 'cdrRound', name: 'Cooldown Round', icon: '๐”',
        cost: 600, type: 'instant',
        desc: 'เธฃเธตเน€เธเนเธ•เธเธนเธฅเธ”เธฒเธงเธเนเธชเธเธดเธฅเธ—เธฑเนเธเธซเธกเธ”เธ—เธฑเธเธ—เธต', color: '#34d399'
    },
    // โ”€โ”€ Character-specific โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    {
        id: 'kaoAmmo', name: 'เธเธตเธเธธเนเธก', icon: '๐‘ป',
        cost: 750, type: 'permanent', charReq: 'kao',
        desc: '[KAO] Teleport charges +1 (เธชเธนเธเธชเธธเธ” 4)', color: '#facc15'
    },
    {
        id: 'poomRice', name: 'เน€เธ—เธเน€เธเนเธฒเธญเธตเธชเธฒเธ', icon: '๐',
        cost: 650, type: 'permanent', charReq: 'poom',
        desc: '[POOM] เธฅเธ” CD เธเธญเธ Naga/Garuda/Ritual 15%', color: '#4ade80'
    },
    {
        id: 'autoCore', name: 'เธงเธฑเธเธเธฑเธขเธฃเธฐเน€เธเธดเธ”', icon: '๐”ฅ',
        cost: 850, type: 'permanent', charReq: 'auto',
        desc: '[AUTO] เธ–เธถเธ HOT tier เธเนเธฒเธขเธเธถเนเธ 15%', color: '#fb923c'
    }
];


window.SHOP_ITEMS = SHOP_ITEMS;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SHOP_ITEMS };
}
