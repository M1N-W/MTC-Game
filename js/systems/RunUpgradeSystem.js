'use strict';

/**
 * js/systems/RunUpgradeSystem.js
 *
 * Run-scoped MTC system patches. DOM updates happen only on offer/apply.
 */
(function () {
    const MAX_CHOICES = 3;
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
            type: 'speed',
            value: 0.10,
        }),
        core_expansion: Object.freeze({
            title: 'CORE_EXPANSION',
            body: 'Max HP +18 and repair +18',
            type: 'hp',
            value: 18,
        }),
        energy_capacitor: Object.freeze({
            title: 'ENERGY_CAPACITOR',
            body: 'Time Energy capacity +20',
            type: 'time_energy',
            value: 20,
        }),
        hijack_efficiency: Object.freeze({
            title: 'HIJACK_EFFICIENCY',
            body: 'Data Hijack energy cost -8',
            type: 'hijack_cost',
            value: 8,
        }),
        cooldown_patch: Object.freeze({
            title: 'COOLDOWN_PATCH',
            body: 'Skill cooldown multiplier -8%',
            type: 'cooldown',
            value: 0.92,
        }),
        damage_patch: Object.freeze({
            title: 'DAMAGE_PATCH',
            body: 'Damage kernel +8%',
            type: 'damage',
            value: 1.08,
        }),
        repair_nanogel: Object.freeze({
            title: 'REPAIR_NANOGEL',
            body: 'Restore 25% of max HP',
            type: 'heal',
            value: 0.25,
        }),
        boss_data_overload: Object.freeze({
            title: 'BOSS_DATA_OVERLOAD',
            body: 'Boss data extracted: damage kernel +50%',
            type: 'damage',
            value: 1.50,
            bossPower: true,
        }),
        void_stabilizer: Object.freeze({
            title: 'VOID_STABILIZER',
            body: 'Boss data extracted: Time Energy capacity +35',
            type: 'time_energy',
            value: 35,
            bossPower: true,
        }),
        overclock_matrix: Object.freeze({
            title: 'OVERCLOCK_MATRIX',
            body: 'Boss data extracted: cooldown multiplier -18%',
            type: 'cooldown',
            value: 0.82,
            bossPower: true,
        }),
        boss_core_fortify: Object.freeze({
            title: 'BOSS_CORE_FORTIFY',
            body: 'Boss data extracted: Max HP +35 and repair +35',
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

    function _styleRoot(el) {
        el.id = 'run-upgrade-overlay';
        el.style.position = 'fixed';
        el.style.inset = '0';
        el.style.zIndex = '80';
        el.style.display = 'none';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.padding = '18px';
        el.style.background = 'rgba(2, 6, 23, 0.55)';
        el.style.fontFamily = 'Consolas, "Courier New", monospace';
    }

    function _ensureRoot() {
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

    function _clearDom() {
        if (!_root) return;
        while (_root.firstChild) _root.removeChild(_root.firstChild);
        _root.style.display = 'none';
    }

    function _makeCard(id) {
        const def = UPGRADES[id];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.upgradeId = id;
        btn.style.width = 'min(280px, 82vw)';
        btn.style.minHeight = '124px';
        btn.style.margin = '8px';
        btn.style.padding = '16px';
        btn.style.border = '1px solid rgba(34, 211, 238, 0.55)';
        btn.style.borderRadius = '8px';
        btn.style.background = 'rgba(2, 6, 23, 0.88)';
        btn.style.color = '#e0f2fe';
        btn.style.textAlign = 'left';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 0 20px rgba(34, 211, 238, 0.18)';

        const title = document.createElement('div');
        title.textContent = def.title;
        title.style.color = '#67e8f9';
        title.style.fontWeight = '800';
        title.style.fontSize = '14px';
        title.style.marginBottom = '10px';

        const body = document.createElement('div');
        body.textContent = def.body;
        body.style.color = '#cbd5e1';
        body.style.fontSize = '12px';
        body.style.lineHeight = '1.4';

        btn.appendChild(title);
        btn.appendChild(body);
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
        const root = _ensureRoot();
        if (!root) return false;
        const bossReward = isBossWave === true;
        const done = typeof isBossWave === 'function' ? isBossWave : onComplete;

        _pendingPlayer = player;
        _onComplete = typeof done === 'function' ? done : null;
        _pendingBossReward = bossReward;
        _pickChoices(bossReward);
        _clearDom();

        const panel = document.createElement('div');
        panel.style.maxWidth = '940px';
        panel.style.width = '100%';
        panel.style.textAlign = 'center';

        const heading = document.createElement('div');
        heading.textContent = bossReward ? 'BOSS DATA EXTRACTION' : 'SYSTEM PATCH AVAILABLE';
        heading.style.color = '#e0f2fe';
        heading.style.fontWeight = '900';
        heading.style.fontSize = '18px';
        heading.style.marginBottom = '14px';
        panel.appendChild(heading);

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexWrap = 'wrap';
        row.style.justifyContent = 'center';
        for (let i = 0; i < MAX_CHOICES; i++) row.appendChild(_makeCard(_choiceIds[i]));
        panel.appendChild(row);
        root.appendChild(panel);
        root.style.display = 'flex';

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
