import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  projectId: "studio-7677131056-95d9f",
  appId: "1:281581738250:android:080a9fd7506e64157642f3",
  storageBucket: "studio-7677131056-95d9f.firebasestorage.app",
  apiKey: "AIzaSyDNOw5CnEbZ1c6rCGAujTK-CILr5upO8y4",
  authDomain: "studio-7677131056-95d9f.firebaseapp.com",
  messagingSenderId: "281581738250",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

export const WEB_CLIENT_ID =
  '281581738250-hbtbsdbmj2p8f693av13k6q7qitpdgk8.apps.googleusercontent.com';

// Clean out undefined values for Firestore compatibility
function sanitizeForFirestore(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean;
}

/**
 * Save user profile to Cloud Firestore
 */
export async function syncUserToFirestore(uid, profileData) {
  if (!uid) return;
  const userRef = doc(db, 'users', String(uid));
  const { kycImages, ...rest } = profileData || {};

  const sanitized = sanitizeForFirestore(rest);

  await setDoc(
    userRef,
    {
      ...sanitized,
      uid: String(uid),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // If captain KYC images are provided, store in subcollection
  if (kycImages && typeof kycImages === 'object') {
    for (const [key, base64Data] of Object.entries(kycImages)) {
      if (base64Data && typeof base64Data === 'string') {
        const kycDocRef = doc(db, 'users', String(uid), 'kyc', key);
        await setDoc(
          kycDocRef,
          {
            key,
            data: base64Data,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    }
  }
}

export { GoogleAuthProvider, signInWithCredential, signOut, doc, getDoc, setDoc };
