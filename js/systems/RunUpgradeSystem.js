'use strict';

/**
 * js/systems/RunUpgradeSystem.js
 *
 * Run-scoped MTC system patches. DOM updates happen only on offer/apply.
 */
(function () {
    const MAX_CHOICES = 3;
    const STYLE_ID = 'run-upgrade-styles';
    const UPGRADE_IDS = Object.freeze([
        'kinetic_boost',
        'core_expansion',
        'energy_capacitor',
        'hijack_efficiency',
        'cooldown_patch',
        'damage_patch',
        'repair_nanogel',
    ]);
    const BOSS_POOL = Object.freeze([
        'boss_data_overload',
        'void_stabilizer',
        'overclock_matrix',
        'boss_core_fortify',
    ]);

    const UPGRADES = Object.freeze({
        kinetic_boost: Object.freeze({
            title: 'KINETIC_BOOST',
            body: 'Move system throughput +10%',
            descTh: 'เพิ่มความเร็วในการเคลื่อนที่ของระบบ +10%',
            category: 'MOBILITY MODULE',
            statBadge: 'MOVE SPD +10%',
            icon: '⚡',
            accent: '#22d3ee',
            glow: 'rgba(34, 211, 238, 0.32)',
            type: 'speed',
            value: 0.10,
        }),
        core_expansion: Object.freeze({
            title: 'CORE_EXPANSION',
            body: 'Max HP +18 and repair +18',
            descTh: 'เพิ่มพลังชีวิตสูงสุด +18 และฟื้นฟูทันที +18',
            category: 'CORE VITALITY',
            statBadge: 'MAX HP +18 & HEAL',
            icon: '❤️',
            accent: '#fb7185',
            glow: 'rgba(251, 113, 133, 0.32)',
            type: 'hp',
            value: 18,
        }),
        energy_capacitor: Object.freeze({
            title: 'ENERGY_CAPACITOR',
            body: 'Time Energy capacity +20',
            descTh: 'เพิ่มความจุพลังงานหยุดเวลา (Time Energy) +20',
            category: 'CHRONO CAPACITOR',
            statBadge: 'TIME ENERGY +20',
            icon: '🔋',
            accent: '#38bdf8',
            glow: 'rgba(56, 189, 248, 0.34)',
            type: 'time_energy',
            value: 20,
        }),
        hijack_efficiency: Object.freeze({
            title: 'HIJACK_EFFICIENCY',
            body: 'Data Hijack energy cost -8',
            descTh: 'ลดพลังงานที่ใช้ในการกด Data Hijack ลง 8 หน่วย',
            category: 'HIJACK PROTOCOL',
            statBadge: 'HIJACK COST -8',
            icon: '🧬',
            accent: '#4ade80',
            glow: 'rgba(74, 222, 128, 0.32)',
            type: 'hijack_cost',
            value: 8,
        }),
        cooldown_patch: Object.freeze({
            title: 'COOLDOWN_PATCH',
            body: 'Skill cooldown multiplier -8%',
            descTh: 'ลดคูลดาวน์ของสกิลทั้งหมดลง 8%',
            category: 'CLOCK MATRIX',
            statBadge: 'COOLDOWN -8%',
            icon: '⏱️',
            accent: '#a855f7',
            glow: 'rgba(168, 85, 247, 0.32)',
            type: 'cooldown',
            value: 0.92,
        }),
        damage_patch: Object.freeze({
            title: 'DAMAGE_PATCH',
            body: 'Damage kernel +8%',
            descTh: 'เพิ่มพลังโจมตีหลัก (Damage Kernel) +8%',
            category: 'WEAPON KERNEL',
            statBadge: 'DAMAGE +8%',
            icon: '⚔️',
            accent: '#f59e0b',
            glow: 'rgba(245, 158, 11, 0.34)',
            type: 'damage',
            value: 1.08,
        }),
        repair_nanogel: Object.freeze({
            title: 'REPAIR_NANOGEL',
            body: 'Restore 25% of max HP',
            descTh: 'ซ่อมแซมและฟื้นฟูพลังชีวิต 25% ของค่าสูงสุดทันที',
            category: 'NANO-REPAIR',
            statBadge: 'HEAL 25% MAX HP',
            icon: '✚',
            accent: '#10b981',
            glow: 'rgba(16, 185, 129, 0.34)',
            type: 'heal',
            value: 0.25,
        }),
        boss_data_overload: Object.freeze({
            title: 'BOSS_DATA_OVERLOAD',
            body: 'Boss data extracted: damage kernel +50%',
            descTh: 'สกัดข้อมูลบอส: เพิ่มพลังโจมตีหลักอย่างมหาศาล +50%',
            category: 'BOSS OVERLOAD',
            statBadge: 'DAMAGE +50%',
            icon: '👑',
            accent: '#facc15',
            glow: 'rgba(250, 204, 21, 0.42)',
            type: 'damage',
            value: 1.50,
            bossPower: true,
        }),
        void_stabilizer: Object.freeze({
            title: 'VOID_STABILIZER',
            body: 'Boss data extracted: Time Energy capacity +35',
            descTh: 'สกัดข้อมูลบอส: เพิ่มความจุพลังงานเวลาสูงสุด +35',
            category: 'VOID SINGULARITY',
            statBadge: 'TIME ENERGY +35',
            icon: '🌌',
            accent: '#e879f9',
            glow: 'rgba(232, 121, 249, 0.40)',
            type: 'time_energy',
            value: 35,
            bossPower: true,
        }),
        overclock_matrix: Object.freeze({
            title: 'OVERCLOCK_MATRIX',
            body: 'Boss data extracted: cooldown multiplier -18%',
            descTh: 'สกัดข้อมูลบอส: ลดคูลดาวน์สกิลทั้งหมดลงอย่างมาก 18%',
            category: 'HYPER CLOCK',
            statBadge: 'COOLDOWN -18%',
            icon: '⚙️',
            accent: '#fb923c',
            glow: 'rgba(251, 146, 60, 0.40)',
            type: 'cooldown',
            value: 0.82,
            bossPower: true,
        }),
        boss_core_fortify: Object.freeze({
            title: 'BOSS_CORE_FORTIFY',
            body: 'Boss data extracted: Max HP +35 and repair +35',
            descTh: 'สกัดข้อมูลบอส: เพิ่มพลังชีวิตสูงสุด +35 และฟื้นฟูทันที +35',
            category: 'AEGIS KERNEL',
            statBadge: 'MAX HP +35 & HEAL',
            icon: '🛡️',
            accent: '#f87171',
            glow: 'rgba(248, 113, 113, 0.40)',
            type: 'hp',
            value: 35,
            bossPower: true,
        }),
    });

    let _root = null;
    let _pendingPlayer = null;
    let _onComplete = null;
    let _pendingBossReward = false;
    let _seed = 0;
    let _keyListenerAttached = false;
    const _choiceIds = ['', '', ''];
    const _stacks = Object.create(null);
    const _baseline = {
        active: false,
        player: null,
        maxHp: 0,
        metaSpeedMult: undefined,
        skillCooldownMult: undefined,
        damageMultiplier: undefined,
    };

    function _ensureStyles() {
        if (typeof document === 'undefined') return;
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            @keyframes ruPanelEnter {
                from { opacity: 0; transform: translateY(18px) scale(0.96); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes ruCardEnter {
                from { opacity: 0; transform: translateY(16px); }
                to { opacity: 1; transform: translateY(0); }
            }
            #run-upgrade-overlay {
                position: fixed;
                inset: 0;
                z-index: 120;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background: radial-gradient(circle at 50% 40%, rgba(15, 23, 42, 0.78) 0%, rgba(2, 6, 18, 0.90) 100%);
                -webkit-backdrop-filter: blur(8px);
                backdrop-filter: blur(8px);
                pointer-events: auto;
                overflow-y: auto;
            }
            #run-upgrade-overlay::before {
                content: "";
                position: fixed;
                inset: 0;
                pointer-events: none;
                background: repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 3px,
                    rgba(34, 211, 238, 0.025) 3px,
                    rgba(34, 211, 238, 0.025) 4px
                );
            }
            .ru-panel {
                position: relative;
                max-width: 980px;
                width: 100%;
                text-align: center;
                animation: ruPanelEnter 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
            }
            .ru-eyebrow {
                display: inline-block;
                padding: 4px 16px;
                margin-bottom: 10px;
                border-radius: 3px;
                font-family: "Orbitron", monospace;
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 3px;
                color: #22d3ee;
                background: rgba(34, 211, 238, 0.08);
                border: 1px solid rgba(34, 211, 238, 0.32);
            }
            .ru-panel--boss .ru-eyebrow {
                color: #facc15;
                background: rgba(239, 68, 68, 0.14);
                border-color: rgba(250, 204, 21, 0.45);
            }
            .ru-heading {
                font-family: "Orbitron", sans-serif;
                font-size: clamp(20px, 3.2vw, 28px);
                font-weight: 900;
                letter-spacing: 3px;
                color: #e0f2fe;
                text-shadow: 0 0 22px rgba(34, 211, 238, 0.45);
                margin-bottom: 6px;
            }
            .ru-panel--boss .ru-heading {
                color: #fef08a;
                text-shadow: 0 0 26px rgba(250, 204, 21, 0.55);
            }
            .ru-sub {
                font-family: "Rajdhani", "Share Tech Mono", sans-serif;
                font-size: 14px;
                font-weight: 600;
                color: #94a3b8;
                margin-bottom: 22px;
                letter-spacing: 0.4px;
            }
            .ru-cards {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 16px;
            }
            .ru-card {
                --ru-accent: #22d3ee;
                --ru-glow: rgba(34, 211, 238, 0.3);
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: stretch;
                width: min(302px, 88vw);
                min-height: 256px;
                padding: 16px 18px 14px;
                border: 1.5px solid color-mix(in srgb, var(--ru-accent) 48%, transparent);
                background: linear-gradient(165deg, rgba(13, 21, 38, 0.96) 0%, rgba(5, 9, 19, 0.97) 100%);
                color: #e0f2fe;
                text-align: left;
                cursor: pointer;
                clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
                -webkit-clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
                box-shadow: 0 12px 30px rgba(0, 0, 0, 0.65), inset 0 0 24px rgba(15, 23, 42, 0.65);
                transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.18s, box-shadow 0.18s;
                animation: ruCardEnter 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
                touch-action: manipulation;
            }
            .ru-card::before {
                content: "";
                position: absolute;
                top: 0;
                left: 16px;
                right: 16px;
                height: 2px;
                background: linear-gradient(90deg, transparent, var(--ru-accent), transparent);
                opacity: 0.75;
            }
            .ru-card:hover,
            .ru-card:focus-visible {
                outline: none;
                transform: translateY(-6px) scale(1.02);
                border-color: var(--ru-accent);
                box-shadow: 0 16px 36px rgba(0, 0, 0, 0.75), 0 0 26px var(--ru-glow), inset 0 0 20px var(--ru-glow);
            }
            .ru-card:active {
                transform: translateY(-2px) scale(0.99);
            }
            .ru-corner {
                position: absolute;
                width: 11px;
                height: 11px;
                border-color: var(--ru-accent);
                border-style: solid;
                opacity: 0.7;
                pointer-events: none;
            }
            .ru-corner--tr { top: 6px; right: 6px; border-width: 2px 2px 0 0; }
            .ru-corner--bl { bottom: 6px; left: 6px; border-width: 0 0 2px 2px; }
            .ru-top-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                gap: 8px;
            }
            .ru-keycap {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 26px;
                height: 22px;
                padding: 0 7px;
                border-radius: 4px;
                font-family: "Orbitron", monospace;
                font-size: 11px;
                font-weight: 800;
                color: var(--ru-accent);
                background: rgba(2, 6, 18, 0.85);
                border: 1px solid color-mix(in srgb, var(--ru-accent) 55%, transparent);
                box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--ru-accent) 30%, transparent);
            }
            .ru-stack {
                font-family: "Share Tech Mono", monospace;
                font-size: 10.5px;
                font-weight: 700;
                letter-spacing: 1px;
                padding: 2px 8px;
                border-radius: 3px;
                color: #e0f2fe;
                background: color-mix(in srgb, var(--ru-accent) 18%, rgba(15, 23, 42, 0.8));
                border: 1px solid color-mix(in srgb, var(--ru-accent) 42%, transparent);
            }
            .ru-hero {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
            }
            .ru-icon-hex {
                width: 46px;
                height: 46px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                background: color-mix(in srgb, var(--ru-accent) 14%, rgba(8, 12, 24, 0.95));
                border: 1.5px solid var(--ru-accent);
                border-radius: 10px;
                box-shadow: 0 0 16px var(--ru-glow);
            }
            .ru-meta {
                min-width: 0;
            }
            .ru-category {
                font-family: "Share Tech Mono", monospace;
                font-size: 10px;
                letter-spacing: 1.4px;
                color: var(--ru-accent);
                opacity: 0.9;
                margin-bottom: 3px;
            }
            .ru-title {
                font-family: "Orbitron", monospace;
                font-size: 11.5px;
                font-weight: 800;
                letter-spacing: 0.2px;
                color: #f8fafc;
                white-space: nowrap;
            }
            .ru-stat-pill {
                align-self: flex-start;
                margin-bottom: 10px;
                padding: 4px 10px;
                border-radius: 4px;
                font-family: "Orbitron", monospace;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.8px;
                color: var(--ru-accent);
                background: color-mix(in srgb, var(--ru-accent) 14%, transparent);
                border: 1px solid color-mix(in srgb, var(--ru-accent) 45%, transparent);
            }
            .ru-body-en {
                font-family: "Share Tech Mono", Consolas, monospace;
                font-size: 11.5px;
                color: #94a3b8;
                line-height: 1.35;
                margin-bottom: 5px;
            }
            .ru-body-th {
                font-family: "Rajdhani", "Inter", sans-serif;
                font-size: 14px;
                font-weight: 600;
                color: #e2e8f0;
                line-height: 1.4;
                margin-bottom: 14px;
                flex: 1 1 auto;
            }
            .ru-cta {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-top: 10px;
                border-top: 1px solid rgba(148, 163, 184, 0.16);
                font-family: "Orbitron", monospace;
                font-size: 10.5px;
                font-weight: 700;
                letter-spacing: 1.4px;
                color: var(--ru-accent);
                opacity: 0.82;
                transition: opacity 0.15s;
            }
            .ru-card:hover .ru-cta,
            .ru-card:focus-visible .ru-cta {
                opacity: 1;
            }
            @media (prefers-reduced-motion: reduce) {
                .ru-panel, .ru-card {
                    animation: none;
                    transition: none;
                }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function _styleRoot(el) {
        el.id = 'run-upgrade-overlay';
    }

    function _ensureRoot() {
        _ensureStyles();
        if (_root && _root.isConnected) return _root;
        if (typeof document === 'undefined') return null;
        _root = document.getElementById('run-upgrade-overlay');
        if (!_root) {
            _root = document.createElement('div');
            document.body.appendChild(_root);
        }
        _styleRoot(_root);
        return _root;
    }

    function _onDocKeyDown(e) {
        if (!_root || _root.style.display !== 'flex' || !_pendingPlayer) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        let idx = -1;
        if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') idx = 0;
        else if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') idx = 1;
        else if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') idx = 2;

        // Prevent input.js window keydown handler from calling resumeGame() while modal is open
        e.stopPropagation();
        if (idx >= 0 && _choiceIds[idx]) {
            e.preventDefault();
            apply(_choiceIds[idx]);
        }
    }

    function _attachKeyListener() {
        if (typeof document === 'undefined' || _keyListenerAttached) return;
        document.addEventListener('keydown', _onDocKeyDown);
        _keyListenerAttached = true;
    }

    function _detachKeyListener() {
        if (typeof document === 'undefined' || !_keyListenerAttached) return;
        document.removeEventListener('keydown', _onDocKeyDown);
        _keyListenerAttached = false;
    }

    function _clearDom() {
        _detachKeyListener();
        if (!_root) return;
        while (_root.firstChild) _root.removeChild(_root.firstChild);
        _root.style.display = 'none';
    }

    function _makeEl(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }

    function _formatStatPreview(player, def) {
        if (!player || !def) return (def && def.statBadge) || '';
        if (def.type === 'speed') {
            const cur = Math.round((player.metaSpeedMult || 1) * 100);
            const nxt = Math.round(((player.metaSpeedMult || 1) + def.value) * 100);
            return `SPD ${cur}% → ${nxt}%`;
        }
        if (def.type === 'hp') {
            const cur = Math.round(player.maxHp || 100);
            const nxt = cur + def.value;
            return `MAX HP ${cur} → ${nxt} (+${def.value} HEAL)`;
        }
        if (def.type === 'time_energy') {
            const cur = Math.round(typeof window !== 'undefined' && Number.isFinite(window.slowMoMaxEnergy) ? window.slowMoMaxEnergy : 100);
            const nxt = cur + def.value;
            return `TIME EN ${cur} → ${nxt} (+${def.value})`;
        }
        if (def.type === 'hijack_cost') {
            const cur = Math.round((typeof BodySwapSystem !== 'undefined' && typeof BodySwapSystem.getEnergyCost === 'function')
                ? BodySwapSystem.getEnergyCost()
                : 30);
            const nxt = Math.max(20, cur - def.value);
            return `HIJACK COST ${cur} → ${nxt} EN`;
        }
        if (def.type === 'cooldown') {
            const cur = Math.round((player.skillCooldownMult || 1) * 100);
            const nxt = Math.round(Math.max(0.35, (player.skillCooldownMult || 1) * def.value) * 100);
            return `COOLDOWN ${cur}% → ${nxt}%`;
        }
        if (def.type === 'damage') {
            const cur = Math.round((player._damageMultiplier || 1) * 100);
            const nxt = Math.round((player._damageMultiplier || 1) * def.value * 100);
            return `DMG ${cur}% → ${nxt}%`;
        }
        if (def.type === 'heal') {
            const maxHp = Math.round(player.maxHp || 100);
            const curHp = Math.round(player.hp || 0);
            const nxtHp = Math.min(maxHp, curHp + Math.ceil(maxHp * def.value));
            return `HP ${curHp}/${maxHp} → ${nxtHp}/${maxHp}`;
        }
        return def.statBadge || '';
    }

    function _makeCard(id, index) {
        const def = UPGRADES[id];
        const stack = _stacks[id] || 0;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ru-card';
        btn.dataset.upgradeId = id;
        btn.style.setProperty('--ru-accent', def.accent || '#22d3ee');
        btn.style.setProperty('--ru-glow', def.glow || 'rgba(34, 211, 238, 0.3)');

        btn.appendChild(_makeEl('i', 'ru-corner ru-corner--tr'));
        btn.appendChild(_makeEl('i', 'ru-corner ru-corner--bl'));

        const topRow = _makeEl('div', 'ru-top-row');
        topRow.appendChild(_makeEl('span', 'ru-keycap', `[${index + 1}]`));
        topRow.appendChild(_makeEl('span', 'ru-stack', stack > 0 ? `LV.${stack} → ${stack + 1}` : 'NEW'));
        btn.appendChild(topRow);

        const hero = _makeEl('div', 'ru-hero');
        hero.appendChild(_makeEl('div', 'ru-icon-hex', def.icon || '◈'));
        const meta = _makeEl('div', 'ru-meta');
        meta.appendChild(_makeEl('div', 'ru-category', def.category || 'SYSTEM MODULE'));
        meta.appendChild(_makeEl('div', 'ru-title', def.title));
        hero.appendChild(meta);
        btn.appendChild(hero);

        const statPreview = _formatStatPreview(_pendingPlayer, def);
        if (statPreview) btn.appendChild(_makeEl('div', 'ru-stat-pill', statPreview));
        btn.appendChild(_makeEl('div', 'ru-body-en', def.body));
        if (def.descTh) btn.appendChild(_makeEl('div', 'ru-body-th', def.descTh));

        const cta = _makeEl('div', 'ru-cta');
        cta.appendChild(_makeEl('span', '', def.bossPower ? '▶ EXTRACT DATA' : '▶ INSTALL MODULE'));
        cta.appendChild(_makeEl('span', '', `KEY ${index + 1}`));
        btn.appendChild(cta);

        btn.onclick = function () {
            apply(btn.dataset.upgradeId);
        };
        return btn;
    }

    function _pickChoices(isBossWave) {
        const pool = isBossWave ? BOSS_POOL : UPGRADE_IDS;
        const len = pool.length;
        _seed = (_seed + (isBossWave ? 1 : 3)) % len;
        const step = isBossWave ? 1 : 2;
        for (let i = 0; i < MAX_CHOICES; i++) {
            _choiceIds[i] = pool[(_seed + i * step) % len];
        }
    }

    function _ensureBaseline(player) {
        if (_baseline.active && _baseline.player === player) return;
        if (_baseline.active) _restoreBaseline();
        _baseline.active = true;
        _baseline.player = player;
        _baseline.maxHp = player.maxHp;
        _baseline.metaSpeedMult = player.metaSpeedMult;
        _baseline.skillCooldownMult = player.skillCooldownMult;
        _baseline.damageMultiplier = player._damageMultiplier;
    }

    function _restoreBaseline() {
        const player = _baseline.player;
        if (_baseline.active && player) {
            player.maxHp = _baseline.maxHp;
            if (Number.isFinite(player.hp) && player.hp > 0) player.hp = Math.min(player.hp, player.maxHp);
            player.metaSpeedMult = _baseline.metaSpeedMult;
            player.skillCooldownMult = _baseline.skillCooldownMult;
            player._damageMultiplier = _baseline.damageMultiplier;
        }
        _baseline.active = false;
        _baseline.player = null;
        _baseline.maxHp = 0;
        _baseline.metaSpeedMult = undefined;
        _baseline.skillCooldownMult = undefined;
        _baseline.damageMultiplier = undefined;
    }

    function offer(player, isBossWave, onComplete) {
        if (!player || player.dead) return false;
        if (typeof CanvasHUD !== 'undefined' && CanvasHUD._mapOpen) CanvasHUD.closeFullMap();
        const root = _ensureRoot();
        if (!root) return false;
        const bossReward = isBossWave === true;
        const done = typeof isBossWave === 'function' ? isBossWave : onComplete;

        if (typeof window._resetAllInput === 'function') window._resetAllInput();
        if (typeof CANVAS !== 'undefined' && CANVAS && CANVAS.classList) {
            CANVAS.classList.remove('gameplay-cursor-hidden');
            CANVAS.style.cursor = 'default';
        }

        _pendingPlayer = player;
        _onComplete = typeof done === 'function' ? done : null;
        _pendingBossReward = bossReward;
        _pickChoices(bossReward);
        _clearDom();

        const panel = _makeEl('div', bossReward ? 'ru-panel ru-panel--boss' : 'ru-panel');
        panel.appendChild(_makeEl('div', 'ru-eyebrow', bossReward
            ? '⚠ ANOMALY CORE // BOSS DATA EXTRACTION ⚠'
            : '◈ MTC TACTICAL OS // KERNEL UPGRADE ◈'));
        panel.appendChild(_makeEl('div', 'ru-heading', bossReward
            ? 'BOSS DATA EXTRACTION'
            : 'SYSTEM PATCH AVAILABLE'));
        panel.appendChild(_makeEl('div', 'ru-sub', bossReward
            ? 'สกัดข้อมูลบอสระดับสูง — เลือก 1 พลังเสริม (คลิกหรือกดปุ่ม 1 / 2 / 3)'
            : 'เลือก 1 โมดูลเพื่อติดตั้งลงในระบบ — คลิกหรือกดปุ่ม [1] [2] [3]'));

        const row = _makeEl('div', 'ru-cards');
        for (let i = 0; i < MAX_CHOICES; i++) row.appendChild(_makeCard(_choiceIds[i], i));
        panel.appendChild(row);

        root.appendChild(panel);
        root.style.display = 'flex';
        _attachKeyListener();

        if (typeof GameState !== 'undefined') GameState.setPhase('PAUSED');
        return true;
    }

    function _applyUpgrade(player, def) {
        if (def.type === 'speed') {
            player.metaSpeedMult = (player.metaSpeedMult || 1) + def.value;
        } else if (def.type === 'hp') {
            player.maxHp += def.value;
            player.hp = Math.min(player.maxHp, player.hp + def.value);
        } else if (def.type === 'time_energy') {
            if (typeof addSlowMoMaxEnergy === 'function') addSlowMoMaxEnergy(def.value);
        } else if (def.type === 'hijack_cost') {
            if (typeof tuneBodySwapEnergyCost === 'function') tuneBodySwapEnergyCost(-def.value);
        } else if (def.type === 'cooldown') {
            player.skillCooldownMult = Math.max(0.35, (player.skillCooldownMult || 1) * def.value);
        } else if (def.type === 'damage') {
            player._damageMultiplier = (player._damageMultiplier || 1) * def.value;
        } else if (def.type === 'heal') {
            player.hp = Math.min(player.maxHp, player.hp + Math.ceil(player.maxHp * def.value));
        }
    }

    function apply(playerOrUpgradeId, maybeUpgradeId) {
        const player = maybeUpgradeId ? playerOrUpgradeId : _pendingPlayer;
        const upgradeId = maybeUpgradeId || playerOrUpgradeId;
        const def = UPGRADES[upgradeId];
        if (!player || !def) return false;

        _ensureBaseline(player);
        _stacks[upgradeId] = (_stacks[upgradeId] || 0) + 1;
        _applyUpgrade(player, def);
        _clearDom();

        if (typeof TerminalLog !== 'undefined') {
            const text = def.bossPower ? `BOSS_DATA_EXTRACTED: ${def.title}` : `${def.title} INSTALLED`;
            TerminalLog.push({ sender: 'SYSTEM', text, type: def.bossPower ? 'warn' : 'info' });
        }
        if (typeof spawnFloatingText === 'function') {
            const label = def.bossPower ? 'BOSS DATA EXTRACTED' : 'SYSTEM PATCH INSTALLED';
            spawnFloatingText(label, player.x, player.y - 78, def.bossPower ? '#facc15' : '#67e8f9', 20);
        }

        const done = _onComplete;
        _pendingPlayer = null;
        _onComplete = null;
        _pendingBossReward = false;
        if (typeof CANVAS !== 'undefined' && CANVAS && CANVAS.style.cursor === 'default') {
            CANVAS.style.cursor = '';
        }
        if (typeof GameState !== 'undefined') GameState.setPhase('PLAYING');
        if (done) done();
        return true;
    }

    function clearRun() {
        _restoreBaseline();
        _clearDom();
        _pendingPlayer = null;
        _onComplete = null;
        _pendingBossReward = false;
        for (let i = 0; i < UPGRADE_IDS.length; i++) _stacks[UPGRADE_IDS[i]] = 0;
        for (let i = 0; i < BOSS_POOL.length; i++) _stacks[BOSS_POOL[i]] = 0;
        if (typeof resetSlowMoEnergyTuning === 'function') resetSlowMoEnergyTuning();
        if (typeof resetBodySwapTuning === 'function') resetBodySwapTuning();
    }

    window.RUN_UPGRADES = UPGRADES;
    window.BOSS_POWER_UPGRADES = BOSS_POOL;
    window.RunUpgradeSystem = {
        offer,
        apply,
        clearRun,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
