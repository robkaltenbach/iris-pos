import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Package } from 'lucide-react-native';

interface FlyingIconAnimationProps {
  startPosition: { x: number; y: number };
  endPosition: { x: number; y: number };
  onComplete: () => void;
  duration?: number;
}

export function FlyingIconAnimation({
  startPosition,
  endPosition,
  onComplete,
  duration = 2500,
}: FlyingIconAnimationProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const hasCompleted = useRef(false);

  useEffect(() => {
    const deltaX = endPosition.x - startPosition.x;
    const deltaY = endPosition.y - startPosition.y;
    
    console.log("Starting animation", { deltaX, deltaY, duration });
    
    hasCompleted.current = false;
    
    const pauseTime = 800;
    const flyTime = 1500;
    const fadeTime = 200;
    
    // Opacity: stay visible, then fade
    opacity.value = withSequence(
      withTiming(1, { duration: 0 }),
      withTiming(1, { duration: pauseTime + flyTime }),
      withTiming(0, { duration: fadeTime }, (finished) => {
        if (finished && !hasCompleted.current) {
          hasCompleted.current = true;
          runOnJS(onComplete)();
        }
      })
    );
    
    // Scale: bounce in, pause, shrink while flying
    scale.value = withSequence(
      withTiming(2.2, { duration: 200, easing: Easing.out(Easing.back(1.5)) }),
      withTiming(2.0, { duration: 100 }),
      withTiming(2.0, { duration: pauseTime }),
      withTiming(0.7, { duration: flyTime, easing: Easing.inOut(Easing.ease) })
    );
    
    // Position: pause, then move
    translateX.value = withSequence(
      withTiming(0, { duration: pauseTime }),
      withTiming(deltaX, { duration: flyTime, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withSequence(
      withTiming(0, { duration: pauseTime }),
      withTiming(deltaY, { duration: flyTime, easing: Easing.out(Easing.cubic) })
    );
  }, [startPosition.x, startPosition.y, endPosition.x, endPosition.y]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: startPosition.x,
          top: startPosition.y,
          width: 100,
          height: 100,
          zIndex: 99999,
          pointerEvents: 'none',
        },
        animatedStyle,
      ]}
    >
      <View style={styles.iconContainer}>
        <Package size={50} color="#67E3FF" strokeWidth={3} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(103, 227, 255, 0.3)',
    borderWidth: 4,
    borderColor: '#67E3FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#67E3FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 12,
  },
});

