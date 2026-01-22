import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { barsKeys } from "@/hooks/useBars";

export function usePendingTransferCount(barId: string | null) {
  const queryClient = useQueryClient();
  const [realtimeCount, setRealtimeCount] = useState<number | null>(null);

  const { data: count = 0, refetch } = useQuery({
    queryKey: [...barsKeys.pendingTransfers(barId || ""), "count"],
    queryFn: async () => {
      if (!barId) return 0;
      
      const { count, error } = await supabase
        .from("bar_to_bar_transfers")
        .select("*", { count: "exact", head: true })
        .eq("destination_bar_id", barId)
        .eq("status", "pending");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!barId,
    refetchInterval: 30000, // Refetch every 30 seconds as backup
  });

  // Subscribe to realtime changes
  useEffect(() => {
    if (!barId) return;

    const channel = supabase
      .channel(`pending-transfers-count-${barId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bar_to_bar_transfers",
          filter: `destination_bar_id=eq.${barId}`,
        },
        () => {
          // Refetch count on any change
          refetch();
          queryClient.invalidateQueries({ 
            queryKey: barsKeys.pendingTransfers(barId) 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barId, refetch, queryClient]);

  return realtimeCount !== null ? realtimeCount : count;
}
