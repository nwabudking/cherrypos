import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Bar {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
}

export interface BarInventoryItem {
  id: string;
  bar_id: string;
  inventory_item_id: string;
  current_stock: number;
  min_stock_level: number;
  is_active: boolean | null;
  expiry_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  inventory_item?: {
    id: string;
    name: string;
    unit: string;
    category: string | null;
    cost_per_unit: number | null;
    selling_price: number | null;
  };
}

export interface InventoryTransfer {
  id: string;
  source_type: string;
  source_bar_id: string | null;
  destination_bar_id: string;
  inventory_item_id: string;
  quantity: number;
  status: string;
  notes: string | null;
  transferred_by: string | null;
  created_at: string | null;
  completed_at: string | null;
  destination_bar?: Bar;
  source_bar?: Bar;
  inventory_item?: {
    id: string;
    name: string;
    unit: string;
  };
}

export interface BarToBarTransfer {
  id: string;
  source_bar_id: string;
  destination_bar_id: string;
  inventory_item_id: string;
  quantity: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  notes: string | null;
  requested_by: string | null;
  approved_by: string | null;
  created_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
  source_bar?: { id: string; name: string };
  destination_bar?: { id: string; name: string };
  inventory_item?: {
    id: string;
    name: string;
    unit: string;
  };
  requester?: {
    full_name: string | null;
    email: string | null;
  };
  approver?: {
    full_name: string | null;
    email: string | null;
  };
}

// Query keys
export const barsKeys = {
  all: ['bars'] as const,
  list: () => [...barsKeys.all, 'list'] as const,
  active: () => [...barsKeys.all, 'active'] as const,
  detail: (id: string) => [...barsKeys.all, 'detail', id] as const,
  inventory: (barId: string) => [...barsKeys.all, 'inventory', barId] as const,
  transfers: () => [...barsKeys.all, 'transfers'] as const,
  barToBarTransfers: () => [...barsKeys.all, 'bar-to-bar-transfers'] as const,
  pendingTransfers: (barId: string) => [...barsKeys.all, 'pending-transfers', barId] as const,
};

// Bars hooks
export function useBars() {
  return useQuery({
    queryKey: barsKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bars')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Bar[];
    },
  });
}

export function useActiveBars() {
  return useQuery({
    queryKey: barsKeys.active(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bars')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Bar[];
    },
  });
}

export function useBar(id: string) {
  return useQuery({
    queryKey: barsKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bars')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Bar;
    },
    enabled: !!id,
  });
}

export function useCreateBar() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: result, error } = await supabase
        .from('bars')
        .insert({
          name: data.name,
          description: data.description,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return result as Bar;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: barsKeys.all });
      toast.success('Bar created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create bar');
    },
  });
}

export function useUpdateBar() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Bar> }) => {
      const { data: result, error } = await supabase
        .from('bars')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result as Bar;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: barsKeys.all });
      toast.success('Bar updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update bar');
    },
  });
}

export function useDeleteBar() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bars')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: barsKeys.all });
      toast.success('Bar deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete bar');
    },
  });
}

// Bar Inventory hooks
export function useBarInventory(barId: string) {
  return useQuery({
    queryKey: barsKeys.inventory(barId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bar_inventory')
        .select(`
          *,
          inventory_item:inventory_items(id, name, unit, category, cost_per_unit, selling_price)
        `)
        .eq('bar_id', barId);
      if (error) throw error;
      return data as BarInventoryItem[];
    },
    enabled: !!barId,
  });
}

export function useLowStockBarInventory(barId: string) {
  return useQuery({
    queryKey: [...barsKeys.inventory(barId), 'low-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bar_inventory')
        .select(`
          *,
          inventory_item:inventory_items(id, name, unit, category, cost_per_unit, selling_price)
        `)
        .eq('bar_id', barId);
      
      if (error) throw error;
      
      // Filter to low stock items
      return (data as BarInventoryItem[]).filter(
        item => item.current_stock <= item.min_stock_level
      );
    },
    enabled: !!barId,
  });
}

// Transfer inventory from store to bar
export function useTransferToBar() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      barId,
      inventoryItemId,
      quantity,
      notes,
    }: {
      barId: string;
      inventoryItemId: string;
      quantity: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('transfer_store_to_bar', {
        p_bar_id: barId,
        p_inventory_item_id: inventoryItemId,
        p_quantity: quantity,
        p_notes: notes,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: barsKeys.all });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Inventory transferred successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to transfer inventory');
    },
  });
}

