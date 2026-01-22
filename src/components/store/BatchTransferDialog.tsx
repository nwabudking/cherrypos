import { useState, forwardRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useBars, useBarInventory, barsKeys, BarInventoryItem } from "@/hooks/useBars";
import { useCashierAssignment } from "@/hooks/useCashierAssignment";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, ArrowRightLeft, Trash2 } from "lucide-react";

interface BatchTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TransferItem {
  inventoryItemId: string;
  itemName: string;
  unit: string;
  availableStock: number;
  quantity: number;
}

export const BatchTransferDialog = forwardRef<HTMLDivElement, BatchTransferDialogProps>(
  ({ open, onOpenChange }, ref) => {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const assignmentQuery = useCashierAssignment(user?.id || "");
  const assignment = assignmentQuery.data;
  
  const isAdmin = role === "super_admin" || role === "manager" || role === "store_admin";
  const isCashier = role === "cashier";
  const assignedBarId = assignment?.bar_id;

  const { data: bars = [] } = useBars();
  const [sourceBarId, setSourceBarId] = useState("");
  const [destinationBarId, setDestinationBarId] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState<TransferItem[]>([]);
  const [selectAllMode, setSelectAllMode] = useState(false);

  const effectiveSourceBarId = isCashier ? assignedBarId || "" : sourceBarId;
  const { data: sourceInventory = [] } = useBarInventory(effectiveSourceBarId);
  
  const activeBars = bars.filter(b => b.is_active);

  const batchTransferMutation = useMutation({
    mutationFn: async () => {
      if (selectedItems.length === 0) throw new Error("No items selected");
      if (!destinationBarId) throw new Error("No destination bar selected");
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      for (const item of selectedItems) {
        if (item.quantity <= 0 || item.quantity > item.availableStock) {
          throw new Error(`Invalid quantity for ${item.itemName}`);
        }
        
        // Get current stock
        const { data: sourceInv, error: stockError } = await supabase
          .from('bar_inventory')
          .select('current_stock')
          .eq('bar_id', effectiveSourceBarId)
          .eq('inventory_item_id', item.inventoryItemId)
          .single();
        
        if (stockError || !sourceInv || sourceInv.current_stock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.itemName}`);
        }
        
        if (isAdmin) {
          // Admin: Execute immediately
          // Deduct from source
          await supabase
            .from('bar_inventory')
            .update({
              current_stock: sourceInv.current_stock - item.quantity,
              updated_at: new Date().toISOString()
            })
            .eq('bar_id', effectiveSourceBarId)
            .eq('inventory_item_id', item.inventoryItemId);
          
          // Add to destination
          const { data: destInv } = await supabase
            .from('bar_inventory')
            .select('*')
            .eq('bar_id', destinationBarId)
            .eq('inventory_item_id', item.inventoryItemId)
            .maybeSingle();
          
          if (destInv) {
            await supabase
              .from('bar_inventory')
              .update({
                current_stock: destInv.current_stock + item.quantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', destInv.id);
          } else {
            await supabase
              .from('bar_inventory')
              .insert({
                bar_id: destinationBarId,
                inventory_item_id: item.inventoryItemId,
                current_stock: item.quantity,
                min_stock_level: 5,
              });
          }
          
          // Record the transfer
          await supabase
            .from('bar_to_bar_transfers')
            .insert({
              source_bar_id: effectiveSourceBarId,
              destination_bar_id: destinationBarId,
              inventory_item_id: item.inventoryItemId,
              quantity: item.quantity,
              notes: notes || `Batch transfer: ${selectedItems.length} items`,
              status: 'completed',
              requested_by: currentUser?.id,
              approved_by: currentUser?.id,
              completed_at: new Date().toISOString(),
            });
        } else {
          // Cashier: Create pending requests
          await supabase
            .from('bar_to_bar_transfers')
            .insert({
              source_bar_id: effectiveSourceBarId,
              destination_bar_id: destinationBarId,
              inventory_item_id: item.inventoryItemId,
              quantity: item.quantity,
              notes: notes || `Batch transfer request: ${selectedItems.length} items`,
              status: 'pending',
              requested_by: currentUser?.id,
            });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: barsKeys.all });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(
        isAdmin 
          ? `${selectedItems.length} items transferred successfully` 
          : `${selectedItems.length} transfer requests submitted`
      );
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to process batch transfer');
    },
  });

  const resetForm = () => {
    setSourceBarId("");
    setDestinationBarId("");
    setNotes("");
    setSelectedItems([]);
    setSelectAllMode(false);
  };

  const handleSourceChange = (barId: string) => {
    setSourceBarId(barId);
    setSelectedItems([]);
  };

  const toggleItemSelection = (item: BarInventoryItem) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.inventoryItemId === item.inventory_item_id);
      if (exists) {
        return prev.filter(i => i.inventoryItemId !== item.inventory_item_id);
      } else {
        return [...prev, {
          inventoryItemId: item.inventory_item_id,
          itemName: item.inventory_item?.name || 'Unknown',
          unit: item.inventory_item?.unit || 'units',
          availableStock: item.current_stock,
          quantity: Math.min(1, item.current_stock),
        }];
      }
    });
  };

  const updateItemQuantity = (inventoryItemId: string, quantity: number) => {
    setSelectedItems(prev => prev.map(item => 
      item.inventoryItemId === inventoryItemId 
        ? { ...item, quantity: Math.min(Math.max(1, quantity), item.availableStock) }
        : item
    ));
  };

  const removeSelectedItem = (inventoryItemId: string) => {
    setSelectedItems(prev => prev.filter(i => i.inventoryItemId !== inventoryItemId));
  };

  const handleSelectAll = () => {
    if (selectAllMode) {
      setSelectedItems([]);
      setSelectAllMode(false);
    } else {
      const allItems = sourceInventory
        .filter(item => item.current_stock > 0)
        .map(item => ({
          inventoryItemId: item.inventory_item_id,
          itemName: item.inventory_item?.name || 'Unknown',
          unit: item.inventory_item?.unit || 'units',
          availableStock: item.current_stock,
          quantity: 1,
        }));
      setSelectedItems(allItems);
      setSelectAllMode(true);
    }
  };

  const totalItemsToTransfer = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Batch Transfer
          </DialogTitle>
          <DialogDescription>
            {isAdmin 
              ? "Transfer multiple items between bars at once" 
              : "Request transfer of multiple items. The receiving cashier must accept."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {isAdmin ? (
            <div className="space-y-2">
              <Label>From Bar</Label>
              <Select value={sourceBarId} onValueChange={handleSourceChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source bar" />
                </SelectTrigger>
                <SelectContent>
                  {activeBars.map((bar) => (
                    <SelectItem key={bar.id} value={bar.id} disabled={bar.id === destinationBarId}>
                      {bar.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-muted-foreground">From Bar</Label>
              <div className="p-2 rounded-lg bg-muted/50 font-medium">
                {bars.find(b => b.id === assignedBarId)?.name || 'Loading...'}
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label>To Bar</Label>
            <Select value={destinationBarId} onValueChange={setDestinationBarId}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination bar" />
              </SelectTrigger>
              <SelectContent>
                {activeBars.filter(bar => bar.id !== effectiveSourceBarId).map((bar) => (
                  <SelectItem key={bar.id} value={bar.id}>
                    {bar.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(isCashier || sourceBarId) && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Items to Transfer</Label>
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectAllMode ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <ScrollArea className="h-[180px] border rounded-lg p-2">
                {sourceInventory.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No inventory items at this bar</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {sourceInventory.filter(item => item.current_stock > 0).map((item) => {
                      const isSelected = selectedItems.some(i => i.inventoryItemId === item.inventory_item_id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItemSelection(item)}
                          className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                            isSelected 
                              ? 'border-primary bg-primary/10' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox checked={isSelected} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.inventory_item?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.current_stock} {item.inventory_item?.unit} available
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            {selectedItems.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Selected Items
                  <Badge>{selectedItems.length}</Badge>
                </Label>
                <ScrollArea className="h-[150px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="w-[100px]">Quantity</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItems.map((item) => (
                        <TableRow key={item.inventoryItemId}>
                          <TableCell className="font-medium">{item.itemName}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {item.availableStock} {item.unit}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              max={item.availableStock}
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(item.inventoryItemId, parseInt(e.target.value) || 1)}
                              className="w-20 h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => removeSelectedItem(item.inventoryItemId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                <p className="text-sm text-muted-foreground text-right">
                  Total: {totalItemsToTransfer} units across {selectedItems.length} items
                </p>
              </div>
            )}
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="batch-notes">Notes (Optional)</Label>
          <Textarea
            id="batch-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for batch transfer..."
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => batchTransferMutation.mutate()}
            disabled={
              batchTransferMutation.isPending ||
              selectedItems.length === 0 ||
              !destinationBarId ||
              (isAdmin && !sourceBarId && !isCashier)
            }
          >
            {batchTransferMutation.isPending 
              ? "Processing..." 
              : isAdmin 
                ? `Transfer ${selectedItems.length} Items` 
                : `Request ${selectedItems.length} Items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

BatchTransferDialog.displayName = "BatchTransferDialog";
