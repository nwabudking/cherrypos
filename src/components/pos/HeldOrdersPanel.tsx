import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Pause, Play, Trash2, Clock } from "lucide-react";
import { CartItem } from "@/pages/POS";
import { formatDistanceToNow } from "date-fns";

export interface HeldOrder {
  id: string;
  items: CartItem[];
  orderType: string;
  tableNumber?: string;
  holdTime: Date;
  notes?: string;
}

interface HeldOrdersPanelProps {
  heldOrders: HeldOrder[];
  onResumeOrder: (order: HeldOrder) => void;
  onDeleteHeldOrder: (orderId: string) => void;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(price);
};

const orderTypeLabels: Record<string, string> = {
  dine_in: "Dine In",
  takeaway: "Takeaway",
  delivery: "Delivery",
  bar_only: "Bar Only",
};

export const HeldOrdersPanel = ({
  heldOrders,
  onResumeOrder,
  onDeleteHeldOrder,
}: HeldOrdersPanelProps) => {
  if (heldOrders.length === 0) {
    return null;
  }

  return (
    <Card className="mb-4">
      <CardHeader className="py-3 border-b border-border">
        <CardTitle className="text-sm flex items-center gap-2">
          <Pause className="h-4 w-4 text-amber-500" />
          Held Orders ({heldOrders.length})
        </CardTitle>
      </CardHeader>
      <ScrollArea className="h-[180px]">
        <CardContent className="p-2 space-y-2">
          {heldOrders.map((order) => {
            const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            
            return (
              <div
                key={order.id}
                className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {orderTypeLabels[order.orderType] || order.orderType}
                      </Badge>
                      {order.tableNumber && (
                        <Badge variant="secondary" className="text-xs">
                          Table {order.tableNumber}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(order.holdTime, { addSuffix: true })}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">{formatPrice(total)}</p>
                    <p className="text-xs text-muted-foreground">{itemCount} items</p>
                  </div>
                </div>
                
                {/* Item preview */}
                <div className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {order.items.map((item, idx) => (
                    <span key={item.id}>
                      {item.quantity}x {item.name}
                      {idx < order.items.length - 1 && ", "}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1 h-7 text-xs"
                    onClick={() => onResumeOrder(order)}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Resume
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => onDeleteHeldOrder(order.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </ScrollArea>
    </Card>
  );
};