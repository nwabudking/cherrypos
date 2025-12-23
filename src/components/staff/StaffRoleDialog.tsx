import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { StaffMember } from "@/pages/Staff";
import type { AppRole } from "@/contexts/AuthContext";

interface StaffRoleDialogProps {
  staff: StaffMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateRole: (role: AppRole) => void;
  isUpdating: boolean;
}

const roles: { value: AppRole; label: string; description: string }[] = [
  { value: "super_admin", label: "Super Admin", description: "Full system access and user management" },
  { value: "manager", label: "Manager", description: "Manage menu, orders, and view reports" },
  { value: "cashier", label: "Cashier", description: "Process orders and payments" },
  { value: "bar_staff", label: "Bar Staff", description: "Manage bar orders and inventory" },
  { value: "kitchen_staff", label: "Kitchen Staff", description: "View and manage kitchen orders" },
  { value: "inventory_officer", label: "Inventory Officer", description: "Manage stock and inventory" },
  { value: "accountant", label: "Accountant", description: "View financial reports and payments" },
];

export const StaffRoleDialog = ({
  staff,
  open,
  onOpenChange,
  onUpdateRole,
  isUpdating,
}: StaffRoleDialogProps) => {
  const [selectedRole, setSelectedRole] = useState<AppRole | "">("");

  useEffect(() => {
    if (staff?.role) {
      setSelectedRole(staff.role);
    }
  }, [staff]);

  if (!staff) return null;

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "??";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Staff Role</DialogTitle>
          <DialogDescription>
            Change the role and permissions for this staff member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Staff Info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Avatar className="h-12 w-12">
              <AvatarImage src={staff.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(staff.full_name, staff.email)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{staff.full_name || "Unnamed"}</p>
              <p className="text-sm text-muted-foreground">{staff.email}</p>
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <Label>Select Role</Label>
            <RadioGroup
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value as AppRole)}
              className="space-y-2"
            >
              {roles.map((role) => (
                <div
                  key={role.value}
                  className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedRole === role.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedRole(role.value)}
                >
                  <RadioGroupItem value={role.value} id={role.value} className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor={role.value} className="font-medium cursor-pointer">
                      {role.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{role.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedRole && onUpdateRole(selectedRole as AppRole)}
              disabled={!selectedRole || selectedRole === staff.role || isUpdating}
            >
              {isUpdating ? "Updating..." : "Update Role"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
