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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit2, Trash2, Store, KeyRound } from "lucide-react";
import { format } from "date-fns";
import type { StaffMember } from "@/pages/Staff";

interface StaffTableProps {
  staff: (StaffMember & { assignedBar?: string | null })[];
  isLoading: boolean;
  onEdit: (staff: StaffMember) => void;
  onDelete: (staff: StaffMember) => void;
  canManage: boolean;
  currentUserId?: string;
  onAssignBar?: (staff: StaffMember) => void;
  onResetPassword?: (staff: StaffMember) => void;
}

const roleConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  super_admin: { label: "Super Admin", variant: "destructive" },
  manager: { label: "Manager", variant: "default" },
  cashier: { label: "Cashier", variant: "secondary" },
  waitstaff: { label: "Waitstaff", variant: "secondary" },
  bar_staff: { label: "Bar Staff", variant: "outline" },
  kitchen_staff: { label: "Kitchen Staff", variant: "outline" },
  inventory_officer: { label: "Inventory Officer", variant: "secondary" },
  accountant: { label: "Accountant", variant: "secondary" },
  store_admin: { label: "Store Admin", variant: "secondary" },
  store_user: { label: "Store User", variant: "outline" },
};

export const StaffTable = ({
  staff,
  isLoading,
  onEdit,
  onDelete,
  canManage,
  currentUserId,
  onAssignBar,
  onResetPassword,
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
            <TableHead>Assigned Bar</TableHead>
            <TableHead>Joined</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((member) => {
            const role = member.role ? roleConfig[member.role] : null;
            const isCurrentUser = member.id === currentUserId;
            const showAssignBar = member.role === "cashier" || member.role === "bar_staff" || member.role === "waitstaff";
            
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
                    <div>
                      <span className="font-medium">
                        {member.full_name || "Unnamed"}
                      </span>
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                      )}
                    </div>
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
                <TableCell>
                  {member.assignedBar ? (
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      <Store className="h-3 w-3 mr-1" />
                      {member.assignedBar}
                    </Badge>
                  ) : showAssignBar ? (
                    <span className="text-muted-foreground text-sm">Not assigned</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.created_at
                    ? format(new Date(member.created_at), "MMM d, yyyy")
                    : "-"}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(member)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {onAssignBar && (
                          <DropdownMenuItem onClick={() => onAssignBar(member)}>
                            <Store className="h-4 w-4 mr-2" />
                            Assign to Bar
                          </DropdownMenuItem>
                        )}
                        {onResetPassword && member.email && (
                          <DropdownMenuItem onClick={() => onResetPassword(member)}>
                            <KeyRound className="h-4 w-4 mr-2" />
                            Reset Password
                          </DropdownMenuItem>
                        )}
                        {!isCurrentUser && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => onDelete(member)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
