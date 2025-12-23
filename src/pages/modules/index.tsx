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

export { default as POS } from '@/pages/POS';
export { default as Orders } from '@/pages/Orders';
export const Tables = () => <PlaceholderPage title="Tables" description="Table management coming soon" />;
export { default as Menu } from '@/pages/MenuManagement';
export { default as Bar } from '@/pages/Bar';
export { default as Kitchen } from '@/pages/Kitchen';
export { default as Inventory } from '@/pages/Inventory';
export { default as Staff } from '@/pages/Staff';
export const Customers = () => <PlaceholderPage title="Customers" description="Customer management coming soon" />;
export { default as Reports } from '@/pages/Reports';
export const SettingsPage = () => <PlaceholderPage title="Settings" description="System settings coming soon" />;
