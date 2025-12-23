import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Search, Printer, Eye, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(price);
};

const orderTypeLabels: Record<string, string> = {
  dine_in: "Dine In",
  takeaway: "Takeaway",
  delivery: "Delivery",
  bar_only: "Bar Only",
};

const paymentLabels: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
  mobile_money: "Mobile Money",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  preparing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  ready: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
}

interface Order {
  id: string;
  order_number: string;
  order_type: string;
  table_number: string | null;
  status: string;
  subtotal: number;
  total_amount: number;
  created_at: string;
  order_items: OrderItem[];
  payments: { payment_method: string }[];
}

const OrderHistory = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["order-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items(*),
          payments(payment_method)
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as Order[];
    },
  });

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.table_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_type.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleViewReceipt = (order: Order) => {
    setSelectedOrder(order);
    setShowReceiptDialog(true);
  };

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent || !selectedOrder) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${selectedOrder.order_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Courier New', Courier, monospace;
              padding: 10px;
              max-width: 80mm;
              margin: 0 auto;
            }
            .receipt { font-size: 12px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .text-xl { font-size: 18px; }
            .text-xs { font-size: 11px; }
            .my-3 { margin: 10px 0; }
            .mt-2 { margin-top: 8px; }
            .space-y-1 > * + * { margin-top: 4px; }
            .flex { display: flex; justify-content: space-between; }
            .border-dashed { border-top: 1px dashed #999; }
            .border-solid { border-top: 1px solid #333; }
            .gray { color: #666; }
            .pl-4 { padding-left: 16px; }
            .reprint-notice { 
              text-align: center; 
              font-weight: bold; 
              margin-bottom: 10px;
              padding: 5px;
              border: 1px dashed #333;
            }
            @media print {
              body { width: 80mm; }
            }
          </style>
        </head>
        <body>
          <div class="reprint-notice">*** REPRINT ***</div>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Order History</h1>
            <p className="text-sm text-muted-foreground">
              Search and reprint past order receipts
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order number, table, or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">
            Orders ({filteredOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading orders...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No orders found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(order.created_at), "dd/MM/yyyy")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), "HH:mm")}
                        </div>
                      </TableCell>
                      <TableCell>
                        {orderTypeLabels[order.order_type] || order.order_type}
                      </TableCell>
                      <TableCell>{order.table_number || "-"}</TableCell>
                      <TableCell>{order.order_items?.length || 0}</TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(order.total_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColors[order.status] || ""}
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewReceipt(order)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowReceiptDialog(true);
                            }}
                          >
                            <Printer className="h-4 w-4 mr-1" />
                            Reprint
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">
              Receipt - {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Receipt Preview */}
            <div className="flex justify-center bg-muted/50 rounded-lg p-4 overflow-auto max-h-[400px]">
              {selectedOrder && (
                <div
                  ref={receiptRef}
                  className="bg-white text-black p-6 w-[300px] font-mono text-sm"
                  style={{ fontFamily: "'Courier New', Courier, monospace" }}
                >
                  {/* Header */}
                  <div className="text-center mb-4">
                    <h1 className="text-xl font-bold">CHERRY DINING</h1>
                    <p className="text-xs">& Lounge</p>
                    <p className="text-xs mt-2">123 Restaurant Street</p>
                    <p className="text-xs">Lagos, Nigeria</p>
                    <p className="text-xs">Tel: +234 800 000 0000</p>
                  </div>

                  <div className="border-t border-dashed border-gray-400 my-3" />

                  {/* Order Info */}
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Order #:</span>
                      <span className="font-bold">{selectedOrder.order_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span>
                        {format(new Date(selectedOrder.created_at), "dd/MM/yyyy")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Time:</span>
                      <span>
                        {format(new Date(selectedOrder.created_at), "HH:mm:ss")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span>
                        {orderTypeLabels[selectedOrder.order_type] ||
                          selectedOrder.order_type}
                      </span>
                    </div>
                    {selectedOrder.table_number && (
                      <div className="flex justify-between">
                        <span>Table:</span>
                        <span>{selectedOrder.table_number}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-dashed border-gray-400 my-3" />

                  {/* Items */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span>ITEM</span>
                      <span>AMOUNT</span>
                    </div>
                    {selectedOrder.order_items?.map((item) => (
                      <div key={item.id} className="text-xs">
                        <div className="flex justify-between">
                          <span className="flex-1 truncate pr-2">
                            {item.quantity}x {item.item_name}
                          </span>
                          <span>₦{item.total_price.toLocaleString()}</span>
                        </div>
                        {item.notes && (
                          <p className="text-[10px] text-gray-600 pl-4">
                            Note: {item.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-dashed border-gray-400 my-3" />

                  {/* Totals */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₦{selectedOrder.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-gray-400 my-2" />
                    <div className="flex justify-between font-bold text-base">
                      <span>TOTAL:</span>
                      <span>₦{selectedOrder.total_amount.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray-400 my-3" />

                  {/* Payment */}
                  <div className="text-xs">
                    <div className="flex justify-between">
                      <span>Payment Method:</span>
                      <span className="font-bold">
                        {paymentLabels[selectedOrder.payments?.[0]?.payment_method] ||
                          selectedOrder.payments?.[0]?.payment_method ||
                          "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span>Status:</span>
                      <span className="font-bold">
                        {selectedOrder.status === "completed" ||
                        selectedOrder.payments?.length > 0
                          ? "PAID"
                          : "UNPAID"}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray-400 my-3" />

                  {/* Footer */}
                  <div className="text-center text-xs space-y-2">
                    <p className="font-bold">Thank you for dining with us!</p>
                    <p>We hope to see you again soon.</p>
                    <p className="text-[10px] text-gray-500 mt-4">
                      This receipt serves as proof of payment
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowReceiptDialog(false)}
              >
                Close
              </Button>
              <Button className="flex-1" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Reprint Receipt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderHistory;
