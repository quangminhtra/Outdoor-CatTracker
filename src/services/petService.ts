import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";

export async function createDemoPet(uid: string) {
  const petId = "pet_whiskers";
  const petRef = doc(db, "users", uid, "pets", petId);

  await setDoc(
    petRef,
    {
      name: "Whiskers",
      breed: "—",
      colorPattern: "—",
      deviceId: "DEMO-DEVICE",
      avatarUrl: "",
      lastLocation: { lat: 43.6577, lng: -79.3792, timestamp: Math.floor(Date.now() / 1000) },
      geofence: { center: { lat: 43.6577, lng: -79.3792 }, radiusMeters: 120 },
      prefs: { notifyExit: true, notifyReturn: true }
    },
    { merge: true }
  );

  // set active pet
  await updateDoc(doc(db, "users", uid), { activePetId: petId });
}
