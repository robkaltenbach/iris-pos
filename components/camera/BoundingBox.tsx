import { TouchableOpacity, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withRepeat, withTiming, useSharedValue, withSequence } from "react-native-reanimated";
import { useEffect } from "react";

interface DetectedItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label?: string;
}

interface BoundingBoxProps {
  item: DetectedItem;
  onTap: () => void;
}

export function BoundingBox({ item, onTap }: BoundingBoxProps) {
  const glowOpacity = useSharedValue(0.5);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.5, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const getColorByConfidence = (confidence: number) => {
    if (confidence >= 0.8) return "#00ff00"; // Green
    if (confidence >= 0.5) return "#ffff00"; // Yellow
    return "#ff0000"; // Red
  };

  const color = getColorByConfidence(item.confidence);

  return (
    <TouchableOpacity
      onPress={onTap}
      style={{
        position: "absolute",
        left: `${item.x}%`,
        top: `${item.y}%`,
        width: `${item.width}%`,
        height: `${item.height}%`,
      }}
      className="pointer-events-auto"
    >
      <Animated.View
        style={[
          {
            flex: 1,
            borderWidth: 2,
            borderColor: color,
            borderRadius: 8,
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 8,
          },
          animatedStyle,
        ]}
      >
        {/* Label removed - showing only bounding box */}
      </Animated.View>
    </TouchableOpacity>
  );
}
