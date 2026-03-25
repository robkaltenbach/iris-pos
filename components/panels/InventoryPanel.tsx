import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, StyleSheet, KeyboardAvoidingView, Platform, Keyboard, Dimensions, UIManager, findNodeHandle, Pressable, Appearance } from "react-native";
import { useState, useEffect, useMemo, useRef } from "react";
import { Save, Plus, Search, ChevronLeft, Edit, Package, Layers, ChevronRight, X, Minus } from "lucide-react-native";
import { AIProductData, InventoryItem } from "@/lib/types";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

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

interface InventoryPanelProps {
  mode: "inventory" | "sale";
  initialData?: AIProductData | null;
  capturedImageUri?: string | null;
  onSave: (data: ProductData) => void;
  onClose?: () => void;
  inventoryItems?: InventoryItem[];
  selectedPO?: any;
  onAddToPO?: (item: InventoryItem) => void;
  onEditItem?: (item: InventoryItem) => void;
  onAddVariant?: (item: InventoryItem) => void;
  onUpdateInventoryItem?: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  editingItemId?: string | null;
  setEditingItemId?: (id: string | null) => void;
  refetchInventoryItems?: () => Promise<void>;
}

type ViewState = "categories" | "items" | "variants" | "actions";

export function InventoryPanel({
  mode,
  initialData,
  capturedImageUri,
  onSave,
  onClose,
  inventoryItems = [],
  selectedPO,
  onAddToPO,
  onEditItem,
  onAddVariant,
  onUpdateInventoryItem,
  editingItemId,
  setEditingItemId,
  refetchInventoryItems,
}: InventoryPanelProps) {
  const [viewState, setViewState] = useState<ViewState>("categories");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<{
    size?: string;
    color?: string;
    pack_size?: string;
  }>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [breadcrumbPath, setBreadcrumbPath] = useState<Array<{ label: string; action: () => void }>>([]);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const inputRefs = useRef<{ [key: string]: TextInput | null }>({});
  const inputLayouts = useRef<{ [key: string]: { y: number; height: number; absoluteY: number } }>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  // Force light mode for keyboard styling (skip on web)
  useEffect(() => {
    if (Platform.OS !== 'web' && Platform.OS === 'ios') {
      Appearance.setColorScheme('light');
    }
  }, []);
  
  const [formData, setFormData] = useState<ProductData>({
    name: initialData?.name || "",
    short_display_name: initialData?.short_display_name || "",
    brand: initialData?.brand || "",
    category: initialData?.category || "",
    guessed_size: initialData?.guessed_size || "",
    color: initialData?.color || "",
    pack_size: initialData?.pack_size || "",
    human_readable_description: initialData?.human_readable_description || "",
    price: (initialData as any)?.price ? String((initialData as any).price) : "",
    cost: "",
    sku: (initialData as any)?.sku || "",
  });

  // Refetch inventory items whenever the panel receives new data (indicating it's being opened)
  useEffect(() => {
    if (refetchInventoryItems && initialData) {
      console.log("InventoryPanel: Refetching inventory items - panel opened with data");
      refetchInventoryItems().catch((error) => {
        console.error("Failed to refetch inventory items in InventoryPanel:", error);
      });
    }
  }, [initialData, refetchInventoryItems]); // Refetch when initialData changes (panel opened)
  
  // Also refetch on mount if no initialData (panel opened without data)
  useEffect(() => {
    if (refetchInventoryItems && !initialData) {
      console.log("InventoryPanel: Refetching inventory items on mount");
      refetchInventoryItems().catch((error) => {
        console.error("Failed to refetch inventory items in InventoryPanel:", error);
      });
    }
  }, []); // Run once on mount

  // Update form when initialData changes (for both AI data and editing)
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        name: initialData.name || prev.name,
        short_display_name: initialData.short_display_name || prev.short_display_name,
        brand: initialData.brand || prev.brand,
        category: initialData.category || prev.category,
        guessed_size: initialData.guessed_size || prev.guessed_size,
        color: initialData.color || prev.color,
        pack_size: initialData.pack_size || prev.pack_size,
        human_readable_description: initialData.human_readable_description || prev.human_readable_description,
        // If editing, also pre-fill price and cost if available
        price: (initialData as any).price ? String((initialData as any).price) : prev.price,
        cost: (initialData as any).cost ? String((initialData as any).cost) : prev.cost,
        sku: (initialData as any).sku || prev.sku,
      }));
      // Show add form when we have AI data or editing
      setShowAddForm(true);
      
      // Build breadcrumb path if editing
      if (editingItemId && selectedItem) {
        const path = [
          { label: "Select Existing", action: () => {
            setShowAddForm(false);
            setBreadcrumbPath([]);
            setViewState("categories");
            setSelectedCategory(null);
            setSelectedItem(null);
            setSelectedVariants({});
          }},
        ];
        if (selectedCategory) {
          path.push({ label: selectedCategory, action: () => {
            setShowAddForm(false);
            setViewState("items");
            setSelectedItem(null);
            setSelectedVariants({});
            setBreadcrumbPath([path[0]]);
          }});
        }
        if (selectedItem) {
          path.push({ label: selectedItem.name, action: () => {
            setShowAddForm(false);
            setViewState("actions");
            setBreadcrumbPath(path.slice(0, -1));
          }});
        }
        path.push({ label: "Edit", action: () => {} });
        setBreadcrumbPath(path);
      }
    } else {
      setShowAddForm(false);
      setBreadcrumbPath([]);
    }
  }, [initialData, editingItemId, selectedItem, selectedCategory]);

  // Handle keyboard show/hide and auto-scroll
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Auto-scroll when keyboard appears
        if (showAddForm && scrollViewRef.current) {
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, Platform.OS === 'ios' ? 300 : 150);
        }
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [showAddForm]);

  // Scroll to input when focused - aggressive scrolling
  const scrollToInput = (inputKey: string) => {
    // Simple, reliable scroll to input
    if (scrollViewRef.current) {
      const layout = inputLayouts.current[inputKey];
      if (layout) {
        scrollViewRef.current.scrollTo({
          y: Math.max(0, layout.y - 150),
          animated: true,
        });
      }
    }
  };

  // Helper to create input wrapper props
  const createInputWrapperProps = (key: string) => ({
    onLayout: (e: any) => {
      const { y, height } = e.nativeEvent.layout;
      inputLayouts.current[key] = {
        y, // Y position relative to ScrollView content
        height,
        absoluteY: 0, // Not used in this approach
      };
    },
  });

  // Helper to create input props with focus handling
  const createInputProps = (key: string, isNumeric = false) => ({
    ref: (ref: TextInput | null) => { 
      inputRefs.current[key] = ref; 
    },
    onFocus: () => {
      // Simple, single scroll attempt
      setTimeout(() => {
        if (scrollViewRef.current) {
          const layout = inputLayouts.current[key];
          if (layout) {
            scrollViewRef.current.scrollTo({
              y: Math.max(0, layout.y - 100),
              animated: true,
            });
          }
        }
      }, Platform.OS === 'ios' ? 300 : 100);
    },
    onBlur: () => {
      // Ensure keyboard dismisses properly
      if (isNumeric) {
        Keyboard.dismiss();
      }
    },
  });

  // Group inventory items by category
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, InventoryItem[]> = {};
    
    inventoryItems.forEach((item) => {
      const category = item.category || "Uncategorized";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });

    // Sort items within each category alphabetically
    Object.keys(grouped).forEach((category) => {
      grouped[category].sort((a, b) => a.name.localeCompare(b.name));
    });

    return grouped;
  }, [inventoryItems]);

  const categories = useMemo(() => {
    const cats = Object.keys(itemsByCategory).sort();
    // Move "Uncategorized" to the end
    const uncategorizedIndex = cats.indexOf("Uncategorized");
    if (uncategorizedIndex > -1) {
      cats.splice(uncategorizedIndex, 1);
      cats.push("Uncategorized");
    }
    return cats;
  }, [itemsByCategory]);

  // Get items for selected category
  const categoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    return itemsByCategory[selectedCategory] || [];
  }, [selectedCategory, itemsByCategory]);

  // Get unique variants for selected item
  const itemVariants = useMemo(() => {
    if (!selectedItem) return { sizes: [], colors: [], packSizes: [] };
    
    const matchingItems = categoryItems.filter(
      (item) => item.name === selectedItem.name
    );
    
    const sizes = new Set<string>();
    const colors = new Set<string>();
    const packSizes = new Set<string>();
    
    matchingItems.forEach((item) => {
      if (item.guessed_size) sizes.add(item.guessed_size);
      if (item.color) colors.add(item.color);
      if (item.pack_size) packSizes.add(item.pack_size);
    });
    
    return {
      sizes: Array.from(sizes).sort(),
      colors: Array.from(colors).sort(),
      packSizes: Array.from(packSizes).sort(),
    };
  }, [selectedItem, categoryItems]);

  // Check if item needs variant selection
  const needsVariantSelection = useMemo(() => {
    if (!selectedItem) return false;
    return (
      itemVariants.sizes.length > 0 ||
      itemVariants.colors.length > 0 ||
      itemVariants.packSizes.length > 0
    );
  }, [selectedItem, itemVariants]);

  // Pre-select single variants when item is selected or when entering variants view
  // Also auto-continue if all variants are single options
  useEffect(() => {
    if (selectedItem && viewState === "variants") {
      const newVariants: typeof selectedVariants = {};
      if (itemVariants.sizes.length === 1) {
        newVariants.size = itemVariants.sizes[0];
      }
      if (itemVariants.colors.length === 1) {
        newVariants.color = itemVariants.colors[0];
      }
      if (itemVariants.packSizes.length === 1) {
        newVariants.pack_size = itemVariants.packSizes[0];
      }
      if (Object.keys(newVariants).length > 0) {
        setSelectedVariants((prev) => ({ ...prev, ...newVariants }));
        
        // Auto-continue if all variants are single options (all preselected)
        const allSingleOptions = 
          (itemVariants.sizes.length === 0 || itemVariants.sizes.length === 1) &&
          (itemVariants.colors.length === 0 || itemVariants.colors.length === 1) &&
          (itemVariants.packSizes.length === 0 || itemVariants.packSizes.length === 1);
        
        if (allSingleOptions) {
          // Small delay to ensure state is updated
          setTimeout(() => {
            setViewState("actions");
          }, 100);
        }
      }
    }
  }, [selectedItem, viewState, itemVariants]);

  // Get the final selected item with variants
  const getFinalItem = (): InventoryItem | null => {
    if (!selectedItem) return null;
    
    if (!needsVariantSelection) return selectedItem;
    
    // Find item matching all selected variants
    const matchingItem = categoryItems.find((item) => {
      if (item.name !== selectedItem.name) return false;
      if (itemVariants.sizes.length > 0 && item.guessed_size !== selectedVariants.size) return false;
      if (itemVariants.colors.length > 0 && item.color !== selectedVariants.color) return false;
      if (itemVariants.packSizes.length > 0 && item.pack_size !== selectedVariants.pack_size) return false;
      return true;
    });
    
    return matchingItem || selectedItem;
  };

  // Get all variants of the selected item (all items with the same name)
  const getAllVariants = useMemo(() => {
    if (!selectedItem) return [];
    
    // Get all items with the same name (excluding PO items)
    const variants = inventoryItems.filter(
      (item) => 
        item.name === selectedItem.name && 
        !item.purchase_order_id // Only show inventory items, not PO items
    );
    
    // Sort by size, color, pack_size for consistent display
    return variants.sort((a, b) => {
      const aKey = `${a.guessed_size || ''}|${a.color || ''}|${a.pack_size || ''}`;
      const bKey = `${b.guessed_size || ''}|${b.color || ''}|${b.pack_size || ''}`;
      return aKey.localeCompare(bKey);
    });
  }, [selectedItem, inventoryItems]);

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (!onUpdateInventoryItem || newQuantity < 0) return;
    
    try {
      await onUpdateInventoryItem(itemId, { quantity: Math.max(0, newQuantity) });
    } catch (error) {
      console.error('Failed to update inventory quantity:', error);
    }
  };

  const handleSave = () => {
    // Dismiss keyboard before saving
    Keyboard.dismiss();
    
    if (formData.name && formData.price && formData.cost) {
      onSave(formData);
      // Reset form and navigation
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
      setShowAddForm(false);
      setBreadcrumbPath([]);
      setViewState("categories");
      setSelectedCategory(null);
      setSelectedItem(null);
      setSelectedVariants({});
    }
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setViewState("items");
    setBreadcrumbPath([
      { label: "Select Existing", action: () => {
        setViewState("categories");
        setSelectedCategory(null);
        setSelectedItem(null);
        setSelectedVariants({});
        setBreadcrumbPath([]);
      }},
      { label: category, action: () => {} },
    ]);
  };

  const handleItemSelect = (item: InventoryItem) => {
    // In sale mode, add directly to ticket and close panel
    if (mode === "sale" && onAddToPO) {
      onAddToPO(item);
      if (onClose) onClose();
      return;
    }
    
    setSelectedItem(item);
    setSelectedVariants({}); // Reset variants when selecting new item
    // Check if this item has variants by looking at all items with the same name
    const matchingItems = categoryItems.filter((i) => i.name === item.name);
    const hasSizes = matchingItems.some((i) => i.guessed_size);
    const hasColors = matchingItems.some((i) => i.color);
    const hasPackSizes = matchingItems.some((i) => i.pack_size);
    
    const newPath = [
      { label: "Select Existing", action: () => {
        setViewState("categories");
        setSelectedCategory(null);
        setSelectedItem(null);
        setSelectedVariants({});
        setBreadcrumbPath([]);
      }},
    ];
    if (selectedCategory) {
      newPath.push({ label: selectedCategory, action: () => {
        setViewState("items");
        setSelectedItem(null);
        setSelectedVariants({});
        setBreadcrumbPath(newPath.slice(0, -1));
      }});
    }
    newPath.push({ label: item.name, action: () => {} });
    setBreadcrumbPath(newPath);
    
    if (hasSizes || hasColors || hasPackSizes) {
      setViewState("variants");
      // Pre-select will happen in useEffect
    } else {
      setViewState("actions");
    }
  };

  const handleVariantContinue = () => {
    // Check if all required variants are selected
    const hasSize = itemVariants.sizes.length === 0 || selectedVariants.size;
    const hasColor = itemVariants.colors.length === 0 || selectedVariants.color;
    const hasPackSize = itemVariants.packSizes.length === 0 || selectedVariants.pack_size;
    
    if (hasSize && hasColor && hasPackSize) {
      setViewState("actions");
    }
  };

  const handleAddToPO = () => {
    const finalItem = getFinalItem();
    if (finalItem && onAddToPO) {
      onAddToPO(finalItem);
      // Reset navigation
      setViewState("categories");
      setSelectedCategory(null);
      setSelectedItem(null);
      setSelectedVariants({});
    }
  };

  const handleEdit = () => {
    const finalItem = getFinalItem();
    if (finalItem && onEditItem) {
      onEditItem(finalItem);
      // Don't reset navigation - we'll show the form with breadcrumbs
      setShowAddForm(true);
    }
  };

  const handleAddVariant = () => {
    const finalItem = getFinalItem();
    if (finalItem && onAddVariant) {
      onAddVariant(finalItem);
      // Reset navigation
      setViewState("categories");
      setSelectedCategory(null);
      setSelectedItem(null);
      setSelectedVariants({});
    }
  };

  const canContinueFromVariants = useMemo(() => {
    const hasSize = itemVariants.sizes.length === 0 || selectedVariants.size;
    const hasColor = itemVariants.colors.length === 0 || selectedVariants.color;
    const hasPackSize = itemVariants.packSizes.length === 0 || selectedVariants.pack_size;
    return hasSize && hasColor && hasPackSize;
  }, [itemVariants, selectedVariants]);

  const tintColor = mode === "sale" ? "rgba(169, 132, 255," : "rgba(103, 227, 255,";

  return (
    <View style={styles.container}>
      {/* Header with Add New button */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {breadcrumbPath.length > 0 ? (
            <View style={styles.breadcrumbContainer}>
              {breadcrumbPath.map((crumb, index) => (
                <View key={index} style={styles.breadcrumbItem}>
                  {index > 0 && <ChevronRight size={14} color="rgba(255, 255, 255, 0.5)" style={{ marginHorizontal: 4 }} />}
                  <TouchableOpacity
                    onPress={crumb.action}
                    disabled={index === breadcrumbPath.length - 1}
                    style={styles.breadcrumbButton}
                  >
                    <Text style={[
                      styles.breadcrumbText,
                      index === breadcrumbPath.length - 1 && styles.breadcrumbTextActive
                    ]}>
                      {crumb.label}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.headerTitle}>Select Existing</Text>
          )}
        </View>
        {!showAddForm && mode !== "sale" && (
          <TouchableOpacity
            style={styles.addNewButton}
            onPress={() => {
              setShowAddForm(true);
              setBreadcrumbPath([]);
              setViewState("categories");
              setSelectedCategory(null);
              setSelectedItem(null);
              setSelectedVariants({});
            }}
          >
            <Plus size={16} color="#fff" />
            <Text style={styles.addNewButtonText}>Add New</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {showAddForm ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              ref={(ref) => {
                scrollViewRef.current = ref;
              }}
              style={styles.scrollView}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
              keyboardDismissMode="on-drag"
              nestedScrollEnabled={true}
            >
            {/* Captured Image */}
            {capturedImageUri && (
              <View style={styles.imageContainer}>
                <Image source={{ uri: capturedImageUri }} style={styles.capturedImage} />
              </View>
            )}

            {/* Form Fields */}
            <View style={styles.formContainer}>
              <View style={styles.field} {...createInputWrapperProps('name')}>
                <Text style={styles.label}>Product Name *</Text>
                <TextInput
                  {...createInputProps('name')}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Enter product name"
                  placeholderTextColor="#555"
                  style={styles.input}
                />
              </View>

              <View style={styles.field} {...createInputWrapperProps('short_display_name')}>
                <Text style={styles.label}>Short Display Name</Text>
                <TextInput
                  {...createInputProps('short_display_name')}
                  value={formData.short_display_name}
                  onChangeText={(text) => setFormData({ ...formData, short_display_name: text })}
                  placeholder="Short name for display"
                  placeholderTextColor="#555"
                  style={styles.input}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.field, styles.halfField]} {...createInputWrapperProps('brand')}>
                  <Text style={styles.label}>Brand</Text>
                  <TextInput
                    {...createInputProps('brand')}
                    value={formData.brand}
                    onChangeText={(text) => setFormData({ ...formData, brand: text })}
                    placeholder="Brand name"
                    placeholderTextColor="#555"
                    style={styles.input}
                  />
                </View>

                <View style={[styles.field, styles.halfField]} {...createInputWrapperProps('category')}>
                  <Text style={styles.label}>Category</Text>
                  <TextInput
                    {...createInputProps('category')}
                    value={formData.category}
                    onChangeText={(text) => setFormData({ ...formData, category: text })}
                    placeholder="Category"
                    placeholderTextColor="#555"
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.field, styles.halfField]} {...createInputWrapperProps('guessed_size')}>
                  <Text style={styles.label}>Size</Text>
                  <TextInput
                    {...createInputProps('guessed_size')}
                    value={formData.guessed_size}
                    onChangeText={(text) => setFormData({ ...formData, guessed_size: text })}
                    placeholder="Size"
                    placeholderTextColor="#555"
                    style={styles.input}
                  />
                </View>

                <View style={[styles.field, styles.halfField]} {...createInputWrapperProps('color')}>
                  <Text style={styles.label}>Color</Text>
                  <TextInput
                    {...createInputProps('color')}
                    value={formData.color}
                    onChangeText={(text) => setFormData({ ...formData, color: text })}
                    placeholder="Color"
                    placeholderTextColor="#555"
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.field} {...createInputWrapperProps('pack_size')}>
                <Text style={styles.label}>Pack Size</Text>
                <TextInput
                  {...createInputProps('pack_size')}
                  value={formData.pack_size}
                  onChangeText={(text) => setFormData({ ...formData, pack_size: text })}
                  placeholder="e.g., 12 pack, 24 oz"
                  placeholderTextColor="#555"
                  style={styles.input}
                />
              </View>

              <View style={styles.field} {...createInputWrapperProps('human_readable_description')}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  {...createInputProps('human_readable_description')}
                  value={formData.human_readable_description}
                  onChangeText={(text) => setFormData({ ...formData, human_readable_description: text })}
                  placeholder="Product description"
                  placeholderTextColor="#555"
                  multiline
                  numberOfLines={3}
                  style={[styles.input, styles.textArea]}
                />
              </View>

              {(() => {
                const cost = parseFloat(formData.cost) || 0;
                const price = parseFloat(formData.price) || 0;
                const isCostIssue = cost > 0 && price > 0 && cost >= price;
                const isCostEqual = cost > 0 && price > 0 && cost === price;
                const isCostHigher = cost > 0 && price > 0 && cost > price;
                
                return (
                  <View style={[
                    styles.costPriceContainer,
                    isCostIssue && styles.costPriceContainerWarning
                  ]}>
              <View style={styles.row}>
                <View style={[styles.field, styles.halfField]} {...createInputWrapperProps('price')}>
                  <Text style={styles.label}>Price *</Text>
                  <TextInput
                    {...createInputProps('price', true)}
                    value={formData.price}
                    onChangeText={(text) => {
                      // Only allow numbers and one decimal point
                      const cleaned = text.replace(/[^0-9.]/g, '');
                      const parts = cleaned.split('.');
                      const formatted = parts.length > 2 
                        ? parts[0] + '.' + parts.slice(1).join('')
                        : cleaned;
                      setFormData({ ...formData, price: formatted });
                    }}
                    placeholder="0.00"
                    placeholderTextColor="#999"
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoCorrect={false}
                    blurOnSubmit={true}
                    textContentType="none"
                    editable={true}
                    style={styles.input}
                  />
                </View>

                <View style={[styles.field, styles.halfField]} {...createInputWrapperProps('cost')}>
                  <Text style={styles.label}>Cost *</Text>
                  <TextInput
                    {...createInputProps('cost', true)}
                    value={formData.cost}
                    onChangeText={(text) => {
                      // Only allow numbers and one decimal point
                      const cleaned = text.replace(/[^0-9.]/g, '');
                      const parts = cleaned.split('.');
                      const formatted = parts.length > 2 
                        ? parts[0] + '.' + parts.slice(1).join('')
                        : cleaned;
                      setFormData({ ...formData, cost: formatted });
                    }}
                    placeholder="0.00"
                    placeholderTextColor="#999"
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoCorrect={false}
                    blurOnSubmit={true}
                    textContentType="none"
                    editable={true}
                    style={styles.input}
                  />
                </View>
              </View>

                    {/* Cost/Price Warning */}
                    {isCostEqual && (
                      <View style={styles.costWarningContainer}>
                        <Text style={styles.costWarningText}>
                          Cost is the same as price. You are breaking even on this item at this price
                        </Text>
                      </View>
                    )}
                    {isCostHigher && (
                      <View style={styles.costWarningContainer}>
                        <Text style={styles.costWarningText}>
                          Cost is higher than price. You are losing money on this item at this price.
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}

              <View style={styles.field} {...createInputWrapperProps('sku')}>
                <Text style={styles.label}>SKU</Text>
                <TextInput
                  {...createInputProps('sku')}
                  value={formData.sku}
                  onChangeText={(text) => setFormData({ ...formData, sku: text })}
                  placeholder="SKU/Barcode"
                  placeholderTextColor="#555"
                  style={styles.input}
                />
              </View>
            </View>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.selectContainer}>
            {/* Navigation Header */}
            {viewState !== "categories" && (
              <TouchableOpacity
                style={styles.backButton}
                  onPress={() => {
                    if (viewState === "items") {
                      setViewState("categories");
                      setSelectedCategory(null);
                    } else if (viewState === "variants") {
                      setViewState("items");
                      setSelectedItem(null);
                      setSelectedVariants({});
                    } else if (viewState === "actions") {
                      // Check if item has variants
                      const matchingItems = categoryItems.filter((i) => i.name === selectedItem?.name);
                      const hasVariants = matchingItems.some((i) => i.guessed_size || i.color || i.pack_size);
                      if (hasVariants) {
                        setViewState("variants");
                      } else {
                        setViewState("items");
                        setSelectedItem(null);
                      }
                    }
                  }}
              >
                <ChevronLeft size={20} color="#fff" strokeWidth={1.5} />
                <Text style={styles.backButtonText}>
                  {viewState === "items" ? "Categories" : viewState === "variants" ? selectedItem?.name : "Back"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Categories View */}
            {viewState === "categories" && (
              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {categories.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No items in inventory</Text>
                  </View>
                ) : (
                  <>
                    {categories.map((category) => (
                      <TouchableOpacity
                        key={category}
                        style={styles.categoryItem}
                        onPress={() => handleCategorySelect(category)}
                      >
                        <Text style={styles.categoryName}>{category}</Text>
                        <Text style={styles.categoryCount}>
                          {itemsByCategory[category]?.length || 0} items
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </ScrollView>
            )}

            {/* Items View */}
            {viewState === "items" && (
              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {categoryItems.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No items in this category</Text>
                  </View>
                ) : (
                  categoryItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.itemRow}
                      onPress={() => handleItemSelect(item)}
                    >
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        {item.brand && (
                          <Text style={styles.itemBrand}>{item.brand}</Text>
                        )}
                        {item.short_display_name && (
                          <Text style={styles.itemDisplayName}>{item.short_display_name}</Text>
                        )}
                      </View>
                      {item.image_url && (
                        <Image source={{ uri: item.image_url }} style={styles.itemImage} />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}

            {/* Variants View */}
            {viewState === "variants" && selectedItem && (
              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.variantHeader}>
                  <Text style={styles.variantTitle}>{selectedItem.name}</Text>
                  {selectedItem.brand && (
                    <Text style={styles.variantSubtitle}>{selectedItem.brand}</Text>
                  )}
                </View>

                {itemVariants.sizes.length > 0 && (
                  <View style={styles.variantSection}>
                    <Text style={styles.variantLabel}>Size *</Text>
                    <View style={styles.variantOptions}>
                      {itemVariants.sizes.map((size) => (
                        <TouchableOpacity
                          key={size}
                          style={[
                            styles.variantOption,
                            selectedVariants.size === size && styles.variantOptionSelected,
                          ]}
                          onPress={() => setSelectedVariants((prev) => ({ ...prev, size }))}
                        >
                          <Text
                            style={[
                              styles.variantOptionText,
                              selectedVariants.size === size && styles.variantOptionTextSelected,
                            ]}
                          >
                            {size}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {itemVariants.colors.length > 0 && (
                  <View style={styles.variantSection}>
                    <Text style={styles.variantLabel}>Color *</Text>
                    <View style={styles.variantOptions}>
                      {itemVariants.colors.map((color) => (
                        <TouchableOpacity
                          key={color}
                          style={[
                            styles.variantOption,
                            selectedVariants.color === color && styles.variantOptionSelected,
                          ]}
                          onPress={() => setSelectedVariants((prev) => ({ ...prev, color }))}
                        >
                          <Text
                            style={[
                              styles.variantOptionText,
                              selectedVariants.color === color && styles.variantOptionTextSelected,
                            ]}
                          >
                            {color}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {itemVariants.packSizes.length > 0 && (
                  <View style={styles.variantSection}>
                    <Text style={styles.variantLabel}>Pack Size *</Text>
                    <View style={styles.variantOptions}>
                      {itemVariants.packSizes.map((packSize) => (
                        <TouchableOpacity
                          key={packSize}
                          style={[
                            styles.variantOption,
                            selectedVariants.pack_size === packSize && styles.variantOptionSelected,
                          ]}
                          onPress={() => setSelectedVariants((prev) => ({ ...prev, pack_size: packSize }))}
                        >
                          <Text
                            style={[
                              styles.variantOptionText,
                              selectedVariants.pack_size === packSize && styles.variantOptionTextSelected,
                            ]}
                          >
                            {packSize}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.continueButton,
                    !canContinueFromVariants && styles.continueButtonDisabled,
                  ]}
                  onPress={handleVariantContinue}
                  disabled={!canContinueFromVariants}
                >
                  <Text style={styles.continueButtonText}>Continue</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Actions View */}
            {viewState === "actions" && (() => {
              const finalItem = getFinalItem();
              if (!finalItem) return null;
              
              return (
                <View style={styles.actionsContainer}>
                  {/* Header with item name and brand */}
                  <View style={styles.actionItemInfo}>
                    {finalItem.image_url && (
                      <Image
                        source={{ uri: finalItem.image_url }}
                        style={styles.actionItemImage}
                      />
                    )}
                    <View style={styles.actionItemDetails}>
                      <Text style={styles.actionItemName}>{finalItem.name}</Text>
                      {finalItem.brand && (
                        <Text style={styles.actionItemBrand}>{finalItem.brand}</Text>
                      )}
                    </View>
                  </View>

                  {/* Variants List */}
                  <ScrollView style={styles.variantsList} showsVerticalScrollIndicator={false}>
                    {getAllVariants.length === 0 ? (
                      <View style={styles.emptyVariants}>
                        <Text style={styles.emptyVariantsText}>No variants found</Text>
                      </View>
                    ) : (
                      getAllVariants.map((variant) => {
                        const variantLabel = [
                          variant.guessed_size,
                          variant.color,
                          variant.pack_size,
                        ]
                          .filter(Boolean)
                          .join(' • ') || 'Base';
                        
                        return (
                          <View key={variant.id} style={styles.variantRow}>
                            <View style={styles.variantInfo}>
                              <Text style={styles.variantLabel}>{variantLabel}</Text>
                              <Text style={styles.variantPrice}>
                                ${(variant.price || 0).toFixed(2)}
                        </Text>
                    </View>
                            <View style={styles.variantQuantityControls}>
                              <Pressable
                                onPress={() => handleQuantityChange(variant.id, (variant.quantity || 0) - 1)}
                                style={({ pressed }) => [
                                  styles.quantityButton,
                                  pressed && styles.quantityButtonPressed,
                                ]}
                              >
                                <Minus size={16} color="#fff" />
                              </Pressable>
                              <Text style={styles.variantQuantity}>
                                {variant.quantity || 0}
                              </Text>
                              <Pressable
                                onPress={() => handleQuantityChange(variant.id, (variant.quantity || 0) + 1)}
                                style={({ pressed }) => [
                                  styles.quantityButton,
                                  pressed && styles.quantityButtonPressed,
                                ]}
                              >
                                <Plus size={16} color="#fff" />
                              </Pressable>
                  </View>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>

                  <View style={styles.actionButtons}>
                    {mode !== "sale" && (
                      <>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.editButton]}
                          onPress={handleEdit}
                        >
                          <Edit size={20} color="#fff" />
                          <Text style={styles.actionButtonText}>Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionButton, styles.addVariantButton]}
                          onPress={handleAddVariant}
                        >
                          <Layers size={20} color="#fff" />
                          <Text style={styles.actionButtonText}>Add Variant</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {mode === "sale" && onAddToPO ? (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.addToPOButton]}
                        onPress={() => {
                          const finalItem = getFinalItem();
                          if (finalItem) {
                            onAddToPO(finalItem);
                            if (onClose) onClose();
                          }
                        }}
                      >
                        <Package size={20} color="#fff" />
                        <Text style={styles.actionButtonText}>Add to Ticket</Text>
                      </TouchableOpacity>
                    ) : selectedPO && mode === "inventory" && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.addToPOButton]}
                        onPress={handleAddToPO}
                      >
                        <Package size={20} color="#fff" />
                        <Text style={styles.actionButtonText}>Add to PO</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })()}
          </View>
        )}
      </View>

      {/* Save and Cancel Buttons - Only show when adding/editing */}
      {showAddForm && (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            onPress={() => {
              // Reset all form and navigation state
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
              setShowAddForm(false);
              setBreadcrumbPath([]);
              setViewState("categories");
              setSelectedCategory(null);
              setSelectedItem(null);
              setSelectedVariants({});
              if (onClose) onClose();
            }}
            style={styles.cancelButton}
          >
            <X size={20} color="#fff" />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!formData.name || !formData.price || !formData.cost}
            style={[
              styles.saveButton,
              (!formData.name || !formData.price || !formData.cost) && styles.saveButtonDisabled,
            ]}
          >
            <Save size={20} color={formData.name && formData.price && formData.cost ? "#000" : "#666"} />
            <Text
              style={[
                styles.saveButtonText,
                (!formData.name || !formData.price || !formData.cost) && styles.saveButtonTextDisabled,
              ]}
            >
              Save Product
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  breadcrumbContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  breadcrumbItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  breadcrumbButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  breadcrumbText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "RobotoCondensed_400Regular",
  },
  breadcrumbTextActive: {
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  addNewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(103, 227, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(103, 227, 255, 0.4)",
  },
  addNewButtonText: {
    color: "#67E3FF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  tabContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  activeTab: {
    backgroundColor: "#67E3FF",
    borderColor: "#67E3FF",
  },
  tabText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  activeTabText: {
    color: "#000",
    fontFamily: "RobotoCondensed_400Regular",
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 400, // Extra padding for keyboard to ensure scrolling works
  },
  imageContainer: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  capturedImage: {
    width: "100%",
    height: 200,
    resizeMode: "cover",
  },
  formContainer: {
    gap: 12,
  },
  field: {
    marginBottom: 4,
  },
  halfField: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  label: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#000",
    fontSize: 16,
    fontFamily: "RobotoCondensed_400Regular",
    minHeight: 44,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  selectContainer: {
    flex: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingVertical: 8,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  categoryItem: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  categoryName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 4,
  },
  categoryCount: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
    fontFamily: "RobotoCondensed_400Regular",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 4,
  },
  itemBrand: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontFamily: "RobotoCondensed_400Regular",
  },
  itemDisplayName: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    fontFamily: "RobotoCondensed_400Regular",
    marginTop: 2,
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginLeft: 12,
  },
  variantHeader: {
    marginBottom: 24,
  },
  variantTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 4,
  },
  variantSubtitle: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontFamily: "RobotoCondensed_400Regular",
  },
  variantSection: {
    marginBottom: 24,
  },
  variantLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 12,
  },
  variantOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  variantOption: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  variantOptionSelected: {
    backgroundColor: "#67E3FF",
    borderColor: "#67E3FF",
  },
  variantOptionText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "RobotoCondensed_400Regular",
  },
  variantOptionTextSelected: {
    color: "#000",
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  continueButton: {
    backgroundColor: "#67E3FF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  continueButtonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    opacity: 0.5,
  },
  continueButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
  },
  actionsContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  actionItemInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  actionItemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
  },
  actionItemDetails: {
    flex: 1,
  },
  actionItemName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 4,
  },
  actionItemBrand: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 4,
  },
  actionItemCost: {
    color: "#67E3FF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  variantsList: {
    flex: 1,
    marginBottom: 16,
  },
  emptyVariants: {
    padding: 20,
    alignItems: "center",
  },
  emptyVariantsText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 14,
    fontFamily: "RobotoCondensed_400Regular",
  },
  variantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  variantInfo: {
    flex: 1,
  },
  variantPrice: {
    color: "#67E3FF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  costPriceContainer: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  costPriceContainerWarning: {
    backgroundColor: "rgba(255, 0, 0, 0.2)",
  },
  costWarningContainer: {
    marginTop: 8,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  costWarningText: {
    color: "#ff4444",
    fontSize: 11,
    fontWeight: "500",
    fontFamily: "RobotoCondensed_400Regular",
    lineHeight: 14,
    textAlign: "center",
  },
  variantQuantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quantityButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 8,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  variantQuantity: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
    minWidth: 40,
    textAlign: "center",
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  editButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  addVariantButton: {
    backgroundColor: "rgba(169, 132, 255, 0.3)",
  },
  addToPOButton: {
    backgroundColor: "#67E3FF",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 16,
    fontFamily: "RobotoCondensed_400Regular",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    minHeight: 52, // Ensure consistent height
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#67E3FF",
    minHeight: 52, // Ensure consistent height
  },
  saveButtonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    flex: 1, // Ensure flex is maintained when disabled
  },
  saveButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
  },
  saveButtonTextDisabled: {
    color: "rgba(255, 255, 255, 0.3)",
    fontFamily: "RobotoCondensed_400Regular",
  },
});
