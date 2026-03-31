import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { getDeviceIdValidationError, normalizeDeviceId } from "../utils/deviceId";

const DEFAULT_GEOFENCE = {
  center: { lat: 43.6577, lng: -79.3792 },
  radiusMeters: 120,
};

const DEFAULT_PREFS = {
  notifyExit: true,
  notifyReturn: true,
  masterEnabled: true,
  lastNotifyExit: true,
  lastNotifyReturn: true,
};

type Geofence = {
  center: { lat: number; lng: number };
  radiusMeters: number;
};

type DeviceDoc = {
  ownerUid?: string;
  petId?: string;
};

export type DeviceAvailabilityResult =
  | {
      ok: true;
      normalizedDeviceId: string;
    }
  | {
      ok: false;
      normalizedDeviceId: string;
      code:
        | "invalid_format"
        | "device_not_found"
        | "already_linked_to_account"
        | "assigned_to_other_account";
      message: string;
      petId?: string;
    };

export type CreatePetInput = {
  deviceId: string;
  name: string;
  breed: string;
  colorPattern: string;
  avatarBase64?: string;
  makeActive?: boolean;
  geofenceCenter?: { lat: number; lng: number };
};

function isValidGeofence(value: unknown): value is Geofence {
  const geofence = value as Geofence | undefined;
  return (
    !!geofence &&
    typeof geofence.center?.lat === "number" &&
    typeof geofence.center?.lng === "number" &&
    typeof geofence.radiusMeters === "number"
  );
}

function getDeviceRef(deviceId: string) {
  return doc(db, "devices", normalizeDeviceId(deviceId));
}

async function getDeviceOwnership(deviceId: string) {
  const deviceRef = getDeviceRef(deviceId);
  const deviceSnap = await getDoc(deviceRef);

  if (!deviceSnap.exists()) {
    return null;
  }

  const device = deviceSnap.data() as DeviceDoc;
  const ownerUid = typeof device.ownerUid === "string" ? device.ownerUid : null;
  const petId = typeof device.petId === "string" ? device.petId : null;

  return { ownerUid, petId };
}

export async function checkDeviceIdAvailability(
  uid: string,
  rawDeviceId: string
): Promise<DeviceAvailabilityResult> {
  const normalizedDeviceId = normalizeDeviceId(rawDeviceId);
  const formatError = getDeviceIdValidationError(normalizedDeviceId);

  if (formatError) {
    return {
      ok: false,
      normalizedDeviceId,
      code: "invalid_format",
      message: formatError,
    };
  }

  const deviceSnap = await getDoc(getDeviceRef(normalizedDeviceId));
  if (!deviceSnap.exists()) {
    return {
      ok: false,
      normalizedDeviceId,
      code: "device_not_found",
      message: "This device ID is not registered in the system yet.",
    };
  }

  const ownership = await getDeviceOwnership(normalizedDeviceId);
  if (!ownership || !ownership.ownerUid || !ownership.petId) {
    return { ok: true, normalizedDeviceId };
  }

  if (ownership.ownerUid === uid) {
    return {
      ok: false,
      normalizedDeviceId,
      code: "already_linked_to_account",
      message: "This device is already linked to a pet on your account.",
      petId: ownership.petId ?? undefined,
    };
  }

  return {
    ok: false,
      normalizedDeviceId,
      code: "assigned_to_other_account",
      message: "This device is already assigned to another account.",
      petId: ownership.petId ?? undefined,
    };
  }

