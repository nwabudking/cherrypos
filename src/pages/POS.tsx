import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutCart, setCheckoutCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [tableNumber, setTableNumber] = useState("");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Tables<"orders"> | null>(null);

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
        .select("*, menu_categories(name), inventory_items:inventory_item_id(id, current_stock, unit)")
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
      // Validate stock before creating order
      for (const cartItem of cart) {
        const menuItem = menuItems.find((m) => m.id === cartItem.menuItemId);
        if (menuItem?.track_inventory && menuItem?.inventory_items) {
          const invItem = menuItem.inventory_items;
          if (invItem.current_stock < cartItem.quantity) {
            throw new Error(
              `Insufficient stock for "${cartItem.name}". Available: ${invItem.current_stock}`
            );
          }
        }
      }

      const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const totalAmount = subtotal;

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
          vat_amount: 0,
          service_charge: 0,
          total_amount: totalAmount,
          status: "completed",
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

      // Deduct stock for tracked items
      for (const cartItem of cart) {
        const menuItem = menuItems.find((m) => m.id === cartItem.menuItemId);
        if (menuItem?.track_inventory && menuItem?.inventory_item_id) {
          const invItem = menuItem.inventory_items;
          const newStock = invItem.current_stock - cartItem.quantity;
          
          // Update inventory stock
          await supabase
            .from("inventory_items")
            .update({ current_stock: newStock })
            .eq("id", menuItem.inventory_item_id);

          // Log stock movement
          await supabase.from("stock_movements").insert({
            inventory_item_id: menuItem.inventory_item_id,
            movement_type: "out",
            quantity: cartItem.quantity,
            previous_stock: invItem.current_stock,
            new_stock: newStock,
            notes: `Sold via POS - Order ${orderNumber}`,
            reference: order.id,
            created_by: user?.id,
          });
        }
      }

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
      setCheckoutCart([...cart]);
      setCompletedOrder(order);
      setCart([]);
      setTableNumber("");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
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

  const addToCart = (item: { id: string; name: string; price: number }) => {
    // Check stock availability for tracked items
    const menuItem = menuItems.find((m) => m.id === item.id);
    if (menuItem?.track_inventory && menuItem?.inventory_items) {
      const currentInCart = cart.find((c) => c.menuItemId === item.id)?.quantity || 0;
      if (currentInCart + 1 > menuItem.inventory_items.current_stock) {
        toast({
          title: "Out of Stock",
          description: `Only ${menuItem.inventory_items.current_stock} available for ${item.name}`,
          variant: "destructive",
        });
        return;
      }
    }

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
  const receiptSubtotal = checkoutCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
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
        />
        
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
        onConfirmPayment={(method) => createOrderMutation.mutate(method)}
        isProcessing={createOrderMutation.isPending}
        completedOrder={completedOrder}
        onClose={handleCloseCheckout}
      />
    </div>
  );
};

export default POS;
