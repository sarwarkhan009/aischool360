import { initializeApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import type { Database } from "firebase/database";
import { getMessaging, isSupported } from "firebase/messaging";
import type { Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCe-UiH-tAdsalwqZqpMjd4w1mci509aT4",
  authDomain: "ai-school360.firebaseapp.com",
  projectId: "ai-school360",
  storageBucket: "ai-school360.firebasestorage.app",
  messagingSenderId: "224285030074",
  appId: "1:224285030074:web:e53896e81e4e98ad07b483"
};

// Initialize Firebase with error handling and proper typing
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let storage: FirebaseStorage;
let rtdb: Database;
let messaging: Messaging | null = null;

try {
  app = initializeApp(firebaseConfig);
  console.log('Firebase app initialized successfully');

  // Export services
  db = getFirestore(app);
  console.log('Firestore initialized successfully');

  auth = getAuth(app);
  console.log('Auth initialized successfully');

  storage = getStorage(app);
  console.log('Storage initialized successfully');

  rtdb = getDatabase(app);
  console.log('Realtime Database initialized successfully');

  // Initialize messaging only if supported (browser environment)
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
      console.log('Firebase Messaging initialized successfully');
    } else {
      console.warn('Firebase Messaging not supported in this environment');
    }
  }).catch((error) => {
    console.warn('Firebase Messaging initialization check failed:', error);
  });
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw new Error(`Firebase failed to initialize: ${error}`);
}

export { db, auth, storage, rtdb, messaging };
export default app;

