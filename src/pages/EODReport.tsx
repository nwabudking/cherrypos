import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon, Receipt, Users, CreditCard, Banknote, Smartphone, Building, Store, FileDown, Eye, X } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useBars } from "@/hooks/useBars";
import { exportTableToPDF, exportTableToExcel } from "@/lib/exportUtils";

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
  staff_user_id: string | null;
  bar_id: string | null;
  status: string;
  subtotal: number;
  vat_amount: number;
  service_charge: number;
  discount_amount: number;
  table_number: string | null;
  notes: string | null;
  order_items: { item_name: string; quantity: number; total_price: number; unit_price: number }[];
  payments: { payment_method: string; amount: number; reference: string | null }[];
}

interface CashierProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  source: "auth" | "staff";
}

const EODReport = () => {
  const { user, role } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedCashier, setSelectedCashier] = useState<string>("all");
  const [selectedBar, setSelectedBar] = useState<string>("all");
  const [viewingOrder, setViewingOrder] = useState<OrderWithDetails | null>(null);
  
  const isManager = role === "super_admin" || role === "manager";

  const { data: bars = [] } = useBars();

  // Fetch all cashiers from both profiles (Supabase auth) and staff_users (local staff)
  const { data: cashiers = [] } = useQuery({
    queryKey: ["cashiers-list-all"],
    queryFn: async () => {
      const [profilesRes, staffRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("staff_users").select("id, full_name, email"),
      ]);

      const authUsers: CashierProfile[] = (profilesRes.data || []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        source: "auth" as const,
      }));

      const staffUsers: CashierProfile[] = (staffRes.data || []).map((s) => ({
        id: s.id,
        full_name: s.full_name,
        email: s.email,
        source: "staff" as const,
      }));

      return [...staffUsers, ...authUsers];
    },
    enabled: isManager,
  });

  // Fetch orders for the selected date
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["eod-orders", selectedDate, selectedCashier, selectedBar],
    queryFn: async () => {
      const start = startOfDay(selectedDate).toISOString();
      const end = endOfDay(selectedDate).toISOString();
      
      let query = supabase
        .from("orders")
        .select(`
          id, order_number, order_type, total_amount, created_at, created_by, staff_user_id, bar_id,
          status, subtotal, vat_amount, service_charge, discount_amount, table_number, notes,
          order_items(item_name, quantity, total_price, unit_price),
          payments(payment_method, amount, reference)
        `)
        .gte("created_at", start)
        .lte("created_at", end)
        .eq("status", "completed")
        .order("created_at", { ascending: true });

      // Filter by bar
      if (selectedBar !== "all") {
        query = query.eq("bar_id", selectedBar);
      }

      // Non-managers can only see their own
      if (!isManager) {
        query = query.eq("created_by", user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      let result = data as OrderWithDetails[];

      // Filter by selected cashier (check both created_by and staff_user_id)
      if (selectedCashier !== "all") {
        result = result.filter(
          (o) => o.created_by === selectedCashier || o.staff_user_id === selectedCashier
        );
      }

      return result;
    },
  });

  // Helper to get effective staff identifier for an order
  const getOrderStaffId = (order: OrderWithDetails): string => {
    return order.staff_user_id || order.created_by || "unknown";
  };

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
    barBreakdown: orders.reduce((acc, order) => {
      const barId = order.bar_id || "no-bar";
      if (!acc[barId]) {
        acc[barId] = { sales: 0, orders: 0, items: 0 };
      }
      acc[barId].sales += order.total_amount;
      acc[barId].orders += 1;
      acc[barId].items += order.order_items.reduce((s, i) => s + i.quantity, 0);
      return acc;
    }, {} as Record<string, { sales: number; orders: number; items: number }>),
    cashierBreakdown: orders.reduce((acc, order) => {
      const cashierId = getOrderStaffId(order);
      if (!acc[cashierId]) {
        acc[cashierId] = { sales: 0, orders: 0, items: 0 };
      }
      acc[cashierId].sales += order.total_amount;
      acc[cashierId].orders += 1;
      acc[cashierId].items += order.order_items.reduce((s, i) => s + i.quantity, 0);
      return acc;
    }, {} as Record<string, { sales: number; orders: number; items: number }>),
  };

  const getCashierName = (id: string | null) => {
    if (!id) return null;
    const cashier = cashiers.find((c) => c.id === id);
    if (!cashier) return null;
    return cashier.full_name || cashier.email || null;
  };

  const getOrderStaffName = (order: OrderWithDetails) => {
    // Prefer staff_user_id (local staff), fall back to created_by (auth user)
    if (order.staff_user_id) {
      const name = getCashierName(order.staff_user_id);
      if (name) return name;
    }
    if (order.created_by) {
      const name = getCashierName(order.created_by);
      if (name) return name;
    }
    return "Unattributed";
  };

  const getBarName = (barId: string | null) => {
    if (!barId || barId === "no-bar") return "N/A";
    const bar = bars.find(b => b.id === barId);
    return bar?.name || "Unknown";
  };

  const getBarBreakdownRows = () => {
    return Object.entries(summary.barBreakdown)
      .filter(([barId]) => barId !== "no-bar" || Object.keys(summary.barBreakdown).length === 1)
      .sort(([, a], [, b]) => b.sales - a.sales)
      .map(([barId, data]) => ({
        name: getBarName(barId),
        orders: data.orders,
        items: data.items,
        sales: data.sales,
        avg: data.orders > 0 ? data.sales / data.orders : 0,
      }));
  };

  const getCashierBreakdownRows = () => {
    return Object.entries(summary.cashierBreakdown)
      .sort(([, a], [, b]) => b.sales - a.sales)
      .map(([cashierId, data]) => ({
        name: cashierId === "unknown" ? "Unattributed" : (getCashierName(cashierId) || "Unattributed"),
        orders: data.orders,
        items: data.items,
        sales: data.sales,
        avg: data.orders > 0 ? data.sales / data.orders : 0,
      }));
  };

  const handleExportPDF = () => {
    const headers = ["Order #", "Time", "Type", "Bar", "Staff", "Items", "Payment", "Amount"];
    const rows = orders.map(order => [
      order.order_number,
      format(new Date(order.created_at), "HH:mm"),
      order.order_type.replace("_", " "),
      getBarName(order.bar_id),
      getOrderStaffName(order),
      order.order_items.length.toString(),
      order.payments.map(p => paymentLabels[p.payment_method] || p.payment_method).join(", "),
      formatPrice(order.total_amount),
    ]);

    const barBreakdownRows = getBarBreakdownRows();
    const barBreakdownHTML = barBreakdownRows.length > 0 ? `
      <h2 style="margin-top: 40px;">Sales by Bar</h2>
      <table>
        <thead><tr><th>Bar</th><th>Orders</th><th>Items Sold</th><th>Total Sales</th><th>Avg. Order</th></tr></thead>
        <tbody>
          ${barBreakdownRows.map(r => `<tr><td>${r.name}</td><td>${r.orders}</td><td>${r.items}</td><td>${formatPrice(r.sales)}</td><td>${formatPrice(r.avg)}</td></tr>`).join('')}
          <tr style="border-top: 2px solid #333; font-weight: bold;"><td>Total</td><td>${summary.transactionCount}</td><td>${summary.itemsSold}</td><td>${formatPrice(summary.totalSales)}</td><td>${formatPrice(summary.transactionCount > 0 ? summary.totalSales / summary.transactionCount : 0)}</td></tr>
        </tbody>
      </table>
    ` : '';

    const breakdownRows = getCashierBreakdownRows();
    const breakdownHTML = breakdownRows.length > 0 ? `
      <h2 style="margin-top: 40px;">Sales by Staff Member</h2>
      <table>
        <thead><tr><th>Staff Member</th><th>Orders</th><th>Items Sold</th><th>Total Sales</th><th>Avg. Order</th></tr></thead>
        <tbody>
          ${breakdownRows.map(r => `<tr><td>${r.name}</td><td>${r.orders}</td><td>${r.items}</td><td>${formatPrice(r.sales)}</td><td>${formatPrice(r.avg)}</td></tr>`).join('')}
          <tr style="border-top: 2px solid #333; font-weight: bold;"><td>Total</td><td>${summary.transactionCount}</td><td>${summary.itemsSold}</td><td>${formatPrice(summary.totalSales)}</td><td>${formatPrice(summary.transactionCount > 0 ? summary.totalSales / summary.transactionCount : 0)}</td></tr>
        </tbody>
      </table>
    ` : '';

    const title = `EOD Report - ${format(selectedDate, "dd MMM yyyy")}`;
    const orderTableHTML = `
      <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? '-'}</td>`).join('')}</tr>`).join('')}</tbody></table>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 40px; max-width: 1200px; margin: 0 auto; }
        h1 { font-size: 24px; margin-bottom: 10px; } h2 { font-size: 18px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #f5f5f5; font-weight: 600; }
        tr:nth-child(even) { background-color: #fafafa; }
      </style></head><body>
      <h1>${title}</h1><p>Generated: ${new Date().toLocaleString()}</p>
      <h2>Orders</h2>${orderTableHTML}${barBreakdownHTML}${breakdownHTML}
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const handleExportExcel = () => {
    const headers = ["Order #", "Time", "Type", "Bar", "Staff", "Items", "Payment", "Amount"];
    const rows: any[][] = orders.map(order => [
      order.order_number,
      format(new Date(order.created_at), "HH:mm"),
      order.order_type.replace("_", " "),
      getBarName(order.bar_id),
      getOrderStaffName(order),
      order.order_items.length,
      order.payments.map(p => paymentLabels[p.payment_method] || p.payment_method).join(", "),
      order.total_amount,
    ]);

    // Add bar breakdown
    const barRows = getBarBreakdownRows();
    if (barRows.length > 0) {
      rows.push(Array(headers.length).fill(""));
      rows.push(["Sales by Bar", "", "", "", "", "", "", ""]);
      rows.push(["Bar", "Orders", "Items Sold", "Total Sales", "Avg. Order", "", "", ""]);
      barRows.forEach(r => {
        rows.push([r.name, r.orders, r.items, r.sales, Math.round(r.avg), "", "", ""]);
      });
      rows.push(["Total", summary.transactionCount, summary.itemsSold, summary.totalSales, Math.round(summary.transactionCount > 0 ? summary.totalSales / summary.transactionCount : 0), "", "", ""]);
    }

    // Add cashier breakdown
    const breakdownRows = getCashierBreakdownRows();
    if (breakdownRows.length > 0) {
      rows.push(Array(headers.length).fill(""));
      rows.push(["Sales by Staff Member", "", "", "", "", "", "", ""]);
      rows.push(["Staff Member", "Orders", "Items Sold", "Total Sales", "Avg. Order", "", "", ""]);
      breakdownRows.forEach(r => {
        rows.push([r.name, r.orders, r.items, r.sales, Math.round(r.avg), "", "", ""]);
      });
      rows.push(["Total", summary.transactionCount, summary.itemsSold, summary.totalSales, Math.round(summary.transactionCount > 0 ? summary.totalSales / summary.transactionCount : 0), "", "", ""]);
    }

    exportTableToExcel(`EOD_Report_${format(selectedDate, "yyyy-MM-dd")}`, headers, rows);
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
          {/* Export Buttons */}
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileDown className="h-4 w-4 mr-2" />
            Excel
          </Button>

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

          {/* Bar Filter (managers only) */}
          {isManager && (
            <Select value={selectedBar} onValueChange={setSelectedBar}>
              <SelectTrigger className="w-[180px]">
                <Store className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Bars" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bars</SelectItem>
                {bars.map((bar) => (
                  <SelectItem key={bar.id} value={bar.id}>
                    {bar.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Cashier Filter (managers only) */}
          {isManager && (
            <Select value={selectedCashier} onValueChange={setSelectedCashier}>
              <SelectTrigger className="w-[200px]">
                <Users className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Cashiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {cashiers.map((c) => (
                  <SelectItem key={`${c.source}-${c.id}`} value={c.id}>
                    {c.full_name || c.email || "Unknown"}{c.source === "staff" ? " (Staff)" : ""}
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

      {/* Bar Breakdown (for managers) */}
      {isManager && Object.keys(summary.barBreakdown).length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Store className="h-5 w-5" />
              Sales by Bar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bar</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Items Sold</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                    <TableHead className="text-right">Avg. Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(summary.barBreakdown)
                    .sort(([, a], [, b]) => b.sales - a.sales)
                    .map(([barId, data]) => (
                      <TableRow key={barId}>
                        <TableCell className="font-medium">
                          {getBarName(barId)}
                        </TableCell>
                        <TableCell className="text-right">{data.orders}</TableCell>
                        <TableCell className="text-right">{data.items}</TableCell>
                        <TableCell className="text-right font-bold">
                          {formatPrice(data.sales)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatPrice(data.orders > 0 ? data.sales / data.orders : 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  <TableRow className="border-t-2">
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">{summary.transactionCount}</TableCell>
                    <TableCell className="text-right font-bold">{summary.itemsSold}</TableCell>
                    <TableCell className="text-right font-bold">{formatPrice(summary.totalSales)}</TableCell>
                    <TableCell className="text-right font-bold text-muted-foreground">
                      {formatPrice(summary.transactionCount > 0 ? summary.totalSales / summary.transactionCount : 0)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Cashier Sales Breakdown */}
      {isManager && Object.keys(summary.cashierBreakdown).length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Sales by Staff Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Items Sold</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                    <TableHead className="text-right">Avg. Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(summary.cashierBreakdown)
                    .sort(([, a], [, b]) => b.sales - a.sales)
                    .map(([cashierId, data]) => (
                      <TableRow key={cashierId}>
                        <TableCell className="font-medium">
                          {cashierId === "unknown" ? "Unattributed" : (getCashierName(cashierId) || "Unattributed")}
                        </TableCell>
                        <TableCell className="text-right">{data.orders}</TableCell>
                        <TableCell className="text-right">{data.items}</TableCell>
                        <TableCell className="text-right font-bold">
                          {formatPrice(data.sales)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatPrice(data.orders > 0 ? data.sales / data.orders : 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  <TableRow className="border-t-2">
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">{summary.transactionCount}</TableCell>
                    <TableCell className="text-right font-bold">{summary.itemsSold}</TableCell>
                    <TableCell className="text-right font-bold">{formatPrice(summary.totalSales)}</TableCell>
                    <TableCell className="text-right font-bold text-muted-foreground">
                      {formatPrice(summary.transactionCount > 0 ? summary.totalSales / summary.transactionCount : 0)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

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
                    <TableHead>Bar</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">View</TableHead>
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
                        <Badge variant="secondary" className="text-xs">
                          {getBarName(order.bar_id)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {getOrderStaffName(order)}
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
                      <TableCell className="text-right font-medium">
                        {formatPrice(order.total_amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setViewingOrder(order)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={!!viewingOrder} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Order {viewingOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          {viewingOrder && (
            <div className="space-y-4">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Date & Time</p>
                  <p className="font-medium">{format(new Date(viewingOrder.created_at), "dd MMM yyyy, HH:mm")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{viewingOrder.order_type.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Staff</p>
                  <p className="font-medium">{getOrderStaffName(viewingOrder)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bar</p>
                  <p className="font-medium">{getBarName(viewingOrder.bar_id)}</p>
                </div>
                {viewingOrder.table_number && (
                  <div>
                    <p className="text-muted-foreground">Table</p>
                    <p className="font-medium">{viewingOrder.table_number}</p>
                  </div>
                )}
                {viewingOrder.notes && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Notes</p>
                    <p className="font-medium">{viewingOrder.notes}</p>
                  </div>
                )}
              </div>

              {/* Order Items */}
              <div>
                <p className="text-sm font-semibold mb-2">Items</p>
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingOrder.order_items.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatPrice(item.unit_price)}</TableCell>
                          <TableCell className="text-right font-medium">{formatPrice(item.total_price)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Payment Info */}
              <div>
                <p className="text-sm font-semibold mb-2">Payments</p>
                <div className="space-y-2">
                  {viewingOrder.payments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const Icon = paymentIcons[p.payment_method] || CreditCard;
                          return <Icon className="h-4 w-4 text-muted-foreground" />;
                        })()}
                        <span className="text-sm">{paymentLabels[p.payment_method] || p.payment_method}</span>
                        {p.reference && <span className="text-xs text-muted-foreground">({p.reference})</span>}
                      </div>
                      <span className="font-bold">{formatPrice(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Total */}
              <div className="flex justify-between items-center pt-3 border-t border-border">
                <span className="text-lg font-bold">Total</span>
                <span className="text-lg font-bold text-primary">{formatPrice(viewingOrder.total_amount)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EODReport;
