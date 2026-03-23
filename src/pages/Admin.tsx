import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/admin/UserManagement';
import { SubscriptionMetrics } from '@/components/admin/SubscriptionMetrics';
import { SiteAnalytics } from '@/components/admin/SiteAnalytics';
import { NewsletterManagement } from '@/components/admin/NewsletterManagement';
import { Shield, Users, CreditCard, BarChart3, Mail } from 'lucide-react';

export default function Admin() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm">Plattform-Verwaltung und Statistiken</p>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Benutzer
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Abo-Metriken
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="newsletter" className="gap-2">
              <Mail className="h-4 w-4" />
              Newsletter
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>
          <TabsContent value="metrics">
            <SubscriptionMetrics />
          </TabsContent>
          <TabsContent value="analytics">
            <SiteAnalytics />
          </TabsContent>
          <TabsContent value="newsletter">
            <NewsletterManagement />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
