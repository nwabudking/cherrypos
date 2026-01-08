export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  current_stock: number;
  min_stock_level: number;
  cost_per_unit: number | null;
  supplier: string | null;
  supplier_id: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export type MovementType = "in" | "out" | "adjustment";
