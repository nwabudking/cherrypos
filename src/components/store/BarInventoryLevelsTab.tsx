import { useState } from "react";
import { useBars, useBarInventory } from "@/hooks/useBars";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Package, Store, FileDown, FileSpreadsheet } from "lucide-react";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";

export const BarInventoryLevelsTab = () => {
  const { data: bars = [] } = useBars();
  const [selectedBarId, setSelectedBarId] = useState<string>("");

  const { data: inventory = [], isLoading } = useBarInventory(selectedBarId);

  const activeBars = bars.filter(bar => bar.is_active);
  const lowStockCount = inventory.filter(
    item => item.current_stock <= item.min_stock_level
  ).length;
  const outOfStockCount = inventory.filter(item => item.current_stock <= 0).length;

  const selectedBar = bars.find(b => b.id === selectedBarId);

  const handleExportPDF = () => {
    if (!selectedBar) return;
    const data = inventory.map((item) => {
      const isOutOfStock = item.current_stock <= 0;
      const isLowStock = item.current_stock <= item.min_stock_level;
      return {
        Item: item.inventory_item?.name || "Unknown",
        "Current Stock": `${item.current_stock} ${item.inventory_item?.unit || ""}`,
        "Min Level": item.min_stock_level,
        Status: isOutOfStock ? "Out of Stock" : isLowStock ? "Low Stock" : "In Stock",
      };
    });
    exportToPDF(data, `Bar Inventory - ${selectedBar.name}`, `bar_inventory_${selectedBar.name}`);
  };

  const handleExportExcel = () => {
    if (!selectedBar) return;
    const data = inventory.map((item) => {
      const isOutOfStock = item.current_stock <= 0;
      const isLowStock = item.current_stock <= item.min_stock_level;
      return {
        item: item.inventory_item?.name || "Unknown",
        current_stock: item.current_stock,
        unit: item.inventory_item?.unit || "",
        min_level: item.min_stock_level,
        status: isOutOfStock ? "Out of Stock" : isLowStock ? "Low Stock" : "In Stock",
      };
    });
    exportToExcel(`bar_inventory_${selectedBar.name.toLowerCase().replace(/\s+/g, '_')}`, data, [
      { key: "item", header: "Item" },
      { key: "current_stock", header: "Current Stock" },
      { key: "unit", header: "Unit" },
      { key: "min_level", header: "Min Level" },
      { key: "status", header: "Status" },
    ]);
  };

  return (
    <div className="space-y-4">
      {/* Bar Selector and Export */}
      <div className="flex items-center justify-between gap-4">
        <Select value={selectedBarId} onValueChange={setSelectedBarId}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Select a bar to view inventory" />
          </SelectTrigger>
          <SelectContent>
            {activeBars.map((bar) => (
              <SelectItem key={bar.id} value={bar.id}>
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  {bar.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedBarId && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        )}
      </div>

      {!selectedBarId ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a bar to view its inventory levels</p>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{inventory.length}</p>
                    <p className="text-sm text-muted-foreground">Total Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={lowStockCount > 0 ? "border-amber-500" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${lowStockCount > 0 ? "bg-amber-500/10" : "bg-muted"}`}>
                    <AlertTriangle className={`h-5 w-5 ${lowStockCount > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{lowStockCount}</p>
                    <p className="text-sm text-muted-foreground">Low Stock Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={outOfStockCount > 0 ? "border-destructive" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${outOfStockCount > 0 ? "bg-destructive/10" : "bg-muted"}`}>
                    <Package className={`h-5 w-5 ${outOfStockCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{outOfStockCount}</p>
                    <p className="text-sm text-muted-foreground">Out of Stock</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Inventory Table */}
          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Min Level</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.map((item) => {
                    const isLowStock = item.current_stock <= item.min_stock_level;
                    const isOutOfStock = item.current_stock <= 0;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.inventory_item?.name || "Unknown Item"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.current_stock} {item.inventory_item?.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.min_stock_level}
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
                      </TableRow>
                    );
                  })}
                  {inventory.length === 0 && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No inventory items in this bar
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </>
      )}
    </div>
  );
};
