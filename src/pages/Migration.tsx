import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Database, CheckCircle2, AlertCircle } from "lucide-react";
import { Navigate } from "react-router-dom";

interface MigrationResult {
  categories: number;
  menuItems: number;
  errors: string[];
}

export default function Migration() {
  const { user, role } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only super_admin can access this page
  if (role !== "super_admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const runMigration = async () => {
    setIsRunning(true);
    setResult(null);
    setError(null);

    try {
      // supabase.functions.invoke automatically includes the auth token
      const response = await supabase.functions.invoke("migrate-openpos");

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.success) {
        setResult(response.data.result);
        toast.success("Migration completed successfully!");
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Migration failed";
      setError(message);
      toast.error(message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">OpenPOS Migration</h1>
          <p className="text-muted-foreground mt-2">
            Migrate data from your external MySQL database to this system.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Source Database
            </CardTitle>
            <CardDescription>
              suenoxng_cherrypos @ suenox.ng
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>This migration will:</p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Import categories from ospos_categories</li>
                <li>Import menu items from ospos_items</li>
                <li>Skip items that already exist</li>
                <li>Map categories to menu items</li>
              </ul>
            </div>

            <Button 
              onClick={runMigration} 
              disabled={isRunning}
              className="w-full"
              size="lg"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Migration...
                </>
              ) : (
                "Run Migration"
              )}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                Migration Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p><strong>Categories imported:</strong> {result.categories}</p>
              <p><strong>Menu items imported:</strong> {result.menuItems}</p>
              {result.errors.length > 0 && (
                <div className="mt-4">
                  <p className="font-medium text-amber-600">Warnings:</p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside">
                    {result.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {result.errors.length > 10 && (
                      <li>...and {result.errors.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Migration Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
