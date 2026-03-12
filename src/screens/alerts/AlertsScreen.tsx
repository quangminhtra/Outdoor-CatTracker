import { useEffect, useMemo, useState } from "react";
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
  timestamp?: number; // backward compatibility
};

export default function AlertsScreen() {
  const [activePetPrefs, setActivePetPrefs] = useState<PetOption["prefs"] | null>(null);

  const uid = auth.currentUser?.uid;

  const [pets, setPets] = useState<PetOption[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [activePet, setActivePet] = useState<PetOption | null>(null);

  const [alerts, setAlerts] = useState<AlertDoc[]>([]);
  const [petModalOpen, setPetModalOpen] = useState(false);

  const [notifEnabled, setNotifEnabled] = useState(true);

  // 1) user doc -> activePetId
  useEffect(() => {
    if (!uid) return;

    const userRef = doc(db, "users", uid);
    const unsub = onSnapshot(userRef, (snap) => {
      const data = snap.data() as any;
      setActivePetId(typeof data?.activePetId === "string" ? data.activePetId : null);
    });

    return () => unsub();
  }, [uid]);

  // 2) pets list
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

  // 3) resolve activePet from list
  useEffect(() => {
    if (!activePetId) {
      setActivePet(null);
      return;
    }

    const found = pets.find((p) => p.id === activePetId) ?? null;
    setActivePet(found);
  }, [pets, activePetId]);

  // 3.5) authoritative prefs from active pet
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

  // 3.8) sync master toggle
  useEffect(() => {
    const exitOn = !!activePetPrefs?.notifyExit;
    const returnOn = !!activePetPrefs?.notifyReturn;
    setNotifEnabled(exitOn || returnOn);
  }, [activePetPrefs]);

  // 4) alerts for active pet
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

  const headerTitle = useMemo(() => {
    return "Alerts";
  }, []);

  const headerSubtitle = useMemo(() => {
    if (!activePet) return "Select a pet";
    return `for ${activePet.name}`;
  }, [activePet]);

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
        icon: "⚠️",
        badgeBg: "rgba(198,40,40,0.15)",
        badgeText: "#C62828",
      };
    }
    if (type === "GEOFENCE_RETURN") {
      return {
        label: "Back safe",
        icon: "🏠",
        badgeBg: "rgba(46,125,50,0.15)",
        badgeText: "#2E7D32",
      };
    }
    return {
      label: type,
      icon: "🔔",
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
              <AppText style={styles.iconText}>{visual.icon}</AppText>
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

        {item.actionTip ? <AppText style={styles.alertTip}>{item.actionTip}</AppText> : null}
      </View>
    );
  };

  if (!uid) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.content}>
          <AppText variant="heading" style={styles.h1}>
            Alerts
          </AppText>
          <AppText style={styles.subtle}>Please log in to view alerts.</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <AppText variant="heading" style={styles.headerTitle}>
          {headerTitle}
        </AppText>
        <AppText style={styles.headerSubtitle}>{headerSubtitle}</AppText>
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
                <AppText style={styles.avatarText}>🐾</AppText>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <AppText style={styles.petName}>
                {activePet?.name ?? "Select a pet"}
              </AppText>
              <AppText style={styles.petSub}>
                {activePet?.breed ?? activePet?.colorPattern ?? "Tap to choose"}
              </AppText>
            </View>
          </View>

          <AppText style={styles.chevron}>⌄</AppText>
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

const GREEN = "#5E8F3C";
const YELLOW = "#F4D35E";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GREEN },

  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.25)",
  },
  headerTitle: { color: "#fff" },
  headerSubtitle: { color: "rgba(255,255,255,0.9)", marginTop: 2 },

  content: { flex: 1, padding: spacing.md },

  h1: { color: "#fff" },
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
    gap: spacing.md,
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
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
  },
  avatarText: { fontSize: 20 },
  petName: { ...typography.subheading, color: "#2b4b1f" },
  petSub: { ...typography.body, color: "rgba(0,0,0,0.55)", marginTop: 2 },
  chevron: { fontSize: 20, color: "rgba(0,0,0,0.55)", marginLeft: spacing.sm },

  whiteRow: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  whiteRowTitle: { ...typography.subheading, color: "#111" },
  whiteRowSub: { ...typography.body, color: "rgba(0,0,0,0.6)", marginTop: 2 },

  sectionTitle: { color: "#fff", marginBottom: spacing.sm },

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
  alertLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },

  iconPill: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 18 },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { ...typography.body, fontWeight: "800" },

  alertTitle: { ...typography.subheading, color: "#111" },
  alertTime: { ...typography.body, color: "rgba(0,0,0,0.55)", marginTop: 2 },

  alertMessage: { ...typography.body, color: "#111", marginTop: 2 },
  alertTip: { ...typography.body, color: "rgba(0,0,0,0.6)", marginTop: spacing.xs },

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