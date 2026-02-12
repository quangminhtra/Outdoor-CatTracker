import React, { useState } from "react";
import { View, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "../../components/ui/AppText";
import { resetPassword } from "../../services/authService";
import { spacing } from "../../theme";

const GREEN = "#88B84A";
const ORANGE = "#F4A53A";

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent">("idle");
  const [error, setError] = useState("");

  async function onSend() {
    setError("");
    try {
      await resetPassword(email);
      setStatus("sent");
    } catch (err: any) {
      setError(err?.message ?? "Could not send reset email.");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        <AppText style={styles.h1}>Reset Password</AppText>

        <AppText style={styles.desc}>
          Enter your email and we’ll send you a reset link.
        </AppText>

        <AppText style={styles.label}>E-mail</AppText>
        <TextInput
          placeholder="Enter your email..."
          placeholderTextColor="rgba(0,0,0,0.35)"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />

        {error ? <AppText style={styles.error}>{error}</AppText> : null}

        {status === "sent" ? (
          <AppText style={styles.sent}>
            Reset email sent. Check your inbox (or Junk).
          </AppText>
        ) : null}

        <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={onSend}>
          <AppText style={styles.ctaText}>SEND LINK</AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ marginTop: spacing.lg, alignSelf: "center" }}
          onPress={() => navigation.goBack()}
        >
          <AppText style={{ fontWeight: "900", color: "#111" }}>Back to Login</AppText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN },
  container: { flex: 1, padding: spacing.lg, justifyContent: "center" },

  h1: { fontSize: 30, fontWeight: "900", color: "#111", marginBottom: spacing.sm },
  desc: { color: "rgba(0,0,0,0.75)", marginBottom: spacing.lg, fontWeight: "700" },

  label: { fontSize: 14, fontWeight: "800", color: "#111", marginBottom: 8 },
  input: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#111"
  },

  error: { marginTop: spacing.sm, color: "#C62828", fontWeight: "800" },
  sent: { marginTop: spacing.sm, color: "#111", fontWeight: "800" },

  cta: {
    marginTop: spacing.lg,
    height: 52,
    borderRadius: 18,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingHorizontal: 40
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "900" }
});
