import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

export const googleProvider = new GoogleAuthProvider();
// Force account chooser so user can pick which Google account to use
googleProvider.setCustomParameters({ prompt: 'select_account' });

const firebaseConfig = {
  apiKey: "AIzaSyC1d5Bpm9_gU5-_Qg0reHTa4HPE9idf1bQ",
  authDomain: "evorise-workspace-600d4.firebaseapp.com",
  projectId: "evorise-workspace-600d4",
  storageBucket: "evorise-workspace-600d4.firebasestorage.app",
  messagingSenderId: "202925462987",
  appId: "1:202925462987:web:a1595398a508a96629524e",
  measurementId: "G-ZNBB7TJWTM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export let messaging = null;
isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
  }
}).catch(console.error);

// Initialize Firestore with ultra-fast multi-tab caching
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// Secondary app for creating users without signing out the primary Admin
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);

export default app;
