import { useRef, useEffect, useState, useCallback } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Linking, Alert, Platform } from "react-native";
import { CameraView as ExpoCameraView, useCameraPermissions } from "expo-camera";
import { Camera, PanelLeft, LogOut, ChevronLeft } from "lucide-react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay, withSpring, Easing, SharedValue, runOnJS } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { BoundingBox } from "./BoundingBox";
import { InventoryPanel } from "@/components/panels/InventoryPanel";
import { AIProductData } from "@/lib/types";

interface DetectedItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label?: string;
}

interface CameraViewProps {
  mode: "inventory" | "sale";
  onModeChange?: (mode: "inventory" | "sale") => void;
  onItemDetected?: (item: DetectedItem) => void;
  onBoxTap?: (item: DetectedItem) => void;
  detectedItems?: DetectedItem[];
  onSignOut?: () => void;
  onPanelVisibilityChange?: (visible: boolean) => void;
  cameraRef?: React.RefObject<ExpoCameraView | null>;
  // Inventory panel props
  aiProductData?: AIProductData | null;
  capturedImageUri?: string | null;
  onProductSave?: (data: any) => void;
  onOpenPanel?: () => void;
  isPanelVisible?: boolean;
  inventoryItems?: any[];
  selectedPO?: any;
  onAddToPO?: (item: any) => void;
  onEditItem?: (item: any) => void;
  onAddVariant?: (item: any) => void;
  onUpdateInventoryItem?: (id: string, updates: Partial<any>) => Promise<void>;
  updateTicketItem?: (id: string, updates: Partial<any>) => Promise<void>;
  addTicketItem?: (item: any) => Promise<void>;
  editingItemId?: string | null;
  setEditingItemId?: (id: string | null) => void;
}

