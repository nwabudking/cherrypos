import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useBarContext } from "@/contexts/BarContext";
import { useToast } from "@/hooks/use-toast";
import { useActiveMenuCategories } from "@/hooks/useMenu";
import { useMenuItemsWithInventory, useBarInventoryStock, getMenuItemStockInfo, validateCartStock } from "@/hooks/useBarStock";
import { useCreateOrder, CreateOrderData } from "@/hooks/useOrders";
import { useCashierAssignment } from "@/hooks/useCashierAssignment";
import { supabase } from "@/integrations/supabase/client";
import { POSHeader } from "@/components/pos/POSHeader";
import { CategoryTabs } from "@/components/pos/CategoryTabs";
import { MenuGrid } from "@/components/pos/MenuGrid";
import { CartPanel } from "@/components/pos/CartPanel";
import { CheckoutDialog } from "@/components/pos/CheckoutDialog";
import { BarSelector } from "@/components/pos/BarSelector";
import { CashierBarDisplay } from "@/components/pos/CashierBarDisplay";
import { StockWarningAlert } from "@/components/pos/StockWarningAlert";
import { HeldOrdersPanel, HeldOrder } from "@/components/pos/HeldOrdersPanel";
import { CashierRestrictionAlert } from "@/components/pos/CashierRestrictionAlert";
import type { MenuCategory } from "@/hooks/useMenu";
import type { MenuItemStockInfo } from "@/hooks/useBarStock";
import { Button } from "@/components/ui/button";
import { Pause } from "lucide-react";

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  inventoryItemId?: string | null;
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
  const { activeBar, setActiveBar, bars } = useBarContext();
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
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);

  const { data: categories = [] } = useActiveMenuCategories();
  const { data: menuItems = [] } = useMenuItemsWithInventory(selectedCategory || undefined);
  const { data: barStockMap } = useBarInventoryStock(activeBar?.id || null);
  
  // Check cashier assignment
  const { data: cashierAssignment, isLoading: isLoadingAssignment } = useCashierAssignment(user?.id || "");
  
  const createOrderMutation = useCreateOrder();

  // Check if user can reprint (only admins/managers can reprint)
  const canReprint = role === "super_admin" || role === "manager";
  
  // Check if user needs bar assignment (cashiers and waitstaff need assignment)
  const isCashier = role === "cashier";
  const isWaitstaff = role === "waitstaff";
  const isAssignedToBar = !!cashierAssignment;
  const isPrivilegedRole = role === "super_admin" || role === "manager" || role === "bar_staff";
  const canAccessPOS = (!isCashier && !isWaitstaff) || isAssignedToBar || isPrivilegedRole;

  // Auto-set active bar for cashiers based on their assignment
  useEffect(() => {
    if (cashierAssignment && cashierAssignment.bar) {
      const assignedBar = bars.find(b => b.id === cashierAssignment.bar_id);
      if (assignedBar && activeBar?.id !== assignedBar.id) {
        setActiveBar(assignedBar);
      }
    }
  }, [cashierAssignment, bars, activeBar, setActiveBar]);

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
      onSuccess: async (order) => {
        // Deduct inventory for items that track inventory
        if (activeBar?.id) {
          for (const cartItem of cart) {
            if (cartItem.inventoryItemId) {
              try {
                await supabase.rpc('deduct_bar_inventory', {
                  p_bar_id: activeBar.id,
                  p_inventory_item_id: cartItem.inventoryItemId,
                  p_quantity: cartItem.quantity,
                });
              } catch (err) {
                console.error('Failed to deduct inventory:', err);
              }
            }
          }
        }
        
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

    // Get the menu item to get inventory_item_id
    const menuItem = menuItems.find(m => m.id === item.id);
    const inventoryItemId = menuItem?.inventory_item_id || null;

    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        // Check if adding one more would exceed stock
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
          inventoryItemId,
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

  // Hold order function
  const holdCurrentOrder = () => {
    if (cart.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Add items to hold an order.",
        variant: "destructive",
      });
      return;
    }

    const heldOrder: HeldOrder = {
      id: crypto.randomUUID(),
      items: [...cart],
      orderType,
      tableNumber: tableNumber || undefined,
      holdTime: new Date(),
    };

    setHeldOrders(prev => [...prev, heldOrder]);
    setCart([]);
    setTableNumber("");
    toast({
      title: "Order Held",
      description: "Order has been put on hold. You can resume it later.",
    });
  };

  const resumeHeldOrder = (order: HeldOrder) => {
    // If cart has items, hold them first
    if (cart.length > 0) {
      const currentHeldOrder: HeldOrder = {
        id: crypto.randomUUID(),
        items: [...cart],
        orderType,
        tableNumber: tableNumber || undefined,
        holdTime: new Date(),
      };
      setHeldOrders(prev => [...prev, currentHeldOrder]);
    }

    setCart(order.items);
    setOrderType(order.orderType as OrderType);
    setTableNumber(order.tableNumber || "");
    setHeldOrders(prev => prev.filter(o => o.id !== order.id));
    toast({
      title: "Order Resumed",
      description: "Held order has been loaded to cart.",
    });
  };

  const deleteHeldOrder = (orderId: string) => {
    setHeldOrders(prev => prev.filter(o => o.id !== orderId));
    toast({
      title: "Order Removed",
      description: "Held order has been deleted.",
    });
  };

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

  // Show loading while checking assignment
  if (isLoadingAssignment) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show restriction if cashier not assigned
  if (!canAccessPOS) {
    return <CashierRestrictionAlert userName={user?.email?.split('@')[0]} />;
  }

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
          <div className="flex items-center gap-2">
            {/* Show bar selector for admins/managers, just display for cashiers/waitstaff */}
            {isCashier || isWaitstaff ? (
              <CashierBarDisplay />
            ) : (
              <BarSelector />
            )}
            {cart.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={holdCurrentOrder}
                className="gap-1"
              >
                <Pause className="h-4 w-4" />
                Hold
              </Button>
            )}
          </div>
        </POSHeader>

        {noBarSelected && (
          <div className="px-4 pt-4">
            <StockWarningAlert 
              insufficientItems={[{ name: "No bar selected", available: 0, requested: 0 }]} 
            />
          </div>
        )}

        {/* Held Orders Panel */}
        {heldOrders.length > 0 && (
          <div className="px-4 pt-4">
            <HeldOrdersPanel
              heldOrders={heldOrders}
              onResumeOrder={resumeHeldOrder}
              onDeleteHeldOrder={deleteHeldOrder}
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
        cashierName={activeBar?.name}
      />
    </div>
  );
};

export default POS;