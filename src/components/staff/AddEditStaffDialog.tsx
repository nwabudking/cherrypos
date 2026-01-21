import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StaffMember } from "@/pages/Staff";
import type { AppRole } from "@/contexts/AuthContext";

interface AddEditStaffDialogProps {
  staff: StaffMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    email?: string;
    password?: string;
    fullName: string;
    role: AppRole;
  }) => void;
  isSaving: boolean;
  isEditing: boolean;
}

const roles: { value: AppRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "waitstaff", label: "Waitstaff" },
  { value: "bar_staff", label: "Bar Staff" },
  { value: "kitchen_staff", label: "Kitchen Staff" },
  { value: "inventory_officer", label: "Inventory Officer" },
  { value: "accountant", label: "Accountant" },
  { value: "store_admin", label: "Store Admin" },
  { value: "store_user", label: "Store User" },
];

export const AddEditStaffDialog = ({
  staff,
  open,
  onOpenChange,
  onSave,
  isSaving,
  isEditing,
}: AddEditStaffDialogProps) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "cashier" as AppRole,
  });

  useEffect(() => {
    if (staff && isEditing) {
      setFormData({
        email: staff.email || "",
        password: "",
        fullName: staff.full_name || "",
        role: staff.role || "cashier",
      });
    } else {
      setFormData({
        email: "",
        password: "",
        fullName: "",
        role: "cashier",
      });
    }
  }, [staff, isEditing, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      onSave({
        fullName: formData.fullName,
        role: formData.role,
      });
    } else {
      onSave({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        role: formData.role,
      });
    }
  };

  const isValid = isEditing 
    ? formData.fullName.trim() !== ""
    : formData.email.trim() !== "" && formData.password.length >= 6;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Staff Member" : "Add New Staff"}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update staff member details and role"
              : "Create a new staff account with login credentials"
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEditing && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="staff@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 6 characters"
                  minLength={6}
                  required
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value as AppRole })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !isValid}>
              {isSaving ? "Saving..." : isEditing ? "Update" : "Create Staff"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
