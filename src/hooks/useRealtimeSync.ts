import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { inventoryKeys } from './useInventory';
import { menuKeys } from './useMenu';
import { barsKeys } from './useBars';
import { settingsKeys } from './useSettings';
import { staffKeys } from './useStaff';

/**
 * Global realtime sync hook that subscribes to database changes
 * and automatically invalidates relevant React Query caches
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to inventory_items changes
    const inventoryChannel = supabase
      .channel('inventory-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_items',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: inventoryKeys.items() });
          queryClient.invalidateQueries({ queryKey: ['inventory-items-active'] });
        }
      )
      .subscribe();

    // Subscribe to menu_items changes
    const menuChannel = supabase
      .channel('menu-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: menuKeys.items() });
          queryClient.invalidateQueries({ queryKey: ['menu-items'] });
          queryClient.invalidateQueries({ queryKey: ['menu-items-all'] });
        }
      )
      .subscribe();

    // Subscribe to menu_categories changes
    const categoriesChannel = supabase
      .channel('categories-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_categories',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: menuKeys.categories() });
          queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
        }
      )
      .subscribe();

    // Subscribe to orders changes
    const ordersChannel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
          queryClient.invalidateQueries({ queryKey: ['bar-orders'] });
          queryClient.invalidateQueries({ queryKey: ['order-history'] });
        }
      )
      .subscribe();

    // Subscribe to bar_inventory changes
    const barInventoryChannel = supabase
      .channel('bar-inventory-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bar_inventory',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: barsKeys.all });
        }
      )
      .subscribe();

    // Subscribe to bar_to_bar_transfers changes
    const transfersChannel = supabase
      .channel('transfers-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bar_to_bar_transfers',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: barsKeys.barToBarTransfers() });
          queryClient.invalidateQueries({ queryKey: barsKeys.all });
        }
      )
      .subscribe();

    // Subscribe to profiles changes
    const profilesChannel = supabase
      .channel('profiles-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: staffKeys.all });
          queryClient.invalidateQueries({ queryKey: ['profiles'] });
        }
      )
      .subscribe();

    // Subscribe to restaurant_settings changes
    const settingsChannel = supabase
      .channel('settings-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_settings',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: settingsKeys.all });
        }
      )
      .subscribe();

    // Subscribe to suppliers changes
    const suppliersChannel = supabase
      .channel('suppliers-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'suppliers',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: inventoryKeys.suppliers() });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(inventoryChannel);
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(categoriesChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(barInventoryChannel);
      supabase.removeChannel(transfersChannel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(suppliersChannel);
    };
  }, [queryClient]);
}
