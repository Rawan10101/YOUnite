import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import {
  getReactNativePersistence,
  initializeAuth
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage'; // Add this import

const firebaseConfig = {
  apiKey: "AIzaSyAixBm_N-pAVjKzj76Ghi5ZdZblGTW6nyU",
  authDomain: "younite-7eb12.firebaseapp.com",
  projectId: "younite-7eb12",
  storageBucket: "younite-7eb12.appspot.com",
  messagingSenderId: "367081378484",
  appId: "1:367081378484:web:4599590b64f10e992a7de1",
  measurementId: "G-6N5MWG1R7C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const db = getFirestore(app);
const storage = getStorage(app); // Add this line

export { auth, db, storage }; // Add storage to exports
