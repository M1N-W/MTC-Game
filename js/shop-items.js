'use strict';
/**
 * js/shop-items.js
 * Extracted shop catalog constants from the former config bundle.
 */

// 🛒 SHOP ITEMS
const SHOP_ITEMS = [
    {
        id: 'potion', name: 'Energy Drink', icon: '🧃',
        cost: 300, type: 'instant', heal: 60,
        desc: 'ฟื้นฟูเลือด 60 หน่วย', color: '#22c55e'
    },
    {
        id: 'shield', name: 'Energy Shield', icon: '🛡️',
        cost: 600, type: 'instant',
        desc: 'บล็อกการโจมตีครั้งต่อไปหนึ่งครั้ง', color: '#8b5cf6'
    },
    {
        id: 'maxHp', name: 'Vital Supplement', icon: '❤️',
        cost: 500, type: 'permanent', hpBonus: 15,
        desc: 'เพิ่มเลือดสูงสุด 15 หน่วย', color: '#f87171'
    },
    {
        id: 'dmgUp', name: 'Weapon Tuner', icon: '🔧',
        cost: 800, type: 'permanent', dmgPct: 0.05,
        desc: 'เพิ่มดาเมจ 5%', color: '#f59e0b'
    },
    {
        id: 'speedUp', name: 'Lightweight Boots', icon: '👟',
        cost: 500, type: 'permanent', speedPct: 0.05,
        desc: 'เพิ่มความเร็ว 5%', color: '#06b6d4'
    },
    {
        id: 'cdr', name: 'Focus Crystal', icon: '🔮',
        cost: 700, type: 'permanent', cdrPct: 0.05,
        desc: 'ลดคูลดาวน์สกิล 5%', color: '#a78bfa'
    },
    // ── Defensive ──────────────────────────────────────────────
    {
        id: 'reflectArmor', name: 'Reflect Armor', icon: '🪞',
        cost: 900, type: 'permanent', reflectPct: 0.15,
        desc: 'สะท้อน 15% ดาเมจกลับหาศัตรู', color: '#818cf8'
    },
    {
        id: 'shieldBubble', name: 'Shield Bubble', icon: '🫧',
        cost: 500, type: 'instant', bubbleHits: 3,
        desc: 'บล็อกการโจมตี 3 ครั้ง', color: '#7dd3fc'
    },
    // ── Utility ────────────────────────────────────────────────
    {
        id: 'speedWave', name: 'Adrenaline Wave', icon: '⚡',
        cost: 400, type: 'instant', speedMult: 1.30, duration: 8,
        desc: 'เพิ่มความเร็ว +30% เป็นเวลา 8 วินาที', color: '#fbbf24'
    },
    {
        id: 'cdrRound', name: 'Cooldown Round', icon: '🔄',
        cost: 600, type: 'instant',
        desc: 'รีเซ็ตคูลดาวน์สกิลทั้งหมดทันที', color: '#34d399'
    },
    // ── Character-specific ─────────────────────────────────────
    {
        id: 'kaoAmmo', name: 'ผีซุ่ม', icon: '👻',
        cost: 750, type: 'permanent', charReq: 'kao',
        desc: '[KAO] Teleport charges +1 (สูงสุด 4)', color: '#facc15'
    },
    {
        id: 'poomRice', name: 'เทพเจ้าอีสาน', icon: '🍚',
        cost: 650, type: 'permanent', charReq: 'poom',
        desc: '[POOM] ลด CD ของ Naga/Garuda/Ritual 15%', color: '#4ade80'
    },
    {
        id: 'autoCore', name: 'วันชัยระเบิด', icon: '🔥',
        cost: 850, type: 'permanent', charReq: 'auto',
        desc: '[AUTO] ถึง HOT tier ง่ายขึ้น 15%', color: '#fb923c'
    }
]
window.SHOP_ITEMS = SHOP_ITEMS;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SHOP_ITEMS };
}
