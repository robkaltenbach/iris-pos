import { View, Text, TouchableOpacity, Pressable, Modal, Dimensions } from "react-native";
import { Minus, Plus, Trash2, Check, AlertCircle, Edit, MoreVertical } from "lucide-react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence } from "react-native-reanimated";
import { TicketLineItem } from "@/lib/types";
import { useState, useEffect, useRef } from "react";

interface TicketItemProps {
  item: TicketLineItem;
  onEdit?: (id: string, quantity: number) => void;
  onRemove?: (id: string) => void;
  onVerify?: (id: string) => void;
  onEditItem?: (item: TicketLineItem) => void;
  isPOFinalized?: boolean;
  inventoryItem?: any; // Optional inventory item for additional info (size, color, pack_size)
}

export function TicketItem({ item, onEdit, onRemove, onVerify, onEditItem, isPOFinalized = false, inventoryItem }: TicketItemProps) {
  const [minusPressed, setMinusPressed] = useState(false);
  const [plusPressed, setPlusPressed] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const menuButtonRef = useRef<TouchableOpacity>(null);
  
  // Debug logging
  useEffect(() => {
    if (item.purchase_order_id) {
      console.log(`TicketItem ${item.id}: isPOFinalized=${isPOFinalized}, isPOItem=${!!item.purchase_order_id}`);
    }
  }, [isPOFinalized, item.id, item.purchase_order_id]);
  const checkmarkScale = useSharedValue(item.verified ? 1 : 0);
  const alertOpacity = useSharedValue(item.verified ? 0 : 1);
  
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "#00ff00";
    if (confidence >= 0.5) return "#ffff00";
    return "#ff0000";
  };

  const cost = item.cost ?? 0;
  const price = item.price ?? 0;
  const isCostIssue = cost >= price;
  
  // For PO items, show cost. For sale items, show price.
  const displayPrice = isPOItem ? cost : price;

  const checkmarkAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: checkmarkScale.value }],
    };
  });

  const alertAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: alertOpacity.value,
    };
  });

  // Sync animation state when item.verified changes
  useEffect(() => {
    if (item.verified) {
      checkmarkScale.value = withSequence(
        withSpring(1.2, { damping: 15, stiffness: 300 }),
        withSpring(1, { damping: 20, stiffness: 400 })
      );
      alertOpacity.value = withSpring(0, { damping: 15, stiffness: 200 });
    } else {
      checkmarkScale.value = 0;
      alertOpacity.value = 1;
    }
  }, [item.verified]);

  const handleVerifyPress = () => {
    // Satisfying checkmark animation - scale in
    checkmarkScale.value = withSequence(
      withSpring(1.2, { damping: 15, stiffness: 300 }),
      withSpring(1, { damping: 20, stiffness: 400 })
    );
    alertOpacity.value = withSpring(0, { damping: 15, stiffness: 200 });
    onVerify?.(item.id);
  };

  const isPOItem = !!item.purchase_order_id;
  const showMenu = isPOItem && (onEditItem || onRemove);
  const isPending = (item as any)._isPending === true;
  const isProcessing = (item as any)._isProcessing === true;

  const handleEdit = () => {
    setMenuVisible(false);
    onEditItem?.(item);
  };

  const handleDelete = () => {
    setMenuVisible(false);
    onRemove?.(item.id);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      className="bg-white/5 rounded-xl p-3 mb-2 border border-white/10"
      style={{ 
        position: "relative",
        opacity: isProcessing ? 0.4 : isPending ? 0.7 : 1,
        backgroundColor: isProcessing ? 'rgba(255, 255, 255, 0.02)' : undefined, // More gray when processing
      }}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
          <Text 
            className="font-semibold text-base" 
            style={{ 
              color: isProcessing ? 'rgba(255, 255, 255, 0.5)' : '#fff',
              fontFamily: "RobotoCondensed_400Regular"
            }}
          >
            {item.name}
          </Text>
            {isProcessing && (
              <Text className="text-white/30 text-xs" style={{ fontFamily: "RobotoCondensed_400Regular" }}>Processing...</Text>
            )}
          </View>
          <Text 
            className="text-sm"
            style={{ 
              color: isProcessing ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.6)',
              fontFamily: "RobotoCondensed_400Regular"
            }}
          >
            ${displayPrice.toFixed(2)} each
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {/* Menu button for PO items - top right */}
          {showMenu && (
          <>
            <TouchableOpacity
              ref={menuButtonRef}
              onPress={() => {
                // Measure button position before showing menu
                if (menuButtonRef.current) {
                  menuButtonRef.current.measureInWindow((x, y, width, height) => {
                    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
                    
                    // Position menu below and to the left of the button
                    // Standard context menu position: below button, aligned to right edge
                    const menuWidth = 150;
                    const menuHeight = onEditItem && onRemove ? 100 : 50; // Approximate height
                    const spacing = 8; // Space between button and menu
                    
                    // Calculate position
                    const right = screenWidth - x - width; // Distance from right edge
                    const top = y + height + spacing; // Below the button
                    
                    // Check if menu would go off bottom of screen
                    const menuBottom = top + menuHeight;
                    const shouldFlipUp = menuBottom > screenHeight - 20; // 20px margin
                    
                    setMenuPosition({
                      top: shouldFlipUp ? Math.max(10, y - menuHeight - spacing) : top,
                      right: Math.max(10, right - 5), // Align slightly left of button, min 10px from edge
                    });
                    setMenuVisible(true);
                  });
                } else {
                  // Fallback: show menu at default position if measurement fails
                  setMenuPosition({ top: 100, right: 40 });
                  setMenuVisible(true);
                }
              }}
              className="bg-white/10 p-2 rounded-lg"
            >
              <MoreVertical size={16} color="#fff" />
            </TouchableOpacity>

            <Modal
              visible={menuVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setMenuVisible(false)}
            >
              <Pressable
                style={{ flex: 1 }}
                onPress={() => setMenuVisible(false)}
              >
                <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)" }} />
              </Pressable>
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: menuPosition.top > 0 ? menuPosition.top : 100,
                  right: menuPosition.right > 0 ? menuPosition.right : 40,
                  backgroundColor: "rgba(0, 0, 0, 0.95)",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                  minWidth: 150,
                  overflow: "hidden",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                  zIndex: 10000,
                }}
              >
                {onEditItem && (
                  <TouchableOpacity
                    onPress={handleEdit}
                    className="flex-row items-center gap-3 px-4 py-3 border-b border-white/10 active:bg-white/5"
                  >
                    <Edit size={16} color="#67E3FF" />
                    <Text className="text-white font-medium" style={{ fontFamily: "RobotoCondensed_400Regular" }}>Edit</Text>
                  </TouchableOpacity>
                )}
                {onRemove && (
                  <TouchableOpacity
                    onPress={handleDelete}
                    className="flex-row items-center gap-3 px-4 py-3 active:bg-white/5"
                  >
                    <Trash2 size={16} color="#ff4444" />
                    <Text className="text-red-400 font-medium" style={{ fontFamily: "RobotoCondensed_400Regular" }}>Delete</Text>
                  </TouchableOpacity>
                )}
              </Pressable>
            </Modal>
          </>
          )}
        </View>
      </View>

      {/* Additional Info - Show for sale mode items (size, color, pack_size) */}
      {!item.purchase_order_id && inventoryItem && (() => {
        const additionalInfoParts = [];
        if (inventoryItem.guessed_size) additionalInfoParts.push(inventoryItem.guessed_size);
        if (inventoryItem.color) additionalInfoParts.push(inventoryItem.color);
        if (inventoryItem.pack_size) additionalInfoParts.push(inventoryItem.pack_size);
        const additionalInfo = additionalInfoParts.length > 0 ? additionalInfoParts.join(', ') : null;
        
        return additionalInfo ? (
          <View className="mb-2">
            <Text className="text-white/60 text-xs" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
              {additionalInfo}
            </Text>
          </View>
        ) : null;
      })()}

      {/* Bottom Row - Same layout for both PO and Sale items */}
      <View className="flex-row items-center justify-between">
        {/* Verification Badge - left side (for yellow/red confidence items) */}
        <View style={{ minHeight: 40, justifyContent: 'center', width: 50, alignItems: 'center' }}>
          {onVerify && (item.confidence < 0.8 || !item.verified) ? (
            <View style={{ position: 'relative', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              {/* Alert icon - fades out when verified */}
              <Animated.View style={[alertAnimatedStyle, { position: 'absolute' }]}>
                <TouchableOpacity
                  onPress={handleVerifyPress}
                  className="px-3 py-2 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: `${getConfidenceColor(item.confidence)}20`,
                  }}
                >
                  <AlertCircle size={20} color={getConfidenceColor(item.confidence)} />
                </TouchableOpacity>
              </Animated.View>
              {/* Checkmark - animates in when verified */}
              <Animated.View 
                style={[
                  checkmarkAnimatedStyle,
                  {
                    position: 'absolute',
                    backgroundColor: 'rgba(0, 255, 0, 0.2)',
                    borderRadius: 20,
                    width: 40,
                    height: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }
                ]}
                pointerEvents="none"
              >
                <Check size={20} color="#00ff00" />
              </Animated.View>
            </View>
          ) : item.verified ? (
            <View className="bg-green-500/20 px-3 py-2 rounded-full items-center justify-center">
              <Check size={20} color="#00ff00" />
            </View>
          ) : (
            // Confidence dot for green items that don't need verification
            <View 
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: getConfidenceColor(item.confidence),
              }}
            />
          )}
        </View>

        {/* Quantity Controls - middle */}
        <View className="flex-row items-center gap-2">
          {isPOFinalized || !onEdit ? (
            // Finalized PO or no edit handler - just show quantity, no controls
            <Text className="text-white font-bold text-lg min-w-[30px] text-center" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
              {item.quantity}
            </Text>
          ) : (
            // Not finalized - show controls
            <>
              <Pressable
                onPress={() => {
                  onEdit?.(item.id, Math.max(1, item.quantity - 1));
                }}
                onPressIn={() => setMinusPressed(true)}
                onPressOut={() => setMinusPressed(false)}
                disabled={!onEdit || isProcessing}
                style={{
                  backgroundColor: minusPressed ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  padding: 8,
                  borderRadius: 8,
                  opacity: onEdit ? 1 : 0.5,
                }}
              >
                <Minus size={16} color="#fff" />
              </Pressable>

              <Text className="text-white font-bold text-lg min-w-[30px] text-center">
                {item.quantity}
              </Text>

              <Pressable
                onPress={() => {
                  onEdit?.(item.id, item.quantity + 1);
                }}
                onPressIn={() => setPlusPressed(true)}
                onPressOut={() => setPlusPressed(false)}
                disabled={!onEdit || isProcessing}
                style={{
                  backgroundColor: plusPressed ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  padding: 8,
                  borderRadius: 8,
                  opacity: onEdit ? 1 : 0.5,
                }}
              >
                <Plus size={16} color="#fff" />
              </Pressable>
            </>
          )}
        </View>

        <View className="flex-row items-center gap-3">
          {/* Price total - bottom right */}
          <View>
            <Text 
              className="font-bold text-lg"
              style={{ 
                color: isProcessing ? 'rgba(255, 255, 255, 0.4)' : '#fff',
                fontFamily: "RobotoCondensed_400Regular"
              }}
            >
              ${(displayPrice * item.quantity).toFixed(2)}
            </Text>
            {/* Only show cost warning for PO items */}
          </View>

          {/* Delete button for sale items (non-PO) */}
          {!isPOItem && onRemove && (
            <TouchableOpacity
              onPress={() => onRemove(item.id)}
              className="bg-red-500/20 p-2 rounded-lg"
            >
              <Trash2 size={16} color="#ff4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
