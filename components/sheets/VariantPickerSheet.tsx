import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useMemo, forwardRef } from "react";
import { X, Check } from "lucide-react-native";

interface Variant {
  id: string;
  name: string;
  price: number;
  similarity: number;
  imageUrl?: string;
}

interface VariantPickerSheetProps {
  variants: Variant[];
  onSelect: (variant: Variant) => void;
  onClose: () => void;
}

export const VariantPickerSheet = forwardRef<BottomSheet, VariantPickerSheetProps>(
  ({ variants, onSelect, onClose }, ref) => {
    const snapPoints = useMemo(() => ["60%"], []);

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onClose}
        backgroundStyle={{ backgroundColor: "transparent" }}
      >
        <BottomSheetView style={{ flex: 1, padding: 16 }}>
          <GlassPanel className="flex-1 p-6">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-white text-2xl font-bold" style={{ fontFamily: "RobotoCondensed_400Regular" }}>Select Product</Text>
                <Text className="text-white/60 text-sm mt-1" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
                  Multiple similar items detected
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} className="p-2">
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Variants List */}
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              {variants.map((variant) => (
                <TouchableOpacity
                  key={variant.id}
                  onPress={() => onSelect(variant)}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 mb-3"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-white font-semibold text-base mb-1" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
                        {variant.name}
                      </Text>
                      <Text className="text-white/60 text-sm" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
                        ${variant.price.toFixed(2)}
                      </Text>

                      {/* Similarity Indicator */}
                      <View className="mt-2">
                        <View className="flex-row items-center gap-2 mb-1">
                          <Text className="text-white/50 text-xs" style={{ fontFamily: "RobotoCondensed_400Regular" }}>Similarity</Text>
                          <Text className="text-[#67E3FF] text-xs font-semibold" style={{ fontFamily: "RobotoCondensed_400Regular" }}>
                            {Math.round(variant.similarity * 100)}%
                          </Text>
                        </View>
                        <View className="h-1 bg-white/10 rounded-full overflow-hidden">
                          <View
                            className="h-full bg-[#67E3FF] rounded-full"
                            style={{ width: `${variant.similarity * 100}%` }}
                          />
                        </View>
                      </View>
                    </View>

                    <View className="ml-4">
                      <View className="w-12 h-12 bg-white/10 rounded-full items-center justify-center border border-[#67E3FF]/30">
                        <Check size={24} color="#67E3FF" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </GlassPanel>
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

VariantPickerSheet.displayName = "VariantPickerSheet";
