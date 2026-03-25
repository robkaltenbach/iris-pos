import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { CreditCard, DollarSign } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

interface PaymentMethodModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCash: () => void;
  onSelectCard: () => void;
  total: number;
}

export function PaymentMethodModal({
  visible,
  onClose,
  onSelectCash,
  onSelectCard,
  total,
}: PaymentMethodModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={60} tint="dark" style={styles.blurContainer}>
          <LinearGradient
            colors={["rgba(0, 0, 0, 0.6)", "rgba(0, 0, 0, 0.8)"]}
            style={styles.modalContainer}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Select Payment Method</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                onPress={onSelectCash}
                style={styles.paymentButton}
              >
                <LinearGradient
                  colors={["#67E3FF", "#4DB8D9"]}
                  style={styles.buttonGradient}
                >
                  <DollarSign size={32} color="#000" />
                  <Text style={styles.buttonText}>Cash</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onSelectCard}
                style={styles.paymentButton}
              >
                <LinearGradient
                  colors={["#A984FF", "#8B6FE6"]}
                  style={styles.buttonGradient}
                >
                  <CreditCard size={32} color="#fff" />
                  <Text style={[styles.buttonText, { color: "#fff" }]}>
                    Card
                  </Text>
                </LinearGradient>
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
    maxWidth: 500,
    borderRadius: 24,
    overflow: "hidden",
  },
  modalContainer: {
    padding: 32,
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
  closeText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  totalContainer: {
    alignItems: "center",
    marginBottom: 32,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  totalLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    marginBottom: 8,
    fontFamily: "RobotoCondensed_400Regular",
  },
  totalAmount: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
  },
  buttonContainer: {
    gap: 16,
  },
  paymentButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 32,
    gap: 12,
  },
  buttonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    fontFamily: "RobotoCondensed_400Regular",
  },
});

