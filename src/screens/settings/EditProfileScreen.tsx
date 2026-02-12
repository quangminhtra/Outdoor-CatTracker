import { useEffect, useState } from "react";
import { View, StyleSheet, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, getDoc, updateDoc } from "firebase/firestore";

import { auth, db } from "../../config/firebase";
import { spacing } from "../../theme";
import AppText from "../../components/ui/AppText";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/ui/ScreenHeader";

export default function EditProfileScreen({ navigation }: any) {
  const uid = auth.currentUser?.uid;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!uid) return;

      const snap = await getDoc(doc(db, "users", uid));
      const data = snap.data() as any;

      if (data) {
        setName(typeof data.name === "string" ? data.name : "");
        setPhone(typeof data.phone === "string" ? data.phone : "");
      }

      setLoading(false);
    }
    load();
  }, [uid]);

  async function save() {
    if (!uid) return;

    setSaving(true);
    await updateDoc(doc(db, "users", uid), {
      name: name.trim(),
      phone: phone.trim()
    });
    setSaving(false);
    navigation.goBack();
  }

  if (!uid) {
    return (
      <View style={styles.page}>
        <ScreenHeader title="Edit Profile" onBack={() => navigation.goBack()} />
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
      <ScreenHeader title="Edit Profile" onBack={() => navigation.goBack()} />

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
                  placeholder="Your name"
                  placeholderTextColor="rgba(0,0,0,0.35)"
                  style={styles.input}
                />

                <View style={{ height: spacing.md }} />

                <AppText style={styles.label}>Phone</AppText>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone number"
                  placeholderTextColor="rgba(0,0,0,0.35)"
                  keyboardType="phone-pad"
                  style={styles.input}
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
  page: {
    flex: 1,
    backgroundColor: "#fff"
  },
  contentSafe: {
    flex: 1
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    backgroundColor: "#fff"
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  muted: {
    marginTop: spacing.sm,
    color: "rgba(0,0,0,0.6)"
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4
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
