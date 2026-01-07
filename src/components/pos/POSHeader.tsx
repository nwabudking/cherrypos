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
    <div className="p-4 border-b border-border bg-card">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            {orderTypes.map(({ type, label, icon }) => (
              <Button
                key={type}
                variant={orderType === type ? "default" : "outline"}
                size="sm"
                onClick={() => setOrderType(type)}
                className="gap-2"
              >
                {icon}
                {label}
              </Button>
            ))}
          </div>

          {orderType === "dine_in" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Table:</span>
              <Input
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. A1"
                className="w-20 h-9"
              />
            </div>
          )}
        </div>

        {children}
      </div>
    </div>
  );
};
