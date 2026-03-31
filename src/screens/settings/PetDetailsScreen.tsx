import { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "../../config/firebase";
import { spacing } from "../../theme";
import AppText from "../../components/ui/AppText";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/ui/ScreenHeader";
import {
  removePetFromCurrentUser,
  setActivePetForCurrentUser,
} from "../../services/petAccountService";

type PetDoc = {
  name?: string;
  breed?: string;
  colorPattern?: string;
  deviceId?: string;
  avatarBase64?: string;
  geofence?: {
    center?: { lat?: number; lng?: number };
    radiusMeters?: number;
  };
  prefs?: {
    notifyExit?: boolean;
    notifyReturn?: boolean;
  };
};

export default function PetDetailsScreen({ route, navigation }: any) {
  const uid = auth.currentUser?.uid;
  const { petId } = route.params as { petId: string };

  const [loading, setLoading] = useState(true);
  const [petDoc, setPetDoc] = useState<PetDoc | null>(null);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const [geofenceText, setGeofenceText] = useState("-");

  useEffect(() => {
    if (!uid) return;

    const refDoc = doc(db, "users", uid, "pets", petId);
    const unsub = onSnapshot(refDoc, (snap) => {
      const data = (snap.data() as PetDoc) ?? {};
      setPetDoc(data);

      const lat = data.geofence?.center?.lat;
      const lng = data.geofence?.center?.lng;
      const radius = data.geofence?.radiusMeters;

      if (
        typeof lat === "number" &&
        typeof lng === "number" &&
        typeof radius === "number"
      ) {
        setGeofenceText(`${lat.toFixed(5)}, ${lng.toFixed(5)} | ${Math.round(radius)}m`);
      } else {
        setGeofenceText("-");
      }

      setLoading(false);
    });

    return () => unsub();
  }, [uid, petId]);

  useEffect(() => {
    if (!uid) return;

    const userRef = doc(db, "users", uid);
    const unsub = onSnapshot(userRef, (snap) => {
      const data = snap.data() as { activePetId?: string } | undefined;
      setActivePetId(typeof data?.activePetId === "string" ? data.activePetId : null);
    });

    return () => unsub();
  }, [uid]);

  const displayName = useMemo(() => {
    const trimmed = petDoc?.name?.trim();
    return trimmed || "Pet";
  }, [petDoc?.name]);

  async function setAsActive() {
    if (!uid) return;

    try {
      await setActivePetForCurrentUser(uid, petId);
      Alert.alert("Active Pet Updated", `${displayName} is now active.`);
    } catch (err) {
      console.log("Set active pet failed", err);
      Alert.alert("Error", "Could not set this pet as active.");
    }
  }

  function openEditPet() {
    navigation.navigate("EditPet", { mode: "edit", petId });
  }

  function openGeofencePicker() {
    const center = petDoc?.geofence?.center;
    const radiusMeters = petDoc?.geofence?.radiusMeters;

    navigation.navigate("GeofencePicker", {
      petId,
      center:
        typeof center?.lat === "number" && typeof center?.lng === "number"
          ? { lat: center.lat, lng: center.lng }
          : { lat: 43.6577, lng: -79.3792 },
      radiusMeters: typeof radiusMeters === "number" ? radiusMeters : 120,
    });
  }

  function confirmRemovePet() {
    if (!uid || removing) return;

    Alert.alert(
      "Remove Pet",
      `${displayName} will be removed from this account. The device ID will be released so it can be linked to another account later.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setRemoving(true);
              await removePetFromCurrentUser(uid, petId);

              if (navigation.canGoBack()) {
                navigation.goBack();
                return;
              }

              navigation.navigate("ManagePets");
            } catch (err) {
              console.log("Remove pet failed", err);
              Alert.alert("Error", "Could not remove this pet.");
            } finally {
              setRemoving(false);
            }
          },
        },
      ]
    );
  }

  if (!uid) {
    return (
      <View style={styles.page}>
        <ScreenHeader title="Pet Profile" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <AppText variant="subheading" style={{ color: "#111" }}>
            Not logged in
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScreenHeader title="Pet Profile" onBack={() => navigation.goBack()} />

      <SafeAreaView edges={["bottom"]} style={styles.contentSafe}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <AppText style={styles.muted}>Loading pet...</AppText>
            </View>
          ) : (
            <>
              <View style={styles.avatarSection}>
                {petDoc?.avatarBase64 ? (
                  <Image source={{ uri: petDoc.avatarBase64 }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <AppText style={styles.avatarFallbackText}>Cat</AppText>
                  </View>
                )}

                <AppText style={styles.petTitle}>{displayName}</AppText>
                {activePetId === petId ? (
                  <View style={styles.activeBadge}>
                    <AppText style={styles.activeBadgeText}>Current Active Pet</AppText>
                  </View>
                ) : null}
              </View>

              <View style={styles.card}>
                <AppText style={styles.label}>Name</AppText>
                <AppText style={styles.valueText}>{petDoc?.name || "-"}</AppText>

                <View style={{ height: spacing.md }} />

                <AppText style={styles.label}>Breed</AppText>
                <AppText style={styles.valueText}>{petDoc?.breed || "-"}</AppText>

                <View style={{ height: spacing.md }} />

                <AppText style={styles.label}>Color & Pattern</AppText>
                <AppText style={styles.valueText}>{petDoc?.colorPattern || "-"}</AppText>

                <View style={{ height: spacing.md }} />

                <AppText style={styles.label}>Device ID</AppText>
                <AppText style={styles.valueText}>{petDoc?.deviceId || "-"}</AppText>
              </View>

              <View style={{ height: spacing.md }} />

              <View style={styles.card}>
                <AppText style={styles.label}>Safe Zone</AppText>
                <AppText style={styles.valueText}>{geofenceText}</AppText>

                <View style={{ height: spacing.md }} />

                <AppText style={styles.label}>Notifications</AppText>
                <AppText style={styles.valueText}>
                  Exit alerts: {petDoc?.prefs?.notifyExit ? "On" : "Off"}
                </AppText>
                <AppText style={styles.valueText}>
                  Return alerts: {petDoc?.prefs?.notifyReturn ? "On" : "Off"}
                </AppText>
              </View>

              <View style={{ height: spacing.lg }} />

              <Button title="Edit Pet Details" onPress={openEditPet} />

              <View style={{ height: spacing.sm }} />

              <Button
                title="Pick Home on Map"
                variant="secondary"
                onPress={openGeofencePicker}
              />

              <View style={{ height: spacing.sm }} />

              <Button
                title={activePetId === petId ? "Current Active Pet" : "Set as Active Pet"}
                variant="secondary"
                onPress={setAsActive}
                disabled={activePetId === petId}
              />

              <View style={{ height: spacing.sm }} />

              <TouchableOpacity
                style={styles.removeButton}
                onPress={confirmRemovePet}
                activeOpacity={0.85}
                disabled={removing}
              >
                <AppText style={styles.removeButtonText}>
                  {removing ? "Removing..." : "Remove Pet From Account"}
                </AppText>
              </TouchableOpacity>

              <AppText style={styles.removeHint}>
                Removing a pet also releases its device ID so it can be linked to another account later.
              </AppText>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentSafe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 250,
  },
  muted: {
    marginTop: spacing.sm,
    color: "rgba(0,0,0,0.6)",
  },

  avatarSection: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 42,
  },
  petTitle: {
    marginTop: spacing.sm,
    fontSize: 22,
    fontWeight: "900",
    color: "#111",
  },
  activeBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(47,133,90,0.12)",
  },
  activeBadgeText: {
    color: "#2F855A",
    fontWeight: "900",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  label: {
    color: "#111",
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  valueText: {
    color: "#111",
  },
  removeButton: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(198,40,40,0.10)",
    borderWidth: 1,
    borderColor: "rgba(198,40,40,0.28)",
  },
  removeButtonText: {
    color: "#C62828",
    fontWeight: "900",
  },
  removeHint: {
    color: "rgba(0,0,0,0.6)",
    marginTop: spacing.sm,
  },
});
