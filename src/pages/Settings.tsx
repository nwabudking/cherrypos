import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Settings as SettingsIcon, Building2, Receipt, User, Globe, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RestaurantSettings {
  id: string;
  name: string;
  tagline: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  currency: string;
  timezone: string;
  receipt_footer: string | null;
  receipt_show_logo: boolean;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

const timezones = [
  { value: "Africa/Lagos", label: "Lagos (WAT)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST)" },
  { value: "Africa/Nairobi", label: "Nairobi (EAT)" },
  { value: "Africa/Cairo", label: "Cairo (EET)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "America/New_York", label: "New York (EST/EDT)" },
];

const currencies = [
  { value: "NGN", label: "Nigerian Naira (₦)" },
  { value: "USD", label: "US Dollar ($)" },
  { value: "GBP", label: "British Pound (£)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "ZAR", label: "South African Rand (R)" },
  { value: "KES", label: "Kenyan Shilling (KSh)" },
];

const Settings = () => {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("restaurant");
  
  // Restaurant settings state
  const [restaurantForm, setRestaurantForm] = useState<Partial<RestaurantSettings>>({});
  
  // User profile state
  const [profileForm, setProfileForm] = useState<Partial<UserProfile>>({});
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const canEditSettings = role === "super_admin" || role === "manager";

  // Fetch restaurant settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["restaurant-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setRestaurantForm(data);
      }
      return data as RestaurantSettings | null;
    },
  });

  // Fetch user profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfileForm(data);
      }
      return data as UserProfile | null;
    },
    enabled: !!user?.id,
  });

  // Update restaurant settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<RestaurantSettings>) => {
      if (!settings?.id) throw new Error("No settings found");
      const { error } = await supabase
        .from("restaurant_settings")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", settings.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-settings"] });
      toast.success("Settings saved successfully");
    },
    onError: (error) => {
      toast.error("Failed to save settings: " + error.message);
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast.success("Profile updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update profile: " + error.message);
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
      }
      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      toast.error("Failed to change password: " + error.message);
    },
  });

  const handleSaveRestaurant = () => {
    updateSettingsMutation.mutate(restaurantForm);
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileForm);
  };

  const handleChangePassword = () => {
    changePasswordMutation.mutate();
  };

  if (settingsLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your restaurant and account settings
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
            <Receipt className="h-4 w-4 hidden sm:block" />
            Receipt
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <User className="h-4 w-4 hidden sm:block" />
            Account
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Globe className="h-4 w-4 hidden sm:block" />
            System
          </TabsTrigger>
        </TabsList>

        {/* Restaurant Profile Tab */}
        <TabsContent value="restaurant" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Restaurant Information</CardTitle>
              <CardDescription>
                This information will appear on receipts and reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Restaurant Name</Label>
                  <Input
                    id="name"
                    value={restaurantForm.name || ""}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, name: e.target.value })}
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={restaurantForm.tagline || ""}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, tagline: e.target.value })}
                    placeholder="e.g., & Lounge"
                    disabled={!canEditSettings}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
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
                    value={restaurantForm.city || ""}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, city: e.target.value })}
                    disabled={!canEditSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={restaurantForm.country || ""}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, country: e.target.value })}
                    disabled={!canEditSettings}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
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
                    value={restaurantForm.email || ""}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, email: e.target.value })}
                    disabled={!canEditSettings}
                  />
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
              <CardTitle>Receipt Customization</CardTitle>
              <CardDescription>
                Customize how your receipts look when printed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Logo on Receipt</Label>
                  <p className="text-sm text-muted-foreground">
                    Display your restaurant logo at the top of receipts
                  </p>
                </div>
                <Switch
                  checked={restaurantForm.receipt_show_logo || false}
                  onCheckedChange={(checked) =>
                    setRestaurantForm({ ...restaurantForm, receipt_show_logo: checked })
                  }
                  disabled={!canEditSettings}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt_footer">Receipt Footer Message</Label>
                <Textarea
                  id="receipt_footer"
                  value={restaurantForm.receipt_footer || ""}
                  onChange={(e) =>
                    setRestaurantForm({ ...restaurantForm, receipt_footer: e.target.value })
                  }
                  placeholder="Thank you for dining with us!"
                  rows={3}
                  disabled={!canEditSettings}
                />
                <p className="text-xs text-muted-foreground">
                  This message will appear at the bottom of every receipt
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
              <CardTitle>Receipt Preview</CardTitle>
              <CardDescription>
                See how your receipt will look
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <div
                  className="bg-white text-black p-6 w-[300px] font-mono text-sm border rounded-lg shadow-sm"
                  style={{ fontFamily: "'Courier New', Courier, monospace" }}
                >
                  <div className="text-center mb-4">
                    <h1 className="text-lg font-bold">{restaurantForm.name || "RESTAURANT NAME"}</h1>
                    {restaurantForm.tagline && (
                      <p className="text-xs">{restaurantForm.tagline}</p>
                    )}
                    <p className="text-xs mt-2">{restaurantForm.address || "Address"}</p>
                    <p className="text-xs">{restaurantForm.city}, {restaurantForm.country}</p>
                    <p className="text-xs">Tel: {restaurantForm.phone || "Phone"}</p>
                  </div>
                  <div className="border-t border-dashed border-gray-400 my-3" />
                  <div className="text-xs text-center text-gray-500">
                    [Order details would appear here]
                  </div>
                  <div className="border-t border-dashed border-gray-400 my-3" />
                  <div className="text-center text-xs space-y-1">
                    <p className="font-bold">{restaurantForm.receipt_footer || "Thank you!"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={profileForm.full_name || ""}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile_email">Email</Label>
                  <Input
                    id="profile_email"
                    type="email"
                    value={profileForm.email || user?.email || ""}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Current Role</Label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium capitalize">
                    {role?.replace("_", " ") || "No role assigned"}
                  </span>
                </div>
              </div>

              <Button onClick={handleSaveProfile} disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Profile
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your account password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={!newPassword || !confirmPassword || changePasswordMutation.isPending}
                variant="secondary"
              >
                {changePasswordMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Change Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Regional Settings</CardTitle>
              <CardDescription>
                Configure currency and timezone preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={restaurantForm.currency || "NGN"}
                    onValueChange={(value) =>
                      setRestaurantForm({ ...restaurantForm, currency: value })
                    }
                    disabled={!canEditSettings}
                  >
                    <SelectTrigger>
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={restaurantForm.timezone || "Africa/Lagos"}
                    onValueChange={(value) =>
                      setRestaurantForm({ ...restaurantForm, timezone: value })
                    }
                    disabled={!canEditSettings}
                  >
                    <SelectTrigger>
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

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>
                Application version and status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Application</span>
                <span className="font-medium">Cherry POS</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Status</span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span className="font-medium text-emerald-500">Online</span>
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
