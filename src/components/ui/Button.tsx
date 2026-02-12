import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps } from "react-native";
import { colors, spacing, typography } from "../../theme";

type Variant = "primary" | "secondary";

type Props = TouchableOpacityProps & {
  title: string;
  variant?: Variant;
};

export default function Button({ title, variant = "primary", style, ...props }: Props) {
  return (
    <TouchableOpacity
      {...props}
      activeOpacity={0.85}
      style={[
        styles.base,
        variant === "primary" ? styles.primary : styles.secondary,
        style
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === "primary" ? styles.textPrimary : styles.textSecondary
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  primary: {
    backgroundColor: colors.primary
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)"
  },
  text: {
    ...typography.body,
    fontWeight: "700"
  },
  textPrimary: { color: "#fff" },
  textSecondary: { color: colors.textPrimary }
});
