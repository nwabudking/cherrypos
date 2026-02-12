import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UtensilsCrossed, ShoppingBag, Truck, Wine } from "lucide-react";

type OrderType = "dine_in" | "takeaway" | "delivery" | "bar_only";

interface POSHeaderProps {
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  tableNumber: string;
  setTableNumber: (value: string) => void;
  children?: React.ReactNode;
}

const orderTypes: { type: OrderType; label: string; icon: React.ReactNode }[] = [
  { type: "dine_in", label: "Dine In", icon: <UtensilsCrossed className="h-4 w-4" /> },
  { type: "takeaway", label: "Takeaway", icon: <ShoppingBag className="h-4 w-4" /> },
  { type: "delivery", label: "Delivery", icon: <Truck className="h-4 w-4" /> },
  { type: "bar_only", label: "Bar Only", icon: <Wine className="h-4 w-4" /> },
];

export const POSHeader = ({
  orderType,
  setOrderType,
  tableNumber,
  setTableNumber,
  children,
}: POSHeaderProps) => {
  return (
    <div className="p-3 md:p-4 border-b border-border bg-card">
      <div className="flex items-center justify-between gap-2 md:gap-4 flex-wrap">
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          <div className="flex gap-1 md:gap-2 flex-wrap">
            {orderTypes.map(({ type, label, icon }) => (
              <Button
                key={type}
                variant={orderType === type ? "default" : "outline"}
                size="sm"
                onClick={() => setOrderType(type)}
                className="gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3"
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
          </div>

          {orderType === "dine_in" && (
            <div className="flex items-center gap-2">
              <span className="text-xs md:text-sm text-muted-foreground">Table:</span>
              <Input
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. A1"
                className="w-16 md:w-20 h-8 md:h-9 text-xs md:text-sm"
              />
            </div>
          )}
        </div>

        {children}
      </div>
    </div>
  );
};
