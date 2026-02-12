import { useEffect, useMemo, useState } from "react";
import {View,StyleSheet,Switch,TextInput,TouchableOpacity,ScrollView} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { collection,doc,onSnapshot,updateDoc,getDocs} from "firebase/firestore";

import { auth, db } from "../../config/firebase";
import { colors, spacing } from "../../theme";
import { useUserLocation } from "../../hooks/useUserLocation";

import AppText from "../../components/ui/AppText";
import Button from "../../components/ui/Button";

type Geofence = {
  center: { lat: number; lng: number };
  radiusMeters: number;
};

type Prefs = {
  notifyExit: boolean;
  notifyReturn: boolean;

  // optional helpers for "master" restore behavior
  masterEnabled?: boolean;
  lastNotifyExit?: boolean;
  lastNotifyReturn?: boolean;
};


export default function SettingsScreen({ navigation }: any) {
// advanced button for exit and return notifications
const [advancedOpen, setAdvancedOpen] = useState(false);


  // Auth + User Info
  const uid = auth.currentUser?.uid;
  const { location: userLocation } = useUserLocation();

  // USER profile
  const [userName, setUserName] = useState<string>("—");
  const [userEmail, setUserEmail] = useState<string>(auth.currentUser?.email ?? "—");

  // Pets list info
  const [petCount, setPetCount] = useState<number>(0);
  const [activePetId, setActivePetId] = useState<string | null>(null);

  // Active pet data shown in this Settings screen
  const [petName, setPetName] = useState<string>("—");
  const [lastTs, setLastTs] = useState<number | null>(null);

  const [geofence, setGeofence] = useState<Geofence>({
    center: { lat: 43.6577, lng: -79.3792 },
    radiusMeters: 120
  });

  const [prefs, setPrefs] = useState<Prefs>({
  notifyExit: true,
  notifyReturn: true,
  masterEnabled: true,
  lastNotifyExit: true,
  lastNotifyReturn: true
});


  const [verifyCode, setVerifyCode] = useState("");

  // 1) Listen to user doc: name/email + activePetId
  useEffect(() => {
    if (!uid) return;

    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as any;
      if (!data) return;

      setUserName(typeof data.name === "string" && data.name.trim() ? data.name : "—");
      setUserEmail(
        typeof data.email === "string" && data.email.trim()
          ? data.email
          : auth.currentUser?.email ?? "—"
      );

      if (typeof data.activePetId === "string") {
        setActivePetId(data.activePetId);
      } else {
        setActivePetId(null);
      }
    });

    return () => unsub();
  }, [uid]);

  // 2) Listen to pets collection to show count (and optional: pick first pet if none active)
  useEffect(() => {
    if (!uid) return;

    const petsRef = collection(db, "users", uid, "pets");
    const unsub = onSnapshot(petsRef, async (snap) => {
      setPetCount(snap.size);

      // If no active pet yet, auto-select the first pet (only for convenience)
      if (!activePetId && snap.size > 0) {
        const first = snap.docs[0];
        await updateDoc(doc(db, "users", uid), { activePetId: first.id });
      }
    });

    return () => unsub();
    // NOTE: activePetId intentionally included so it can auto-set once when null
  }, [uid, activePetId]);

  // 3) Listen to ACTIVE pet doc for settings (geofence + prefs + lastLocation)
  useEffect(() => {
    if (!uid || !activePetId) return;

    const petRef = doc(db, "users", uid, "pets", activePetId);
    const unsub = onSnapshot(petRef, (snap) => {
      const data = snap.data() as any;
      if (!data) return;

      if (typeof data.name === "string") setPetName(data.name);

      const ts = data?.lastLocation?.timestamp;
      if (typeof ts === "number") setLastTs(ts);

      const gf = data?.geofence;
      if (
        gf &&
        gf.center &&
        typeof gf.center.lat === "number" &&
        typeof gf.center.lng === "number" &&
        typeof gf.radiusMeters === "number"
      ) {
        setGeofence({
          center: { lat: gf.center.lat, lng: gf.center.lng },
          radiusMeters: gf.radiusMeters
        });
      }

      const p = data?.prefs;
      if (p && typeof p.notifyExit === "boolean" && typeof p.notifyReturn === "boolean") {
     setPrefs({
        notifyExit: p.notifyExit,
        notifyReturn: p.notifyReturn,
        masterEnabled: typeof p.masterEnabled === "boolean" ? p.masterEnabled : undefined,
        lastNotifyExit: typeof p.lastNotifyExit === "boolean" ? p.lastNotifyExit : undefined,
        lastNotifyReturn: typeof p.lastNotifyReturn === "boolean" ? p.lastNotifyReturn : undefined
  });
}

    }
  );

    return () => unsub();
  }, [uid, activePetId]);

  const lastUpdatedText = useMemo(() => {
    if (!lastTs) return "—";
    return new Date(lastTs * 1000).toLocaleString();
  }, [lastTs]);

  async function setHomeToMyLocation() {
    if (!uid || !activePetId || !userLocation) return;

    await updateDoc(doc(db, "users", uid, "pets", activePetId), {
      "geofence.center": {
        lat: userLocation.latitude,
        lng: userLocation.longitude
      }
    });
  }

  async function updateRadius(radiusMeters: number) {
    if (!uid || !activePetId) return;

    setGeofence((g) => ({ ...g, radiusMeters }));
    await updateDoc(doc(db, "users", uid, "pets", activePetId), {
      "geofence.radiusMeters": radiusMeters
    });
  }

  async function togglePref(key: keyof Prefs, value: boolean) {
    if (!uid || !activePetId) return;

    setPrefs((p) => ({ ...p, [key]: value }));
    await updateDoc(doc(db, "users", uid, "pets", activePetId), {
      [`prefs.${key}`]: value
    });
  }
 const masterEnabled = !!(prefs.notifyExit || prefs.notifyReturn);

