import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { StaffTable } from "@/components/staff/StaffTable";
import { StaffRoleDialog } from "@/components/staff/StaffRoleDialog";
import { InviteStaffDialog } from "@/components/staff/InviteStaffDialog";
import type { AppRole } from "@/contexts/AuthContext";

export interface StaffMember {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
  role: AppRole | null;
}

const Staff = () => {
  const { toast } = useToast();
  const { role: currentUserRole } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const { data: staffMembers = [], isLoading } = useQuery({
    queryKey: ["staff-members"],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Map roles to profiles
      const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]));
      
      return profiles?.map((profile) => ({
        ...profile,
        role: roleMap.get(profile.id) || null,
      })) as StaffMember[];
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // Check if role exists
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Role Updated",
        description: "Staff member's role has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["staff-members"] });
      setIsRoleDialogOpen(false);
      setSelectedStaff(null);
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to update role. You may not have permission.",
        variant: "destructive",
      });
    },
  });

  const filteredStaff = staffMembers.filter((staff) => {
    const matchesSearch = 
      !searchQuery ||
      staff.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === "all" || staff.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const canManageRoles = currentUserRole === "super_admin";

  const handleEditRole = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setIsRoleDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <StaffHeader
        staffCount={staffMembers.length}
        onInvite={() => setIsInviteDialogOpen(true)}
        canInvite={canManageRoles}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
      />

      <StaffTable
        staff={filteredStaff}
        isLoading={isLoading}
        onEditRole={handleEditRole}
        canManageRoles={canManageRoles}
      />

      <StaffRoleDialog
        staff={selectedStaff}
        open={isRoleDialogOpen}
        onOpenChange={setIsRoleDialogOpen}
        onUpdateRole={(role) =>
          selectedStaff && updateRoleMutation.mutate({ userId: selectedStaff.id, role })
        }
        isUpdating={updateRoleMutation.isPending}
      />

      <InviteStaffDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
      />
    </div>
  );
};

export default Staff;
