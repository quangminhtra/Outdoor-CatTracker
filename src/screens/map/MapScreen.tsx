import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import MapView, { Marker, Circle, Region } from "react-native-maps";
import { doc, onSnapshot, addDoc, collection, updateDoc } from "firebase/firestore";

import { auth, db } from "../../config/firebase";
import { useUserLocation } from "../../hooks/useUserLocation";
import { colors, spacing, typography } from "../../theme";
import { haversineMeters } from "../../utils/geo";
import {
  setupNotifications,
  sendGeofenceBreachNotification,
  sendGeofenceReturnNotification
} from "../../services/notificationService";
import AppText from "../../components/ui/AppText";

type LatLng = { latitude: number; longitude: number };
type GeofenceEvent = "EXIT" | "RETURN" | null;

type Geofence = {
  center: { lat: number; lng: number };
  radiusMeters: number;
};

type Prefs = {
  notifyExit: boolean;
  notifyReturn: boolean;
};

export default function MapScreen() {
  const uid = auth.currentUser?.uid;
  const { location: userLocation, loading, error } = useUserLocation();

  const mapRef = useRef<MapView>(null);
  const prevInsideRef = useRef<boolean | null>(null);

  // Active pet
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [petName, setPetName] = useState<string>("—");
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Per-pet settings
  const [geofence, setGeofence] = useState<Geofence>({
    center: { lat: 43.6577, lng: -79.3792 },
    radiusMeters: 120
  });

  const [prefs, setPrefs] = useState<Prefs>({
    notifyExit: true,
    notifyReturn: true
  });

  // Device-driven location (live)
  const [catLocation, setCatLocation] = useState<LatLng | null>(null);
  const [catTimestamp, setCatTimestamp] = useState<number | null>(null);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [batteryPct, setBatteryPct] = useState<number | null>(null);

  // Pet doc fallback (cache) location (so pins show on restart)
  const [petLastLocation, setPetLastLocation] = useState<LatLng | null>(null);
  const [petLastTs, setPetLastTs] = useState<number | null>(null);

  // Geofence computed
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean | null>(null);
  const [geofenceEvent, setGeofenceEvent] = useState<GeofenceEvent>(null);

  // Prefer live device location, fallback to pet doc cached lastLocation
  const displayLocation = useMemo(() => {
    return catLocation ?? petLastLocation ?? null;
  }, [catLocation, petLastLocation]);

  const displayTimestamp = useMemo(() => {
    return catTimestamp ?? petLastTs ?? null;
  }, [catTimestamp, petLastTs]);

  // Notifications
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

  // Mirror device location -> pet doc lastLocation (cache)
  const mirrorLastLocationToPet = useCallback(
    async (lat: number, lng: number, timestamp: number) => {
      if (!uid || !activePetId) return;

      await updateDoc(doc(db, "users", uid, "pets", activePetId), {
        "lastLocation.lat": lat,
        "lastLocation.lng": lng,
        "lastLocation.timestamp": timestamp
      });
    },
    [uid, activePetId]
  );

  // 2) active pet doc -> name/deviceId/geofence/prefs + fallback lastLocation
  useEffect(() => {
    // reset pet-based fields when switching pets
    setPetName("—");
    setDeviceId(null);

    setPetLastLocation(null);
    setPetLastTs(null);

    prevInsideRef.current = null;
    setGeofenceEvent(null);
    setIsInsideGeofence(null);
    setDistanceMeters(null);

    if (!uid || !activePetId) return;

    const petRef = doc(db, "users", uid, "pets", activePetId);
    const unsub = onSnapshot(petRef, (snap) => {
      const data = snap.data() as any;
      if (!data) return;

      setPetName(typeof data?.name === "string" ? data.name : "—");

      const dev = data?.deviceId;
      setDeviceId(typeof dev === "string" && dev.trim() ? dev : null);

      const gf = data?.geofence;
      if (
        gf?.center &&
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
      if (typeof p?.notifyExit === "boolean" && typeof p?.notifyReturn === "boolean") {
        setPrefs({ notifyExit: p.notifyExit, notifyReturn: p.notifyReturn });
      }

      // fallback lastLocation from pet doc (for restart / before device snapshot arrives)
      const ll = data?.lastLocation;
      const lat = ll?.lat;
      const lng = ll?.lng;
      const ts = ll?.timestamp;

      const latNum = typeof lat === "number" ? lat : Number(lat);
      const lngNum = typeof lng === "number" ? lng : Number(lng);

      if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
        setPetLastLocation({ latitude: latNum, longitude: lngNum });
      } else {
        setPetLastLocation(null);
      }

      if (typeof ts === "number") setPetLastTs(ts);
    });

    return () => unsub();
  }, [uid, activePetId]);

  // 3) devices/{deviceId} -> lastLocation/lastSeen/battery (live)
  useEffect(() => {
    // reset device fields when device changes
    setCatLocation(null);
    setCatTimestamp(null);
    setLastSeen(null);
    setBatteryPct(null);

    prevInsideRef.current = null;
    setGeofenceEvent(null);
    setIsInsideGeofence(null);
    setDistanceMeters(null);

    if (!deviceId) return;

    const devRef = doc(db, "devices", deviceId);
    const unsub = onSnapshot(devRef, (snap) => {
      const data = snap.data() as any;
      if (!data) return;

      const ll = data?.lastLocation;
      const lat = ll?.lat;
      const lng = ll?.lng;
      const ts = ll?.timestamp;

      const latNum = typeof lat === "number" ? lat : Number(lat);
      const lngNum = typeof lng === "number" ? lng : Number(lng);

      if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
        setCatLocation({ latitude: latNum, longitude: lngNum });

        if (typeof ts === "number") {
          setCatTimestamp(ts);
          // cache to pet doc so pins show after restart
          mirrorLastLocationToPet(latNum, lngNum, ts);
        }
      } else {
        setCatLocation(null);
      }

      const seen = data?.lastSeen;
      if (typeof seen === "number") setLastSeen(seen);

      const batt = data?.batteryPct;
      if (typeof batt === "number") setBatteryPct(batt);
    });

    return () => unsub();
  }, [deviceId, mirrorLastLocationToPet]);

  // 4) Geofence compute + transitions (use displayLocation so it works on restart too)
  useEffect(() => {
    if (!displayLocation) return;

    const d = haversineMeters(
      displayLocation.latitude,
      displayLocation.longitude,
      geofence.center.lat,
      geofence.center.lng
    );

    setDistanceMeters(d);

    const inside = d <= geofence.radiusMeters;
    setIsInsideGeofence(inside);

    const prevInside = prevInsideRef.current;

    // init: set baseline only (no event)
    if (prevInside === null) {
      prevInsideRef.current = inside;
      setGeofenceEvent(null);
      return;
    }

    if (prevInside === true && inside === false) setGeofenceEvent("EXIT");
    else if (prevInside === false && inside === true) setGeofenceEvent("RETURN");
    else setGeofenceEvent(null);

    prevInsideRef.current = inside;
  }, [displayLocation, geofence.center.lat, geofence.center.lng, geofence.radiusMeters]);

  // Auto-follow marker (use displayLocation)
  useEffect(() => {
    const target = displayLocation ?? {
      latitude: geofence.center.lat,
      longitude: geofence.center.lng
    };

    mapRef.current?.animateToRegion(
      {
        latitude: target.latitude,
        longitude: target.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      },
      700
    );
  }, [displayLocation, geofence.center.lat, geofence.center.lng]);

  async function logAlert(type: "GEOFENCE_EXIT" | "GEOFENCE_RETURN") {
    if (!uid || !activePetId || !displayLocation) return;

    const alertsRef = collection(db, "users", uid, "pets", activePetId, "alerts");

    const message =
      type === "GEOFENCE_EXIT"
        ? `${petName} left the safe zone`
        : `${petName} returned to the safe zone`;

    const actionTip =
      type === "GEOFENCE_EXIT"
        ? "Open Map and follow the last known location. Consider checking nearby streets."
        : "Your pet is back in the safe zone. Confirm they are safely at home.";

    await addDoc(alertsRef, {
      type,
      message,
      actionTip,
      timestamp: Math.floor(Date.now() / 1000),
      lat: displayLocation.latitude,
      lng: displayLocation.longitude
    });
  }

  // Notify + log (respects prefs)
  useEffect(() => {
    if (!geofenceEvent) return;

    if (geofenceEvent === "EXIT") {
      if (prefs.notifyExit) sendGeofenceBreachNotification();
      logAlert("GEOFENCE_EXIT");
    }

    if (geofenceEvent === "RETURN") {
      if (prefs.notifyReturn) sendGeofenceReturnNotification();
      logAlert("GEOFENCE_RETURN");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geofenceEvent]);

  const initialRegion: Region = useMemo(() => {
    const fallback = { latitude: geofence.center.lat, longitude: geofence.center.lng };
    const center = displayLocation ?? fallback;

    return {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01
    };
  }, [displayLocation, geofence.center.lat, geofence.center.lng]);

  const lastUpdatedText = useMemo(() => {
    if (!displayTimestamp) return "—";
    return new Date(displayTimestamp * 1000).toLocaleTimeString();
  }, [displayTimestamp]);

  const onlineStatus = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    if (!deviceId) return "No device";
    if (!lastSeen) return "Waiting for signal…";
    const age = now - lastSeen;
    if (age <= 120) return "Online";
    return "Offline";
  }, [deviceId, lastSeen]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <AppText style={styles.helperText}>Getting your location…</AppText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <AppText style={styles.errorText}>
          Location permission is required to show your position on the map.
        </AppText>
        <AppText style={styles.helperText}>{error}</AppText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion} showsUserLocation>
       {/* PET marker (bigger) */}
  {displayLocation && (
    <Marker
     coordinate={displayLocation}
      anchor={{ x: 0.5, y: 0.5 }}
  >
    <View
      style={{
        backgroundColor: isInsideGeofence ? "#2E7D32" : "#C62828",
        padding: 10,
        borderRadius: 30,
        borderWidth: 3,
        borderColor: "#fff",
        elevation: 6
      }}
    >
      <AppText style={{ fontSize: 22 }}>
        🐱
      </AppText>
    </View>
  </Marker>
)}


