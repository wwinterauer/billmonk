import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CreditCard, TrendingUp, UserMinus, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

interface Metrics {
  totalUsers: number;
  payingUsers: number;
  mrr: number;
  trialUsers: number;
  churnedUsers: number;
  trialToPaidRate: number;
  planDistribution: { name: string; count: number }[];
  registrationsByMonth: { month: string; count: number }[];
}

const COLORS = ['hsl(var(--muted))', 'hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))'];

export function SubscriptionMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('admin-metrics');
        if (error) throw error;
        setMetrics(data);
      } catch (err) {
        toast.error('Fehler beim Laden der Metriken');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!metrics) return null;

  const kpis = [
    { label: 'Gesamtnutzer', value: metrics.totalUsers, icon: Users, color: 'text-primary' },
    { label: 'Zahlende Nutzer', value: metrics.payingUsers, icon: CreditCard, color: 'text-green-500' },
    { label: 'MRR (€)', value: `€${metrics.mrr.toFixed(2)}`, icon: TrendingUp, color: 'text-blue-500' },
    { label: 'In Testphase', value: metrics.trialUsers, icon: Clock, color: 'text-yellow-500' },
    { label: 'Trial → Paid', value: `${metrics.trialToPaidRate.toFixed(1)}%`, icon: TrendingUp, color: 'text-emerald-500' },
    { label: 'Gekündigt', value: metrics.churnedUsers, icon: UserMinus, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrierungen pro Monat</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={metrics.registrationsByMonth}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan-Verteilung</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={metrics.planDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="count"
                  nameKey="name"
                  label={({ name, count }) => `${name}: ${count}`}
                >
                  {metrics.planDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
