import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { CartPanel } from "./CartPanel";
import type { CartItem } from "@/pages/POS";

interface MobileCartSheetProps {
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

export const MobileCartSheet = ({
  cart,
  subtotal,
  total,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  insufficientStock = [],
  checkoutDisabled = false,
}: MobileCartSheetProps) => {
  const [open, setOpen] = useState(false);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(price);

  return (
    <>
      {/* Floating cart button */}
      <div className="fixed bottom-4 left-4 right-4 z-50 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="w-full h-14 text-base font-semibold shadow-lg relative gap-3">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 ? (
                <>
                  <span>View Cart ({itemCount})</span>
                  <span className="ml-auto">{formatPrice(total)}</span>
                </>
              ) : (
                <span>Cart is empty</span>
              )}
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold">
                  {itemCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-2xl">
            <SheetHeader className="sr-only">
              <SheetTitle>Cart</SheetTitle>
            </SheetHeader>
            <div className="h-full flex flex-col">
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mt-3 mb-1" />
              <CartPanel
                cart={cart}
                subtotal={subtotal}
                total={total}
                onUpdateQuantity={onUpdateQuantity}
                onRemoveItem={onRemoveItem}
                onClearCart={onClearCart}
                onCheckout={() => {
                  setOpen(false);
                  onCheckout();
                }}
                insufficientStock={insufficientStock}
                checkoutDisabled={checkoutDisabled}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};
