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

/**
 * Save user profile to Cloud Firestore
 */
export async function syncUserToFirestore(uid, profileData) {
  if (!uid) return;
  const userRef = doc(db, 'users', uid);
  const { kycImages, ...rest } = profileData;

  await setDoc(
    userRef,
    {
      ...rest,
      uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // If captain KYC images are provided, store in subcollection
  if (kycImages && typeof kycImages === 'object') {
    for (const [key, base64Data] of Object.entries(kycImages)) {
      if (base64Data) {
        const kycDocRef = doc(db, 'users', uid, 'kyc', key);
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
