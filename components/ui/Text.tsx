import { Text as RNText, TextProps as RNTextProps, StyleSheet, TextStyle } from "react-native";

export function Text({ style, ...props }: RNTextProps) {
  // Merge styles - default font always applied
  const mergedStyle = Array.isArray(style)
    ? [styles.default, ...style]
    : style
    ? [styles.default, style]
    : styles.default;

  return (
    <RNText
      style={mergedStyle}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontFamily: "RobotoCondensed_400Regular",
  },
});

// Export the original Text for cases where we need it
export { RNText as RNText };

