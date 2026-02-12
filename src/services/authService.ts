import { auth } from "../config/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { sendPasswordResetEmail } from "firebase/auth";
export const registerUser = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const loginUser = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const logoutUser = () => signOut(auth);

export async function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email.trim());
}
