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
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";

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

  const handleUpdateStatus = async (orderId: string, status: OrderStatus, reason?: string, restoreInventory?: boolean) => {
    // Create audit log for corrections/cancellations
    if (reason && selectedOrder) {
      try {
        await supabase.from('audit_logs').insert({
          action_type: status === 'cancelled' ? 'void' : 'correction',
          entity_type: 'order',
          entity_id: orderId,
          original_data: { status: selectedOrder.status, order_number: selectedOrder.order_number },
          new_data: { status, reason, inventory_restored: restoreInventory },
          reason,
        });
      } catch (e) {
        console.error('Failed to create audit log:', e);
      }
    }

    updateStatusMutation.mutate(
      { id: orderId, status, restoreInventory },
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

  const formatPrice = (price: number) => new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", minimumFractionDigits: 0
  }).format(price);

  const handleExportPDF = () => {
    const data = orders.map((o) => ({
      "Order #": o.order_number,
      Type: o.order_type,
      Items: o.order_items?.length || 0,
      Total: formatPrice(Number(o.total_amount)),
      Status: o.status,
      Time: o.created_at ? format(new Date(o.created_at), "MMM dd HH:mm") : "-"
    }));
    exportToPDF(data, "Orders", "orders");
  };

  const handleExportExcel = () => {
    const data = orders.map((o) => ({
      order_number: o.order_number, type: o.order_type,
      items: o.order_items?.length || 0, total: o.total_amount,
      status: o.status, date: o.created_at ? format(new Date(o.created_at), "yyyy-MM-dd HH:mm") : ""
    }));
    exportToExcel("orders", data, [
      { key: "order_number", header: "Order #" }, { key: "date", header: "Date" },
      { key: "type", header: "Type" }, { key: "items", header: "Items" },
      { key: "total", header: "Total" }, { key: "status", header: "Status" }
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <OrdersHeader
          activeCount={activeOrders.length}
          completedCount={completedOrders.length}
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileDown className="h-4 w-4 mr-2" />PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />Excel
          </Button>
        </div>
      </div>

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
        onUpdateStatus={(status, reason, restoreInventory) =>
          selectedOrder && handleUpdateStatus(selectedOrder.id, status, reason, restoreInventory)
        }
        isUpdating={updateStatusMutation.isPending}
        userRole={role}
      />
    </div>
  );
};

export default Orders;
