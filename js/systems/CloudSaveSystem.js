'use strict';
/**
 * js/systems/CloudSaveSystem.js
 * Cloud sync for local persistence (mtc_save_v1, tutorial flag) via Firestore users/{uid}.
 * Depends: utils.js (getSaveData, saveData), firebase-bundle.js (MTCFirebase, firebaseUserReady).
 */
(function () {
    const CLOUD_META_KEY = 'mtc_cloud_meta_v1';
    const TUTORIAL_KEY = 'mtc_tutorial_done';
    const SAVE_KEY = 'mtc_save_v1';
    const SAVE_VERSION = 1;

    let _pushTimer = null;
    let _inited = false;

    function getLocalMeta() {
        try {
            const raw = localStorage.getItem(CLOUD_META_KEY);
            if (!raw) return { localUpdatedAt: 0 };
            const o = JSON.parse(raw);
            return typeof o.localUpdatedAt === 'number' ? o : { localUpdatedAt: 0 };
        } catch (e) {
            return { localUpdatedAt: 0 };
        }
    }

    function setLocalMeta(localUpdatedAt) {
        try {
            localStorage.setItem(CLOUD_META_KEY, JSON.stringify({ localUpdatedAt }));
        } catch (e) {
            /* ignore */
        }
    }

    function cloudTimeMs(cloud) {
        if (!cloud || !cloud.updatedAt) return 0;
        if (typeof cloud.updatedAt.toMillis === 'function') return cloud.updatedAt.toMillis();
        return 0;
    }

    function mergeCloudIntoLocal(cloud) {
        if (!cloud) return;
        const cloudMs = cloudTimeMs(cloud);
        const meta = getLocalMeta();
        if (cloudMs <= meta.localUpdatedAt) return;

        if (cloud.save && typeof cloud.save === 'object') {
            const local = typeof getSaveData === 'function' ? getSaveData() : {};
            const merged = { ...local, ...cloud.save };
            merged.highScore = Math.max(local.highScore || 0, merged.highScore || 0);
            const pass = new Set([...(local.unlockedPassives || []), ...(merged.unlockedPassives || [])]);
            merged.unlockedPassives = [...pass];
            const ach = new Set([...(local.unlockedAchievements || []), ...(merged.unlockedAchievements || [])]);
            merged.unlockedAchievements = [...ach];
            if (typeof saveData === 'function') saveData(SAVE_KEY, merged);
        }
        if (cloud.tutorialDone === true) {
            localStorage.setItem(TUTORIAL_KEY, '1');
        }
        setLocalMeta(cloudMs);
    }

    async function pushToCloud(uid) {
        if (!window.MTCFirebase || typeof window.MTCFirebase.saveUserGameData !== 'function') return;
        const payload = {
            save: typeof getSaveData === 'function' ? getSaveData() : {},
            tutorialDone: localStorage.getItem(TUTORIAL_KEY) === '1',
            saveVersion: SAVE_VERSION,
        };
        await window.MTCFirebase.saveUserGameData(uid, payload);
        setLocalMeta(Date.now());
    }

    async function pullThenMergePush(uid) {
        if (!window.MTCFirebase) return;
        let cloud = null;
        try {
            cloud = await window.MTCFirebase.loadUserGameData(uid);
        } catch (e) {
            const msg = e && e.message ? e.message : String(e);
            if (msg.includes('offline')) {
                console.warn('[CloudSave] load failed: Device/Client is offline. Firestore will retry when connected.');
            } else if (msg.toLowerCase().includes('permission')) {
                console.warn('[CloudSave] load failed: Permission denied. Check Firebase Console Security Rules.');
            } else {
                console.warn('[CloudSave] load failed:', msg);
            }
        }
        const meta = getLocalMeta();
        const cloudMs = cloudTimeMs(cloud);

        if (!cloud) {
            try {
                await pushToCloud(uid);
            } catch (e) {
                console.warn('[CloudSave] initial push failed:', e && e.message ? e.message : e);
            }
            return;
        }

        if (cloudMs > meta.localUpdatedAt) {
            mergeCloudIntoLocal(cloud);
        } else if (meta.localUpdatedAt > cloudMs) {
            try {
                await pushToCloud(uid);
            } catch (e) {
                console.warn('[CloudSave] push failed:', e && e.message ? e.message : e);
            }
        } else {
            mergeCloudIntoLocal(cloud);
        }
    }

    function schedulePush() {
        if (!_inited) return;
        clearTimeout(_pushTimer);
        _pushTimer = setTimeout(() => {
            if (!window.firebaseUserReady || !window.MTCFirebase) return;
            window.firebaseUserReady.then((user) => {
                if (!user) return;
                return pushToCloud(user.uid);
            }).catch(() => {});
        }, 1500);
    }

    function userHasGoogle(user) {
        if (!user || !user.providerData) return false;
        return user.providerData.some((p) => p.providerId === 'google.com');
    }

    /** Leaderboard แบบ Spark: เขียน Firestore โดยตรง (กฎบังคับ Google + ขอบเขตใน rules) */
    async function submitLeaderboardScore(score, wave) {
        if (!window.firebaseUserReady || !window.MTCFirebase) return;
        const user = await window.firebaseUserReady;
        if (!user || !userHasGoogle(user)) return;
        if (typeof window.MTCFirebase.submitLeaderboard !== 'function') return;
        const n = Number(score);
        const w = Number(wave);
        if (!Number.isFinite(n) || n < 0) return;
        if (!Number.isFinite(w) || w < 0) return;
        try {
            await window.MTCFirebase.submitLeaderboard(user.uid, n, w);
        } catch (e) {
            console.warn('[CloudSave] leaderboard submit failed:', e && e.message ? e.message : e);
        }
    }

    async function fetchLeaderboardTop(limitCount) {
        if (!window.MTCFirebase || typeof window.MTCFirebase.fetchLeaderboardTop !== 'function') return [];
        try {
            return await window.MTCFirebase.fetchLeaderboardTop(limitCount || 10);
        } catch (e) {
            console.warn('[CloudSave] leaderboard fetch failed:', e && e.message ? e.message : e);
            return [];
        }
    }

    function init() {
        if (_inited) return;
        _inited = true;
        if (!window.firebaseUserReady || !window.MTCFirebase) return;
        window.firebaseUserReady
            .then((user) => {
                if (!user) return;
                return pullThenMergePush(user.uid);
            })
            .catch(() => {});
    }

    window.CloudSaveSystem = {
        init,
        schedulePush,
        submitLeaderboardScore,
        fetchLeaderboardTop,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
