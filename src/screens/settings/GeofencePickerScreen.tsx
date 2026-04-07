import { useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Region, LongPressEvent } from "react-native-maps";
import * as Location from "expo-location";
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
  const [address, setAddress] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

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
    setSearchError("");
  }

  async function searchAddress() {
    const trimmed = address.trim();
    if (!trimmed) {
      setSearchError("Enter an address to search.");
      return;
    }

    try {
      setSearching(true);
      setSearchError("");

      const results = await Location.geocodeAsync(trimmed);
      const first = results[0];

      if (!first) {
        setSearchError("Address not found. Try a more specific address.");
        return;
      }

      const nextCenter = {
        lat: first.latitude,
        lng: first.longitude,
      };

      setSelected(nextCenter);

      mapRef.current?.animateToRegion(
        {
          latitude: nextCenter.lat,
          longitude: nextCenter.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        700
      );
    } catch (_error) {
      setSearchError("Could not search that address right now.");
    } finally {
      setSearching(false);
    }
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
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
          >
          <View style={styles.overlay}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.overlayContent}
            >
            <AppText style={styles.title}>Pick Home on Map</AppText>

            <AppText style={styles.line}>
              Search an address or long-press on the map to set the safe zone center.
            </AppText>

            <View style={{ height: spacing.md }} />

            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Search address"
              placeholderTextColor="rgba(0,0,0,0.35)"
              style={styles.input}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={searchAddress}
            />

            {searchError ? <AppText style={styles.errorText}>{searchError}</AppText> : null}

            <View style={{ height: spacing.sm }} />

            <TouchableOpacity
              style={styles.searchBtn}
              onPress={searchAddress}
              activeOpacity={0.85}
              disabled={searching}
            >
              <AppText style={styles.searchBtnText}>
                {searching ? "Searching..." : "Search Address"}
              </AppText>
            </TouchableOpacity>

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
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
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
    elevation: 6,
    maxHeight: "58%",
  },
  overlayContent: {
    paddingBottom: spacing.xs,
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
  input: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#F7F7F7",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 14,
    color: "#111",
  },
  errorText: {
    marginTop: spacing.xs,
    color: "#C62828",
    fontWeight: "700",
  },
  searchBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(46,125,50,0.12)",
    marginBottom: spacing.xs,
  },
  searchBtnText: {
    color: "#2e7d32",
    fontWeight: "900",
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
