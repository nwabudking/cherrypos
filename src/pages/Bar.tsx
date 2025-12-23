import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Wine, Clock, CheckCircle2, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  notes: string | null;
  menu_item_id: string | null;
}

interface Order {
  id: string;
  order_number: string;
  order_type: string;
  table_number: string | null;
  status: string;
  created_at: string;
  order_items: OrderItem[];
}

const orderTypeLabels: Record<string, string> = {
  dine_in: "Dine In",
  takeaway: "Takeaway",
  delivery: "Delivery",
  bar_only: "Bar Only",
};

const Bar = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "preparing" | "all">("pending");

  // Fetch bar orders (orders with bar items - drinks category)
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["bar-orders", filter],
    queryFn: async () => {
      // First get drink category IDs
      const { data: drinkCategories } = await supabase
        .from("menu_categories")
        .select("id")
        .or("name.ilike.%drink%,name.ilike.%beverage%,name.ilike.%cocktail%,name.ilike.%wine%,name.ilike.%beer%,name.ilike.%soft%");

      const categoryIds = drinkCategories?.map(c => c.id) || [];

      let query = supabase
        .from("orders")
        .select(`
          id,
          order_number,
          order_type,
          table_number,
          status,
          created_at,
          order_items!inner (
            id,
            item_name,
            quantity,
            notes,
            menu_item_id
          )
        `)
        .order("created_at", { ascending: true });

      if (filter === "pending") {
        query = query.eq("status", "pending");
      } else if (filter === "preparing") {
        query = query.eq("status", "preparing");
      } else {
        query = query.in("status", ["pending", "preparing", "ready"]);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter orders to only include those with bar items
      if (categoryIds.length > 0) {
        const { data: barMenuItems } = await supabase
          .from("menu_items")
          .select("id")
          .in("category_id", categoryIds);

        const barItemIds = barMenuItems?.map(item => item.id) || [];

        return (data as Order[]).filter(order =>
          order.order_items.some(item => 
            item.menu_item_id && barItemIds.includes(item.menu_item_id)
          )
        ).map(order => ({
          ...order,
          order_items: order.order_items.filter(item =>
            item.menu_item_id && barItemIds.includes(item.menu_item_id)
          )
        }));
      }

      return data as Order[];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("bar-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["bar-orders"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["bar-orders"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bar-orders"] });
      toast({ title: "Order status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update order", variant: "destructive" });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "preparing":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "ready":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return "preparing";
      case "preparing":
        return "ready";
      default:
        return null;
    }
  };

  const getNextStatusLabel = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return "Start Preparing";
      case "preparing":
        return "Mark Ready";
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wine className="h-6 w-6 text-primary" />
            Bar Display
          </h1>
          <p className="text-muted-foreground">Manage drink orders in real-time</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
          >
            Pending
          </Button>
          <Button
            variant={filter === "preparing" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("preparing")}
          >
            Preparing
          </Button>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All Active
          </Button>
        </div>
      </div>

      {/* Orders Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <Wine className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium">No drink orders</h3>
            <p className="text-muted-foreground">New drink orders will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map((order) => (
            <Card key={order.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{order.order_number}</CardTitle>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <Badge className={getStatusColor(order.status)}>
                    {order.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {orderTypeLabels[order.order_type] || order.order_type}
                  </Badge>
                  {order.table_number && (
                    <Badge variant="secondary" className="text-xs">
                      Table {order.table_number}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <ScrollArea className="flex-1 max-h-48">
                <CardContent className="pt-0 space-y-2">
                  {order.order_items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2 p-2 rounded bg-muted/50"
                    >
                      <span className="font-bold text-primary min-w-[24px]">
                        {item.quantity}x
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.item_name}</p>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Note: {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </ScrollArea>

              {getNextStatus(order.status) && (
                <div className="p-4 pt-0 mt-auto">
                  <Button
                    className="w-full"
                    onClick={() =>
                      updateStatusMutation.mutate({
                        orderId: order.id,
                        status: getNextStatus(order.status)!,
                      })
                    }
                    disabled={updateStatusMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {getNextStatusLabel(order.status)}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Bar;
