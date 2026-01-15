import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  useInventoryItems,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  useSuppliers,
  useAddStock,
  useRemoveStock,
  useAdjustStock,
} from "@/hooks/useInventory";
import { useBars, useTransferToBar, useInventoryTransfers } from "@/hooks/useBars";
import { usePriceRealtimeSync } from "@/hooks/usePriceRealtimeSync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Package, 
  ArrowRightLeft, 
  AlertTriangle, 
  Plus, 
  Search, 
  Send,
  History,
  Warehouse,
  MoreHorizontal,
  Pencil,
  Trash2,
  PackagePlus,
  UtensilsCrossed,
  FolderPlus,
  FileSpreadsheet,
  Store,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { InventoryItemDialog } from "@/components/inventory/InventoryItemDialog";
import { StockMovementDialog } from "@/components/inventory/StockMovementDialog";
import { AddCategoryDialog } from "@/components/inventory/AddCategoryDialog";
import { MenuItemsTab } from "@/components/menu/MenuItemsTab";
import { CategoriesTab } from "@/components/menu/CategoriesTab";
import { StockHistoryTab } from "@/components/store/StockHistoryTab";
import { BarInventoryLevelsTab } from "@/components/store/BarInventoryLevelsTab";
import { BulkImportDialog } from "@/components/store/BulkImportDialog";
import { ExpiryAlert } from "@/components/store/ExpiryAlert";
import type { InventoryItem } from "@/types/inventory";

type MovementType = "in" | "out" | "adjustment";

