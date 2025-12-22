import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export const PlaceholderPage = ({ title, description }: PlaceholderPageProps) => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Card className="bg-card border-border max-w-md w-full text-center">
      <CardHeader>
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Construction className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-xl text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  </div>
);

export const POS = () => <PlaceholderPage title="Point of Sale" description="POS interface coming soon" />;
export const Orders = () => <PlaceholderPage title="Orders" description="Order management coming soon" />;
export const Tables = () => <PlaceholderPage title="Tables" description="Table management coming soon" />;
export const Menu = () => <PlaceholderPage title="Menu Management" description="Menu editor coming soon" />;
export const Bar = () => <PlaceholderPage title="Bar Orders" description="Bar management coming soon" />;
export const Kitchen = () => <PlaceholderPage title="Kitchen Display" description="Kitchen display coming soon" />;
export const Inventory = () => <PlaceholderPage title="Inventory" description="Inventory management coming soon" />;
export const Staff = () => <PlaceholderPage title="Staff" description="Staff management coming soon" />;
export const Customers = () => <PlaceholderPage title="Customers" description="Customer management coming soon" />;
export const Reports = () => <PlaceholderPage title="Reports" description="Reports & analytics coming soon" />;
export const SettingsPage = () => <PlaceholderPage title="Settings" description="System settings coming soon" />;
