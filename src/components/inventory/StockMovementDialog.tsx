import { useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import type { InventoryItem, MovementType } from "@/pages/Inventory";

interface StockMovementDialogProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (type: MovementType, quantity: number, notes?: string) => void;
  isSubmitting: boolean;
}

export const StockMovementDialog = ({
  item,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: StockMovementDialogProps) => {
  const [type, setType] = useState<MovementType>("in");
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState("");

  if (!item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity > 0) {
      onSubmit(type, quantity, notes || undefined);
    }
  };

  const getNewStock = () => {
    if (type === "in") return item.current_stock + quantity;
    if (type === "out") return Math.max(0, item.current_stock - quantity);
    return quantity;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Stock Movement</DialogTitle>
          <DialogDescription>
            Update stock for <strong>{item.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Current Stock</p>
              <p className="text-2xl font-bold">{item.current_stock} {item.unit}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">New Stock</p>
              <p className={`text-2xl font-bold ${getNewStock() <= item.min_stock_level ? 'text-destructive' : 'text-emerald-500'}`}>
                {getNewStock()} {item.unit}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Movement Type</Label>
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as MovementType)}
              className="grid grid-cols-3 gap-3"
            >
              <div
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  type === "in" ? "border-emerald-500 bg-emerald-500/10" : "border-border hover:bg-muted/50"
                }`}
                onClick={() => setType("in")}
              >
                <RadioGroupItem value="in" id="in" className="sr-only" />
                <ArrowUp className="h-4 w-4 text-emerald-500" />
                <Label htmlFor="in" className="cursor-pointer font-medium">
                  Stock In
                </Label>
              </div>

              <div
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  type === "out" ? "border-destructive bg-destructive/10" : "border-border hover:bg-muted/50"
                }`}
                onClick={() => setType("out")}
              >
                <RadioGroupItem value="out" id="out" className="sr-only" />
                <ArrowDown className="h-4 w-4 text-destructive" />
                <Label htmlFor="out" className="cursor-pointer font-medium">
                  Stock Out
                </Label>
              </div>

              <div
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  type === "adjustment" ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                }`}
                onClick={() => setType("adjustment")}
              >
                <RadioGroupItem value="adjustment" id="adjustment" className="sr-only" />
                <RefreshCw className="h-4 w-4 text-primary" />
                <Label htmlFor="adjustment" className="cursor-pointer font-medium">
                  Adjust
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">
              {type === "adjustment" ? "New Stock Level" : "Quantity"}
            </Label>
            <Input
              id="quantity"
              type="number"
              min={0}
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
              placeholder="e.g., Purchase order #123, Sold to customer, etc."
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || quantity <= 0}>
              {isSubmitting ? "Updating..." : "Update Stock"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
