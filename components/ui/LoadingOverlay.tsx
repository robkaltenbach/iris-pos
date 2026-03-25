import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  mode?: "inventory" | "sale";
}

export function LoadingOverlay({ visible, message = "Processing image...", mode = "inventory" }: LoadingOverlayProps) {
  if (!visible) return null;

  const tintColor = mode === "sale" ? "rgba(169, 132, 255," : "rgba(103, 227, 255,";

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
        <LinearGradient
          colors={[
            `${tintColor}0.3)`,
            `${tintColor}0.2)`,
            `${tintColor}0.1)`,
          ]}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <ActivityIndicator size="large" color={mode === "sale" ? "#A984FF" : "#67E3FF"} />
            <Text style={styles.message}>{message}</Text>
            <Text style={styles.submessage}>This may take a few seconds...</Text>
          </View>
        </LinearGradient>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: "center",
    alignItems: "center",
  },
  blurContainer: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  gradient: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 300,
  },
  content: {
    alignItems: "center",
    gap: 16,
  },
  message: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  submessage: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    textAlign: "center",
  },
});

