import { useEffectiveUser } from "@/hooks/useEffectiveUser";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Search, AlertTriangle, Store } from "lucide-react";
import { useState } from "react";

interface BarInventoryItem {
  id: string;
  inventory_item_id: string;
  current_stock: number;
  min_stock_level: number;
  inventory_items: {
    name: string;
    unit: string;
    category: string | null;
  };
}

export const CashierInventoryView = () => {
  const { barId: assignedBarId, barName: assignedBarName, assignmentLoading } = useEffectiveUser();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: barInventory = [], isLoading } = useQuery({
    queryKey: ["cashier-bar-inventory", assignedBarId],
    queryFn: async () => {
      if (!assignedBarId) return [];
      
      const { data, error } = await supabase
        .from("bar_inventory")
        .select(`
          id,
          inventory_item_id,
          current_stock,
          min_stock_level,
          inventory_items(name, unit, category)
        `)
        .eq("bar_id", assignedBarId)
        .eq("is_active", true);

      if (error) throw error;
      return (data || []) as BarInventoryItem[];
    },
    enabled: !!assignedBarId,
  });

  const filteredItems = barInventory.filter((item) =>
    item.inventory_items?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockCount = barInventory.filter(
    (item) => item.current_stock <= item.min_stock_level
  ).length;

  if (!assignedBarId && !assignmentLoading) {
    return (
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
          <h3 className="text-lg font-medium">Not Assigned to a Bar</h3>
          <p className="text-muted-foreground">
            Please contact your manager to get assigned to a bar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Bar Inventory</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Store className="h-4 w-4" />
              <span>{assignedBarName || "Your Bar"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{barInventory.length}</p>
                <p className="text-sm text-muted-foreground">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={lowStockCount > 0 ? "border-amber-500" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${lowStockCount > 0 ? "bg-amber-500/10" : "bg-muted"}`}>
                <AlertTriangle className={`h-5 w-5 ${lowStockCount > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{lowStockCount}</p>
                <p className="text-sm text-muted-foreground">Low Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available Stock</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading inventory...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items found
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Min Level</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const isLowStock = item.current_stock <= item.min_stock_level;
                    const isOutOfStock = item.current_stock <= 0;
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.inventory_items?.name || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {item.inventory_items?.category || "Uncategorized"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.current_stock} {item.inventory_items?.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.min_stock_level} {item.inventory_items?.unit}
                        </TableCell>
                        <TableCell>
                          {isOutOfStock ? (
                            <Badge variant="destructive">Out of Stock</Badge>
                          ) : isLowStock ? (
                            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                              In Stock
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
