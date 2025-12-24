import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Database, CheckCircle2, AlertCircle, Upload, FileJson, FileCode } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MigrationResult {
  categories: number;
  menuItems: number;
  users: number;
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
  category?: string;
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

// Parse SQL INSERT statements for ospos_items
function parseItemsFromSQL(sql: string): ItemData[] {
  const items: ItemData[] = [];
  
  // Match INSERT INTO `ospos_items` statements
  const insertPattern = /INSERT\s+INTO\s+`?ospos_items`?\s*\([^)]+\)\s*VALUES\s*((?:\([^)]+\),?\s*)+)/gi;
  const matches = sql.matchAll(insertPattern);
  
  for (const match of matches) {
    const valuesStr = match[1];
    // Split individual value tuples
    const tuplePattern = /\(([^)]+)\)/g;
    const tuples = valuesStr.matchAll(tuplePattern);
    
    for (const tuple of tuples) {
      const values = parseCSVValues(tuple[1]);
      // ospos_items columns: name, category, supplier_id, item_number, description, cost_price, unit_price, ...
      if (values.length >= 7) {
        const item: ItemData = {
          item_id: items.length + 1,
          name: cleanSQLString(values[0]),
          category: cleanSQLString(values[1]),
          description: cleanSQLString(values[4]) || undefined,
          cost_price: parseFloat(values[5]) || 0,
          unit_price: parseFloat(values[6]) || 0,
        };
        if (item.name && item.unit_price > 0) {
          items.push(item);
        }
      }
    }
  }
  
  return items;
}

// Parse SQL INSERT statements for ospos_employees
function parseEmployeesFromSQL(sql: string): EmployeeData[] {
  const employees: EmployeeData[] = [];
  
  // Match INSERT INTO `ospos_employees` or ospos_people statements
  const insertPattern = /INSERT\s+INTO\s+`?ospos_employees`?\s*\([^)]+\)\s*VALUES\s*((?:\([^)]+\),?\s*)+)/gi;
  const matches = sql.matchAll(insertPattern);
  
  for (const match of matches) {
    const valuesStr = match[1];
    const tuplePattern = /\(([^)]+)\)/g;
    const tuples = valuesStr.matchAll(tuplePattern);
    
    for (const tuple of tuples) {
      const values = parseCSVValues(tuple[1]);
      // ospos_employees columns: person_id, first_name, last_name, email, ...
      if (values.length >= 4) {
        const employee: EmployeeData = {
          person_id: parseInt(values[0]) || employees.length + 1,
          first_name: cleanSQLString(values[1]),
          last_name: cleanSQLString(values[2]),
          email: cleanSQLString(values[3]),
          username: cleanSQLString(values[4] || values[3]),
        };
        if (employee.email && employee.email.includes('@')) {
          employees.push(employee);
        }
      }
    }
  }
  
  // Also try ospos_people table which some OpenPOS versions use
  const peoplePattern = /INSERT\s+INTO\s+`?ospos_people`?\s*\([^)]+\)\s*VALUES\s*((?:\([^)]+\),?\s*)+)/gi;
  const peopleMatches = sql.matchAll(peoplePattern);
  
  for (const match of peopleMatches) {
    const valuesStr = match[1];
    const tuplePattern = /\(([^)]+)\)/g;
    const tuples = valuesStr.matchAll(tuplePattern);
    
    for (const tuple of tuples) {
      const values = parseCSVValues(tuple[1]);
      if (values.length >= 4) {
        const employee: EmployeeData = {
          person_id: parseInt(values[0]) || employees.length + 1,
          first_name: cleanSQLString(values[1]),
          last_name: cleanSQLString(values[2]),
          email: cleanSQLString(values[3]),
          username: cleanSQLString(values[4] || values[3]),
        };
        // Avoid duplicates
        if (employee.email && employee.email.includes('@') && 
            !employees.some(e => e.email === employee.email)) {
          employees.push(employee);
        }
      }
    }
  }
  
  return employees;
}

// Parse SQL INSERT statements for categories (ospos uses 'category' field in items table)
function parseCategoriesFromItems(items: ItemData[]): CategoryData[] {
  const categoryNames = new Set<string>();
  items.forEach(item => {
    if (item.category) {
      categoryNames.add(item.category);
    }
  });
  
  return Array.from(categoryNames).map((name, index) => ({
    category_id: index + 1,
    name: name,
  }));
}

