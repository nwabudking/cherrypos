import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2, ShoppingCart, AlertTriangle } from "lucide-react";
import { CartItem } from "@/pages/POS";
import { StockWarningAlert } from "./StockWarningAlert";

interface CartPanelProps {
  cart: CartItem[];
  subtotal: number;
  total: number;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  insufficientStock?: Array<{ name: string; available: number; requested: number }>;
  checkoutDisabled?: boolean;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(price);
};

export const CartPanel = ({
  cart,
  subtotal,
  total,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  insufficientStock = [],
  checkoutDisabled = false,
}: CartPanelProps) => {
  const hasStockIssues = insufficientStock.length > 0;

  return (
    <Card className="w-80 lg:w-96 rounded-none border-l border-y-0 border-r-0 flex flex-col">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Current Order
          </CardTitle>
          {cart.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={onClearCart}
            >
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Cart is empty</p>
              <p className="text-sm">Tap items to add them</p>
            </div>
          ) : (
            cart.map((item) => {
              const isInsufficient = insufficientStock.some(
                (s) => s.name === item.name
              );
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                    isInsufficient
                      ? "bg-destructive/10 border border-destructive/30"
                      : "bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate flex items-center gap-1">
                      {item.name}
                      {isInsufficient && (
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(item.price)} each
                    </p>
                    {isInsufficient && (
                      <p className="text-xs text-destructive mt-1">
                        Insufficient stock
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-background rounded-md border border-border">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onUpdateQuantity(item.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onUpdateQuantity(item.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </ScrollArea>

      {cart.length > 0 && (
        <div className="p-4 border-t border-border space-y-3 bg-muted/30">
          {hasStockIssues && (
            <StockWarningAlert insufficientItems={insufficientStock} />
          )}

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-primary">{formatPrice(total)}</span>
          </div>

          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={onCheckout}
            disabled={checkoutDisabled}
          >
            {hasStockIssues ? "Insufficient Stock" : "Checkout"}
          </Button>
        </div>
      )}
    </Card>
  );
};
