import { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, getDoc, updateDoc } from "firebase/firestore";

import { auth, db } from "../../config/firebase";
import { spacing } from "../../theme";
import AppText from "../../components/ui/AppText";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/ui/ScreenHeader";

export default function EditPetScreen({ route, navigation }: any) {
  const uid = auth.currentUser?.uid;
  const { petId } = route.params as { petId: string };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [colorPattern, setColorPattern] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [avatarBase64, setAvatarBase64] = useState<string>("");

  useEffect(() => {
    async function load() {
      if (!uid) return;

      try {
        const snap = await getDoc(doc(db, "users", uid, "pets", petId));
        const data = snap.data() as any;

        if (data) {
          setName(typeof data.name === "string" ? data.name : "");
          setBreed(typeof data.breed === "string" ? data.breed : "");
          setColorPattern(typeof data.colorPattern === "string" ? data.colorPattern : "");
          setDeviceId(typeof data.deviceId === "string" ? data.deviceId : "");
          setAvatarBase64(
            typeof data.avatarBase64 === "string" ? data.avatarBase64 : ""
          );
        }
      } catch (err) {
        console.log("Load pet failed", err);
        Alert.alert("Error", "Could not load pet details.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [uid, petId]);

  async function handleChangeAvatar() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

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

  async function save() {
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

      navigation.goBack();
    } catch (err) {
      console.log("Save pet failed", err);
      Alert.alert("Error", "Could not save pet changes.");
    } finally {
      setSaving(false);
    }
  }

  if (!uid) {
    return (
      <View style={styles.page}>
        <ScreenHeader title="Edit Pet" onBack={() => navigation.goBack()} />
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
      <ScreenHeader title="Edit Pet" onBack={() => navigation.goBack()} />

      <SafeAreaView edges={["bottom"]} style={styles.contentSafe}>
        <View style={styles.container}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <AppText style={styles.muted}>Loading…</AppText>
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
                    <Image
                      source={{ uri: avatarBase64 }}
                      style={styles.avatarImage}
                    />
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

              <View style={{ height: spacing.lg }} />

              <Button
                title={saving ? "Saving…" : "Save your changes"}
                onPress={save}
                disabled={saving || uploadingAvatar}
              />
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
    marginBottom: spacing.lg,
  },
  avatarTouchable: {
    position: "relative",
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  avatarFallback: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 40,
  },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
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