{/* HOME marker (bigger) */}
<Marker
  coordinate={{
    latitude: geofence.center.lat,
    longitude: geofence.center.lng
  }}
  anchor={{ x: 0.5, y: 0.5 }}
>
  <View
    style={{
      backgroundColor: "#fff",
      padding: 10,
      borderRadius: 30,
      borderWidth: 3,
      borderColor: "rgba(46,125,50,0.75)",
      elevation: 6
    }}
  >
    <AppText style={{ fontSize: 22 }}>🏠</AppText>
  </View>
</Marker>


      {/* Geofence circle (keep behind markers) */}
    <Circle
      center={{ latitude: geofence.center.lat, longitude: geofence.center.lng }}
      radius={geofence.radiusMeters}
      strokeWidth={3}
      strokeColor={colors.accent}
      fillColor={"rgba(249, 168, 37, 0.12)"}
      zIndex={1}
    />

      </MapView>

      <View style={styles.overlayCard}>
        <AppText style={styles.overlayTitle}>Live Tracking</AppText>

        <AppText style={styles.overlayLine}>
          Pet: {activePetId ? petName : "No active pet"}
        </AppText>
        <AppText style={styles.overlayLine}>Device: {deviceId ?? "Not linked"}</AppText>
        <AppText style={styles.overlayLine}>Status: {onlineStatus}</AppText>

        {batteryPct !== null ? (
          <AppText style={styles.overlayLine}>Battery: {batteryPct}%</AppText>
        ) : null}

        <AppText style={styles.overlayLine}>Updated: {lastUpdatedText}</AppText>

        <AppText style={styles.overlayLine}>
          Geofence:{" "}
          {isInsideGeofence === null ? "—" : isInsideGeofence ? "Inside" : "Outside"}
        </AppText>

        <AppText style={styles.overlayLine}>
          Distance: {distanceMeters === null ? "—" : `${distanceMeters.toFixed(1)} m`}
        </AppText>

        <AppText style={styles.overlayLine}>
          Event: {geofenceEvent ? geofenceEvent : "—"}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { flex: 1 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg
  },
  helperText: {
    marginTop: spacing.md,
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center"
  },
  errorText: {
    ...typography.subheading,
    color: colors.error,
    textAlign: "center"
  },
  overlayCard: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4
  },
  overlayTitle: {
    ...typography.subheading,
    marginBottom: spacing.sm,
    color: colors.textPrimary
  },
  overlayLine: {
    ...typography.body,
    color: colors.textSecondary
  },

    petMarker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.10)",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 110
  },
  homeMarker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "rgba(46,125,50,0.25)", // subtle green border
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 110
  },
  markerEmoji: {
    fontSize: 18
  },
  markerText: {
    ...typography.body,
    color: "#111",
    fontWeight: "800"
  },


});
