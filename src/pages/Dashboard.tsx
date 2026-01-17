import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LowStockDialog } from "@/components/dashboard/LowStockDialog";
import { ExpiryWidget } from "@/components/dashboard/ExpiryWidget";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign,
  ShoppingCart,
  Grid3X3,
  AlertTriangle,
  TrendingUp,
  Users,
  Clock,
  Utensils,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import cherryLogo from "@/assets/cherry-logo.png";

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ElementType;
  iconColor?: string;
  isLoading?: boolean;
}

const KPICard = ({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor,
  isLoading,
}: KPICardProps) => (
  <Card className="bg-card border-border hover:border-primary/30 transition-colors">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
      <div className={`p-2 rounded-lg ${iconColor || "bg-primary/10"}`}>
        <Icon
          className={`h-4 w-4 ${iconColor ? "text-primary-foreground" : "text-primary"}`}
        />
      </div>
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <>
          <div className="text-2xl font-bold text-foreground">{value}</div>
          {change && (
            <p
              className={`text-xs mt-1 ${
                changeType === "positive"
                  ? "text-emerald-500"
                  : changeType === "negative"
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {change}
            </p>
          )}
        </>
      )}
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const { profile } = useAuth();
  const [lowStockDialogOpen, setLowStockDialogOpen] = useState(false);
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  // Fetch today's orders
  const { data: todayOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["dashboard-orders", format(today, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch low stock items
  const { data: lowStockItems = [], isLoading: inventoryLoading } = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).filter(item => item.current_stock <= item.min_stock_level);
    },
  });

  // Fetch menu items count
  const { data: menuItems = [] } = useQuery({
    queryKey: ["dashboard-menu-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_active', true)
        .eq('is_available', true);
      if (error) throw error;
      return data || [];
    },
  });

  const menuItemsCount = menuItems.length;

  // Calculate metrics
  const completedOrders = todayOrders.filter((o) => o.status === "completed");
  const activeOrders = todayOrders.filter((o) =>
    ["pending", "preparing", "ready"].includes(o.status)
  );
  const dailySales = completedOrders.reduce(
    (sum, o) => sum + Number(o.total_amount),
    0
  );
  const totalOrders = completedOrders.length;
  const avgOrderValue = totalOrders > 0 ? dailySales / totalOrders : 0;

  // Get top selling items from today's orders
  const itemSales: Record<
    string,
    { name: string; quantity: number; revenue: number }
  > = {};
  todayOrders.forEach((order) => {
    order.order_items?.forEach((item) => {
      if (!itemSales[item.item_name]) {
        itemSales[item.item_name] = { name: item.item_name, quantity: 0, revenue: 0 };
      }
      itemSales[item.item_name].quantity += item.quantity;
      itemSales[item.item_name].revenue += Number(item.total_price);
    });
  });

  const topSellingItems = Object.values(itemSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 4);

  // Recent orders
  const recentOrders = todayOrders.slice(0, 4).map((order) => ({
    id: order.order_number,
    table:
      order.table_number ||
      (order.order_type === "takeaway"
        ? "Takeaway"
        : order.order_type === "delivery"
        ? "Delivery"
        : "Bar"),
    amount: `₦${Number(order.total_amount).toLocaleString()}`,
    status: order.status.charAt(0).toUpperCase() + order.status.slice(1),
    time: getTimeAgo(new Date(order.created_at!)),
  }));

  function getTimeAgo(date: Date) {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const isLoading = ordersLoading || inventoryLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome header */}
      <div className="flex items-center gap-4">
        <img src={cherryLogo} alt="Cherry Dining & Lounge" className="w-14 h-auto" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {getGreeting()}, {profile?.full_name?.split(" ")[0] || "there"}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening at Cherry Dining Lounge today.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Today's Sales"
          value={`₦${dailySales.toLocaleString()}`}
          change={`${completedOrders.length} orders completed`}
          changeType="positive"
          icon={DollarSign}
          iconColor="gradient-cherry"
          isLoading={isLoading}
        />
        <KPICard
          title="Active Orders"
          value={activeOrders.length.toString()}
          change={`${activeOrders.filter((o) => o.status === "pending").length} pending`}
          changeType="neutral"
          icon={ShoppingCart}
          isLoading={isLoading}
        />
        <KPICard
          title="Menu Items"
          value={menuItemsCount.toString()}
          change="Items available"
          changeType="neutral"
          icon={Grid3X3}
          isLoading={isLoading}
        />
        <div
          onClick={() => lowStockItems.length > 0 && setLowStockDialogOpen(true)}
          className={lowStockItems.length > 0 ? "cursor-pointer" : ""}
        >
          <KPICard
            title="Low Stock Alerts"
            value={lowStockItems.length.toString()}
            change={lowStockItems.length > 0 ? "Click to view items" : "All stocked"}
            changeType={lowStockItems.length > 0 ? "negative" : "positive"}
            icon={AlertTriangle}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Low Stock Dialog */}
      <LowStockDialog
        open={lowStockDialogOpen}
        onOpenChange={setLowStockDialogOpen}
        items={lowStockItems}
      />

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No orders yet today
              </p>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Utensils className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{order.id}</p>
                        <p className="text-sm text-muted-foreground">{order.table}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">{order.amount}</p>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          order.status === "Completed"
                            ? "bg-emerald-500/20 text-emerald-500"
                            : order.status === "Ready"
                            ? "bg-amber-500/20 text-amber-500"
                            : order.status === "Preparing"
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Selling Items */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Top Selling Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : topSellingItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No sales yet today
              </p>
            ) : (
              <div className="space-y-4">
                {topSellingItems.map((item, index) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0
                            ? "bg-amber-500/20 text-amber-500"
                            : index === 1
                            ? "bg-muted-foreground/20 text-muted-foreground"
                            : index === 2
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} sold
                        </p>
                      </div>
                    </div>
                    <p className="font-medium text-foreground">
                      ₦{item.revenue.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expiry Widget */}
      <ExpiryWidget />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <div>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {todayOrders.length}
                </p>
              )}
              <p className="text-sm text-muted-foreground">Total Orders</p>
            </div>
          </div>
        </Card>
        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-primary" />
            <div>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {completedOrders.length}
                </p>
              )}
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </div>
        </Card>
        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-primary" />
            <div>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  ₦{avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              )}
              <p className="text-sm text-muted-foreground">Avg. Order</p>
            </div>
          </div>
        </Card>
        <Card
          className={`bg-card border-border p-4 ${
            lowStockItems.length > 0
              ? "cursor-pointer hover:border-primary/30 transition-colors"
              : ""
          }`}
          onClick={() => lowStockItems.length > 0 && setLowStockDialogOpen(true)}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle
              className={`w-8 h-8 ${
                lowStockItems.length > 0 ? "text-destructive" : "text-emerald-500"
              }`}
            />
            <div>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {lowStockItems.length}
                </p>
              )}
              <p className="text-sm text-muted-foreground">Low Stock</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
