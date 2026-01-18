import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../../theme";

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map (Web Preview)</Text>
      <Text style={styles.body}>
        The live map is available on iOS/Android. Web preview uses a placeholder.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: "center"
  },
  title: {
    ...typography.subheading,
    marginBottom: spacing.md,
    color: colors.textPrimary
  },
  body: {
    ...typography.body,
    color: colors.textSecondary
  }
});
