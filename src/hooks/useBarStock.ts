import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { barsKeys } from './useBars';

export interface BarStockItem {
  inventory_item_id: string;
  current_stock: number;
  min_stock_level: number;
}

export interface MenuItemStockInfo {
  menuItemId: string;
  inventoryItemId: string | null;
  hasStock: boolean;
  currentStock: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

// Fetch bar inventory stock for menu items
export function useBarInventoryStock(barId: string | null) {
  return useQuery({
    queryKey: [...barsKeys.all, 'stock', barId],
    queryFn: async () => {
      if (!barId) return new Map<string, BarStockItem>();
      
      const { data, error } = await supabase
        .from('bar_inventory')
        .select('inventory_item_id, current_stock, min_stock_level')
        .eq('bar_id', barId);
      
      if (error) throw error;
      
      // Create a map of inventory_item_id to stock info
      const stockMap = new Map<string, BarStockItem>();
      (data || []).forEach(item => {
        stockMap.set(item.inventory_item_id, {
          inventory_item_id: item.inventory_item_id,
          current_stock: item.current_stock,
          min_stock_level: item.min_stock_level,
        });
      });
      
      return stockMap;
    },
    enabled: !!barId,
    staleTime: 10000, // 10 seconds
  });
}

// Fetch menu items with their inventory item mappings
export function useMenuItemsWithInventory(categoryId?: string) {
  return useQuery({
    queryKey: ['menu', 'items-with-inventory', categoryId],
    queryFn: async () => {
      let query = supabase
        .from('menu_items')
        .select('id, name, price, description, category_id, menu_categories(name), track_inventory, inventory_item_id, is_active, is_available')
        .eq('is_active', true)
        .order('name');
      
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Get stock info for a menu item based on bar inventory
export function getMenuItemStockInfo(
  menuItem: { id: string; track_inventory: boolean | null; inventory_item_id: string | null },
  barStockMap: Map<string, BarStockItem> | undefined,
  cartQuantity: number = 0
): MenuItemStockInfo {
  // If item doesn't track inventory, always available
  if (!menuItem.track_inventory || !menuItem.inventory_item_id) {
    return {
      menuItemId: menuItem.id,
      inventoryItemId: menuItem.inventory_item_id,
      hasStock: true,
      currentStock: Infinity,
      isLowStock: false,
      isOutOfStock: false,
    };
  }
  
  // If no bar selected or no stock map, assume out of stock for tracked items
  if (!barStockMap) {
    return {
      menuItemId: menuItem.id,
      inventoryItemId: menuItem.inventory_item_id,
      hasStock: false,
      currentStock: 0,
      isLowStock: false,
      isOutOfStock: true,
    };
  }
  
  const stockInfo = barStockMap.get(menuItem.inventory_item_id);
  
  if (!stockInfo) {
    // Item not in bar inventory - treat as out of stock
    return {
      menuItemId: menuItem.id,
      inventoryItemId: menuItem.inventory_item_id,
      hasStock: false,
      currentStock: 0,
      isLowStock: false,
      isOutOfStock: true,
    };
  }
  
  const availableStock = stockInfo.current_stock - cartQuantity;
  const isOutOfStock = availableStock <= 0;
  const isLowStock = !isOutOfStock && availableStock <= stockInfo.min_stock_level;
  
  return {
    menuItemId: menuItem.id,
    inventoryItemId: menuItem.inventory_item_id,
    hasStock: availableStock > 0,
    currentStock: availableStock,
    isLowStock,
    isOutOfStock,
  };
}

// Validate cart against bar stock
export function validateCartStock(
  cart: Array<{ menuItemId: string; quantity: number }>,
  menuItems: Array<{ id: string; track_inventory: boolean | null; inventory_item_id: string | null; name: string }>,
  barStockMap: Map<string, BarStockItem> | undefined
): { valid: boolean; insufficientItems: Array<{ name: string; available: number; requested: number }> } {
  const insufficientItems: Array<{ name: string; available: number; requested: number }> = [];
  
  // Group cart by inventory_item_id
  const inventoryDemand = new Map<string, { total: number; menuItemName: string }>();
  
  cart.forEach(cartItem => {
    const menuItem = menuItems.find(m => m.id === cartItem.menuItemId);
    if (!menuItem || !menuItem.track_inventory || !menuItem.inventory_item_id) return;
    
    const existing = inventoryDemand.get(menuItem.inventory_item_id);
    if (existing) {
      existing.total += cartItem.quantity;
    } else {
      inventoryDemand.set(menuItem.inventory_item_id, {
        total: cartItem.quantity,
        menuItemName: menuItem.name,
      });
    }
  });
  
  // Check stock availability
  inventoryDemand.forEach((demand, inventoryItemId) => {
    const stockInfo = barStockMap?.get(inventoryItemId);
    const available = stockInfo?.current_stock || 0;
    
    if (available < demand.total) {
      insufficientItems.push({
        name: demand.menuItemName,
        available,
        requested: demand.total,
      });
    }
  });
  
  return {
    valid: insufficientItems.length === 0,
    insufficientItems,
  };
}
