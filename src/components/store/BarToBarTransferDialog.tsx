import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBars, useBarInventory, barsKeys } from "@/hooks/useBars";
import { useEffectiveUser } from "@/hooks/useEffectiveUser";
import { toast } from "sonner";

interface BarToBarTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BarToBarTransferDialog = ({
  open,
  onOpenChange,
}: BarToBarTransferDialogProps) => {
  const queryClient = useQueryClient();
  const { data: bars = [] } = useBars();
  const { role, barId: assignedBarId, staffUserId, isLocalStaff, userId } = useEffectiveUser();
  
  const isAdmin = role === "super_admin" || role === "manager" || role === "store_admin";
  const isCashierOrWaiter = role === "cashier" || role === "waitstaff";
  
  // For local staff, always use staffUserId; for Supabase auth, userId will be used via auth.uid() in the function
  const effectiveStaffId = isLocalStaff ? staffUserId : null;
  
  const [sourceBarId, setSourceBarId] = useState<string>("");
  const [destinationBarId, setDestinationBarId] = useState<string>("");
  const [inventoryItemId, setInventoryItemId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState("");

  const effectiveSourceBarId = isCashierOrWaiter ? assignedBarId || "" : sourceBarId;
  const { data: sourceInventory = [] } = useBarInventory(effectiveSourceBarId);
  
  const selectedItem = sourceInventory.find(i => i.inventory_item_id === inventoryItemId);
  const activeBars = useMemo(() => bars.filter(b => b.is_active), [bars]);

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveSourceBarId || !destinationBarId || !inventoryItemId || quantity <= 0) {
        throw new Error("Please fill in all required fields");
      }

      if (effectiveSourceBarId === destinationBarId) {
        throw new Error("Source and destination bars must be different");
      }

      if (selectedItem && quantity > selectedItem.current_stock) {
        throw new Error("Insufficient stock at source bar");
      }

      // For local staff, require staff user ID
      if (isLocalStaff && !staffUserId) {
        throw new Error("Staff session expired. Please log in again.");
      }

      // Debug: log effective values
      console.log("Transfer context:", { 
        isLocalStaff, 
        staffUserId, 
        effectiveStaffId,
        isAdmin 
      });

      // Call RPC with explicit parameters - ensure p_staff_user_id is passed for local staff
      const { data, error } = await supabase.rpc("create_bar_to_bar_transfer", {
        p_source_bar_id: effectiveSourceBarId,
        p_destination_bar_id: destinationBarId,
        p_inventory_item_id: inventoryItemId,
        p_quantity: quantity,
        p_notes: notes || null,
        p_admin_complete: isAdmin,
        p_staff_user_id: isLocalStaff ? staffUserId : null,
      } as any);

      console.log("Transfer RPC response:", { data, error });

      if (error) throw error;
      const result = data as { success?: boolean; message?: string } | null;
      if (result && !result.success) {
        throw new Error(result.message || 'Transfer failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: barsKeys.all });
      toast.success(isAdmin ? 'Inventory transferred successfully' : 'Transfer request submitted');
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to transfer inventory');
    },
  });

  const resetForm = () => {
    setSourceBarId("");
    setDestinationBarId("");
    setInventoryItemId("");
    setQuantity(1);
    setNotes("");
  };

  

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Bar to Bar Transfer
          </DialogTitle>
          <DialogDescription>
            Transfer inventory between bar locations
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); transferMutation.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {isAdmin ? (
              <div className="space-y-2">
                <Label>From Bar</Label>
                <Select value={sourceBarId} onValueChange={(v) => { setSourceBarId(v); setInventoryItemId(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
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
                  <SelectValue placeholder="Select destination" />
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

          {(isCashierOrWaiter || sourceBarId) && (
            <div className="space-y-2">
              <Label>Item to Transfer</Label>
              <Select value={inventoryItemId} onValueChange={setInventoryItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {sourceInventory.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">No inventory at this bar</div>
                  ) : (
                    sourceInventory.map((item) => (
                      <SelectItem key={item.inventory_item_id} value={item.inventory_item_id}>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          <span>{item.inventory_item?.name}</span>
                          <span className="text-muted-foreground">({item.current_stock} {item.inventory_item?.unit})</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedItem && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <div className="flex justify-between">
                <span>Available at source:</span>
                <span className="font-bold">{selectedItem.current_stock} {selectedItem.inventory_item?.unit}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              max={selectedItem?.current_stock || 999}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for transfer..."
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={transferMutation.isPending || !effectiveSourceBarId || !destinationBarId || !inventoryItemId || quantity <= 0}
            >
              {transferMutation.isPending ? "Transferring..." : "Transfer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};