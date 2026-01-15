import { useStockMovements } from "@/hooks/useInventory";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, FileDown, FileSpreadsheet } from "lucide-react";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";

export const StockHistoryTab = () => {
  const { data: movements = [], isLoading } = useStockMovements();

  const getMovementIcon = (type: string) => {
    switch (type) {
      case "in":
        return <ArrowUpCircle className="h-4 w-4 text-emerald-500" />;
      case "out":
        return <ArrowDownCircle className="h-4 w-4 text-destructive" />;
      default:
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
    }
  };

  const getMovementBadge = (type: string) => {
    switch (type) {
      case "in":
        return <Badge className="bg-emerald-500/10 text-emerald-500">Stock In</Badge>;
      case "out":
        return <Badge className="bg-destructive/10 text-destructive">Stock Out</Badge>;
      default:
        return <Badge className="bg-blue-500/10 text-blue-500">Adjustment</Badge>;
    }
  };

  const handleExportPDF = () => {
    const data = movements.map((m) => ({
      "Date & Time": m.created_at ? format(new Date(m.created_at), "MMM dd, yyyy HH:mm") : "-",
      Item: (m as any).inventory_items?.name || "Unknown",
      Type: m.movement_type === "in" ? "Stock In" : m.movement_type === "out" ? "Stock Out" : "Adjustment",
      Previous: m.previous_stock,
      Quantity: `${m.movement_type === "in" ? "+" : m.movement_type === "out" ? "-" : ""}${m.quantity}`,
      "New Stock": m.new_stock,
      Notes: m.notes || "-",
    }));
    exportToPDF(data, "Stock Movement History", "stock_history");
  };

  const handleExportExcel = () => {
    const data = movements.map((m) => ({
      date: m.created_at ? format(new Date(m.created_at), "yyyy-MM-dd HH:mm") : "",
      item: (m as any).inventory_items?.name || "Unknown",
      type: m.movement_type,
      previous_stock: m.previous_stock,
      quantity: m.quantity,
      new_stock: m.new_stock,
      notes: m.notes || "",
    }));
    exportToExcel("stock_history", data, [
      { key: "date", header: "Date" },
      { key: "item", header: "Item" },
      { key: "type", header: "Type" },
      { key: "previous_stock", header: "Previous Stock" },
      { key: "quantity", header: "Quantity" },
      { key: "new_stock", header: "New Stock" },
      { key: "notes", header: "Notes" },
    ]);
  };

  if (isLoading) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Loading stock history...
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExportPDF}>
          <FileDown className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      <Card>
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Previous</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">New Stock</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>
                    {movement.created_at && format(new Date(movement.created_at), "MMM dd, yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {(movement as any).inventory_items?.name || "Unknown"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getMovementIcon(movement.movement_type)}
                      {getMovementBadge(movement.movement_type)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{movement.previous_stock}</TableCell>
                  <TableCell className="text-right font-medium">
                    {movement.movement_type === "in" ? "+" : movement.movement_type === "out" ? "-" : ""}
                    {movement.quantity}
                  </TableCell>
                  <TableCell className="text-right">{movement.new_stock}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {movement.notes || "-"}
                  </TableCell>
                </TableRow>
              ))}
              {movements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No stock movements recorded
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    </div>
  );
};
