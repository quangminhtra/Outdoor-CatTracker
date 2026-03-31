import { useMemo, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Region, LongPressEvent } from "react-native-maps";
import { auth } from "../../config/firebase";
import { spacing } from "../../theme";
import AppText from "../../components/ui/AppText";
import ScreenHeader from "../../components/ui/ScreenHeader";
import { updateHomebaseForAllPets } from "../../services/petAccountService";

type Center = { lat: number; lng: number };

export default function GeofencePickerScreen({ route, navigation }: any) {
  const { petId, center, radiusMeters } = route.params as {
    petId: string;
    center: Center;
    radiusMeters: number;
  };

  const mapRef = useRef<MapView>(null);
  const [selected, setSelected] = useState<Center>(center);
  const [saving, setSaving] = useState(false);

  const initialRegion: Region = useMemo(() => {
    return {
      latitude: center.lat,
      longitude: center.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01
    };
  }, [center.lat, center.lng]);

  function onLongPress(e: LongPressEvent) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelected({ lat: latitude, lng: longitude });
  }

  async function save() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      setSaving(true);

      await updateHomebaseForAllPets(uid, {
        center: { lat: selected.lat, lng: selected.lng },
        radiusMeters,
      });

      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.page}>
      <ScreenHeader title="Pick Home" onBack={() => navigation.goBack()} />

      {/* Map fills the screen under the header */}
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          onLongPress={onLongPress}
        >
          <Marker
            coordinate={{ latitude: selected.lat, longitude: selected.lng }}
            title="Home (Geofence Center)"
            description="Long-press to move"
          />
        </MapView>

        {/* Bottom overlay card */}
        <SafeAreaView edges={["bottom"]} style={styles.overlaySafe}>
          <View style={styles.overlay}>
            <AppText style={styles.title}>Pick Home on Map</AppText>

            <AppText style={styles.line}>
              Long-press anywhere to set the safe zone center.
            </AppText>

            <AppText style={styles.line}>
              Selected: {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
            </AppText>

            <View style={{ height: spacing.md }} />

            <View style={styles.row}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => navigation.goBack()}
                activeOpacity={0.85}
                disabled={saving}
              >
                <AppText style={styles.btnSecondaryText}>Cancel</AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btn}
                onPress={save}
                activeOpacity={0.85}
                disabled={saving}
              >
                <AppText style={styles.btnText}>{saving ? "Saving…" : "Save"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const GREEN = "#5E8F3C";

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: GREEN
  },

  mapWrap: {
    flex: 1,
    backgroundColor: "#000"
  },

  overlaySafe: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0
  },

  overlay: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6
  },

  title: {
    fontWeight: "900",
    color: "#111",
    fontSize: 16
  },

  line: {
    color: "rgba(0,0,0,0.65)",
    marginTop: spacing.xs
  },

  row: {
    flexDirection: "row",
    gap: spacing.sm
  },

  btn: {
    flex: 1,
    backgroundColor: "#2e7d32", // keeps your "save" green feel
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center"
  },
  btnText: {
    color: "#fff",
    fontWeight: "900"
  },

  btnSecondary: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center"
  },
  btnSecondaryText: {
    color: "#111",
    fontWeight: "900"
  }
});