async function setMasterNotifications(enabled: boolean) {
  if (!uid || !activePetId) return;

  const petRef = doc(db, "users", uid, "pets", activePetId);

  if (!enabled) {
    // backup current state then disable both
    await updateDoc(petRef, {
      "prefs.masterEnabled": false,
      "prefs.lastNotifyExit": prefs.notifyExit,
      "prefs.lastNotifyReturn": prefs.notifyReturn,
      "prefs.notifyExit": false,
      "prefs.notifyReturn": false
    });

    setPrefs((prev) => ({
      ...prev,
      masterEnabled: false,
      lastNotifyExit: prev.notifyExit,
      lastNotifyReturn: prev.notifyReturn,
      notifyExit: false,
      notifyReturn: false
    }));

    return;
  }

  // restore last state if present; otherwise default to true
  const restoreExit = typeof prefs.lastNotifyExit === "boolean" ? prefs.lastNotifyExit : true;
  const restoreReturn =
    typeof prefs.lastNotifyReturn === "boolean" ? prefs.lastNotifyReturn : true;

  await updateDoc(petRef, {
    "prefs.masterEnabled": true,
    "prefs.notifyExit": restoreExit,
    "prefs.notifyReturn": restoreReturn
  });

  setPrefs((prev) => ({
    ...prev,
    masterEnabled: true,
    notifyExit: restoreExit,
    notifyReturn: restoreReturn
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
    lastNotifyReturn: next.notifyReturn
  });

  await updateDoc(petRef, {
    [`prefs.${key}`]: value,
    "prefs.masterEnabled": nextMaster,
    "prefs.lastNotifyExit": next.notifyExit,
    "prefs.lastNotifyReturn": next.notifyReturn
  });
}


  function openMapPicker() {
    if (!activePetId) return;

    navigation.navigate("GeofencePicker", {
      petId: activePetId, // picker param name
      center: geofence.center,
      radiusMeters: geofence.radiusMeters
    });
  }

  function onProfilePress() {
    navigation.navigate("Profile");
  }

  function onManagePetsPress() {
    navigation.navigate("ManagePets");
  }

  function onVerifyCode() {
    // Later: use code to create/link a new pet doc
    console.log("Verify code:", verifyCode);
  }

  function onLogout() {
    auth.signOut();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Green Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.iconCircle}>
            <AppText style={styles.iconText}>🐾</AppText>
          </View>
          <AppText variant="heading" style={styles.headerTitle}>
            Settings
          </AppText>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile section (USER) */}
        <AppText variant="heading" style={styles.sectionTitle}>
          Profile
        </AppText>

        <TouchableOpacity style={styles.rowCard} onPress={onProfilePress} activeOpacity={0.85}>
          <View style={styles.rowLeft}>
            <View style={styles.smallIconCircle}>
              <AppText style={styles.iconTextSmall}>👤</AppText>
            </View>
            <View>
              <AppText style={styles.rowTitle}>{userName}</AppText>
              <AppText color="textSecondary" style={styles.rowSub}>
                {userEmail}
              </AppText>
            </View>
          </View>
          <AppText style={styles.chevron}>›</AppText>
        </TouchableOpacity>

        {/* Pet Profiles (PETS) */}
        <AppText variant="heading" style={styles.sectionTitle}>
          Pet Profiles
        </AppText>

        <TouchableOpacity style={styles.rowCard} onPress={onManagePetsPress} activeOpacity={0.85}>
          <View style={styles.rowLeft}>
            <View style={styles.smallIconCircle}>
              <AppText style={styles.iconTextSmall}>🐱</AppText>
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

          <AppText style={styles.chevron}>›</AppText>
        </TouchableOpacity>

        {/* Safe Zone (ACTIVE PET) */}
        <AppText variant="heading" style={styles.sectionTitle}>
          Safe Zone
        </AppText>

        <View style={styles.card}>
          <AppText color="textSecondary">
            Active Pet: {petName || "—"}
          </AppText>

          <View style={{ height: spacing.sm }} />

          <AppText color="textSecondary">
            Last update: {lastUpdatedText}
          </AppText>

          <View style={{ height: spacing.md }} />

          <AppText color="textSecondary">
            Home: {geofence.center.lat.toFixed(5)}, {geofence.center.lng.toFixed(5)}
          </AppText>

          <View style={{ height: spacing.md }} />

          <Button title="Set Home to My Location" onPress={setHomeToMyLocation} />
          <View style={{ height: spacing.sm }} />
          <Button title="Pick Home on Map" variant="secondary" onPress={openMapPicker} />

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
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={"rgba(0,0,0,0.15)"}
            thumbTintColor={colors.accent}
          />
        </View>

       {/* Notifications (ACTIVE PET prefs) */}
