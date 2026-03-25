import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable, Alert, Dimensions, Modal, Keyboard, Image, useWindowDimensions, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ScreenOrientation from "expo-screen-orientation";
// Audio import commented out - sound removed, can be re-enabled if needed
// import { Audio } from "expo-av";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, FadeIn, FadeOut, withRepeat, Easing } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView } from "@/components/camera/CameraView";
import { TicketPanel } from "@/components/ticket/TicketPanel";
import { TopBar } from "@/components/ui/TopBar";
import { Scan, Delete, RotateCw } from "lucide-react-native";
import { usePurchaseOrders } from "@/lib/hooks/usePurchaseOrders";
import { useTicketItems } from "@/lib/hooks/useTicketItems";
import { TicketLineItem, PurchaseOrder } from "@/lib/types";
import { CameraView as ExpoCameraView } from "expo-camera";
import { receiveItem, detectItems, DetectedItem } from "@/lib/api";
import { useInventoryItems } from "@/lib/hooks/useInventoryItems";
import { uploadImageToStorage } from "@/lib/storage";
import { generateImageEmbedding } from "@/lib/embeddings";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { AdminModal } from "@/components/admin/AdminModal";
import { Settings } from "lucide-react-native";
import { retryWithBackoff, withTimeout, formatErrorMessage, isRetryableError } from "@/lib/utils";
import { findSimilarItems } from "@/lib/variant-suggestions";
import { findDuplicateItem } from "@/lib/duplicate-detection";
import { FlyingIconAnimation } from "@/components/ui/FlyingIconAnimation";
import * as ImageManipulator from 'expo-image-manipulator';
import { PaymentMethodModal } from "@/components/payment/PaymentMethodModal";
import { CashPaymentModal } from "@/components/payment/CashPaymentModal";
import { CardPaymentModal } from "@/components/payment/CardPaymentModal";

