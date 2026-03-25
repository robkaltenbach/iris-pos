import { useState, useEffect } from 'react';
import { supabase, DEMO_USER_ID } from '../supabase';

const COUNTER_ID = 'global';

/**
 * Hook to manage global PO counter that persists across data wipes
 */
export function usePOCounter() {
  const [counter, setCounter] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch current counter
  const fetchCounter = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('Supabase not configured, using local counter');
        setCounter(1);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('po_counter')
        .select('counter')
        .eq('id', COUNTER_ID)
        .single();

      if (fetchError) {
        // If table doesn't exist, create it with initial value
        if (fetchError.code === 'PGRST116') {
          console.log('PO counter table not found, initializing...');
          const { data: insertData, error: insertError } = await supabase
            .from('po_counter')
            .insert({ id: COUNTER_ID, counter: 1 })
            .select()
            .single();

          if (insertError) throw insertError;
          setCounter(insertData.counter);
        } else {
          throw fetchError;
        }
      } else {
        setCounter(data?.counter || 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch PO counter'));
      console.error('Error fetching PO counter:', err);
      // Default to 1 if fetch fails
      setCounter(1);
    } finally {
      setLoading(false);
    }
  };

  // Increment counter and return new value
  const incrementCounter = async (): Promise<number> => {
    try {
      setError(null);

      if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('Supabase not configured, incrementing local counter');
        const newCounter = counter + 1;
        setCounter(newCounter);
        return newCounter;
      }

      // Use atomic increment with PostgreSQL
      const { data, error: updateError } = await supabase
        .rpc('increment_po_counter')
        .single();

      if (updateError) {
        // If RPC doesn't exist, use update with increment
        const { data: currentData, error: fetchError } = await supabase
          .from('po_counter')
          .select('counter')
          .eq('id', COUNTER_ID)
          .single();

        if (fetchError) throw fetchError;

        const newCounter = (currentData?.counter || counter) + 1;

        const { data: updateData, error: updateError2 } = await supabase
          .from('po_counter')
          .update({ counter: newCounter, updated_at: new Date().toISOString() })
          .eq('id', COUNTER_ID)
          .select()
          .single();

        if (updateError2) throw updateError2;

        setCounter(newCounter);
        return newCounter;
      } else {
        setCounter(data);
        return data;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to increment PO counter'));
      console.error('Error incrementing PO counter:', err);
      // Fallback: increment locally
      const newCounter = counter + 1;
      setCounter(newCounter);
      return newCounter;
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchCounter();
  }, []);

  return {
    counter,
    loading,
    error,
    incrementCounter,
    refetch: fetchCounter,
  };
}

