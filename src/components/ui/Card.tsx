import { View, ViewProps, StyleSheet } from "react-native";
import { colors, spacing } from "../../theme";

type Props = ViewProps & {
  padded?: boolean;
};

export default function Card({ padded = true, style, ...props }: Props) {
  return (
    <View
      {...props}
      style={[
        styles.card,
        padded && { padding: spacing.md },
        style
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3
  }
});
