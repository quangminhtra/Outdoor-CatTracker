import { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, db, storage } from "../../config/firebase";
import { spacing } from "../../theme";
import AppText from "../../components/ui/AppText";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/ui/ScreenHeader";

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return await response.blob();
}

export default function PetDetailsScreen({ route, navigation }: any) {
  const uid = auth.currentUser?.uid;
  const { petId } = route.params as { petId: string };

  const [pet, setPet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!uid) return;

    const refDoc = doc(db, "users", uid, "pets", petId);
    const unsub = onSnapshot(refDoc, (snap) => {
      setPet(snap.data() ?? null);
      setLoading(false);
    });

    return () => unsub();
  }, [uid, petId]);

  const geofenceText = useMemo(() => {
    const gf = pet?.geofence;
    if (!gf?.center) return "—";
    const r = typeof gf.radiusMeters === "number" ? gf.radiusMeters : 0;
    return `${gf.center.lat.toFixed(5)}, ${gf.center.lng.toFixed(5)} | ${Math.round(r)}m`;
  }, [pet]);

  async function setAsActive() {
    if (!uid) return;
    await updateDoc(doc(db, "users", uid), { activePetId: petId });
    Alert.alert("Active Pet Updated", `${pet?.name || "This pet"} is now active.`);
  }

  function openGeofencePicker() {
    const gf = pet?.geofence;

    navigation.navigate("GeofencePicker", {
      petId,
      center: gf?.center ?? { lat: 43.6577, lng: -79.3792 },
      radiusMeters: gf?.radiusMeters ?? 120,
    });
  }

  async function handleChangeAvatar() {
    if (!uid) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Please allow photo library access.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      setUploadingAvatar(true);

      const localUri = result.assets[0].uri;
      const blob = await uriToBlob(localUri);

      const avatarRef = ref(storage, `pet-avatars/${uid}/${petId}.jpg`);
      await uploadBytes(avatarRef, blob, { contentType: "image/jpeg" });

      const avatarUrl = await getDownloadURL(avatarRef);

      await updateDoc(doc(db, "users", uid, "pets", petId), {
        avatarUrl,
      });

      Alert.alert("Success", "Pet photo updated.");
    } catch (err: any) {
      Alert.alert("Upload Failed", err?.message ?? "Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (!uid) {
    return (
      <View style={styles.page}>
        <ScreenHeader title="Pet" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <AppText variant="subheading" style={{ color: "#111" }}>
            Not logged in
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScreenHeader title="Pet Profile" onBack={() => navigation.goBack()} />

      <SafeAreaView edges={["bottom"]} style={styles.contentSafe}>
        <View style={styles.container}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <AppText style={styles.muted}>(Loading pet…)</AppText>
            </View>
          ) : !pet ? (
            <View style={styles.center}>
              <AppText variant="subheading" style={{ color: "#111" }}>
                Pet not found
              </AppText>
            </View>
          ) : (
            <>
              <View style={styles.avatarSection}>
                {pet.avatarUrl ? (
                  <Image source={{ uri: pet.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <AppText style={styles.avatarFallbackText}>🐱</AppText>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.avatarButton}
                  onPress={handleChangeAvatar}
                  activeOpacity={0.85}
                  disabled={uploadingAvatar}
                >
                  <AppText style={styles.avatarButtonText}>
                    {uploadingAvatar
                      ? "Uploading..."
                      : pet.avatarUrl
                      ? "Change Photo"
                      : "Add Photo"}
                  </AppText>
                </TouchableOpacity>
              </View>

              <AppText variant="heading" style={styles.title}>
                {pet.name || "Pet"}
              </AppText>

              <View style={styles.card}>
                <AppText style={styles.line}>Device ID: {pet.deviceId || "—"}</AppText>
                <AppText style={styles.line}>Breed: {pet.breed || "—"}</AppText>
                <AppText style={styles.line}>
                  Color & Pattern: {pet.colorPattern || "—"}
                </AppText>
                <AppText style={styles.line}>Safe Zone: {geofenceText}</AppText>
              </View>

              <View style={{ height: spacing.lg }} />

              <Button
                title="Edit Pet"
                onPress={() => navigation.navigate("EditPet", { petId })}
              />

              <View style={{ height: spacing.sm }} />

              <Button
                title="Pick Home on Map"
                variant="secondary"
                onPress={openGeofencePicker}
              />

              <View style={{ height: spacing.sm }} />

              <Button title="Set as Active Pet" variant="secondary" onPress={setAsActive} />
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentSafe: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  muted: {
    marginTop: spacing.sm,
    color: "rgba(0,0,0,0.6)",
  },

  avatarSection: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 42,
  },
  avatarButton: {
    marginTop: spacing.sm,
    backgroundColor: "#5E8F3C",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatarButtonText: {
    color: "#fff",
    fontWeight: "800",
  },

  title: {
    color: "#111",
    marginBottom: spacing.md,
    textAlign: "center",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  line: {
    color: "#111",
    marginBottom: spacing.sm,
  },
});