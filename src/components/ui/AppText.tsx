import { Text, TextProps, StyleSheet } from "react-native";
import { colors, typography } from "../../theme";

type Variant = "heading" | "subheading" | "body" | "caption";

type Props = TextProps & {
  variant?: Variant;
  color?: keyof typeof colors;
};

export default function AppText({
  variant = "body",
  color = "textPrimary",
  style,
  ...props
}: Props) {
  return (
    <Text
      {...props}
      style={[
        styles.base,
        variantStyles[variant],
        { color: colors[color] ?? colors.textPrimary },
        style
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    // prevent Android weird font padding
    includeFontPadding: false
  }
});

const variantStyles = StyleSheet.create({
  heading: {
    ...typography.heading
  },
  subheading: {
    ...typography.subheading
  },
  body: {
    ...typography.body
  },
  caption: {
    ...(typography.body as any),
    fontSize: 12
  }
});
