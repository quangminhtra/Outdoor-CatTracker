import { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  Switch,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

import { auth, db } from "../../config/firebase";
import { spacing, typography } from "../../theme";
import AppText from "../../components/ui/AppText";

type PetOption = {
  id: string;
  name: string;
  breed?: string;
  colorPattern?: string;
  avatarBase64?: string;
  prefs?: {
    notifyExit?: boolean;
    notifyReturn?: boolean;
    masterEnabled?: boolean;
    lastNotifyExit?: boolean;
    lastNotifyReturn?: boolean;
  };
};

type AlertDoc = {
  id: string;
  type: "GEOFENCE_EXIT" | "GEOFENCE_RETURN" | string;
  message: string;
  actionTip?: string;
  timestampMs?: number;
  timestamp?: number;
};

const GREEN = "#5E8F3C";
const YELLOW = "#F4D35E";

export default function AlertsScreen() {
  const uid = auth.currentUser?.uid;

  const [pets, setPets] = useState<PetOption[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [activePet, setActivePet] = useState<PetOption | null>(null);
  const [activePetPrefs, setActivePetPrefs] = useState<PetOption["prefs"] | null>(null);

  const [alerts, setAlerts] = useState<AlertDoc[]>([]);
  const [petModalOpen, setPetModalOpen] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);

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
          prefs: data?.prefs,
        };
      });

      setPets(list);

      if (!activePetId && list.length > 0) {
        updateDoc(doc(db, "users", uid), { activePetId: list[0].id });
      }
    });

    return () => unsub();
  }, [uid, activePetId]);

  useEffect(() => {
    if (!activePetId) {
      setActivePet(null);
      return;
    }

    const found = pets.find((p) => p.id === activePetId) ?? null;
    setActivePet(found);
  }, [pets, activePetId]);

  useEffect(() => {
    if (!uid || !activePetId) {
      setActivePetPrefs(null);
      return;
    }

    const petRef = doc(db, "users", uid, "pets", activePetId);
    const unsub = onSnapshot(petRef, (snap) => {
      const data = snap.data() as any;
      const p = data?.prefs;

      if (!p) {
        setActivePetPrefs(null);
        return;
      }

      setActivePetPrefs({
        notifyExit: typeof p.notifyExit === "boolean" ? p.notifyExit : undefined,
        notifyReturn: typeof p.notifyReturn === "boolean" ? p.notifyReturn : undefined,
        masterEnabled: typeof p.masterEnabled === "boolean" ? p.masterEnabled : undefined,
        lastNotifyExit: typeof p.lastNotifyExit === "boolean" ? p.lastNotifyExit : undefined,
        lastNotifyReturn: typeof p.lastNotifyReturn === "boolean" ? p.lastNotifyReturn : undefined,
      });
    });

    return () => unsub();
  }, [uid, activePetId]);

  useEffect(() => {
    const exitOn = !!activePetPrefs?.notifyExit;
    const returnOn = !!activePetPrefs?.notifyReturn;
    setNotifEnabled(exitOn || returnOn);
  }, [activePetPrefs]);

  useEffect(() => {
    if (!uid || !activePetId) {
      setAlerts([]);
      return;
    }

    const ref = collection(db, "users", uid, "pets", activePetId, "alerts");
    const q = query(ref, orderBy("timestampMs", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const items: AlertDoc[] = snap.docs.map((d) => {
        const data = d.data() as Omit<AlertDoc, "id">;
        return { id: d.id, ...data };
      });
      setAlerts(items);
    });

    return () => unsub();
  }, [uid, activePetId]);

  const headerTitle = activePet ? `Alerts for ${activePet.name}` : "Select a pet";

  async function selectPet(petId: string) {
    if (!uid) return;
    await updateDoc(doc(db, "users", uid), { activePetId: petId });
    setPetModalOpen(false);
  }

  async function toggleNotifications(enabled: boolean) {
    if (!uid || !activePetId) return;

    const petRef = doc(db, "users", uid, "pets", activePetId);

    const curExit =
      typeof activePetPrefs?.notifyExit === "boolean" ? activePetPrefs.notifyExit : true;
    const curReturn =
      typeof activePetPrefs?.notifyReturn === "boolean" ? activePetPrefs.notifyReturn : true;

    const restoreExit =
      typeof activePetPrefs?.lastNotifyExit === "boolean"
        ? activePetPrefs.lastNotifyExit
        : true;
    const restoreReturn =
      typeof activePetPrefs?.lastNotifyReturn === "boolean"
        ? activePetPrefs.lastNotifyReturn
        : true;

    setNotifEnabled(enabled);

    if (!enabled) {
      await updateDoc(petRef, {
        "prefs.masterEnabled": false,
        "prefs.lastNotifyExit": curExit,
        "prefs.lastNotifyReturn": curReturn,
        "prefs.notifyExit": false,
        "prefs.notifyReturn": false,
      });
      return;
    }

    await updateDoc(petRef, {
      "prefs.masterEnabled": true,
      "prefs.notifyExit": restoreExit,
      "prefs.notifyReturn": restoreReturn,
    });
  }

  function getAlertVisual(type: AlertDoc["type"]) {
    if (type === "GEOFENCE_EXIT") {
      return {
        label: "Left safe zone",
        icon: "alert-outline",
        badgeBg: "rgba(198,40,40,0.15)",
        badgeText: "#C62828",
      };
    }

    if (type === "GEOFENCE_RETURN") {
      return {
        label: "Back safe",
        icon: "home-alert-outline",
        badgeBg: "rgba(46,125,50,0.15)",
        badgeText: "#2E7D32",
      };
    }

    return {
      label: type,
      icon: "bell-outline",
      badgeBg: "rgba(0,0,0,0.08)",
      badgeText: "rgba(0,0,0,0.7)",
    };
  }

  const renderItem = ({ item }: { item: AlertDoc }) => {
    const rawTime =
      typeof item.timestampMs === "number"
        ? item.timestampMs
        : typeof item.timestamp === "number"
        ? item.timestamp * 1000
        : null;

    const timeText = rawTime ? new Date(rawTime).toLocaleString() : "—";
    const visual = getAlertVisual(item.type);

    return (
      <View style={styles.alertCard}>
        <View style={styles.alertTopRow}>
          <View style={styles.alertLeft}>
            <View style={[styles.iconPill, { backgroundColor: visual.badgeBg }]}>
              <Icon name={visual.icon} size={24} color={visual.badgeText} />
            </View>

            <View style={{ flex: 1 }}>
              <AppText style={styles.alertTitle}>{visual.label}</AppText>
              <AppText style={styles.alertTime}>{timeText}</AppText>
            </View>
          </View>

          <View style={[styles.badge, { backgroundColor: visual.badgeBg }]}>
            <AppText style={[styles.badgeText, { color: visual.badgeText }]}>
              {item.type === "GEOFENCE_EXIT"
                ? "EXIT"
                : item.type === "GEOFENCE_RETURN"
                ? "RETURN"
                : "INFO"}
            </AppText>
          </View>
        </View>

        <AppText style={styles.alertMessage}>{item.message}</AppText>

        {item.actionTip ? (
          <AppText style={styles.alertTip}>{item.actionTip}</AppText>
        ) : null}
      </View>
    );
  };

  if (!uid) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <Icon name="paw" size={24} color="#333" />
            </View>

            <AppText variant="heading" style={styles.headerTitle}>
              Alerts
            </AppText>
          </View>
        </View>

        <View style={styles.centerContent}>
          <AppText style={styles.subtle}>Please log in to view alerts.</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.iconCircle}>
            <Icon name="paw" size={24} color="#333" />
          </View>

          <AppText variant="heading" style={styles.headerTitle}>
            {headerTitle}
          </AppText>
        </View>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.petCard}
          activeOpacity={0.85}
          onPress={() => setPetModalOpen(true)}
          disabled={pets.length === 0}
        >
          <View style={styles.petLeft}>
            <View style={styles.avatar}>
              {activePet?.avatarBase64 ? (
                <Image source={{ uri: activePet.avatarBase64 }} style={styles.avatarImage} />
              ) : (
                <Icon name="cat" size={24} color="#D69E2E" />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <AppText style={styles.petName}>{activePet?.name ?? "Select a pet"}</AppText>
              <AppText style={styles.petSub}>
                {activePet?.breed ?? activePet?.colorPattern ?? "Tap to choose"}
              </AppText>
            </View>
          </View>

          <Icon name="chevron-down" size={22} color="#333" style={styles.chevron} />
        </TouchableOpacity>

        <View style={styles.whiteRow}>
          <View style={{ flex: 1 }}>
            <AppText style={styles.whiteRowTitle}>Enable Notifications</AppText>
            <AppText style={styles.whiteRowSub}>
              Alerts when your pet exits or returns
            </AppText>
          </View>

          <Switch value={notifEnabled} onValueChange={toggleNotifications} />
        </View>

        <AppText variant="heading" style={styles.sectionTitle}>
          Recent Alerts
        </AppText>

        {!activePetId ? (
          <AppText style={styles.subtle}>No active pet selected.</AppText>
        ) : alerts.length === 0 ? (
          <AppText style={styles.subtle}>
            No alerts yet for {activePet?.name ?? "this pet"}.
          </AppText>
        ) : (
          <FlatList
            data={alerts}
            keyExtractor={(i) => i.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            showsVerticalScrollIndicator={false}
          />
        )}
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
                    <Icon name="cat" size={24} color="#D69E2E" />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <AppText style={styles.modalName}>{p.name}</AppText>
                  <AppText style={styles.modalSub}>
                    {p.breed ?? p.colorPattern ?? `Pet ID: ${p.id}`}
                  </AppText>
                </View>

                {selected ? <Icon name="check" size={20} color={GREEN} /> : null}
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
  safe: {
    flex: 1,
    backgroundColor: GREEN,
  },

  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.25)",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  headerTitle: {
    color: "#fff",
    marginLeft: spacing.sm,
    flexShrink: 1,
  },

  content: {
    flex: 1,
    padding: spacing.md,
  },

  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  subtle: {
    ...typography.body,
    color: "rgba(255,255,255,0.85)",
    marginTop: spacing.sm,
  },

  petCard: {
    backgroundColor: YELLOW,
    borderRadius: 18,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },

  petLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.10)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: spacing.md,
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
  },

  petName: {
    ...typography.subheading,
    color: "#2b4b1f",
  },

  petSub: {
    ...typography.body,
    color: "rgba(0,0,0,0.55)",
    marginTop: 2,
  },

  chevron: {
    marginLeft: spacing.sm,
  },

  whiteRow: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },

  whiteRowTitle: {
    ...typography.subheading,
    color: "#111",
  },

  whiteRowSub: {
    ...typography.body,
    color: "rgba(0,0,0,0.6)",
    marginTop: 2,
  },

  sectionTitle: {
    color: "#fff",
    marginBottom: spacing.sm,
  },

  alertCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.05)",
  },

  alertTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },

  alertLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  iconPill: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginLeft: spacing.sm,
  },

  badgeText: {
    ...typography.body,
    fontWeight: "800",
  },

  alertTitle: {
    ...typography.subheading,
    color: "#111",
  },

  alertTime: {
    ...typography.body,
    color: "rgba(0,0,0,0.55)",
    marginTop: 2,
  },

  alertMessage: {
    ...typography.body,
    color: "#111",
    marginTop: 2,
  },

  alertTip: {
    ...typography.body,
    color: "rgba(0,0,0,0.6)",
    marginTop: spacing.xs,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  modalSheet: {
    backgroundColor: "#fff",
    padding: spacing.md,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },

  modalTitle: {
    color: "#111",
    marginBottom: spacing.sm,
  },

  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.03)",
    marginBottom: spacing.sm,
  },

  modalItemSelected: {
    backgroundColor: "rgba(94,143,60,0.12)",
  },

  modalAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(244,211,94,0.55)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: spacing.md,
  },

  modalAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },

  modalName: {
    ...typography.subheading,
    color: "#111",
  },

  modalSub: {
    ...typography.body,
    color: "rgba(0,0,0,0.55)",
    marginTop: 2,
  },

  modalClose: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
    marginTop: spacing.sm,
  },

  modalCloseText: {
    ...typography.subheading,
    color: "#111",
  },

  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#D69E2E",
    alignItems: "center",
    justifyContent: "center",
  },
});