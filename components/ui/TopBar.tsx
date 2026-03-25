import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import Animated, { useAnimatedStyle, withSpring, useSharedValue, interpolateColor } from "react-native-reanimated";
import * as Battery from "expo-battery";
import { Plug, Package, ShoppingCart } from "lucide-react-native";

interface TopBarProps {
  mode: "inventory" | "sale";
  onModeChange: (mode: "inventory" | "sale") => void;
  showModeToggle?: boolean;
  clockFormat?: "12h" | "24h";
}

export function ModeTogglePill({ mode, onModeChange }: { mode: "inventory" | "sale"; onModeChange: (mode: "inventory" | "sale") => void }) {
  const translateX = useSharedValue(mode === "sale" ? 0 : 1);

  useEffect(() => {
    translateX.value = withSpring(mode === "sale" ? 0 : 1, {
      damping: 35, // Less bounce
      stiffness: 450, // Faster
    });
  }, [mode]);

  const animatedStyle = useAnimatedStyle(() => {
    const baseWidth = 50; // Half of 96px content + 2px padding (1px each side) + 2px extra to cover border
    // Create stretch effect: wider in the middle (0.5), thinner at edges (0 or 1)
    const progress = Math.abs(translateX.value - 0.5) * 2; // 0 at middle, 1 at edges
    const stretchAmount = 8; // How much to stretch
    const width = baseWidth + (stretchAmount * (1 - progress)); // Wider in middle
    // Purple position: start slightly negative to cover left border
    // Blue position: end slightly beyond to cover right border
    const translate = -1 + translateX.value * (48 + 2); // -1 to cover left, +1 to cover right
    const backgroundColor = interpolateColor(
      translateX.value,
      [0, 1],
      ["#A984FF", "#67E3FF"] // Purple to Blue
    );
    return {
      width,
      transform: [{ translateX: translate }],
      backgroundColor,
    };
  });

  return (
    <LiquidGlass intensity={30} borderRadius={20} noFlex style={styles.toggleContainer}>
      <View style={styles.toggleInner}>
        {/* Colored Indicator Background */}
        <Animated.View 
          style={[
            styles.toggleIndicator, 
            animatedStyle
          ]} 
          pointerEvents="none"
        />
        
        {/* Icons - Always White */}
        <View style={styles.toggleButtons}>
          <TouchableOpacity
            onPress={() => onModeChange("sale")}
            style={styles.toggleButton}
            activeOpacity={1}
          >
            <ShoppingCart size={20} color="#fff" strokeWidth={1.5} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onModeChange("inventory")}
            style={styles.toggleButton}
            activeOpacity={1}
          >
            <Package size={20} color="#fff" strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      </View>
    </LiquidGlass>
  );
}

