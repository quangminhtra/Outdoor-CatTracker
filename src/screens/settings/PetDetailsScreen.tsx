import { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";

import { auth, db } from "../../config/firebase";
import { spacing } from "../../theme";
import AppText from "../../components/ui/AppText";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/ui/ScreenHeader";

export default function PetDetailsScreen({ route, navigation }: any) {
  const uid = auth.currentUser?.uid;
  const { petId } = route.params as { petId: string };

  const [pet, setPet] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    const ref = doc(db, "users", uid, "pets", petId);
    const unsub = onSnapshot(ref, (snap) => {
      setPet(snap.data() ?? null);
      setLoading(false);
    });

    return () => unsub();
  }, [uid, petId]);

  const geofenceText = useMemo(() => {
    const gf = pet?.geofence;
    if (!gf?.center) return "—";
    const r = typeof gf.radiusMeters === "number" ? gf.radiusMeters : 0;
    return `${gf.center.lat.toFixed(5)}, ${gf.center.lng.toFixed(5)} | ${Math.round(r)}m`;
  }, [pet]);

  async function setAsActive() {
    if (!uid) return;
    await updateDoc(doc(db, "users", uid), { activePetId: petId });
  }

  function openGeofencePicker() {
    const gf = pet?.geofence;

    
    navigation.navigate("GeofencePicker", {
      petId: petId,
      center: gf?.center ?? { lat: 43.6577, lng: -79.3792 },
      radiusMeters: gf?.radiusMeters ?? 120
    });
  }

  if (!uid) {
    return (
      <View style={styles.page}>
        <ScreenHeader title="Pet" onBack={() => navigation.goBack()} />
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
        <View style={styles.container}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <AppText style={styles.muted}>(Loading pet…)</AppText>
            </View>
          ) : !pet ? (
            <View style={styles.center}>
              <AppText variant="subheading" style={{ color: "#111" }}>
                Pet not found
              </AppText>
            </View>
          ) : (
            <>
              <AppText variant="heading" style={styles.title}>
                {pet.name || "Pet"}
              </AppText>

              <View style={styles.card}>
                <AppText style={styles.line}>Device ID: {pet.deviceId || "—"}</AppText>
                <AppText style={styles.line}>Breed: {pet.breed || "—"}</AppText>
                <AppText style={styles.line}>Color/Pattern: {pet.colorPattern || "—"}</AppText>

                <View style={{ height: spacing.sm }} />

                <AppText style={styles.line}>Safe Zone: {geofenceText}</AppText>
              </View>

              <View style={{ height: spacing.md }} />

              <Button
                title="Edit Pet"
                onPress={() => navigation.navigate("EditPet", { petId })}
              />

              <View style={{ height: spacing.sm }} />

              <Button
                title="Pick Home on Map"
                variant="secondary"
                onPress={openGeofencePicker}
              />

              <View style={{ height: spacing.sm }} />

              <Button
                title="Set as Active Pet"
                variant="secondary"
                onPress={setAsActive}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const GREEN = "#5E8F3C";

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#fff"
  },
  contentSafe: {
    flex: 1
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg
  },

  title: {
    color: "#111",
    marginBottom: spacing.md
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  muted: {
    marginTop: spacing.sm,
    color: "rgba(0,0,0,0.6)"
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
    elevation: 3
  },
  line: {
    color: "rgba(0,0,0,0.7)",
    marginTop: 2
  }
});