// Get transfer history
export function useInventoryTransfers() {
  return useQuery({
    queryKey: barsKeys.transfers(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_transfers')
        .select(`
          *,
          destination_bar:bars!destination_bar_id(id, name),
          source_bar:bars!source_bar_id(id, name),
          inventory_item:inventory_items(id, name, unit)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as InventoryTransfer[];
    },
  });
}

// Bar to Bar Transfer hooks
export function useBarToBarTransfers() {
  return useQuery({
    queryKey: barsKeys.barToBarTransfers(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bar_to_bar_transfers')
        .select(`
          *,
          source_bar:bars!source_bar_id(id, name),
          destination_bar:bars!destination_bar_id(id, name),
          inventory_item:inventory_items(id, name, unit),
          requester:profiles!requested_by(full_name, email),
          approver:profiles!approved_by(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as BarToBarTransfer[];
    },
  });
}

export function usePendingTransfersForBar(barId: string) {
  return useQuery({
    queryKey: barsKeys.pendingTransfers(barId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bar_to_bar_transfers')
        .select(`
          *,
          source_bar:bars!source_bar_id(id, name),
          destination_bar:bars!destination_bar_id(id, name),
          inventory_item:inventory_items(id, name, unit)
        `)
        .eq('destination_bar_id', barId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as BarToBarTransfer[];
    },
    enabled: !!barId,
  });
}

export function useCreateBarToBarTransfer() {
  const queryClient = useQueryClient();
  
  return useMutation({
      mutationFn: async ({
        sourceBarId,
        destinationBarId,
        inventoryItemId,
        quantity,
        notes,
        isAdminTransfer,
      }: {
        sourceBarId: string;
        destinationBarId: string;
        inventoryItemId: string;
        quantity: number;
        notes?: string;
        isAdminTransfer?: boolean;
      }) => {
        // IMPORTANT: Do inventory updates server-side (RPC) so cashiers don't need UPDATE permission on bar_inventory
        const { data, error } = await supabase.rpc('create_bar_to_bar_transfer', {
          p_source_bar_id: sourceBarId,
          p_destination_bar_id: destinationBarId,
          p_inventory_item_id: inventoryItemId,
          p_quantity: quantity,
          p_notes: notes ?? null,
          p_admin_complete: !!isAdminTransfer,
        });

        if (error) throw error;
        return data as unknown as {
          success: boolean;
          transfer_id: string;
          status: string;
          source_bar_id: string;
          destination_bar_id: string;
        };
      },
    onSuccess: (result, variables) => {
      // Invalidate all bar-related queries to refresh inventory
      queryClient.invalidateQueries({ queryKey: barsKeys.all });
      queryClient.invalidateQueries({ queryKey: barsKeys.inventory(variables.sourceBarId) });
      queryClient.invalidateQueries({ queryKey: barsKeys.inventory(variables.destinationBarId) });
      queryClient.invalidateQueries({ queryKey: barsKeys.barToBarTransfers() });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      
      toast.success(
        variables.isAdminTransfer 
          ? 'Transfer completed successfully' 
          : 'Transfer sent! Items deducted from your inventory. Awaiting acceptance.'
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create transfer');
    },
  });
}

export function useRespondToTransfer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      transferId,
      response,
    }: {
      transferId: string;
      response: 'accepted' | 'rejected';
    }) => {
      // IMPORTANT: perform inventory updates server-side (RPC)
      const { data, error } = await supabase.rpc('respond_bar_to_bar_transfer', {
        p_transfer_id: transferId,
        p_response: response,
      });

      if (error) throw error;
      return data as unknown as {
        success: boolean;
        transfer_id: string;
        status: string;
        source_bar_id: string;
        destination_bar_id: string;
        inventory_item_id: string;
      };
    },
    onSuccess: (result, variables) => {
      // Invalidate queries so both bars refresh inventory
      queryClient.invalidateQueries({ queryKey: barsKeys.all });
      queryClient.invalidateQueries({ queryKey: barsKeys.barToBarTransfers() });
      if (result?.source_bar_id) {
        queryClient.invalidateQueries({ queryKey: barsKeys.inventory(result.source_bar_id) });
      }
      if (result?.destination_bar_id) {
        queryClient.invalidateQueries({ queryKey: barsKeys.inventory(result.destination_bar_id) });
      }
      queryClient.invalidateQueries({ queryKey: ['inventory'] });

      toast.success(
        variables.response === 'accepted'
          ? "Transfer accepted! Items added to your inventory."
          : "Transfer rejected. Items returned to sender."
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to respond to transfer');
    },
  });
}

// Check bar stock for a menu item
export function useCheckBarStock() {
  return useMutation({
    mutationFn: async ({
      barId,
      inventoryItemId,
      quantity,
    }: {
      barId: string;
      inventoryItemId: string;
      quantity: number;
    }) => {
      const { data, error } = await supabase.rpc('check_bar_stock', {
        p_bar_id: barId,
        p_inventory_item_id: inventoryItemId,
        p_quantity: quantity,
      });
      
      if (error) throw error;
      return data as boolean;
    },
  });
}
