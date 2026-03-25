import { useState, useEffect } from 'react';
import { supabase, DEMO_USER_ID } from '../supabase';
import { TicketLineItem, TABLES } from '../types';

export function useTicketItems() {
  const [ticketItems, setTicketItems] = useState<TicketLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch ticket items
  const fetchTicketItems = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if Supabase is configured
      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('Supabase not configured, skipping fetch');
        setTicketItems([]);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from(TABLES.TICKET_ITEMS)
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setTicketItems(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch ticket items'));
      console.error('Error fetching ticket items:', err);
      // Don't crash the app - just set empty array
      setTicketItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Add ticket item
  const addTicketItem = async (item: Omit<TicketLineItem, 'id' | 'user_id' | 'created_at'>) => {
    try {
      setError(null);

      const { data, error: insertError } = await supabase
        .from(TABLES.TICKET_ITEMS)
        .insert({
          ...item,
          user_id: DEMO_USER_ID,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        setTicketItems((prev) => [data, ...prev]);
        return data;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to add ticket item'));
      console.error('Error adding ticket item:', err);
      throw err;
    }
  };

  // Update ticket item
  const updateTicketItem = async (id: string, updates: Partial<TicketLineItem>) => {
    try {
      setError(null);

      // Check if Supabase is configured
      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('Supabase not configured, updating local state only');
        // Update local state
        setTicketItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
        );
        return;
      }

      const { data, error: updateError } = await supabase
        .from(TABLES.TICKET_ITEMS)
        .update(updates)
        .eq('id', id)
        .eq('user_id', DEMO_USER_ID)
        .select()
        .single();

      if (updateError) throw updateError;

      if (data) {
        setTicketItems((prev) =>
          prev.map((item) => (item.id === id ? data : item))
        );
        return data;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update ticket item'));
      console.error('Error updating ticket item:', err);
      // Fallback to local update on error
      setTicketItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    }
  };

  // Delete ticket item
  const deleteTicketItem = async (id: string) => {
    try {
      setError(null);

      // Check if Supabase is configured
      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('Supabase not configured, deleting from local state only');
        setTicketItems((prev) => prev.filter((item) => item.id !== id));
        return;
      }

      const { error: deleteError } = await supabase
        .from(TABLES.TICKET_ITEMS)
        .delete()
        .eq('id', id)
        .eq('user_id', DEMO_USER_ID);

      if (deleteError) throw deleteError;

      setTicketItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete ticket item'));
      console.error('Error deleting ticket item:', err);
      // Fallback to local delete on error
      setTicketItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  // Clear all ticket items (for new transaction)
  const clearTicketItems = async () => {
    try {
      setError(null);

      // Check if Supabase is configured
      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('Supabase not configured, clearing local state only');
        setTicketItems([]);
        return;
      }

      const { error: deleteError } = await supabase
        .from(TABLES.TICKET_ITEMS)
        .delete()
        .eq('user_id', DEMO_USER_ID);

      if (deleteError) throw deleteError;

      setTicketItems([]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to clear ticket items'));
      console.error('Error clearing ticket items:', err);
      // Fallback to local clear on error
      setTicketItems([]);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchTicketItems();
  }, []);

  return {
    ticketItems,
    loading,
    error,
    refetch: fetchTicketItems,
    addTicketItem,
    updateTicketItem,
    deleteTicketItem,
    clearTicketItems,
  };
}

