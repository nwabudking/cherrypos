import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserPlus, Search } from "lucide-react";

interface StaffHeaderProps {
  staffCount: number;
  onInvite: () => void;
  canInvite: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  roleFilter: string;
  setRoleFilter: (value: string) => void;
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  cashier: "Cashier",
  bar_staff: "Bar Staff",
  kitchen_staff: "Kitchen Staff",
  inventory_officer: "Inventory Officer",
  accountant: "Accountant",
};

export const StaffHeader = ({
  staffCount,
  onInvite,
  canInvite,
  searchQuery,
  setSearchQuery,
  roleFilter,
  setRoleFilter,
}: StaffHeaderProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff Management</h1>
          <p className="text-muted-foreground">Manage team members and their roles</p>
        </div>
        {canInvite && (
          <Button onClick={onInvite}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Staff
          </Button>
        )}
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Staff</p>
              <p className="text-2xl font-bold text-foreground">{staffCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background"
          />
        </div>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px] bg-background">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {Object.entries(roleLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
