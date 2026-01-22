import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all pending transfers older than 24 hours
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() - 24);

    const { data: expiredTransfers, error: fetchError } = await supabase
      .from("bar_to_bar_transfers")
      .select("*")
      .eq("status", "pending")
      .lt("created_at", expiryTime.toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!expiredTransfers || expiredTransfers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No expired transfers to process",
          processed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const transfer of expiredTransfers) {
      try {
        // Return stock to source bar
        const { error: stockError } = await supabase
          .from("bar_inventory")
          .upsert(
            {
              bar_id: transfer.source_bar_id,
              inventory_item_id: transfer.inventory_item_id,
              current_stock: transfer.quantity,
              min_stock_level: 5,
            },
            {
              onConflict: "bar_id,inventory_item_id",
              ignoreDuplicates: false,
            }
          );

        if (stockError) {
          // If upsert failed, try incrementing existing stock
          const { data: currentStock } = await supabase
            .from("bar_inventory")
            .select("current_stock")
            .eq("bar_id", transfer.source_bar_id)
            .eq("inventory_item_id", transfer.inventory_item_id)
            .single();

          if (currentStock) {
            await supabase
              .from("bar_inventory")
              .update({
                current_stock: currentStock.current_stock + transfer.quantity,
                updated_at: new Date().toISOString(),
              })
              .eq("bar_id", transfer.source_bar_id)
              .eq("inventory_item_id", transfer.inventory_item_id);
          }
        }

        // Update transfer status to expired
        const { error: updateError } = await supabase
          .from("bar_to_bar_transfers")
          .update({
            status: "expired",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            notes: transfer.notes 
              ? `${transfer.notes} | Auto-expired after 24 hours` 
              : "Auto-expired after 24 hours",
          })
          .eq("id", transfer.id);

        if (updateError) {
          errors.push(`Failed to update transfer ${transfer.id}: ${updateError.message}`);
        } else {
          processedCount++;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`Error processing transfer ${transfer.id}: ${errMsg}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} expired transfers`,
        processed: processedCount,
        total: expiredTransfers.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error in expire-transfers function:", errorMsg);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMsg 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
