import { useState, useEffect } from 'react';
import { supabase, DEMO_USER_ID } from '../supabase';
import { InventoryItem, TABLES } from '../types';

export function useInventoryItems(purchaseOrderId?: string) {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch inventory items
  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('Supabase not configured, skipping fetch');
        setInventoryItems([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from(TABLES.INVENTORY_ITEMS)
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .order('created_at', { ascending: false });

      if (purchaseOrderId) {
        query = query.eq('purchase_order_id', purchaseOrderId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setInventoryItems(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch inventory items'));
      console.error('Error fetching inventory items:', err);
      setInventoryItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Add new inventory item
  const addInventoryItem = async (item: Omit<InventoryItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      setError(null);

      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('Supabase not configured, adding to local state only');
        const tempItem: InventoryItem = {
          ...item,
          id: Date.now().toString(),
          user_id: DEMO_USER_ID,
        };
        setInventoryItems((prev) => [tempItem, ...prev]);
        return tempItem;
      }

      // Format embedding for pgvector if present
      const insertData: any = {
        ...item,
        user_id: DEMO_USER_ID,
      };
      
      // Ensure embedding is a plain array for pgvector (Supabase handles conversion)
      if (insertData.embedding !== null && insertData.embedding !== undefined) {
        if (Array.isArray(insertData.embedding)) {
          // Already an array, ensure it's not nested
          if (insertData.embedding.length > 0 && Array.isArray(insertData.embedding[0])) {
            insertData.embedding = insertData.embedding.flat();
          }
          // Ensure all values are numbers
          insertData.embedding = insertData.embedding.map((v: any) => typeof v === 'number' ? v : parseFloat(v)).filter((v: any) => !isNaN(v));
        } else if (typeof insertData.embedding === 'string') {
          // If it's a string, try to parse it
          try {
            const parsed = JSON.parse(insertData.embedding);
            if (Array.isArray(parsed)) {
              // Flatten if nested
              insertData.embedding = Array.isArray(parsed[0]) ? parsed.flat() : parsed;
              // Ensure all values are numbers
              insertData.embedding = insertData.embedding.map((v: any) => typeof v === 'number' ? v : parseFloat(v)).filter((v: any) => !isNaN(v));
            } else {
              console.warn('Parsed embedding is not an array, setting to null');
              insertData.embedding = null;
            }
          } catch (e) {
            console.warn('Failed to parse embedding string, setting to null');
            insertData.embedding = null;
          }
        } else {
          console.warn('Embedding is not an array or string, setting to null');
          insertData.embedding = null;
        }
      }

      const { data, error: insertError } = await supabase
        .from(TABLES.INVENTORY_ITEMS)
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        setInventoryItems((prev) => [data, ...prev]);
        return data;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to add inventory item'));
      console.error('Error adding inventory item:', err);
      throw err;
    }
  };

  // Delete inventory item
  const deleteInventoryItem = async (id: string) => {
    try {
      setError(null);

      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('Supabase not configured, removing from local state only');
        setInventoryItems((prev) => prev.filter(item => item.id !== id));
        return;
      }

      const { error: deleteError } = await supabase
        .from(TABLES.INVENTORY_ITEMS)
        .delete()
        .eq('id', id)
        .eq('user_id', DEMO_USER_ID);

      if (deleteError) throw deleteError;

      setInventoryItems((prev) => prev.filter(item => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete inventory item'));
      console.error('Error deleting inventory item:', err);
      throw err;
    }
  };

  // Update inventory item
  const updateInventoryItem = async (id: string, updates: Partial<InventoryItem>) => {
    try {
      setError(null);

      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('Supabase not configured, updating local state only');
        setInventoryItems((prev) => prev.map(item => 
          item.id === id ? { ...item, ...updates } : item
        ));
        return;
      }

      // Format embedding for pgvector if present in updates
      const updateData: any = { ...updates };
      
      if (updateData.embedding !== null && updateData.embedding !== undefined) {
        if (Array.isArray(updateData.embedding)) {
          // Already an array, ensure it's not nested
          if (updateData.embedding.length > 0 && Array.isArray(updateData.embedding[0])) {
            updateData.embedding = updateData.embedding.flat();
          }
          // Ensure all values are numbers
          updateData.embedding = updateData.embedding.map((v: any) => typeof v === 'number' ? v : parseFloat(v)).filter((v: any) => !isNaN(v));
        } else if (typeof updateData.embedding === 'string') {
          // If it's a string, try to parse it
          try {
            const parsed = JSON.parse(updateData.embedding);
            if (Array.isArray(parsed)) {
              // Flatten if nested
              updateData.embedding = Array.isArray(parsed[0]) ? parsed.flat() : parsed;
              // Ensure all values are numbers
              updateData.embedding = updateData.embedding.map((v: any) => typeof v === 'number' ? v : parseFloat(v)).filter((v: any) => !isNaN(v));
            } else {
              console.warn('Parsed embedding is not an array, setting to null');
              updateData.embedding = null;
            }
          } catch (e) {
            console.warn('Failed to parse embedding string, setting to null');
            updateData.embedding = null;
          }
        } else {
          console.warn('Embedding is not an array or string, setting to null');
          updateData.embedding = null;
        }
      }

      const { data, error: updateError } = await supabase
        .from(TABLES.INVENTORY_ITEMS)
        .update(updateData)
        .eq('id', id)
        .eq('user_id', DEMO_USER_ID)
        .select()
        .single();

      if (updateError) {
        // If item doesn't exist (was deleted), return null instead of throwing
        if (updateError.code === 'PGRST116' || updateError.message?.includes('0 rows')) {
          console.warn(`Item ${id} not found (may have been deleted), skipping update`);
          return null;
        }
        throw updateError;
      }

      if (data) {
        // Update local state immediately
        setInventoryItems((prev) => prev.map(item => item.id === id ? data : item));
        return data;
      }
      
      // No data returned but no error - item may have been deleted
      console.warn(`Item ${id} not found (may have been deleted), skipping update`);
      return null;
    } catch (err) {
      // If it's a "not found" error, return null instead of throwing
      if (err && typeof err === 'object' && 'code' in err && err.code === 'PGRST116') {
        console.warn(`Item ${id} not found (may have been deleted), skipping update`);
        return null;
      }
      setError(err instanceof Error ? err : new Error('Failed to update inventory item'));
      console.error('Error updating inventory item:', err);
      throw err;
    }
  };

  // Finalize PO: Move items from PO to inventory (set purchase_order_id to NULL and aggregate by SKU/name)
  const finalizePurchaseOrder = async (purchaseOrderId: string) => {
    try {
      setError(null);

      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase not configured');
      }

      // Get all items for this PO
      const { data: poItems, error: fetchError } = await supabase
        .from(TABLES.INVENTORY_ITEMS)
        .select('*')
        .eq('purchase_order_id', purchaseOrderId)
        .eq('user_id', DEMO_USER_ID);

      if (fetchError) throw fetchError;

      if (!poItems || poItems.length === 0) {
        console.warn('No items to finalize for PO:', purchaseOrderId);
        return;
      }

      // Aggregate items by SKU (or name if no SKU) and sum quantities
      const aggregatedItems = new Map<string, {
        item: InventoryItem;
        totalQuantity: number;
      }>();

      for (const item of poItems) {
        const key = item.sku || item.name; // Use SKU as primary key, fallback to name
        const quantity = item.quantity || 1;

        if (aggregatedItems.has(key)) {
          // Item already exists, add to quantity
          const existing = aggregatedItems.get(key)!;
          existing.totalQuantity += quantity;
        } else {
          // New item
          aggregatedItems.set(key, {
            item: { ...item, quantity: quantity },
            totalQuantity: quantity,
          });
        }
      }

      // For each aggregated item, either create new inventory item or update existing
      for (const [key, { item, totalQuantity }] of aggregatedItems) {
        // Check if item already exists in inventory (purchase_order_id IS NULL)
        // Match by SKU first, then by name if no SKU
        let query = supabase
          .from(TABLES.INVENTORY_ITEMS)
          .select('*')
          .eq('user_id', DEMO_USER_ID)
          .is('purchase_order_id', null);

        if (item.sku) {
          query = query.eq('sku', item.sku);
        } else {
          query = query.eq('name', item.name);
        }

        const { data: existingItems, error: checkError } = await query.limit(1);

        if (checkError) {
          console.error('Error checking existing items:', checkError);
          throw checkError;
        }

        if (existingItems && existingItems.length > 0) {
          // Update existing inventory item - add to quantity
          const existing = existingItems[0];
          const newQuantity = (existing.quantity || 0) + totalQuantity;
          const { error: updateError } = await supabase
            .from(TABLES.INVENTORY_ITEMS)
            .update({ quantity: newQuantity })
            .eq('id', existing.id);

          if (updateError) throw updateError;
        } else {
          // Create new inventory item (without purchase_order_id = in stock)
          // Exclude id, created_at, updated_at, and purchase_order_id from the item
          const { id, created_at, updated_at, purchase_order_id, ...itemData } = item;
          
          // Format embedding if present
          let formattedEmbedding = itemData.embedding;
          if (formattedEmbedding !== null && formattedEmbedding !== undefined) {
            if (Array.isArray(formattedEmbedding)) {
              if (formattedEmbedding.length > 0 && Array.isArray(formattedEmbedding[0])) {
                formattedEmbedding = formattedEmbedding.flat();
              }
              formattedEmbedding = formattedEmbedding.map((v: any) => typeof v === 'number' ? v : parseFloat(v)).filter((v: any) => !isNaN(v));
            } else if (typeof formattedEmbedding === 'string') {
              try {
                const parsed = JSON.parse(formattedEmbedding);
                if (Array.isArray(parsed)) {
                  formattedEmbedding = Array.isArray(parsed[0]) ? parsed.flat() : parsed;
                  formattedEmbedding = formattedEmbedding.map((v: any) => typeof v === 'number' ? v : parseFloat(v)).filter((v: any) => !isNaN(v));
                } else {
                  formattedEmbedding = null;
                }
              } catch (e) {
                formattedEmbedding = null;
              }
            } else {
              formattedEmbedding = null;
            }
          }
          
          const { error: insertError } = await supabase
            .from(TABLES.INVENTORY_ITEMS)
            .insert({
              ...itemData,
              embedding: formattedEmbedding,
              purchase_order_id: null, // NULL means it's in inventory
              quantity: totalQuantity,
              user_id: DEMO_USER_ID,
            });

          if (insertError) throw insertError;
        }
      }

      // Don't delete the PO items - keep them for historical viewing
      // They're already in inventory (with purchase_order_id = NULL), but we keep
      // the original items linked to the PO so users can view what was finalized
      // The items in inventory are the "live" copies, these are historical records
      
      // Refresh inventory items
      await fetchInventoryItems();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to finalize purchase order'));
      console.error('Error finalizing purchase order:', err);
      throw err;
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchInventoryItems();
  }, [purchaseOrderId]);

  return {
    inventoryItems,
    loading,
    error,
    refetch: fetchInventoryItems,
    addInventoryItem,
    deleteInventoryItem,
    updateInventoryItem,
    finalizePurchaseOrder,
  };
}

