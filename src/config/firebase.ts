import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  type Persistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBLxpRsZg1QVzn877qOyibWVa7Y62m3dw8",
  authDomain: "outdoorcattracker.firebaseapp.com",
  projectId: "outdoorcattracker",
  storageBucket: "outdoorcattracker.firebasestorage.app",
  messagingSenderId: "688791555290",
  appId: "1:688791555290:web:dfe933ee0e8cc4531de9e3",
};

const app = initializeApp(firebaseConfig);

export const auth = (() => {
  try {
    const firebaseAuth = require("firebase/auth") as {
      getReactNativePersistence?: (
        storage: typeof AsyncStorage
      ) => Persistence;
    };

    if (firebaseAuth.getReactNativePersistence) {
      return initializeAuth(app, {
        persistence: firebaseAuth.getReactNativePersistence(AsyncStorage),
      });
    }

    return getAuth(app);
  } catch {
    return getAuth(app);
  }
})();

export const db = getFirestore(app);
export const storage = getStorage(app);
