import { View, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "./AppText";
import { spacing } from "../../theme";

type Props = {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

export default function ScreenHeader({ title, onBack, right }: Props) {
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.wrap}>
        <View style={styles.left}>
          {onBack ? (
            <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.85}>
              <AppText style={styles.backText}>‹</AppText>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <View style={styles.center}>
          <AppText variant="heading" style={styles.title}>
            {title}
          </AppText>
        </View>

        <View style={styles.right}>{right ?? <View style={{ width: 40 }} />}</View>
      </View>
    </SafeAreaView>
  );
}

const GREEN = "#5E8F3C";

const styles = StyleSheet.create({
  safe: { backgroundColor: GREEN },
  wrap: {
    backgroundColor: GREEN,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center"
  },
  left: { width: 56, alignItems: "flex-start" },
  center: { flex: 1, alignItems: "center" },
  right: { width: 56, alignItems: "flex-end" },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  backText: { fontSize: 26, fontWeight: "900", color: "#111" },
  title: { color: "#111" }
});
