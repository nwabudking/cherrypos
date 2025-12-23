import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  menu_categories: { name: string } | null;
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
  return (
    <ScrollArea className="flex-1">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-4">
        {items.map((item) => (
          <Card
            key={item.id}
            className="cursor-pointer hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 group active:scale-95"
            onClick={() => onAddToCart({ id: item.id, name: item.name, price: Number(item.price) })}
          >
            <CardContent className="p-4 flex flex-col h-full min-h-[120px]">
              <div className="flex-1">
                <p className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                  {item.name}
                </p>
                {item.menu_categories && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.menu_categories.name}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-primary font-bold text-sm">
                  {formatPrice(Number(item.price))}
                </span>
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Plus className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {items.length === 0 && (
          <div className="col-span-full flex items-center justify-center h-40 text-muted-foreground">
            No items found
          </div>
        )}
      </div>
    </ScrollArea>
  );
};
