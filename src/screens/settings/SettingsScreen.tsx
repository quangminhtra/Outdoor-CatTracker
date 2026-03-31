import { useEffect, useState } from "react";
import { View, StyleSheet, Switch, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";

import { auth, db } from "../../config/firebase";
import { colors, spacing } from "../../theme";
import { useUserLocation } from "../../hooks/useUserLocation";

import AppText from "../../components/ui/AppText";
import Button from "../../components/ui/Button";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { updateHomebaseForAllPets } from "../../services/petAccountService";

type Geofence = {
  center: { lat: number; lng: number };
  radiusMeters: number;
};

type Prefs = {
  notifyExit: boolean;
  notifyReturn: boolean;
  masterEnabled?: boolean;
  lastNotifyExit?: boolean;
  lastNotifyReturn?: boolean;
};

export default function SettingsScreen({ navigation }: any) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const uid = auth.currentUser?.uid;
  const { location: userLocation } = useUserLocation();

  const [userName, setUserName] = useState<string>("-");
  const [userEmail, setUserEmail] = useState<string>(auth.currentUser?.email ?? "-");

  const [petCount, setPetCount] = useState<number>(0);
  const [activePetId, setActivePetId] = useState<string | null>(null);

  const [petName, setPetName] = useState<string>("-");

  const [geofence, setGeofence] = useState<Geofence>({
    center: { lat: 43.6577, lng: -79.3792 },
    radiusMeters: 120,
  });
  const [sharedGeofence, setSharedGeofence] = useState<Geofence | null>(null);

  const [prefs, setPrefs] = useState<Prefs>({
    notifyExit: true,
    notifyReturn: true,
    masterEnabled: true,
    lastNotifyExit: true,
    lastNotifyReturn: true,
  });

  useEffect(() => {
    if (!uid) return;

    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as any;
      if (!data) return;

      setUserName(typeof data.name === "string" && data.name.trim() ? data.name : "-");
      setUserEmail(
        typeof data.email === "string" && data.email.trim()
          ? data.email
          : auth.currentUser?.email ?? "-"
      );

      if (typeof data.activePetId === "string") {
        setActivePetId(data.activePetId);
      } else {
        setActivePetId(null);
      }

      const shared = data?.sharedGeofence;
      if (
        shared?.center &&
        typeof shared.center.lat === "number" &&
        typeof shared.center.lng === "number" &&
        typeof shared.radiusMeters === "number"
      ) {
        const nextShared = {
          center: { lat: shared.center.lat, lng: shared.center.lng },
          radiusMeters: shared.radiusMeters,
        };
        setSharedGeofence(nextShared);
        setGeofence(nextShared);
      } else {
        setSharedGeofence(null);
      }
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    const petsRef = collection(db, "users", uid, "pets");
    const unsub = onSnapshot(petsRef, (snap) => {
      setPetCount(snap.size);
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid || !activePetId) {
      setPetName("-");
      setGeofence({
        center: { lat: 43.6577, lng: -79.3792 },
        radiusMeters: 120,
      });
      setPrefs({
        notifyExit: true,
        notifyReturn: true,
        masterEnabled: true,
        lastNotifyExit: true,
        lastNotifyReturn: true,
      });
      return;
    }

    const petRef = doc(db, "users", uid, "pets", activePetId);
    const unsub = onSnapshot(petRef, (snap) => {
      const data = snap.data() as any;
      if (!data) return;

      if (typeof data.name === "string") setPetName(data.name);

      const gf = data?.geofence;
      if (
        !sharedGeofence &&
        gf &&
        gf.center &&
        typeof gf.center.lat === "number" &&
        typeof gf.center.lng === "number" &&
        typeof gf.radiusMeters === "number"
      ) {
        setGeofence({
          center: { lat: gf.center.lat, lng: gf.center.lng },
          radiusMeters: gf.radiusMeters,
        });
      }

      const p = data?.prefs;
      if (p && typeof p.notifyExit === "boolean" && typeof p.notifyReturn === "boolean") {
        setPrefs({
          notifyExit: p.notifyExit,
          notifyReturn: p.notifyReturn,
          masterEnabled: typeof p.masterEnabled === "boolean" ? p.masterEnabled : undefined,
          lastNotifyExit: typeof p.lastNotifyExit === "boolean" ? p.lastNotifyExit : undefined,
          lastNotifyReturn:
            typeof p.lastNotifyReturn === "boolean" ? p.lastNotifyReturn : undefined,
        });
      }
    });

    return () => unsub();
  }, [uid, activePetId, sharedGeofence]);

  async function setHomeToMyLocation() {
    if (!uid || !activePetId || !userLocation) return;

    const nextGeofence = {
      center: {
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      },
      radiusMeters: geofence.radiusMeters,
    };

    setSharedGeofence(nextGeofence);
    setGeofence(nextGeofence);
    await updateHomebaseForAllPets(uid, {
      center: nextGeofence.center,
      radiusMeters: nextGeofence.radiusMeters,
    });
  }

  async function updateRadius(radiusMeters: number) {
    if (!uid || !activePetId) return;

    const nextGeofence = {
      center: geofence.center,
      radiusMeters,
    };

    setSharedGeofence(nextGeofence);
    setGeofence(nextGeofence);
    await updateHomebaseForAllPets(uid, {
      center: nextGeofence.center,
      radiusMeters,
    });
  }

  const masterEnabled = !!(prefs.notifyExit || prefs.notifyReturn);

  async function setMasterNotifications(enabled: boolean) {
    if (!uid || !activePetId) return;

    const petRef = doc(db, "users", uid, "pets", activePetId);

    if (!enabled) {
      await updateDoc(petRef, {
        "prefs.masterEnabled": false,
        "prefs.lastNotifyExit": prefs.notifyExit,
        "prefs.lastNotifyReturn": prefs.notifyReturn,
        "prefs.notifyExit": false,
        "prefs.notifyReturn": false,
      });

      setPrefs((prev) => ({
        ...prev,
        masterEnabled: false,
        lastNotifyExit: prev.notifyExit,
        lastNotifyReturn: prev.notifyReturn,
        notifyExit: false,
        notifyReturn: false,
      }));

      return;
    }

    const restoreExit = typeof prefs.lastNotifyExit === "boolean" ? prefs.lastNotifyExit : true;
    const restoreReturn =
      typeof prefs.lastNotifyReturn === "boolean" ? prefs.lastNotifyReturn : true;

    await updateDoc(petRef, {
      "prefs.masterEnabled": true,
      "prefs.notifyExit": restoreExit,
      "prefs.notifyReturn": restoreReturn,
    });

    setPrefs((prev) => ({
      ...prev,
      masterEnabled: true,
      notifyExit: restoreExit,
      notifyReturn: restoreReturn,
    }));
  }

  async function toggleAdvanced(key: "notifyExit" | "notifyReturn", value: boolean) {
    if (!uid || !activePetId) return;

    const petRef = doc(db, "users", uid, "pets", activePetId);

    const next: Prefs = { ...prefs, [key]: value };
    const nextMaster = !!(next.notifyExit || next.notifyReturn);

    setPrefs({
      ...next,
      masterEnabled: nextMaster,
      lastNotifyExit: next.notifyExit,
      lastNotifyReturn: next.notifyReturn,
    });

    await updateDoc(petRef, {
      [`prefs.${key}`]: value,
      "prefs.masterEnabled": nextMaster,
      "prefs.lastNotifyExit": next.notifyExit,
      "prefs.lastNotifyReturn": next.notifyReturn,
    });
  }

  function openMapPicker() {
    if (!activePetId) return;

    navigation.navigate("GeofencePicker", {
      petId: activePetId,
      center: geofence.center,
      radiusMeters: geofence.radiusMeters,
    });
  }

  function onProfilePress() {
    navigation.navigate("Profile");
  }

  function onManagePetsPress() {
    navigation.navigate("ManagePets");
  }

  function onAddPetPress() {
    navigation.navigate("VerifyPetId");
  }

  function onLogout() {
    auth.signOut();
  }

  const hasActivePet = !!activePetId;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.iconCircle}>
            <Icon name="paw" size={24} color="#333" />
          </View>
          <AppText variant="heading" style={styles.headerTitle}>
            Settings
          </AppText>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="heading" style={styles.sectionTitle}>
          Profile
        </AppText>

        <TouchableOpacity style={styles.rowCard} onPress={onProfilePress} activeOpacity={0.85}>
          <View style={styles.rowLeft}>
            <View style={styles.smallIconCircle}>
              <Icon name="account" size={24} color="#333" />
            </View>
            <View>
              <AppText style={styles.rowTitle}>{userName}</AppText>
              <AppText color="textSecondary" style={styles.rowSub}>
                {userEmail}
              </AppText>
            </View>
          </View>
          <Icon name="chevron-right" size={24} color="rgba(0,0,0,0.45)" />
        </TouchableOpacity>

        <AppText variant="heading" style={styles.sectionTitle}>
          Pet Profiles
        </AppText>

        <TouchableOpacity
          style={styles.rowCard}
          onPress={onManagePetsPress}
          activeOpacity={0.85}
        >
          <View style={styles.rowLeft}>
            <View style={styles.smallIconCircle}>
              <Icon name="cat" size={24} color="#333" />
            </View>
            <View>
              <AppText style={styles.rowTitle}>Manage pets</AppText>
              <AppText color="textSecondary" style={styles.rowSub}>
                {petCount} pet{petCount === 1 ? "" : "s"} registered
              </AppText>
              {activePetId ? (
                <AppText color="textSecondary" style={styles.rowSub}>
                  Active: {petName}
                </AppText>
              ) : null}
            </View>
          </View>

          <Icon name="chevron-right" size={24} color="rgba(0,0,0,0.45)" />
        </TouchableOpacity>

        <AppText variant="heading" style={styles.sectionTitle}>
          Safe Zone
        </AppText>

        <View style={styles.card}>
          <AppText color="textSecondary">Active Pet: {petName || "-"}</AppText>

          <View style={{ height: spacing.sm }} />

          <AppText color="textSecondary">
            Home: {geofence.center.lat.toFixed(5)}, {geofence.center.lng.toFixed(5)}
          </AppText>

          <View style={{ height: spacing.md }} />

          <Button
            title="Set Home to My Location"
            onPress={setHomeToMyLocation}
            disabled={!hasActivePet}
          />
          <View style={{ height: spacing.sm }} />
          <Button
            title="Pick Home on Map"
            variant="secondary"
            onPress={openMapPicker}
            disabled={!hasActivePet}
          />

          <View style={{ height: spacing.lg }} />

          <AppText color="textSecondary">
            Radius: {Math.round(geofence.radiusMeters)} m
          </AppText>

          <Slider
            minimumValue={50}
            maximumValue={500}
            step={10}
            value={geofence.radiusMeters}
            onSlidingComplete={updateRadius}
            disabled={!hasActivePet}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={"rgba(0,0,0,0.15)"}
            thumbTintColor={colors.accent}
          />
        </View>

        <AppText variant="heading" style={styles.sectionTitle}>
          Notifications
        </AppText>

        <View style={styles.rowCard}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <AppText style={styles.rowTitle}>Enable notifications</AppText>
            <AppText color="textSecondary" style={styles.rowSub}>
              Turn on/off alerts for exit and return
            </AppText>
          </View>
          <Switch
            value={masterEnabled}
            onValueChange={setMasterNotifications}
            disabled={!hasActivePet}
          />
        </View>

        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => setAdvancedOpen((v) => !v)}
          activeOpacity={0.85}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <AppText variant="heading" style={styles.advancedText}>
              Advanced
            </AppText>

            <Icon
              name={advancedOpen ? "chevron-up" : "chevron-down"}
              size={22}
              color="white"
            />
          </View>
        </TouchableOpacity>

        {advancedOpen ? (
          <>
            <View style={styles.rowCard}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <AppText style={styles.rowTitle}>Notify on exit</AppText>
                <AppText color="textSecondary" style={styles.rowSub}>
                  Receive alerts when your cat leaves the safe zone
                </AppText>
              </View>
              <Switch
                value={prefs.notifyExit}
                onValueChange={(v) => toggleAdvanced("notifyExit", v)}
                disabled={!hasActivePet}
              />
            </View>

            <View style={styles.rowCard}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <AppText style={styles.rowTitle}>Notify on return</AppText>
                <AppText color="textSecondary" style={styles.rowSub}>
                  Receive alerts when your cat returns to the safe zone
                </AppText>
              </View>
              <Switch
                value={prefs.notifyReturn}
                onValueChange={(v) => toggleAdvanced("notifyReturn", v)}
                disabled={!hasActivePet}
              />
            </View>
          </>
        ) : null}

        <AppText variant="heading" style={styles.sectionTitle}>
          Add More Pets
        </AppText>

        <View style={styles.yellowCard}>
          <View style={styles.yellowTopRow}>
            <View>
              <AppText style={styles.yellowTitle}>Add another tracker-linked pet</AppText>
              <AppText style={styles.yellowSubtitle}>Verify first, then build the pet profile.</AppText>
            </View>
            <View style={styles.yellowPawCircle}>
              <Icon name="paw" size={22} color="#2b4b1f" />
            </View>
          </View>
          <AppText style={styles.yellowLine}>
            Every new pet must be verified with a device ID in the format `RAK-001`.
          </AppText>
          <AppText style={styles.yellowLine}>
            The verify step checks that the tracker is not already assigned to another account.
          </AppText>

          <View style={{ height: spacing.md }} />

          <TouchableOpacity style={styles.addPetBtn} onPress={onAddPetPress} activeOpacity={0.85}>
            <Icon name="paw" size={18} color="#111" />
            <AppText style={styles.addPetBtnText}>Verify Device ID</AppText>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.lg }} />

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.85}>
          <AppText style={styles.logoutText}>Logout</AppText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#5E8F3C",
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: "#5E8F3C",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.25)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#D69E2E",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff" },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  contentContainer: {
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    color: "#fff",
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: spacing.sm,
  },
  rowCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  smallIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(249, 168, 37, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    color: "#111",
    fontWeight: "800",
  },
  rowSub: {
    marginTop: 2,
  },
  yellowCard: {
    backgroundColor: "#F4D35E",
    borderRadius: 16,
    padding: spacing.md,
  },
  yellowTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xs,
  },
  yellowSubtitle: {
    color: "rgba(0,0,0,0.65)",
    marginTop: 4,
  },
  yellowPawCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  yellowTitle: {
    color: "#111",
    fontWeight: "800",
  },
  yellowLine: {
    color: "#111",
    marginTop: 4,
  },
  addPetBtn: {
    backgroundColor: "rgba(255,255,255,0.42)",
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  addPetBtnText: {
    color: "#111",
    fontWeight: "900",
  },
  logoutBtn: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(200,0,0,0.25)",
  },
  logoutText: {
    color: "#C62828",
    fontWeight: "900",
  },
  advancedToggle: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    alignSelf: "flex-start",
  },
  advancedText: {
    color: "white",
    fontWeight: "600",
  },
});
