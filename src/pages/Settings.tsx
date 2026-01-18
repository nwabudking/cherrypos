import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings, useUpdateSettings, useUploadLogo } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Settings as SettingsIcon, 
  Building2, 
  Receipt as ReceiptIcon, 
  Shield, 
  Globe, 
  Save, 
  Loader2,
  Upload,
  Image,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  Clock,
  Eye
} from "lucide-react";
import { Receipt } from "@/components/pos/Receipt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RestaurantSettingsForm {
  name?: string;
  tagline?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  currency?: string;
  timezone?: string;
  receipt_footer?: string | null;
  receipt_show_logo?: boolean;
  logo_url?: string | null;
}

const timezones = [
  { value: "Africa/Lagos", label: "Lagos (WAT)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST)" },
  { value: "Africa/Nairobi", label: "Nairobi (EAT)" },
  { value: "Africa/Cairo", label: "Cairo (EET)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "America/New_York", label: "New York (EST/EDT)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
];

const currencies = [
  { value: "NGN", label: "Nigerian Naira (₦)", symbol: "₦" },
  { value: "USD", label: "US Dollar ($)", symbol: "$" },
  { value: "GBP", label: "British Pound (£)", symbol: "£" },
  { value: "EUR", label: "Euro (€)", symbol: "€" },
  { value: "ZAR", label: "South African Rand (R)", symbol: "R" },
  { value: "KES", label: "Kenyan Shilling (KSh)", symbol: "KSh" },
  { value: "GHS", label: "Ghanaian Cedi (₵)", symbol: "₵" },
  { value: "AED", label: "UAE Dirham (AED)", symbol: "AED" },
];

const Settings = () => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState("restaurant");
  const [restaurantForm, setRestaurantForm] = useState<RestaurantSettingsForm>({});
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEditSettings = role === "super_admin" || role === "manager";

  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateSettingsMutation = useUpdateSettings();
  const uploadLogoMutation = useUploadLogo();

  // Initialize form when settings load
  if (settings && !restaurantForm.name) {
    setRestaurantForm(settings);
  }

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
      }
      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password changed successfully");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast.error("Failed to change password: " + error.message);
    },
  });

  const handleSaveRestaurant = () => {
    updateSettingsMutation.mutate(restaurantForm);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    const logoUrl = await uploadLogoMutation.mutateAsync(file);
    setRestaurantForm({ ...restaurantForm, logo_url: logoUrl });
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your restaurant, receipts, and system preferences
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="restaurant" className="gap-2">
            <Building2 className="h-4 w-4 hidden sm:block" />
            Restaurant
          </TabsTrigger>
        <TabsTrigger value="receipt" className="gap-2">
            <ReceiptIcon className="h-4 w-4 hidden sm:block" />
            Receipt
          </TabsTrigger>
          <TabsTrigger value="regional" className="gap-2">
            <Globe className="h-4 w-4 hidden sm:block" />
            Regional
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4 hidden sm:block" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Restaurant Settings Tab */}
        <TabsContent value="restaurant" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Business Information
              </CardTitle>
              <CardDescription>
                Your restaurant details appear on receipts, reports, and customer communications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Business Name & Tagline */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Restaurant Name *</Label>
                  <Input
                    id="name"
                    placeholder="Cherry Dining"
                    value={restaurantForm.name || ""}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, name: e.target.value })}
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline / Subtitle</Label>
                  <Input
                    id="tagline"
                    placeholder="& Lounge"
                    value={restaurantForm.tagline || ""}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, tagline: e.target.value })}
                    disabled={!canEditSettings}
                  />
                </div>
              </div>

              <Separator />

              {/* Location */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Location
                </h4>
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    placeholder="123 Restaurant Street"
                    value={restaurantForm.address || ""}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, address: e.target.value })}
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="Lagos"
                      value={restaurantForm.city || ""}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, city: e.target.value })}
                      disabled={!canEditSettings}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      placeholder="Nigeria"
                      value={restaurantForm.country || ""}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, country: e.target.value })}
                      disabled={!canEditSettings}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contact Info */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Contact Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+234 800 000 0000"
                      value={restaurantForm.phone || ""}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, phone: e.target.value })}
                      disabled={!canEditSettings}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="info@restaurant.com"
                      value={restaurantForm.email || ""}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, email: e.target.value })}
                      disabled={!canEditSettings}
                    />
                  </div>
                </div>
              </div>

              {canEditSettings && (
                <Button onClick={handleSaveRestaurant} disabled={updateSettingsMutation.isPending}>
                  {updateSettingsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receipt Settings Tab */}
        <TabsContent value="receipt" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5 text-primary" />
                Receipt Logo
              </CardTitle>
              <CardDescription>
                Upload your business logo to appear on printed receipts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-6">
                {/* Logo Preview */}
                <div className="w-24 h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden">
                  {restaurantForm.logo_url ? (
                    <img 
                      src={restaurantForm.logo_url} 
                      alt="Logo preview" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Image className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={restaurantForm.receipt_show_logo || false}
                      onCheckedChange={(checked) =>
                        setRestaurantForm({ ...restaurantForm, receipt_show_logo: checked })
                      }
                      disabled={!canEditSettings}
                    />
                    <Label>Show logo on receipts</Label>
                  </div>
                  
                  {canEditSettings && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadLogoMutation.isPending}
                      >
                        {uploadLogoMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload Logo
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Recommended: Square image, max 2MB
                      </p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptIcon className="h-5 w-5 text-primary" />
                Receipt Content
              </CardTitle>
              <CardDescription>
                Customize the message shown at the bottom of receipts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receipt_footer">Footer Message</Label>
                <Textarea
                  id="receipt_footer"
                  placeholder="Thank you for dining with us!"
                  value={restaurantForm.receipt_footer || ""}
                  onChange={(e) =>
                    setRestaurantForm({ ...restaurantForm, receipt_footer: e.target.value })
                  }
                  rows={3}
                  disabled={!canEditSettings}
                />
                <p className="text-xs text-muted-foreground">
                  This message appears at the bottom of every printed receipt
                </p>
              </div>

              {canEditSettings && (
                <Button onClick={handleSaveRestaurant} disabled={updateSettingsMutation.isPending}>
                  {updateSettingsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Receipt Preview */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Receipt Preview
              </CardTitle>
              <CardDescription>
                See how your receipt will look when printed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <div className="border border-border rounded-lg shadow-sm overflow-hidden transform scale-90 origin-top">
                  <Receipt
                    orderNumber="ORD-001234"
                    orderType="dine_in"
                    tableNumber="T5"
                    items={[
                      { id: "1", menuItemId: "m1", name: "Grilled Chicken", price: 4500, quantity: 2 },
                      { id: "2", menuItemId: "m2", name: "Jollof Rice", price: 2500, quantity: 2 },
                      { id: "3", menuItemId: "m3", name: "Chapman", price: 1500, quantity: 3, notes: "Less sugar" },
                    ]}
                    subtotal={18500}
                    total={18500}
                    paymentMethod="card"
                    cashierName="Sample Cashier"
                    barName="Main Bar"
                    copyType="customer"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-4">
                This is a sample preview. Actual receipts will use real order data.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Regional Settings Tab */}
        <TabsContent value="regional" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Currency
              </CardTitle>
              <CardDescription>
                Set the currency used for pricing and transactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Select
                  value={restaurantForm.currency || "NGN"}
                  onValueChange={(value) => setRestaurantForm({ ...restaurantForm, currency: value })}
                  disabled={!canEditSettings}
                >
                  <SelectTrigger id="currency" className="w-full md:w-[300px]">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.value} value={currency.value}>
                        {currency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Currency symbol will appear on receipts and reports
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Timezone
              </CardTitle>
              <CardDescription>
                Set the timezone for orders, reports, and timestamps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={restaurantForm.timezone || "Africa/Lagos"}
                  onValueChange={(value) => setRestaurantForm({ ...restaurantForm, timezone: value })}
                  disabled={!canEditSettings}
                >
                  <SelectTrigger id="timezone" className="w-full md:w-[300px]">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {canEditSettings && (
                <Button onClick={handleSaveRestaurant} disabled={updateSettingsMutation.isPending}>
                  {updateSettingsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your account password for security
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new_password">New Password</Label>
                  <Input
                    id="new_password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirm Password</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters long
              </p>
              <Button
                onClick={() => changePasswordMutation.mutate()}
                disabled={changePasswordMutation.isPending || !newPassword || !confirmPassword}
              >
                {changePasswordMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Update Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
