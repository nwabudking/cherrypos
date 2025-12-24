import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon, Receipt, Users, CreditCard, Banknote, Smartphone, Building } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(price);
};

const paymentIcons: Record<string, React.ElementType> = {
  cash: Banknote,
  card: CreditCard,
  bank_transfer: Building,
  mobile_money: Smartphone,
};

const paymentLabels: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
  mobile_money: "Mobile Money",
};

interface OrderWithDetails {
  id: string;
  order_number: string;
  order_type: string;
  total_amount: number;
  created_at: string;
  created_by: string | null;
  order_items: { item_name: string; quantity: number; total_price: number }[];
  payments: { payment_method: string; amount: number }[];
}

interface CashierProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

const EODReport = () => {
  const { user, role } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedCashier, setSelectedCashier] = useState<string>("all");
  
  const isManager = role === "super_admin" || role === "manager";

  // Fetch all cashiers (for managers)
  const { data: cashiers = [] } = useQuery({
    queryKey: ["cashiers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email");
      if (error) throw error;
      return data as CashierProfile[];
    },
    enabled: isManager,
  });

  // Fetch orders for the selected date
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["eod-orders", selectedDate, selectedCashier],
    queryFn: async () => {
      const start = startOfDay(selectedDate).toISOString();
      const end = endOfDay(selectedDate).toISOString();
      
      let query = supabase
        .from("orders")
        .select(`
          id, order_number, order_type, total_amount, created_at, created_by,
          order_items(item_name, quantity, total_price),
          payments(payment_method, amount)
        `)
        .gte("created_at", start)
        .lte("created_at", end)
        .eq("status", "completed")
        .order("created_at", { ascending: true });

      // Filter by cashier
      if (selectedCashier !== "all") {
        query = query.eq("created_by", selectedCashier);
      } else if (!isManager) {
        // Non-managers can only see their own
        query = query.eq("created_by", user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as OrderWithDetails[];
    },
  });

  // Calculate summary statistics
  const summary = {
    totalSales: orders.reduce((sum, o) => sum + o.total_amount, 0),
    transactionCount: orders.length,
    paymentBreakdown: orders.reduce((acc, order) => {
      order.payments.forEach((p) => {
        acc[p.payment_method] = (acc[p.payment_method] || 0) + p.amount;
      });
      return acc;
    }, {} as Record<string, number>),
    itemsSold: orders.reduce(
      (sum, o) => sum + o.order_items.reduce((s, i) => s + i.quantity, 0),
      0
    ),
  };

  const getCashierName = (id: string | null) => {
    if (!id) return "Unknown";
    const cashier = cashiers.find((c) => c.id === id);
    return cashier?.full_name || cashier?.email || "Unknown";
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Receipt className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">End of Day Report</h1>
            <p className="text-sm text-muted-foreground">
              Daily sales summary and transaction details
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[200px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "dd MMM yyyy") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Cashier Filter (managers only) */}
          {isManager && (
            <Select value={selectedCashier} onValueChange={setSelectedCashier}>
              <SelectTrigger className="w-[200px]">
                <Users className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Cashiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cashiers</SelectItem>
                {cashiers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name || c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-primary">
                {formatPrice(summary.totalSales)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold">{summary.transactionCount}</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Items Sold
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold">{summary.itemsSold}</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Order Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold">
                {summary.transactionCount > 0
                  ? formatPrice(summary.totalSales / summary.transactionCount)
                  : formatPrice(0)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Breakdown */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Payment Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-40" />
              ))}
            </div>
          ) : Object.keys(summary.paymentBreakdown).length === 0 ? (
            <p className="text-muted-foreground">No payments recorded</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {Object.entries(summary.paymentBreakdown).map(([method, amount]) => {
                const Icon = paymentIcons[method] || CreditCard;
                return (
                  <div
                    key={method}
                    className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {paymentLabels[method] || method}
                      </p>
                      <p className="font-bold">{formatPrice(amount)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">
            Transactions ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No completed transactions for this date
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Payment</TableHead>
                    {isManager && <TableHead>Cashier</TableHead>}
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell>
                        {format(new Date(order.created_at), "HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {order.order_type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          {order.order_items.slice(0, 2).map((item, i) => (
                            <span key={i} className="text-sm">
                              {item.quantity}x {item.item_name}
                              {i < Math.min(order.order_items.length, 2) - 1 && ", "}
                            </span>
                          ))}
                          {order.order_items.length > 2 && (
                            <span className="text-sm text-muted-foreground">
                              {" "}+{order.order_items.length - 2} more
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.payments.map((p) => paymentLabels[p.payment_method] || p.payment_method).join(", ")}
                      </TableCell>
                      {isManager && (
                        <TableCell>{getCashierName(order.created_by)}</TableCell>
                      )}
                      <TableCell className="text-right font-medium">
                        {formatPrice(order.total_amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EODReport;
