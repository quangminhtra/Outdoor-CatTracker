import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
} from "react-native";
import MapView, { Marker, Circle, Polyline, Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";

import { auth, db } from "../../config/firebase";
import { spacing, typography } from "../../theme";
import { haversineMeters } from "../../utils/geo";
import AppText from "../../components/ui/AppText";
import { setupNotifications } from "../../services/notificationService";

type LatLng = { latitude: number; longitude: number };

type Geofence = {
  center: { lat: number; lng: number };
  radiusMeters: number;
};

type PetDoc = {
  name?: string;
  breed?: string;
  deviceId?: string;
  avatarBase64?: string;
  geofence?: Geofence;
  lastLocation?: { lat?: number; lng?: number; timestamp?: number };
};

type PetOption = {
  id: string;
  name: string;
  breed?: string;
  colorPattern?: string;
  avatarBase64?: string;
};

type ApiPing = {
  pingId: number | null;
  deviceId: string;
  lat: number;
  lng: number;
  serverTimeMs: number;
};

const GREEN = "#5E8F3C";
const YELLOW = "#F4D35E";

const API_BASE = "https://oblanceolate-unfactual-mckinley.ngrok-free.dev";
const POLL_MS = 5000;

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

export default function DashboardScreen({ navigation }: any) {
  const uid = auth.currentUser?.uid;
  const mapRef = useRef<MapView>(null);

  const [loading, setLoading] = useState(true);
  const [activePetId, setActivePetId] = useState<string | null>(null);

  const [petName, setPetName] = useState("—");
  const [petBreed, setPetBreed] = useState<string | undefined>(undefined);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string>("");

  const [pets, setPets] = useState<PetOption[]>([]);
  const [petModalOpen, setPetModalOpen] = useState(false);

  const [geofence, setGeofence] = useState<Geofence>({
    center: { lat: 43.6577, lng: -79.3792 },
    radiusMeters: 120,
  });

  const [petCachedLoc, setPetCachedLoc] = useState<LatLng | null>(null);
  const [petCachedTsMs, setPetCachedTsMs] = useState<number | null>(null);

  const [deviceLoc, setDeviceLoc] = useState<LatLng | null>(null);
  const [lastSeenMs, setLastSeenMs] = useState<number | null>(null);
  const [lastTsMs, setLastTsMs] = useState<number | null>(null);

  const [trackMarkerViewChanges, setTrackMarkerViewChanges] = useState(true);

  useEffect(() => {
    setupNotifications();
  }, []);

  useEffect(() => {
    if (!uid) return;

    const userRef = doc(db, "users", uid);
    const unsub = onSnapshot(userRef, (snap) => {
      const data = snap.data() as any;
      setActivePetId(typeof data?.activePetId === "string" ? data.activePetId : null);
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    const petsRef = collection(db, "users", uid, "pets");
    const unsub = onSnapshot(petsRef, (snap) => {
      const list: PetOption[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: typeof data?.name === "string" ? data.name : d.id,
          breed: typeof data?.breed === "string" ? data.breed : undefined,
          colorPattern:
            typeof data?.colorPattern === "string" ? data.colorPattern : undefined,
          avatarBase64:
            typeof data?.avatarBase64 === "string" ? data.avatarBase64 : undefined,
        };
      });

      setPets(list);
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid || !activePetId) return;

    setLoading(true);

    setPetName("—");
    setPetBreed(undefined);
    setDeviceId(null);
    setAvatarBase64("");
    setPetCachedLoc(null);
    setPetCachedTsMs(null);

    const petRef = doc(db, "users", uid, "pets", activePetId);
    const unsub = onSnapshot(petRef, (snap) => {
      const data = snap.data() as PetDoc | undefined;
      if (!data) return;

      setPetName(typeof data.name === "string" && data.name.trim() ? data.name : "—");
      setPetBreed(typeof data.breed === "string" ? data.breed : undefined);

      const dev = data.deviceId;
      setDeviceId(typeof dev === "string" && dev.trim() ? dev : null);

      setAvatarBase64(
        typeof data.avatarBase64 === "string" ? data.avatarBase64 : ""
      );

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
      const tsNum = typeof ll?.timestamp === "number" ? ll.timestamp : Number(ll?.timestamp);

      if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
        setPetCachedLoc({ latitude: latNum, longitude: lngNum });
      } else {
        setPetCachedLoc(null);
      }

      if (Number.isFinite(tsNum)) setPetCachedTsMs(tsNum);
      else setPetCachedTsMs(null);

      setLoading(false);
    });

    return () => unsub();
  }, [uid, activePetId]);

  useEffect(() => {
    setDeviceLoc(null);
    setLastSeenMs(null);
    setLastTsMs(null);

    if (!deviceId) return;

    let cancelled = false;

    const run = async () => {
      try {
        const ping = await fetchLatestPing(deviceId);
        if (cancelled) return;

        if (!isValidLatLng(ping.lat, ping.lng)) return;

        setDeviceLoc({ latitude: ping.lat, longitude: ping.lng });
        setLastTsMs(ping.serverTimeMs);
        setLastSeenMs(ping.serverTimeMs);
      } catch {
        // fallback still works from cached pet location
      }
    };

    run();
    const timer = setInterval(run, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [deviceId]);

  const catLocation = deviceLoc ?? petCachedLoc;

  useEffect(() => {
    setTrackMarkerViewChanges(true);

    const timeout = setTimeout(() => {
      setTrackMarkerViewChanges(false);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [avatarBase64, catLocation]);

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

  const safeZoneText = useMemo(() => {
    if (!catLocation || distanceMeters === null) return "—";
    return distanceMeters <= geofence.radiusMeters ? "Inside" : "Outside";
  }, [catLocation, distanceMeters, geofence.radiusMeters]);

  const lastSeenText = useMemo(() => {
    const t = lastSeenMs ?? petCachedTsMs ?? null;
    if (!t) return "—";

    const ageMs = Date.now() - t;
    if (ageMs < 60_000) return "Just now";

    const mins = Math.floor(ageMs / 60_000);
    if (mins < 60) return `${mins} mins ago`;

    const hrs = Math.floor(mins / 60);
    return `${hrs} hrs ago`;
  }, [lastSeenMs, petCachedTsMs]);

  const previewRegion: Region = useMemo(() => {
    const home = { latitude: geofence.center.lat, longitude: geofence.center.lng };
    const center = catLocation ?? home;

    return {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, [catLocation, geofence.center.lat, geofence.center.lng]);

  useEffect(() => {
    if (!mapRef.current) return;

    const home = { latitude: geofence.center.lat, longitude: geofence.center.lng };

    if (catLocation) {
      mapRef.current.fitToCoordinates([home, catLocation], {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    }
  }, [catLocation, geofence.center.lat, geofence.center.lng]);

  const updatedText = useMemo(() => {
    const t = lastTsMs ?? petCachedTsMs ?? null;
    if (!t) return "—";
    return new Date(t).toLocaleTimeString();
  }, [lastTsMs, petCachedTsMs]);

  function openPetSwitcher() {
    setPetModalOpen(true);
  }

  async function selectPet(petId: string) {
    if (!uid) return;
    await updateDoc(doc(db, "users", uid), { activePetId: petId });
    setPetModalOpen(false);
  }

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
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <AppText style={styles.paw}>🐾</AppText>
          <AppText variant="heading" style={styles.headerTitle}>
            Location
          </AppText>
        </View>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.petCard}
          activeOpacity={0.85}
          onPress={openPetSwitcher}
        >
          <View style={styles.petLeft}>
            <View style={styles.petAvatar}>
              {avatarBase64 ? (
                <Image source={{ uri: avatarBase64 }} style={styles.petAvatarImage} />
              ) : (
                <AppText style={styles.petAvatarFallback}>🐱</AppText>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <AppText style={styles.petNameText}>{petName}</AppText>
              <AppText style={styles.petSubText}>{petBreed ?? "—"}</AppText>
            </View>
          </View>

          <AppText style={styles.chevron}>⌄</AppText>
        </TouchableOpacity>

        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={previewRegion}
            pointerEvents="none"
          >
            <Marker
              coordinate={{ latitude: geofence.center.lat, longitude: geofence.center.lng }}
              title="Home"
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.homeMarker}>
                <AppText style={styles.homeMarkerText}>🏠</AppText>
              </View>
            </Marker>

            <Circle
              center={{ latitude: geofence.center.lat, longitude: geofence.center.lng }}
              radius={geofence.radiusMeters}
              strokeWidth={2}
              strokeColor="rgba(255, 255, 255, 0.9)"
              fillColor="rgba(255, 153, 0, 0.15)"
            />

            {catLocation ? (
              <>
                <Marker
                  key={`${activePetId}-${avatarBase64 ? "avatar" : "fallback"}-${catLocation.latitude}-${catLocation.longitude}`}
                  coordinate={catLocation}
                  title={petName}
                  tracksViewChanges={trackMarkerViewChanges}
                >
                  <View
                    style={[
                      styles.mapPetMarkerWrap,
                      safeZoneText === "Inside"
                        ? styles.mapPetMarkerInside
                        : styles.mapPetMarkerOutside,
                    ]}
                  >
                    {avatarBase64 ? (
                      <Image
                        source={{ uri: avatarBase64 }}
                        style={styles.mapPetMarkerImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <AppText style={styles.mapPetMarkerFallback}>🐱</AppText>
                    )}
                  </View>
                </Marker>

                <Polyline
                  coordinates={[
                    { latitude: geofence.center.lat, longitude: geofence.center.lng },
                    catLocation,
                  ]}
                  strokeWidth={3}
                  strokeColor="rgba(0,0,0,0.55)"
                />
              </>
            ) : null}
          </MapView>

          <View style={styles.mapPill}>
            <AppText style={styles.mapPillText}>Distance: {distanceText}</AppText>
          </View>
        </View>

        <View style={styles.pillsRow}>
          <TouchableOpacity
            style={styles.pill}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("Map")}
          >
            <AppText style={styles.pillTitle}>Safe Zone</AppText>
            <AppText
              style={[
                styles.pillValue,
                safeZoneText === "Inside" && styles.safeInside,
                safeZoneText === "Outside" && styles.safeOutside,
              ]}
            >
              {safeZoneText}
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

        <TouchableOpacity
          style={styles.openMapBtn}
          onPress={() => navigation.navigate("Map")}
          activeOpacity={0.85}
        >
          <AppText style={styles.openMapText}>Open Live Map • Updated {updatedText}</AppText>
        </TouchableOpacity>
      </View>

      <Modal
        transparent
        visible={petModalOpen}
        animationType="slide"
        onRequestClose={() => setPetModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPetModalOpen(false)} />
        <View style={styles.modalSheet}>
          <AppText variant="subheading" style={styles.modalTitle}>
            Select Pet
          </AppText>

          {pets.map((p) => {
            const selected = p.id === activePetId;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.modalItem, selected && styles.modalItemSelected]}
                onPress={() => selectPet(p.id)}
                activeOpacity={0.85}
              >
                <View style={styles.modalAvatar}>
                  {p.avatarBase64 ? (
                    <Image source={{ uri: p.avatarBase64 }} style={styles.modalAvatarImage} />
                  ) : (
                    <AppText style={styles.modalAvatarText}>🐱</AppText>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <AppText style={styles.modalName}>{p.name}</AppText>
                  <AppText style={styles.modalSub}>
                    {p.breed ?? p.colorPattern ?? `Pet ID: ${p.id}`}
                  </AppText>
                </View>

                {selected ? <AppText style={styles.modalCheck}>✓</AppText> : null}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setPetModalOpen(false)}
            activeOpacity={0.85}
          >
            <AppText style={styles.modalCloseText}>Close</AppText>
          </TouchableOpacity>
        </View>
      </Modal>
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
    borderBottomColor: "rgba(255,255,255,0.25)",
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
    marginBottom: spacing.md,
  },
  petLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },

  petAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  petAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
  },
  petAvatarFallback: {
    fontSize: 18,
  },

  petNameText: { ...typography.subheading, color: "#2b4b1f" },
  petSubText: { ...typography.body, color: "rgba(0,0,0,0.55)", marginTop: 2 },
  chevron: { fontSize: 20, color: "rgba(0,0,0,0.55)", marginLeft: spacing.sm },

  mapWrap: {
    height: 330,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: spacing.md,
  },
  map: { flex: 1 },

  mapPetMarkerWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  mapPetMarkerInside: {
    backgroundColor: "#2E7D32",
  },
  mapPetMarkerOutside: {
    backgroundColor: "#C62828",
  },
  mapPetMarkerImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  mapPetMarkerFallback: {
    fontSize: 20,
  },

  mapPill: {
    position: "absolute",
    left: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapPillText: { ...typography.body, color: "#fff", fontWeight: "800" },

  pillsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pill: {
    flex: 1,
    backgroundColor: YELLOW,
    borderRadius: 18,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  pillTitle: { ...typography.body, color: "rgba(0,0,0,0.65)", fontWeight: "800" },
  pillValue: {
    ...typography.subheading,
    color: "#111",
    marginTop: 4,
    fontWeight: "900",
  },
  safeInside: {
    color: "#2E7D32",
  },
  safeOutside: {
    color: "#C62828",
  },

  openMapBtn: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
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
    borderColor: "rgba(0,0,0,0.15)",
  },
  homeMarkerText: { fontSize: 18 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  modalSheet: {
    backgroundColor: "#fff",
    padding: spacing.md,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  modalTitle: { color: "#111", marginBottom: spacing.sm },

  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.03)",
    marginBottom: spacing.sm,
  },
  modalItemSelected: { backgroundColor: "rgba(94, 143, 60, 0.12)" },

  modalAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(244, 211, 94, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  modalAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  modalAvatarText: { fontSize: 18 },
  modalName: { ...typography.subheading, color: "#111" },
  modalSub: { ...typography.body, color: "rgba(0,0,0,0.55)", marginTop: 2 },
  modalCheck: { fontSize: 18, fontWeight: "900", color: GREEN },

  modalClose: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
    marginTop: spacing.sm,
  },
  modalCloseText: { ...typography.subheading, color: "#111" },
});