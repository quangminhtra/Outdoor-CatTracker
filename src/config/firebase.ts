// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBLxpRsZg1QVzn877qOyibWVa7Y62m3dw8",
  authDomain: "outdoorcattracker.firebaseapp.com",
  projectId: "outdoorcattracker",
  storageBucket: "outdoorcattracker.firebasestorage.app",
  messagingSenderId: "688791555290",
  appId: "1:688791555290:web:dfe933ee0e8cc4531de9e3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";