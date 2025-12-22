import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DollarSign,
  ShoppingCart,
  Grid3X3,
  AlertTriangle,
  TrendingUp,
  Users,
  Clock,
  Utensils,
} from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ElementType;
  iconColor?: string;
}

const KPICard = ({ title, value, change, changeType = 'neutral', icon: Icon, iconColor }: KPICardProps) => (
  <Card className="bg-card border-border hover:border-primary/30 transition-colors">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <div className={`p-2 rounded-lg ${iconColor || 'bg-primary/10'}`}>
        <Icon className={`h-4 w-4 ${iconColor ? 'text-primary-foreground' : 'text-primary'}`} />
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {change && (
        <p className={`text-xs mt-1 ${
          changeType === 'positive' ? 'text-success' :
          changeType === 'negative' ? 'text-destructive' :
          'text-muted-foreground'
        }`}>
          {change}
        </p>
      )}
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const { profile, role } = useAuth();

  // Mock data - will be replaced with real data later
  const kpiData = {
    dailySales: '₦485,200',
    activeOrders: '12',
    activeTables: '8/15',
    lowStockItems: '5',
  };

  const recentOrders = [
    { id: 'ORD-001', table: 'Table 5', amount: '₦15,500', status: 'Preparing', time: '5 min ago' },
    { id: 'ORD-002', table: 'Table 3', amount: '₦8,200', status: 'Served', time: '12 min ago' },
    { id: 'ORD-003', table: 'Takeaway', amount: '₦22,000', status: 'Ready', time: '18 min ago' },
    { id: 'ORD-004', table: 'Table 8', amount: '₦31,750', status: 'Pending', time: '25 min ago' },
  ];

  const topSellingItems = [
    { name: 'Jollof Rice & Chicken', sold: 45, revenue: '₦180,000' },
    { name: 'Chapman', sold: 38, revenue: '₦76,000' },
    { name: 'Pepper Soup', sold: 32, revenue: '₦96,000' },
    { name: 'Suya Platter', sold: 28, revenue: '₦112,000' },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'there'}!
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening at Cherry Dining Lounge today.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Today's Sales"
          value={kpiData.dailySales}
          change="+12.5% from yesterday"
          changeType="positive"
          icon={DollarSign}
          iconColor="gradient-cherry"
        />
        <KPICard
          title="Active Orders"
          value={kpiData.activeOrders}
          change="3 pending preparation"
          changeType="neutral"
          icon={ShoppingCart}
        />
        <KPICard
          title="Tables Occupied"
          value={kpiData.activeTables}
          change="53% occupancy"
          changeType="neutral"
          icon={Grid3X3}
        />
        <KPICard
          title="Low Stock Alerts"
          value={kpiData.lowStockItems}
          change="Needs attention"
          changeType="negative"
          icon={AlertTriangle}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Utensils className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{order.id}</p>
                      <p className="text-sm text-muted-foreground">{order.table}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">{order.amount}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      order.status === 'Served' ? 'bg-success/20 text-success' :
                      order.status === 'Ready' ? 'bg-gold/20 text-gold' :
                      order.status === 'Preparing' ? 'bg-primary/20 text-primary' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Selling Items */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Top Selling Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topSellingItems.map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-gold/20 text-gold' :
                      index === 1 ? 'bg-muted-foreground/20 text-muted-foreground' :
                      index === 2 ? 'bg-primary/20 text-primary' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.sold} sold</p>
                    </div>
                  </div>
                  <p className="font-medium text-foreground">{item.revenue}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">127</p>
              <p className="text-sm text-muted-foreground">Customers Today</p>
            </div>
          </div>
        </Card>
        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">48</p>
              <p className="text-sm text-muted-foreground">Orders Completed</p>
            </div>
          </div>
        </Card>
        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">₦10,108</p>
              <p className="text-sm text-muted-foreground">Avg. Order Value</p>
            </div>
          </div>
        </Card>
        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">18 min</p>
              <p className="text-sm text-muted-foreground">Avg. Prep Time</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
