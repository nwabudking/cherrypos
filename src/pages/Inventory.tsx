import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { InventoryHeader } from "@/components/inventory/InventoryHeader";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { InventoryItemDialog } from "@/components/inventory/InventoryItemDialog";
import { StockMovementDialog } from "@/components/inventory/StockMovementDialog";
import { LowStockAlert } from "@/components/inventory/LowStockAlert";

export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  current_stock: number;
  min_stock_level: number;
  cost_per_unit: number | null;
  supplier: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export type MovementType = "in" | "out" | "adjustment";

const Inventory = () => {
  const { toast } = useToast();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showLowStock, setShowLowStock] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as InventoryItem[];
    },
  });

  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))];

  const lowStockItems = items.filter((i) => i.current_stock <= i.min_stock_level);

  const filteredItems = items.filter((item) => {
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesLowStock = !showLowStock || item.current_stock <= item.min_stock_level;
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const saveItemMutation = useMutation({
    mutationFn: async (item: Partial<InventoryItem> & { id?: string }) => {
      if (item.id) {
        const { id, ...updateData } = item;
        const { error } = await supabase
          .from("inventory_items")
          .update(updateData)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { id, ...insertData } = item;
        const { error } = await supabase.from("inventory_items").insert(insertData as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Inventory item saved." });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      setIsItemDialogOpen(false);
      setSelectedItem(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save item.", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("inventory_items")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Item removed from inventory." });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete item.", variant: "destructive" });
    },
  });

  const stockMovementMutation = useMutation({
    mutationFn: async ({
      itemId,
      type,
      quantity,
      notes,
    }: {
      itemId: string;
      type: MovementType;
      quantity: number;
      notes?: string;
    }) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) throw new Error("Item not found");

      let newStock: number;
      if (type === "in") {
        newStock = item.current_stock + quantity;
      } else if (type === "out") {
        newStock = item.current_stock - quantity;
      } else {
        newStock = quantity;
      }

      // Create movement record
      const { error: movementError } = await supabase.from("stock_movements").insert({
        inventory_item_id: itemId,
        movement_type: type,
        quantity,
        previous_stock: item.current_stock,
        new_stock: newStock,
        notes,
        created_by: user?.id,
      });

      if (movementError) throw movementError;

      // Update item stock
      const { error: updateError } = await supabase
        .from("inventory_items")
        .update({ current_stock: newStock })
        .eq("id", itemId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast({ title: "Stock Updated", description: "Stock movement recorded." });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      setIsMovementDialogOpen(false);
      setMovementItem(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update stock.", variant: "destructive" });
    },
  });

  const canManage = role === "super_admin" || role === "manager" || role === "inventory_officer";

  const handleAddItem = () => {
    setSelectedItem(null);
    setIsItemDialogOpen(true);
  };

  const handleEditItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsItemDialogOpen(true);
  };

  const handleStockMovement = (item: InventoryItem) => {
    setMovementItem(item);
    setIsMovementDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <InventoryHeader
        totalItems={items.length}
        lowStockCount={lowStockItems.length}
        onAddItem={handleAddItem}
        canManage={canManage}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        categories={categories as string[]}
        showLowStock={showLowStock}
        setShowLowStock={setShowLowStock}
      />

      {lowStockItems.length > 0 && (
        <LowStockAlert items={lowStockItems} onViewItem={handleStockMovement} />
      )}

      <InventoryTable
        items={filteredItems}
        isLoading={isLoading}
        onEdit={handleEditItem}
        onDelete={(id) => deleteItemMutation.mutate(id)}
        onStockMovement={handleStockMovement}
        canManage={canManage}
      />

      <InventoryItemDialog
        item={selectedItem}
        open={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
        onSave={(data) => saveItemMutation.mutate(data)}
        isSaving={saveItemMutation.isPending}
        categories={categories as string[]}
      />

      <StockMovementDialog
        item={movementItem}
        open={isMovementDialogOpen}
        onOpenChange={setIsMovementDialogOpen}
        onSubmit={(type, quantity, notes) =>
          movementItem && stockMovementMutation.mutate({
            itemId: movementItem.id,
            type,
            quantity,
            notes,
          })
        }
        isSubmitting={stockMovementMutation.isPending}
      />
    </div>
  );
};

export default Inventory;