function PulsingCircle({ mode }: { mode: "inventory" | "sale" }) {
  // Create multiple waves with different delays
  const wave1 = useSharedValue(0);
  const wave2 = useSharedValue(0);
  const wave3 = useSharedValue(0);

  useEffect(() => {
    const waveDuration = 5000; // Much slower - 5 seconds
    const delayBetweenWaves = 1667; // One third of duration
    
    // Start waves at different times for continuous ripple effect
    wave1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: waveDuration, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
    
    wave2.value = withRepeat(
      withSequence(
        withTiming(0, { duration: delayBetweenWaves }),
        withTiming(1, { duration: waveDuration, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
    
    wave3.value = withRepeat(
      withSequence(
        withTiming(0, { duration: delayBetweenWaves * 2 }),
        withTiming(1, { duration: waveDuration, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
  }, []);

  const createWaveStyle = (progress: SharedValue<number>) => {
    return useAnimatedStyle(() => {
      const scale = 1 + progress.value * 1.5; // Scale from 1 to 2.5
      const opacity = Math.max(0, (1 - progress.value) * 0.5); // Fade out completely by the end, at half opacity
      return {
        transform: [{ scale }],
        opacity,
      };
    });
  };

  // Purple for sale mode, blue for inventory mode
  const borderColor = mode === "sale" 
    ? "rgba(169, 132, 255, 0.25)" // Purple
    : "rgba(103, 227, 255, 0.25)"; // Blue

  const baseCircleStyle = {
    position: "absolute" as const,
    width: 128, // w-32 = 128px
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor,
  };

  return (
    <View style={{ width: 128, height: 128, alignItems: "center", justifyContent: "center" }}>
      {/* Base circle */}
      <View style={[baseCircleStyle, { opacity: 0.5 }]} />
      
      {/* Pulsing waves */}
      <Animated.View style={[baseCircleStyle, createWaveStyle(wave1)]} />
      <Animated.View style={[baseCircleStyle, createWaveStyle(wave2)]} />
      <Animated.View style={[baseCircleStyle, createWaveStyle(wave3)]} />
    </View>
  );
}

function SidePanel({ 
  onSignOut, 
  mode, 
  onModeChange,
  onVisibilityChange,
  aiProductData,
  capturedImageUri,
  onProductSave,
  externalVisible,
  inventoryItems,
  selectedPO,
  onAddToPO,
  onEditItem,
  onAddVariant,
  onUpdateInventoryItem,
  editingItemId,
  setEditingItemId,
  refetchInventoryItems,
}: { 
  onSignOut: () => void;
  mode: "inventory" | "sale";
  onModeChange: (mode: "inventory" | "sale") => void;
  onVisibilityChange?: (visible: boolean) => void;
  aiProductData?: AIProductData | null;
  capturedImageUri?: string | null;
  onProductSave?: (data: any) => void;
  externalVisible?: boolean;
  inventoryItems?: any[];
  selectedPO?: any;
  onAddToPO?: (item: any) => void;
  onEditItem?: (item: any) => void;
  onAddVariant?: (item: any) => void;
  onUpdateInventoryItem?: (id: string, updates: Partial<any>) => Promise<void>;
  editingItemId?: string | null;
  setEditingItemId?: (id: string | null) => void;
  refetchInventoryItems?: () => Promise<void>;
}) {
  const [internalVisible, setInternalVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // Use external control if provided, otherwise use internal state
  const visible = externalVisible !== undefined ? externalVisible : internalVisible;
  const setVisible = (value: boolean) => {
    if (externalVisible === undefined) {
      setInternalVisible(value);
    } else {
      onVisibilityChange?.(value);
    }
  };
  
  // Remove this useEffect - it's causing circular updates
  // The visibility is already controlled by externalVisible prop
  // useEffect(() => {
  //   onVisibilityChange?.(visible);
  // }, [visible, onVisibilityChange]);
  
  // Refetch inventory items every time the panel opens
  // Note: refetchInventoryItems will refetch with the current selectedPO filter,
  // but InventoryPanel needs ALL inventory items (those without purchase_order_id),
  // so the filter applied in app/index.tsx should handle this correctly after refetch
  useEffect(() => {
    if (visible && refetchInventoryItems) {
      console.log("Panel opened, refetching inventory items...");
      refetchInventoryItems().catch((error) => {
        console.error("Failed to refetch inventory items:", error);
      });
    }
  }, [visible, refetchInventoryItems]);
  
  const insets = useSafeAreaInsets();
  const translateX = useSharedValue(-1000); // Start off-screen to the left - use large value to ensure fully off-screen

  useEffect(() => {
    console.log("SidePanel visibility effect - visible:", visible, "externalVisible:", externalVisible);
    if (visible) {
      console.log("SidePanel: Mounting and animating in");
      setIsMounted(true);
      // Small delay to ensure mount completes before animation
      setTimeout(() => {
        // Spring animation for bouncy, liquidy feel - slowed down
        translateX.value = withSpring(0, {
          damping: 25, // Higher damping = slower, smoother
          stiffness: 80, // Lower stiffness = slower animation
          mass: 1.5, // Slightly heavier = slower
        });
      }, 10);
    }
  }, [visible, externalVisible]);

  // Handle closing animation separately
  useEffect(() => {
    if (!visible && isMounted) {
      // Spring back animation - animate FAR off-screen to ensure it fully disappears - slowed down
      translateX.value = withSpring(-1000, {
        damping: 25, // Higher damping = slower, smoother
        stiffness: 80, // Lower stiffness = slower animation
        mass: 1.5, // Slightly heavier = slower
      }, (finished) => {
        'worklet';
        if (finished === true) {
          runOnJS(setIsMounted)(false);
        }
      });
      
      // Fallback: ensure unmount after reasonable time even if callback doesn't fire
      const fallbackTimeout = setTimeout(() => {
        setIsMounted(false);
      }, 2000); // Give more time for the slower animation
      
      return () => {
        clearTimeout(fallbackTimeout);
      };
    }
  }, [visible, isMounted]);

  const panelStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <>
      {/* Panel Toggle Button - Bottom Left */}
      {!visible && (
        <View style={{ position: "absolute", bottom: 16, left: 16, zIndex: 1000 }}>
          <TouchableOpacity
            onPress={() => setVisible(true)}
            style={styles.panelToggleButton}
          >
            <PanelLeft size={24} color="#fff" strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      )}

      {/* Side Panel - Keep mounted during closing animation */}
      {isMounted && (
        <View style={styles.panelOverlay} pointerEvents={visible ? "box-none" : "none"}>
          <Animated.View
            style={[
              styles.sidePanel,
              {
                top: 7, // Same as ticket window (7px from top)
                bottom: 7, // Same as ticket window (7px from bottom)
                left: 7, // Same as ticket window's right offset (7px from left)
                right: 332, // 5px from ticket panel (320px + 7px margin + 5px gap)
              },
              panelStyle,
            ]}
            onStartShouldSetResponder={() => visible} // Only respond when visible
          >
            <BlurView 
              intensity={60} 
              tint="dark" 
              style={[
                styles.panelBlurContainer,
                {
                  backgroundColor: mode === "sale" 
                    ? "rgba(0, 0, 0, 0.4)" // Darker background
                    : "rgba(0, 0, 0, 0.4)", // Darker background
                  borderColor: mode === "sale"
                    ? "rgba(169, 132, 255, 0.3)" // Purple border tint
                    : "rgba(103, 227, 255, 0.3)", // Blue border tint
                },
              ]}
            >
              {/* Color tint overlay - Purple for sale, Blue for inventory */}
              <LinearGradient
                colors={
                  mode === "sale"
                    ? [
                        "rgba(169, 132, 255, 0.15)",
                        "rgba(169, 132, 255, 0.1)",
                        "rgba(169, 132, 255, 0.05)",
                      ]
                    : [
                        "rgba(103, 227, 255, 0.15)",
                        "rgba(103, 227, 255, 0.1)",
                        "rgba(103, 227, 255, 0.05)",
                      ]
                }
                locations={[0, 0.5, 1]}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 24,
                }}
                pointerEvents="none"
              />
              {/* Panel Content */}
              {visible && (
                <View style={{ flex: 1 }}>
                  <InventoryPanel
                    mode={mode}
                    initialData={aiProductData}
                    capturedImageUri={capturedImageUri}
                    onSave={(data) => {
                      onProductSave?.(data);
                      setVisible(false);
                    }}
                    onClose={() => {
                      // Close panel and clear state
                      setVisible(false);
                      onVisibilityChange?.(false);
                    }}
                    inventoryItems={inventoryItems}
                    selectedPO={selectedPO}
                    onAddToPO={onAddToPO}
                    onEditItem={onEditItem}
                    onAddVariant={onAddVariant}
                    onUpdateInventoryItem={onUpdateInventoryItem}
                    editingItemId={editingItemId}
                    setEditingItemId={setEditingItemId}
                    refetchInventoryItems={refetchInventoryItems}
                  />
                </View>
              )}

              {/* Only show buttons when visible to prevent interaction during closing */}
              {visible && (
                <View style={styles.panelBottomButtons}>
                  {/* Close Button - Bottom Left */}
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setVisible(false)}
                  >
                    <ChevronLeft size={24} color="#fff" strokeWidth={1.5} />
                  </TouchableOpacity>

                  {/* Logout Button - Bottom Right */}
                  <TouchableOpacity
                    style={styles.logoutButtonCircle}
                    onPress={() => {
                      setVisible(false);
                      onSignOut();
                    }}
                  >
                    <LogOut size={24} color="#ff6b6b" strokeWidth={1.5} />
                  </TouchableOpacity>
                </View>
              )}
            </BlurView>
          </Animated.View>
        </View>
      )}
    </>
  );
}

export function CameraView({ mode, onModeChange, onItemDetected, onBoxTap, detectedItems = [], onSignOut, onPanelVisibilityChange, cameraRef: externalCameraRef, aiProductData, capturedImageUri, onProductSave, onOpenPanel, isPanelVisible, inventoryItems, selectedPO, onAddToPO, onEditItem, onAddVariant, onUpdateInventoryItem, editingItemId, setEditingItemId, refetchInventoryItems }: CameraViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const internalCameraRef = useRef<ExpoCameraView>(null);
  const cameraRef = externalCameraRef || internalCameraRef;
  const [hasRequested, setHasRequested] = useState(false);

  // Automatically request permission on mount
  useEffect(() => {
    if (permission && !permission.granted && !hasRequested) {
      setHasRequested(true);
      requestPermission();
    }
  }, [permission, hasRequested]);

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  if (!permission) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-6">
        <GlassPanel className="p-6 m-4 max-w-md">
          <View className="items-center gap-4">
            <Camera size={48} color="#fff" />
            <Text className="text-white text-xl font-bold text-center">
              Camera Permission Required
            </Text>
            <Text className="text-white/80 text-center">
              To use iris, please enable camera access in your device settings.
            </Text>
            <TouchableOpacity 
              onPress={openSettings}
              className="bg-[#A984FF] px-6 py-3 rounded-xl mt-4"
            >
              <Text className="text-white font-semibold" style={{ fontFamily: "RobotoCondensed_400Regular" }}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        </GlassPanel>
      </View>
    );
  }

  return (
    <View className="flex-1 relative">
      <ExpoCameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
      />

      {/* Bounding Boxes Overlay */}
      <View className="absolute inset-0 pointer-events-box-none">
        {detectedItems && Array.isArray(detectedItems) && detectedItems.map((item, index) => (
          <BoundingBox
            key={item?.id || `detected-item-${index}`}
            item={item}
            onTap={() => onBoxTap?.(item)}
          />
        ))}
      </View>

      {/* Settings Button - Bottom Left */}
      {onSignOut && onModeChange && (
        <SidePanel 
          onSignOut={onSignOut} 
          mode={mode}
          onModeChange={onModeChange}
          onVisibilityChange={onPanelVisibilityChange}
          aiProductData={aiProductData}
          capturedImageUri={capturedImageUri}
          onProductSave={onProductSave}
          externalVisible={isPanelVisible}
          inventoryItems={inventoryItems}
          selectedPO={selectedPO}
          onAddToPO={onAddToPO}
          onEditItem={onEditItem}
          onAddVariant={onAddVariant}
          onUpdateInventoryItem={onUpdateInventoryItem}
          editingItemId={editingItemId}
          setEditingItemId={setEditingItemId}
          refetchInventoryItems={refetchInventoryItems}
        />
      )}

      {/* Iris Scan Animation Overlay (when capturing) */}
      <View 
        className="absolute top-0 bottom-0 left-0 pointer-events-none"
        style={{
          right: 327, // Account for ticket panel (320px + 7px margin)
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <PulsingCircle mode={mode} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panelOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    overflow: "visible", // Don't clip the panel during animation
  },
  sidePanel: {
    position: "absolute",
    borderRadius: 24,
    overflow: "hidden",
  },
  panelBlurContainer: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1.5,
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  panelToggleButton: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    padding: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  panelHeader: {
    alignItems: "center",
  },
  profilePic: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#A984FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  profilePicText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
  },
  userName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  panelBottomButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
    marginLeft: -15, // Move left 5px
    marginBottom: -15, // Move down 5px
  },
  logoutButtonCircle: {
    backgroundColor: "rgba(255, 107, 107, 0.2)",
    padding: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(255, 107, 107, 0.4)",
    marginRight: -15,
    marginBottom: -15,
  },
});
