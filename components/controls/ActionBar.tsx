import { View, TouchableOpacity, Text } from "react-native";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Scan, Trash2, CreditCard, Plus, Filter } from "lucide-react-native";

interface ActionBarProps {
  mode: "inventory" | "sale";
  onScan: () => void;
  onClear: () => void;
  onPay: () => void;
  onManualAdd: () => void;
  onFilter: () => void;
  paymentEnabled: boolean;
}

export function ActionBar({
  mode,
  onScan,
  onClear,
  onPay,
  onManualAdd,
  onFilter,
  paymentEnabled,
}: ActionBarProps) {
  return (
    <View className="absolute bottom-0 left-0 right-0 p-4">
      <GlassPanel className="p-4">
        <View className="flex-row items-center justify-around gap-2">
          {/* Scan Button */}
          <TouchableOpacity
            onPress={onScan}
            className="bg-[#67E3FF] px-6 py-3 rounded-xl flex-row items-center gap-2 shadow-lg"
            style={{
              shadowColor: "#67E3FF",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.5,
              shadowRadius: 8,
            }}
          >
            <Scan size={20} color="#000" />
            <Text className="text-black font-bold text-base">Scan</Text>
          </TouchableOpacity>

          {/* Clear Button */}
          <TouchableOpacity
            onPress={onClear}
            className="bg-white/10 px-4 py-3 rounded-xl border border-white/20"
          >
            <Trash2 size={20} color="#fff" />
          </TouchableOpacity>

          {/* Manual Add Button */}
          <TouchableOpacity
            onPress={onManualAdd}
            className="bg-white/10 px-4 py-3 rounded-xl border border-white/20"
          >
            <Plus size={20} color="#fff" />
          </TouchableOpacity>

          {/* Filter Button */}
          <TouchableOpacity
            onPress={onFilter}
            className="bg-white/10 px-4 py-3 rounded-xl border border-white/20"
          >
            <Filter size={20} color="#fff" />
          </TouchableOpacity>

          {/* Pay Button */}
          {mode === "sale" && (
            <TouchableOpacity
              onPress={onPay}
              disabled={!paymentEnabled}
              className={`px-6 py-3 rounded-xl flex-row items-center gap-2 ${
                paymentEnabled
                  ? "bg-[#A984FF] shadow-lg"
                  : "bg-white/5 border border-white/10"
              }`}
              style={
                paymentEnabled
                  ? {
                      shadowColor: "#A984FF",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.5,
                      shadowRadius: 8,
                    }
                  : {}
              }
            >
              <CreditCard size={20} color={paymentEnabled ? "#fff" : "#666"} />
              <Text
                className={`font-bold text-base ${
                  paymentEnabled ? "text-white" : "text-white/30"
                }`}
              >
                Pay
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </GlassPanel>
    </View>
  );
}
