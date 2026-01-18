import { useEffect, useMemo, useRef, useState } from "react"; // import for follow the cat location live
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import MapView, { Marker, Circle, Region } from "react-native-maps";
import { useUserLocation } from "../../hooks/useUserLocation";
import { colors, spacing, typography } from "../../theme";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";


type LatLng = { latitude: number; longitude: number };

export default function MapScreen() {
  const { location: userLocation, loading, error } = useUserLocation();

  const mapRef = useRef<MapView>(null); // ref for map view aka cat location


  // Live cat location from Firestore
  const [catLocation, setCatLocation] = useState<LatLng | null>(null);
  const [catTimestamp, setCatTimestamp] = useState<number | null>(null);

  // Geofence (demo: set to your school)
  const geofence = useMemo(
    () => ({
      center: { latitude: 43.6577, longitude: -79.3792 },
      radiusMeters: 120
    }),
    []
  );

  // Firestore listener for cat location
  useEffect(() => {
    const ref = doc(db, "cats", "demoCat");

    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      if (!data?.lastLocation) return;

      const { lat, lng, timestamp } = data.lastLocation;

      if (typeof lat === "number" && typeof lng === "number") {
        setCatLocation({ latitude: lat, longitude: lng });
      }


      // Assumes Unix timestamp in seconds. If we store in milliseconds, remove *1000 below.
      if (typeof timestamp === "number") {
        setCatTimestamp(timestamp);
      }
    });

    return () => unsub();
  }, []);

// Auto-center map on cat location when it updates
// Auto-center map on cat location when it updates
useEffect(() => {
  if (!catLocation) return;

    mapRef.current?.animateToRegion(
     {
        latitude: catLocation.latitude,
        longitude: catLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
        },
        700
    );
    }, [catLocation]);


  // Initial region: prefer CAT -> USER -> GEOFENCE CENTER (always non-null)
  const initialRegion: Region = useMemo(() => {
    const fallback = geofence.center;
    const center = catLocation ?? userLocation ?? fallback;

    return {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01
    };
  }, [catLocation, userLocation, geofence.center]);

  const lastUpdatedText = useMemo(() => {
    if (!catTimestamp) return "—";
    // Unix seconds -> ms
    return new Date(catTimestamp * 1000).toLocaleTimeString();
  }, [catTimestamp]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.helperText}>Getting your location…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          Location permission is required to show your position on the map.
        </Text>
        <Text style={styles.helperText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion} showsUserLocation>
        {/* CAT MARKER (live from Firestore) */}
        {catLocation && (
          <Marker
            coordinate={catLocation}
            title="Whiskers (Cat)"
            description="Last known location (Firestore)"
          />
        )}

        {/* Geofence visualization */}
        <Circle
          center={geofence.center}
          radius={geofence.radiusMeters}
          strokeWidth={2}
          strokeColor={colors.accent}
          fillColor={"rgba(249, 168, 37, 0.15)"}
        />
      </MapView>

      {/* Overlay status card */}
      <View style={styles.overlayCard}>
        <Text style={styles.overlayTitle}>Live Tracking</Text>
        <Text style={styles.overlayLine}>
          Cat: {catLocation ? "Connected (Firestore)" : "No data"}
        </Text>
        <Text style={styles.overlayLine}>
          Updated: {lastUpdatedText}
        </Text>
        <Text style={styles.overlayLine}>
          You: {userLocation ? "Location enabled" : "Unknown"}
        </Text>
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
  }
});
