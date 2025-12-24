import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CategoryData {
  category_id: number;
  name: string;
}

interface ItemData {
  item_id: number;
  name: string;
  description?: string;
  category?: string | number;
  cost_price?: number;
  unit_price: number;
}

interface EmployeeData {
  person_id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  password?: string;
}

interface MigrationPayload {
  categories: CategoryData[];
  items: ItemData[];
  employees?: EmployeeData[];
}

interface MigrationResult {
  categories: number;
  menuItems: number;
  users: number;
  errors: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is super_admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      throw new Error("Unauthorized");
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "super_admin") {
      throw new Error("Only super_admin can run migrations");
    }

    console.log("User verified as super_admin");

    // Parse the migration data from request body
    const payload: MigrationPayload = await req.json();
    
    if (!payload.categories || !payload.items) {
      throw new Error("Invalid payload: missing categories or items");
    }

    console.log(`Received ${payload.categories.length} categories and ${payload.items.length} items`);

    const result: MigrationResult = {
      categories: 0,
      menuItems: 0,
      users: 0,
      errors: [],
    };

    // Map category names/IDs to new UUIDs
    const categoryMapById = new Map<number, string>();
    const categoryMapByName = new Map<string, string>();

    // Step 1: Migrate categories
    for (const cat of payload.categories) {
      // Check if category already exists
      const { data: existing } = await supabase
        .from("menu_categories")
        .select("id")
        .eq("name", cat.name)
        .maybeSingle();

      if (existing) {
        categoryMapById.set(cat.category_id, existing.id);
        categoryMapByName.set(cat.name.toLowerCase(), existing.id);
        continue;
      }

      const { data: newCat, error } = await supabase
        .from("menu_categories")
        .insert({
          name: cat.name,
          is_active: true,
          sort_order: cat.category_id,
        })
        .select("id")
        .single();

      if (error) {
        result.errors.push(`Category ${cat.name}: ${error.message}`);
      } else {
        categoryMapById.set(cat.category_id, newCat.id);
        categoryMapByName.set(cat.name.toLowerCase(), newCat.id);
        result.categories++;
      }
    }

    console.log(`Migrated ${result.categories} categories`);

    // Step 2: Migrate menu items
    for (const item of payload.items) {
      // Check if item already exists by name
      const { data: existing } = await supabase
        .from("menu_items")
        .select("id")
        .eq("name", item.name)
        .maybeSingle();

      if (existing) {
        continue; // Skip existing items
      }

      // Get category UUID from map (support both name and ID)
      let categoryId: string | null = null;
      if (item.category) {
        if (typeof item.category === 'string') {
          categoryId = categoryMapByName.get(item.category.toLowerCase()) || null;
        } else {
          categoryId = categoryMapById.get(item.category) || null;
        }
      }

      const { error } = await supabase.from("menu_items").insert({
        name: item.name,
        description: item.description || null,
        category_id: categoryId,
        price: item.unit_price || 0,
        cost_price: item.cost_price || null,
        is_active: true,
        is_available: true,
      });

      if (error) {
        result.errors.push(`Item ${item.name}: ${error.message}`);
      } else {
        result.menuItems++;
      }
    }

    console.log(`Migrated ${result.menuItems} menu items`);

    // Step 3: Migrate employees/users
    if (payload.employees && payload.employees.length > 0) {
      console.log(`Processing ${payload.employees.length} employees`);
      
      for (const emp of payload.employees) {
        // Check if user already exists by email
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", emp.email)
          .maybeSingle();

        if (existingProfile) {
          result.errors.push(`User ${emp.email}: already exists, skipped`);
          continue;
        }

        // Generate a temporary password for new users
        const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;
        
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: emp.email,
          password: emp.password || tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: `${emp.first_name} ${emp.last_name}`.trim(),
          },
        });

        if (authError) {
          result.errors.push(`User ${emp.email}: ${authError.message}`);
          continue;
        }

        if (authData.user) {
          // Profile and role are auto-created by the handle_new_user trigger
          // But let's update the full_name to be sure
          await supabase
            .from("profiles")
            .update({ 
              full_name: `${emp.first_name} ${emp.last_name}`.trim(),
            })
            .eq("id", authData.user.id);

          result.users++;
          result.errors.push(`User ${emp.email}: created with temp password (user should reset)`);
        }
      }
      
      console.log(`Migrated ${result.users} users`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Migration completed",
        result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Migration error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
