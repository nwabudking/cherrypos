import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertCircle } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  menu_categories: { name: string } | null;
  track_inventory?: boolean;
  inventory_items?: { id: string; current_stock: number; unit: string } | null;
}

interface MenuGridProps {
  items: MenuItem[];
  onAddToCart: (item: { id: string; name: string; price: number }) => void;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(price);
};

export const MenuGrid = ({ items, onAddToCart }: MenuGridProps) => {
  const getStockInfo = (item: MenuItem) => {
    if (!item.track_inventory || !item.inventory_items) {
      return { hasStock: true, stock: null };
    }
    return {
      hasStock: item.inventory_items.current_stock > 0,
      stock: item.inventory_items.current_stock,
      unit: item.inventory_items.unit,
    };
  };

  return (
    <ScrollArea className="flex-1">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-4">
        {items.map((item) => {
          const stockInfo = getStockInfo(item);
          const isOutOfStock = !stockInfo.hasStock;
          const isLowStock = stockInfo.stock !== null && stockInfo.stock > 0 && stockInfo.stock <= 5;

          return (
            <Card
              key={item.id}
              className={`transition-all duration-200 group ${
                isOutOfStock
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 active:scale-95"
              }`}
              onClick={() => !isOutOfStock && onAddToCart({ id: item.id, name: item.name, price: Number(item.price) })}
            >
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
                    <Badge variant="outline" className="mt-2 text-xs border-amber-500/50 text-amber-500">
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
