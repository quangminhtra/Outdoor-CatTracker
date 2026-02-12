import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";

export async function ensureUserDoc(uid: string, email?: string | null) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      name: "",
      email: email ?? "",
      phone: "",
      createdAt: Math.floor(Date.now() / 1000),
      activePetId: null,
      prefs: { notifyExit: true, notifyReturn: true }
    });
  }
}
