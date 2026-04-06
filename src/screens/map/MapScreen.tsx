import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  TouchableOpacity,
  Image,
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
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

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
  serverTimeMs: number | null;
};

type DeviceDoc = {
  lastLocation?: {
    lat?: number;
    lng?: number;
    timestamp?: number;
    lastSeen?: number;
  };
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
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

async function fetchLatestPing(deviceId: string): Promise<ApiPing> {
  const url = `${API_BASE}/api/lastID/${encodeURIComponent(deviceId)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}`);

  const raw = await res.json();
  const parsedDate = Number(raw.date);

  return {
    pingId: raw.id ?? null,
    deviceId: raw.device_id,
    lat: Number(raw.lat),
    lng: Number(raw.long),
    serverTimeMs: Number.isFinite(parsedDate) ? parsedDate * 1000 : null,
  };
}

export default function MapScreen() {
  const uid = auth.currentUser?.uid;
  const { loading, error } = useUserLocation();

  const mapRef = useRef<MapView>(null);
  const prevInsideRef = useRef<boolean | null>(null);
  const hasValidApiLocationRef = useRef(false);
  const autoCenterResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const outsideTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const outsideMuteUntilRef = useRef<number | null>(null);
  const outsideFlowActiveRef = useRef(false);
  const outsidePromptShownRef = useRef(false);
  const outsideEpisodeDoneRef = useRef(false);
  const isInsideGeofenceRef = useRef<boolean | null>(null);

  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [petName, setPetName] = useState<string>("—");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string>("");

  const [geofence, setGeofence] = useState<Geofence>({
    center: { lat: 43.6577, lng: -79.3792 },
    radiusMeters: 120,
  });
  const [sharedGeofence, setSharedGeofence] = useState<Geofence | null>(null);

  const [prefs, setPrefs] = useState<Prefs>({
    notifyExit: true,
    notifyReturn: true,
  });

  const [catLocation, setCatLocation] = useState<LatLng | null>(null);
  const [catTimestampMs, setCatTimestampMs] = useState<number | null>(null);

  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean | null>(null);
  const [geofenceEvent, setGeofenceEvent] = useState<GeofenceEvent>(null);

  const [outsideMuteModalVisible, setOutsideMuteModalVisible] = useState(false);
  const [selectedMuteMs, setSelectedMuteMs] = useState<number>(
    OUTSIDE_MUTE_OPTIONS[2].valueMs
  );
  const [autoCenterPaused, setAutoCenterPaused] = useState(false);

  const [trackMarkerViewChanges, setTrackMarkerViewChanges] = useState(true);

  useEffect(() => {
    setupNotifications();
  }, []);

  useEffect(() => {
    isInsideGeofenceRef.current = isInsideGeofence;
  }, [isInsideGeofence]);

  useEffect(() => {
    setTrackMarkerViewChanges(true);

    const timeout = setTimeout(() => {
      setTrackMarkerViewChanges(false);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [avatarBase64, catLocation]);

  const clearOutsideTimers = useCallback(() => {
    for (const timer of outsideTimersRef.current) {
      clearTimeout(timer);
    }
    outsideTimersRef.current = [];
  }, []);

  const resetOutsideFlow = useCallback(() => {
    clearOutsideTimers();
    outsideFlowActiveRef.current = false;
    outsidePromptShownRef.current = false;
    outsideMuteUntilRef.current = null;
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

  const logAlert = useCallback(
    async (type: "GEOFENCE_EXIT" | "GEOFENCE_RETURN") => {
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
    },
    [uid, activePetId, petName]
  );

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

  const pauseAutoCenter = useCallback(() => {
    setAutoCenterPaused(true);

    if (autoCenterResumeTimeoutRef.current) {
      clearTimeout(autoCenterResumeTimeoutRef.current);
    }

    autoCenterResumeTimeoutRef.current = setTimeout(() => {
      setAutoCenterPaused(false);
      autoCenterResumeTimeoutRef.current = null;
    }, 20000);
  }, []);

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

      await logAlert("GEOFENCE_EXIT");

      if (prefs.notifyExit) {
        await sendGeofenceBreachNotification();
      }

      showOutsideMutePrompt();

      if (attemptNumber === OUTSIDE_ALERT_MAX - 1) {
        outsideFlowActiveRef.current = false;
        outsideEpisodeDoneRef.current = true;
      }
    };

    await runAttempt(0);

    for (let i = 1; i < OUTSIDE_ALERT_MAX; i++) {
      const timer = setTimeout(async () => {
        await runAttempt(i);
      }, i * OUTSIDE_ALERT_SPACING_MS);

      outsideTimersRef.current.push(timer);
    }
  }, [clearOutsideTimers, logAlert, prefs.notifyExit, showOutsideMutePrompt]);

  useEffect(() => {
    if (!uid) return;

    const userRef = doc(db, "users", uid);
    const unsub = onSnapshot(userRef, (snap) => {
      const data = snap.data() as any;
      setActivePetId(typeof data?.activePetId === "string" ? data.activePetId : null);

      const shared = data?.sharedGeofence;
      if (
        shared?.center &&
        typeof shared.center.lat === "number" &&
        typeof shared.center.lng === "number" &&
        typeof shared.radiusMeters === "number"
      ) {
        setSharedGeofence(shared);
      } else {
        setSharedGeofence(null);
      }
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    setPetName("—");
    setDeviceId(null);
    setAvatarBase64("");
    setCatLocation(null);
    setCatTimestampMs(null);
    hasValidApiLocationRef.current = false;

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

      setAvatarBase64(
        typeof data?.avatarBase64 === "string" ? data.avatarBase64 : ""
      );

      const gf = data?.geofence;
      if (
        !sharedGeofence &&
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
    });

    return () => unsub();
  }, [uid, activePetId, resetOutsideFlow, sharedGeofence]);

  const effectiveGeofence = sharedGeofence ?? geofence;

  const focusOnLiveTracking = useCallback(() => {
    if (!mapRef.current) return;

    const home = {
      latitude: effectiveGeofence.center.lat,
      longitude: effectiveGeofence.center.lng,
    };

    if (catLocation) {
      mapRef.current.fitToCoordinates([home, catLocation], {
        edgePadding: { top: 80, right: 80, bottom: 220, left: 80 },
        animated: true,
      });
      return;
    }

    mapRef.current.animateToRegion(
      {
        latitude: home.latitude,
        longitude: home.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      700
    );
  }, [catLocation, effectiveGeofence.center.lat, effectiveGeofence.center.lng]);

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

        console.log("MAP API PING:", ping);

        if (!isValidLatLng(ping.lat, ping.lng)) {
          console.log("Rejected invalid lat/lng:", ping.lat, ping.lng);
          return;
        }

        hasValidApiLocationRef.current = true;
        setCatLocation({ latitude: ping.lat, longitude: ping.lng });

        const effectiveTimeMs =
          typeof ping.serverTimeMs === "number" && Number.isFinite(ping.serverTimeMs)
            ? ping.serverTimeMs
            : Date.now();

        setCatTimestampMs(effectiveTimeMs);
      } catch (err) {
        console.log("Map polling failed:", err);
      }
    };

    run();
    timer = setInterval(run, POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [deviceId, resetOutsideFlow]);

  useEffect(() => {
    if (!deviceId) return;

    const deviceRef = doc(db, "devices", deviceId);
    const unsub = onSnapshot(deviceRef, (snap) => {
      const data = snap.data() as DeviceDoc | undefined;
      const lastLocation = data?.lastLocation;

      if (
        typeof lastLocation?.lat !== "number" ||
        typeof lastLocation?.lng !== "number" ||
        !isValidLatLng(lastLocation.lat, lastLocation.lng)
      ) {
        return;
      }

      if (hasValidApiLocationRef.current) {
        return;
      }

      setCatLocation({
        latitude: lastLocation.lat,
        longitude: lastLocation.lng,
      });

      const rawTimestamp =
        typeof lastLocation.timestamp === "number"
          ? lastLocation.timestamp
          : typeof lastLocation.lastSeen === "number"
          ? lastLocation.lastSeen
          : null;

      if (rawTimestamp !== null) {
        const effectiveTimeMs = rawTimestamp > 1_000_000_000_000 ? rawTimestamp : rawTimestamp * 1000;
        setCatTimestampMs(effectiveTimeMs);
      }
    });

    return () => unsub();
  }, [deviceId]);

  useEffect(() => {
    if (!catLocation) return;

    const d = haversineMeters(
      catLocation.latitude,
      catLocation.longitude,
      effectiveGeofence.center.lat,
      effectiveGeofence.center.lng
    );

    setDistanceMeters(d);

    const inside = d <= effectiveGeofence.radiusMeters;
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
  }, [
    catLocation,
    effectiveGeofence.center.lat,
    effectiveGeofence.center.lng,
    effectiveGeofence.radiusMeters,
  ]);

  useEffect(() => {
    if (autoCenterPaused) return;
    focusOnLiveTracking();
  }, [autoCenterPaused, focusOnLiveTracking]);

  useEffect(() => {
    if (geofenceEvent === "EXIT") {
      startOutsideAlertSequence();
    }
  }, [geofenceEvent, startOutsideAlertSequence]);

  useEffect(() => {
    if (geofenceEvent !== "RETURN") return;

    resetOutsideFlow();

    void (async () => {
      await sendGeofenceReturnNotification();
      await logAlert("GEOFENCE_RETURN");
    })();
  }, [geofenceEvent, logAlert, resetOutsideFlow]);

  useEffect(() => {
    return () => {
      clearOutsideTimers();
      if (autoCenterResumeTimeoutRef.current) {
        clearTimeout(autoCenterResumeTimeoutRef.current);
      }
    };
  }, [clearOutsideTimers]);

  const initialRegion: Region = useMemo(() => {
    const fallback = {
      latitude: effectiveGeofence.center.lat,
      longitude: effectiveGeofence.center.lng,
    };
    const center = catLocation ?? fallback;

    return {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, [catLocation, effectiveGeofence.center.lat, effectiveGeofence.center.lng]);

  const lastUpdatedText = useMemo(() => {
    if (!catTimestampMs) return "—";
    return new Date(catTimestampMs).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [catTimestampMs]);

  const onlineStatus = useMemo(() => {
    if (!deviceId) return "No device";
    if (!catTimestampMs) return "Waiting for signal…";

    const ageMs = Date.now() - catTimestampMs;
    if (ageMs <= 120_000) return "Online";
    return "Offline";
  }, [deviceId, catTimestampMs]);

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
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        onTouchStart={pauseAutoCenter}
        onPanDrag={pauseAutoCenter}
        onRegionChangeComplete={(_region, details) => {
          if ((details as { isGesture?: boolean } | undefined)?.isGesture) {
            pauseAutoCenter();
          }
        }}
      >
        {catLocation && (
          <Marker
            key={`${activePetId}-${avatarBase64 ? "avatar" : "fallback"}-${catLocation.latitude}-${catLocation.longitude}`}
            coordinate={catLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={trackMarkerViewChanges}
          >
            <View
              style={[
                styles.petMarkerWrap,
                { backgroundColor: isInsideGeofence ? "#2E7D32" : "#C62828" },
              ]}
            >
              {avatarBase64 ? (
                <Image
                  source={{ uri: avatarBase64 }}
                  style={styles.petMarkerImage}
                  resizeMode="cover"
                />
              ) : (
                <AppText style={styles.petMarkerFallback}>🐱</AppText>
              )}
            </View>
          </Marker>
        )}

        <Marker
          coordinate={{
              latitude: effectiveGeofence.center.lat,
              longitude: effectiveGeofence.center.lng,
          }}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.homeMarkerWrap}>
           <Icon name="home-map-marker" color="#2F855A" style={styles.homeMarkerText} />
          </View>
        </Marker>

        <Circle
          center={{
            latitude: effectiveGeofence.center.lat,
            longitude: effectiveGeofence.center.lng,
          }}
          radius={effectiveGeofence.radiusMeters}
          strokeWidth={3}
          strokeColor={colors.accent}
          fillColor={"rgba(249, 168, 37, 0.12)"}
          zIndex={1}
        />
      </MapView>

      <View style={styles.overlayCard}>
        <AppText style={styles.overlayTitle}>Live Tracking</AppText>

        <AppText style={styles.overlayLine}>
          Name: {activePetId ? petName : "No active pet"}
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

  petMarkerWrap: {
    padding: 4,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: "#fff",
    elevation: 6,
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  petMarkerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  petMarkerFallback: {
    fontSize: 22,
  },

  homeMarkerWrap: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: "rgba(46,125,50,0.75)",
    elevation: 6,
  },
  homeMarkerText: {
    fontSize: 25,
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
