import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useBarContext } from "@/contexts/BarContext";
import { useToast } from "@/hooks/use-toast";
import { useActiveMenuCategories, useActiveMenuItems } from "@/hooks/useMenu";
import { useCreateOrder, CreateOrderData } from "@/hooks/useOrders";
import { POSHeader } from "@/components/pos/POSHeader";
import { CategoryTabs } from "@/components/pos/CategoryTabs";
import { MenuGrid } from "@/components/pos/MenuGrid";
import { CartPanel } from "@/components/pos/CartPanel";
import { CheckoutDialog } from "@/components/pos/CheckoutDialog";
import { BarSelector } from "@/components/pos/BarSelector";
import type { MenuCategory } from "@/hooks/useMenu";

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

type OrderType = "dine_in" | "takeaway" | "delivery" | "bar_only";

interface CompletedOrder {
  id: string;
  order_number: string;
  total_amount: number;
  created_at: string;
}

const POS = () => {
  const { user } = useAuth();
  const { activeBar } = useBarContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutCart, setCheckoutCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [tableNumber, setTableNumber] = useState("");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);

  const { data: categories = [] } = useActiveMenuCategories();
  const { data: menuItems = [] } = useActiveMenuItems(selectedCategory || undefined);

  const createOrderMutation = useCreateOrder();

  const handleCheckout = async (paymentMethod: string) => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    const orderData: CreateOrderData = {
      order_type: orderType,
      table_number: orderType === "dine_in" ? tableNumber : null,
      notes: null,
      subtotal,
      vat_amount: 0,
      service_charge: 0,
      discount_amount: 0,
      total_amount: subtotal,
      bar_id: activeBar?.id || null,
      items: cart.map((item) => ({
        menu_item_id: item.menuItemId,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        notes: item.notes || null,
      })),
      payment: {
        payment_method: paymentMethod,
        amount: subtotal,
      },
    };

    createOrderMutation.mutate(orderData, {
      onSuccess: (order) => {
        toast({
          title: "Order Created!",
          description: `Order ${order.order_number} has been placed successfully.`,
        });
        setCheckoutCart([...cart]);
        setCompletedOrder(order);
        setCart([]);
        setTableNumber("");
        setIsCheckoutOpen(false);
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        queryClient.invalidateQueries({ queryKey: ["menu"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
      },
      onError: (error: Error) => {
        toast({
          title: "Error",
          description: error.message || "Failed to create order. Please try again.",
          variant: "destructive",
        });
        console.error(error);
      },
    });
  };

  const addToCart = (item: { id: string; name: string; price: number }) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
        },
      ];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal;

  // For receipt display after order completion
  const receiptSubtotal = checkoutCart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const receiptTotal = receiptSubtotal;

  // Filter menu items by search query
  const filteredMenuItems = menuItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCloseCheckout = () => {
    setIsCheckoutOpen(false);
    setCompletedOrder(null);
    setCheckoutCart([]);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left Panel - Menu */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <POSHeader
          orderType={orderType}
          setOrderType={setOrderType}
          tableNumber={tableNumber}
          setTableNumber={setTableNumber}
        >
          <BarSelector />
        </POSHeader>

        <CategoryTabs
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <MenuGrid items={filteredMenuItems} onAddToCart={addToCart} />
      </div>

      {/* Right Panel - Cart */}
      <CartPanel
        cart={cart}
        subtotal={subtotal}
        total={total}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onClearCart={clearCart}
        onCheckout={() => setIsCheckoutOpen(true)}
      />

      <CheckoutDialog
        open={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        total={completedOrder ? receiptTotal : total}
        subtotal={completedOrder ? receiptSubtotal : subtotal}
        cart={completedOrder ? checkoutCart : cart}
        orderType={orderType}
        tableNumber={tableNumber}
        onConfirmPayment={handleCheckout}
        isProcessing={createOrderMutation.isPending}
        completedOrder={completedOrder}
        onClose={handleCloseCheckout}
      />
    </div>
  );
};

export default POS;
