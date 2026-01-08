import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useOrders, useUpdateOrderStatus, Order, OrderItem } from "@/hooks/useOrders";
import { supabase } from "@/integrations/supabase/client";
import { OrdersHeader } from "@/components/orders/OrdersHeader";
import { OrdersFilters } from "@/components/orders/OrdersFilters";
import { OrdersTable } from "@/components/orders/OrdersTable";
import { OrderDetailsDialog } from "@/components/orders/OrderDetailsDialog";

export type OrderWithItems = Order & {
  order_items?: OrderItem[];
  payments?: Array<{
    id: string;
    amount: number;
    payment_method: string;
    status: string;
  }>;
};

export type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

const Orders = () => {
  const { toast } = useToast();
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);

  const { data: orders = [], isLoading } = useOrders({
    status: statusFilter !== "all" ? statusFilter : undefined,
    orderType: orderTypeFilter !== "all" ? orderTypeFilter : undefined,
    startDate: dateFilter
      ? new Date(dateFilter.setHours(0, 0, 0, 0)).toISOString()
      : undefined,
    endDate: dateFilter
      ? new Date(dateFilter.setHours(23, 59, 59, 999)).toISOString()
      : undefined,
  });

  const updateStatusMutation = useUpdateOrderStatus();

  const handleUpdateStatus = async (orderId: string, status: OrderStatus, reason?: string) => {
    // Create audit log for corrections/cancellations
    if (reason && selectedOrder) {
      try {
        await supabase.from('audit_logs').insert({
          action_type: status === 'cancelled' ? 'void' : 'correction',
          entity_type: 'order',
          entity_id: orderId,
          original_data: { status: selectedOrder.status, order_number: selectedOrder.order_number },
          new_data: { status, reason },
          reason,
        });
      } catch (e) {
        console.error('Failed to create audit log:', e);
      }
    }

    updateStatusMutation.mutate(
      { id: orderId, status },
      {
        onSuccess: () => {
          setSelectedOrder(null);
        },
      }
    );
  };

  const activeOrders = orders.filter((o) =>
    ["pending", "preparing", "ready"].includes(o.status)
  );

  const completedOrders = orders.filter((o) =>
    ["completed", "cancelled"].includes(o.status)
  );

  return (
    <div className="space-y-6">
      <OrdersHeader
        activeCount={activeOrders.length}
        completedCount={completedOrders.length}
      />

      <OrdersFilters
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        orderTypeFilter={orderTypeFilter}
        setOrderTypeFilter={setOrderTypeFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
      />

      <OrdersTable
        orders={orders as OrderWithItems[]}
        isLoading={isLoading}
        onViewOrder={setSelectedOrder}
        onUpdateStatus={(orderId, status) => handleUpdateStatus(orderId, status)}
      />

      <OrderDetailsDialog
        order={selectedOrder}
        open={!!selectedOrder}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
        onUpdateStatus={(status, reason) =>
          selectedOrder && handleUpdateStatus(selectedOrder.id, status, reason)
        }
        isUpdating={updateStatusMutation.isPending}
        userRole={role}
      />
    </div>
  );
};

export default Orders;
