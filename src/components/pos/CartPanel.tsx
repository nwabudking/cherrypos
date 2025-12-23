import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { CartItem } from "@/pages/POS";

interface CartPanelProps {
  cart: CartItem[];
  subtotal: number;
  vatAmount: number;
  serviceCharge: number;
  total: number;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
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
  vatAmount,
  serviceCharge,
  total,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
}: CartPanelProps) => {
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
            cart.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(item.price)} each
                  </p>
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
            ))
          )}
        </CardContent>
      </ScrollArea>

      {cart.length > 0 && (
        <div className="p-4 border-t border-border space-y-3 bg-muted/30">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT (7.5%)</span>
              <span>{formatPrice(vatAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service (10%)</span>
              <span>{formatPrice(serviceCharge)}</span>
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
          >
            Checkout
          </Button>
        </div>
      )}
    </Card>
  );
};
