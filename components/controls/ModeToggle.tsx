import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Package, ShoppingCart, LogOut } from "lucide-react-native";

interface ModeToggleProps {
  mode: "inventory" | "sale";
  onModeChange: (mode: "inventory" | "sale") => void;
  onSignOut: () => void;
}

export function ModeToggle({ mode, onModeChange, onSignOut }: ModeToggleProps) {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={{ 
      flexDirection: "row", 
      alignItems: "center", 
      justifyContent: "space-between",
      width: "100%",
    }}>
      {/* Mode Toggle - Top Left */}
      <View className="flex-row bg-black/40 rounded-xl border border-white/20 overflow-hidden">
        <TouchableOpacity
          onPress={() => onModeChange("sale")}
          className={`flex-row items-center gap-2 px-4 py-3 ${
            mode === "sale" ? "bg-[#A984FF]" : ""
          }`}
        >
          <ShoppingCart size={18} color={mode === "sale" ? "#fff" : "#A984FF"} strokeWidth={1.5} />
          <Text
            className={`font-semibold text-sm ${
              mode === "sale" ? "text-white" : "text-white/60"
            }`}
          >
            Sale
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onModeChange("inventory")}
          className={`flex-row items-center gap-2 px-4 py-3 ${
            mode === "inventory" ? "bg-[#67E3FF]" : ""
          }`}
        >
          <Package size={18} color={mode === "inventory" ? "#000" : "#67E3FF"} strokeWidth={1.5} />
          <Text
            className={`font-semibold text-sm ${
              mode === "inventory" ? "text-black" : "text-white/60"
            }`}
          >
            Inventory
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sign Out Button - Top Right */}
      <TouchableOpacity
        onPress={onSignOut}
        className="flex-row items-center gap-2 bg-black/40 px-4 py-3 rounded-xl border border-white/20"
      >
        <LogOut size={18} color="#ff6b6b" strokeWidth={1.5} />
        <Text className="text-[#ff6b6b] font-semibold text-sm">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
