import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CashierBarAssignment {
  id: string;
  user_id: string;
  bar_id: string;
  assigned_by: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  bar?: { id: string; name: string };
  profile?: { id: string; full_name: string | null; email: string | null };
}

export const cashierAssignmentKeys = {
  all: ['cashier-assignments'] as const,
  list: () => [...cashierAssignmentKeys.all, 'list'] as const,
  byUser: (userId: string) => [...cashierAssignmentKeys.all, 'user', userId] as const,
  byBar: (barId: string) => [...cashierAssignmentKeys.all, 'bar', barId] as const,
};

export function useCashierAssignments() {
  return useQuery({
    queryKey: cashierAssignmentKeys.list(),
    queryFn: async () => {
      const { data: assignments, error } = await supabase
        .from('cashier_bar_assignments')
        .select(`
          *,
          bar:bars(id, name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch profiles for auth users
      const userIds = assignments.map(a => a.user_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      // Fetch staff users for local staff
      const staffUserIds = assignments.map(a => a.staff_user_id).filter(Boolean);
      const { data: staffUsers } = await supabase
        .from('staff_users')
        .select('id, full_name, email')
        .in('id', staffUserIds);
      
      // Combine assignments with profiles or staff users
      const result = assignments.map(a => ({
        ...a,
        profile: profiles?.find(p => p.id === a.user_id) || 
                 staffUsers?.find(s => s.id === a.staff_user_id) || 
                 undefined,
      }));
      
      return result as CashierBarAssignment[];
    },
  });
}

// Hook that works for both auth users and staff users
export function useCashierAssignment(userId: string, isStaffUser: boolean = false) {
  return useQuery({
    queryKey: [...cashierAssignmentKeys.byUser(userId), isStaffUser ? 'staff' : 'auth'],
    queryFn: async () => {
      let query = supabase
        .from('cashier_bar_assignments')
        .select(`
          *,
          bar:bars(id, name)
        `)
        .eq('is_active', true);
      
      // Check both user_id and staff_user_id
      if (isStaffUser) {
        query = query.eq('staff_user_id', userId);
      } else {
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return data as CashierBarAssignment | null;
    },
    enabled: !!userId,
  });
}

export function useAssignCashierToBar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, barId, isStaffUser = false }: { userId: string; barId: string; isStaffUser?: boolean }) => {
      // Deactivate existing assignments for this user
      if (isStaffUser) {
        await supabase
          .from('cashier_bar_assignments')
          .update({ is_active: false })
          .eq('staff_user_id', userId);
      } else {
        await supabase
          .from('cashier_bar_assignments')
          .update({ is_active: false })
          .eq('user_id', userId);
      }

      // Get current auth user for assigned_by
      const { data: { user } } = await supabase.auth.getUser();

      // Create new assignment with appropriate field
      const assignmentData: any = {
        bar_id: barId,
        assigned_by: user?.id,
        is_active: true,
      };
      
      if (isStaffUser) {
        assignmentData.staff_user_id = userId;
        // Use a placeholder UUID for user_id since it's required
        assignmentData.user_id = userId;
      } else {
        assignmentData.user_id = userId;
      }

      const { data, error } = await supabase
        .from('cashier_bar_assignments')
        .insert(assignmentData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashierAssignmentKeys.all });
      toast.success('Staff assigned to bar successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign staff');
    },
  });
}

export function useUnassignCashier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('cashier_bar_assignments')
        .update({ is_active: false })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashierAssignmentKeys.all });
      toast.success('Cashier unassigned successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to unassign cashier');
    },
  });
}