<AppText variant="heading" style={styles.sectionTitle}>
  Notifications
</AppText>

{/* Master toggle */}
<View style={styles.rowCard}>
  <View style={{ flex: 1, paddingRight: spacing.md }}>
    <AppText style={styles.rowTitle}>Enable notifications</AppText>
    <AppText color="textSecondary" style={styles.rowSub}>
      Turn on/off alerts for exit and return
    </AppText>
  </View>
  <Switch value={masterEnabled} onValueChange={setMasterNotifications} />
</View>

{/* Advanced toggle */}
<TouchableOpacity
  style={styles.advancedToggle}
  onPress={() => setAdvancedOpen((v) => !v)}
  activeOpacity={0.85}
>
  <AppText variant="heading" style={styles.advancedText}>
    Advanced {advancedOpen ? "▲" : "▼"}
  </AppText>
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
      <Switch value={prefs.notifyExit} onValueChange={(v) => toggleAdvanced("notifyExit", v)} />
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
      />
    </View>
  </>
) : null}


        {/* Add More Pets */}
        <AppText variant="heading" style={styles.sectionTitle}>
          Add More Pets
        </AppText>

        <View style={styles.yellowCard}>
          <View style={styles.verifyRow}>
            <TextInput
              value={verifyCode}
              onChangeText={setVerifyCode}
              placeholder="Verify Code"
              placeholderTextColor="rgba(0,0,0,0.45)"
              style={styles.input}
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity style={styles.verifyBtn} onPress={onVerifyCode} activeOpacity={0.85}>
              <AppText style={styles.verifyBtnText}>🐾</AppText>
            </TouchableOpacity>
          </View>

          <View style={{ height: spacing.sm }} />

          <AppText style={styles.yellowTitle}>Where to find your 6-character code:</AppText>
          <AppText style={styles.yellowLine}>• On the product packaging box</AppText>
          <AppText style={styles.yellowLine}>• Printed on the GPS tracker device</AppText>
          <AppText style={styles.yellowLine}>• In your purchase confirmation email</AppText>
        </View>

        <View style={{ height: spacing.lg }} />

        {/* Logout */}
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
    backgroundColor: "#5E8F3C"
  },

  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: "#5E8F3C",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.25)"
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  iconText: { fontSize: 22 },
  headerTitle: { color: "#fff" },

  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md
  },
  contentContainer: {
    paddingBottom: spacing.xl
  },

  sectionTitle: {
    color: "#fff",
    marginTop: spacing.sm,
    marginBottom: spacing.sm
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: spacing.sm
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
    elevation: 3
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1
  },

  smallIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(249, 168, 37, 0.35)",
    alignItems: "center",
    justifyContent: "center"
  },
  iconTextSmall: { fontSize: 18 },

  rowTitle: {
    color: "#111",
    fontWeight: "800"
  },
  rowSub: {
    marginTop: 2
  },

  chevron: {
    fontSize: 22,
    color: "rgba(0,0,0,0.45)",
    marginLeft: spacing.sm
  },

  yellowCard: {
    backgroundColor: "#F4D35E",
    borderRadius: 16,
    padding: spacing.md
  },
  verifyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingHorizontal: spacing.md,
    color: "#111"
  },
  verifyBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.10)",
    alignItems: "center",
    justifyContent: "center"
  },
  verifyBtnText: { fontSize: 18 },

  yellowTitle: {
    color: "#111",
    fontWeight: "800"
  },
  yellowLine: {
    color: "#111",
    marginTop: 4
  },

  logoutBtn: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(200,0,0,0.25)"
  },
  logoutText: {
    color: "#C62828",
    fontWeight: "900"
  },
  // Advanced toggle styles
  advancedToggle: {
  marginTop: spacing.xs,
  marginBottom: spacing.sm,
  alignSelf: "flex-start"
},
advancedText: {
  color: "white",
  fontWeight: "600",
 
},

});

