import { useState, useEffect } from "react";
import { useBars } from "@/hooks/useBars";
import { useAssignCashierToBar, useCashierAssignment } from "@/hooks/useCashierAssignment";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Store, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CashierAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffMember: { id: string; full_name: string | null; role: string | null; isStaffUser?: boolean } | null;
}

export const CashierAssignmentDialog = ({
  open,
  onOpenChange,
  staffMember,
}: CashierAssignmentDialogProps) => {
  const [selectedBarId, setSelectedBarId] = useState<string>("");
  
  const { data: bars = [] } = useBars();
  // For staff users, pass isStaffUser=true
  const isStaffUser = staffMember?.isStaffUser ?? true; // Default to staff user for local auth
  const { data: currentAssignment } = useCashierAssignment(staffMember?.id || "", isStaffUser);
  const assignMutation = useAssignCashierToBar();

  const activeBars = bars.filter(bar => bar.is_active);

  useEffect(() => {
    if (currentAssignment?.bar_id) {
      setSelectedBarId(currentAssignment.bar_id);
    } else {
      setSelectedBarId("");
    }
  }, [currentAssignment, open]);

  const handleAssign = () => {
    if (!staffMember || !selectedBarId) return;
    
    assignMutation.mutate(
      { userId: staffMember.id, barId: selectedBarId, isStaffUser },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const isCashierOrBarStaff = staffMember?.role === "cashier" || staffMember?.role === "bar_staff" || staffMember?.role === "waitstaff";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Assign to Bar
          </DialogTitle>
          <DialogDescription>
            Assign this staff member to a bar location for POS operations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {staffMember && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <User className="h-5 w-5" />
              <div>
                <p className="font-medium">{staffMember.full_name || "Unknown"}</p>
                <Badge variant="outline">{staffMember.role}</Badge>
              </div>
            </div>
          )}

          {!isCashierOrBarStaff && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
              Note: Only cashiers and bar staff typically need bar assignments.
            </div>
          )}

          {currentAssignment && (
            <div className="p-3 bg-primary/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Currently assigned to:</p>
              <p className="font-medium">{currentAssignment.bar?.name}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Select Bar *</Label>
            <Select value={selectedBarId} onValueChange={setSelectedBarId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a bar" />
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
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={!selectedBarId || assignMutation.isPending}
          >
            {assignMutation.isPending ? "Assigning..." : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
