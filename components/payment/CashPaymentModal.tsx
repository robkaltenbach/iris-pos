import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { useState, useEffect } from "react";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { Check, X } from "lucide-react-native";

interface CashPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  total: number;
  onComplete: () => void;
  onReceiptRequest: () => void;
}

export function CashPaymentModal({
  visible,
  onClose,
  total,
  onComplete,
  onReceiptRequest,
}: CashPaymentModalProps) {
  const [cashAmount, setCashAmount] = useState("");
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [showReceiptPrompt, setShowReceiptPrompt] = useState(false);
  
  const checkmarkScale = useSharedValue(0);
  const checkmarkOpacity = useSharedValue(0);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setCashAmount("");
      setShowCheckmark(false);
      setShowReceiptPrompt(false);
      checkmarkScale.value = 0;
      checkmarkOpacity.value = 0;
    }
  }, [visible]);

  const cashValue = parseFloat(cashAmount) || 0;
  const change = cashValue - total;
  const isAmountValid = cashValue >= total;

  const handleNumberPress = (num: string) => {
    if (cashAmount === "0.00" || cashAmount === "") {
      setCashAmount(num);
    } else {
      setCashAmount(cashAmount + num);
    }
  };

  const handleDecimal = () => {
    if (!cashAmount.includes(".")) {
      setCashAmount(cashAmount + ".");
    }
  };

  const handleBackspace = () => {
    if (cashAmount.length > 0) {
      setCashAmount(cashAmount.slice(0, -1));
    }
  };

  const handleClear = () => {
    setCashAmount("");
    setShowCheckmark(false);
  };

  const handleConfirm = () => {
    if (!isAmountValid) return;

    // Show checkmark animation - smooth fade in and scale, no bounce
    setShowCheckmark(true);
    checkmarkOpacity.value = withTiming(1, { duration: 300 });
    checkmarkScale.value = withTiming(1, { duration: 300 });

    // Keep checkmark visible for 2 seconds, then show receipt prompt (change will be shown there)
    setTimeout(() => {
      setShowReceiptPrompt(true);
    }, 2000);
  };

  const handleNoReceipt = () => {
    onComplete();
    onClose();
  };

  const handleYesReceipt = () => {
    onReceiptRequest();
    onComplete();
    onClose();
  };

  const checkmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkmarkScale.value }],
    opacity: checkmarkOpacity.value,
  }));

  if (showReceiptPrompt) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <BlurView intensity={60} tint="dark" style={styles.blurContainer}>
            <LinearGradient
              colors={["rgba(0, 0, 0, 0.6)", "rgba(0, 0, 0, 0.8)"]}
              style={styles.modalContainer}
            >
              {change > 0 && (
                <View style={styles.changeDueContainer}>
                  <Text style={styles.changeDueLabel}>Change Due</Text>
                  <Text style={styles.changeDueAmount}>${change.toFixed(2)}</Text>
                </View>
              )}
              <Text style={styles.receiptTitle}>Print Receipt?</Text>
              <Text style={styles.receiptSubtitle}>
                Would you like to print a receipt for this transaction?
              </Text>
              <View style={styles.receiptButtons}>
                <TouchableOpacity
                  onPress={handleNoReceipt}
                  style={[styles.receiptButton, styles.receiptButtonNo]}
                >
                  <Text style={styles.receiptButtonText}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleYesReceipt}
                  style={[styles.receiptButton, styles.receiptButtonYes]}
                >
                  <Text style={[styles.receiptButtonText, { color: "#000" }]}>
                    Yes
                  </Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </BlurView>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <BlurView intensity={60} tint="dark" style={styles.blurContainer}>
          <LinearGradient
            colors={["rgba(0, 0, 0, 0.6)", "rgba(0, 0, 0, 0.8)"]}
            style={styles.modalContainer}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Cash Payment</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Amount Display */}
            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>Amount Received</Text>
              <Text style={styles.amountValue}>
                ${cashAmount || "0.00"}
              </Text>
            </View>

            {/* Checkmark Overlay */}
            {showCheckmark && (
              <Animated.View style={[styles.checkmarkOverlay, checkmarkStyle]}>
                <View style={styles.checkmarkCircle}>
                  <Check size={64} color="#00ff00" strokeWidth={4} />
                </View>
              </Animated.View>
            )}

            {/* Numpad */}
            <View style={styles.numpadContainer}>
              {/* Row 1: 1, 2, 3 */}
              <View style={styles.numpadRow}>
                {["1", "2", "3"].map((num) => (
                  <TouchableOpacity
                    key={num}
                    onPress={() => handleNumberPress(num)}
                    style={styles.numpadButton}
                  >
                    <Text style={styles.numpadButtonText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Row 2: 4, 5, 6 */}
              <View style={styles.numpadRow}>
                {["4", "5", "6"].map((num) => (
                  <TouchableOpacity
                    key={num}
                    onPress={() => handleNumberPress(num)}
                    style={styles.numpadButton}
                  >
                    <Text style={styles.numpadButtonText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Row 3: 7, 8, 9 */}
              <View style={styles.numpadRow}>
                {["7", "8", "9"].map((num) => (
                  <TouchableOpacity
                    key={num}
                    onPress={() => handleNumberPress(num)}
                    style={styles.numpadButton}
                  >
                    <Text style={styles.numpadButtonText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Row 4: ., 0, ⌫ */}
              <View style={styles.numpadRow}>
                <TouchableOpacity
                  onPress={handleDecimal}
                  style={styles.numpadButton}
                >
                  <Text style={styles.numpadButtonText}>.</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleNumberPress("0")}
                  style={styles.numpadButton}
                >
                  <Text style={styles.numpadButtonText}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleBackspace}
                  style={styles.numpadButton}
                >
                  <Text style={styles.numpadButtonText}>⌫</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                onPress={handleClear}
                style={[styles.actionButton, styles.clearButton]}
              >
                <Text style={styles.actionButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                disabled={!isAmountValid}
                style={[
                  styles.actionButton,
                  styles.confirmButton,
                  !isAmountValid && styles.confirmButtonDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    !isAmountValid && styles.actionButtonTextDisabled,
                  ]}
                >
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  blurContainer: {
    width: "90%",
    maxWidth: 600,
    borderRadius: 24,
    overflow: "hidden",
  },
  modalContainer: {
    padding: 32,
    position: "relative",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  amountContainer: {
    alignItems: "center",
    marginBottom: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  amountLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    marginBottom: 12,
    fontFamily: "RobotoCondensed_400Regular",
  },
  amountValue: {
    color: "#fff",
    fontSize: 56,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
  },
  changeContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  changeLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    marginBottom: 4,
    fontFamily: "RobotoCondensed_400Regular",
  },
  changeAmount: {
    color: "#67E3FF",
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
  },
  checkmarkOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  checkmarkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(0, 255, 0, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#00ff00",
  },
  numpadContainer: {
    marginBottom: 20,
  },
  numpadRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  numpadButton: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  numpadButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  clearButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  confirmButton: {
    backgroundColor: "#67E3FF",
  },
  confirmButtonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    opacity: 0.5,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
  },
  actionButtonTextDisabled: {
    color: "rgba(255, 255, 255, 0.3)",
  },
  receiptTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
    fontFamily: "RobotoCondensed_400Regular",
  },
  changeDueContainer: {
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  changeDueLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    marginBottom: 8,
    fontFamily: "RobotoCondensed_400Regular",
  },
  changeDueAmount: {
    color: "#67E3FF",
    fontSize: 36,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
  },
  receiptSubtitle: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
    fontFamily: "RobotoCondensed_400Regular",
  },
  receiptButtons: {
    flexDirection: "row",
    gap: 16,
  },
  receiptButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  receiptButtonNo: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  receiptButtonYes: {
    backgroundColor: "#67E3FF",
  },
  receiptButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
  },
});

