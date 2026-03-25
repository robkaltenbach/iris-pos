import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const DEMO_USER_ID = 'demo-user';

// Lazy initialization of Supabase client to avoid errors at module load
function getSupabaseClient() {
  // Try multiple env var name patterns (frontend uses EXPO_PUBLIC_ prefix)
  const supabaseUrl = 
    process.env.SUPABASE_URL || 
    process.env.EXPO_PUBLIC_SUPABASE_URL;
  
  // Use service key if available (bypasses RLS), otherwise use anon key
  const supabaseKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_ANON_KEY || 
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase credentials. Required: SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY)'
    );
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Delete all inventory items (preserves images in storage)
router.post('/delete-all-items', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    // Note: Supabase delete() doesn't return the deleted rows in data
    // We'll get the count from the response metadata
    const { error, count } = await supabase
      .from('inventory_items')
      .delete()
      .eq('user_id', DEMO_USER_ID)
      .select('*', { count: 'exact', head: false });

    if (error) throw error;

    res.json({
      success: true,
      message: `Deleted inventory items. Images in storage are preserved.`,
      count: count || 0,
    });
  } catch (error) {
    console.error('Error deleting inventory items:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete inventory items',
    });
  }
});

// Delete all purchase orders
router.post('/delete-all-pos', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { error, count } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('user_id', DEMO_USER_ID)
      .select('*', { count: 'exact', head: false });

    if (error) throw error;

    res.json({
      success: true,
      message: `Deleted purchase orders.`,
      count: count || 0,
    });
  } catch (error) {
    console.error('Error deleting purchase orders:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete purchase orders',
    });
  }
});

// Delete all data (items + POs, but preserves images)
router.post('/delete-all-data', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    // Delete inventory items
    const { error: itemsError, count: itemsCount } = await supabase
      .from('inventory_items')
      .delete()
      .eq('user_id', DEMO_USER_ID)
      .select('*', { count: 'exact', head: false });

    if (itemsError) throw itemsError;

    // Delete purchase orders
    const { error: posError, count: posCount } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('user_id', DEMO_USER_ID)
      .select('*', { count: 'exact', head: false });

    if (posError) throw posError;

    res.json({
      success: true,
      message: `Deleted inventory items and purchase orders. Images in storage are preserved.`,
      itemsCount: itemsCount || 0,
      posCount: posCount || 0,
    });
  } catch (error) {
    console.error('Error deleting all data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete data',
    });
  }
});

export default router;

