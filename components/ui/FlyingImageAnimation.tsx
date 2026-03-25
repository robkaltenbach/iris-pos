import React, { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

interface FlyingImageAnimationProps {
  imageUri: string;
  startPosition: { x: number; y: number };
  endPosition: { x: number; y: number };
  onComplete: () => void;
  duration?: number;
}

export function FlyingImageAnimation({
  imageUri,
  startPosition,
  endPosition,
  onComplete,
  duration = 800,
}: FlyingImageAnimationProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Calculate relative movement from start to end
    const deltaX = endPosition.x - startPosition.x;
    const deltaY = endPosition.y - startPosition.y;
    
    console.log("Starting animation", { startPosition, endPosition, deltaX, deltaY });
    
    // Animate to end position while shrinking
    translateX.value = withTiming(
      deltaX,
      {
        duration,
        easing: Easing.out(Easing.cubic),
      }
    );
    translateY.value = withTiming(
      deltaY,
      {
        duration,
        easing: Easing.out(Easing.cubic),
      }
    );
    scale.value = withSequence(
      withTiming(0.3, { duration: duration * 0.6, easing: Easing.inOut(Easing.ease) }),
      withTiming(0.1, { duration: duration * 0.4, easing: Easing.in(Easing.ease) })
    );
    opacity.value = withSequence(
      withTiming(1, { duration: duration * 0.7 }),
      withTiming(0, { duration: duration * 0.3 }, () => {
        runOnJS(onComplete)();
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          position: 'absolute',
          left: startPosition.x,
          top: startPosition.y,
          width: 200,
          height: 200,
          zIndex: 10000,
          elevation: 10000, // For Android
          pointerEvents: 'none',
        },
        animatedStyle,
      ]}
    >
      <Image
        source={{ uri: imageUri }}
        style={styles.image}
        resizeMode="cover"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
});

