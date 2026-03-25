import { View, ViewProps, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

interface LiquidGlassProps extends ViewProps {
  children: React.ReactNode;
  intensity?: number;
  borderRadius?: number;
  noFlex?: boolean;
}

export function LiquidGlass({ 
  children, 
  intensity = 40, 
  borderRadius = 24,
  noFlex = false,
  style,
  ...props 
}: LiquidGlassProps) {
  // For now, use BlurView as the base since WebGL shader implementation
  // would require capturing the background as a texture, which is complex
  // We'll enhance it with better styling to approximate liquid glass
  
  return (
    <View 
      style={[
        styles.container,
        { borderRadius },
        style
      ]} 
      {...props}
    >
      <BlurView 
        intensity={intensity} 
        tint="dark"
        style={[
          styles.blurView,
          { borderRadius },
          style
        ]}
      >
        {/* Glass effect layers with enhanced styling */}
        <View 
          style={[
            styles.glassLayer,
            { borderRadius },
            style
          ]}
        >
          {/* Subtle gradient overlay for liquid glass tint */}
          <LinearGradient
            colors={[
              "rgba(103, 227, 255, 0.08)",
              "transparent",
              "rgba(169, 132, 255, 0.05)",
            ]}
            locations={[0, 0.5, 1]}
            style={[
              styles.gradientOverlay,
              { borderRadius },
              style
            ]}
            pointerEvents="none"
          />
          
          <View style={noFlex ? styles.contentNoFlex : styles.content}>
            {children}
          </View>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    // Enhanced shadow for depth
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  blurView: {
    flex: 1,
    overflow: "hidden",
  },
  glassLayer: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
    position: "relative",
  },
  gradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  content: {
    flex: 1,
    zIndex: 2,
  },
  contentNoFlex: {
    zIndex: 2,
    alignSelf: "flex-start",
  },
});
