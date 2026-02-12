import { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import MapView, { Marker, Circle, Polyline, Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDoc, collection, doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "../../config/firebase";
import { spacing, typography } from "../../theme";
import { haversineMeters } from "../../utils/geo";
import AppText from "../../components/ui/AppText";
import {
  setupNotifications,
  sendBatteryLowNotification,
  sendBatteryFullNotification
} from "../../services/notificationService";

type LatLng = { latitude: number; longitude: number };

type Geofence = {
  center: { lat: number; lng: number };
  radiusMeters: number;
};

type PetDoc = {
  name?: string;
  breed?: string;
  deviceId?: string;
  geofence?: Geofence;
  lastLocation?: { lat?: number; lng?: number; timestamp?: number };
};

type DeviceDoc = {
  batteryPct?: number;
  lastLocation?: { lat?: number; lng?: number; timestamp?: number };
  lastSeen?: number;
};

const GREEN = "#5E8F3C";
const YELLOW = "#F4D35E";

export default function DashboardScreen({ navigation }: any) {
  const uid = auth.currentUser?.uid;
  const mapRef = useRef<MapView>(null);

  const [loading, setLoading] = useState(true);

  const [activePetId, setActivePetId] = useState<string | null>(null);

  const [petName, setPetName] = useState("—");
  const [petBreed, setPetBreed] = useState<string | undefined>(undefined);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const [geofence, setGeofence] = useState<Geofence>({
    center: { lat: 43.6577, lng: -79.3792 },
    radiusMeters: 120
  });

  // cached fallback location on pet doc (prevents pin disappearing)
  const [petCachedLoc, setPetCachedLoc] = useState<LatLng | null>(null);

  // device-driven location + status
  const [deviceLoc, setDeviceLoc] = useState<LatLng | null>(null);
  const [batteryPct, setBatteryPct] = useState<number | null>(null);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [lastTs, setLastTs] = useState<number | null>(null);

  // threshold tracking
  const prevBatteryRef = useRef<number | null>(null);
  const lastBatteryAlertAtRef = useRef<number>(0);

  useEffect(() => {
    setupNotifications();
  }, []);

  // 1) user doc -> activePetId
  useEffect(() => {
    if (!uid) return;

    const userRef = doc(db, "users", uid);
    const unsub = onSnapshot(userRef, (snap) => {
      const data = snap.data() as any;
      setActivePetId(typeof data?.activePetId === "string" ? data.activePetId : null);
    });

    return () => unsub();
  }, [uid]);

  // 2) pet doc -> name, breed, deviceId, geofence, cached location
  useEffect(() => {
    if (!uid || !activePetId) return;

    setLoading(true);

    const petRef = doc(db, "users", uid, "pets", activePetId);
    const unsub = onSnapshot(petRef, (snap) => {
      const data = snap.data() as PetDoc | undefined;
      if (!data) return;

      setPetName(typeof data.name === "string" && data.name.trim() ? data.name : "—");
      setPetBreed(typeof data.breed === "string" ? data.breed : undefined);

      const dev = data.deviceId;
      setDeviceId(typeof dev === "string" && dev.trim() ? dev : null);

      const gf = data.geofence;
      if (
        gf?.center &&
        typeof gf.center.lat === "number" &&
        typeof gf.center.lng === "number" &&
        typeof gf.radiusMeters === "number"
      ) {
        setGeofence(gf);
      }

      const ll = data.lastLocation;
      const latNum = typeof ll?.lat === "number" ? ll.lat : Number(ll?.lat);
      const lngNum = typeof ll?.lng === "number" ? ll.lng : Number(ll?.lng);

      if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
        setPetCachedLoc({ latitude: latNum, longitude: lngNum });
        if (typeof ll?.timestamp === "number") setLastTs(ll.timestamp);
      } else {
        setPetCachedLoc(null);
      }

      setLoading(false);
    });

    return () => unsub();
  }, [uid, activePetId]);

  // 3) device doc -> lastLocation, batteryPct, lastSeen
  useEffect(() => {
    setDeviceLoc(null);
    setBatteryPct(null);
    setLastSeen(null);
    prevBatteryRef.current = null;

    if (!deviceId) return;

    const devRef = doc(db, "devices", deviceId);
    const unsub = onSnapshot(devRef, (snap) => {
      const data = snap.data() as DeviceDoc | undefined;
      if (!data) return;

      const ll = data.lastLocation;
      const latNum = typeof ll?.lat === "number" ? ll.lat : Number(ll?.lat);
      const lngNum = typeof ll?.lng === "number" ? ll.lng : Number(ll?.lng);

      if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
        setDeviceLoc({ latitude: latNum, longitude: lngNum });
        if (typeof ll?.timestamp === "number") setLastTs(ll.timestamp);
      } else {
        setDeviceLoc(null);
      }

      if (typeof data.batteryPct === "number") setBatteryPct(data.batteryPct);
      if (typeof data.lastSeen === "number") setLastSeen(data.lastSeen);
    });

    return () => unsub();
  }, [deviceId]);

  // choose best location
  const catLocation = deviceLoc ?? petCachedLoc;

  // distance
  const distanceMeters = useMemo(() => {
    if (!catLocation) return null;
    return haversineMeters(
      catLocation.latitude,
      catLocation.longitude,
      geofence.center.lat,
      geofence.center.lng
    );
  }, [catLocation, geofence.center.lat, geofence.center.lng]);

  const distanceText = useMemo(() => {
    if (distanceMeters === null) return "—";
    if (distanceMeters >= 1000) return `${(distanceMeters / 1000).toFixed(2)} km`;
    return `${distanceMeters.toFixed(0)} m`;
  }, [distanceMeters]);

  const lastSeenText = useMemo(() => {
    if (!lastSeen) return "—";
    const now = Math.floor(Date.now() / 1000);
    const age = now - lastSeen;
    if (age < 60) return "Just now";
    const mins = Math.floor(age / 60);
    if (mins < 60) return `${mins} mins ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs} hrs ago`;
  }, [lastSeen]);

  // write battery alerts into Firestore alerts collection
  async function logBatteryAlert(type: "BATTERY_LOW" | "BATTERY_FULL", message: string) {
    if (!uid || !activePetId) return;

    const alertsRef = collection(db, "users", uid, "pets", activePetId, "alerts");
    await addDoc(alertsRef, {
      type,
      message,
      timestamp: Math.floor(Date.now() / 1000)
    });
  }

  // Battery notifications (threshold crossing + throttle)
  useEffect(() => {
    if (batteryPct === null) return;

    const prev = prevBatteryRef.current;
    prevBatteryRef.current = batteryPct;

    // first reading -> don’t fire
    if (prev === null) return;

    const nowMs = Date.now();
    const lastMs = lastBatteryAlertAtRef.current;

    // throttle: avoid spam if device doc updates rapidly
    const canNotify = nowMs - lastMs > 60 * 1000; // 1 minute
    if (!canNotify) return;

    // LOW: cross >25 -> <=25
    if (prev > 25 && batteryPct <= 25) {
      lastBatteryAlertAtRef.current = nowMs;
      const msg = `${petName} battery is low (${batteryPct}%). Please charge the tracker.`;
      sendBatteryLowNotification(msg);
      logBatteryAlert("BATTERY_LOW", msg);
      return;
    }

    // FULL: cross <100 -> >=100
    if (prev < 100 && batteryPct >= 100) {
      lastBatteryAlertAtRef.current = nowMs;
      const msg = `${petName} is fully charged (100%).`;
      sendBatteryFullNotification(msg);
      logBatteryAlert("BATTERY_FULL", msg);
    }
  }, [batteryPct, petName]); // uses refs for prev/throttle

  // preview region
  const previewRegion: Region = useMemo(() => {
    const home = { latitude: geofence.center.lat, longitude: geofence.center.lng };
    const center = catLocation ?? home;
    return {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02
    };
  }, [catLocation, geofence.center.lat, geofence.center.lng]);

  // fit to show both markers
  useEffect(() => {
    if (!mapRef.current) return;

    const home = { latitude: geofence.center.lat, longitude: geofence.center.lng };
    if (catLocation) {
      mapRef.current.fitToCoordinates([home, catLocation], {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true
      });
    }
  }, [catLocation, geofence.center.lat, geofence.center.lng]);

  const updatedText = useMemo(() => {
    if (!lastTs) return "—";
    return new Date(lastTs * 1000).toLocaleTimeString();
  }, [lastTs]);

  if (!uid) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <AppText variant="heading" style={{ color: "#fff" }}>
            Dashboard
          </AppText>
          <AppText style={{ color: "rgba(255,255,255,0.85)", marginTop: spacing.sm }}>
            Please log in.
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator />
          <AppText style={{ color: "rgba(255,255,255,0.85)", marginTop: spacing.sm }}>
            Loading…
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Green Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <AppText style={styles.paw}>🐾</AppText>
          <AppText variant="heading" style={styles.headerTitle}>
            Location
          </AppText>
        </View>
      </View>

      <View style={styles.content}>
        {/* Yellow Pet dropdown bar (for now it just opens ManagePets) */}
        <TouchableOpacity
          style={styles.petCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("ManagePets")}
        >
          <View style={styles.petLeft}>
            <View style={styles.petAvatar}>
              <AppText style={{ fontSize: 18 }}>🐱</AppText>
            </View>

            <View style={{ flex: 1 }}>
              <AppText style={styles.petNameText}>{petName}</AppText>
              <AppText style={styles.petSubText}>{petBreed ?? "—"}</AppText>
            </View>
          </View>

          <AppText style={styles.chevron}>⌄</AppText>
        </TouchableOpacity>

        {/* Map Preview */}
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={previewRegion}
            pointerEvents="none"
          >
            {/* Home */}
            <Marker
              coordinate={{ latitude: geofence.center.lat, longitude: geofence.center.lng }}
              title="Home"
              anchor={{ x: 0.5, y: 0.5 }}>             
              <View style={styles.homeMarker}>
              <AppText style={styles.homeMarkerText}>🏠</AppText>
             </View>
            </Marker>


            <Circle
              center={{ latitude: geofence.center.lat, longitude: geofence.center.lng }}
              radius={geofence.radiusMeters}
              strokeWidth={2}
              strokeColor={"rgba(255, 255, 255, 0.9)"}
              fillColor={"rgba(255, 153, 0, 0.15)"}
            />

            {/* Cat */}
            {catLocation ? (
              <>
                <Marker coordinate={catLocation} title={petName} />
                <Polyline
                  coordinates={[
                    { latitude: geofence.center.lat, longitude: geofence.center.lng },
                    catLocation
                  ]}
                  strokeWidth={3}
                  strokeColor={"rgba(0,0,0,0.55)"}
                />
              </>
            ) : null}
          </MapView>

          {/* Distance ON MAP */}
          <View style={styles.mapPill}>
            <AppText style={styles.mapPillText}>Distance: {distanceText}</AppText>
          </View>
        </View>

        {/* Bottom “pills” */}
        <View style={styles.pillsRow}>
          <TouchableOpacity
            style={styles.pill}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("Alerts")}
          >
            <AppText style={styles.pillTitle}>Battery</AppText>
            <AppText style={styles.pillValue}>
              {batteryPct === null ? "—" : `${batteryPct}%`}
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pill}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("Map")}
          >
            <AppText style={styles.pillTitle}>Distance</AppText>
            <AppText style={styles.pillValue}>{distanceText}</AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pill}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("Map")}
          >
            <AppText style={styles.pillTitle}>Last Seen</AppText>
            <AppText style={styles.pillValue}>{lastSeenText}</AppText>
          </TouchableOpacity>
        </View>

        {/* Quick link */}
        <TouchableOpacity
          style={styles.openMapBtn}
          onPress={() => navigation.navigate("Map")}
          activeOpacity={0.85}
        >
          <AppText style={styles.openMapText}>Open Live Map • Updated {updatedText}</AppText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN },

  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.25)"
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  paw: { fontSize: 20, color: "#111" },
  headerTitle: { color: "#fff" },

  content: { flex: 1, padding: spacing.md },

  petCard: {
    backgroundColor: YELLOW,
    borderRadius: 18,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md
  },
  petLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },
  petAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  petNameText: { ...typography.subheading, color: "#2b4b1f" },
  petSubText: { ...typography.body, color: "rgba(0,0,0,0.55)", marginTop: 2 },
  chevron: { fontSize: 20, color: "rgba(0,0,0,0.55)", marginLeft: spacing.sm },

  mapWrap: {
    height: 330,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: spacing.md
  },
  map: { flex: 1 },

  mapPill: {
    position: "absolute",
    left: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  mapPillText: { ...typography.body, color: "#fff", fontWeight: "800" },

  pillsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  pill: {
    flex: 1,
    backgroundColor: YELLOW,
    borderRadius: 18,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  pillTitle: { ...typography.body, color: "rgba(0,0,0,0.65)", fontWeight: "800" },
  pillValue: { ...typography.subheading, color: "#111", marginTop: 4 },

  openMapBtn: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center"
  },
  openMapText: { ...typography.body, color: "#111", fontWeight: "900" },

  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },

  homeMarker: {
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: "rgba(255,255,255,0.95)",
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 2,
  borderColor: "rgba(0,0,0,0.15)"
},
homeMarkerText: {
  fontSize: 18
},

});
