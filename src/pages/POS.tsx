import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { POSHeader } from "@/components/pos/POSHeader";
import { CategoryTabs } from "@/components/pos/CategoryTabs";
import { MenuGrid } from "@/components/pos/MenuGrid";
import { CartPanel } from "@/components/pos/CartPanel";
import { CheckoutDialog } from "@/components/pos/CheckoutDialog";

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

type OrderType = "dine_in" | "takeaway" | "delivery" | "bar_only";

const POS = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [tableNumber, setTableNumber] = useState("");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["menu-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ["menu-items", selectedCategory],
    queryFn: async () => {
      let query = supabase
        .from("menu_items")
        .select("*, menu_categories(name)")
        .eq("is_active", true)
        .eq("is_available", true);
      
      if (selectedCategory) {
        query = query.eq("category_id", selectedCategory);
      }
      
      const { data, error } = await query.order("name");
      if (error) throw error;
      return data;
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (paymentMethod: string) => {
      const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const vatAmount = subtotal * 0.075; // 7.5% VAT
      const serviceCharge = subtotal * 0.10; // 10% service charge
      const totalAmount = subtotal + vatAmount + serviceCharge;

      // Generate order number
      const { data: orderNumber } = await supabase.rpc("generate_order_number");

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          order_type: orderType,
          table_number: orderType === "dine_in" ? tableNumber : null,
          subtotal,
          vat_amount: vatAmount,
          service_charge: serviceCharge,
          total_amount: totalAmount,
          created_by: user?.id,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cart.map((item) => ({
        order_id: order.id,
        menu_item_id: item.menuItemId,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        notes: item.notes,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Create payment
      const { error: paymentError } = await supabase
        .from("payments")
        .insert({
          order_id: order.id,
          payment_method: paymentMethod,
          amount: totalAmount,
          created_by: user?.id,
        });

      if (paymentError) throw paymentError;

      return order;
    },
    onSuccess: (order) => {
      toast({
        title: "Order Created!",
        description: `Order ${order.order_number} has been placed successfully.`,
      });
      setCart([]);
      setTableNumber("");
      setIsCheckoutOpen(false);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create order. Please try again.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

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
  const vatAmount = subtotal * 0.075;
  const serviceCharge = subtotal * 0.10;
  const total = subtotal + vatAmount + serviceCharge;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left Panel - Menu */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <POSHeader
          orderType={orderType}
          setOrderType={setOrderType}
          tableNumber={tableNumber}
          setTableNumber={setTableNumber}
        />
        
        <CategoryTabs
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
        
        <MenuGrid items={menuItems} onAddToCart={addToCart} />
      </div>

      {/* Right Panel - Cart */}
      <CartPanel
        cart={cart}
        subtotal={subtotal}
        vatAmount={vatAmount}
        serviceCharge={serviceCharge}
        total={total}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onClearCart={clearCart}
        onCheckout={() => setIsCheckoutOpen(true)}
      />

      <CheckoutDialog
        open={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        total={total}
        onConfirmPayment={(method) => createOrderMutation.mutate(method)}
        isProcessing={createOrderMutation.isPending}
      />
    </div>
  );
};

export default POS;
