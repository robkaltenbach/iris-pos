import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Pressable, Platform, Alert } from "react-native";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { TicketItem } from "./TicketItem";
import { Check, AlertCircle, Plus, ChevronLeft, Circle, X } from "lucide-react-native";
import { PurchaseOrder, TicketLineItem } from "@/lib/types";
import { usePOCounter } from "@/lib/hooks/usePOCounter";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

// Re-export for backward compatibility with existing imports
export type { PurchaseOrder, TicketLineItem };

interface TicketPanelProps {
  items: TicketLineItem[];
  processingItems?: any[];
  onItemEdit: (id: string, quantity: number) => void;
  onItemRemove: (id: string) => void;
  onItemVerify: (id: string) => void;
  mode?: "inventory" | "sale";
  purchaseOrders?: PurchaseOrder[];
  onPurchaseOrderAdd?: (po: Omit<PurchaseOrder, "id" | "user_id" | "created_at">) => void;
  onPurchaseOrderSelect?: (po: PurchaseOrder) => void;
  selectedPO?: PurchaseOrder | null;
  onSelectedPOChange?: (po: PurchaseOrder | null) => void;
  onLongPressStateChange?: (isOpen: boolean, closeFn?: () => void) => void;
  onFinalizePO?: (poId: string) => Promise<void>;
  onEditItem?: (item: TicketLineItem) => void;
  inventoryItems?: any[];
  pendingItems?: Map<string, any>;
  onPendingItemReview?: (pendingId: string, item: any) => void;
  onPendingItemCancel?: (pendingId: string) => void;
  onPay?: () => void;
  taxRate?: number;
}