const StorePage = () => {
  const { toast } = useToast();
  const { role } = useAuth();
  const queryClient = useQueryClient();

  // Filters and search
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showLowStock, setShowLowStock] = useState(false);
  
  // Transfer dialog state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedTransferItem, setSelectedTransferItem] = useState<InventoryItem | null>(null);
  const [selectedBarId, setSelectedBarId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  
  // Item dialog state
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  
  // Stock movement dialog state
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  
  // Category dialog state
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  
  // Bulk import dialog
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  
  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);

  // Data hooks
  const { data: items = [], isLoading } = useInventoryItems();
  const { data: bars = [] } = useBars();
  const { data: transfers = [] } = useInventoryTransfers();
  const { data: suppliers = [] } = useSuppliers();
  
  // Enable real-time price sync
  usePriceRealtimeSync();
  const transferMutation = useTransferToBar();
  
  // CRUD mutations
  const createItemMutation = useCreateInventoryItem();
  const updateItemMutation = useUpdateInventoryItem();
  const deleteItemMutation = useDeleteInventoryItem();
  const addStockMutation = useAddStock();
  const removeStockMutation = useRemoveStock();
  const adjustStockMutation = useAdjustStock();

  const itemCategories = [...new Set(items.map((i) => i.category).filter(Boolean))] as string[];
  const categories = [...new Set([...itemCategories, ...customCategories])];
  const lowStockItems = items.filter((i) => i.current_stock <= i.min_stock_level);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesLowStock = !showLowStock || item.current_stock <= item.min_stock_level;
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const canManage = role === "super_admin" || role === "manager" || role === "inventory_officer" || role === "store_admin";
  const canTransfer = role === "super_admin" || role === "manager" || role === "store_admin";

  // Transfer handlers
  const handleTransferClick = (item: InventoryItem) => {
    setSelectedTransferItem(item);
    setSelectedBarId("");
    setTransferQuantity("");
    setTransferNotes("");
    setTransferDialogOpen(true);
  };

  const handleTransfer = () => {
    if (!selectedTransferItem || !selectedBarId || !transferQuantity) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const qty = parseFloat(transferQuantity);
    if (qty <= 0 || qty > selectedTransferItem.current_stock) {
      toast({ 
        title: "Invalid quantity", 
        description: `Available: ${selectedTransferItem.current_stock} ${selectedTransferItem.unit}`,
        variant: "destructive" 
      });
      return;
    }

    transferMutation.mutate(
      {
        barId: selectedBarId,
        inventoryItemId: selectedTransferItem.id,
        quantity: qty,
        notes: transferNotes || undefined,
      },
      {
        onSuccess: () => {
          setTransferDialogOpen(false);
          setSelectedTransferItem(null);
        },
      }
    );
  };

  // Item CRUD handlers
  const handleAddItem = () => {
    setSelectedItem(null);
    setIsItemDialogOpen(true);
  };

  const handleEditItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsItemDialogOpen(true);
  };

  const handleDeleteClick = (item: InventoryItem) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (itemToDelete) {
      deleteItemMutation.mutate(itemToDelete.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setItemToDelete(null);
        },
      });
    }
  };

  const handleSaveItem = (data: Partial<InventoryItem> & { id?: string }) => {
    if (data.id) {
      updateItemMutation.mutate(
        { id: data.id, data },
        {
          onSuccess: () => {
            setIsItemDialogOpen(false);
            setSelectedItem(null);
          },
        }
      );
    } else if (data.name) {
      createItemMutation.mutate(
        { ...data, name: data.name } as { name: string } & Partial<InventoryItem>,
        {
          onSuccess: () => {
            setIsItemDialogOpen(false);
            setSelectedItem(null);
          },
        }
      );
    }
  };

  // Stock movement handlers
  const handleStockMovement = (item: InventoryItem) => {
    setMovementItem(item);
    setIsMovementDialogOpen(true);
  };

  const handleStockMovementSubmit = (
    type: MovementType,
    quantity: number,
    notes?: string,
    costPrice?: number,
    sellingPrice?: number
  ) => {
    if (!movementItem) return;

    if (type === "in") {
      addStockMutation.mutate(
        { itemId: movementItem.id, quantity, notes, costPrice, sellingPrice },
        {
          onSuccess: () => {
            setIsMovementDialogOpen(false);
            setMovementItem(null);
          },
        }
      );
    } else if (type === "out") {
      removeStockMutation.mutate(
        { itemId: movementItem.id, quantity, notes },
        {
          onSuccess: () => {
            setIsMovementDialogOpen(false);
            setMovementItem(null);
          },
        }
      );
    } else {
      adjustStockMutation.mutate(
        { itemId: movementItem.id, newStock: quantity, notes },
        {
          onSuccess: () => {
            setIsMovementDialogOpen(false);
            setMovementItem(null);
          },
        }
      );
    }
  };

  // Category handler
  const handleAddCategory = (category: string) => {
    setCustomCategories((prev) => [...prev, category]);
    toast({ title: "Category Added", description: `"${category}" is now available for items.` });
  };

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined) return "-";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(price);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Warehouse className="h-6 w-6 text-primary" />
            Store Management
          </h1>
          <p className="text-muted-foreground">
            Central inventory, menu, and bar transfers
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{items.length}</p>
                <p className="text-sm text-muted-foreground">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={lowStockItems.length > 0 ? "border-amber-500" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${lowStockItems.length > 0 ? "bg-amber-500/10" : "bg-muted"}`}>
                <AlertTriangle className={`h-5 w-5 ${lowStockItems.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{lowStockItems.length}</p>
                <p className="text-sm text-muted-foreground">Low Stock</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <ArrowRightLeft className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{bars.length}</p>
                <p className="text-sm text-muted-foreground">Active Bars</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <History className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{transfers.length}</p>
                <p className="text-sm text-muted-foreground">Transfers Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiry Alert */}
      <ExpiryAlert 
        items={items.map(i => ({
          id: i.id,
          name: i.name,
          expiry_date: i.expiry_date || '',
          current_stock: i.current_stock,
          unit: i.unit,
        }))}
        warningDays={30}
      />

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="inventory">Store Inventory</TabsTrigger>
          <TabsTrigger value="menu">Menu Items</TabsTrigger>
          <TabsTrigger value="categories">Menu Categories</TabsTrigger>
          <TabsTrigger value="transfers">Transfer History</TabsTrigger>
          <TabsTrigger value="stock-history">Stock History</TabsTrigger>
          <TabsTrigger value="bar-levels">Bar Inventory Levels</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showLowStock ? "default" : "outline"}
              onClick={() => setShowLowStock(!showLowStock)}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Low Stock Only
            </Button>
            
            {canManage && (
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Bulk Import
                </Button>
                <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
                <Button onClick={handleAddItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            )}
          </div>

          {/* Inventory Table */}
          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Min Level</TableHead>
                    <TableHead className="text-right">Cost Price</TableHead>
                    <TableHead className="text-right">Selling Price</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const isLowStock = item.current_stock <= item.min_stock_level;
                    const isOutOfStock = item.current_stock <= 0;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.category || "Uncategorized"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.current_stock} {item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.min_stock_level} {item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPrice(item.cost_per_unit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPrice((item as any).selling_price)}
                        </TableCell>
                        <TableCell>
                          {isOutOfStock ? (
                            <Badge variant="destructive">Out of Stock</Badge>
                          ) : isLowStock ? (
                            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                              In Stock
                            </Badge>
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleStockMovement(item)}>
                                  <PackagePlus className="h-4 w-4 mr-2" />
                                  Stock Movement
                                </DropdownMenuItem>
                                {canTransfer && (
                                  <DropdownMenuItem 
                                    onClick={() => handleTransferClick(item)}
                                    disabled={item.current_stock <= 0}
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    Transfer to Bar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleEditItem(item)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteClick(item)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No items found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="menu" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" />
                Menu Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MenuItemsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Menu Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoriesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transfers</CardTitle>
            </CardHeader>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell>
                        {transfer.created_at && formatDistanceToNow(new Date(transfer.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {transfer.inventory_item?.name || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {transfer.destination_bar?.name || "Unknown Bar"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {transfer.quantity} {transfer.inventory_item?.unit}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {transfer.notes || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                          {transfer.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {transfers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No transfers yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="stock-history">
          <StockHistoryTab />
        </TabsContent>

        <TabsContent value="bar-levels">
          <BarInventoryLevelsTab />
        </TabsContent>
      </Tabs>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer to Bar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedTransferItem && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedTransferItem.name}</p>
                <p className="text-sm text-muted-foreground">
                  Available: {selectedTransferItem.current_stock} {selectedTransferItem.unit}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Destination Bar *</Label>
              <Select value={selectedBarId} onValueChange={setSelectedBarId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bar" />
                </SelectTrigger>
                <SelectContent>
                  {bars.map((bar) => (
                    <SelectItem key={bar.id} value={bar.id}>
                      {bar.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input
                type="number"
                placeholder={`Max: ${selectedTransferItem?.current_stock || 0}`}
                value={transferQuantity}
                onChange={(e) => setTransferQuantity(e.target.value)}
                min={0}
                max={selectedTransferItem?.current_stock || 0}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add notes about this transfer..."
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleTransfer} 
              disabled={transferMutation.isPending}
            >
              {transferMutation.isPending ? "Transferring..." : "Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inventory Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteItemMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Inventory Item Dialog */}
      <InventoryItemDialog
        item={selectedItem}
        open={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
        onSave={handleSaveItem}
        isSaving={createItemMutation.isPending || updateItemMutation.isPending}
        categories={categories}
        suppliers={suppliers}
      />

      {/* Stock Movement Dialog */}
      <StockMovementDialog
        item={movementItem}
        open={isMovementDialogOpen}
        onOpenChange={setIsMovementDialogOpen}
        onSubmit={handleStockMovementSubmit}
        isSubmitting={
          addStockMutation.isPending ||
          removeStockMutation.isPending ||
          adjustStockMutation.isPending
        }
      />

      {/* Add Category Dialog */}
      <AddCategoryDialog
        open={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
        existingCategories={categories}
        onAddCategory={handleAddCategory}
      />

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
      />
    </div>
  );
};

export default StorePage;
