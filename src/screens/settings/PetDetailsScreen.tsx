import { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";

import { auth, db } from "../../config/firebase";
import { spacing } from "../../theme";
import AppText from "../../components/ui/AppText";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/ui/ScreenHeader";

type PetDoc = {
  name?: string;
  breed?: string;
  colorPattern?: string;
  deviceId?: string;
  avatarBase64?: string;
  geofence?: {
    center?: { lat?: number; lng?: number };
    radiusMeters?: number;
  };
};

export default function PetDetailsScreen({ route, navigation }: any) {
  const uid = auth.currentUser?.uid;
  const { petId } = route.params as { petId: string };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [colorPattern, setColorPattern] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [avatarBase64, setAvatarBase64] = useState("");

  const [geofenceText, setGeofenceText] = useState("—");

  useEffect(() => {
    if (!uid) return;

    const refDoc = doc(db, "users", uid, "pets", petId);
    const unsub = onSnapshot(refDoc, (snap) => {
      const data = (snap.data() as PetDoc) ?? {};

      setName(typeof data.name === "string" ? data.name : "");
      setBreed(typeof data.breed === "string" ? data.breed : "");
      setColorPattern(typeof data.colorPattern === "string" ? data.colorPattern : "");
      setDeviceId(typeof data.deviceId === "string" ? data.deviceId : "");
      setAvatarBase64(typeof data.avatarBase64 === "string" ? data.avatarBase64 : "");

      const lat = data.geofence?.center?.lat;
      const lng = data.geofence?.center?.lng;
      const radius = data.geofence?.radiusMeters;

      if (
        typeof lat === "number" &&
        typeof lng === "number" &&
        typeof radius === "number"
      ) {
        setGeofenceText(`${lat.toFixed(5)}, ${lng.toFixed(5)} | ${Math.round(radius)}m`);
      } else {
        setGeofenceText("—");
      }

      setLoading(false);
    });

    return () => unsub();
  }, [uid, petId]);

  const displayName = useMemo(() => {
    const trimmed = name.trim();
    return trimmed || "Pet";
  }, [name]);

  async function handleChangeAvatar() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Permission Required", "Please allow photo access first.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (result.canceled) return;

      const pickedBase64 = result.assets?.[0]?.base64;
      if (!pickedBase64) {
        Alert.alert("Error", "Could not read selected image.");
        return;
      }

      const imageData = `data:image/jpeg;base64,${pickedBase64}`;

      setUploadingAvatar(true);

      if (uid) {
        await updateDoc(doc(db, "users", uid, "pets", petId), {
          avatarBase64: imageData,
        });
      }

      setAvatarBase64(imageData);
    } catch (err) {
      console.log("Avatar update failed", err);
      Alert.alert("Error", "Could not update pet avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function savePetDetails() {
    if (!uid) return;

    const trimmedName = name.trim();
    const trimmedBreed = breed.trim();
    const trimmedColorPattern = colorPattern.trim();
    const trimmedDeviceId = deviceId.trim();

    if (!trimmedName) {
      Alert.alert("Missing Name", "Please enter a pet name.");
      return;
    }

    try {
      setSaving(true);

      await updateDoc(doc(db, "users", uid, "pets", petId), {
        name: trimmedName,
        breed: trimmedBreed,
        colorPattern: trimmedColorPattern,
        deviceId: trimmedDeviceId,
      });

      Alert.alert("Saved", "Pet profile updated.");
    } catch (err) {
      console.log("Save pet failed", err);
      Alert.alert("Error", "Could not save pet changes.");
    } finally {
      setSaving(false);
    }
  }

  async function setAsActive() {
    if (!uid) return;

    try {
      await updateDoc(doc(db, "users", uid), { activePetId: petId });
      Alert.alert("Active Pet Updated", `${displayName} is now active.`);
    } catch (err) {
      console.log("Set active pet failed", err);
      Alert.alert("Error", "Could not set this pet as active.");
    }
  }

  function openGeofencePicker() {
    navigation.navigate("GeofencePicker", { petId });
  }

  if (!uid) {
    return (
      <View style={styles.page}>
        <ScreenHeader title="Pet Profile" onBack={() => navigation.goBack()} />
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
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <AppText style={styles.muted}>Loading pet…</AppText>
            </View>
          ) : (
            <>
              <View style={styles.avatarSection}>
                <TouchableOpacity
                  onPress={handleChangeAvatar}
                  activeOpacity={0.85}
                  style={styles.avatarTouchable}
                  disabled={uploadingAvatar}
                >
                  {avatarBase64 ? (
                    <Image source={{ uri: avatarBase64 }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <AppText style={styles.avatarFallbackText}>🐱</AppText>
                    </View>
                  )}

                  {uploadingAvatar ? (
                    <View style={styles.avatarOverlay}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  ) : null}
                </TouchableOpacity>

                <AppText style={styles.petTitle}>{displayName}</AppText>

                <TouchableOpacity
                  style={styles.avatarButton}
                  onPress={handleChangeAvatar}
                  activeOpacity={0.85}
                  disabled={uploadingAvatar}
                >
                  <AppText style={styles.avatarButtonText}>
                    {uploadingAvatar
                      ? "Uploading..."
                      : avatarBase64
                      ? "Change Photo"
                      : "Add Photo"}
                  </AppText>
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <AppText style={styles.label}>Name</AppText>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  placeholder="Whiskers"
                  placeholderTextColor="rgba(0,0,0,0.35)"
                />

                <View style={{ height: spacing.md }} />

                <AppText style={styles.label}>Breed</AppText>
                <TextInput
                  value={breed}
                  onChangeText={setBreed}
                  style={styles.input}
                  placeholder="Breed"
                  placeholderTextColor="rgba(0,0,0,0.35)"
                />

                <View style={{ height: spacing.md }} />

                <AppText style={styles.label}>Color & Pattern</AppText>
                <TextInput
                  value={colorPattern}
                  onChangeText={setColorPattern}
                  style={styles.input}
                  placeholder="e.g., Orange tabby"
                  placeholderTextColor="rgba(0,0,0,0.35)"
                />

                <View style={{ height: spacing.md }} />

                <AppText style={styles.label}>Device ID</AppText>
                <TextInput
                  value={deviceId}
                  onChangeText={setDeviceId}
                  style={styles.input}
                  placeholder="GPS module ID"
                  placeholderTextColor="rgba(0,0,0,0.35)"
                  autoCapitalize="characters"
                />
              </View>

              <View style={{ height: spacing.md }} />

              <View style={styles.card}>
                <AppText style={styles.label}>Safe Zone</AppText>
                <AppText style={styles.valueText}>{geofenceText}</AppText>
              </View>

              <View style={{ height: spacing.lg }} />

              <Button
                title={saving ? "Saving…" : "Save Changes"}
                onPress={savePetDetails}
                disabled={saving || uploadingAvatar}
              />

              <View style={{ height: spacing.sm }} />

              <Button
                title="Pick Home on Map"
                variant="secondary"
                onPress={openGeofencePicker}
              />

              <View style={{ height: spacing.sm }} />

              <Button
                title="Set as Active Pet"
                variant="secondary"
                onPress={setAsActive}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const GREEN = "#5E8F3C";

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentSafe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 250,
  },
  muted: {
    marginTop: spacing.sm,
    color: "rgba(0,0,0,0.6)",
  },

  avatarSection: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  avatarTouchable: {
    position: "relative",
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
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  petTitle: {
    marginTop: spacing.sm,
    fontSize: 22,
    fontWeight: "900",
    color: "#111",
  },
  avatarButton: {
    marginTop: spacing.sm,
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatarButtonText: {
    color: "#fff",
    fontWeight: "800",
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
  label: {
    color: "#111",
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  valueText: {
    color: "#111",
  },
  input: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: "#111",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
});