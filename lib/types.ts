// Database types matching Supabase schema

export interface PurchaseOrder {
  id: string;
  user_id: string;
  distributor_name: string;
  po_number: string;
  date_received: string;
  status: "open" | "closed";
  created_at?: string;
}

export interface TicketLineItem {
  id: string;
  user_id: string;
  purchase_order_id?: string | null;
  name: string;
  price: number;
  cost?: number | null;
  quantity: number;
  verified: boolean;
  confidence: number;
  created_at?: string;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  purchase_order_id?: string | null;
  name: string;
  ai_detected_name?: string | null; // Original name from AI (for matching future scans)
  keywords?: string[] | null; // Searchable keywords for flexible matching
  short_display_name?: string | null;
  brand?: string | null;
  category?: string | null;
  guessed_size?: string | null;
  color?: string | null;
  pack_size?: string | null;
  human_readable_description?: string | null;
  price?: number | null;
  cost?: number | null;
  sku?: string | null;
  image_url?: string | null;
  embedding?: number[] | null;
  quantity?: number | null; // Add quantity field for receiving
  verified?: boolean | null; // Per-item-per-PO verification
  confidence?: number | null; // AI confidence score (0-1)
  created_at?: string;
  updated_at?: string;
}

// AI-extracted product data from OpenAI vision
export interface AIProductData {
  name: string;
  short_display_name?: string;
  brand?: string;
  category?: string;
  guessed_size?: string;
  color?: string;
  pack_size?: string;
  human_readable_description?: string;
  confidence?: number; // AI confidence score (0-1)
  skipped?: boolean; // Flag indicating if item was skipped during processing
}

// Database table names
export const TABLES = {
  PURCHASE_ORDERS: 'purchase_orders',
  TICKET_ITEMS: 'ticket_items',
  INVENTORY_ITEMS: 'inventory_items',
} as const;

