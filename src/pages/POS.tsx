import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useBarContext } from "@/contexts/BarContext";
import { useToast } from "@/hooks/use-toast";
import { useActiveMenuCategories } from "@/hooks/useMenu";
import { useMenuItemsWithInventory, useBarInventoryStock, getMenuItemStockInfo, validateCartStock } from "@/hooks/useBarStock";
import { useCreateOrder, CreateOrderData } from "@/hooks/useOrders";
import { POSHeader } from "@/components/pos/POSHeader";
import { CategoryTabs } from "@/components/pos/CategoryTabs";
import { MenuGrid } from "@/components/pos/MenuGrid";
import { CartPanel } from "@/components/pos/CartPanel";
import { CheckoutDialog } from "@/components/pos/CheckoutDialog";
import { BarSelector } from "@/components/pos/BarSelector";
import { StockWarningAlert } from "@/components/pos/StockWarningAlert";
import type { MenuCategory } from "@/hooks/useMenu";
import type { MenuItemStockInfo } from "@/hooks/useBarStock";

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
  const { user, role } = useAuth();
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
  const { data: menuItems = [] } = useMenuItemsWithInventory(selectedCategory || undefined);
  const { data: barStockMap } = useBarInventoryStock(activeBar?.id || null);

  const createOrderMutation = useCreateOrder();

  // Check if user can reprint (only admins/managers)
  const canReprint = role === "super_admin" || role === "manager";

  // Calculate stock info for each menu item
  const stockInfoMap = useMemo(() => {
    const map = new Map<string, MenuItemStockInfo>();
    
    menuItems.forEach(item => {
      // Calculate quantity in cart for this item's inventory
      const cartQty = cart
        .filter(c => c.menuItemId === item.id)
        .reduce((sum, c) => sum + c.quantity, 0);
      
      const stockInfo = getMenuItemStockInfo(
        { 
          id: item.id, 
          track_inventory: item.track_inventory, 
          inventory_item_id: item.inventory_item_id 
        },
        barStockMap,
        cartQty
      );
      map.set(item.id, stockInfo);
    });
    
    return map;
  }, [menuItems, barStockMap, cart]);

  // Validate cart stock before checkout
  const stockValidation = useMemo(() => {
    if (!barStockMap) return { valid: true, insufficientItems: [] };
    
    return validateCartStock(
      cart.map(c => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
      menuItems.map(m => ({ 
        id: m.id, 
        track_inventory: m.track_inventory, 
        inventory_item_id: m.inventory_item_id,
        name: m.name 
      })),
      barStockMap
    );
  }, [cart, menuItems, barStockMap]);

  const handleCheckout = async (paymentMethod: string) => {
    // Validate stock before proceeding
    if (!stockValidation.valid) {
      toast({
        title: "Insufficient Stock",
        description: "Some items in your cart exceed available inventory.",
        variant: "destructive",
      });
      return;
    }

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
        queryClient.invalidateQueries({ queryKey: ["bars"] });
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
    // Check stock before adding
    const stockInfo = stockInfoMap.get(item.id);
    if (stockInfo && !stockInfo.hasStock) {
      toast({
        title: "Out of Stock",
        description: `${item.name} is currently out of stock.`,
        variant: "destructive",
      });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        // Check if adding one more would exceed stock
        const menuItem = menuItems.find(m => m.id === item.id);
        if (menuItem?.track_inventory && menuItem.inventory_item_id && barStockMap) {
          const barStock = barStockMap.get(menuItem.inventory_item_id);
          if (barStock && existing.quantity >= barStock.current_stock) {
            toast({
              title: "Stock Limit Reached",
              description: `Only ${barStock.current_stock} units available.`,
              variant: "destructive",
            });
            return prev;
          }
        }
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
    setCart((prev) => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;

      // Check stock when increasing
      if (delta > 0) {
        const menuItem = menuItems.find(m => m.id === item.menuItemId);
        if (menuItem?.track_inventory && menuItem.inventory_item_id && barStockMap) {
          const barStock = barStockMap.get(menuItem.inventory_item_id);
          if (barStock && item.quantity >= barStock.current_stock) {
            toast({
              title: "Stock Limit Reached",
              description: `Only ${barStock.current_stock} units available.`,
              variant: "destructive",
            });
            return prev;
          }
        }
      }

      return prev
        .map((cartItem) =>
          cartItem.id === id ? { ...cartItem, quantity: Math.max(0, cartItem.quantity + delta) } : cartItem
        )
        .filter((cartItem) => cartItem.quantity > 0);
    });
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

  // Show warning if no bar selected and items need tracking
  const noBarSelected = !activeBar && menuItems.some(m => m.track_inventory);

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

        {noBarSelected && (
          <div className="px-4 pt-4">
            <StockWarningAlert 
              insufficientItems={[{ name: "No bar selected", available: 0, requested: 0 }]} 
            />
          </div>
        )}

        <CategoryTabs
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <MenuGrid 
          items={filteredMenuItems} 
          onAddToCart={addToCart} 
          stockInfoMap={stockInfoMap}
        />
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
        insufficientStock={stockValidation.insufficientItems}
        checkoutDisabled={!stockValidation.valid || cart.length === 0}
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
        canReprint={canReprint}
        insufficientStock={stockValidation.insufficientItems}
      />
    </div>
  );
};

export default POS;
