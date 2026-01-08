import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
} from "@/hooks/useInventory";
import { SupplierDialog, type Supplier } from "@/components/inventory/SupplierDialog";
import { SuppliersTable } from "@/components/inventory/SuppliersTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Truck, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Inventory = () => {
  const { role } = useAuth();

  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const { data: suppliers = [], isLoading: suppliersLoading } = useSuppliers();

  const createSupplierMutation = useCreateSupplier();
  const updateSupplierMutation = useUpdateSupplier();
  const deleteSupplierMutation = useDeleteSupplier();

  const canManage = role === "super_admin" || role === "manager" || role === "inventory_officer";

  const handleAddSupplier = () => {
    setSelectedSupplier(null);
    setIsSupplierDialogOpen(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsSupplierDialogOpen(true);
  };

  const handleSaveSupplier = (data: Partial<Supplier> & { id?: string }) => {
    if (data.id) {
      updateSupplierMutation.mutate(
        { id: data.id, data },
        {
          onSuccess: () => {
            setIsSupplierDialogOpen(false);
            setSelectedSupplier(null);
          },
        }
      );
    } else if (data.name) {
      createSupplierMutation.mutate(
        { ...data, name: data.name } as { name: string } & Partial<Supplier>,
        {
          onSuccess: () => {
            setIsSupplierDialogOpen(false);
            setSelectedSupplier(null);
          },
        }
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Supplier Management</h1>
          <p className="text-muted-foreground">
            Manage your inventory suppliers and vendor contacts
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Stock management and inventory items have been moved to <strong>Store Management</strong>. 
          Use this page to manage supplier information only.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{suppliers.length} Suppliers</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage your inventory suppliers
                </p>
              </div>
            </div>
            {canManage && (
              <Button onClick={handleAddSupplier}>
                <Plus className="h-4 w-4 mr-2" />
                Add Supplier
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <SuppliersTable
            suppliers={suppliers}
            isLoading={suppliersLoading}
            onEdit={handleEditSupplier}
            onDelete={(id) => deleteSupplierMutation.mutate(id)}
            canManage={canManage}
          />
        </CardContent>
      </Card>

      <SupplierDialog
        supplier={selectedSupplier}
        open={isSupplierDialogOpen}
        onOpenChange={setIsSupplierDialogOpen}
        onSave={handleSaveSupplier}
        isSaving={createSupplierMutation.isPending || updateSupplierMutation.isPending}
      />
    </div>
  );
};

export default Inventory;
