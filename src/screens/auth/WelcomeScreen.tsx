import React from "react";
import { View, StyleSheet, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AppText from "../../components/ui/AppText";
import { spacing } from "../../theme";

const GREEN = "#88B84A";
const DEEP_GREEN = "#2B4B1F";
const ORANGE = "#F4A53A";
const TAUPE = "#D4CDC3";
const ESPRESSO = "#4A342A";

export default function WelcomeScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topDecor}>
        <View style={styles.heroGlow} />
        <Icon name="pine-tree" size={38} color="rgba(43,75,31,0.55)" style={styles.treeLeft} />
        <Icon name="tree-outline" size={38} color="rgba(255,248,230,0.62)" style={styles.treeRight} />
        <Icon name="home-city-outline" size={34} color="rgba(43,75,31,0.46)" style={styles.cityLeft} />
        <Icon name="office-building-outline" size={30} color="rgba(43,75,31,0.34)" style={styles.cityRight} />

        <View style={styles.heroContent}>
          <View style={styles.logoBadge}>
            <View style={styles.logoBadgeInner}>
              <View style={styles.compassLabels}>
                <AppText style={[styles.compassLabel, styles.compassNorth]}>N</AppText>
                <AppText style={[styles.compassLabel, styles.compassEast]}>E</AppText>
                <AppText style={[styles.compassLabel, styles.compassSouth]}>S</AppText>
                <AppText style={[styles.compassLabel, styles.compassWest]}>W</AppText>
              </View>
              <View style={styles.logoCompassRing}>
                <Image
                  source={require("../../../assets/icon-cat.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <AppText style={styles.h1}>Welcome Back</AppText>
        <AppText style={styles.h2}>Outdoor Cat Tracker</AppText>

        <AppText style={styles.p}>
          Live tracking built for curious outdoor cats. Keep an eye on homebase, recent movement,
          and alerts with a cleaner view of each pet.
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
  safe: { flex: 1, backgroundColor: "#FFF8E6" },
  topDecor: {
    backgroundColor: GREEN,
    minHeight: 320,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    justifyContent: "center",
  },
  heroGlow: {
    position: "absolute",
    alignSelf: "center",
    top: 58,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,248,230,0.14)",
  },
  heroContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  treeLeft: {
    position: "absolute",
    left: 22,
    bottom: 28,
  },
  treeRight: {
    position: "absolute",
    right: 24,
    top: 34,
  },
  cityLeft: {
    position: "absolute",
    left: 48,
    top: 62,
  },
  cityRight: {
    position: "absolute",
    right: 40,
    bottom: 44,
  },
  body: {
    flex: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: "center",
  },
  logoBadge: {
    width: 186,
    height: 186,
    backgroundColor: TAUPE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
    borderWidth: 4,
    borderColor: ESPRESSO,
    borderRadius: 36,
    transform: [{ rotate: "45deg" }],
  },
  logoBadgeInner: {
    width: 186,
    height: 186,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-45deg" }],
  },
  compassLabels: {
    position: "absolute",
    width: 186,
    height: 186,
    alignItems: "center",
    justifyContent: "center",
  },
  logoCompassRing: {
    width: 146,
    height: 146,
    borderRadius: 73,
    borderWidth: 5,
    borderColor: ESPRESSO,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    backgroundColor: "rgba(255,248,230,0.24)",
  },
  compassLabel: {
    position: "absolute",
    fontSize: 20,
    fontWeight: "900",
    zIndex: 2,
  },
  compassNorth: {
    top: 10,
    color: "#FFFFFF",
  },
  compassEast: {
    right: 18,
    top: "50%",
    marginTop: -10,
    color: "#FFFFFF",
  },
  compassSouth: {
    bottom: 10,
    color: "#FFFFFF",
  },
  compassWest: {
    left: 12,
    top: "50%",
    marginTop: -10,
    color: "#FFFFFF",
  },
  logo: {
    width: 116,
    height: 116,
    transform: [{ translateX: 8 }],
  },
  h1: { fontSize: 22, fontWeight: "800", color: DEEP_GREEN, marginTop: spacing.lg },
  h2: {
    fontSize: 32,
    fontWeight: "900",
    color: DEEP_GREEN,
    marginTop: 6,
    textAlign: "center",
  },
  p: {
    marginTop: spacing.md,
    fontSize: 15,
    lineHeight: 23,
    color: "rgba(0,0,0,0.65)",
    maxWidth: 330,
    textAlign: "center",
  },
  cta: {
    marginTop: spacing.xl,
    height: 56,
    borderRadius: 20,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  ctaText: { fontSize: 16, fontWeight: "900", color: "#fff" },
});