export function TicketPanel({ 
  items, 
  processingItems = [],
  onItemEdit, 
  onItemRemove, 
  onItemVerify, 
  mode = "sale",
  purchaseOrders = [],
  onPurchaseOrderAdd,
  onPurchaseOrderSelect,
  selectedPO: externalSelectedPO,
  onSelectedPOChange,
  onFinalizePO,
  onEditItem,
  inventoryItems = [],
  pendingItems,
  onPendingItemReview,
  onPendingItemCancel,
  onPay,
  taxRate = 0.07, // Default 7%
}: TicketPanelProps) {
  const [isNewDeliveryMode, setIsNewDeliveryMode] = useState(false);
  const [distributorName, setDistributorName] = useState("");
  const [poNumber, setPONumber] = useState("");
  const { counter: poCounter, incrementCounter } = usePOCounter();
  const [internalSelectedPO, setInternalSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showCheckoutTooltip, setShowCheckoutTooltip] = useState(false);
  
  // Use external selectedPO if provided, otherwise use internal state
  const selectedPO = externalSelectedPO !== undefined ? externalSelectedPO : internalSelectedPO;
  
  const setSelectedPO = (po: PurchaseOrder | null) => {
    if (onSelectedPOChange) {
      onSelectedPOChange(po);
    } else {
      setInternalSelectedPO(po);
    }
  };

  // Filter items by selected PO when in receiving mode
  // In sale mode, only show items without purchase_order_id (ticket items)
  const displayItems = selectedPO && mode === "inventory" 
    ? items.filter(item => item.purchase_order_id === selectedPO.id)
    : mode === "sale"
    ? items.filter(item => !item.purchase_order_id)
    : items;

  // Check if selected PO is finalized
  const isPOFinalized = selectedPO?.status === "closed";
  
  // Debug logging
  useEffect(() => {
    if (selectedPO) {
      console.log(`TicketPanel: selectedPO.status="${selectedPO.status}", isPOFinalized=${isPOFinalized}`);
    }
  }, [selectedPO, isPOFinalized]);

  // Helper function to check if a PO has items
  const poHasItems = (poId: string) => {
    return items.some(item => item.purchase_order_id === poId);
  };

  const subtotal = displayItems.reduce((sum, item) => sum + (item.cost || item.price || 0) * item.quantity, 0);
  const tax = mode === "sale" ? subtotal * taxRate : 0;
  const total = mode === "sale" ? subtotal + tax : subtotal;
  
  // Check if all required items are verified (yellow and red confidence must be verified, green can bypass)
  const getConfidenceLevel = (confidence: number | null | undefined) => {
    // If confidence is missing, treat as yellow (requires verification)
    if (confidence === null || confidence === undefined) return "yellow";
    if (confidence >= 0.8) return "green";
    if (confidence >= 0.5) return "yellow";
    return "red";
  };
  
  const requiredItems = displayItems.filter((item) => {
    const level = getConfidenceLevel(item.confidence);
    return level === "yellow" || level === "red";
  });
  
  // Calculate verification status - handle empty array correctly
  const allVerified = displayItems.length > 0 && displayItems.every((item) => item.verified);
  const unverifiedCount = displayItems.filter((item) => !item.verified).length;
  const allRequiredVerified = requiredItems.length === 0 || requiredItems.every((item) => item.verified);
  
  // Check if there are pending items that need review
  const pendingNeedsReview = pendingItems 
    ? Array.from(pendingItems.values()).filter((item: any) => 
        item._needsReview && 
        !item._isProcessing &&
        item.purchase_order_id === selectedPO?.id &&
        (!item.cost || !item.price || parseFloat(item.cost || 0) === 0 || parseFloat(item.price || 0) === 0)
      )
    : [];
  
  const canFinalize = allRequiredVerified && displayItems.length > 0 && pendingNeedsReview.length === 0;
  
  // For sale mode checkout: 
  // - Must have items (displayItems.length > 0)
  // - All items must be verified OR all required items (yellow/red) are verified
  // This allows manually added items (pre-verified) to work immediately
  const canCheckout = mode === "sale" 
    ? displayItems.length > 0 && (allVerified || allRequiredVerified)
    : true;

  const handleNewDeliveryPress = () => {
    setIsNewDeliveryMode(true);
    // Pre-fill date received with current date/time
    const now = new Date();
    setDistributorName("");
    setPONumber("");
  };

  const handleCancel = () => {
    setIsNewDeliveryMode(false);
    setDistributorName("");
    setPONumber("");
  };

  const handlePOSelect = (po: PurchaseOrder) => {
    setSelectedPO(po);
    onPurchaseOrderSelect?.(po);
  };

  const handlePOBack = () => {
    setSelectedPO(null);
  };

  const [isFinalizing, setIsFinalizing] = useState(false);

  const handleFinalize = async () => {
    if (!selectedPO || !onFinalizePO || isFinalizing || !canFinalize) return;
    
    setIsFinalizing(true);
    try {
      await onFinalizePO(selectedPO.id);
      // After finalizing, go back to PO list
      setSelectedPO(null);
    } catch (error) {
      console.error("Failed to finalize PO:", error);
      // Error handling is done in the parent
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleSubmit = async () => {
    if (!distributorName.trim()) return;

    // Get next counter value (this will increment globally)
    const nextCounter = await incrementCounter();
    const finalPONumber = poNumber.trim() || `DM-${String(nextCounter).padStart(6, '0')}`;
    const now = new Date();
    // Use ISO 8601 format for PostgreSQL timestamp
    const dateReceived = now.toISOString();

    const newPO: Omit<PurchaseOrder, "id" | "user_id" | "created_at"> = {
      distributor_name: distributorName.trim(),
      po_number: finalPONumber,
      date_received: dateReceived,
      status: "open",
    };

    await onPurchaseOrderAdd?.(newPO);
    setIsNewDeliveryMode(false);
    setDistributorName("");
    setPONumber("");
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    // Display format for UI (human-readable)
    return now.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format ISO timestamp for display
  const formatDateForDisplay = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString; // Fallback to original string if parsing fails
    }
  };


  return (
    <LiquidGlass
      style={styles.container}
      intensity={45}
      borderRadius={20}
    >
      <View style={styles.content}>
        {/* Header */}
        <View className="mb-4" style={{ paddingTop: 20 }}>
          {isNewDeliveryMode ? (
            <TouchableOpacity 
              onPress={handleCancel} 
              style={styles.poBackButton}
              activeOpacity={0.7}
            >
              <ChevronLeft size={20} color="#67E3FF" strokeWidth={1.5} />
            </TouchableOpacity>
          ) : selectedPO && mode === "inventory" ? (
            <TouchableOpacity
              onPress={handlePOBack}
              style={styles.poBackButton}
              activeOpacity={0.7}
            >
              <ChevronLeft size={20} color="#67E3FF" strokeWidth={1.5} />
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text className="text-white text-2xl font-bold" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
                {mode === "inventory" ? "Receiving" : "Ticket"}
              </Text>
              {mode === "inventory" && purchaseOrders.length > 0 && !isNewDeliveryMode && !selectedPO && (
                <TouchableOpacity
                  style={styles.newDeliveryButtonHeader}
                  activeOpacity={0.8}
                  onPress={handleNewDeliveryPress}
                >
                  <Plus size={16} color="#67E3FF" />
                  <Text style={styles.newDeliveryButtonTextHeader}>New Delivery</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {!isNewDeliveryMode && !selectedPO && unverifiedCount > 0 && (
            <View className="flex-row items-center gap-2 mt-2">
              <AlertCircle size={16} color="#ffff00" />
              <Text className="text-yellow-400 text-sm" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
                {unverifiedCount} item{unverifiedCount > 1 ? "s" : ""} need verification
              </Text>
            </View>
          )}
        </View>

        {/* New Delivery Form or Items List or Purchase Orders */}
        <ScrollView 
          className="flex-1 mb-4" 
          showsVerticalScrollIndicator={false}
          scrollEnabled={true}
          nestedScrollEnabled={true}
        >
          {isNewDeliveryMode ? (
            <View style={styles.formContainer}>
              <View style={styles.formField}>
                <Text style={styles.label}>Distributor Name</Text>
                <TextInput
                  style={styles.input}
                  value={distributorName}
                  onChangeText={setDistributorName}
                  placeholder="Enter distributor name"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.label}>PO Number</Text>
                <Text style={styles.helperText}>Leave blank to auto-generate DM-XXXXXX</Text>
                <TextInput
                  style={styles.input}
                  value={poNumber}
                  onChangeText={setPONumber}
                  placeholder="DM-XXXXXX"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.label}>Date Received</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={getCurrentDateTime()}
                  editable={false}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  !distributorName.trim() && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!distributorName.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          ) : selectedPO && mode === "inventory" ? (
            // PO Receiving View - Show items for selected PO
            (() => {
              // Get pending items that need review (missing cost/price AND not currently processing)
              const pendingNeedsReview = pendingItems 
                ? Array.from(pendingItems.values()).filter((item: any) => 
                    item._needsReview && 
                    !item._isProcessing && // Don't show items that are currently processing
                    item.purchase_order_id === selectedPO?.id &&
                    (!item.cost || !item.price || parseFloat(item.cost || 0) === 0 || parseFloat(item.price || 0) === 0)
                  )
                : [];

              return (
                <>
                  {/* Processing Items Section */}
                  {processingItems && processingItems.length > 0 && (
                    <View style={[styles.pendingReviewSection, { marginBottom: 12 }]}>
                      <View style={styles.pendingReviewHeader}>
                        <AlertCircle size={16} color="#67E3FF" />
                        <Text style={[styles.pendingReviewTitle, { color: "#67E3FF" }]}>
                          Processing {processingItems.length} item{processingItems.length > 1 ? 's' : ''}
                        </Text>
                      </View>
                      {processingItems.map((processingItem: any) => (
                        <View
                          key={processingItem.id}
                          style={styles.pendingReviewItem}
                        >
                          <View style={styles.pendingReviewItemHeader}>
                            <View style={styles.pendingReviewItemContent}>
                              <Text style={styles.pendingReviewItemName} numberOfLines={2}>
                                {processingItem.name || 'Processing item'}
                              </Text>
                              {processingItem.brand && (
                                <Text style={styles.pendingReviewItemBrand}>{processingItem.brand}</Text>
                              )}
                              {processingItem.category && (
                                <Text style={styles.pendingReviewItemCategory}>{processingItem.category}</Text>
                              )}
                            </View>
                            <Text style={[styles.pendingReviewItemAction, { color: "#67E3FF" }]}>Processing…</Text>
                          </View>
                          <View style={styles.pendingReviewItemFooter}>
                            <View style={styles.pendingReviewItemConfidence}>
                              <Circle 
                                size={8} 
                                color="#67E3FF"
                                fill="#67E3FF"
                              />
                              <Text style={[styles.pendingReviewItemConfidenceText, { color: "#67E3FF" }]}>
                                Finalizing
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Pending Items Review Section */}
                  {pendingNeedsReview.length > 0 && (
                    <View style={styles.pendingReviewSection}>
                      <View style={styles.pendingReviewHeader}>
                        <AlertCircle size={16} color="#ffaa00" />
                        <Text style={styles.pendingReviewTitle}>
                          {pendingNeedsReview.length} item{pendingNeedsReview.length > 1 ? 's' : ''} need cost/price
                        </Text>
                      </View>
                      {pendingNeedsReview.map((pendingItem: any) => (
                        <View
                          key={pendingItem.id}
                          style={styles.pendingReviewItem}
                        >
                          <TouchableOpacity
                            style={{ flex: 1 }}
                            onPress={() => {
                              if (onPendingItemReview) {
                                onPendingItemReview(pendingItem.id, pendingItem);
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.pendingReviewItemHeader}>
                              <View style={styles.pendingReviewItemContent}>
                                <Text style={styles.pendingReviewItemName} numberOfLines={2}>
                                  {pendingItem.name || 'Unnamed Item'}
                                </Text>
                                {pendingItem.brand && (
                                  <Text style={styles.pendingReviewItemBrand}>{pendingItem.brand}</Text>
                                )}
                                {pendingItem.category && (
                                  <Text style={styles.pendingReviewItemCategory}>{pendingItem.category}</Text>
                                )}
                              </View>
                              <Text style={styles.pendingReviewItemAction}>Add Cost/Price →</Text>
                            </View>
                            <View style={styles.pendingReviewItemFooter}>
                              <View style={styles.pendingReviewItemConfidence}>
                                <Circle 
                                  size={8} 
                                  color={
                                    pendingItem.confidence >= 0.8 ? "#00ff00" :
                                    pendingItem.confidence >= 0.5 ? "#ffff00" : "#ff0000"
                                  } 
                                  fill={
                                    pendingItem.confidence >= 0.8 ? "#00ff00" :
                                    pendingItem.confidence >= 0.5 ? "#ffff00" : "#ff0000"
                                  }
                                />
                                <Text style={styles.pendingReviewItemConfidenceText}>
                                  {Math.round((pendingItem.confidence || 0) * 100)}% confidence
                                </Text>
                              </View>
                              <TouchableOpacity
                                onPress={() => {
                                  if (onPendingItemCancel) {
                                    onPendingItemCancel(pendingItem.id);
                                  }
                                }}
                                style={styles.pendingReviewItemCancel}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <X size={18} color="rgba(255, 255, 255, 0.6)" />
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Regular Items List */}
                  {displayItems.length === 0 && pendingNeedsReview.length === 0 ? (
                    <View className="items-center justify-center py-12">
                      <Text className="text-white/50 text-center" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
                        No items scanned yet
                      </Text>
                    </View>
                  ) : (
            displayItems.map((item) => {
              // For sale mode, find matching inventory item to get additional info (size, color, pack_size)
              // Note: This block is only rendered in inventory mode, so matchingInventoryItem is not needed here
              const matchingInventoryItem = undefined;
              
              return (
                <TicketItem
                  key={item.id}
                  item={item}
                  onEdit={isPOFinalized ? undefined : onItemEdit}
                  onRemove={isPOFinalized ? undefined : onItemRemove}
                  onVerify={isPOFinalized ? undefined : onItemVerify}
                  onEditItem={onEditItem && !isPOFinalized ? (ticketItem) => {
                    // Find the full inventory item to pass to onEditItem
                    const fullItem = inventoryItems.find((invItem: any) => invItem.id === ticketItem.id);
                    if (fullItem) {
                      onEditItem(fullItem);
                    }
                  } : undefined}
                  isPOFinalized={isPOFinalized}
                  inventoryItem={matchingInventoryItem}
                />
              );
            })
                  )}
                </>
              );
            })()
          ) : mode === "inventory" && !selectedPO ? (
            <View className="flex-1">
              {purchaseOrders.length === 0 ? (
                <View className="items-center justify-center py-8">
                  <Text className="text-white/50 text-center mb-4" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
                    No purchase orders
                  </Text>
                  <TouchableOpacity
                    style={styles.newDeliveryButton}
                    activeOpacity={0.8}
                    onPress={handleNewDeliveryPress}
                  >
                    <Plus size={18} color="#67E3FF" />
                    <Text style={styles.newDeliveryButtonText}>New Delivery</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  {purchaseOrders.map((po) => (
                    <TouchableOpacity
                      key={po.id}
                      onPress={() => handlePOSelect(po)}
                      activeOpacity={0.7}
                      style={styles.poItemContainer}
                    >
                      <View style={styles.poItem}>
                        <View style={styles.poItemContent}>
                          <Text style={styles.poNumber}>{po.po_number}</Text>
                          <Text style={styles.poDistributor}>{po.distributor_name}</Text>
                          <Text style={styles.poDate}>{formatDateForDisplay(po.date_received)}</Text>
                        </View>
                        <View style={styles.poStatusIndicator}>
                          {po.status === "closed" ? (
                            // Finalized PO - green checkmark
                            <Check size={20} color="#00ff00" />
                          ) : poHasItems(po.id) ? (
                            // PO with items but not finalized - blue dot
                            <Circle size={20} color="#67E3FF" fill="#67E3FF" />
                          ) : (
                            // Empty PO - no indicator
                            null
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : displayItems.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Text className="text-white/50 text-center" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
                No items scanned yet
              </Text>
            </View>
          ) : (
            displayItems.map((item) => {
              // For sale mode, find matching inventory item to get additional info (size, color, pack_size)
              const matchingInventoryItem = mode === "sale" && inventoryItems.length > 0
                ? inventoryItems.find((invItem: any) => invItem.name === item.name && !invItem.purchase_order_id)
                : undefined;
              
              return (
                <TicketItem
                  key={item.id}
                  item={item}
                  onEdit={isPOFinalized ? undefined : onItemEdit}
                  onRemove={isPOFinalized ? undefined : onItemRemove}
                  onVerify={isPOFinalized ? undefined : onItemVerify}
                  onEditItem={onEditItem && !isPOFinalized ? (ticketItem) => {
                    // Find the full inventory item to pass to onEditItem
                    const fullItem = inventoryItems.find((invItem: any) => invItem.id === ticketItem.id);
                    if (fullItem) {
                      onEditItem(fullItem);
                    }
                  } : undefined}
                  isPOFinalized={isPOFinalized}
                  inventoryItem={matchingInventoryItem}
                />
              );
            })
          )}
        </ScrollView>

        {/* Subtotal, Tax, Total - Show in sale mode and inventory mode */}
        {(mode === "sale" || (mode === "inventory" && selectedPO)) && (
          <View className="border-t border-white/20 pt-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-white text-lg font-semibold" style={{ fontFamily: "RobotoCondensed_400Regular" }}>Subtotal</Text>
              <Text className="text-white text-2xl font-bold" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
                ${subtotal.toFixed(2)}
              </Text>
            </View>
            {mode === "sale" && tax > 0 && (
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-white/70 text-base" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
                  Tax ({(taxRate * 100).toFixed(1)}%)
                </Text>
                <Text className="text-white/70 text-xl font-semibold" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
                  ${tax.toFixed(2)}
                </Text>
              </View>
            )}
            {mode === "sale" && (
              <View className="flex-row justify-between items-center mb-4 mt-2 pt-2 border-t border-white/10">
                <Text className="text-white text-xl font-bold" style={{ fontFamily: "RobotoCondensed_400Regular" }}>Total</Text>
                <Text className="text-white text-3xl font-bold" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
                  ${total.toFixed(2)}
                </Text>
              </View>
            )}

            {/* Verification Status */}
            {allVerified && displayItems.length > 0 && (
              <View className="flex-row items-center gap-2 bg-green-500/20 px-3 py-2 rounded-lg mb-2">
                <Check size={16} color="#00ff00" />
                <Text className="text-green-400 text-sm font-medium" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
                  All items verified
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Checkout Button - Show in sale mode */}
        {mode === "sale" && (
          <View className="border-t border-white/20 pt-4" style={{ position: 'relative' }}>
            {!canCheckout && displayItems.length > 0 && (
              <View className="mb-3 px-3 py-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                <Text className="text-yellow-400 text-sm text-center">
                  {displayItems.filter(item => !item.verified).length} item{displayItems.filter(item => !item.verified).length !== 1 ? 's' : ''} need verification
                </Text>
              </View>
            )}
            {!canCheckout && displayItems.length === 0 && (
              <View className="mb-3 px-3 py-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                <Text className="text-yellow-400 text-sm text-center">
                  Add items to checkout
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.finalizeButton,
                !canCheckout && { opacity: 0.5, backgroundColor: 'rgba(103, 227, 255, 0.3)' }
              ]}
              onPress={(e) => {
                e.stopPropagation?.();
                console.log("=== CHECKOUT BUTTON PRESSED ===", { 
                  canCheckout, 
                  onPayExists: !!onPay,
                  displayItemsCount: displayItems.length,
                  allVerified,
                  allRequiredVerified,
                  requiredItemsCount: requiredItems.length,
                  mode,
                  displayItems: displayItems.map(item => ({ name: item.name, verified: item.verified, confidence: item.confidence }))
                });
                if (!canCheckout) {
                  console.log("Button is disabled, showing tooltip");
                  // Show tooltip when disabled button is pressed
                  setShowCheckoutTooltip(true);
                  setTimeout(() => {
                    setShowCheckoutTooltip(false);
                  }, 2000);
                  return;
                }
                // Call payment handler
                console.log("Button is enabled, calling onPay");
                if (onPay) {
                  console.log("onPay function exists, calling it now");
                  onPay();
                } else {
                  console.error("onPay is NOT defined!");
                  Alert.alert("Error", "Payment handler is not available");
                }
              }}
              disabled={!canCheckout}
              activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.finalizeButtonText}>
                Checkout
              </Text>
            </TouchableOpacity>
            
            {/* Checkout Tooltip - shows when checkout is pressed with unverified items */}
            {showCheckoutTooltip && (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
                style={{
                  position: "absolute",
                  bottom: "100%",
                  marginBottom: 8,
                  alignSelf: "center",
                  backgroundColor: "rgba(0, 0, 0, 0.9)",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                  pointerEvents: "none", // Don't block touches
                }}
              >
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "500", fontFamily: "RobotoCondensed_400Regular" }}>
                  Visually verify and confirm all items to continue
                </Text>
                {/* Tooltip arrow */}
                <View
                  style={{
                    position: "absolute",
                    bottom: -6,
                    alignSelf: "center",
                    width: 0,
                    height: 0,
                    borderLeftWidth: 6,
                    borderRightWidth: 6,
                    borderTopWidth: 6,
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                    borderTopColor: "rgba(0, 0, 0, 0.9)",
                  }}
                />
              </Animated.View>
            )}
          </View>
        )}

        {/* Finalize Button - Show when PO is selected in inventory mode and not finalized */}
        {selectedPO && mode === "inventory" && !isPOFinalized && (
          <View className="border-t border-white/20 pt-4">
            {!canFinalize && (
              <>
                {requiredItems.length > 0 && (
                  <View className="mb-3 px-3 py-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                    <Text className="text-yellow-400 text-sm text-center">
                      {requiredItems.filter(item => !item.verified).length} item{requiredItems.filter(item => !item.verified).length !== 1 ? 's' : ''} need verification
                    </Text>
                  </View>
                )}
                {pendingNeedsReview.length > 0 && (
                  <View className="mb-3 px-3 py-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                    <Text className="text-yellow-400 text-sm text-center">
                      {pendingNeedsReview.length} item{pendingNeedsReview.length !== 1 ? 's' : ''} need cost/price
                    </Text>
                  </View>
                )}
              </>
            )}
            <TouchableOpacity
              style={[
                styles.finalizeButton,
                (!canFinalize || isFinalizing) && { opacity: 0.5, backgroundColor: 'rgba(103, 227, 255, 0.3)' }
              ]}
              onPress={handleFinalize}
              disabled={!canFinalize || isFinalizing}
              activeOpacity={0.8}
            >
              <Text style={styles.finalizeButtonText}>
                {isFinalizing ? "Finalizing..." : "Finalize"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Finalized PO Message */}
        {selectedPO && mode === "inventory" && isPOFinalized && (
          <View className="border-t border-white/20 pt-4">
            <View className="flex-row items-center gap-2 bg-green-500/20 px-3 py-2 rounded-lg">
              <Check size={16} color="#00ff00" />
              <Text className="text-green-400 text-sm font-medium">
                Purchase order finalized
              </Text>
            </View>
          </View>
        )}
      </View>
    </LiquidGlass>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 320,
    height: "100%",
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  newDeliveryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(103, 227, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(103, 227, 255, 0.3)",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  newDeliveryButtonText: {
    color: "#67E3FF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  newDeliveryButtonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(103, 227, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(103, 227, 255, 0.3)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newDeliveryButtonTextHeader: {
    color: "#67E3FF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  backButton: {
    padding: 4,
  },
  poBackButton: {
    padding: 4,
    marginTop: -20,
  },
  formContainer: {
    flex: 1,
    gap: 16,
  },
  formField: {
    marginBottom: 16,
  },
  label: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 8,
  },
  helperText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
    fontFamily: "RobotoCondensed_400Regular",
  },
  inputDisabled: {
    opacity: 0.6,
  },
  submitButton: {
    backgroundColor: "rgba(103, 227, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(103, 227, 255, 0.4)",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#67E3FF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  poItemContainer: {
    marginBottom: 12,
    width: "100%",
  },
  poItem: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  poItemContent: {
    flex: 1,
  },
  poActions: {
    flexDirection: "row",
    gap: 8,
    marginLeft: 12,
  },
  poActionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  poStatusIndicator: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  poNumber: {
    color: "#67E3FF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 4,
  },
  poDistributor: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 4,
  },
  poDate: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    fontFamily: "RobotoCondensed_400Regular",
  },
  finalizeButton: {
    backgroundColor: "rgba(103, 227, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(103, 227, 255, 0.4)",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  finalizeButtonText: {
    color: "#67E3FF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  pendingReviewSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "rgba(255, 170, 0, 0.15)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 170, 0, 0.3)",
  },
  pendingReviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  pendingReviewTitle: {
    color: "#ffaa00",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  pendingReviewItem: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  pendingReviewItemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  pendingReviewItemContent: {
    flex: 1,
    marginRight: 8,
  },
  pendingReviewItemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pendingReviewItemName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 4,
  },
  pendingReviewItemBrand: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 2,
  },
  pendingReviewItemCategory: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11,
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 4,
  },
  pendingReviewItemConfidence: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pendingReviewItemConfidenceText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 10,
    fontFamily: "RobotoCondensed_400Regular",
  },
  pendingReviewItemAction: {
    color: "#67E3FF",
    fontSize: 12,
    fontWeight: "600",
  },
  pendingReviewItemCancel: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});
