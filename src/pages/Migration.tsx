import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Database, CheckCircle2, AlertCircle, Upload, FileJson } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";

interface MigrationResult {
  categories: number;
  menuItems: number;
  errors: string[];
}

interface CategoryData {
  category_id: number;
  name: string;
}

interface ItemData {
  item_id: number;
  name: string;
  description?: string;
  category?: number;
  cost_price?: number;
  unit_price: number;
}

export default function Migration() {
  const { role } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jsonData, setJsonData] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only super_admin can access this page
  if (role !== "super_admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setJsonData(content);
      toast.success("File loaded successfully");
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
    };
    reader.readAsText(file);
  };

  const runMigration = async () => {
    if (!jsonData.trim()) {
      toast.error("Please provide migration data first");
      return;
    }

    let parsedData;
    try {
      parsedData = JSON.parse(jsonData);
      if (!parsedData.categories || !parsedData.items) {
        throw new Error("JSON must contain 'categories' and 'items' arrays");
      }
    } catch (e) {
      toast.error(`Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`);
      return;
    }

    setIsRunning(true);
    setResult(null);
    setError(null);

    try {
      const response = await supabase.functions.invoke("migrate-openpos", {
        body: parsedData,
      });

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

  const sampleData = {
    categories: [
      { category_id: 1, name: "Drinks" },
      { category_id: 2, name: "Food" }
    ],
    items: [
      { item_id: 1, name: "Coca Cola", category: 1, unit_price: 500, cost_price: 200 },
      { item_id: 2, name: "Jollof Rice", category: 2, unit_price: 1500, cost_price: 800, description: "Nigerian Jollof Rice" }
    ]
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">OpenPOS Migration</h1>
          <p className="text-muted-foreground mt-2">
            Import categories and menu items from your OpenPOS database export.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Migration Data
            </CardTitle>
            <CardDescription>
              Export your OpenPOS data as JSON and paste it here, or upload a JSON file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>Required JSON format:</strong></p>
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{JSON.stringify(sampleData, null, 2)}
              </pre>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">To export from phpMyAdmin, run these queries:</p>
              <div className="bg-muted p-3 rounded-lg text-xs font-mono">
                <p className="text-muted-foreground mb-1">-- Categories:</p>
                <p>SELECT category_id, name FROM ospos_categories WHERE deleted = 0;</p>
                <p className="text-muted-foreground mb-1 mt-2">-- Items:</p>
                <p>SELECT item_id, name, description, category, cost_price, unit_price FROM ospos_items WHERE deleted = 0;</p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="file"
                accept=".json"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload JSON File
              </Button>
              <Button
                variant="outline"
                onClick={() => setJsonData(JSON.stringify(sampleData, null, 2))}
              >
                <FileJson className="mr-2 h-4 w-4" />
                Load Sample Data
              </Button>
            </div>

            <Textarea
              placeholder="Paste your JSON data here..."
              className="min-h-[200px] font-mono text-sm"
              value={jsonData}
              onChange={(e) => setJsonData(e.target.value)}
            />

            <Button 
              onClick={runMigration} 
              disabled={isRunning || !jsonData.trim()}
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
