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
import { collection, doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { spacing } from "../../theme";
import AppText from "../../components/ui/AppText";
import Button from "../../components/ui/Button";
import ScreenHeader from "../../components/ui/ScreenHeader";
import { setActivePetForCurrentUser } from "../../services/petAccountService";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

type Pet = {
  id: string;
  name: string;
  deviceId: string;
  breed?: string;
  avatarBase64?: string;
  isActive: boolean;
};

export default function ManagePetsScreen({ navigation }: any) {
  const uid = auth.currentUser?.uid;
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePetId, setActivePetId] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;

    const userRef = doc(db, "users", uid);
    const unsub = onSnapshot(userRef, (snap) => {
      const data = snap.data() as { activePetId?: string } | undefined;
      setActivePetId(typeof data?.activePetId === "string" ? data.activePetId : null);
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    const ref = collection(db, "users", uid, "pets");
    const unsub = onSnapshot(ref, (snap) => {
      const list: Pet[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: typeof data.name === "string" ? data.name : "Unnamed pet",
          deviceId: typeof data.deviceId === "string" ? data.deviceId : "-",
          breed: typeof data.breed === "string" ? data.breed : undefined,
          avatarBase64:
            typeof data.avatarBase64 === "string" ? data.avatarBase64 : undefined,
          isActive: d.id === activePetId,
        };
      });
      setPets(list);
      setLoading(false);
    });

    return () => unsub();
  }, [uid, activePetId]);

  function openPet(petId: string) {
    navigation.navigate("PetDetails", { petId });
  }

  async function setAsActive(petId: string) {
    if (!uid) return;
    await setActivePetForCurrentUser(uid, petId);
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
          <Button
            title="Add Another Pet"
            onPress={() => navigation.navigate("VerifyPetId")}
          />

          <View style={{ height: spacing.md }} />

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <AppText style={styles.muted}>(Loading pets...)</AppText>
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
                        <AppText style={styles.avatarFallbackText}>Cat</AppText>
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <View style={styles.titleRow}>
                        <AppText style={styles.petName}>{item.name}</AppText>
                      </View>

                      <AppText style={styles.subText}>
                        Device ID: {item.deviceId}
                      </AppText>
                      <AppText style={styles.subText}>
                        {item.breed || "Breed not set"}
                      </AppText>
                    </View>
                  </View>

                  <View style={styles.rowActions}>
                    <TouchableOpacity
                      onPress={() => {
                        if (!item.isActive) {
                          setAsActive(item.id);
                        }
                      }}
                      style={[
                        styles.statusPill,
                        item.isActive ? styles.statusPillActive : styles.statusPillInactive,
                        !item.isActive && styles.statusPillPressable,
                      ]}
                      activeOpacity={item.isActive ? 1 : 0.85}
                    >
                      <Icon
                        name={item.isActive ? "check-circle" : "close-circle"}
                        size={16}
                        color={item.isActive ? "#2F855A" : "#C62828"}
                      />
                      <AppText
                        style={[
                          styles.statusPillText,
                          item.isActive
                            ? styles.statusPillTextActive
                            : styles.statusPillTextInactive,
                        ]}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </AppText>
                    </TouchableOpacity>

                    <Icon name="chevron-right" size={24} color="rgba(0,0,0,0.35)" />
                  </View>
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  petName: {
    fontWeight: "900",
    color: "#111",
  },
  subText: {
    color: "rgba(0,0,0,0.6)",
    marginTop: 2,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: spacing.sm,
    gap: spacing.sm,
    flexShrink: 0,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusPillActive: {
    backgroundColor: "rgba(47,133,90,0.14)",
  },
  statusPillInactive: {
    backgroundColor: "rgba(198,40,40,0.12)",
  },
  statusPillPressable: {
    borderWidth: 1,
    borderColor: "rgba(198,40,40,0.18)",
  },
  statusPillText: {
    fontWeight: "800",
  },
  statusPillTextActive: {
    color: "#2F855A",
  },
  statusPillTextInactive: {
    color: "#C62828",
  },
});
