'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

const MAX_SCORE_ABS = 2000000000;
const MAX_WAVE = 50;
/** โควต้ากว้าง — ปรับตาม balance เกมจริงได้ */
const MAX_SCORE_PER_WAVE_ESTIMATE = 3000000;
const SCORE_BUFFER = 10000000;

function hasGoogleIdentity(auth) {
    if (!auth || !auth.token) return false;
    const firebase = auth.token.firebase;
    if (!firebase) return false;
    if (firebase.identities && firebase.identities['google.com']) return true;
    return firebase.sign_in_provider === 'google.com';
}

exports.submitScore = onCall({ region: 'asia-southeast1' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Sign in required');
    }
    if (!hasGoogleIdentity(request.auth)) {
        throw new HttpsError('failed-precondition', 'Google sign-in required for leaderboard');
    }

    const score = Number(request.data.score);
    const wave = Number(request.data.wave || 0);

    if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE_ABS) {
        throw new HttpsError('invalid-argument', 'Invalid score');
    }
    if (!Number.isFinite(wave) || wave < 0 || wave > MAX_WAVE) {
        throw new HttpsError('invalid-argument', 'Invalid wave');
    }

    if (score > wave * MAX_SCORE_PER_WAVE_ESTIMATE + SCORE_BUFFER) {
        throw new HttpsError('invalid-argument', 'Score exceeds plausible bounds');
    }

    const uid = request.auth.uid;
    const displayName = request.auth.token.name || request.auth.token.email || 'Player';
    const photoURL = request.auth.token.picture || '';

    const ref = db.collection('leaderboard').doc(uid);
    const snap = await ref.get();
    const prev = snap.exists ? Number(snap.data().score) || 0 : 0;

    if (score <= prev) {
        return { ok: true, kept: prev, submitted: score };
    }

    await ref.set({
        uid,
        score,
        wave,
        displayName,
        photoURL,
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { ok: true, kept: score };
});
