import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  useStaffUsers,
  useCreateStaffUser,
  useUpdateStaffUser,
  useDeleteStaffUser,
  useResetStaffPassword,
  StaffUser,
} from "@/hooks/useStaffUsers";
import { useCashierAssignments } from "@/hooks/useCashierAssignment";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { StaffTable } from "@/components/staff/StaffTable";
import { AddEditLocalStaffDialog } from "@/components/staff/AddEditLocalStaffDialog";
import { DeleteStaffDialog } from "@/components/staff/DeleteStaffDialog";
import { CashierAssignmentDialog } from "@/components/staff/CashierAssignmentDialog";
import { ResetPasswordDialog } from "@/components/staff/ResetPasswordDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserCheck, UserX } from "lucide-react";

// Keep this interface for compatibility with child components
export interface StaffMember {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
  role: AppRole | null;
  username?: string;
  is_active?: boolean;
}

const Staff = () => {
  const { toast } = useToast();
  const { role: currentUserRole, user } = useAuth();

  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const { data: staffUsers = [], isLoading } = useStaffUsers();
  const { data: assignments = [] } = useCashierAssignments();
  const createStaffMutation = useCreateStaffUser();
  const updateStaffMutation = useUpdateStaffUser();
  const deleteStaffMutation = useDeleteStaffUser();
  const resetPasswordMutation = useResetStaffPassword();

  // Transform staff users to match StaffMember interface
  const transformedStaff: StaffMember[] = staffUsers.map((s) => ({
    id: s.id,
    email: s.email,
    full_name: s.full_name,
    avatar_url: null,
    created_at: s.created_at,
    role: s.role as AppRole | null,
    username: s.username,
    is_active: s.is_active,
  }));

  // Add bar assignment info (check both user_id and staff_user_id)
  const staffWithAssignments = transformedStaff.map((staff) => {
    const assignment = assignments.find(
      (a) => a.user_id === staff.id || (a as any).staff_user_id === staff.id
    );
    return {
      ...staff,
      assignedBar: assignment?.bar?.name || null,
    };
  });

  const filteredStaff = staffWithAssignments.filter((staff) => {
    const matchesSearch =
      !searchQuery ||
      staff.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.username?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "all" || staff.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const activeCount = staffUsers.filter((s) => s.is_active).length;
  const inactiveCount = staffUsers.filter((s) => !s.is_active).length;

  const canManageStaff = currentUserRole === "super_admin" || currentUserRole === "manager";

  const handleAddStaff = () => {
    setSelectedStaff(null);
    setIsEditing(false);
    setIsAddEditDialogOpen(true);
  };

  const handleEditStaff = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setIsEditing(true);
    setIsAddEditDialogOpen(true);
  };

  const handleDeleteStaff = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setIsDeleteDialogOpen(true);
  };

  const handleAssignBar = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setIsAssignmentDialogOpen(true);
  };

  const handleResetPassword = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setIsResetPasswordDialogOpen(true);
  };

  const handleSaveNewStaff = (data: {
    username: string;
    password: string;
    full_name: string;
    email?: string;
    role: AppRole;
  }) => {
    createStaffMutation.mutate(data, {
      onSuccess: () => {
        setIsAddEditDialogOpen(false);
        setSelectedStaff(null);
      },
    });
  };

  const handleUpdateStaff = (data: {
    full_name: string;
    email?: string;
    role: AppRole;
    is_active: boolean;
  }) => {
    if (selectedStaff) {
      updateStaffMutation.mutate(
        { id: selectedStaff.id, data },
        {
          onSuccess: () => {
            setIsAddEditDialogOpen(false);
            setSelectedStaff(null);
          },
        }
      );
    }
  };

  const handleConfirmDelete = () => {
    if (selectedStaff) {
      deleteStaffMutation.mutate(selectedStaff.id, {
        onSuccess: () => {
          setIsDeleteDialogOpen(false);
          setSelectedStaff(null);
        },
      });
    }
  };

  // Find the raw staff user for the dialog
  const selectedStaffUser = selectedStaff 
    ? staffUsers.find((s) => s.id === selectedStaff.id) 
    : null;

  return (
    <div className="space-y-6">
      <StaffHeader
        staffCount={transformedStaff.length}
        onAddStaff={handleAddStaff}
        canManage={canManageStaff}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{staffUsers.length}</p>
              <p className="text-sm text-muted-foreground">Total Staff</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <UserCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <UserX className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inactiveCount}</p>
              <p className="text-sm text-muted-foreground">Inactive</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <StaffTable
        staff={filteredStaff}
        isLoading={isLoading}
        onEdit={handleEditStaff}
        onDelete={handleDeleteStaff}
        canManage={canManageStaff}
        currentUserId={user?.id}
        onAssignBar={handleAssignBar}
        onResetPassword={handleResetPassword}
      />

      <AddEditLocalStaffDialog
        staff={selectedStaffUser || null}
        open={isAddEditDialogOpen}
        onOpenChange={setIsAddEditDialogOpen}
        onSave={handleSaveNewStaff}
        onUpdate={handleUpdateStaff}
        isSaving={createStaffMutation.isPending || updateStaffMutation.isPending}
        isEditing={isEditing}
      />

      <DeleteStaffDialog
        staff={selectedStaff}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteStaffMutation.isPending}
      />

      <CashierAssignmentDialog
        open={isAssignmentDialogOpen}
        onOpenChange={setIsAssignmentDialogOpen}
        staffMember={selectedStaff ? { ...selectedStaff, isStaffUser: true } : null}
      />

      <ResetPasswordDialog
        staff={selectedStaff}
        open={isResetPasswordDialogOpen}
        onOpenChange={setIsResetPasswordDialogOpen}
      />
    </div>
  );
};

export default Staff;
