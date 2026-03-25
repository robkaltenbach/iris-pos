import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useState, useCallback, useMemo, forwardRef, useEffect } from "react";
import { Save, X } from "lucide-react-native";
import { AIProductData } from "@/lib/types";

interface ProductData {
  name: string;
  short_display_name?: string;
  brand?: string;
  category?: string;
  guessed_size?: string;
  color?: string;
  pack_size?: string;
  human_readable_description?: string;
  price: string;
  cost: string;
  sku: string;
}

interface ProductSetupSheetProps {
  onSave: (data: ProductData) => void;
  onClose: () => void;
  initialData?: AIProductData;
  capturedImageUri?: string | null;
}

export const ProductSetupSheet = forwardRef<BottomSheet, ProductSetupSheetProps>(
  ({ onSave, onClose, initialData }, ref) => {
    const [formData, setFormData] = useState<ProductData>({
      name: initialData?.name || "",
      short_display_name: initialData?.short_display_name || "",
      brand: initialData?.brand || "",
      category: initialData?.category || "",
      guessed_size: initialData?.guessed_size || "",
      color: initialData?.color || "",
      pack_size: initialData?.pack_size || "",
      human_readable_description: initialData?.human_readable_description || "",
      price: "",
      cost: "",
      sku: "",
    });

    // Update form when initialData changes
    useEffect(() => {
      if (initialData) {
        setFormData(prev => ({
          ...prev,
          name: initialData.name || prev.name,
          short_display_name: initialData.short_display_name || prev.short_display_name,
          brand: initialData.brand || prev.brand,
          category: initialData.category || prev.category,
          guessed_size: initialData.guessed_size || prev.guessed_size,
          color: initialData.color || prev.color,
          pack_size: initialData.pack_size || prev.pack_size,
          human_readable_description: initialData.human_readable_description || prev.human_readable_description,
        }));
      }
    }, [initialData]);

    const snapPoints = useMemo(() => ["75%"], []);

    const handleSave = useCallback(() => {
      if (formData.name && formData.price) {
        onSave(formData);
        // Reset form
        setFormData({
          name: "",
          short_display_name: "",
          brand: "",
          category: "",
          guessed_size: "",
          color: "",
          pack_size: "",
          human_readable_description: "",
          price: "",
          cost: "",
          sku: "",
        });
      }
    }, [formData, onSave]);

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
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-white text-2xl font-bold">Product Setup</Text>
              <TouchableOpacity onPress={onClose} className="p-2">
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <View>
                  <Text className="text-white/70 text-sm mb-2">Product Name *</Text>
                  <TextInput
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                    placeholder="Enter product name"
                    placeholderTextColor="#666"
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-base"
                  />
                </View>

                <View>
                  <Text className="text-white/70 text-sm mb-2">Short Display Name</Text>
                  <TextInput
                    value={formData.short_display_name}
                    onChangeText={(text) => setFormData({ ...formData, short_display_name: text })}
                    placeholder="Short name for display"
                    placeholderTextColor="#666"
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-base"
                  />
                </View>

                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <Text className="text-white/70 text-sm mb-2">Brand</Text>
                    <TextInput
                      value={formData.brand}
                      onChangeText={(text) => setFormData({ ...formData, brand: text })}
                      placeholder="Brand name"
                      placeholderTextColor="#666"
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-base"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-white/70 text-sm mb-2">Category</Text>
                    <TextInput
                      value={formData.category}
                      onChangeText={(text) => setFormData({ ...formData, category: text })}
                      placeholder="Category"
                      placeholderTextColor="#666"
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-base"
                    />
                  </View>
                </View>

                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <Text className="text-white/70 text-sm mb-2">Size</Text>
                    <TextInput
                      value={formData.guessed_size}
                      onChangeText={(text) => setFormData({ ...formData, guessed_size: text })}
                      placeholder="Size"
                      placeholderTextColor="#666"
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-base"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-white/70 text-sm mb-2">Color</Text>
                    <TextInput
                      value={formData.color}
                      onChangeText={(text) => setFormData({ ...formData, color: text })}
                      placeholder="Color"
                      placeholderTextColor="#666"
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-base"
                    />
                  </View>
                </View>

                <View>
                  <Text className="text-white/70 text-sm mb-2">Pack Size</Text>
                  <TextInput
                    value={formData.pack_size}
                    onChangeText={(text) => setFormData({ ...formData, pack_size: text })}
                    placeholder="e.g., 12 pack, 24 oz"
                    placeholderTextColor="#666"
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-base"
                  />
                </View>

                <View>
                  <Text className="text-white/70 text-sm mb-2">Description</Text>
                  <TextInput
                    value={formData.human_readable_description}
                    onChangeText={(text) => setFormData({ ...formData, human_readable_description: text })}
                    placeholder="Product description"
                    placeholderTextColor="#666"
                    multiline
                    numberOfLines={3}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-base"
                  />
                </View>

                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <Text className="text-white/70 text-sm mb-2">Price *</Text>
                    <TextInput
                      value={formData.price}
                      onChangeText={(text) => setFormData({ ...formData, price: text })}
                      placeholder="0.00"
                      placeholderTextColor="#666"
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-base"
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-white/70 text-sm mb-2">Cost</Text>
                    <TextInput
                      value={formData.cost}
                      onChangeText={(text) => setFormData({ ...formData, cost: text })}
                      placeholder="0.00"
                      placeholderTextColor="#666"
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-base"
                    />
                  </View>
                </View>

                <View>
                  <Text className="text-white/70 text-sm mb-2">SKU</Text>
                  <TextInput
                    value={formData.sku}
                    onChangeText={(text) => setFormData({ ...formData, sku: text })}
                    placeholder="SKU/Barcode"
                    placeholderTextColor="#666"
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-base"
                  />
                </View>
              </View>
            </ScrollView>

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={!formData.name || !formData.price}
              className={`mt-6 py-4 rounded-xl flex-row items-center justify-center gap-2 ${
                formData.name && formData.price
                  ? "bg-[#67E3FF]"
                  : "bg-white/5 border border-white/10"
              }`}
            >
              <Save size={20} color={formData.name && formData.price ? "#000" : "#666"} />
              <Text
                className={`font-bold text-base ${
                  formData.name && formData.price ? "text-black" : "text-white/30"
                }`}
              >
                Save Product
              </Text>
            </TouchableOpacity>
          </GlassPanel>
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

ProductSetupSheet.displayName = "ProductSetupSheet";
