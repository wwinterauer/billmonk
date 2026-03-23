import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/admin/UserManagement';
import { SubscriptionMetrics } from '@/components/admin/SubscriptionMetrics';
import { SiteAnalytics } from '@/components/admin/SiteAnalytics';
import { NewsletterManagement } from '@/components/admin/NewsletterManagement';
import { SystemHealth } from '@/components/admin/SystemHealth';
import { FeatureUsage } from '@/components/admin/FeatureUsage';
import { ActivityFeed } from '@/components/admin/ActivityFeed';
import { AnnouncementManager } from '@/components/admin/AnnouncementManager';
import { Shield, Users, CreditCard, BarChart3, Mail, HeartPulse, Blocks, Activity, Megaphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Admin() {
  const [healthData, setHealthData] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await supabase.functions.invoke('admin-system-health', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.data) {
          setHealthData(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch health data:', error);
      } finally {
        setHealthLoading(false);
      }
    };

    fetchHealthData();
  }, []);

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
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Benutzer
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Abo-Metriken
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-2">
              <HeartPulse className="h-4 w-4" />
              System Health
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-2">
              <Blocks className="h-4 w-4" />
              Features
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="h-4 w-4" />
              Aktivität
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="newsletter" className="gap-2">
              <Mail className="h-4 w-4" />
              Newsletter
            </TabsTrigger>
            <TabsTrigger value="announcements" className="gap-2">
              <Megaphone className="h-4 w-4" />
              Announcements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>
          <TabsContent value="metrics">
            <SubscriptionMetrics />
          </TabsContent>
          <TabsContent value="health">
            <SystemHealth data={healthData?.health} loading={healthLoading} />
          </TabsContent>
          <TabsContent value="features">
            <FeatureUsage data={healthData?.features} loading={healthLoading} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityFeed data={healthData?.activity} loading={healthLoading} />
          </TabsContent>
          <TabsContent value="analytics">
            <SiteAnalytics />
          </TabsContent>
          <TabsContent value="newsletter">
            <NewsletterManagement />
          </TabsContent>
          <TabsContent value="announcements">
            <AnnouncementManager />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
