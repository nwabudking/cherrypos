import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertCircle, AlertTriangle } from "lucide-react";

import type { MenuItemStockInfo } from "@/hooks/useBarStock";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id?: string | null;
  menu_categories?: { name: string } | null;
  track_inventory?: boolean | null;
  inventory_item_id?: string | null;
}

interface MenuGridProps {
  items: MenuItem[];
  onAddToCart: (item: { id: string; name: string; price: number }) => void;
  stockInfoMap?: Map<string, MenuItemStockInfo>;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(price);
};

export const MenuGrid = ({ items, onAddToCart, stockInfoMap }: MenuGridProps) => {
  const getStockInfo = (item: MenuItem) => {
    const stockInfo = stockInfoMap?.get(item.id);
    if (!stockInfo) {
      // If no stock tracking, assume available
      if (!item.track_inventory || !item.inventory_item_id) {
        return { hasStock: true, stock: null, isLow: false };
      }
      // If tracking but no bar selected, mark as unavailable
      return { hasStock: false, stock: 0, isLow: false };
    }
    return { 
      hasStock: stockInfo.hasStock, 
      stock: stockInfo.currentStock === Infinity ? null : stockInfo.currentStock, 
      isLow: stockInfo.isLowStock 
    };
  };

  return (
    <ScrollArea className="flex-1">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-4">
        {items.map((item) => {
          const stockInfo = getStockInfo(item);
          const isOutOfStock = !stockInfo.hasStock;
          const isLowStock = stockInfo.isLow;

          return (
            <Card
              key={item.id}
              className={`transition-all duration-200 group relative ${
                isOutOfStock
                  ? "opacity-50 cursor-not-allowed"
                  : isLowStock
                  ? "cursor-pointer border-amber-500/50 hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/10 active:scale-95"
                  : "cursor-pointer hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 active:scale-95"
              }`}
              onClick={() => !isOutOfStock && onAddToCart({ id: item.id, name: item.name, price: Number(item.price) })}
            >
              {/* Low stock corner indicator */}
              {isLowStock && (
                <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center shadow-md animate-pulse">
                  <AlertTriangle className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <CardContent className="p-4 flex flex-col h-full min-h-[120px]">
                <div className="flex-1">
                  <p className={`font-medium text-sm leading-tight line-clamp-2 transition-colors ${
                    isOutOfStock ? "text-muted-foreground" : "group-hover:text-primary"
                  }`}>
                    {item.name}
                  </p>
                  {item.menu_categories && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.menu_categories.name}
                    </p>
                  )}
                  
                  {/* Stock indicator */}
                  {isOutOfStock && (
                    <Badge variant="destructive" className="mt-2 text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Out of Stock
                    </Badge>
                  )}
                  {isLowStock && (
                    <Badge variant="outline" className="mt-2 text-xs border-amber-500/50 bg-amber-500/10 text-amber-600">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {stockInfo.stock} left
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className={`font-bold text-sm ${isOutOfStock ? "text-muted-foreground" : "text-primary"}`}>
                    {formatPrice(Number(item.price))}
                  </span>
                  {!isOutOfStock && (
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Plus className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {items.length === 0 && (
          <div className="col-span-full flex items-center justify-center h-40 text-muted-foreground">
            No items found
          </div>
        )}
      </div>
    </ScrollArea>
  );
};
