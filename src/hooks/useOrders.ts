import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type Order = Tables<'orders'>;
export type OrderItem = Tables<'order_items'>;
export type Payment = Tables<'payments'>;

export interface OrderFilters {
  status?: string;
  orderType?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateOrderData {
  order_type: string;
  table_number?: string | null;
  notes?: string | null;
  subtotal: number;
  vat_amount: number;
  service_charge: number;
  discount_amount: number;
  total_amount: number;
  bar_id?: string | null;
  items: Array<{
    menu_item_id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    notes?: string | null;
  }>;
  payment?: {
    amount: number;
    payment_method: string;
    reference?: string | null;
  };
}

// Query keys
export const ordersKeys = {
  all: ['orders'] as const,
  list: (filters?: OrderFilters) => [...ordersKeys.all, 'list', filters] as const,
  detail: (id: string) => [...ordersKeys.all, 'detail', id] as const,
  items: (orderId: string) => [...ordersKeys.all, 'items', orderId] as const,
  payments: (orderId: string) => [...ordersKeys.all, 'payments', orderId] as const,
  kitchenQueue: () => [...ordersKeys.all, 'queue', 'kitchen'] as const,
  barQueue: () => [...ordersKeys.all, 'queue', 'bar'] as const,
  dailySummary: (date?: string) => [...ordersKeys.all, 'summary', 'daily', date] as const,
};

// Orders hooks
export function useOrders(filters?: OrderFilters) {
  return useQuery({
    queryKey: ordersKeys.list(filters),
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.orderType) {
        query = query.eq('order_type', filters.orderType);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ordersKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*), payments(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useOrderItems(orderId: string) {
  return useQuery({
    queryKey: ordersKeys.items(orderId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });
}

export function useOrderPayments(orderId: string) {
  return useQuery({
    queryKey: ordersKeys.payments(orderId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', orderId);
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });
}

export function useKitchenQueue() {
  return useQuery({
    queryKey: ordersKeys.kitchenQueue(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('status', ['pending', 'preparing'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });
}

export function useBarQueue() {
  return useQuery({
    queryKey: ordersKeys.barQueue(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('status', ['pending', 'preparing'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });
}

export function useDailySummary(date?: string) {
  return useQuery({
    queryKey: ordersKeys.dailySummary(date),
    queryFn: async () => {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const startOfDay = `${targetDate}T00:00:00`;
      const endOfDay = `${targetDate}T23:59:59`;
      
      const { data, error } = await supabase
        .from('orders')
        .select('*, payments(*)')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);
      
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateOrderData) => {
      // Generate order number
      const { data: orderNumber, error: orderNumError } = await supabase
        .rpc('generate_order_number');
      if (orderNumError) throw orderNumError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          order_type: data.order_type,
          table_number: data.table_number,
          notes: data.notes,
          subtotal: data.subtotal,
          vat_amount: data.vat_amount,
          service_charge: data.service_charge,
          discount_amount: data.discount_amount,
          total_amount: data.total_amount,
          bar_id: data.bar_id,
          status: 'pending',
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (orderError) throw orderError;

      // Insert order items
      const orderItems = data.items.map(item => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        notes: item.notes,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);
      
      if (itemsError) throw itemsError;

      // Add payment if provided
      if (data.payment) {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            order_id: order.id,
            amount: data.payment.amount,
            payment_method: data.payment.payment_method,
            reference: data.payment.reference,
            status: 'completed',
            created_by: user?.id,
          });
        
        if (paymentError) throw paymentError;

        // Update order status to completed
        await supabase
          .from('orders')
          .update({ status: 'completed' })
          .eq('id', order.id);
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
      toast.success('Order created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create order');
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status, restoreInventory }: { id: string; status: string; restoreInventory?: boolean }) => {
      // If voiding an order and restoreInventory is true, restore bar inventory
      if (status === 'cancelled' && restoreInventory) {
        // Fetch order with items and bar_id
        const { data: order, error: orderFetchError } = await supabase
          .from('orders')
          .select('*, order_items(*, menu_items(inventory_item_id, track_inventory))')
          .eq('id', id)
          .single();
        
        if (orderFetchError) throw orderFetchError;
        
        if (order?.bar_id && order.order_items) {
          const { data: { user } } = await supabase.auth.getUser();
          
          // Restore inventory for each item
          for (const item of order.order_items) {
            const menuItem = item.menu_items;
            if (menuItem?.track_inventory && menuItem.inventory_item_id) {
              // Check if bar_inventory record exists
              const { data: existingStock } = await supabase
                .from('bar_inventory')
                .select('current_stock')
                .eq('bar_id', order.bar_id)
                .eq('inventory_item_id', menuItem.inventory_item_id)
                .maybeSingle();
              
              if (existingStock) {
                // Increment existing stock
                await supabase
                  .from('bar_inventory')
                  .update({ 
                    current_stock: existingStock.current_stock + item.quantity,
                    updated_at: new Date().toISOString()
                  })
                  .eq('bar_id', order.bar_id)
                  .eq('inventory_item_id', menuItem.inventory_item_id);
              } else {
                // Create new bar inventory record
                await supabase
                  .from('bar_inventory')
                  .insert({
                    bar_id: order.bar_id,
                    inventory_item_id: menuItem.inventory_item_id,
                    current_stock: item.quantity,
                    min_stock_level: 5,
                  });
              }
              
              // Create transfer record for audit
              await supabase.from('inventory_transfers').insert({
                source_type: 'void_return',
                destination_bar_id: order.bar_id,
                inventory_item_id: menuItem.inventory_item_id,
                quantity: item.quantity,
                status: 'completed',
                notes: `Order Void Return - ${order.order_number}`,
                transferred_by: user?.id,
                completed_at: new Date().toISOString(),
              });
            }
          }
        }
      }
      
      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
      queryClient.invalidateQueries({ queryKey: ['bars'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Order status updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update order status');
    },
  });
}

export function useAddPayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ orderId, payment }: { 
      orderId: string; 
      payment: { amount: number; payment_method: string; reference?: string | null; status?: string } 
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('payments')
        .insert({
          order_id: orderId,
          amount: payment.amount,
          payment_method: payment.payment_method,
          reference: payment.reference ?? null,
          status: payment.status ?? 'completed',
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ordersKeys.payments(orderId) });
      queryClient.invalidateQueries({ queryKey: ordersKeys.detail(orderId) });
      toast.success('Payment added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add payment');
    },
  });
}