export default function HomeScreen() {
  const windowDimensions = useWindowDimensions();
  // Detect if device is a phone (not iPad/tablet)
  const isPhone = Platform.OS === 'ios' ? !Platform.isPad : (windowDimensions.width < 600 || windowDimensions.height < 600);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [mode, setMode] = useState<"inventory" | "sale">("sale");
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const cameraRef = useRef<ExpoCameraView>(null);
  const [aiProductData, setAiProductData] = useState<any>(null);
  const aiProductDataRef = useRef<any>(null); // Store AI data for background processing
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<Map<string, any>>(new Map());
  const [editingPendingItemId, setEditingPendingItemId] = useState<string | null>(null);
  const [flyingIcon, setFlyingIcon] = useState<{
    itemId: string;
  } | null>(null);
  const [showQuickCostPriceModal, setShowQuickCostPriceModal] = useState(false);
  const [quickCost, setQuickCost] = useState("");
  const [quickPrice, setQuickPrice] = useState("");
  const [quickPendingItemId, setQuickPendingItemId] = useState<string | null>(null);
  const [activeInput, setActiveInput] = useState<"cost" | "price">("cost");
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Sound code commented out - can be re-enabled if needed
  // const [singleScanSound, setSingleScanSound] = useState<Audio.Sound | null>(null);
  // const [multiScanSound, setMultiScanSound] = useState<Audio.Sound | null>(null);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showNoItemsToast, setShowNoItemsToast] = useState(false);
  const [showDemoModeToast, setShowDemoModeToast] = useState(false);
  const [showPortraitToast, setShowPortraitToast] = useState(false);
  const [clockFormat, setClockFormat] = useState<"12h" | "24h">("24h");
  const [taxRate, setTaxRate] = useState<number>(0.07); // Default 7%
  
  // Payment modals state
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showCashPaymentModal, setShowCashPaymentModal] = useState(false);
  const [showCardPaymentModal, setShowCardPaymentModal] = useState(false);
  const videoRef = useRef<Video | null>(null);
  const rotateAnimation = useSharedValue(0);
  const videoOpacity = useSharedValue(1);
  const logoColorProgress = useSharedValue(0);
  
  // Supabase hooks for data persistence - only initialize when logged in
  const {
    purchaseOrders = [],
    loading: poLoading,
    error: poError,
    addPurchaseOrder,
    updatePurchaseOrder,
    refetch: refetchPurchaseOrders,
  } = usePurchaseOrders();
  
  const {
    ticketItems = [],
    loading: itemsLoading,
    error: itemsError,
    updateTicketItem,
    deleteTicketItem,
    clearTicketItems,
    addTicketItem,
  } = useTicketItems();

  const {
    inventoryItems = [],
    addInventoryItem,
    deleteInventoryItem,
    updateInventoryItem,
    finalizePurchaseOrder,
    refetch: refetchInventoryItems,
  } = useInventoryItems(selectedPO?.id);
  
  // Separate hook for InventoryPanel - always get ALL inventory items (not filtered by PO)
  const {
    inventoryItems: allInventoryItems = [],
    refetch: refetchAllInventoryItems,
  } = useInventoryItems(undefined); // undefined = get all items

  const handleLogin = () => {
    // Show demo mode toast instead of logging in
    Keyboard.dismiss();
    showDemoToast();
  };

  const showDemoToast = () => {
    Keyboard.dismiss(); // Dismiss keyboard if it's open
    setShowDemoModeToast(true);
    setTimeout(() => {
      setShowDemoModeToast(false);
    }, 3000);
  };

  const handleUsernameFocus = () => {
    Keyboard.dismiss();
    showDemoToast();
  };

  const handlePasswordFocus = () => {
    Keyboard.dismiss();
    showDemoToast();
  };

  const handleDemoMode = () => {
    setIsLoggedIn(true);
    setMode("sale");
  };

  const handleSignOut = async () => {
    setIsLoggedIn(false);
    setMode("sale");
    // Clear ticket items from Supabase
    await clearTicketItems();
    setUsername("");
    setPassword("");
  };

  // Calculate subtotal, tax, and total from ticket items (sale mode only)
  const calculateSubtotal = () => {
    if (mode !== "sale") return 0;
    return ticketItems.reduce((sum, item) => {
      const price = item.price || 0;
      const quantity = item.quantity || 1;
      return sum + price * quantity;
    }, 0);
  };

  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    return subtotal * taxRate;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  // Check if payment is enabled (sale mode with verified items)
  const paymentEnabled = (() => {
    if (mode !== "sale") return false;
    if (ticketItems.length === 0) return false;
    
    // If all items are verified, allow checkout (covers manually added items which are pre-verified)
    const allVerified = ticketItems.every((item) => item.verified);
    if (allVerified) return true;
    
    // Otherwise, check if all required items (yellow/red confidence) are verified
    const requiredItems = ticketItems.filter((item) => {
      const confidence = item.confidence ?? null;
      if (confidence === null || confidence === undefined) return true; // Missing confidence requires verification
      if (confidence >= 0.8) return false; // Green doesn't require verification
      return true; // Yellow and red require verification
    });
    
    return requiredItems.length === 0 || requiredItems.every((item) => item.verified);
  })();

  const handlePay = () => {
    console.log("handlePay called", { paymentEnabled, ticketItemsCount: ticketItems.length, total: calculateTotal() });
    // Payment button is already disabled if not enabled, so we can directly open modal
    const total = calculateTotal();
    if (total > 0) {
      setShowPaymentMethodModal(true);
    } else {
      Alert.alert("Error", "Cannot checkout with $0.00 total");
    }
  };

  const handleSelectCash = () => {
    setShowPaymentMethodModal(false);
    setShowCashPaymentModal(true);
  };

  const handleSelectCard = () => {
    setShowPaymentMethodModal(false);
    setShowCardPaymentModal(true);
  };

  const handlePaymentComplete = async () => {
    // Clear ticket items after successful payment
    await clearTicketItems();
  };

  const handleReceiptRequest = () => {
    // TODO: Implement receipt printing later
    console.log("Receipt requested (printing not implemented yet)");
  };

  const handleScan = async () => {
    // Only allow scanning in inventory mode when a PO is selected
    if (mode !== "inventory" || !selectedPO) {
      Alert.alert("No Purchase Order", "Please select a purchase order first");
      return;
    }

    // Don't allow scanning if PO is finalized
    if (selectedPO.status === "closed") {
      Alert.alert("PO Finalized", "This purchase order has been finalized and cannot be modified.");
      return;
    }

    if (!cameraRef.current) {
      Alert.alert("Camera Error", "Camera not available");
      return;
    }

    try {
      // Show loading immediately
      setIsProcessingImage(true);

      // Capture photo with base64 encoding - optimize quality for speed
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5, // Further reduced for faster processing and smaller payload
        skipProcessing: false, // Let camera do basic processing
        exif: false, // Don't include EXIF data to reduce size
      });

      if (!photo?.base64) {
        setIsProcessingImage(false);
        Alert.alert("Error", "Failed to capture image");
        return;
      }

      console.log("Image captured, sending to AI...");

      // Store image URI for later upload
      setCapturedImageUri(photo.uri);

      // Optimize: Reduce base64 size if too large
      let imageBase64 = photo.base64;
      // Remove data URL prefix if present to reduce size
      imageBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

      // Get existing categories from inventory items to provide context to AI
      const existingCategories = Array.from(
        new Set(
          inventoryItems
            .map(item => item.category)
            .filter((cat): cat is string => !!cat)
        )
      ).sort();

      // Call API to get AI-extracted product data with retry and timeout
      const result = await retryWithBackoff(
        () => withTimeout(
          receiveItem(imageBase64, selectedPO.id, existingCategories),
          30000, // 30 second timeout
          'AI processing timed out. Please try again.'
        ),
        2, // 2 retries
        1000 // 1 second initial delay
      );

      if (!result.success || !result.data) {
        setIsProcessingImage(false);
        const errorMsg = formatErrorMessage(new Error(result.error || "Failed to process image"));
        Alert.alert("Scan Error", errorMsg);
        return;
      }

      const aiData = result.data;
      
      // Check if this item already exists in the current PO
      // Use improved duplicate detection (normalized names, fuzzy matching, embeddings)
      const duplicateMatch = findDuplicateItem(
        {
          name: aiData.name,
          embedding: null, // Embedding not available yet at scan time
        },
        inventoryItems,
        selectedPO.id,
        {
          nameSimilarityThreshold: 0.7, // 70% name similarity
          requireEmbeddingMatch: false, // Don't require embedding since we don't have it yet
        }
      );

      if (duplicateMatch) {
        const existingItem = inventoryItems.find(item => item.id === duplicateMatch.id);
        // Duplicate item - automatically increment quantity
        if (!existingItem) {
          console.warn("Duplicate match found but existing item not found in inventory");
          setIsProcessingImage(false);
          return;
        }
        console.log("Duplicate item detected, incrementing quantity");
        try {
          const newQuantity = (existingItem.quantity || 1) + 1;
          await updateInventoryItem(existingItem.id, { 
            quantity: newQuantity,
            verified: false, // Unverify since AI touched it again
          });
          
          setIsProcessingImage(false);
          
          // Trigger flying icon animation
          if (existingItem.id) {
            console.log("=== TRIGGERING FLYING ICON ===", { itemId: existingItem.id });
            setFlyingIcon({
              itemId: existingItem.id,
            });
            // Clear after animation completes - let the animation component handle cleanup
            setTimeout(() => {
              setCapturedImageUri(null);
              setAiProductData(null);
            }, 100);
          } else {
            setCapturedImageUri(null);
            setAiProductData(null);
          }
          
          console.log("Quantity incremented successfully");
        } catch (error) {
          setIsProcessingImage(false);
          console.error("Failed to increment quantity:", error);
          const errorMsg = formatErrorMessage(error);
          Alert.alert("Error", `Failed to update quantity: ${errorMsg}`);
          setCapturedImageUri(null);
          setAiProductData(null);
        }
      } else {
        // New item - store AI data and open side panel for user to fill in price/cost
        setAiProductData(aiData);
        aiProductDataRef.current = aiData; // Store for background processing
        setIsProcessingImage(false);
        setIsPanelVisible(true); // This will trigger the panel to open
      }
    } catch (error) {
      setIsProcessingImage(false);
      console.error("Scan error:", error);
      const errorMsg = formatErrorMessage(error);
      const canRetry = isRetryableError(error);
      
      Alert.alert(
        "Scan Failed",
        errorMsg,
        canRetry ? [
          { text: "Cancel", style: "cancel" },
          { text: "Retry", onPress: handleScan }
        ] : undefined
      );
    }
  };

  // Sound initialization commented out - can be re-enabled if needed
  // useEffect(() => {
  //   const loadSounds = async () => {
  //     try {
  //       await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  //       // Sounds are optional - if files don't exist, we'll just skip them
  //       // In production, you can add sound files to assets/sounds/
  //     } catch (error) {
  //       console.warn('Could not initialize audio:', error);
  //     }
  //   };
  //   loadSounds();

  //   return () => {
  //     singleScanSound?.unloadAsync().catch(() => {});
  //     multiScanSound?.unloadAsync().catch(() => {});
  //   };
  // }, []);

  // Play video when login screen is shown
  useEffect(() => {
    if (!isLoggedIn && videoRef.current) {
      videoRef.current.playAsync().catch((error) => {
        console.warn('Could not play video:', error);
      });
    }
  }, [isLoggedIn]);

  // Animate logo color from blue to purple and back
  useEffect(() => {
    if (!isLoggedIn) {
      logoColorProgress.value = withRepeat(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        -1, // infinite
        true // reverse
      );
    }
  }, [isLoggedIn]);

  // Animated style for logo opacity (purple layer fades in/out)
  const logoAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: logoColorProgress.value,
    };
  });

  // Handle seamless video looping with crossfade
  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    
    const duration = status.durationMillis || 0;
    const position = status.positionMillis || 0;
    
    // Start fade out 200ms before the end for crossfade effect
    const fadeOutStart = duration - 200;
    
    if (position >= fadeOutStart && position < duration - 50) {
      // Fade out as we approach the end
      const fadeProgress = (position - fadeOutStart) / 200;
      videoOpacity.value = withTiming(0, { duration: 150 });
    } else if (status.didJustFinish) {
      // When video finishes, reset position while faded out, then fade back in
      videoRef.current?.setPositionAsync(0).then(() => {
        videoOpacity.value = withTiming(1, { duration: 200 });
        videoRef.current?.playAsync().catch(() => {});
      }).catch(() => {});
    } else if (position < 200 && videoOpacity.value < 1) {
      // Fade in at the beginning
      videoOpacity.value = withTiming(1, { duration: 200 });
    }
  };

  const videoOpacityStyle = useAnimatedStyle(() => {
    return {
      opacity: videoOpacity.value,
    };
  });

  // Detect portrait orientation on iPad and show toast (works in both login and app)
  useEffect(() => {
    if (Platform.OS !== 'ios' || !Platform.isPad) return; // Only for iPad
    
    const checkOrientation = async () => {
      try {
        const orientation = await ScreenOrientation.getOrientationAsync();
        const isPortrait = 
          orientation === ScreenOrientation.Orientation.PORTRAIT_UP ||
          orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN;
        
        if (isPortrait) {
          setShowPortraitToast(true);
          // Auto-hide after 2 seconds
          setTimeout(() => {
            setShowPortraitToast(false);
          }, 2000);
        } else {
          setShowPortraitToast(false);
        }
      } catch (error) {
        // Silently fail if orientation check not available
      }
    };

    // Check on mount
    checkOrientation();

    // Listen for orientation changes
    const subscription = ScreenOrientation.addOrientationChangeListener(() => {
      checkOrientation();
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Load clock format preference
  useEffect(() => {
    const loadClockFormat = async () => {
      try {
        const savedFormat = await AsyncStorage.getItem('clockFormat');
        if (savedFormat === '12h' || savedFormat === '24h') {
          setClockFormat(savedFormat);
        }
        
        const savedTaxRate = await AsyncStorage.getItem('taxRate');
        if (savedTaxRate !== null) {
          const rate = parseFloat(savedTaxRate);
          if (!isNaN(rate) && rate >= 0) {
            setTaxRate(rate);
          }
        }
      } catch (error) {
        console.warn('Failed to load settings:', error);
      }
    };
    loadClockFormat();
  }, []);

  // Save clock format preference
  const handleClockFormatChange = async (format: "12h" | "24h") => {
    try {
      setClockFormat(format);
      await AsyncStorage.setItem('clockFormat', format);
    } catch (error) {
      console.warn('Failed to save clock format:', error);
    }
  };

  // Save tax rate preference
  const handleTaxRateChange = async (rate: number) => {
    try {
      setTaxRate(rate);
      await AsyncStorage.setItem('taxRate', rate.toString());
    } catch (error) {
      console.warn('Failed to save tax rate:', error);
    }
  };

  // Rotate icon animation
  useEffect(() => {
    if (showPortraitToast) {
      rotateAnimation.value = withRepeat(
        withTiming(360, {
          duration: 2000,
          easing: Easing.linear,
        }),
        -1, // Infinite repeat
        false
      );
    } else {
      rotateAnimation.value = 0;
    }
  }, [showPortraitToast]);

  const rotateIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotateAnimation.value}deg` }],
    };
  });

  const handleMultiScan = async () => {
    // Check mode and PO requirements
    if (mode === "inventory") {
      if (!selectedPO) {
        Alert.alert("No Purchase Order", "Please select a purchase order first");
        return;
      }
      if (selectedPO.status === "closed") {
        Alert.alert("PO Finalized", "This purchase order has been finalized and cannot be modified.");
        return;
      }
    }

    if (!cameraRef.current) {
      Alert.alert("Camera Error", "Camera not available");
      return;
    }

    try {
      // Clear previous detected items when starting new scan
      setDetectedItems([]);
      setIsProcessingImage(true);
      
      // Sound removed - can be re-enabled if needed
      // try {
      //   if (multiScanSound) {
      //     await multiScanSound.replayAsync();
      //   } else {
      //     // Use haptic feedback as fallback - different pattern for multi-scan
      //     const { impactAsync } = await import('expo-haptics');
      //     await impactAsync(require('expo-haptics').ImpactFeedbackStyle.Medium);
      //     // Double tap for multi-scan
      //     setTimeout(async () => {
      //       await impactAsync(require('expo-haptics').ImpactFeedbackStyle.Medium);
      //     }, 100);
      //   }
      // } catch (error) {
      //   // Ignore sound errors
      // }

      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        skipProcessing: false,
        exif: false,
      });

      if (!photo?.base64) {
        setIsProcessingImage(false);
        Alert.alert("Error", "Failed to capture image");
        return;
      }

      console.log("Multi-scan: Image captured, detecting items...");
      setCapturedImageUri(photo.uri);

      let imageBase64 = photo.base64;
      imageBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

      // Get existing categories (from inventory items for context)
      const existingCategories = Array.from(
        new Set(
          inventoryItems
            .map(item => item.category)
            .filter((cat): cat is string => !!cat)
        )
      ).sort();

      // Detect multiple items
      const poId = mode === "inventory" && selectedPO ? selectedPO.id : "";
      console.log('Starting item detection...', { poId, apiUrl: process.env.EXPO_PUBLIC_API_URL });
      
      const detectionResult = await retryWithBackoff(
        () => withTimeout(
          detectItems(imageBase64, poId, existingCategories),
          30000,
          'Item detection timed out. Please try again.'
        ),
        2,
        1000
      );

      console.log('Detection result:', { 
        success: detectionResult.success, 
        itemsCount: detectionResult.items?.length || 0,
        error: detectionResult.error 
      });

      if (!detectionResult.success || !detectionResult.items || detectionResult.items.length === 0) {
        setIsProcessingImage(false);
        const errorMsg = formatErrorMessage(new Error(detectionResult.error || "Failed to detect items"));
        console.error('Item detection failed:', errorMsg);
        Alert.alert("Multi-Scan Error", errorMsg);
        return;
      }

      const items = detectionResult.items;
      console.log(`Multi-scan: Detected ${items.length} item(s)`, items);
      setDetectedItems(items);

      // Process each detected item
      let processedCount = 0;
      let duplicateCount = 0;
      let newItemCount = 0;
      let skippedCount = 0; // Track items that couldn't be processed
      const failedCrops: DetectedItem[] = []; // Track crops that failed for fallback processing
      
      // Track items processed in this scan batch to avoid duplicate AI calls
      // Key: normalized item name, Value: { aiData, count, confidence, detectedItems }
      const batchProcessedItems = new Map<string, { aiData: any; count: number; confidence: number; detectedItems: DetectedItem[] }>();
      
      // Get image dimensions for cropping
      // We need to get the actual image dimensions to convert percentage coordinates to pixels
      const imageInfo = await ImageManipulator.manipulateAsync(
        photo.uri,
        [],
        { format: ImageManipulator.SaveFormat.JPEG }
      );
      
      const imageWidth = imageInfo.width;
      const imageHeight = imageInfo.height;
      console.log(`Image dimensions: ${imageWidth}x${imageHeight}`);
      
      // Process each detected bounding box separately
      console.log(`Processing ${items.length} detected region(s) separately...`);
      
      for (let i = 0; i < items.length; i++) {
        const detectedItem = items[i];
        try {
          // Convert percentage coordinates (0-100) to pixel coordinates
          const cropX = Math.round((detectedItem.x / 100) * imageWidth);
          const cropY = Math.round((detectedItem.y / 100) * imageHeight);
          const cropWidth = Math.round((detectedItem.width / 100) * imageWidth);
          const cropHeight = Math.round((detectedItem.height / 100) * imageHeight);
          
          // Ensure crop region is within image bounds
          const finalX = Math.max(0, Math.min(cropX, imageWidth - 1));
          const finalY = Math.max(0, Math.min(cropY, imageHeight - 1));
          const finalWidth = Math.max(1, Math.min(cropWidth, imageWidth - finalX));
          const finalHeight = Math.max(1, Math.min(cropHeight, imageHeight - finalY));
          
          console.log(`Cropping region ${i + 1}/${items.length}: x=${finalX}, y=${finalY}, w=${finalWidth}, h=${finalHeight}`);
          
          // Crop the image region
          const croppedImage = await ImageManipulator.manipulateAsync(
            photo.uri,
            [
              {
                crop: {
                  originX: finalX,
                  originY: finalY,
                  width: finalWidth,
                  height: finalHeight,
                },
              },
            ],
            {
              compress: 0.8,
              format: ImageManipulator.SaveFormat.JPEG,
              base64: true,
            }
          );
          
          if (!croppedImage.base64) {
            console.warn(`Failed to crop region ${i + 1}, skipping...`);
            continue;
          }
          
          // Remove data URL prefix if present
          let croppedBase64 = croppedImage.base64.replace(/^data:image\/\w+;base64,/, '');
          
          // Generate embedding for the cropped region (for duplicate detection)
          let regionEmbedding: number[] | null = null;
          try {
            regionEmbedding = await generateImageEmbedding(`data:image/jpeg;base64,${croppedBase64}`);
          } catch (embedErr) {
            console.warn(`Embedding generation failed for region ${i + 1}, continuing without embedding`);
          }

          // Embedding-first duplicate check (inventory mode)
          if (mode === "inventory" && regionEmbedding && regionEmbedding.length > 0) {
            const similar = findSimilarItems(
              regionEmbedding,
              inventoryItems
                .filter((item: any) => item.embedding && item.id)
                .map((item: any) => ({
                  id: item.id,
                  name: item.name,
                  embedding: item.embedding,
                })),
              0.85 // similarity threshold
            );

            if (similar.length > 0) {
              const match = similar[0];
              console.log(`Embedding match found (similarity ${match.similarity.toFixed(3)}), incrementing quantity for ${match.id}`);
              try {
                const updatedItem = await updateInventoryItem(match.id, {
                  quantity: (inventoryItems.find((itm: any) => itm.id === match.id)?.quantity || 0) + 1,
                  verified: false,
                });
                // If item was deleted (updateInventoryItem returns null), fall through to AI path
                if (!updatedItem) {
                  console.warn(`Item ${match.id} was deleted during processing, falling back to AI path`);
                } else {
                  duplicateCount += 1;
                  processedCount += 1;
                  setFlyingIcon({ itemId: match.id });
                  // Skip GPT for this region
                  continue;
                }
              } catch (dupErr) {
                console.warn(`Failed to increment quantity for ${match.id}, falling back to AI path`, dupErr);
              }
            }
          }

          // Process the cropped region through AI (only if no embedding match)
          console.log(`Processing cropped region ${i + 1}/${items.length} through AI...`);
          const itemResult = await retryWithBackoff(
            () => withTimeout(
              receiveItem(croppedBase64, poId, existingCategories),
              30000,
              'AI processing timed out.'
            ),
            1,
            500
          );

          // Check if this was intentionally skipped (OpenAI couldn't extract info)
          if (!itemResult.success && itemResult.data?.skipped) {
            console.log(`Skipped region ${i + 1}: OpenAI unable to extract product information from crop (likely invalid crop or unrecognized item)`);
            // Store failed crop for fallback processing with full image
            failedCrops.push(detectedItem);
            skippedCount++;
            continue;
          }
          
          if (!itemResult.success || !itemResult.data) {
            console.warn(`Failed to process region ${i + 1}:`, itemResult.error);
            continue;
          }

          const aiData = { ...itemResult.data, embedding: regionEmbedding };
          
          // Normalize the item name for duplicate detection within batch
          const normalizedName = aiData.name?.toLowerCase().trim() || 'unnamed-item';
          
          // Check if we've seen this item in the current batch
          if (batchProcessedItems.has(normalizedName)) {
            // Same item detected multiple times - increment count
            const existing = batchProcessedItems.get(normalizedName)!;
            existing.count += 1;
            // Use highest confidence
            if (detectedItem.confidence > existing.confidence) {
              existing.confidence = detectedItem.confidence;
            }
            existing.detectedItems.push(detectedItem);
          } else {
            // First time seeing this item in this batch
            batchProcessedItems.set(normalizedName, {
              aiData,
              count: 1,
              confidence: detectedItem.confidence,
              detectedItems: [detectedItem],
            });
          }
        } catch (error) {
          console.error(`Error processing region ${i + 1}:`, error);
          // Continue with next region
        }
      }

      // Now process each unique item from the batch
      for (const [itemName, batchItem] of batchProcessedItems.entries()) {
        try {
          const aiData = batchItem.aiData;
          const detectionCount = batchItem.count;
          const maxConfidence = batchItem.confidence;
          
          // Check for duplicates with confidence consideration
          // Use more flexible matching for sale mode (lower threshold)
          const baseThreshold = mode === "sale" ? 0.6 : 0.7; // More flexible for sale mode
          const confidenceAdjustedThreshold = baseThreshold - (1 - maxConfidence) * 0.2;
          const finalThreshold = Math.max(0.4, Math.min(0.9, confidenceAdjustedThreshold)); // Lower min for sale mode
          
          // For sale mode, check against ALL inventory items (not filtered by PO)
          const itemsToSearch = mode === "sale" 
            ? allInventoryItems.filter((item: any) => !item.purchase_order_id) // Only main inventory items
            : inventoryItems;
          
          const duplicateMatch = findDuplicateItem(
            {
              name: aiData.name,
              embedding: null,
            },
            itemsToSearch,
            mode === "inventory" && selectedPO ? selectedPO.id : null,
            {
              nameSimilarityThreshold: finalThreshold,
              requireEmbeddingMatch: false,
            }
          );

          // Debug logging for sale mode
          if (mode === "sale") {
            console.log(`[SALE MODE] Processing item: "${aiData.name}"`);
            console.log(`[SALE MODE] Searching in ${itemsToSearch.length} inventory items`);
            console.log(`[SALE MODE] Duplicate match:`, duplicateMatch ? `Found: ${duplicateMatch.name}` : "No match");
          }

          if (mode === "inventory" && duplicateMatch) {
            // In inventory mode, increment quantity for duplicates
            const existingItem = inventoryItems.find(item => item.id === duplicateMatch.id);
            if (existingItem) {
              try {
                const newQuantity = (existingItem.quantity || 1) + detectionCount; // Add count of detections
                const updatedItem = await updateInventoryItem(existingItem.id, {
                  quantity: newQuantity,
                  verified: false,
                });
                // If item was deleted (updateInventoryItem returns null), skip it
                if (!updatedItem) {
                  console.warn(`Item ${existingItem.id} was deleted during processing, skipping`);
                } else {
                  duplicateCount += detectionCount;
                  
                  // Trigger flying icon animation
                  if (existingItem.id) {
                    setFlyingIcon({ itemId: existingItem.id });
                  }
                }
              } catch (error) {
                console.warn(`Failed to update item ${existingItem.id} (may have been deleted):`, error);
              }
            }
          } else if (mode === "sale" && duplicateMatch) {
            // In sale mode, add directly to ticket if item exists in inventory
            const existingItem = allInventoryItems.find((item: any) => item.id === duplicateMatch.id);
            console.log(`[SALE MODE] Found duplicate match for "${aiData.name}":`, existingItem ? `Item ID ${existingItem.id}, price: ${existingItem.price}` : "Item not found in allInventoryItems");
            
            if (existingItem && existingItem.price) {
              // Check if item already exists on ticket
              const existingTicketItem = ticketItems.find((item: any) => item.name === existingItem.name);
              
              if (existingTicketItem) {
                // Increment quantity on existing ticket item
                console.log(`[SALE MODE] Incrementing existing ticket item "${existingItem.name}" by ${detectionCount}`);
                await updateTicketItem(existingTicketItem.id, {
                  quantity: (existingTicketItem.quantity || 1) + detectionCount,
                });
              } else {
                // Add new item to ticket
                console.log(`[SALE MODE] Adding new ticket item: "${existingItem.name}" (qty: ${detectionCount}, price: ${existingItem.price})`);
                // Note: additionalInfo (size, color, pack_size) will be looked up from inventory when displaying
                await addTicketItem({
                  name: existingItem.name,
                  price: existingItem.price,
                  quantity: detectionCount,
                  verified: false, // All scanned items start unverified, even green confidence
                  confidence: maxConfidence,
                });
              }
              
              duplicateCount += detectionCount;
              processedCount += detectionCount;
              
              // Trigger flying icon animation
              if (existingItem.id) {
                setFlyingIcon({ itemId: existingItem.id });
              }
            } else {
              // Item not in inventory or missing price - skip it (sale mode only works with inventory)
              console.log(`[SALE MODE] Skipping item "${aiData.name}" - ${!existingItem ? "not found in inventory" : "missing price"}`);
              skippedCount++;
            }
          } else {
            // No duplicate match found
            if (mode === "sale") {
              // In sale mode, items must exist in inventory - skip if not found
              console.log(`[SALE MODE] Item "${aiData.name}" not found in inventory (searched ${itemsToSearch.length} items) - skipping`);
              console.log(`[SALE MODE] Available inventory items:`, itemsToSearch.map((item: any) => item.name).slice(0, 10));
              skippedCount++;
            } else if (mode === "inventory") {
              // New item in inventory mode - add to pending items for user to review
              const pendingId = `pending-${Date.now()}-${processedCount}`;
              setPendingItems(prev => {
                const newMap = new Map(prev);
                newMap.set(pendingId, {
                  ...aiData,
                  id: pendingId,
                  confidence: maxConfidence,
                  detectedItem: batchItem.detectedItems[0], // Store first detection for reference
                  quantity: detectionCount > 1 ? detectionCount : 1, // Set quantity if multiple detections
                  mode, // Store mode for later processing
                  purchase_order_id: selectedPO ? selectedPO.id : undefined,
                  _needsReview: true, // Flag to show in review UI
                  _isPending: true,
                  _imageUri: capturedImageUri, // Store image URI for later use
                });
                return newMap;
              });
              newItemCount++;
            }
          }

          processedCount += detectionCount;
        } catch (error) {
          console.error(`Error processing item ${itemName}:`, error);
        }
      }

      // Fallback: If we have failed crops, try processing the full image once
      // This lets OpenAI identify items that Roboflow missed or had bad crops
      if (failedCrops.length > 0 && processedCount === 0) {
        // Only do fallback if NO items were successfully processed (all crops failed)
        // This means Roboflow might have misidentified everything, so let OpenAI try the full image
        console.log(`All ${failedCrops.length} crops failed, attempting fallback with full image...`);
        try {
          const fullImageResult = await retryWithBackoff(
            () => withTimeout(
              receiveItem(imageBase64, poId, existingCategories),
              30000,
              'Full image processing timed out.'
            ),
            1,
            500
          );

          if (fullImageResult.success && fullImageResult.data && !fullImageResult.data.skipped) {
            console.log("Fallback successful: OpenAI identified item from full image");
            const aiData = fullImageResult.data;
            
            // Generate embedding for duplicate check
            let fullImageEmbedding: number[] | null = null;
            try {
              fullImageEmbedding = await generateImageEmbedding(`data:image/jpeg;base64,${imageBase64}`);
            } catch (embedErr) {
              console.warn("Embedding generation failed for full image fallback");
            }

            // Check for duplicates
            if (mode === "inventory" && fullImageEmbedding && fullImageEmbedding.length > 0) {
              const similar = findSimilarItems(
                fullImageEmbedding,
                inventoryItems
                  .filter((item: any) => item.embedding && item.id)
                  .map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    embedding: item.embedding,
                  })),
                0.85
              );

              if (similar.length > 0) {
                const match = similar[0];
                let itemUpdated = false;
                try {
                  const updatedItem = await updateInventoryItem(match.id, {
                    quantity: (inventoryItems.find((itm: any) => itm.id === match.id)?.quantity || 0) + 1,
                    verified: false,
                  });
                  // If item was deleted (updateInventoryItem returns null), create new item instead
                  if (!updatedItem) {
                    console.warn(`Item ${match.id} was deleted during processing, creating new item instead`);
                  } else {
                    duplicateCount += 1;
                    processedCount += 1;
                    setFlyingIcon({ itemId: match.id });
                    skippedCount = 0; // Reset since we successfully processed via fallback
                    itemUpdated = true;
                  }
                } catch (error) {
                  console.warn(`Failed to update item ${match.id} (may have been deleted):`, error);
                  // Will create new item below
                }
                
                // If update failed or item was deleted, create new item instead
                if (!itemUpdated) {
                  // Item update failed or was deleted, create new item
                  const pendingId = `pending-${Date.now()}-fallback`;
                  setPendingItems(prev => {
                    const newMap = new Map(prev);
                    newMap.set(pendingId, {
                      ...aiData,
                      id: pendingId,
                      confidence: failedCrops[0]?.confidence || 0.5,
                      quantity: 1,
                      purchase_order_id: poId,
                      _needsReview: true,
                      _imageUri: photo.uri,
                    });
                    return newMap;
                  });
                  newItemCount++;
                }
              } else {
                // New item from fallback
                const pendingId = `pending-${Date.now()}-fallback`;
                setPendingItems(prev => {
                  const newMap = new Map(prev);
                  newMap.set(pendingId, {
                    ...aiData,
                    id: pendingId,
                    confidence: failedCrops[0]?.confidence || 0.5,
                    quantity: 1,
                    mode,
                    purchase_order_id: mode === "inventory" && selectedPO ? selectedPO.id : undefined,
                    _needsReview: true,
                    _isPending: true,
                    _imageUri: capturedImageUri,
                  });
                  return newMap;
                });
                newItemCount++;
                processedCount += 1;
                skippedCount = 0; // Reset since we successfully processed via fallback
              }
            } else {
              // No embedding match, add as new item
              const pendingId = `pending-${Date.now()}-fallback`;
              setPendingItems(prev => {
                const newMap = new Map(prev);
                newMap.set(pendingId, {
                  ...aiData,
                  id: pendingId,
                  confidence: failedCrops[0]?.confidence || 0.5,
                  quantity: 1,
                  mode,
                  purchase_order_id: mode === "inventory" && selectedPO ? selectedPO.id : undefined,
                  _needsReview: true,
                  _isPending: true,
                  _imageUri: capturedImageUri,
                });
                return newMap;
              });
              newItemCount++;
              processedCount += 1;
              skippedCount = 0; // Reset since we successfully processed via fallback
            }
          } else {
            console.log("Fallback also failed: OpenAI couldn't identify items from full image");
          }
        } catch (fallbackError) {
          console.error("Fallback processing error:", fallbackError);
        }
      }
      
      setIsProcessingImage(false);
      
      // Check if NO items were successfully processed (all parsing failed)
      if (processedCount === 0 && items.length > 0) {
        // All items failed to parse - show friendly toast
        setShowNoItemsToast(true);
      }
      
      // Note: We no longer show alerts for skipped items - they're handled silently
      // Summary is now shown in the UI (pending items list), no popup needed

      // Keep detected items visible longer for review
      // Don't clear immediately - let user see bounding boxes
      setTimeout(() => {
        // Only clear after 10 seconds to give user time to review
        setDetectedItems([]);
      }, 10000);

    } catch (error) {
      setIsProcessingImage(false);
      console.error("Multi-scan error:", error);
      
      // Show toast for AI parsing failures - assume items were detected but parsing failed
      // This handles cases where receiveItem throws errors for parsing failures
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("parse") || errorMsg.includes("AI response") || errorMsg.includes("missing required field")) {
        setShowNoItemsToast(true);
      }
      
      setDetectedItems([]);
    }
  };

  // Long press handlers commented out - multi-scan is now default, no long press needed
  // Can be re-enabled if needed
  // const handleLongPressStart = () => {
  //   setIsLongPressing(true);
  //   setLongPressProgress(0);
  //   
  //   // Start progress animation (fill over 500ms)
  //   const LONG_PRESS_DURATION = 500; // 500ms for faster response
  //   const PROGRESS_STEPS = 100;
  //   const stepInterval = LONG_PRESS_DURATION / PROGRESS_STEPS;
  //   
  //   let currentProgress = 0;
  //   progressIntervalRef.current = setInterval(() => {
  //     currentProgress += 1;
  //     setLongPressProgress(currentProgress);
  //     
  //     if (currentProgress >= PROGRESS_STEPS) {
  //       if (progressIntervalRef.current) {
  //         clearInterval(progressIntervalRef.current);
  //         progressIntervalRef.current = null;
  //       }
  //       // Trigger multi-scan
  //       handleMultiScan();
  //       setIsLongPressing(false);
  //       setLongPressProgress(0);
  //     }
  //   }, stepInterval);
  // };

  // const handleLongPressEnd = () => {
  //   setIsLongPressing(false);
  //   setLongPressProgress(0);
  //   
  //   if (progressIntervalRef.current) {
  //     clearInterval(progressIntervalRef.current);
  //     progressIntervalRef.current = null;
  //   }
  // };

  // Single scan handler commented out - multi-scan is now default
  // Can be re-enabled if needed
  // const handleSingleScan = async () => {
  //   // Play single scan sound (optional - uses system haptic if sound not available)
  //   try {
  //     if (singleScanSound) {
  //       await singleScanSound.replayAsync();
  //     } else {
  //       // Use haptic feedback as fallback
  //       const { impactAsync } = await import('expo-haptics');
  //       await impactAsync(require('expo-haptics').ImpactFeedbackStyle.Light);
  //     }
  //   } catch (error) {
  //     // Ignore sound errors
  //   }
  //   await handleScan();
  // };

  const handleItemEdit = async (id: string, quantity: number) => {
    try {
      // Ensure quantity is at least 1
      const newQuantity = Math.max(1, quantity);
      
      console.log("Updating quantity:", { id, quantity: newQuantity, mode, hasSelectedPO: !!selectedPO });
      
      // Check if we're in inventory mode - if so, update inventory_items
      if (mode === "inventory" && selectedPO) {
        console.log("Updating inventory item quantity");
        await updateInventoryItem(id, { quantity: newQuantity });
        console.log("Inventory item quantity updated successfully");
      } else {
        console.log("Updating ticket item quantity");
        await updateTicketItem(id, { quantity: newQuantity });
        console.log("Ticket item quantity updated successfully");
      }
    } catch (error) {
      console.error("Failed to update item quantity:", error);
      const errorMsg = formatErrorMessage(error);
      Alert.alert("Error", `Failed to update quantity: ${errorMsg}`);
    }
  };

  const handleItemRemove = async (id: string) => {
    try {
      // Check if we're in inventory mode - if so, delete from inventory_items
      if (mode === "inventory" && selectedPO) {
        await deleteInventoryItem(id);
      } else {
        await deleteTicketItem(id);
      }
    } catch (error) {
      console.error("Failed to remove item:", error);
      const errorMsg = formatErrorMessage(error);
      Alert.alert("Error", `Failed to remove item: ${errorMsg}`);
    }
  };

  const handleItemVerify = async (id: string) => {
    try {
      // Check if we're in inventory mode - if so, update inventory_items
      if (mode === "inventory" && selectedPO) {
        await updateInventoryItem(id, { verified: true });
      } else {
        await updateTicketItem(id, { verified: true });
      }
    } catch (error) {
      console.error("Failed to verify item:", error);
      const errorMsg = formatErrorMessage(error);
      Alert.alert("Error", `Failed to verify item: ${errorMsg}`);
    }
  };

  const handlePurchaseOrderAdd = async (po: Omit<PurchaseOrder, "id" | "user_id" | "created_at">) => {
    try {
      await addPurchaseOrder(po);
    } catch (error) {
      console.error("Failed to add purchase order:", error);
      // You could show an error toast here
    }
  };

  const handlePurchaseOrderSelect = (po: PurchaseOrder) => {
    setSelectedPO(po);
  };

  const handleFinalizePO = async (poId: string) => {
    try {
      // Step 1: Finalize the purchase order (move items to inventory)
      await finalizePurchaseOrder(poId);
      
      // Step 2: Mark PO as closed
      await updatePurchaseOrder(poId, { status: "closed" });
      
      // Step 3: Refresh inventory items to update the Select Existing modal
      await refetchInventoryItems();
      
      // Step 4: Refresh purchase orders list
      await refetchPurchaseOrders();
    } catch (error) {
      console.error("Failed to finalize purchase order:", error);
      const errorMsg = formatErrorMessage(error);
      Alert.alert("Error", `Failed to finalize purchase order: ${errorMsg}`);
      throw error;
    }
  };

  const handleQuickSave = async () => {
    if (!quickPendingItemId) return;
    
    const pendingItem = pendingItems.get(quickPendingItemId);
    if (!pendingItem) return;
    
    if (!quickCost || !quickPrice) {
      Alert.alert("Error", "Cost and price are required");
      return;
    }
    
    // IMMEDIATELY delete the pending item from "needs attention" - default behavior is to get rid of it
    // Only restore it if processing fails
    const itemToRestore = { ...pendingItem }; // Save a copy in case we need to restore it
    setPendingItems(prev => {
      const newMap = new Map(prev);
      newMap.delete(quickPendingItemId);
      return newMap;
    });
    
    // Close quick modal
    setShowQuickCostPriceModal(false);
    
    // Track which pending item we're editing (set this BEFORE calling handleProductSave)
    setEditingPendingItemId(quickPendingItemId);
    
    // Restore the image URI from the pending item
    if (pendingItem._imageUri) {
      setCapturedImageUri(pendingItem._imageUri);
    }
    
    // Set AI data
    const cleanPendingItem = {
      name: pendingItem.name || '',
      short_display_name: pendingItem.short_display_name,
      brand: pendingItem.brand,
      category: pendingItem.category,
      guessed_size: pendingItem.guessed_size,
      color: pendingItem.color,
      pack_size: pendingItem.pack_size,
      human_readable_description: pendingItem.human_readable_description,
      price: quickPrice,
      cost: quickCost,
      sku: pendingItem.sku || '',
      quantity: pendingItem.quantity || 1,
    };
    
    setAiProductData(cleanPendingItem);
    setEditingItemId(null);
    
    // Save the item - if it fails, we'll restore the pending item in the error handler
    try {
      await handleProductSave(cleanPendingItem);
    } catch (error) {
      // If save fails, restore the pending item so user can try again
      console.error("Quick save failed, restoring pending item:", error);
      setPendingItems(prev => {
        const newMap = new Map(prev);
        newMap.set(quickPendingItemId, {
          ...itemToRestore,
          _isProcessing: false,
          _needsReview: true,
        });
        return newMap;
      });
      setEditingPendingItemId(null);
    }
    
    // Clear quick modal state
    setQuickPendingItemId(null);
    setQuickCost("");
    setQuickPrice("");
  };

  const handleEditMore = () => {
    if (!quickPendingItemId) return;
    
    const pendingItem = pendingItems.get(quickPendingItemId);
    if (!pendingItem) return;
    
    // Close quick modal
    setShowQuickCostPriceModal(false);
    
    // Track which pending item we're editing
    setEditingPendingItemId(quickPendingItemId);
    
    // Restore the image URI from the pending item
    if (pendingItem._imageUri) {
      setCapturedImageUri(pendingItem._imageUri);
    }
    
    // Set AI data with current cost/price from quick modal
    const cleanPendingItem = {
      name: pendingItem.name || '',
      short_display_name: pendingItem.short_display_name,
      brand: pendingItem.brand,
      category: pendingItem.category,
      guessed_size: pendingItem.guessed_size,
      color: pendingItem.color,
      pack_size: pendingItem.pack_size,
      human_readable_description: pendingItem.human_readable_description,
      price: quickPrice || pendingItem.price?.toString() || '',
      cost: quickCost || pendingItem.cost?.toString() || '',
      sku: pendingItem.sku || '',
      quantity: pendingItem.quantity || 1,
    };
    
    setAiProductData(cleanPendingItem);
    setEditingItemId(null);
    
    // Open the full side panel
    setIsPanelVisible(true);
    
    // Clear quick modal state
    setQuickPendingItemId(null);
    setQuickCost("");
    setQuickPrice("");
  };

  const handleProductSave = async (data: any) => {
    // Check if we're editing an existing item
    const isEditing = !!editingItemId;
    const isEditingPending = !!editingPendingItemId;
    
    // Only require PO and image when creating a new item for a PO (not when editing pending items)
    // When editing pending items, the image is already stored in the pending item
    // When editing or creating variants, we're working with inventory directly
    const isCreatingForPO = !isEditing && !isEditingPending && selectedPO?.id;
    
    if (isCreatingForPO && !capturedImageUri) {
      Alert.alert("Error", "No image captured");
      return;
    }
    
    // For pending items, get the image URI from the pending item if not in state
    let imageUriToUse = capturedImageUri;
    if (isEditingPending && editingPendingItemId) {
      const pendingItem = pendingItems.get(editingPendingItemId);
      if (!imageUriToUse && pendingItem?._imageUri) {
        imageUriToUse = pendingItem._imageUri;
      }
    }

    if (!data.cost || !data.price) {
      Alert.alert("Error", "Price and cost are required");
      return;
    }

    // Store data needed for background processing BEFORE clearing state
    const imageUriToProcess = imageUriToUse;
    const editingIdToProcess = editingItemId;
    const editingPendingIdToProcess = editingPendingItemId; // Capture for async function
    const targetPOId = selectedPO?.id || null;
    const aiDataForConfidence = aiProductDataRef.current || aiProductData;
    
    // Get original AI-detected name from pending item or AI data
    // This allows matching future scans even if user renamed the item
    let originalAiName: string | null = null;
    if (editingPendingItemId) {
      const pendingItem = pendingItems.get(editingPendingItemId);
      if (pendingItem?.name && pendingItem.name !== data.name) {
        // User changed the name - store the original AI name
        originalAiName = pendingItem.name;
      }
    } else if (aiDataForConfidence?.name && aiDataForConfidence.name !== data.name) {
      // AI name is different from user's name - store it
      originalAiName = aiDataForConfidence.name;
    }
    
    // For new PO items, create optimistic UI item immediately
    let pendingItemId: string | null = null;
    if (isCreatingForPO && !isEditing) {
      pendingItemId = `pending-${Date.now()}-${Math.random()}`;
      const optimisticItem = {
        id: pendingItemId,
        user_id: 'demo-user',
        purchase_order_id: targetPOId,
        name: data.name,
        short_display_name: data.short_display_name || null,
        brand: data.brand || null,
        category: data.category || null,
        guessed_size: data.guessed_size || null,
        color: data.color || null,
        pack_size: data.pack_size || null,
        human_readable_description: data.human_readable_description || null,
        price: parseFloat(data.price),
        cost: parseFloat(data.cost),
        sku: data.sku || null,
        image_url: null, // Will be set when uploaded
        embedding: null,
        quantity: 1,
        confidence: 1.0, // Green for manually scanned items
        verified: false,
        _isPending: true, // Flag for optimistic UI
        _isProcessing: true, // Flag to show it's currently processing
      };
      setPendingItems(prev => {
        const newMap = new Map(prev);
        newMap.set(pendingItemId!, optimisticItem);
        return newMap;
      });
    }
    
    // Mark pending item as processing BEFORE we start background processing
    // Only update if we're not creating a new item (editingPendingItemId means we're editing an existing pending item)
    if (editingPendingItemId && !isCreatingForPO) {
      setPendingItems(prev => {
        const newMap = new Map(prev);
        const item = newMap.get(editingPendingItemId);
        if (item) {
          newMap.set(editingPendingItemId, {
            ...item,
            _isProcessing: true,
            _needsReview: false, // Clear needs review flag - has cost/price now
            price: parseFloat(data.price),
            cost: parseFloat(data.cost),
          });
        }
        return newMap;
      });
    }
    
    // IMMEDIATELY reset UI state so user can continue scanning
    // This allows user to scan next item while this one processes
    setAiProductData(null);
    // Don't clear capturedImageUri if we're editing a pending item - it's stored in the pending item
    if (!isEditingPending) {
      setCapturedImageUri(null);
    }
    setEditingItemId(null);
    // Don't clear editingPendingItemId yet - we need it for error handling
    setIsPanelVisible(false);

    // Process in background - don't block UI
    (async () => {
      let saveSucceeded = false; // Track if save succeeded to prevent error handler from restoring pending item
      try {
        console.log("Saving product in background...");

        // Step 1: Upload image to Supabase storage (only if we have a new image)
        let imageUrl: string | null = null;
        if (imageUriToProcess) {
          try {
            imageUrl = await retryWithBackoff(
              () => withTimeout(
                uploadImageToStorage(imageUriToProcess),
                20000, // 20 second timeout
                'Image upload timed out'
              ),
              2, // 2 retries
              1000 // 1 second initial delay
            );
            console.log("Image uploaded:", imageUrl);
          } catch (error) {
            console.error("Failed to upload image:", error);
            // Continue without image - don't interrupt user
            // Log error but don't show alert if user is working
          }
        } else if (isEditing && editingIdToProcess) {
          // If editing and no new image, keep existing image_url
          const existingItem = inventoryItems.find(item => item.id === editingIdToProcess);
          imageUrl = existingItem?.image_url || null;
        }

        // Step 2: Generate embedding (only if we have a new image)
        let embedding: number[] | null = null;
        if (imageUriToProcess) {
          try {
            console.log("Starting embedding generation...");
            const embeddingResult = await retryWithBackoff(
              () => withTimeout(
                generateImageEmbedding(
                  imageUriToProcess,
                  data.human_readable_description || data.name
                ),
                30000, // 30 second timeout
                'Embedding generation timed out'
              ),
              1, // 1 retry (embeddings are expensive, don't retry too much)
              2000 // 2 second initial delay
            );
            // Ensure embedding is a plain array, not nested or stringified
            if (Array.isArray(embeddingResult)) {
              embedding = embeddingResult;
              // Flatten if nested (shouldn't happen, but defensive)
              if (embedding.length > 0 && Array.isArray(embedding[0])) {
                embedding = embedding.flat() as number[];
              }
              // Ensure all values are numbers
              embedding = embedding.map(v => typeof v === 'number' ? v : parseFloat(String(v))).filter(v => !isNaN(v));
            } else {
              console.warn("Embedding is not an array, skipping");
              embedding = null;
            }
            console.log("Embedding generated:", embedding?.length, "dimensions, type:", Array.isArray(embedding) ? 'array' : typeof embedding);
          } catch (error) {
            console.error("Failed to generate embedding:", error);
            // Continue without embedding - can be regenerated later
            // Don't show error to user - embedding is optional
          }
        } else if (isEditing && editingIdToProcess) {
          // If editing and no new image, keep existing embedding
          const existingItem = inventoryItems.find(item => item.id === editingIdToProcess);
          embedding = existingItem?.embedding || null;
        }

        // Step 3: Handle editing vs creating new item
        if (isEditing && editingIdToProcess) {
          // Editing existing item - update it
          const existingItem = inventoryItems.find(item => item.id === editingIdToProcess);
          if (!existingItem) {
            console.warn("Item not found for editing (may have been deleted)");
            // Remove pending item if it exists
            if (editingPendingIdToProcess) {
              setPendingItems(prev => {
                const newMap = new Map(prev);
                newMap.delete(editingPendingIdToProcess);
                return newMap;
              });
            }
            return; // Exit early - item was deleted
          }
          
          try {
            const updatedItem = await updateInventoryItem(editingIdToProcess, {
              name: data.name,
              // Preserve ai_detected_name if it exists (don't overwrite it)
              ai_detected_name: existingItem.ai_detected_name || originalAiName || null,
              // Preserve keywords if they exist, or update from AI data
              keywords: existingItem.keywords || aiDataForConfidence?.keywords || null,
              short_display_name: data.short_display_name || null,
              brand: data.brand || null,
              category: data.category || null,
              guessed_size: data.guessed_size || null,
              color: data.color || null,
              pack_size: data.pack_size || null,
              human_readable_description: data.human_readable_description || null,
              price: parseFloat(data.price),
              cost: parseFloat(data.cost),
              sku: data.sku || null,
              image_url: imageUrl || existingItem.image_url,
              embedding: embedding || existingItem.embedding,
            });
            
            // If item was deleted (updateInventoryItem returns null), handle gracefully
            if (!updatedItem) {
              console.warn(`Item ${editingIdToProcess} was deleted during processing, skipping update`);
              // Remove pending item if it exists
              if (editingPendingIdToProcess) {
                setPendingItems(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(editingPendingIdToProcess);
                  return newMap;
                });
              }
              return; // Exit early - item was deleted
            }
            
            console.log("Product updated successfully!");
            saveSucceeded = true; // Mark save as succeeded BEFORE deleting pending items
            
            // CRITICAL: Delete pending item IMMEDIATELY after successful update
            // Use synchronous state update to prevent race conditions
            if (editingPendingIdToProcess) {
              console.log(`[handleProductSave] Deleting pending item ${editingPendingIdToProcess} after successful update`);
              setPendingItems(prev => {
                const newMap = new Map(prev);
                if (newMap.has(editingPendingIdToProcess)) {
                  newMap.delete(editingPendingIdToProcess);
                  console.log(`[handleProductSave] Successfully deleted pending item ${editingPendingIdToProcess} after update`);
                } else {
                  console.warn(`[handleProductSave] Pending item ${editingPendingIdToProcess} not found in map`);
                }
                return newMap;
              });
              // Clear editingPendingItemId state immediately
              setEditingPendingItemId(null);
            }
            
            // Refetch to get the updated item
            await refetchInventoryItems();
            return; // Exit early - we've handled the update
          } catch (error) {
            // If update fails (item was deleted), handle gracefully
            console.warn(`Failed to update item ${editingIdToProcess} (may have been deleted):`, error);
            // Remove pending item if it exists
            if (editingPendingIdToProcess) {
              setPendingItems(prev => {
                const newMap = new Map(prev);
                newMap.delete(editingPendingIdToProcess);
                return newMap;
              });
            }
            return; // Exit early - item was deleted or update failed
          }
        } else {
          // Creating new item (variant or new item for PO)
          // If we have a PO, check for duplicates in that PO
          // If no PO, check for duplicates in main inventory (purchase_order_id IS NULL)
          
          // Use improved duplicate detection
          // Note: At this point we may have an embedding if image was processed
          const duplicateMatch = findDuplicateItem(
            {
              name: data.name,
              embedding: embedding || null, // Use embedding if available
            },
            inventoryItems,
            targetPOId,
            {
              nameSimilarityThreshold: 0.7, // 70% name similarity
              embeddingSimilarityThreshold: 0.9, // 90% embedding similarity (high threshold)
              requireEmbeddingMatch: false, // Don't require embedding, but use it if available
            }
          );

          if (duplicateMatch) {
            const existingItem = inventoryItems.find(item => item.id === duplicateMatch.id);
            if (existingItem) {
              // Item exists - increment quantity by 1 (each scan adds 1)
              const newQuantity = (existingItem.quantity || 1) + 1;
              
              try {
                const updatedItem = await updateInventoryItem(existingItem.id, {
                  quantity: newQuantity,
                  verified: false, // Unverify since AI touched it again
                  // Optionally update other fields if they've changed (keep existing if new is empty/null)
                  price: parseFloat(data.price),
                  cost: parseFloat(data.cost),
                  image_url: imageUrl || existingItem.image_url,
                  embedding: embedding || existingItem.embedding, // Update embedding if we have a better one
                });
                
                // If item was deleted (updateInventoryItem returns null), handle gracefully
                if (!updatedItem) {
                  console.warn(`Item ${existingItem.id} was deleted during processing, skipping update`);
                  // Remove pending item if it exists
                  if (pendingItemId) {
                    setPendingItems(prev => {
                      const newMap = new Map(prev);
                      newMap.delete(pendingItemId!);
                      return newMap;
                    });
                  }
                  if (editingPendingIdToProcess) {
                    setPendingItems(prev => {
                      const newMap = new Map(prev);
                      newMap.delete(editingPendingIdToProcess);
                      return newMap;
                    });
                  }
                  return; // Exit early - item was deleted
                }
                
                console.log(`Product quantity updated (matched via ${duplicateMatch.matchType})`);
              } catch (error) {
                // If update fails (item was deleted), handle gracefully
                console.warn(`Failed to update item ${existingItem.id} (may have been deleted):`, error);
                // Remove pending item if it exists
                if (pendingItemId) {
                  setPendingItems(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(pendingItemId!);
                    return newMap;
                  });
                }
                if (editingPendingIdToProcess) {
                  setPendingItems(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(editingPendingIdToProcess);
                    return newMap;
                  });
                }
                return; // Exit early - item was deleted or update failed
              }
              
              // Remove pending item if it exists (since we're incrementing existing item instead)
              if (pendingItemId) {
                setPendingItems(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(pendingItemId!);
                  return newMap;
                });
                // Refetch to update the quantity display
                await refetchInventoryItems();
              }
              
              // Also remove editingPendingIdToProcess if it exists (from quick save)
              if (editingPendingIdToProcess) {
                console.log(`[handleProductSave] Deleting pending item ${editingPendingIdToProcess} after duplicate match`);
                setPendingItems(prev => {
                  const newMap = new Map(prev);
                  if (newMap.has(editingPendingIdToProcess)) {
                    newMap.delete(editingPendingIdToProcess);
                    console.log(`[handleProductSave] Successfully deleted pending item ${editingPendingIdToProcess} after duplicate match`);
                  } else {
                    console.warn(`[handleProductSave] Pending item ${editingPendingIdToProcess} not found in map (may have been deleted already)`);
                  }
                  return newMap;
                });
                setEditingPendingItemId(null);
                await refetchInventoryItems();
              }
              
              return; // Exit early - we've handled the duplicate
            }
          }
          
          // No duplicate found - create new item
          // New item - create with quantity 1
          // If no PO, save to inventory (purchase_order_id = null)
          // If PO exists, save to PO (purchase_order_id = selectedPO.id)
          const savedItem = await addInventoryItem({
              purchase_order_id: targetPOId, // null if no PO, selectedPO.id if PO exists
              name: data.name,
              ai_detected_name: originalAiName, // Store original AI name for future matching
              keywords: aiDataForConfidence?.keywords || null, // Store keywords for flexible matching
              short_display_name: data.short_display_name || null,
              brand: data.brand || null,
              category: data.category || null,
              guessed_size: data.guessed_size || null,
              color: data.color || null,
              pack_size: data.pack_size || null,
              human_readable_description: data.human_readable_description || null,
              price: parseFloat(data.price),
              cost: parseFloat(data.cost),
              sku: data.sku || null,
              image_url: imageUrl,
              embedding: embedding,
              quantity: 1,
              confidence: 1.0, // Green for manually scanned items (user is verifying them)
              verified: false, // New items start unverified
          });
          
          console.log("Product saved successfully!", savedItem);
          saveSucceeded = true; // Mark save as succeeded BEFORE deleting pending items
          
          // CRITICAL: Delete pending items IMMEDIATELY and SYNCHRONOUSLY after successful save
          // Use a single state update to delete ALL pending items related to this save
          // This prevents race conditions and ensures deletion happens before any other operations
          setPendingItems(prev => {
            const newMap = new Map(prev);
            let deleted = false;
            
            // Delete pendingItemId if it exists
            if (pendingItemId && newMap.has(pendingItemId)) {
              newMap.delete(pendingItemId);
              deleted = true;
              console.log(`[handleProductSave] Deleted pendingItemId: ${pendingItemId}`);
            }
            
            // Delete editingPendingIdToProcess if it exists
            if (editingPendingIdToProcess && newMap.has(editingPendingIdToProcess)) {
              newMap.delete(editingPendingIdToProcess);
              deleted = true;
              console.log(`[handleProductSave] Deleted editingPendingIdToProcess: ${editingPendingIdToProcess}`);
            }
            
            if (!deleted) {
              console.warn(`[handleProductSave] No pending items found to delete (pendingItemId: ${pendingItemId}, editingPendingIdToProcess: ${editingPendingIdToProcess})`);
            } else {
              console.log(`[handleProductSave] Successfully deleted ${deleted ? 'pending item(s)' : 'no items'}`);
            }
            
            return newMap;
          });
          
          // Clear editingPendingItemId state immediately (synchronous)
          if (editingPendingIdToProcess) {
            setEditingPendingItemId(null);
          }

          console.log("Product saved successfully!", savedItem);
          
          // Now do non-critical operations that might fail (refetch, variant checking)
          // These errors should NOT restore the pending item since it's already saved
          try {
            // Refetch to get the real item in the main list
            await refetchInventoryItems();
            
            // Check for variant suggestions (only for new items with embeddings)
            if (embedding && embedding.length > 0 && savedItem?.id) {
              // Refetch inventory items to get latest data for variant checking
              await refetchInventoryItems();
              // Use current inventoryItems state (will be updated by refetch)
              // Note: This might use slightly stale data, but that's acceptable for background processing
              const similarItems = findSimilarItems(
                embedding,
                inventoryItems
                  .filter((item: any) => item.id !== savedItem.id && item.embedding)
                  .map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    embedding: item.embedding || null,
                  })),
                0.85 // 85% similarity threshold
              );
              
              if (similarItems.length > 0) {
                console.log("Variant suggestions found:", similarItems);
                // TODO: Show variant suggestion UI in Phase 2
                // For now, just log it
              }
            }
          } catch (postSaveError) {
            // These are non-critical errors (refetch, variant checking)
            // The item was already saved successfully, so just log the error
            console.warn("Non-critical error after save (refetch/variant check):", postSaveError);
            // DO NOT restore pending item - it's already saved!
          }
        }
      } catch (error) {
        console.error("Failed to save product in background:", error);
        const errorMsg = formatErrorMessage(error);
        
        // CRITICAL: Only restore pending item if save did NOT succeed
        // If saveSucceeded is true, the item was saved and pending item was deleted - DO NOT restore it
        if (!saveSucceeded && editingPendingIdToProcess) {
          // Save failed - restore the pending item so user can try again
          // We need to reconstruct it from the data we have
          console.log(`[handleProductSave] Save failed, restoring pending item ${editingPendingIdToProcess}`);
          setPendingItems(prev => {
            const newMap = new Map(prev);
            // Restore the pending item with the data we tried to save
            newMap.set(editingPendingIdToProcess, {
              id: editingPendingIdToProcess,
              user_id: 'demo-user',
              purchase_order_id: targetPOId,
              name: data.name,
              short_display_name: data.short_display_name || null,
              brand: data.brand || null,
              category: data.category || null,
              guessed_size: data.guessed_size || null,
              color: data.color || null,
              pack_size: data.pack_size || null,
              human_readable_description: data.human_readable_description || null,
              price: parseFloat(data.price),
              cost: parseFloat(data.cost),
              sku: data.sku || null,
              quantity: 1,
              confidence: 0.5,
              verified: false,
              _isProcessing: false,
              _needsReview: true, // Ensure it shows in review section
              _imageUri: imageUriToProcess || null,
            });
            return newMap;
          });
        } else if (saveSucceeded) {
          console.log("[handleProductSave] Save succeeded, not restoring pending item even though error occurred");
        }
        
        // Show error dialog - Alert.alert won't close modals or interrupt user's current task
        // User can dismiss and continue working
        Alert.alert(
          "Save Error",
          errorMsg,
          [{ text: "OK" }]
        );
      }
    })();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} edges={[]}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {/* Top Bar - Always mounted to prevent jerking */}
        <TopBar
          mode={mode}
          onModeChange={isLoggedIn ? setMode : () => {}}
          showModeToggle={isLoggedIn}
          clockFormat={clockFormat}
        />

        {/* Show login screen */}
        {!isLoggedIn ? (
          <View style={styles.loginContainer}>
            {/* Background Video */}
            <Animated.View style={[styles.loginVideoContainer, videoOpacityStyle]}>
              <Video
                ref={videoRef}
                source={require("../assets/videos/login-background.mp4")}
                style={[
                  styles.loginVideo,
                  Platform.OS === 'web' 
                    ? {
                        // For web, make video larger than viewport to ensure ResizeMode.COVER fills screen
                        width: windowDimensions.width * 1.2,
                        height: windowDimensions.height * 1.2,
                        marginLeft: -(windowDimensions.width * 0.1), // Center by offsetting 10% of width
                        marginTop: -(windowDimensions.height * 0.1), // Center by offsetting 10% of height
                      }
                    : {
                        width: windowDimensions.width + 100,
                        height: windowDimensions.height + 100,
                      },
                ]}
                resizeMode={ResizeMode.COVER}
                isLooping={false}
                isMuted={true}
                volume={0}
                shouldPlay
                useNativeControls={false}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                progressUpdateIntervalMillis={100}
              />
            </Animated.View>
            
            {/* Blur overlay */}
            <BlurView intensity={10} style={styles.loginBlur} tint="dark" />
            
            {/* Dark overlay for better text readability */}
            <View style={styles.loginOverlay} />
            
            {/* Admin Button - Top Right */}
            <TouchableOpacity
              style={styles.adminButton}
              onPress={() => setShowAdminModal(true)}
            >
              <Settings size={20} color="rgba(255, 255, 255, 0.6)" />
            </TouchableOpacity>

            {/* Login Form - Vertical layout for all platforms, smaller on phones */}
            <View style={[styles.logo, isPhone && styles.logoPhone, { position: 'relative' }]}>
              {/* Blue logo layer */}
              <Image
                source={require("../assets/images/logo.png")}
                style={{ width: '100%', height: '100%', tintColor: '#67E3FF' }}
                resizeMode="contain"
              />
              {/* Purple logo layer with animated opacity */}
              <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, logoAnimatedStyle]}>
                <Image
                  source={require("../assets/images/logo.png")}
                  style={{ width: '100%', height: '100%', tintColor: '#A984FF' }}
                  resizeMode="contain"
                />
              </Animated.View>
            </View>
            
            <Text style={[styles.title, isPhone && styles.titlePhone]}>iris</Text>
            
            <View style={[styles.formContainer, isPhone && styles.formContainerPhone]}>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, isPhone && styles.labelPhone]}>Username</Text>
                <TouchableOpacity activeOpacity={1} onPress={handleUsernameFocus}>
                  <TextInput
                    style={[styles.input, isPhone && styles.inputPhone]}
                    value={username}
                    onChangeText={() => {}} // Prevent text changes
                    onFocus={handleUsernameFocus}
                    placeholder="Enter username"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                    showSoftInputOnFocus={false}
                    editable={false}
                  />
                </TouchableOpacity>
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.label, isPhone && styles.labelPhone]}>Password</Text>
                <TouchableOpacity activeOpacity={1} onPress={handlePasswordFocus}>
                  <TextInput
                    style={[styles.input, isPhone && styles.inputPhone]}
                    value={password}
                    onChangeText={() => {}} // Prevent text changes
                    onFocus={handlePasswordFocus}
                    placeholder="Enter password"
                    placeholderTextColor="#999"
                    secureTextEntry
                    showSoftInputOnFocus={false}
                    editable={false}
                  />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={[styles.button, styles.buttonDisabled, isPhone && styles.buttonPhone]}
                onPress={handleLogin}
              >
                <Text style={[styles.buttonText, isPhone && styles.buttonTextPhone]}>Sign In</Text>
              </TouchableOpacity>
              
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={[styles.dividerText, isPhone && styles.dividerTextPhone]}>or</Text>
                <View style={styles.dividerLine} />
              </View>
              
              <TouchableOpacity
                style={[styles.button, styles.demoButton, isPhone && styles.buttonPhone]}
                onPress={handleDemoMode}
              >
                <Text style={[styles.demoButtonText, isPhone && styles.buttonTextPhone]}>Demo Mode</Text>
              </TouchableOpacity>
            </View>

            {/* Demo Mode Toast - Bottom Right */}
            {showDemoModeToast && (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
                style={styles.demoModeToast}
              >
                <Text style={styles.demoModeToastText}>
                  Use demo mode to check out what iris can do!
                </Text>
              </Animated.View>
            )}
          </View>
        ) : null}

        {/* Portrait Mode Toast - Center (shows in both login and app) */}
        {showPortraitToast && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={styles.portraitToast}
          >
            <Animated.View style={rotateIconStyle}>
              <RotateCw size={24} color="#67E3FF" />
            </Animated.View>
            <Text style={styles.portraitToastText}>
              Better in landscape!
            </Text>
          </Animated.View>
        )}

        {/* Admin Modal */}
        <AdminModal
          visible={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          onDataDeleted={() => {
            // Refresh purchase orders and inventory items after deletion
            refetchPurchaseOrders();
            refetchInventoryItems();
            // Also clear selected PO if it was deleted
            setSelectedPO(null);
          }}
          clockFormat={clockFormat}
          onClockFormatChange={handleClockFormatChange}
          taxRate={taxRate}
          onTaxRateChange={handleTaxRateChange}
        />

        {/* Payment Method Selection Modal */}
        <PaymentMethodModal
          visible={showPaymentMethodModal}
          onClose={() => setShowPaymentMethodModal(false)}
          onSelectCash={handleSelectCash}
          onSelectCard={handleSelectCard}
          total={calculateTotal()}
        />

        {/* Cash Payment Modal */}
        <CashPaymentModal
          visible={showCashPaymentModal}
          onClose={() => setShowCashPaymentModal(false)}
          total={calculateTotal()}
          onComplete={handlePaymentComplete}
          onReceiptRequest={handleReceiptRequest}
        />

        {/* Card Payment Modal */}
        <CardPaymentModal
          visible={showCardPaymentModal}
          onClose={() => setShowCardPaymentModal(false)}
          total={calculateTotal()}
          onComplete={handlePaymentComplete}
          onReceiptRequest={handleReceiptRequest}
        />

        {/* Main App View */}
        {isLoggedIn ? (
          <MainAppView 
            mode={mode} 
            setMode={setMode}
            onSignOut={handleSignOut}
            ticketItems={Array.isArray(ticketItems) ? ticketItems : []}
            onPay={handlePay}
            taxRate={taxRate}
            onItemEdit={handleItemEdit}
            onItemRemove={handleItemRemove}
            onItemVerify={handleItemVerify}
            onScan={handleScan}
            isPanelVisible={isPanelVisible}
            setIsPanelVisible={setIsPanelVisible}
            purchaseOrders={Array.isArray(purchaseOrders) ? purchaseOrders : []}
            onPurchaseOrderAdd={handlePurchaseOrderAdd}
            onPurchaseOrderSelect={handlePurchaseOrderSelect}
            selectedPO={selectedPO}
            onSelectedPOChange={setSelectedPO}
            cameraRef={cameraRef}
            aiProductData={aiProductData}
            setAiProductData={setAiProductData}
            capturedImageUri={capturedImageUri}
            setCapturedImageUri={setCapturedImageUri}
            addInventoryItem={addInventoryItem}
            onProductSave={handleProductSave}
            isProcessingImage={isProcessingImage}
            inventoryItems={inventoryItems}
            pendingItems={pendingItems}
            setPendingItems={setPendingItems}
            flyingIcon={flyingIcon}
            setFlyingIcon={setFlyingIcon}
            onFinalizePO={handleFinalizePO}
            updateInventoryItem={updateInventoryItem}
            refetchInventoryItems={refetchInventoryItems}
            allInventoryItems={allInventoryItems}
            refetchAllInventoryItems={refetchAllInventoryItems}
            updateTicketItem={updateTicketItem}
            addTicketItem={addTicketItem}
          onEditItem={(item) => {
            // Switch to Add New tab and pre-fill form with item data
            setAiProductData({
                name: item.name,
                short_display_name: item.short_display_name || "",
                brand: item.brand || "",
                category: item.category || "",
                guessed_size: item.guessed_size || "",
                color: item.color || "",
                pack_size: item.pack_size || "",
                human_readable_description: item.human_readable_description || "",
                price: item.price || 0,
                cost: item.cost || 0,
                sku: item.sku || "",
              });
              // Store the item ID for updating
              setEditingItemId(item.id);
              setIsPanelVisible(true);
            }}
            onAddVariant={(item) => {
              // Pre-fill form with base item data, but clear variant fields
              setAiProductData({
                name: item.name, // Keep the base name (e.g., "Fresca")
                short_display_name: item.short_display_name || "",
                brand: item.brand || "",
                category: item.category || "",
                guessed_size: "", // Clear variant fields so user can enter new ones
                color: "",
                pack_size: "",
                human_readable_description: item.human_readable_description || "",
                price: item.price || 0, // Keep price/cost as defaults
                cost: item.cost || 0,
                sku: "", // Clear SKU - new variant gets new SKU
              });
              // Don't set editingItemId - this creates a new item
              setEditingItemId(null);
              setIsPanelVisible(true); // Open the panel
            }}
            editingItemId={editingItemId}
            setEditingItemId={setEditingItemId}
            editingPendingItemId={editingPendingItemId}
            setEditingPendingItemId={setEditingPendingItemId}
            detectedItems={detectedItems}
            setDetectedItems={setDetectedItems}
            // Single scan and long press props - multi-scan is now default, these are optional
            handleSingleScan={undefined} // Commented out - can be re-enabled: handleSingleScan
            handleLongPressStart={undefined} // Commented out - can be re-enabled: handleLongPressStart
            handleLongPressEnd={undefined} // Commented out - can be re-enabled: handleLongPressEnd
            handleMultiScan={handleMultiScan}
            isLongPressing={false} // Commented out - can be re-enabled: isLongPressing
            longPressProgress={0} // Commented out - can be re-enabled: longPressProgress
            showTooltip={showTooltip}
            setShowTooltip={setShowTooltip}
            showNoItemsToast={showNoItemsToast}
            setShowNoItemsToast={setShowNoItemsToast}
            showQuickCostPriceModal={showQuickCostPriceModal}
            setShowQuickCostPriceModal={setShowQuickCostPriceModal}
            quickCost={quickCost}
            setQuickCost={setQuickCost}
            quickPrice={quickPrice}
            setQuickPrice={setQuickPrice}
            quickPendingItemId={quickPendingItemId}
            setQuickPendingItemId={setQuickPendingItemId}
            handleQuickSave={handleQuickSave}
            handleEditMore={handleEditMore}
            activeInput={activeInput}
            setActiveInput={setActiveInput}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function MainAppView({
  mode,
  setMode,
  onSignOut,
  ticketItems,
  onItemEdit,
  onItemRemove,
  onItemVerify,
  onScan,
  onPay,
  taxRate,
  isPanelVisible,
  setIsPanelVisible,
  purchaseOrders,
  onPurchaseOrderAdd,
  onPurchaseOrderSelect,
  selectedPO,
  onSelectedPOChange,
  cameraRef,
  aiProductData,
  setAiProductData,
  capturedImageUri,
  setCapturedImageUri,
  addInventoryItem,
  onProductSave,
  isProcessingImage,
  inventoryItems,
  pendingItems,
  setPendingItems,
  onFinalizePO,
  updateInventoryItem,
  refetchInventoryItems,
  allInventoryItems,
  refetchAllInventoryItems,
  updateTicketItem,
  addTicketItem,
  flyingIcon,
  setFlyingIcon,
  onEditItem,
  onAddVariant,
  editingItemId,
  setEditingItemId,
  editingPendingItemId,
  setEditingPendingItemId,
  detectedItems,
  setDetectedItems,
  handleSingleScan, // Commented out but kept for type compatibility - multi-scan is now default
  handleLongPressStart, // Commented out but kept for type compatibility - no long press needed
  handleLongPressEnd, // Commented out but kept for type compatibility - no long press needed
  handleMultiScan,
  isLongPressing, // Commented out but kept for type compatibility - no long press needed
  longPressProgress, // Commented out but kept for type compatibility - no long press needed
  showTooltip,
  setShowTooltip,
  showNoItemsToast,
  setShowNoItemsToast,
  showQuickCostPriceModal,
  setShowQuickCostPriceModal,
  quickCost,
  setQuickCost,
  quickPrice,
  setQuickPrice,
  quickPendingItemId,
  setQuickPendingItemId,
  handleQuickSave,
  handleEditMore,
  activeInput,
  setActiveInput,
}: {
  mode: "inventory" | "sale";
  setMode: (mode: "inventory" | "sale") => void;
  addInventoryItem: (item: Omit<import("@/lib/types").InventoryItem, "id" | "user_id" | "created_at" | "updated_at">) => Promise<import("@/lib/types").InventoryItem>;
  onSignOut: () => void;
  ticketItems: TicketLineItem[];
  onItemEdit: (id: string, quantity: number) => void;
  onItemRemove: (id: string) => void;
  onItemVerify: (id: string) => void;
  onScan: () => void;
  onPay?: () => void;
  taxRate?: number;
  isPanelVisible: boolean;
  setIsPanelVisible: (visible: boolean) => void;
  purchaseOrders: PurchaseOrder[];
  onPurchaseOrderAdd: (po: Omit<PurchaseOrder, "id" | "user_id" | "created_at">) => void;
  onPurchaseOrderSelect: (po: PurchaseOrder) => void;
  selectedPO: PurchaseOrder | null;
  onSelectedPOChange: (po: PurchaseOrder | null) => void;
  cameraRef: React.RefObject<ExpoCameraView | null>;
  aiProductData: any;
  setAiProductData: (data: any) => void;
  capturedImageUri: string | null;
  setCapturedImageUri: (uri: string | null) => void;
  onProductSave: (data: any) => Promise<void>;
  isProcessingImage: boolean;
  inventoryItems: any[];
  pendingItems?: Map<string, any>;
  setPendingItems: (updater: (prev: Map<string, any>) => Map<string, any>) => void;
  onFinalizePO: (poId: string) => Promise<void>;
  updateInventoryItem: (id: string, updates: Partial<any>) => Promise<any>;
  refetchInventoryItems: () => Promise<void>;
  allInventoryItems: any[];
  refetchAllInventoryItems: () => Promise<void>;
  updateTicketItem: (id: string, updates: Partial<any>) => Promise<void>;
  addTicketItem: (item: any) => Promise<void>;
  flyingIcon: { itemId: string } | null;
  setFlyingIcon: (icon: { itemId: string } | null) => void;
  onEditItem: (item: any) => void;
  onAddVariant: (item: any) => void;
  editingItemId: string | null;
  setEditingItemId: (id: string | null) => void;
  editingPendingItemId: string | null;
  setEditingPendingItemId: (id: string | null) => void;
  detectedItems: DetectedItem[];
  setDetectedItems: (items: DetectedItem[]) => void;
  handleSingleScan?: () => Promise<void>; // Optional - multi-scan is now default, can be re-enabled
  handleLongPressStart?: () => void; // Optional - no long press needed, can be re-enabled
  handleLongPressEnd?: () => void; // Optional - no long press needed, can be re-enabled
  handleMultiScan: () => Promise<void>;
  isLongPressing?: boolean; // Optional - no long press needed, can be re-enabled
  longPressProgress?: number; // Optional - no long press needed, can be re-enabled
  showTooltip: boolean;
  setShowTooltip: (show: boolean) => void;
  showNoItemsToast: boolean;
  setShowNoItemsToast: (show: boolean) => void;
  showQuickCostPriceModal: boolean;
  setShowQuickCostPriceModal: (show: boolean) => void;
  quickCost: string;
  setQuickCost: (cost: string) => void;
  quickPrice: string;
  setQuickPrice: (price: string) => void;
  quickPendingItemId: string | null;
  setQuickPendingItemId: (id: string | null) => void;
  handleQuickSave: () => Promise<void>;
  handleEditMore: () => void;
  activeInput: "cost" | "price";
  setActiveInput: (input: "cost" | "price") => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
        {/* Flying Icon Animation - Must be at top level with highest z-index */}
        {flyingIcon && (() => {
          const { width, height } = Dimensions.get('window');
          // Start from center of screen (camera view)
          const startX = width / 2 - 50; // Center minus half icon width
          const startY = height / 2 - 50; // Center minus half icon height
          // End at right side where PO panel is (approximately)
          const endX = width - 327; // Right edge minus panel width (320) and margin (7)
          const endY = height / 4; // Top quarter of screen where items typically are
          
          console.log("=== RENDERING FLYING ICON ===", { 
            startX, startY, endX, endY, 
            itemId: flyingIcon.itemId,
            width, height,
            flyingIcon 
          });
          
          return (
            <FlyingIconAnimation
              key={`flying-icon-${flyingIcon.itemId}-${Date.now()}`}
              startPosition={{ x: startX, y: startY }}
              endPosition={{ x: endX, y: endY }}
              onComplete={() => {
                console.log("Animation complete, clearing state");
                setFlyingIcon(null);
              }}
              duration={2500}
            />
          );
        })()}

        {/* Loading Overlay */}
        <LoadingOverlay 
          visible={isProcessingImage} 
          message="Analyzing products..."
          mode={mode}
        />

        {/* Camera View - Full Screen (behind everything) */}
        <CameraView
          mode={mode}
          onModeChange={setMode}
          detectedItems={detectedItems}
          onSignOut={onSignOut}
          onPanelVisibilityChange={(visible) => {
            // Only update if the value actually changed to avoid loops
            setIsPanelVisible(visible);
            // When panel closes, clear state but preserve image URI for pending items
            if (!visible) {
              setAiProductData(null);
              // Don't clear capturedImageUri if we're editing a pending item
              // It will be restored when we open the item again from the pending item's _imageUri
              if (!editingPendingItemId) {
                setCapturedImageUri(null);
              }
              setEditingItemId(null);
              // Don't clear editingPendingItemId here - let it persist so we can restore image on reopen
              // It will be cleared when the item is actually saved or when explicitly canceled
              // Refetch inventory items to ensure they're not stale
              refetchInventoryItems();
            }
          }}
          cameraRef={cameraRef}
          aiProductData={aiProductData}
          capturedImageUri={capturedImageUri}
          onProductSave={onProductSave}
          onOpenPanel={() => setIsPanelVisible(true)}
          isPanelVisible={isPanelVisible}
          inventoryItems={allInventoryItems.filter(item => !item.purchase_order_id)}
          selectedPO={selectedPO}
          onUpdateInventoryItem={updateInventoryItem}
          updateTicketItem={updateTicketItem}
          addTicketItem={addTicketItem}
          onAddToPO={async (item) => {
            if (mode === "sale") {
              // In sale mode, add to ticket
              try {
                // Check if item already exists on ticket
                const existingTicketItem = ticketItems.find((ticketItem: any) => ticketItem.name === item.name);
                
                if (existingTicketItem) {
                  // Increment quantity
                  await updateTicketItem(existingTicketItem.id, {
                    quantity: (existingTicketItem.quantity || 1) + 1,
                  });
                } else {
                  // Add new item to ticket
                  // Note: additionalInfo (size, color, pack_size) will be looked up from inventory when displaying
                  await addTicketItem({
                    name: item.name,
                    price: item.price || 0,
                    quantity: 1,
                    verified: true, // Items added manually are verified
                    confidence: 1.0, // Manual additions are high confidence
                  });
                }
              } catch (error) {
                Alert.alert("Error", "Failed to add item to ticket");
              }
            } else {
              // In inventory mode, add to PO
              if (!selectedPO?.id) return;
              try {
                await addInventoryItem({
                  ...item,
                  purchase_order_id: selectedPO.id,
                  quantity: 1,
                });
                Alert.alert("Success", "Item added to purchase order");
              } catch (error) {
                Alert.alert("Error", "Failed to add item to purchase order");
              }
            }
          }}
            onEditItem={onEditItem}
            onAddVariant={onAddVariant}
            editingItemId={editingItemId}
            setEditingItemId={setEditingItemId}
        />

        {/* Ticket/Invoice Panel - Right Side (Floating) */}
        <View style={{ 
          position: "absolute", 
          right: 7, 
          top: 7, 
          bottom: 7, 
          width: 320,
          zIndex: 1002,
          elevation: 1002,
        }}>
            <TicketPanel
              items={mode === "inventory" && selectedPO
                ? inventoryItems
                    .filter((item: any) => item.purchase_order_id === selectedPO.id)
                    .map((item: any) => ({
                      id: item.id,
                      name: item.name,
                      price: item.price || 0,
                      cost: item.cost || 0,
                      quantity: item.quantity || 1,
                      verified: item.verified ?? false,
                      confidence: item.confidence ?? 1,
                      purchase_order_id: item.purchase_order_id,
                      user_id: item.user_id,
                    }))
                : ticketItems}
              processingItems={mode === "inventory" && selectedPO ? Array.from((pendingItems || new Map()).values())
                .filter((item: any) => 
                  item.purchase_order_id === selectedPO.id &&
                  item._isProcessing
                ) : []}
              onItemEdit={onItemEdit}
              onItemRemove={onItemRemove}
              onItemVerify={onItemVerify}
              mode={mode}
              purchaseOrders={purchaseOrders}
              onPurchaseOrderAdd={onPurchaseOrderAdd}
              onPurchaseOrderSelect={onPurchaseOrderSelect}
              selectedPO={selectedPO}
              onSelectedPOChange={onSelectedPOChange}
              onFinalizePO={onFinalizePO}
              onEditItem={onEditItem}
              inventoryItems={mode === "sale" ? allInventoryItems.filter((item: any) => !item.purchase_order_id) : inventoryItems}
              pendingItems={pendingItems}
              onPendingItemReview={(pendingId, pendingItem) => {
                // Open quick cost/price modal instead of full panel
                setQuickPendingItemId(pendingId);
                setQuickCost(pendingItem.cost?.toString() || "");
                setQuickPrice(pendingItem.price?.toString() || "");
                setShowQuickCostPriceModal(true);
              }}
              onPendingItemCancel={(pendingId) => {
                // Remove the pending item from the list
                setPendingItems(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(pendingId);
                  return newMap;
                });
              }}
              onPay={onPay}
              taxRate={taxRate}
            />
        </View>

        {/* Bottom Scan Button */}
        <View style={{ 
          position: "absolute", 
          bottom: 16, // Aligned with panel toggle button
          left: insets.left, 
          right: 327 + insets.right, // Always account for panel space (ticket or invoice)
          alignItems: "center",
          zIndex: 10,
        }}>
              <Pressable
                onPress={() => {
                  // Check if disabled (no PO in inventory mode)
                  if (mode === "inventory" && !selectedPO) {
                    // Show tooltip
                    setShowTooltip(true);
                    // Hide tooltip after 2 seconds
                    setTimeout(() => {
                      setShowTooltip(false);
                    }, 2000);
                    return;
                  }
                  // Check if PO is finalized
                  if (mode === "inventory" && selectedPO?.status === "closed") {
                    // Don't do anything if finalized
                    return;
                  }
                  // Otherwise, proceed with scan
                  handleMultiScan();
                }}
                // Single scan commented out for now - can be re-enabled if needed
                // onPress={handleSingleScan}
                // onLongPress={handleLongPressStart}
                // onPressOut={handleLongPressEnd}
                // delayLongPress={100}
                // Don't use disabled prop - we want onPress to fire for tooltip
                style={{
                  borderRadius: 999,
                  overflow: "visible", // Changed to visible so tooltip isn't clipped
                  opacity: (mode === "inventory" && (selectedPO?.status === "closed" || !selectedPO)) ? 0.5 : 1,
                }}
              >
                <BlurView
                  intensity={40}
                  tint="dark"
                  style={{
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      backgroundColor: mode === "sale" 
                        ? "rgba(169, 132, 255, 0.15)" // Purple
                        : "rgba(103, 227, 255, 0.15)", // Blue
                      paddingHorizontal: 29, // 32 * 0.9 = 28.8, rounded
                      paddingVertical: 14, // 16 * 0.9 = 14.4, rounded
                      borderRadius: 999,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 7, // 8 * 0.9 = 7.2, rounded
                      position: "relative",
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    {/* Progress bar removed - multi-scan is now default, no long press needed */}
                    {/* {isLongPressing && (
                      <Animated.View
                        style={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          left: 0,
                          width: `${longPressProgress}%`,
                          backgroundColor: mode === "sale"
                            ? "rgba(169, 132, 255, 0.4)"
                            : "rgba(103, 227, 255, 0.4)",
                          borderRadius: 999,
                        }}
                      />
                    )} */}
                    <LinearGradient
                      colors={
                        mode === "sale"
                          ? [
                              "rgba(169, 132, 255, 0.2)",
                              "rgba(169, 132, 255, 0.1)",
                              "transparent",
                            ]
                          : [
                              "rgba(103, 227, 255, 0.2)",
                              "rgba(103, 227, 255, 0.1)",
                              "transparent",
                            ]
                      }
                      locations={[0, 0.5, 1]}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                      }}
                      pointerEvents="none"
                    />
                    {/* Scan icon - 24 * 0.9 = 21.6, rounded to 22 */}
                    <Scan size={22} color="#fff" />
                    {/* Scan text - 18 * 0.9 = 16.2, rounded to 16 */}
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold", fontFamily: "RobotoCondensed_400Regular" }}>
                      Scan
                      {/* {isLongPressing ? "Multi-Scan..." : "Scan"} */}
                    </Text>
                  </View>
                </BlurView>
              </Pressable>
              
              {/* Tooltip - shows when scan is pressed without PO in inventory mode */}
              {showTooltip && (
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
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "500", fontFamily: "RobotoCondensed_400Regular" }}>
                    Select a Purchase Order first
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
              
              {/* No Items Toast - shows when AI fails to parse any items */}
              {showNoItemsToast && (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(200)}
                  style={{
                    position: "absolute",
                    bottom: "100%",
                    marginBottom: 8,
                    alignSelf: "center",
                    backgroundColor: "rgba(0, 0, 0, 0.9)",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    maxWidth: 280,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 18 }}>
                    No items were found in frame. Adjust your items and try again. If the problem persists, enter items manually or try again later.
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

        {/* Quick Cost/Price Modal */}
        <Modal
          visible={showQuickCostPriceModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowQuickCostPriceModal(false);
            setQuickPendingItemId(null);
            setQuickCost("");
            setQuickPrice("");
          }}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              justifyContent: "center",
              alignItems: "center",
            }}
            onPress={() => {
              setShowQuickCostPriceModal(false);
              setQuickPendingItemId(null);
              setQuickCost("");
              setQuickPrice("");
            }}
          >
            <Pressable
              style={{
                backgroundColor: "#1a1a1a",
                borderRadius: 16,
                padding: 24,
                width: "85%",
                maxWidth: 400,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
              }}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold", marginBottom: 20, fontFamily: "RobotoCondensed_400Regular" }}>
                Add Cost & Price
              </Text>

              {/* Cost Input */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: "#fff", fontSize: 14, marginBottom: 8, fontFamily: "RobotoCondensed_400Regular" }}>Cost</Text>
                <Pressable
                  onPress={() => setActiveInput("cost")}
                  style={{
                    backgroundColor: activeInput === "cost" ? "rgba(103, 227, 255, 0.15)" : "rgba(255, 255, 255, 0.1)",
                    borderRadius: 8,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: activeInput === "cost" ? "#67E3FF" : "rgba(255, 255, 255, 0.2)",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 16, minHeight: 20, fontFamily: "RobotoCondensed_400Regular" }}>
                    {quickCost || "0.00"}
                  </Text>
                </Pressable>
              </View>

              {/* Price Input */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: "#fff", fontSize: 14, marginBottom: 8, fontFamily: "RobotoCondensed_400Regular" }}>Price</Text>
                <Pressable
                  onPress={() => setActiveInput("price")}
                  style={{
                    backgroundColor: activeInput === "price" ? "rgba(103, 227, 255, 0.15)" : "rgba(255, 255, 255, 0.1)",
                    borderRadius: 8,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: activeInput === "price" ? "#67E3FF" : "rgba(255, 255, 255, 0.2)",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 16, minHeight: 20, fontFamily: "RobotoCondensed_400Regular" }}>
                    {quickPrice || "0.00"}
                  </Text>
                </Pressable>
              </View>

              {/* Cost/Price Warning */}
              {(() => {
                const cost = parseFloat(quickCost) || 0;
                const price = parseFloat(quickPrice) || 0;
                const isCostEqual = cost > 0 && price > 0 && cost === price;
                const isCostHigher = cost > 0 && price > 0 && cost > price;
                
                if (isCostEqual || isCostHigher) {
                  return (
                    <View style={{
                      backgroundColor: "rgba(255, 68, 68, 0.15)",
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 16,
                      borderWidth: 1,
                      borderColor: "rgba(255, 68, 68, 0.3)",
                    }}>
                      <Text style={{ color: "#ff4444", fontSize: 12, textAlign: "center", fontFamily: "RobotoCondensed_400Regular" }}>
                        {isCostEqual 
                          ? "Cost is the same as price. You are breaking even on this item at this price"
                          : "Cost is higher than price. You are losing money on this item at this price."}
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}

              {/* Custom Numpad */}
              <View style={{ marginBottom: 24 }}>
                {/* Row 1: 1, 2, 3 */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  {[1, 2, 3].map((num) => (
                    <Pressable
                      key={num}
                      onPress={() => {
                        const currentValue = activeInput === "cost" ? quickCost : quickPrice;
                        const newValue = currentValue === "0.00" || currentValue === "" ? String(num) : currentValue + String(num);
                        if (activeInput === "cost") {
                          setQuickCost(newValue);
                        } else {
                          setQuickPrice(newValue);
                        }
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                        borderRadius: 8,
                        padding: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.2)",
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "600", fontFamily: "RobotoCondensed_400Regular" }}>{num}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Row 2: 4, 5, 6 */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  {[4, 5, 6].map((num) => (
                    <Pressable
                      key={num}
                      onPress={() => {
                        const currentValue = activeInput === "cost" ? quickCost : quickPrice;
                        const newValue = currentValue === "0.00" || currentValue === "" ? String(num) : currentValue + String(num);
                        if (activeInput === "cost") {
                          setQuickCost(newValue);
                        } else {
                          setQuickPrice(newValue);
                        }
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                        borderRadius: 8,
                        padding: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.2)",
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "600", fontFamily: "RobotoCondensed_400Regular" }}>{num}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Row 3: 7, 8, 9 */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  {[7, 8, 9].map((num) => (
                    <Pressable
                      key={num}
                      onPress={() => {
                        const currentValue = activeInput === "cost" ? quickCost : quickPrice;
                        const newValue = currentValue === "0.00" || currentValue === "" ? String(num) : currentValue + String(num);
                        if (activeInput === "cost") {
                          setQuickCost(newValue);
                        } else {
                          setQuickPrice(newValue);
                        }
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                        borderRadius: 8,
                        padding: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.2)",
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "600", fontFamily: "RobotoCondensed_400Regular" }}>{num}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Row 4: ., 0, Backspace */}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      const currentValue = activeInput === "cost" ? quickCost : quickPrice;
                      // Only add decimal if it doesn't already exist
                      if (!currentValue.includes(".")) {
                        const newValue = currentValue === "" || currentValue === "0.00" ? "0." : currentValue + ".";
                        if (activeInput === "cost") {
                          setQuickCost(newValue);
                        } else {
                          setQuickPrice(newValue);
                        }
                      }
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: 8,
                      padding: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "600" }}>.</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const currentValue = activeInput === "cost" ? quickCost : quickPrice;
                      const newValue = currentValue === "0.00" || currentValue === "" ? "0" : currentValue + "0";
                      if (activeInput === "cost") {
                        setQuickCost(newValue);
                      } else {
                        setQuickPrice(newValue);
                      }
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: 8,
                      padding: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "600" }}>0</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const currentValue = activeInput === "cost" ? quickCost : quickPrice;
                      const newValue = currentValue.length > 1 ? currentValue.slice(0, -1) : "";
                      if (activeInput === "cost") {
                        setQuickCost(newValue);
                      } else {
                        setQuickPrice(newValue);
                      }
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: 8,
                      padding: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    <Delete size={20} color="#fff" />
                  </Pressable>
                </View>
              </View>

              {/* Buttons */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 8,
                    padding: 14,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.2)",
                  }}
                  onPress={() => {
                    setShowQuickCostPriceModal(false);
                    setQuickPendingItemId(null);
                    setQuickCost("");
                    setQuickPrice("");
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "500" }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={{
                    flex: 1,
                    backgroundColor: "#67E3FF",
                    borderRadius: 8,
                    padding: 14,
                    alignItems: "center",
                  }}
                  onPress={handleEditMore}
                >
                  <Text style={{ color: "#000", fontSize: 16, fontWeight: "600" }}>Edit More</Text>
                </Pressable>
                <Pressable
                  style={{
                    flex: 1,
                    backgroundColor: "#67E3FF",
                    borderRadius: 8,
                    padding: 14,
                    alignItems: "center",
                  }}
                  onPress={handleQuickSave}
                >
                  <Text style={{ color: "#000", fontSize: 16, fontWeight: "600" }}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loginContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    position: "relative",
    overflow: "hidden",
  },
  loginVideoContainer: {
    position: "absolute",
    top: Platform.OS === 'web' ? 0 : -50,
    left: Platform.OS === 'web' ? 0 : -50,
    right: Platform.OS === 'web' ? 0 : -50,
    bottom: Platform.OS === 'web' ? 0 : -50,
  },
  loginVideo: {
    width: "100%",
    height: "100%",
  },
  loginBlur: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  loginOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)", // Adjust opacity as needed (0-1)
  },
  adminButton: {
    position: "absolute",
    bottom: 10,
    right: 10,
    zIndex: 9999,
    elevation: 9999,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  logo: {
    width: 84,
    height: 84,
    marginTop: 0,
    marginBottom: -8,
  },
  title: {
    color: "#fff",
    fontSize: 54,
    fontWeight: "400",
    fontFamily: "RobotoCondensed_400Regular",
    marginTop: -8,
    marginBottom: 16,
  },
  subtitle: {
    color: "#67E3FF",
    fontSize: 18,
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 32,
  },
  formContainer: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  formTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 24,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
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
  button: {
    backgroundColor: "#67E3FF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
  },
  demoButton: {
    backgroundColor: "#67E3FF",
    marginTop: 8,
  },
  demoButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
  },
  logoutButton: {
    backgroundColor: "#ff4444",
    marginTop: 16,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  dividerText: {
    color: "rgba(255, 255, 255, 0.4)",
    marginHorizontal: 16,
    fontSize: 14,
    fontFamily: "RobotoCondensed_400Regular",
  },
  demoModeToast: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    maxWidth: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  demoModeToastText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontFamily: "RobotoCondensed_400Regular",
  },
  portraitToast: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -100 }, { translateY: -30 }],
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(103, 227, 255, 0.3)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#67E3FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10000,
  },
  portraitToastText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "RobotoCondensed_400Regular",
  },
  // Phone-specific styles (horizontal layout)
  phoneLayout: {
    flexDirection: "row",
    width: "100%",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
  },
  phoneLeftSide: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  phoneRightSide: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  logoPhone: {
    width: 48,
    height: 48,
    marginBottom: -4,
  },
  titlePhone: {
    fontSize: 36,
    fontWeight: "400",
    fontFamily: "RobotoCondensed_400Regular",
    color: "#fff",
    marginBottom: 12,
  },
  formContainerPhone: {
    width: "100%",
    maxWidth: 260,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  formTitlePhone: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 12,
    textAlign: "center",
  },
  labelPhone: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 11,
    fontFamily: "RobotoCondensed_400Regular",
    marginBottom: 5,
  },
  inputPhone: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 13,
    fontFamily: "RobotoCondensed_400Regular",
  },
  buttonPhone: {
    backgroundColor: "#67E3FF",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  buttonTextPhone: {
    color: "#000",
    fontSize: 13,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_400Regular",
  },
  dividerTextPhone: {
    color: "rgba(255, 255, 255, 0.4)",
    marginHorizontal: 10,
    fontSize: 11,
    fontFamily: "RobotoCondensed_400Regular",
  },
});
