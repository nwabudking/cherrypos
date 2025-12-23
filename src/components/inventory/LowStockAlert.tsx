import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import type { InventoryItem } from "@/pages/Inventory";

interface LowStockAlertProps {
  items: InventoryItem[];
  onViewItem: (item: InventoryItem) => void;
}

export const LowStockAlert = ({ items, onViewItem }: LowStockAlertProps) => {
  const criticalItems = items.filter((i) => i.current_stock <= 0);
  const lowItems = items.filter((i) => i.current_stock > 0 && i.current_stock <= i.min_stock_level);

  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Low Stock Warning</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-2">
          {criticalItems.length > 0 && (
            <div>
              <span className="font-medium">Out of Stock ({criticalItems.length}):</span>{" "}
              {criticalItems.slice(0, 3).map((item, i) => (
                <span key={item.id}>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-destructive underline"
                    onClick={() => onViewItem(item)}
                  >
                    {item.name}
                  </Button>
                  {i < Math.min(criticalItems.length, 3) - 1 && ", "}
                </span>
              ))}
              {criticalItems.length > 3 && ` and ${criticalItems.length - 3} more`}
            </div>
          )}
          {lowItems.length > 0 && (
            <div>
              <span className="font-medium">Low Stock ({lowItems.length}):</span>{" "}
              {lowItems.slice(0, 3).map((item, i) => (
                <span key={item.id}>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-destructive underline"
                    onClick={() => onViewItem(item)}
                  >
                    {item.name} ({item.current_stock} left)
                  </Button>
                  {i < Math.min(lowItems.length, 3) - 1 && ", "}
                </span>
              ))}
              {lowItems.length > 3 && ` and ${lowItems.length - 3} more`}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
