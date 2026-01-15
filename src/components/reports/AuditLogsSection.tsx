import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { 
  FileDown, 
  FileSpreadsheet, 
  Calendar as CalendarIcon, 
  ClipboardList,
  UserMinus,
  Package,
  Edit,
  Trash2,
  RefreshCw
} from "lucide-react";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  original_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  reason: string | null;
  performed_by: string | null;
  created_at: string | null;
  performer?: {
    full_name: string | null;
    email: string | null;
  };
}

const actionTypeConfig: Record<string, { label: string; icon: any; color: string }> = {
  delete: { label: "Delete", icon: Trash2, color: "text-destructive" },
  void: { label: "Void", icon: Trash2, color: "text-destructive" },
  correction: { label: "Correction", icon: Edit, color: "text-amber-500" },
  adjustment: { label: "Adjustment", icon: RefreshCw, color: "text-blue-500" },
  transfer: { label: "Transfer", icon: Package, color: "text-emerald-500" },
  update: { label: "Update", icon: Edit, color: "text-primary" },
  create: { label: "Create", icon: Package, color: "text-emerald-500" },
};

const entityTypeLabels: Record<string, string> = {
  order: "Order",
  inventory: "Inventory",
  menu_item: "Menu Item",
  user: "User",
  staff: "Staff",
  bar: "Bar",
  stock: "Stock",
};

export const AuditLogsSection = () => {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());

  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", actionFilter, entityFilter, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (actionFilter !== "all") {
        query = query.eq("action_type", actionFilter);
      }
      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }
      if (startDate) {
        query = query.gte("created_at", startOfDay(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte("created_at", endOfDay(endDate).toISOString());
      }

      query = query.limit(200);

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch performer info separately
      const performerIds = [...new Set(data?.map(log => log.performed_by).filter(Boolean))] as string[];
      let performers: Record<string, { full_name: string | null; email: string | null }> = {};
      
      if (performerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", performerIds);
        
        if (profilesData) {
          performers = profilesData.reduce((acc, p) => {
            acc[p.id] = { full_name: p.full_name, email: p.email };
            return acc;
          }, {} as Record<string, { full_name: string | null; email: string | null }>);
        }
      }
      
      return (data || []).map(log => ({
        ...log,
        performer: log.performed_by ? performers[log.performed_by] : undefined,
      })) as AuditLog[];
    },
  });

  const handleExportPDF = () => {
    const data = auditLogs.map((log) => ({
      "Date & Time": log.created_at ? format(new Date(log.created_at), "MMM dd, yyyy HH:mm") : "-",
      Action: log.action_type,
      Entity: `${entityTypeLabels[log.entity_type] || log.entity_type}${log.entity_id ? ` (${log.entity_id.slice(0, 8)}...)` : ""}`,
      "Performed By": log.performer?.full_name || log.performer?.email || "System",
      Details: log.new_data ? JSON.stringify(log.new_data).slice(0, 50) : "-",
      Reason: log.reason || "-",
    }));
    
    const dateRange = startDate && endDate 
      ? `${format(startDate, "MMM dd")} - ${format(endDate, "MMM dd, yyyy")}`
      : "All Time";
    exportToPDF(data, `Audit Logs - ${dateRange}`, "audit_logs");
  };

  const handleExportExcel = () => {
    const data = auditLogs.map((log) => ({
      date: log.created_at ? format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss") : "",
      action: log.action_type,
      entity_type: entityTypeLabels[log.entity_type] || log.entity_type,
      entity_id: log.entity_id || "",
      performed_by: log.performer?.full_name || log.performer?.email || "System",
      original_data: log.original_data ? JSON.stringify(log.original_data) : "",
      new_data: log.new_data ? JSON.stringify(log.new_data) : "",
      reason: log.reason || "",
    }));

    const datePrefix = startDate && endDate
      ? `${format(startDate, "yyyyMMdd")}_${format(endDate, "yyyyMMdd")}`
      : "all";
    exportToExcel(`audit_logs_${datePrefix}`, data, [
      { key: "date", header: "Date" },
      { key: "action", header: "Action" },
      { key: "entity_type", header: "Entity Type" },
      { key: "entity_id", header: "Entity ID" },
      { key: "performed_by", header: "Performed By" },
      { key: "original_data", header: "Original Data" },
      { key: "new_data", header: "New Data" },
      { key: "reason", header: "Reason" },
    ]);
  };

  const getActionIcon = (actionType: string) => {
    const config = actionTypeConfig[actionType];
    if (config) {
      const Icon = config.icon;
      return <Icon className={cn("h-4 w-4", config.color)} />;
    }
    return <ClipboardList className="h-4 w-4 text-muted-foreground" />;
  };

  const getActionBadge = (actionType: string) => {
    const config = actionTypeConfig[actionType];
    const label = config?.label || actionType;
    const colorClass = actionType === "delete" || actionType === "void"
      ? "bg-destructive/10 text-destructive"
      : actionType === "correction" || actionType === "adjustment"
      ? "bg-amber-500/10 text-amber-500"
      : "bg-primary/10 text-primary";
    
    return <Badge className={colorClass}>{label}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Audit Logs
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Action Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="void">Void</SelectItem>
              <SelectItem value="correction">Correction</SelectItem>
              <SelectItem value="adjustment">Adjustment</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="update">Update</SelectItem>
            </SelectContent>
          </Select>

          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="order">Orders</SelectItem>
              <SelectItem value="inventory">Inventory</SelectItem>
              <SelectItem value="menu_item">Menu Items</SelectItem>
              <SelectItem value="user">Users</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="bar">Bars</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "MMM dd") : "Start"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "MMM dd") : "End"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Logs Table */}
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading audit logs...
                  </TableCell>
                </TableRow>
              ) : auditLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {log.created_at && format(new Date(log.created_at), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action_type)}
                        {getActionBadge(log.action_type)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">
                          {entityTypeLabels[log.entity_type] || log.entity_type}
                        </span>
                        {log.entity_id && (
                          <span className="text-xs text-muted-foreground block">
                            {log.entity_id.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.performer?.full_name || log.performer?.email || "System"}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {log.new_data && (
                        <span className="text-xs text-muted-foreground truncate block">
                          {Object.entries(log.new_data)
                            .slice(0, 2)
                            .map(([k, v]) => `${k}: ${String(v).slice(0, 15)}`)
                            .join(", ")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-muted-foreground">
                      {log.reason || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
