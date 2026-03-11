import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db, storage } from "../config/firebase";

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return await response.blob();
}

export async function pickPetAvatar(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Media library permission is required.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  return result.assets[0].uri;
}

export async function uploadPetAvatar(
  uid: string,
  petId: string,
  localUri: string
): Promise<string> {
  const blob = await uriToBlob(localUri);

  const avatarRef = ref(storage, `pet-avatars/${uid}/${petId}.jpg`);
  await uploadBytes(avatarRef, blob, {
    contentType: "image/jpeg",
  });

  const downloadUrl = await getDownloadURL(avatarRef);
  return downloadUrl;
}

export async function savePetAvatarUrl(
  uid: string,
  petId: string,
  avatarUrl: string
): Promise<void> {
  const petRef = doc(db, "users", uid, "pets", petId);
  await updateDoc(petRef, { avatarUrl });
}

export async function pickUploadAndSavePetAvatar(
  uid: string,
  petId: string
): Promise<string | null> {
  const localUri = await pickPetAvatar();
  if (!localUri) return null;

  const avatarUrl = await uploadPetAvatar(uid, petId, localUri);
  await savePetAvatarUrl(uid, petId, avatarUrl);

  return avatarUrl;
}