export function TopBar({ mode, onModeChange, showModeToggle = true, clockFormat = "24h" }: TopBarProps) {
  const insets = useSafeAreaInsets();
  const [time, setTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [batteryState, setBatteryState] = useState<Battery.BatteryState | null>(null);

  useEffect(() => {
    // Update time every second
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    // Get initial battery info (skip on web)
    const initBattery = async () => {
      if (Platform.OS === 'web') return;
      
      try {
        const level = await Battery.getBatteryLevelAsync();
        setBatteryLevel(level);
        
        const state = await Battery.getBatteryStateAsync();
        setBatteryState(state);
        setIsCharging(state === Battery.BatteryState.CHARGING);
      } catch (error) {
        console.error("Error getting battery info:", error);
      }
    };

    initBattery();

    // Subscribe to battery changes (skip on web)
    let batteryLevelSubscription: any = null;
    let batteryStateSubscription: any = null;
    
    if (Platform.OS !== 'web') {
      batteryLevelSubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
        setBatteryLevel(batteryLevel);
      });

      batteryStateSubscription = Battery.addBatteryStateListener(({ batteryState }) => {
        setBatteryState(batteryState);
        setIsCharging(batteryState === Battery.BatteryState.CHARGING);
      });
    }

    return () => {
      clearInterval(timer);
      if (batteryLevelSubscription) {
        batteryLevelSubscription.remove();
      }
      if (batteryStateSubscription) {
        batteryStateSubscription.remove();
      }
    };
  }, []);

  const formatTime = (date: Date) => {
    if (clockFormat === "12h") {
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      return `${hours}:${minutes} ${ampm}`;
    } else {
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${hours}:${minutes}`;
    }
  };

  const calculateTimeRemaining = (): string => {
    if (batteryLevel === null || isCharging) {
      return "";
    }

    // Simple estimation: assume average discharge rate
    const hoursRemaining = (batteryLevel / 0.08);
    
    if (hoursRemaining < 1) {
      const minutes = Math.floor(hoursRemaining * 60);
      return `${minutes}m`;
    }

    const days = Math.floor(hoursRemaining / 24);
    const hours = Math.floor(hoursRemaining % 24);
    const minutes = Math.floor((hoursRemaining % 1) * 60);

    if (days > 0) {
      return `${days}d:${hours}h:${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h:${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getBatteryColor = () => {
    if (batteryLevel === null) return "#fff";
    if (batteryLevel > 0.5) return "#67E3FF";
    if (batteryLevel > 0.2) return "#ffff00";
    return "#ff4444";
  };

  const batteryPercent = batteryLevel !== null ? Math.round(batteryLevel * 100) : 0;
  const timeRemaining = calculateTimeRemaining();

  return (
      <View
      style={[
        styles.container,
        {
          paddingTop: 2,
          minHeight: 59, // Increased to accommodate marginTop: 15
        },
      ]}
    >
      <View style={styles.content}>
        {/* Left: Mode Toggle */}
        {showModeToggle && (
          <View style={styles.leftSection}>
            <ModeTogglePill mode={mode} onModeChange={onModeChange} />
          </View>
        )}

        {/* Center: Status Info */}
        <View style={styles.centerSection}>
          <View style={styles.pillContainer}>
            <View style={styles.centeredContent}>
            {/* Digital Clock */}
            <Text style={styles.clock}>{formatTime(time)}</Text>
            
            <Text style={styles.separator}>|</Text>
            
            {/* iris logo */}
            <Text style={styles.logo}>iris</Text>
            
            {/* Battery Info */}
            {batteryLevel !== null && (
              <>
                <Text style={styles.separator}>|</Text>
                <View style={styles.batteryContainer}>
                  <View style={styles.battery}>
                    <View
                      style={[
                        styles.batteryLevel,
                        {
                          width: `${batteryLevel * 100}%`,
                          backgroundColor: getBatteryColor(),
                        },
                      ]}
                    />
                  </View>
                  {isCharging && (
                    <Plug size={12} color={getBatteryColor()} style={styles.plugIcon} />
                  )}
                </View>
                {!isCharging && timeRemaining && (
                  <Text style={styles.timeRemaining}>{timeRemaining}</Text>
                )}
              </>
            )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
    width: "100%",
    zIndex: 1001, // Above the side panel (zIndex: 1000)
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  content: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 59, // Increased to accommodate marginTop: 15
    width: "100%",
    position: "relative",
  },
  leftSection: {
    alignItems: "flex-start",
    marginTop: 15, // Moved down 10px (was 5)
    zIndex: 1,
  },
  centerSection: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -8, // Moved up 3px (was 5)
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  pillContainer: {
    backgroundColor: "#000",
    borderTopLeftRadius: 0, // Sharp top corners
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 16, // Rounded bottom corners
    borderBottomRightRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  toggleContainer: {
    alignSelf: "flex-start",
  },
  toggleInner: {
    flexDirection: "row",
    position: "relative",
    overflow: "hidden",
    borderRadius: 20,
    padding: 1,
    width: 98, // 96px + 2px padding
    height: 42, // Icon size + padding
  },
  toggleIndicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 19, // Slightly smaller than container to account for padding
    zIndex: 0,
  },
  toggleButtons: {
    flexDirection: "row",
    flex: 1,
    zIndex: 1,
  },
  toggleButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    borderRadius: 19,
  },
  centeredContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  separator: {
    color: "rgba(255, 255, 255, 0.3)",
    fontSize: 12,
    fontFamily: "RobotoCondensed_400Regular",
    marginHorizontal: 4,
  },
  clock: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  logo: {
    color: "#67E3FF",
    fontSize: 12,
    fontWeight: "400",
    fontFamily: "RobotoCondensed_400Regular",
    letterSpacing: 1,
  },
  batteryContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  battery: {
    width: 20,
    height: 10,
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 2,
    padding: 1,
    overflow: "hidden",
  },
  batteryLevel: {
    height: "100%",
    borderRadius: 1,
    minWidth: 2,
  },
  plugIcon: {
    marginLeft: 2,
  },
  timeRemaining: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "monospace",
  },
});

