// src/screens/auth/LoginScreen.tsx
import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "../../components/ui/AppText";
import { loginUser } from "../../services/authService";
import { spacing } from "../../theme";

const GREEN = "#88B84A";
const ORANGE = "#F4A53A";

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    try {
      await loginUser(email.trim(), password);
    } catch (err: any) {
      setError(err?.message ?? "Login failed.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <AppText style={styles.h1}>Login</AppText>

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

            {error ? <AppText style={styles.error}>{error}</AppText> : null}

            <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={handleLogin}>
              <AppText style={styles.ctaText}>LOGIN</AppText>
            </TouchableOpacity>

            {/* Optional (next step): Forgot password link */}
             <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate("ForgotPassword")}
              style={styles.forgotRow}
            >
              <AppText style={styles.forgotText}>Forgot your Password?</AppText>
            </TouchableOpacity> 

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate("Register")}
              style={styles.linkRow}
            >
              <AppText style={styles.linkMuted}>Don’t have an account? </AppText>
              <AppText style={styles.linkStrong}>Sign up</AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN },
  flex: { flex: 1 },

  // Centers content vertically so there isn't a huge bottom gap
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg
  },

  // Keeps everything grouped (so it doesn't stretch weirdly)
  card: {
    width: "100%"
  },

  h1: {
    fontSize: 34,
    fontWeight: "900",
    color: "#111",
    marginBottom: spacing.lg
    // removed marginTop so it doesn't sit too high
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

  forgotRow: { marginTop: spacing.md, alignSelf: "center" },
  forgotText: { color: "rgba(0,0,0,0.75)", fontWeight: "800" },

  linkRow: { marginTop: spacing.lg, alignSelf: "center", flexDirection: "row" },
  linkMuted: { color: "rgba(0,0,0,0.75)" },
  linkStrong: { color: "#111", fontWeight: "900" }
});
