import { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "../../config/firebase";
import { spacing } from "../../theme";
import AppText from "../../components/ui/AppText";
import Button from "../../components/ui/Button";
import { resetPassword } from "../../services/authService";
import ScreenHeader from "../../components/ui/ScreenHeader";

type UserDoc = {
  name?: string;
  email?: string;
  phone?: string;
};

export default function ProfileScreen({ navigation }: any) {
  const uid = auth.currentUser?.uid;

  const [loading, setLoading] = useState(true);
  const [userDoc, setUserDoc] = useState<UserDoc>({
    name: "",
    email: auth.currentUser?.email ?? "",
    phone: ""
  });

  useEffect(() => {
    if (!uid) return;

    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = (snap.data() as UserDoc) ?? {};
      setUserDoc({
        name: typeof data.name === "string" ? data.name : "",
        email:
          typeof data.email === "string" && data.email.trim()
            ? data.email
            : auth.currentUser?.email ?? "",
        phone: typeof data.phone === "string" ? data.phone : ""
      });
      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  const displayName = useMemo(() => {
    const n = userDoc.name?.trim();
    return n ? n : "Unnamed User";
  }, [userDoc.name]);

  async function onResetPassword() {
    const email = auth.currentUser?.email || userDoc.email;
    if (!email) {
      Alert.alert("No email found", "Please log in again and try.");
      return;
    }

    try {
      await resetPassword(email);
      Alert.alert("Email sent", "Check your email for the password reset link.");
    } catch (err: any) {
      Alert.alert("Reset failed", err?.message ?? "Please try again.");
    }
  }

  if (!uid) {
    return (
      <View style={styles.page}>
        <ScreenHeader title="Profile" onBack={() => navigation.goBack()} />
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
      {/* Custom Header (handles top safe area internally) */}
      <ScreenHeader title="Profile" onBack={() => navigation.goBack()} />

      {/* Content safe area for bottom/home indicator */}
      <SafeAreaView edges={["bottom"]} style={styles.contentSafe}>
        <View style={styles.container}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <AppText style={styles.muted}>(Loading profile…)</AppText>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <AppText style={styles.name}>{displayName}</AppText>
                <View style={{ height: spacing.sm }} />
                <AppText style={styles.muted}>Email: {userDoc.email || "—"}</AppText>
                <AppText style={styles.muted}>Phone: {userDoc.phone || "—"}</AppText>
              </View>

              <View style={{ height: spacing.md }} />

              <Button
                title="Edit Profile"
                onPress={() => navigation.navigate("EditProfile")}
              />

              <View style={{ height: spacing.sm }} />

              <Button
                title="Reset Password"
                variant="secondary"
                onPress={onResetPassword}
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
    backgroundColor: "#ffffff" // green behind the header
  },
  contentSafe: {
    flex: 1
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg
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
  name: { fontSize: 20, fontWeight: "900", color: "#111" },
  muted: { color: "rgba(0,0,0,0.6)", marginTop: 2 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" }
});
