import { useState, useEffect } from 'react';
import { supabase, DEMO_USER_ID } from '../supabase';
import { PurchaseOrder, TABLES } from '../types';

export function usePurchaseOrders() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch purchase orders
  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if Supabase is configured
      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('Supabase not configured, skipping fetch');
        setPurchaseOrders([]);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from(TABLES.PURCHASE_ORDERS)
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setPurchaseOrders(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch purchase orders'));
      console.error('Error fetching purchase orders:', err);
      // Don't crash the app - just set empty array
      setPurchaseOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Add new purchase order
  const addPurchaseOrder = async (po: Omit<PurchaseOrder, 'id' | 'user_id' | 'created_at'>) => {
    try {
      setError(null);

      // Check if Supabase is configured
      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('Supabase not configured, adding to local state only');
        // Add to local state with a temporary ID
        const tempPO: PurchaseOrder = {
          ...po,
          id: Date.now().toString(),
          user_id: DEMO_USER_ID,
          status: po.status || "open",
        };
        setPurchaseOrders((prev) => [tempPO, ...prev]);
        return tempPO;
      }

      const { data, error: insertError } = await supabase
        .from(TABLES.PURCHASE_ORDERS)
        .insert({
          ...po,
          user_id: DEMO_USER_ID,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        setPurchaseOrders((prev) => [data, ...prev]);
        return data;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to add purchase order'));
      console.error('Error adding purchase order:', err);
      throw err;
    }
  };

  // Delete purchase order
  const deletePurchaseOrder = async (id: string) => {
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from(TABLES.PURCHASE_ORDERS)
        .delete()
        .eq('id', id)
        .eq('user_id', DEMO_USER_ID);

      if (deleteError) throw deleteError;

      setPurchaseOrders((prev) => prev.filter((po) => po.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete purchase order'));
      console.error('Error deleting purchase order:', err);
      throw err;
    }
  };

  // Update purchase order (e.g., to mark as closed)
  const updatePurchaseOrder = async (id: string, updates: Partial<PurchaseOrder>) => {
    try {
      setError(null);

      const { data, error: updateError } = await supabase
        .from(TABLES.PURCHASE_ORDERS)
        .update(updates)
        .eq('id', id)
        .eq('user_id', DEMO_USER_ID)
        .select()
        .single();

      if (updateError) throw updateError;

      if (data) {
        setPurchaseOrders((prev) => prev.map((po) => (po.id === id ? data : po)));
        return data;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update purchase order'));
      console.error('Error updating purchase order:', err);
      throw err;
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  return {
    purchaseOrders,
    loading,
    error,
    refetch: fetchPurchaseOrders,
    addPurchaseOrder,
    deletePurchaseOrder,
    updatePurchaseOrder,
  };
}

