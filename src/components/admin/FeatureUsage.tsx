import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Receipt, FileText, Landmark, Mail, Cloud, Users } from 'lucide-react';

interface FeatureUsageProps {
  data: {
    total_receipts: number;
    total_invoices: number;
    active_bank_connections: number;
    active_email_accounts: number;
    active_cloud_connections: number;
    total_users: number;
  } | null;
  loading: boolean;
}

export function FeatureUsage({ data, loading }: FeatureUsageProps) {
  if (loading) {
    return <div className="text-muted-foreground text-sm">Lade Feature-Nutzungsdaten...</div>;
  }

  if (!data) return null;

  const kpis = [
    { label: 'Benutzer', value: data.total_users, icon: Users, color: 'text-primary' },
    { label: 'Belege', value: data.total_receipts, icon: Receipt, color: 'text-primary' },
    { label: 'Rechnungen', value: data.total_invoices, icon: FileText, color: 'text-primary' },
    { label: 'Bank-Verbindungen', value: data.active_bank_connections, icon: Landmark, color: 'text-primary' },
    { label: 'E-Mail-Import', value: data.active_email_accounts, icon: Mail, color: 'text-primary' },
    { label: 'Cloud-Backup', value: data.active_cloud_connections, icon: Cloud, color: 'text-primary' },
  ];

  const chartData = [
    { name: 'Belege', count: data.total_receipts },
    { name: 'Rechnungen', count: data.total_invoices },
    { name: 'Bank', count: data.active_bank_connections },
    { name: 'E-Mail', count: data.active_email_accounts },
    { name: 'Cloud', count: data.active_cloud_connections },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">{kpi.label}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value.toLocaleString('de-DE')}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feature-Nutzung Übersicht</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
