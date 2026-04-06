import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, setPersistence, browserLocalPersistence, getRedirectResult } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Set persistence to local to ensure it survives app restarts/WebView reloads
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.error("Error setting persistence", err);
});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const loginWithGoogle = async () => {
  try {
    // Save intent to localStorage (more stable than sessionStorage in WebViews)
    localStorage.setItem('google_login_intent', 'true');
    
    // Try popup first
    const result = await signInWithPopup(auth, googleProvider);
    localStorage.removeItem('google_login_intent');
    return result.user;
  } catch (error: any) {
    // If popup is blocked or not supported (common in WebViews/Native wrappers), fall back to redirect
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
      console.log("Popup blocked or unsupported, falling back to redirect...");
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectError) {
        localStorage.removeItem('google_login_intent');
        console.error("Error signing in with redirect", redirectError);
        throw redirectError;
      }
    } else {
      localStorage.removeItem('google_login_intent');
      console.error("Error signing in with Google", error);
      throw error;
    }
  }
};

export { getRedirectResult };

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
