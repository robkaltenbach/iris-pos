import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { useState, useEffect, useRef } from "react";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  FadeIn,
  FadeOut,
  Easing,
} from "react-native-reanimated";
import { Check, X, CreditCard } from "lucide-react-native";

interface CardPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  total: number;
  onComplete: () => void;
  onReceiptRequest: () => void;
}

const PROCESSING_STEPS = [
  "Contacting payment processor…",
  "Sending authorization request…",
  "Awaiting bank response…",
  "Finalizing transaction…",
  "Approved",
];

export function CardPaymentModal({
  visible,
  onClose,
  total,
  onComplete,
  onReceiptRequest,
}: CardPaymentModalProps) {
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [showReceiptPrompt, setShowReceiptPrompt] = useState(false);
  const hasStartedRef = useRef(false);
  
  const checkmarkScale = useSharedValue(0);
  const checkmarkOpacity = useSharedValue(0);
  const spinnerRotation = useSharedValue(0);

  // Animate spinner when processing
  useEffect(() => {
    if (currentStep >= 0 && currentStep < PROCESSING_STEPS.length - 1 && !showCheckmark) {
      spinnerRotation.value = withRepeat(
        withTiming(360, {
          duration: 1000,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    } else {
      spinnerRotation.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, showCheckmark]);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinnerRotation.value}deg` }],
  }));

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setCurrentStep(-1);
      setShowCheckmark(false);
      setShowReceiptPrompt(false);
      checkmarkScale.value = 0;
      checkmarkOpacity.value = 0;
      spinnerRotation.value = 0;
      hasStartedRef.current = false;
    } else if (visible && !hasStartedRef.current) {
      // Start processing when modal opens (only once)
      hasStartedRef.current = true;
      startProcessing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const startProcessing = () => {
    setCurrentStep(0);
    
    // Random timing for each step - total ~2 seconds
    const timings = [
      300 + Math.random() * 200,  // 300-500ms
      400 + Math.random() * 200,  // 400-600ms
      500 + Math.random() * 200,  // 500-700ms
      400 + Math.random() * 200,  // 400-600ms
      200 + Math.random() * 100,  // 200-300ms
    ];
    
    let accumulatedTime = 0;
    
    // Show each step in sequence
    timings.forEach((delay, index) => {
      accumulatedTime += delay;
      setTimeout(() => {
        if (index < PROCESSING_STEPS.length - 1) {
          setCurrentStep(index + 1);
        } else {
          // Show "Approved" step, then checkmark
          setCurrentStep(PROCESSING_STEPS.length - 1);
          setTimeout(() => {
            setShowCheckmark(true);
            checkmarkOpacity.value = withTiming(1, { duration: 300 });
            checkmarkScale.value = withTiming(1, { duration: 300 });
            
            // After checkmark visible for 1.5s, show receipt prompt
            setTimeout(() => {
              setShowReceiptPrompt(true);
            }, 1500);
          }, 400);
        }
      }, accumulatedTime);
    });
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
              <View style={styles.headerLeft}>
                <CreditCard size={24} color="#A984FF" />
                <Text style={styles.title}>Card Payment</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Total Amount */}
            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>Total</Text>
              <Text style={styles.amountValue}>${total.toFixed(2)}</Text>
            </View>

            {/* Processing Steps or Checkmark */}
            {showCheckmark ? (
              <Animated.View style={[styles.checkmarkContainer, checkmarkStyle]}>
                <View style={styles.checkmarkCircle}>
                  <Check size={64} color="#00ff00" strokeWidth={4} />
                </View>
                <Text style={styles.approvedText}>Transaction Approved</Text>
              </Animated.View>
            ) : (
              <View style={styles.processingContainer}>
                <View style={styles.processingAnimation}>
                  <CreditCard size={48} color="#A984FF" />
                  <View style={styles.loadingDots}>
                    <View style={[styles.dot, styles.dot1]} />
                    <View style={[styles.dot, styles.dot2]} />
                    <View style={[styles.dot, styles.dot3]} />
                  </View>
                </View>
                <View style={styles.stepsContainer}>
                  {PROCESSING_STEPS.map((step, index) => (
                    <Animated.View
                      key={index}
                      entering={currentStep >= index ? FadeIn.duration(200) : undefined}
                      style={[
                        styles.step,
                        currentStep >= index && styles.stepActive,
                        currentStep > index && styles.stepCompleted,
                      ]}
                    >
                      <View style={styles.stepIndicator}>
                        {currentStep > index ? (
                          <Check size={16} color="#00ff00" />
                        ) : currentStep === index ? (
                          <Animated.View style={[styles.stepSpinner, spinnerStyle]} />
                        ) : (
                          <View style={styles.stepDot} />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.stepText,
                          currentStep >= index && styles.stepTextActive,
                        ]}
                      >
                        {step}
                      </Text>
                    </Animated.View>
                  ))}
                </View>
              </View>
            )}
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    marginBottom: 32,
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
  processingContainer: {
    alignItems: "center",
    minHeight: 300,
  },
  processingAnimation: {
    alignItems: "center",
    marginBottom: 32,
  },
  loadingDots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#A984FF",
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.6,
  },
  dot3: {
    opacity: 0.8,
  },
  stepsContainer: {
    width: "100%",
    gap: 12,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  stepActive: {
    backgroundColor: "rgba(169, 132, 255, 0.15)",
    borderColor: "rgba(169, 132, 255, 0.3)",
  },
  stepCompleted: {
    backgroundColor: "rgba(0, 255, 0, 0.1)",
    borderColor: "rgba(0, 255, 0, 0.3)",
  },
  stepIndicator: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  stepSpinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#A984FF",
    borderTopColor: "transparent",
  },
  stepText: {
    flex: 1,
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 16,
    fontFamily: "RobotoCondensed_400Regular",
  },
  stepTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  checkmarkContainer: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 300,
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
    marginBottom: 24,
  },
  approvedText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
  },
  receiptTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
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

