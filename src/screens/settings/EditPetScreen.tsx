import { useEffect, useState } from "react";
import { View, StyleSheet, TextInput, ActivityIndicator } from "react-native";
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

  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [colorPattern, setColorPattern] = useState("");
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    async function load() {
      if (!uid) return;

      const snap = await getDoc(doc(db, "users", uid, "pets", petId));
      const data = snap.data() as any;

      if (data) {
        setName(typeof data.name === "string" ? data.name : "");
        setBreed(typeof data.breed === "string" ? data.breed : "");
        setColorPattern(typeof data.colorPattern === "string" ? data.colorPattern : "");
        setDeviceId(typeof data.deviceId === "string" ? data.deviceId : "");
      }

      setLoading(false);
    }
    load();
  }, [uid, petId]);

  async function save() {
    if (!uid) return;

    setSaving(true);

    await updateDoc(doc(db, "users", uid, "pets", petId), {
      name: name.trim(),
      breed: breed.trim(),
      colorPattern: colorPattern.trim(),
      deviceId: deviceId.trim()
    });

    setSaving(false);
    navigation.goBack();
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
              <AppText style={styles.muted}>(Loading…)</AppText>
            </View>
          ) : (
            <>
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
                disabled={saving}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const GREEN = "#5E8F3C";

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },
  contentSafe: { flex: 1 },

  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { marginTop: spacing.sm, color: "rgba(0,0,0,0.6)" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3
  },
  label: {
    color: "#111",
    fontWeight: "800",
    marginBottom: spacing.sm
  },
  input: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: "#111",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)"
  }
});
