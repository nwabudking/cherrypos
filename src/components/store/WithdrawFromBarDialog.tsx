import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useBars, useBarInventory } from "@/hooks/useBars";
import { AlertTriangle } from "lucide-react";

interface WithdrawFromBarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WithdrawFromBarDialog = ({
  open,
  onOpenChange,
}: WithdrawFromBarDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: bars = [] } = useBars();
  
  const [selectedBarId, setSelectedBarId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: barInventory = [] } = useBarInventory(selectedBarId);

  const selectedItem = barInventory.find(i => i.inventory_item_id === selectedItemId);

  const handleWithdraw = async () => {
    if (!selectedBarId || !selectedItemId || !quantity) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const qty = parseFloat(quantity);
    if (qty <= 0) {
      toast({ title: "Quantity must be greater than 0", variant: "destructive" });
      return;
    }

    if (selectedItem && qty > selectedItem.current_stock) {
      toast({ 
        title: "Insufficient stock", 
        description: `Available: ${selectedItem.current_stock}`,
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Deduct from bar inventory
      const { error: deductError } = await supabase
        .from('bar_inventory')
        .update({ 
          current_stock: selectedItem!.current_stock - qty,
          updated_at: new Date().toISOString()
        })
        .eq('bar_id', selectedBarId)
        .eq('inventory_item_id', selectedItemId);

      if (deductError) throw deductError;

      // Add withdrawn quantity back to store inventory
      const { data: storeItem, error: fetchError } = await supabase
        .from('inventory_items')
        .select('current_stock')
        .eq('id', selectedItemId)
        .single();

      if (fetchError) throw fetchError;

      const { error: updateStoreError } = await supabase
        .from('inventory_items')
        .update({ 
          current_stock: (storeItem?.current_stock || 0) + qty,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedItemId);

      if (updateStoreError) throw updateStoreError;

      // Log the withdrawal in audit_logs
      await supabase.from('audit_logs').insert({
        action_type: 'withdraw',
        entity_type: 'bar_inventory',
        entity_id: selectedItemId,
        new_data: {
          bar_id: selectedBarId,
          inventory_item_id: selectedItemId,
          quantity_withdrawn: qty,
          notes: notes || null,
          previous_stock: selectedItem!.current_stock,
          new_stock: selectedItem!.current_stock - qty,
          returned_to_store: true,
        },
      });

      toast({ 
        title: "Withdrawal successful", 
        description: `${qty} units withdrawn from ${bars.find(b => b.id === selectedBarId)?.name} and returned to store` 
      });

      // Reset form
      setSelectedBarId("");
      setSelectedItemId("");
      setQuantity("");
      setNotes("");
      onOpenChange(false);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["bar-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["bars"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    } catch (error: any) {
      toast({ 
        title: "Withdrawal failed", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBarChange = (barId: string) => {
    setSelectedBarId(barId);
    setSelectedItemId("");
    setQuantity("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Withdraw from Bar
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Bar *</Label>
            <Select value={selectedBarId} onValueChange={handleBarChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a bar" />
              </SelectTrigger>
              <SelectContent>
                {bars.filter(b => b.is_active).map((bar) => (
                  <SelectItem key={bar.id} value={bar.id}>
                    {bar.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Select Item *</Label>
            <Select 
              value={selectedItemId} 
              onValueChange={setSelectedItemId}
              disabled={!selectedBarId || barInventory.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={!selectedBarId ? "Select a bar first" : "Select an item"} />
              </SelectTrigger>
              <SelectContent>
                {barInventory.map((item) => (
                  <SelectItem key={item.inventory_item_id} value={item.inventory_item_id}>
                    {item.inventory_item?.name} ({item.current_stock} available)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedItem && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedItem.inventory_item?.name}</p>
              <p className="text-sm text-muted-foreground">
                Available: {selectedItem.current_stock} {selectedItem.inventory_item?.unit}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Quantity to Withdraw *</Label>
            <Input
              type="number"
              placeholder={`Max: ${selectedItem?.current_stock || 0}`}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min={0}
              max={selectedItem?.current_stock || 0}
            />
          </div>

          <div className="space-y-2">
            <Label>Reason/Notes</Label>
            <Textarea
              placeholder="Reason for withdrawal (e.g., damaged, expired, correction)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <p className="text-sm text-amber-700 font-medium">
              Note: Withdrawn items will be returned to the store inventory.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={handleWithdraw} 
            disabled={isSubmitting || !selectedBarId || !selectedItemId || !quantity}
          >
            {isSubmitting ? "Withdrawing..." : "Withdraw"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
