import { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";

import { auth, db } from "../../config/firebase";
import { spacing } from "../../theme";
import AppText from "../../components/ui/AppText";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/ui/ScreenHeader";

type Pet = {
  id: string;
  name: string;
  deviceId: string;
  avatarBase64?: string;
};

export default function ManagePetsScreen({ navigation }: any) {
  const uid = auth.currentUser?.uid;
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    const ref = collection(db, "users", uid, "pets");
    const unsub = onSnapshot(ref, (snap) => {
      const list: Pet[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: typeof data.name === "string" ? data.name : "Unnamed pet",
          deviceId: typeof data.deviceId === "string" ? data.deviceId : "—",
          avatarBase64:
            typeof data.avatarBase64 === "string" ? data.avatarBase64 : undefined,
        };
      });
      setPets(list);
      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  async function addDemoPet() {
    if (!uid) return;

    const petId = `pet_${Date.now()}`;
    await setDoc(doc(db, "users", uid, "pets", petId), {
      name: "New Pet",
      breed: "—",
      colorPattern: "—",
      deviceId: "DEMO-DEVICE",
      avatarBase64: "",
      geofence: { center: { lat: 43.6577, lng: -79.3792 }, radiusMeters: 120 },
      prefs: { notifyExit: true, notifyReturn: true },
      lastLocation: {
        lat: 43.6577,
        lng: -79.3792,
        timestamp: Math.floor(Date.now() / 1000),
      },
    });

    await updateDoc(doc(db, "users", uid), { activePetId: petId });
  }

  async function openPet(petId: string) {
    if (!uid) return;
    await updateDoc(doc(db, "users", uid), { activePetId: petId });
    navigation.navigate("PetDetails", { petId });
  }

  if (!uid) {
    return (
      <View style={styles.page}>
        <ScreenHeader title="Pet Profiles" onBack={() => navigation.goBack()} />
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
      <ScreenHeader title="Pet Profiles" onBack={() => navigation.goBack()} />

      <SafeAreaView edges={["bottom"]} style={styles.contentSafe}>
        <View style={styles.container}>
          <Button title="Add Demo Pet" onPress={addDemoPet} />

          <View style={{ height: spacing.md }} />

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <AppText style={styles.muted}>(Loading pets…)</AppText>
            </View>
          ) : (
            <FlatList
              data={pets}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: spacing.xl }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => openPet(item.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.rowLeft}>
                    {item.avatarBase64 ? (
                      <Image
                        source={{ uri: item.avatarBase64 }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <AppText style={styles.avatarFallbackText}>🐱</AppText>
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <AppText style={styles.petName}>{item.name}</AppText>
                      <AppText style={styles.subText}>
                        Device ID: {item.deviceId}
                      </AppText>
                    </View>
                  </View>

                  <AppText style={styles.chev}>›</AppText>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <AppText style={styles.subText}>No pets yet. Add one to begin.</AppText>
              }
            />
          )}
        </View>
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
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  muted: {
    marginTop: spacing.sm,
    color: "rgba(0,0,0,0.6)",
  },

  row: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 16,
    marginRight: spacing.md,
  },

  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  avatarFallbackText: {
    fontSize: 22,
  },

  petName: {
    fontWeight: "900",
    color: "#111",
  },

  subText: {
    color: "rgba(0,0,0,0.6)",
    marginTop: 2,
  },

  chev: {
    fontSize: 26,
    color: "rgba(0,0,0,0.35)",
    marginLeft: spacing.sm,
  },
});