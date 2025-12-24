import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X, Package } from "lucide-react";

interface MenuItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    cost_price: number | null;
    image_url: string | null;
    is_available: boolean;
    is_active: boolean;
    category_id: string | null;
    inventory_item_id?: string | null;
    track_inventory?: boolean;
  } | null;
}

export const MenuItemDialog = ({ open, onOpenChange, editingItem }: MenuItemDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    cost_price: "",
    category_id: "",
    image_url: "",
    is_available: true,
    is_active: true,
    inventory_item_id: "",
    track_inventory: false,
  });

  useEffect(() => {
    if (editingItem) {
      setForm({
        name: editingItem.name,
        description: editingItem.description || "",
        price: String(editingItem.price),
        cost_price: editingItem.cost_price ? String(editingItem.cost_price) : "",
        category_id: editingItem.category_id || "",
        image_url: editingItem.image_url || "",
        is_available: editingItem.is_available,
        is_active: editingItem.is_active,
        inventory_item_id: editingItem.inventory_item_id || "",
        track_inventory: editingItem.track_inventory || false,
      });
    } else {
      setForm({
        name: "",
        description: "",
        price: "",
        cost_price: "",
        category_id: "",
        image_url: "",
        is_available: true,
        is_active: true,
        inventory_item_id: "",
        track_inventory: false,
      });
    }
  }, [editingItem, open]);

  const { data: categories = [] } = useQuery({
    queryKey: ["menu-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-items-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, current_stock, unit")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price),
        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
        category_id: form.category_id || null,
        image_url: form.image_url || null,
        is_available: form.is_available,
        is_active: form.is_active,
        inventory_item_id: form.inventory_item_id || null,
        track_inventory: form.track_inventory,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("menu_items")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingItem ? "Item updated" : "Item created" });
      queryClient.invalidateQueries({ queryKey: ["menu-items-all"] });
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: "Error saving item", description: String(error), variant: "destructive" });
    },
  });

  // Allowed image MIME types and max file size (5MB)
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast({ 
        title: "Invalid file type", 
        description: "Please upload a JPEG, PNG, GIF, or WebP image.", 
        variant: "destructive" 
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({ 
        title: "File too large", 
        description: "Image must be less than 5MB.", 
        variant: "destructive" 
      });
      return;
    }

    setUploading(true);
    try {
      // Get file extension from MIME type for security (not from filename)
      const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp'
      };
      const fileExt = mimeToExt[file.type] || 'jpg';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("menu-images")
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("menu-images")
        .getPublicUrl(fileName);

      setForm((prev) => ({ ...prev, image_url: publicUrl }));
      toast({ title: "Image uploaded" });
    } catch (error) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setForm((prev) => ({ ...prev, image_url: "" }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Image</Label>
            {form.image_url ? (
              <div className="relative w-full h-40 rounded-lg overflow-hidden bg-muted">
                <img
                  src={form.image_url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={removeImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click to upload</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Jollof Rice"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the item"
              rows={2}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.category_id}
              onValueChange={(value) => setForm((prev) => ({ ...prev, category_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Inventory Tracking */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Inventory Tracking</Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={form.track_inventory}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, track_inventory: checked }))
                }
              />
              <Label className="text-sm">Track stock for this item</Label>
            </div>

            {form.track_inventory && (
              <div className="space-y-2">
                <Label>Link to Inventory Item</Label>
                <Select
                  value={form.inventory_item_id}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, inventory_item_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select inventory item" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.current_stock} {item.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  When linked, this menu item will be automatically marked unavailable when stock runs out.
                </p>
              </div>
            )}
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Selling Price (₦) *</Label>
              <Input
                id="price"
                type="number"
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost_price">Cost Price (₦)</Label>
              <Input
                id="cost_price"
                type="number"
                value={form.cost_price}
                onChange={(e) => setForm((prev) => ({ ...prev, cost_price: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_available}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, is_available: checked }))
                }
              />
              <Label>Available for order</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, is_active: checked }))
                }
              />
              <Label>Active on menu</Label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || !form.price || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Item"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
