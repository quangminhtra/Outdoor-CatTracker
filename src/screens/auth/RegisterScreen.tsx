// src/screens/auth/RegisterScreen.tsx
import React, { useState } from "react";
import { View, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "../../components/ui/AppText";
import { registerUser } from "../../services/authService";
import { spacing } from "../../theme";

const GREEN = "#88B84A";
const ORANGE = "#F4A53A";

export default function RegisterScreen({ navigation }: any) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async () => {
    setError("");

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await registerUser(email.trim(), password);
      // next step: save fullName into user doc (I’ll show you after this)
    } catch (err: any) {
      setError(err?.message ?? "Registration failed.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        <AppText style={styles.h1}>Sign Up</AppText>

        <AppText style={styles.label}>Full name</AppText>
        <TextInput
          placeholder="Enter your full name..."
          placeholderTextColor="rgba(0,0,0,0.35)"
          value={fullName}
          onChangeText={setFullName}
          style={styles.input}
        />

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

        <AppText style={styles.label}>Password</AppText>
        <TextInput
          placeholder="Enter your password..."
          placeholderTextColor="rgba(0,0,0,0.35)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />

        <AppText style={styles.label}>Confirmed Password</AppText>
        <TextInput
          placeholder="Re-enter your password..."
          placeholderTextColor="rgba(0,0,0,0.35)"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={styles.input}
        />

        {error ? <AppText style={styles.error}>{error}</AppText> : null}

        <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={handleRegister}>
          <AppText style={styles.ctaText}>SIGN UP</AppText>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate("Login")}
          style={styles.linkRow}
        >
          <AppText style={styles.linkMuted}>Already have an account? </AppText>
          <AppText style={styles.linkStrong}>Login</AppText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN },
  container: { flex: 1, padding: spacing.lg },
  h1: {
    fontSize: 34,
    fontWeight: "900",
    color: "#111",
    marginTop: spacing.xl,
    marginBottom: spacing.lg
  },
  label: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111",
    marginTop: spacing.md,
    marginBottom: 8
  },
  input: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#111"
  },
  error: {
    marginTop: spacing.sm,
    color: "#C62828",
    fontWeight: "800"
  },
  cta: {
    marginTop: spacing.xl,
    height: 52,
    borderRadius: 18,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingHorizontal: 48
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  linkRow: { marginTop: spacing.lg, alignSelf: "center", flexDirection: "row" },
  linkMuted: { color: "rgba(0,0,0,0.75)" },
  linkStrong: { color: "#111", fontWeight: "900" }
});
