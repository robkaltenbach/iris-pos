import { View, ViewProps } from "react-native";
import { BlurView } from "expo-blur";

interface GlassPanelProps extends ViewProps {
  children: React.ReactNode;
  intensity?: number;
}

export function GlassPanel({ children, intensity = 20, style, ...props }: GlassPanelProps) {
  return (
    <View style={[{ borderRadius: 16, overflow: "hidden" }, style]} {...props}>
      <BlurView intensity={intensity} tint="light" style={{ flex: 1 }}>
        <View className="bg-white/10 border border-white/20" style={{ flex: 1 }}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}
