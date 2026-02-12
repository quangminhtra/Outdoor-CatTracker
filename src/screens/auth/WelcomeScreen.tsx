// src/screens/auth/WelcomeScreen.tsx
import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "../../components/ui/AppText";
import { spacing } from "../../theme";

const GREEN = "#88B84A"; // adjust if you already have a brand green
const ORANGE = "#F4A53A";

export default function WelcomeScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topDecor}>
        {/* Placeholder blocks - later replace with your real images */}
        <View style={styles.decorGrid}>
          <View style={styles.decorBox} />
          <View style={[styles.decorBox, styles.decorBox2]} />
          <View style={[styles.decorBox, styles.decorBox3]} />
          <View style={[styles.decorBox, styles.decorBox4]} />
        </View>
      </View>

      <View style={styles.body}>
        <AppText style={styles.h1}>Welcome to our Project</AppText>
        <AppText style={styles.h2}>Outdoor Cat Tracker</AppText>

        <AppText style={styles.p}>
          Elevate your pet’s care. From GPS tracking to managing their places, our app makes it
          simple.
        </AppText>

        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("Login")}
        >
          <AppText style={styles.ctaText}>Get Started</AppText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },

  topDecor: {
    backgroundColor: "#F6D64B",
    height: 260,
    padding: spacing.lg
  },

  decorGrid: {
    flex: 1,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center"
  },

  decorBox: {
    position: "absolute",
    width: 86,
    height: 86,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.08)"
  },
  decorBox2: { top: 18, left: 18, backgroundColor: "rgba(0,0,0,0.12)" },
  decorBox3: { top: 18, right: 18, backgroundColor: "rgba(0,0,0,0.10)" },
  decorBox4: { bottom: 18, left: 18, backgroundColor: "rgba(0,0,0,0.10)" },

  body: {
    flex: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl
  },

  h1: { fontSize: 22, fontWeight: "800", color: "#2b4b1f" },
  h2: { fontSize: 28, fontWeight: "900", color: "#2b4b1f", marginTop: 6 },

  p: {
    marginTop: spacing.md,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(0,0,0,0.65)",
    maxWidth: 320
  },

  cta: {
    marginTop: spacing.xl,
    height: 54,
    borderRadius: 18,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingHorizontal: 32
  },
  ctaText: { fontSize: 16, fontWeight: "900", color: "#fff" }
});
