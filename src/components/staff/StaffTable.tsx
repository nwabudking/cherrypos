import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit2 } from "lucide-react";
import { format } from "date-fns";
import type { StaffMember } from "@/pages/Staff";

interface StaffTableProps {
  staff: StaffMember[];
  isLoading: boolean;
  onEditRole: (staff: StaffMember) => void;
  canManageRoles: boolean;
}

const roleConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  super_admin: { label: "Super Admin", variant: "destructive" },
  manager: { label: "Manager", variant: "default" },
  cashier: { label: "Cashier", variant: "secondary" },
  bar_staff: { label: "Bar Staff", variant: "outline" },
  kitchen_staff: { label: "Kitchen Staff", variant: "outline" },
  inventory_officer: { label: "Inventory Officer", variant: "secondary" },
  accountant: { label: "Accountant", variant: "secondary" },
};

export const StaffTable = ({
  staff,
  isLoading,
  onEditRole,
  canManageRoles,
}: StaffTableProps) => {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (staff.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">No staff members found</p>
      </Card>
    );
  }

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
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Staff Member</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            {canManageRoles && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((member) => {
            const role = member.role ? roleConfig[member.role] : null;
            
            return (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(member.full_name, member.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">
                      {member.full_name || "Unnamed"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.email || "-"}
                </TableCell>
                <TableCell>
                  {role ? (
                    <Badge variant={role.variant}>{role.label}</Badge>
                  ) : (
                    <Badge variant="outline">No Role</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.created_at
                    ? format(new Date(member.created_at), "MMM d, yyyy")
                    : "-"}
                </TableCell>
                {canManageRoles && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditRole(member)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit Role
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
};