// Parse comma-separated values handling quoted strings
function parseCSVValues(str: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (!inQuote && (char === "'" || char === '"')) {
      inQuote = true;
      quoteChar = char;
    } else if (inQuote && char === quoteChar && str[i + 1] !== quoteChar) {
      inQuote = false;
    } else if (!inQuote && char === ',') {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  return values;
}

// Clean SQL string values
function cleanSQLString(value: string): string {
  if (!value) return '';
  // Remove surrounding quotes
  let cleaned = value.trim();
  if ((cleaned.startsWith("'") && cleaned.endsWith("'")) || 
      (cleaned.startsWith('"') && cleaned.endsWith('"'))) {
    cleaned = cleaned.slice(1, -1);
  }
  // Handle NULL
  if (cleaned.toUpperCase() === 'NULL') {
    return '';
  }
  // Unescape escaped quotes
  cleaned = cleaned.replace(/''/g, "'").replace(/\\'/g, "'");
  return cleaned;
}

export default function Migration() {
  const { role } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jsonData, setJsonData] = useState<string>("");
  const [sqlData, setSqlData] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("sql");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sqlFileInputRef = useRef<HTMLInputElement>(null);

  // Only super_admin can access this page
  if (role !== "super_admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const handleJSONFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setJsonData(content);
      toast.success("JSON file loaded successfully");
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
    };
    reader.readAsText(file);
  };

  const handleSQLFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setSqlData(content);
      toast.success(`SQL file loaded: ${file.name} (${(content.length / 1024).toFixed(1)} KB)`);
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
    };
    reader.readAsText(file);
  };

  const runSQLMigration = async () => {
    if (!sqlData.trim()) {
      toast.error("Please provide SQL data first");
      return;
    }

    // Parse SQL to extract items, categories, and employees
    const items = parseItemsFromSQL(sqlData);
    const categories = parseCategoriesFromItems(items);
    const employees = parseEmployeesFromSQL(sqlData);

    if (items.length === 0 && employees.length === 0) {
      toast.error("No data found in SQL dump. Make sure the file contains INSERT statements.");
      return;
    }

    const parts = [];
    if (categories.length > 0) parts.push(`${categories.length} categories`);
    if (items.length > 0) parts.push(`${items.length} items`);
    if (employees.length > 0) parts.push(`${employees.length} users`);
    toast.info(`Found ${parts.join(', ')} to migrate`);

    const payload = { categories, items, employees };
    await executeMigration(payload);
  };

  const runJSONMigration = async () => {
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

    await executeMigration(parsedData);
  };

  const executeMigration = async (payload: { categories: CategoryData[]; items: ItemData[]; employees?: EmployeeData[] }) => {
    setIsRunning(true);
    setResult(null);
    setError(null);

    try {
      const response = await supabase.functions.invoke("migrate-openpos", {
        body: payload,
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
      { item_id: 1, name: "Coca Cola", category: "Drinks", unit_price: 500, cost_price: 200 },
      { item_id: 2, name: "Jollof Rice", category: "Food", unit_price: 1500, cost_price: 800, description: "Nigerian Jollof Rice" }
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
              Import Data
            </CardTitle>
            <CardDescription>
              Upload your phpMyAdmin SQL dump directly, or use JSON format.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sql">
                  <FileCode className="mr-2 h-4 w-4" />
                  SQL File (Recommended)
                </TabsTrigger>
                <TabsTrigger value="json">
                  <FileJson className="mr-2 h-4 w-4" />
                  JSON Format
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="sql" className="space-y-4 mt-4">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">How to export from phpMyAdmin:</p>
                  <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                    <li>Open phpMyAdmin and select your OpenPOS database</li>
                    <li>Click <strong>Export</strong> tab</li>
                    <li>Choose <strong>Quick</strong> export method</li>
                    <li>Format: <strong>SQL</strong></li>
                    <li>Click <strong>Go</strong> to download the .sql file</li>
                    <li>Upload the file below</li>
                  </ol>
                </div>

                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".sql"
                    className="hidden"
                    ref={sqlFileInputRef}
                    onChange={handleSQLFileUpload}
                  />
                  <Button
                    variant="outline"
                    onClick={() => sqlFileInputRef.current?.click()}
                    className="flex-1"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload SQL File (.sql)
                  </Button>
                </div>

                {sqlData && (
                  <div className="bg-muted/50 p-3 rounded-lg border">
                    <p className="text-sm text-muted-foreground">
                      ✓ SQL file loaded ({(sqlData.length / 1024).toFixed(1)} KB)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Preview: {sqlData.slice(0, 200)}...
                    </p>
                  </div>
                )}

                <Textarea
                  placeholder="Or paste your SQL dump here..."
                  className="min-h-[150px] font-mono text-xs"
                  value={sqlData}
                  onChange={(e) => setSqlData(e.target.value)}
                />

                <Button 
                  onClick={runSQLMigration} 
                  disabled={isRunning || !sqlData.trim()}
                  className="w-full"
                  size="lg"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Parsing & Migrating...
                    </>
                  ) : (
                    "Parse SQL & Run Migration"
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="json" className="space-y-4 mt-4">
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Required JSON format:</strong></p>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{JSON.stringify(sampleData, null, 2)}
                  </pre>
                </div>

                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleJSONFileUpload}
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
                  onClick={runJSONMigration} 
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
              </TabsContent>
            </Tabs>
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
              <p><strong>Users imported:</strong> {result.users || 0}</p>
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
