import { View, Text, TouchableOpacity, Modal, StyleSheet, Alert, ActivityIndicator, ScrollView, TextInput } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Trash2, X, AlertTriangle, CheckCircle2, XCircle, RefreshCw } from "lucide-react-native";
import { supabase } from "../../lib/supabase";

interface AdminModalProps {
  visible: boolean;
  onClose: () => void;
  onDataDeleted?: () => void; // Callback to refresh data after deletion
  clockFormat?: "12h" | "24h";
  onClockFormatChange?: (format: "12h" | "24h") => void;
  taxRate?: number;
  onTaxRateChange?: (rate: number) => void;
}

interface ConnectionStatus {
  connected: boolean;
  loading: boolean;
  error?: string;
  url?: string;
  details?: string;
}

export function AdminModal({ 
  visible, 
  onClose, 
  onDataDeleted, 
  clockFormat = "24h", 
  onClockFormatChange,
  taxRate = 0.07,
  onTaxRateChange,
}: AdminModalProps) {
  const [taxRateInput, setTaxRateInput] = useState<string>(taxRate ? (taxRate * 100).toFixed(1) : "7.0");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteType, setDeleteType] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<ConnectionStatus>({ connected: false, loading: true });
  const [supabaseStatus, setSupabaseStatus] = useState<ConnectionStatus>({ connected: false, loading: true });

  // Sync tax rate input when taxRate prop changes
  useEffect(() => {
    if (taxRate !== undefined) {
      setTaxRateInput((taxRate * 100).toFixed(1));
    }
  }, [taxRate]);

  // Check backend connection
  const checkBackendConnection = useCallback(async () => {
    setBackendStatus(prev => ({ ...prev, loading: true }));
    const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    const apiUrl = rawApiUrl.replace(/\/+$/, ''); // Remove trailing slashes
    
    try {
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies/credentials for authentication
      });

      if (response.ok) {
        const data = await response.json();
        setBackendStatus({
          connected: true,
          loading: false,
          url: apiUrl,
          details: data.message || 'Backend is running',
        });
      } else {
        setBackendStatus({
          connected: false,
          loading: false,
          url: apiUrl,
          error: `HTTP ${response.status}`,
        });
      }
    } catch (error) {
      setBackendStatus({
        connected: false,
        loading: false,
        url: apiUrl,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    }
  }, []);

  // Check Supabase connection
  const checkSupabaseConnection = useCallback(async () => {
    setSupabaseStatus(prev => ({ ...prev, loading: true }));
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    
    try {
      // Try a simple query to verify connection
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id')
        .limit(1);

      if (error) {
        // Even if there's an error, if we got a response, we're connected
        // RLS errors or table not found means we're connected but might not have access
        if (error.code === 'PGRST116' || error.code === '42P01') {
          // Table doesn't exist or no rows - but we're connected
          setSupabaseStatus({
            connected: true,
            loading: false,
            url: supabaseUrl,
            details: 'Connected (table may be empty)',
          });
        } else {
          setSupabaseStatus({
            connected: false,
            loading: false,
            url: supabaseUrl,
            error: error.message || 'Connection failed',
          });
        }
      } else {
        setSupabaseStatus({
          connected: true,
          loading: false,
          url: supabaseUrl,
          details: 'Connected successfully',
        });
      }
    } catch (error) {
      setSupabaseStatus({
        connected: false,
        loading: false,
        url: supabaseUrl,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    }
  }, []);

  // Check connections when modal opens (non-blocking)
  useEffect(() => {
    if (visible) {
      // Reset status when modal opens
      setBackendStatus({ connected: false, loading: true });
      setSupabaseStatus({ connected: false, loading: true });
      
      // Run checks asynchronously after a short delay to ensure modal renders first
      const timeoutId = setTimeout(() => {
        checkBackendConnection().catch(err => {
          console.error('Backend check error:', err);
          setBackendStatus(prev => ({ ...prev, loading: false, error: err.message }));
        });
        checkSupabaseConnection().catch(err => {
          console.error('Supabase check error:', err);
          setSupabaseStatus(prev => ({ ...prev, loading: false, error: err.message }));
        });
      }, 200);
      
      return () => clearTimeout(timeoutId);
    }
  }, [visible, checkBackendConnection, checkSupabaseConnection]);

  const handleDelete = async (type: "items" | "pos" | "all") => {
    // Directly execute delete (password requirement removed)
    executeDelete(type);
  };

  const executeDelete = async (type: "items" | "pos" | "all") => {
    const confirmMessage = 
      type === "items" 
        ? "Delete ALL inventory items? This cannot be undone. Images will be preserved."
        : type === "pos"
        ? "Delete ALL purchase orders? This cannot be undone."
        : "Delete ALL inventory items AND purchase orders? This cannot be undone. Images will be preserved.";

    Alert.alert(
      "⚠️ Confirm Deletion",
      confirmMessage,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            setDeleteType(type);
            try {
              const endpoint = 
                type === "items" ? "/admin/delete-all-items"
                : type === "pos" ? "/admin/delete-all-pos"
                : "/admin/delete-all-data";

              const rawApiUrl = process.env.EXPO_PUBLIC_API_URL;
              if (!rawApiUrl) {
                throw new Error("API URL not configured. Please set EXPO_PUBLIC_API_URL in your .env file.");
              }
              const apiUrl = rawApiUrl.replace(/\/+$/, ''); // Remove trailing slashes

              const fullUrl = `${apiUrl}${endpoint}`;
              console.log("Calling admin endpoint:", fullUrl);

              const response = await fetch(fullUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                credentials: 'include', // Include cookies/credentials for authentication
              });

              console.log("Response status:", response.status, response.statusText);

              // Read response body once
              const responseText = await response.text();
              console.log("Response body:", responseText);

              // Try to get error message from response body
              if (!response.ok) {
                let errorMessage = response.statusText || `HTTP ${response.status}`;
                try {
                  const errorData = JSON.parse(responseText);
                  console.log("Error response data:", errorData);
                  errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                  // If response isn't JSON, use the text directly
                  if (responseText) {
                    errorMessage = responseText;
                  }
                }
                throw new Error(`Failed to delete: ${errorMessage}`);
              }

              // Parse successful response
              const result = JSON.parse(responseText);
              Alert.alert("Success", result.message || "Data deleted successfully");
              
              // Refresh data if callback provided
              if (onDataDeleted) {
                onDataDeleted();
              }
              
              onClose();
            } catch (error) {
              console.error("Delete error:", error);
              Alert.alert("Error", error instanceof Error ? error.message : "Failed to delete data");
            } finally {
              setIsDeleting(false);
              setDeleteType(null);
            }
          },
        },
      ]
    );
  };

  return (
    <>
      {/* Main Admin Modal */}
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
            {/* Header - Fixed at top */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <AlertTriangle size={24} color="#ff6b6b" />
                <Text style={styles.title}>Admin Panel</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <ScrollView 
              style={styles.scrollContent}
              contentContainerStyle={styles.scrollContentContainer}
              showsVerticalScrollIndicator={true}
              bounces={false}
            >
              {/* Warning */}
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ TEMPORARY ADMIN TOOL
                </Text>
                <Text style={styles.warningSubtext}>
                  Use this to clear test data. Images in storage will be preserved.
                </Text>
              </View>

              {/* Actions */}
              <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDelete("items")}
                disabled={isDeleting}
              >
                {isDeleting && deleteType === "items" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Trash2 size={20} color="#fff" />
                )}
                <Text style={styles.actionButtonText}>
                  Delete All Inventory Items
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDelete("pos")}
                disabled={isDeleting}
              >
                {isDeleting && deleteType === "pos" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Trash2 size={20} color="#fff" />
                )}
                <Text style={styles.actionButtonText}>
                  Delete All Purchase Orders
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.deleteAllButton]}
                onPress={() => handleDelete("all")}
                disabled={isDeleting}
              >
                {isDeleting && deleteType === "all" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Trash2 size={20} color="#fff" />
                )}
                <Text style={styles.actionButtonText}>
                  Delete Everything
                </Text>
              </TouchableOpacity>
            </View>

            {/* Info */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                • User data is preserved
              </Text>
              <Text style={styles.infoText}>
                • Images in storage are preserved
              </Text>
              <Text style={styles.infoText}>
                • This action cannot be undone
              </Text>
            </View>

            {/* Connection Status Section */}
            <View style={styles.settingsSection}>
              <Text style={styles.settingsTitle}>Connection Status</Text>
              
              {/* Backend Status */}
              <View style={styles.connectionRow}>
                <View style={styles.connectionHeader}>
                  <Text style={styles.connectionLabel}>Backend API</Text>
                  {backendStatus.loading ? (
                    <ActivityIndicator size="small" color="#67E3FF" />
                  ) : backendStatus.connected ? (
                    <CheckCircle2 size={20} color="#4ade80" />
                  ) : (
                    <XCircle size={20} color="#ef4444" />
                  )}
                </View>
                {backendStatus.url && (
                  <Text style={styles.connectionUrl}>{backendStatus.url}</Text>
                )}
                {backendStatus.loading ? (
                  <Text style={styles.connectionDetails}>Checking...</Text>
                ) : backendStatus.connected ? (
                  <Text style={styles.connectionDetailsSuccess}>
                    {backendStatus.details || 'Connected'}
                  </Text>
                ) : (
                  <Text style={styles.connectionDetailsError}>
                    {backendStatus.error || 'Not connected'}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={checkBackendConnection}
                  disabled={backendStatus.loading}
                >
                  <RefreshCw size={16} color="#67E3FF" />
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>

              {/* Supabase Status */}
              <View style={styles.connectionRow}>
                <View style={styles.connectionHeader}>
                  <Text style={styles.connectionLabel}>Supabase</Text>
                  {supabaseStatus.loading ? (
                    <ActivityIndicator size="small" color="#67E3FF" />
                  ) : supabaseStatus.connected ? (
                    <CheckCircle2 size={20} color="#4ade80" />
                  ) : (
                    <XCircle size={20} color="#ef4444" />
                  )}
                </View>
                {supabaseStatus.url && (
                  <Text style={styles.connectionUrl}>{supabaseStatus.url}</Text>
                )}
                {supabaseStatus.loading ? (
                  <Text style={styles.connectionDetails}>Checking...</Text>
                ) : supabaseStatus.connected ? (
                  <Text style={styles.connectionDetailsSuccess}>
                    {supabaseStatus.details || 'Connected'}
                  </Text>
                ) : (
                  <Text style={styles.connectionDetailsError}>
                    {supabaseStatus.error || 'Not connected'}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={checkSupabaseConnection}
                  disabled={supabaseStatus.loading}
                >
                  <RefreshCw size={16} color="#67E3FF" />
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Settings Section */}
            <View style={styles.settingsSection}>
              <Text style={styles.settingsTitle}>Settings</Text>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Clock Format</Text>
                <View style={styles.toggleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.toggleOption,
                      clockFormat === "24h" && styles.toggleOptionActive
                    ]}
                    onPress={() => onClockFormatChange?.("24h")}
                  >
                    <Text style={[
                      styles.toggleOptionText,
                      clockFormat === "24h" && styles.toggleOptionTextActive
                    ]}>
                      24 Hour
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleOption,
                      clockFormat === "12h" && styles.toggleOptionActive
                    ]}
                    onPress={() => onClockFormatChange?.("12h")}
                  >
                    <Text style={[
                      styles.toggleOptionText,
                      clockFormat === "12h" && styles.toggleOptionTextActive
                    ]}>
                      12 Hour (AM/PM)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Tax Rate (%)</Text>
                <View style={styles.taxRateContainer}>
                  <TextInput
                    style={styles.taxRateInput}
                    value={taxRateInput}
                    onChangeText={(text) => {
                      // Allow only numbers and decimal point
                      const cleaned = text.replace(/[^0-9.]/g, '');
                      setTaxRateInput(cleaned);
                    }}
                    onBlur={() => {
                      const numValue = parseFloat(taxRateInput);
                      if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                        const rate = numValue / 100;
                        onTaxRateChange?.(rate);
                      } else {
                        // Reset to current tax rate if invalid
                        setTaxRateInput(taxRate ? (taxRate * 100).toFixed(1) : "7.0");
                      }
                    }}
                    keyboardType="decimal-pad"
                    placeholder="7.0"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  />
                  <Text style={styles.taxRatePercent}>%</Text>
                </View>
              </View>
            </View>
            </ScrollView>
          </LinearGradient>
        </BlurView>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  blurContainer: {
    width: "90%",
    maxWidth: 500,
    height: "85%",
    maxHeight: 700,
    borderRadius: 24,
    overflow: "hidden",
  },
  modalContainer: {
    height: "100%",
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  closeButton: {
    padding: 4,
  },
  warningBox: {
    backgroundColor: "rgba(255, 107, 107, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.4)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningText: {
    color: "#ff6b6b",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  warningSubtext: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteButton: {
    backgroundColor: "rgba(255, 107, 107, 0.2)",
    borderColor: "rgba(255, 107, 107, 0.4)",
  },
  deleteAllButton: {
    backgroundColor: "rgba(255, 59, 48, 0.3)",
    borderColor: "rgba(255, 59, 48, 0.5)",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  infoBox: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    marginBottom: 4,
  },
  settingsSection: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  settingsTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  settingRow: {
    marginBottom: 12,
  },
  settingLabel: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    marginBottom: 8,
  },
  toggleContainer: {
    flexDirection: "row",
    gap: 8,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
  },
  toggleOptionActive: {
    borderColor: "#67E3FF",
    backgroundColor: "rgba(103, 227, 255, 0.2)",
  },
  toggleOptionText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontWeight: "500",
  },
  toggleOptionTextActive: {
    color: "#67E3FF",
    fontWeight: "600",
  },
  taxRateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  taxRateInput: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: "#fff",
    fontSize: 14,
    fontFamily: "RobotoCondensed_400Regular",
  },
  taxRatePercent: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontFamily: "RobotoCondensed_400Regular",
  },
  connectionRow: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  connectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  connectionLabel: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    fontWeight: "600",
  },
  connectionUrl: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    fontFamily: "monospace",
    marginBottom: 4,
  },
  connectionDetails: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    marginBottom: 8,
  },
  connectionDetailsSuccess: {
    color: "#4ade80",
    fontSize: 12,
    marginBottom: 8,
  },
  connectionDetailsError: {
    color: "#ef4444",
    fontSize: 12,
    marginBottom: 8,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "rgba(103, 227, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(103, 227, 255, 0.3)",
  },
  refreshButtonText: {
    color: "#67E3FF",
    fontSize: 12,
    fontWeight: "500",
  },
});

