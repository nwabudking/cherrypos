import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBars } from "@/hooks/useBars";
import { ReportsHeader } from "@/components/reports/ReportsHeader";
import { SalesMetrics } from "@/components/reports/SalesMetrics";
import { RevenueChart } from "@/components/reports/RevenueChart";
import { TopItemsChart } from "@/components/reports/TopItemsChart";
import { SalesByType } from "@/components/reports/SalesByType";
import { ProfitMetrics } from "@/components/reports/ProfitMetrics";
import { AuditLogsSection } from "@/components/reports/AuditLogsSection";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { startOfDay, endOfDay, subDays, format } from "date-fns";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";

export type DateRange = "today" | "7days" | "30days" | "custom";

const Reports = () => {
  const { role } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>("7days");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [selectedBarFilter, setSelectedBarFilter] = useState<string>("all");
  const reportRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = role === "super_admin";
  const { data: bars = [] } = useBars();

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "7days":
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case "30days":
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case "custom":
        return {
          start: customStart ? startOfDay(customStart) : startOfDay(subDays(now, 7)),
          end: customEnd ? endOfDay(customEnd) : endOfDay(now),
        };
    }
  };

  const { start, end } = getDateFilter();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["reports-orders", dateRange, customStart, customEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (*, menu_items(cost_price)),
          payments (*)
        `)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .eq("status", "completed")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Calculate metrics
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const totalOrders = orders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalItems = orders.reduce(
    (sum, o) => sum + (o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0),
    0
  );

  // Calculate profit metrics (for super admin)
  const totalCostPrice = orders.reduce((sum, order) => {
    return sum + (order.order_items?.reduce((itemSum, item) => {
      const costPrice = (item as any).menu_items?.cost_price || 0;
      return itemSum + (Number(costPrice) * item.quantity);
    }, 0) || 0);
  }, 0);
  
  const profit = totalRevenue - totalCostPrice;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  // Calculate bar-specific profit data
  const barProfitData = bars.map(bar => {
    const barOrders = orders.filter(o => o.bar_id === bar.id);
    const barSellingPrice = barOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const barCostPrice = barOrders.reduce((sum, order) => {
      return sum + (order.order_items?.reduce((itemSum, item) => {
        const costPrice = (item as any).menu_items?.cost_price || 0;
        return itemSum + (Number(costPrice) * item.quantity);
      }, 0) || 0);
    }, 0);
    const barProfit = barSellingPrice - barCostPrice;
    const barProfitMargin = barSellingPrice > 0 ? (barProfit / barSellingPrice) * 100 : 0;

    return {
      barId: bar.id,
      barName: bar.name,
      costPrice: barCostPrice,
      sellingPrice: barSellingPrice,
      profit: barProfit,
      profitMargin: barProfitMargin,
    };
  }).filter(b => b.sellingPrice > 0);

  // Revenue by day
  const revenueByDay = orders.reduce((acc, order) => {
    const day = format(new Date(order.created_at!), "MMM dd");
    acc[day] = (acc[day] || 0) + Number(order.total_amount);
    return acc;
  }, {} as Record<string, number>);

  const revenueChartData = Object.entries(revenueByDay).map(([date, revenue]) => ({
    date,
    revenue,
  }));

  // Top items
  const itemCounts: Record<string, { name: string; quantity: number; revenue: number }> = {};
  orders.forEach((order) => {
    order.order_items?.forEach((item) => {
      if (!itemCounts[item.item_name]) {
        itemCounts[item.item_name] = { name: item.item_name, quantity: 0, revenue: 0 };
      }
      itemCounts[item.item_name].quantity += item.quantity;
      itemCounts[item.item_name].revenue += Number(item.total_price);
    });
  });

  const topItems = Object.values(itemCounts)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Sales by order type
  const salesByType = orders.reduce((acc, order) => {
    acc[order.order_type] = (acc[order.order_type] || 0) + Number(order.total_amount);
    return acc;
  }, {} as Record<string, number>);

  const salesByTypeData = Object.entries(salesByType).map(([type, value]) => ({
    type,
    value,
  }));

  // Sales by payment method
  const salesByPayment = orders.reduce((acc, order) => {
    const method = order.payments?.[0]?.payment_method || "unknown";
    acc[method] = (acc[method] || 0) + Number(order.total_amount);
    return acc;
  }, {} as Record<string, number>);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Export handlers
  const handleExportPDF = () => {
    const data = orders.map(o => ({
      "Order #": o.order_number,
      Date: format(new Date(o.created_at!), "MMM dd, yyyy HH:mm"),
      Type: o.order_type,
      Total: formatCurrency(Number(o.total_amount)),
      Status: o.status,
    }));
    
    exportToPDF(data, `Sales Report - ${format(start, "MMM dd")} to ${format(end, "MMM dd, yyyy")}`, "sales_report");
  };

  const handleExportExcel = () => {
    const data = orders.map(o => ({
      order_number: o.order_number,
      date: format(new Date(o.created_at!), "yyyy-MM-dd HH:mm"),
      type: o.order_type,
      subtotal: o.subtotal,
      vat: o.vat_amount,
      service_charge: o.service_charge,
      discount: o.discount_amount,
      total: o.total_amount,
      status: o.status,
      payment_method: o.payments?.[0]?.payment_method || "",
    }));

    exportToExcel(`sales_report_${format(start, "yyyyMMdd")}_${format(end, "yyyyMMdd")}`, data, [
      { key: "order_number", header: "Order Number" },
      { key: "date", header: "Date" },
      { key: "type", header: "Order Type" },
      { key: "subtotal", header: "Subtotal" },
      { key: "vat", header: "VAT" },
      { key: "service_charge", header: "Service Charge" },
      { key: "discount", header: "Discount" },
      { key: "total", header: "Total" },
      { key: "status", header: "Status" },
      { key: "payment_method", header: "Payment Method" },
    ]);
  };

  return (
    <div className="space-y-6" ref={reportRef}>
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <ReportsHeader
          dateRange={dateRange}
          setDateRange={setDateRange}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
        />
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <FileDown className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Profit Metrics (Super Admin Only) */}
      {isSuperAdmin && (
        <ProfitMetrics
          totalCostPrice={totalCostPrice}
          totalSellingPrice={totalRevenue}
          profit={profit}
          profitMargin={profitMargin}
          isLoading={isLoading}
          barProfitData={barProfitData}
          selectedBarFilter={selectedBarFilter}
          onBarFilterChange={setSelectedBarFilter}
          bars={bars}
        />
      )}

      <SalesMetrics
        totalRevenue={totalRevenue}
        totalOrders={totalOrders}
        averageOrderValue={averageOrderValue}
        totalItems={totalItems}
        isLoading={isLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={revenueChartData} isLoading={isLoading} />
        <TopItemsChart data={topItems} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesByType data={salesByTypeData} title="Sales by Order Type" isLoading={isLoading} />
        <SalesByType
          data={Object.entries(salesByPayment).map(([type, value]) => ({ type, value }))}
          title="Sales by Payment Method"
          isLoading={isLoading}
        />
      </div>

      {/* Audit Logs Section (Super Admin Only) */}
      {isSuperAdmin && <AuditLogsSection />}
    </div>
  );
};

export default Reports;