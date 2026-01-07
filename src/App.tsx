import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Migration from "./pages/Migration";
import EODReport from "./pages/EODReport";
import { POS, Orders, OrderHistory, Tables, Menu, Bar, Kitchen, Inventory, Staff, Customers, Reports, SettingsPage, StorePage, BarsManagementPage } from "./pages/modules";
import { BarProvider } from "@/contexts/BarContext";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BarProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/auth" element={<Auth />} />
              {/* Protected Dashboard Routes */}
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/order-history" element={<OrderHistory />} />
                <Route path="/eod-report" element={<EODReport />} />
                <Route path="/tables" element={<Tables />} />
                <Route path="/menu" element={<Menu />} />
                <Route path="/bar" element={<Bar />} />
                <Route path="/kitchen" element={<Kitchen />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/staff" element={<Staff />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/migration" element={<Migration />} />
                <Route path="/store" element={<StorePage />} />
                <Route path="/bars" element={<BarsManagementPage />} />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </BarProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
