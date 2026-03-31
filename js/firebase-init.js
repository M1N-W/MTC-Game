'use strict';
/**
 * js/firebase-init.js
 * Source for Firebase SDK bundle (npm + esbuild → js/firebase-bundle.js).
 * Run: npm install && npm run build:firebase
 *
 * Spark-friendly: ไม่ใช้ Cloud Functions — Leaderboard เขียนผ่าน Firestore + Security Rules
 * Products: App, Analytics, Auth (anonymous + Google link/popup), Firestore, Remote Config.
 * Optional override: window.CONFIG_SECRETS.FIREBASE_CONFIG — script must run BEFORE firebase-bundle.js.
 */
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    linkWithPopup,
} from 'firebase/auth';
import {
    initializeFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    collection,
    query,
    orderBy,
    limit,
    getDocs,
} from 'firebase/firestore';
import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';

const DEFAULT_FIREBASE_CONFIG = {
    apiKey: 'AIzaSyD2VAzAEGDd1hVjHrlz0Yuym2_iPxQFhsI',
    authDomain: 'mtc-game-d6c4e.firebaseapp.com',
    projectId: 'mtc-game-d6c4e',
    storageBucket: 'mtc-game-d6c4e.firebasestorage.app',
    messagingSenderId: '565929955805',
    appId: '1:565929955805:web:130dd0681079c91b6ba634',
    measurementId: 'G-BRL2NRBHG6',
};

const firebaseConfig = (typeof CONFIG_SECRETS !== 'undefined'
    && CONFIG_SECRETS
    && CONFIG_SECRETS.FIREBASE_CONFIG)
    ? CONFIG_SECRETS.FIREBASE_CONFIG
    : DEFAULT_FIREBASE_CONFIG;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalForceLongPolling: true });
const googleProvider = new GoogleAuthProvider();

let analytics = null;
isSupported()
    .then((ok) => {
        if (ok) {
            analytics = getAnalytics(app);
        }
    })
    .catch(() => { });

window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDb = db;

Object.defineProperty(window, 'firebaseAnalytics', {
    configurable: true,
    enumerable: true,
    get() {
        return analytics;
    },
});

window.firebaseLogEvent = (eventName, eventParams) => {
    if (!analytics) return;
    try {
        logEvent(analytics, eventName, eventParams || {});
    } catch (e) {
        /* ignore */
    }
};

let _userReadyResolved = false;
window.firebaseUserReady = new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
        if (user && !_userReadyResolved) {
            _userReadyResolved = true;
            resolve(user);
        }
        try {
            window.dispatchEvent(new CustomEvent('mtc-auth-changed', { detail: { user } }));
        } catch (e) {
            /* ignore */
        }
    });
});

signInAnonymously(auth)
    .then((result) => {
        console.log('[Firebase] Anonymous sign-in successful:', result.user.uid);
    })
    .catch((err) => {
        console.error('[Firebase] Anonymous sign-in failed. If this is on GitHub Pages, ensure the domain is added to "Authorized domains" in Firebase Console.', err);
    });

const remoteConfig = getRemoteConfig(app);
remoteConfig.settings.minimumFetchIntervalMillis = 3600000;
remoteConfig.defaultConfig = {
    shop_banner: '',
    announcement: '',
};

window.firebaseRemoteConfig = remoteConfig;
window._remoteConfigReady = false;

window.firebaseRemoteConfigReady = fetchAndActivate(remoteConfig)
    .then(() => {
        window._remoteConfigReady = true;
    })
    .catch(() => {
        window._remoteConfigReady = true;
    });

window.getRemoteConfigString = (key, defaultVal) => {
    try {
        if (!window.firebaseRemoteConfig) return defaultVal;
        const v = getValue(window.firebaseRemoteConfig, key);
        const s = v.asString();
        return s || defaultVal;
    } catch (e) {
        return defaultVal;
    }
};

window.MTCFirebase = {
    async saveUserGameData(uid, payload) {
        const ref = doc(db, 'users', uid);
        await setDoc(ref, {
            ...payload,
            updatedAt: serverTimestamp(),
        }, { merge: true });
    },

    async loadUserGameData(uid) {
        const ref = doc(db, 'users', uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;
        return snap.data();
    },

    async signInWithGoogle() {
        const u = auth.currentUser;
        if (u && u.isAnonymous) {
            try {
                // Try linking first to preserve anonymous progress
                await linkWithPopup(u, googleProvider);
                return auth.currentUser;
            } catch (err) {
                console.warn('[Firebase] Linking failed, falling back to direct sign-in:', err.code || err);
                // If account exists or linking is blocked, just sign in directly
                // (This will switch to the Google account and drop the anonymous data)
                try {
                    return await signInWithPopup(auth, googleProvider);
                } catch (popupErr) {
                    if (popupErr.code === 'auth/popup-blocked') {
                        alert('Browser บล็อก Popup! โปรดอนุญาต Popup สำหรับหน้านี้แล้วลองใหม่ครับ');
                    }
                    throw popupErr;
                }
            }
        }
        return await signInWithPopup(auth, googleProvider);
    },

    async signOut() {
        await auth.signOut();
        // Anonymous sign-in will trigger again via onAuthStateChanged if script is active
    },

    /**
     * Leaderboard แบบ Spark: เขียน Firestore โดยตรง (กฎบังคับ Google + ขอบเขตคะแนน)
     */
    async submitLeaderboard(uid, score, wave) {
        const u = auth.currentUser;
        const displayName = (u && u.displayName) || (u && u.email) || 'Player';
        const photoURL = (u && u.photoURL) || '';
        const ref = doc(db, 'leaderboard', uid);
        await setDoc(ref, {
            uid,
            score,
            wave,
            displayName,
            photoURL,
            updatedAt: serverTimestamp(),
        }, { merge: true });
    },

    async fetchLeaderboardTop(limitCount) {
        const q = query(
            collection(db, 'leaderboard'),
            orderBy('score', 'desc'),
            limit(limitCount),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
};