export async function createPetForCurrentUser(uid: string, input: CreatePetInput) {
  const normalizedDeviceId = normalizeDeviceId(input.deviceId);
  const formatError = getDeviceIdValidationError(normalizedDeviceId);

  if (formatError) {
    throw new Error(formatError);
  }

  const now = Date.now();
  const petsRef = collection(db, "users", uid, "pets");
  const petRef = doc(petsRef);
  const userRef = doc(db, "users", uid);
  const deviceRef = getDeviceRef(normalizedDeviceId);

  await runTransaction(db, async (transaction) => {
    const deviceSnap = await transaction.get(deviceRef);
    if (!deviceSnap.exists()) {
      throw new Error("This device ID is not registered in the system yet.");
    }

    const device = deviceSnap.data() as DeviceDoc;
    const ownerUid = typeof device.ownerUid === "string" ? device.ownerUid : null;
    const existingPetId = typeof device.petId === "string" ? device.petId : null;

    if (ownerUid && existingPetId) {
      if (ownerUid === uid) {
        throw new Error("This device is already linked to one of your pets.");
      }

      throw new Error("This device is already assigned to another account.");
    }

    const userSnap = await transaction.get(userRef);
    const userData = userSnap.data() as { activePetId?: string | null } | undefined;
    const shouldMakeActive =
      input.makeActive !== false ||
      typeof userData?.activePetId !== "string" ||
      !userData.activePetId;

    let geofenceToApply: Geofence = {
      center: input.geofenceCenter ?? DEFAULT_GEOFENCE.center,
      radiusMeters: DEFAULT_GEOFENCE.radiusMeters,
    };

    const sharedGeofence = (userData as { sharedGeofence?: Geofence } | undefined)?.sharedGeofence;
    if (isValidGeofence(sharedGeofence)) {
      geofenceToApply = sharedGeofence;
    } else if (typeof userData?.activePetId === "string" && userData.activePetId) {
      const activePetRef = doc(db, "users", uid, "pets", userData.activePetId);
      const activePetSnap = await transaction.get(activePetRef);
      const activePetData = activePetSnap.data() as { geofence?: Geofence } | undefined;

      if (isValidGeofence(activePetData?.geofence)) {
        geofenceToApply = activePetData.geofence;
      }
    }

    transaction.set(petRef, {
      name: input.name.trim(),
      breed: input.breed.trim(),
      colorPattern: input.colorPattern.trim(),
      deviceId: normalizedDeviceId,
      avatarBase64: input.avatarBase64 ?? "",
      geofence: geofenceToApply,
      prefs: DEFAULT_PREFS,
      createdAtMs: now,
      updatedAtMs: now,
    });

    transaction.set(deviceRef, {
      ownerUid: uid,
      petId: petRef.id,
      updatedAtMs: now,
    }, { merge: true });

    if (shouldMakeActive) {
      transaction.set(userRef, { activePetId: petRef.id }, { merge: true });
    } else if (!userSnap.exists()) {
      transaction.set(userRef, { activePetId: null }, { merge: true });
    }
  });

  return petRef.id;
}

export async function setActivePetForCurrentUser(uid: string, petId: string) {
  await setDoc(doc(db, "users", uid), { activePetId: petId }, { merge: true });
}

export async function updateHomebaseForAllPets(uid: string, geofence: Geofence) {
  const now = Date.now();
  await setDoc(
    doc(db, "users", uid),
    {
      sharedGeofence: geofence,
      updatedAtMs: now,
    },
    { merge: true }
  );
}

export async function removePetFromCurrentUser(uid: string, petId: string) {
  const userRef = doc(db, "users", uid);
  const petRef = doc(db, "users", uid, "pets", petId);

  const [userSnap, petSnap, petsSnap, alertsSnap] = await Promise.all([
    getDoc(userRef),
    getDoc(petRef),
    getDocs(collection(db, "users", uid, "pets")),
    getDocs(collection(db, "users", uid, "pets", petId, "alerts")),
  ]);

  if (!petSnap.exists()) {
    throw new Error("This pet no longer exists.");
  }

  const petData = petSnap.data() as { deviceId?: string } | undefined;
  const normalizedDeviceId =
    typeof petData?.deviceId === "string" ? normalizeDeviceId(petData.deviceId) : null;

  const remainingPetId =
    petsSnap.docs.find((docSnap) => docSnap.id !== petId)?.id ?? null;

  const userData = userSnap.data() as { activePetId?: string | null } | undefined;
  const activePetId =
    typeof userData?.activePetId === "string" ? userData.activePetId : null;

  const batch = writeBatch(db);

  for (const alertDoc of alertsSnap.docs) {
    batch.delete(alertDoc.ref);
  }

  batch.delete(petRef);

  if (activePetId === petId) {
    batch.set(userRef, { activePetId: remainingPetId }, { merge: true });
  }

  await batch.commit();

  if (normalizedDeviceId) {
    const deviceRef = getDeviceRef(normalizedDeviceId);
    const deviceSnap = await getDoc(deviceRef);
    const device = deviceSnap.data() as DeviceDoc | undefined;

    if (
      deviceSnap.exists() &&
      device?.ownerUid === uid &&
      device?.petId === petId
    ) {
      await setDoc(
        deviceRef,
        {
          ownerUid: null,
          petId: null,
          updatedAtMs: Date.now(),
        },
        { merge: true }
      );
    }
  }

  return {
    removedPetId: petId,
    nextActivePetId: activePetId === petId ? remainingPetId : activePetId,
  };
}
