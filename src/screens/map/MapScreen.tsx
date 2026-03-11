import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  TouchableOpacity,
} from "react-native";
import MapView, { Marker, Circle, Region } from "react-native-maps";
import {
  doc,
  onSnapshot,
  addDoc,
  collection,
  updateDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { auth, db } from "../../config/firebase";
import { useUserLocation } from "../../hooks/useUserLocation";
import { colors, spacing, typography } from "../../theme";
import { haversineMeters } from "../../utils/geo";
import {
  setupNotifications,
  sendGeofenceBreachNotification,
  sendGeofenceReturnNotification,
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

type ApiPing = {
  pingId: number | null;
  deviceId: string;
  lat: number;
  lng: number;
  serverTimeMs: number;
};

type MuteOption = {
  label: string;
  subtitle: string;
  valueMs: number;
};

const API_BASE = "https://oblanceolate-unfactual-mckinley.ngrok-free.dev";
const POLL_MS = 5000;

const ALERT_RETENTION_HOURS = 48;
const MAX_ALERTS = 60;

const OUTSIDE_ALERT_MAX = 3;
const OUTSIDE_ALERT_SPACING_MS = 30 * 1000;

const OUTSIDE_MUTE_OPTIONS: MuteOption[] = [
  { label: "30 min", subtitle: "Short pause", valueMs: 30 * 60 * 1000 },
  { label: "1 hour", subtitle: "Quick outing", valueMs: 1 * 60 * 60 * 1000 },
  { label: "3 hours", subtitle: "Most common", valueMs: 3 * 60 * 60 * 1000 },
  { label: "6 hours", subtitle: "Half day", valueMs: 6 * 60 * 60 * 1000 },
  { label: "12 hours", subtitle: "Long outing", valueMs: 12 * 60 * 60 * 1000 },
  { label: "24 hours", subtitle: "Full day", valueMs: 24 * 60 * 60 * 1000 },
];

function isValidLatLng(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

async function fetchLatestPing(deviceId: string): Promise<ApiPing> {
  const reqTime = Date.now();
  const url = `${API_BASE}/api/recentPing/${encodeURIComponent(deviceId)}/${reqTime}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}`);

  const raw = await res.json();

  return {
    pingId: raw.id ?? null,
    deviceId: raw.device_id,
    lat: parseFloat(raw.lat),
    lng: parseFloat(raw.long),
    serverTimeMs: parseInt(raw.date) * 1000,
  };
}

export default function MapScreen() {
  const uid = auth.currentUser?.uid;
  const { loading, error } = useUserLocation();

  const mapRef = useRef<MapView>(null);
  const prevInsideRef = useRef<boolean | null>(null);

  const outsideTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const outsideMuteUntilRef = useRef<number | null>(null);
  const outsideFlowActiveRef = useRef(false);
  const outsidePromptShownRef = useRef(false);
  
  // 1) Added Refs
  const outsideAttemptCountRef = useRef(0);
  const outsideEpisodeDoneRef = useRef(false);

  const isInsideGeofenceRef = useRef<boolean | null>(null);

  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [petName, setPetName] = useState<string>("—");
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const [geofence, setGeofence] = useState<Geofence>({
    center: { lat: 43.6577, lng: -79.3792 },
    radiusMeters: 120,
  });

  const [prefs, setPrefs] = useState<Prefs>({
    notifyExit: true,
    notifyReturn: true,
  });

  const [catLocation, setCatLocation] = useState<LatLng | null>(null);
  const [catTimestampMs, setCatTimestampMs] = useState<number | null>(null);

  const [petLastLocation, setPetLastLocation] = useState<LatLng | null>(null);
  const [petLastTsMs, setPetLastTsMs] = useState<number | null>(null);

  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean | null>(null);
  const [geofenceEvent, setGeofenceEvent] = useState<GeofenceEvent>(null);

  const [outsideMuteModalVisible, setOutsideMuteModalVisible] = useState(false);
  const [selectedMuteMs, setSelectedMuteMs] = useState<number>(
    OUTSIDE_MUTE_OPTIONS[2].valueMs
  );

  const displayLocation = useMemo(
    () => catLocation ?? petLastLocation ?? null,
    [catLocation, petLastLocation]
  );

  const displayTimestampMs = useMemo(
    () => catTimestampMs ?? petLastTsMs ?? null,
    [catTimestampMs, petLastTsMs]
  );

  useEffect(() => {
    setupNotifications();
  }, []);

  useEffect(() => {
    isInsideGeofenceRef.current = isInsideGeofence;
  }, [isInsideGeofence]);

  const clearOutsideTimers = useCallback(() => {
    for (const timer of outsideTimersRef.current) {
      clearTimeout(timer);
    }
    outsideTimersRef.current = [];
  }, []);

  // 2) Updated resetOutsideFlow
  const resetOutsideFlow = useCallback(() => {
    clearOutsideTimers();
    outsideFlowActiveRef.current = false;
    outsidePromptShownRef.current = false;
    outsideMuteUntilRef.current = null;
    outsideAttemptCountRef.current = 0;
    outsideEpisodeDoneRef.current = false;
    setOutsideMuteModalVisible(false);
  }, [clearOutsideTimers]);

  const muteOutsideAlerts = useCallback(
    (durationMs: number) => {
      outsideMuteUntilRef.current = Date.now() + durationMs;
      clearOutsideTimers();
      outsideFlowActiveRef.current = false;
      outsidePromptShownRef.current = false;
      setOutsideMuteModalVisible(false);
    },
    [clearOutsideTimers]
  );

  async function logAlert(type: "GEOFENCE_EXIT" | "GEOFENCE_RETURN") {
    if (!uid || !activePetId) return;

    const alertsRef = collection(db, "users", uid, "pets", activePetId, "alerts");
    const now = Date.now();
    const cutoff = now - ALERT_RETENTION_HOURS * 60 * 60 * 1000;

    const message =
      type === "GEOFENCE_EXIT"
        ? `${petName} left the safe zone.`
        : `${petName} returned to the safe zone.`;

    const actionTip =
      type === "GEOFENCE_EXIT"
        ? "Check the live map to see the latest location."
        : "Your pet is back within the configured safe area.";

    const oldAlertsQuery = query(alertsRef, where("timestampMs", "<", cutoff));
    const oldAlertsSnap = await getDocs(oldAlertsQuery);

    for (const docSnap of oldAlertsSnap.docs) {
      await deleteDoc(docSnap.ref);
    }

    await addDoc(alertsRef, {
      type,
      message,
      actionTip,
      timestampMs: now,
    });

    const allAlertsQuery = query(alertsRef, orderBy("timestampMs", "desc"));
    const allAlertsSnap = await getDocs(allAlertsQuery);

    if (allAlertsSnap.size > MAX_ALERTS) {
      const docsToDelete = allAlertsSnap.docs.slice(MAX_ALERTS);
      for (const docSnap of docsToDelete) {
        await deleteDoc(docSnap.ref);
      }
    }
  }

  // 3) Updated showOutsideMutePrompt
  const showOutsideMutePrompt = useCallback(() => {
    outsidePromptShownRef.current = true;
    setOutsideMuteModalVisible(true);
  }, []);

  const handleKeepAlertsOn = useCallback(() => {
    outsidePromptShownRef.current = false;
    setOutsideMuteModalVisible(false);
  }, []);

  const handleConfirmMute = useCallback(() => {
    muteOutsideAlerts(selectedMuteMs);
  }, [muteOutsideAlerts, selectedMuteMs]);

  // 4) Updated startOutsideAlertSequence
  const startOutsideAlertSequence = useCallback(async () => {
    if (outsideFlowActiveRef.current) return;
    if (outsideEpisodeDoneRef.current) return;

    const mutedUntil = outsideMuteUntilRef.current;
    if (mutedUntil && Date.now() < mutedUntil) return;

    outsideFlowActiveRef.current = true;
    clearOutsideTimers();

    const runAttempt = async (attemptNumber: number) => {
      const stillOutside = isInsideGeofenceRef.current === false;
      const stillMuted =
        outsideMuteUntilRef.current !== null &&
        Date.now() < outsideMuteUntilRef.current;

      if (!stillOutside || stillMuted || outsideEpisodeDoneRef.current) {
        return;
      }

      outsideAttemptCountRef.current = attemptNumber + 1;

      // Log every EXIT attempt
      await logAlert("GEOFENCE_EXIT");

      // Notify if enabled
      if (prefs.notifyExit) {
        await sendGeofenceBreachNotification();
      }

      // Show popup every attempt
      showOutsideMutePrompt();

      if (attemptNumber === OUTSIDE_ALERT_MAX - 1) {
        outsideFlowActiveRef.current = false;
        outsideEpisodeDoneRef.current = true;
      }
    };

    // #1 immediately
    await runAttempt(0);

    // #2 and #3
    for (let i = 1; i < OUTSIDE_ALERT_MAX; i++) {
      const timer = setTimeout(async () => {
        await runAttempt(i);
      }, i * OUTSIDE_ALERT_SPACING_MS);

      outsideTimersRef.current.push(timer);
    }
  }, [clearOutsideTimers, prefs.notifyExit, showOutsideMutePrompt]);

  // 5) Old Interval Effect has been deleted.

  useEffect(() => {
    if (!uid) return;

    const userRef = doc(db, "users", uid);
    const unsub = onSnapshot(userRef, (snap) => {
      const data = snap.data() as any;
      setActivePetId(typeof data?.activePetId === "string" ? data.activePetId : null);
    });

    return () => unsub();
  }, [uid]);

  const mirrorLastLocationToPet = useCallback(
    async (lat: number, lng: number, timestampMs: number) => {
      if (!uid || !activePetId) return;

      await updateDoc(doc(db, "users", uid, "pets", activePetId), {
        "lastLocation.lat": lat,
        "lastLocation.lng": lng,
        "lastLocation.timestamp": timestampMs,
      });
    },
    [uid, activePetId]
  );

  useEffect(() => {
    setPetName("—");
    setDeviceId(null);
    setPetLastLocation(null);
    setPetLastTsMs(null);

    prevInsideRef.current = null;
    setGeofenceEvent(null);
    setIsInsideGeofence(null);
    setDistanceMeters(null);

    resetOutsideFlow();

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
          radiusMeters: gf.radiusMeters,
        });
      }

      const p = data?.prefs;
      if (typeof p?.notifyExit === "boolean" && typeof p?.notifyReturn === "boolean") {
        setPrefs({ notifyExit: p.notifyExit, notifyReturn: p.notifyReturn });
      }

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

      if (typeof ts === "number" && Number.isFinite(ts)) setPetLastTsMs(ts);
      else setPetLastTsMs(null);
    });

    return () => unsub();
  }, [uid, activePetId, resetOutsideFlow]);

  useEffect(() => {
    setCatLocation(null);
    setCatTimestampMs(null);

    prevInsideRef.current = null;
    setGeofenceEvent(null);
    setIsInsideGeofence(null);
    setDistanceMeters(null);

    resetOutsideFlow();

    if (!deviceId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const run = async () => {
      try {
        const ping = await fetchLatestPing(deviceId);
        if (cancelled) return;

        if (!isValidLatLng(ping.lat, ping.lng)) return;

        setCatLocation({ latitude: ping.lat, longitude: ping.lng });
        setCatTimestampMs(ping.serverTimeMs);

        await mirrorLastLocationToPet(ping.lat, ping.lng, ping.serverTimeMs);
      } catch {
        // fallback still available
      }
    };

    run();
    timer = setInterval(run, POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [deviceId, mirrorLastLocationToPet, resetOutsideFlow]);

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

  useEffect(() => {
    const target = displayLocation ?? {
      latitude: geofence.center.lat,
      longitude: geofence.center.lng,
    };

    mapRef.current?.animateToRegion(
      {
        latitude: target.latitude,
        longitude: target.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      700
    );
  }, [displayLocation, geofence.center.lat, geofence.center.lng]);

  useEffect(() => {
    if (geofenceEvent === "EXIT") {
      startOutsideAlertSequence();
    }
  }, [geofenceEvent, startOutsideAlertSequence]);

  useEffect(() => {
    if (geofenceEvent !== "RETURN") return;

    resetOutsideFlow();

    if (prefs.notifyReturn) {
      sendGeofenceReturnNotification();
    }

    logAlert("GEOFENCE_RETURN");
  }, [geofenceEvent, prefs.notifyReturn, resetOutsideFlow]);

  useEffect(() => {
    return () => {
      clearOutsideTimers();
    };
  }, [clearOutsideTimers]);

  const initialRegion: Region = useMemo(() => {
    const fallback = { latitude: geofence.center.lat, longitude: geofence.center.lng };
    const center = displayLocation ?? fallback;

    return {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, [displayLocation, geofence.center.lat, geofence.center.lng]);

  const lastUpdatedText = useMemo(() => {
    if (!displayTimestampMs) return "—";
    return new Date(displayTimestampMs).toLocaleTimeString();
  }, [displayTimestampMs]);

  const onlineStatus = useMemo(() => {
    if (!deviceId) return "No device";
    if (!displayTimestampMs) return "Waiting for signal…";

    const ageMs = Date.now() - displayTimestampMs;
    if (ageMs <= 120_000) return "Online";
    return "Offline";
  }, [deviceId, displayTimestampMs]);

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
        {displayLocation && (
          <Marker coordinate={displayLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View
              style={{
                backgroundColor: isInsideGeofence ? "#2E7D32" : "#C62828",
                padding: 10,
                borderRadius: 30,
                borderWidth: 3,
                borderColor: "#fff",
                elevation: 6,
              }}
            >
              <AppText style={{ fontSize: 22 }}>🐱</AppText>
            </View>
          </Marker>
        )}

        <Marker
          coordinate={{
            latitude: geofence.center.lat,
            longitude: geofence.center.lng,
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
              elevation: 6,
            }}
          >
            <AppText style={{ fontSize: 22 }}>🏠</AppText>
          </View>
        </Marker>

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
        <AppText style={styles.overlayLine}>Updated: {lastUpdatedText}</AppText>

        <AppText style={styles.overlayLine}>
          Geofence: {isInsideGeofence === null ? "—" : isInsideGeofence ? "Inside" : "Outside"}
        </AppText>

        <AppText style={styles.overlayLine}>
          Distance: {distanceMeters === null ? "—" : `${distanceMeters.toFixed(1)} m`}
        </AppText>

        <AppText style={styles.overlayLine}>Event: {geofenceEvent ? geofenceEvent : "—"}</AppText>
      </View>

      <Modal
        visible={outsideMuteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleKeepAlertsOn}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleKeepAlertsOn} />

        <View style={styles.modalSheet}>
          <AppText style={styles.modalTitle}>Outside Safe Zone</AppText>
          <AppText style={styles.modalSubtitle}>
            {petName} is outside the safe zone. Choose how long to pause outside alerts.
          </AppText>

          <View style={styles.optionsGrid}>
            {OUTSIDE_MUTE_OPTIONS.map((option) => {
              const selected = selectedMuteMs === option.valueMs;

              return (
                <TouchableOpacity
                  key={option.valueMs}
                  activeOpacity={0.85}
                  onPress={() => setSelectedMuteMs(option.valueMs)}
                  style={[styles.optionCard, selected && styles.optionCardSelected]}
                >
                  <AppText
                    style={[styles.optionLabel, selected && styles.optionLabelSelected]}
                  >
                    {option.label}
                  </AppText>

                  <AppText
                    style={[
                      styles.optionSubtext,
                      selected && styles.optionSubtextSelected,
                    ]}
                  >
                    {option.subtitle}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.modalButtonRow}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={handleKeepAlertsOn}
              activeOpacity={0.85}
            >
              <AppText style={styles.modalButtonSecondaryText}>Keep Alerts On</AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={handleConfirmMute}
              activeOpacity={0.85}
            >
              <AppText style={styles.modalButtonPrimaryText}>Pause Alerts</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ... styles remain the same

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { flex: 1 },

  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  helperText: {
    marginTop: spacing.md,
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  errorText: {
    ...typography.subheading,
    color: colors.error,
    textAlign: "center",
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
    elevation: 4,
  },
  overlayTitle: {
    ...typography.subheading,
    marginBottom: spacing.sm,
    color: colors.textPrimary,
  },
  overlayLine: {
    ...typography.body,
    color: colors.textSecondary,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalSheet: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.md,
    lineHeight: 20,
  },

  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  optionCard: {
    width: "48%",
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionCardSelected: {
    backgroundColor: "rgba(94, 143, 60, 0.14)",
    borderColor: "#5E8F3C",
  },
  optionLabel: {
    ...typography.subheading,
    color: colors.textPrimary,
    textAlign: "center",
  },
  optionLabelSelected: {
    color: "#2B4B1F",
    fontWeight: "900",
  },
  optionSubtext: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  optionSubtextSelected: {
    color: "#2B4B1F",
  },

  modalButtonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonSecondary: {
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  modalButtonPrimaryText: {
    ...typography.body,
    color: "#fff",
    fontWeight: "800",
  },
  modalButtonSecondaryText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "800",
  },
});