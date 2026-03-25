import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import * as Battery from "expo-battery";
import { Battery as BatteryIcon, Plug } from "lucide-react-native";

interface CustomStatusBarProps {
  clockFormat?: "12h" | "24h";
}

export function CustomStatusBar({ clockFormat = "24h" }: CustomStatusBarProps) {
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

    // Get initial battery info
    const initBattery = async () => {
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

    // Subscribe to battery changes
    const batteryLevelSubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      setBatteryLevel(batteryLevel);
    });

    const batteryStateSubscription = Battery.addBatteryStateListener(({ batteryState }) => {
      setBatteryState(batteryState);
      setIsCharging(batteryState === Battery.BatteryState.CHARGING);
    });

    return () => {
      clearInterval(timer);
      batteryLevelSubscription.remove();
      batteryStateSubscription.remove();
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
    // This is a rough estimate - in reality, discharge rate varies
    // Based on typical tablet usage: ~10-15% per hour for active use
    // We'll use a conservative estimate of 8% per hour
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

  // Only show if there's a top inset (notch/status bar area)
  if (insets.top === 0) {
    return null;
  }

  const batteryPercent = batteryLevel !== null ? Math.round(batteryLevel * 100) : 0;
  const timeRemaining = calculateTimeRemaining();

  return (
    <View
      style={[
        styles.container,
        {
          height: insets.top,
        },
      ]}
    >
      <View style={styles.content}>
        {/* Centered content with separators */}
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
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000",
    width: "100%",
    zIndex: 1000,
  },
  content: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    height: "100%",
    width: "100%",
  },
  centeredContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  separator: {
    color: "rgba(255, 255, 255, 0.3)",
    fontSize: 14,
    marginHorizontal: 4,
  },
  clock: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  logo: {
    color: "#67E3FF",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  batteryContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  battery: {
    width: 24,
    height: 12,
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
    fontSize: 11,
    fontFamily: "monospace",
  },
});
