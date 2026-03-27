import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Eye, Globe, MousePointerClick } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface DailyViews {
  date: string;
  views: number;
  unique: number;
}

interface TopPage {
  path: string;
  views: number;
}

interface CountryViews {
  country: string;
  views: number;
}

export function SiteAnalytics() {
  const [dailyViews, setDailyViews] = useState<DailyViews[]>([]);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [countryViews, setCountryViews] = useState<CountryViews[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [uniqueSessions, setUniqueSessions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

        // Fetch page views from the last 30 days
        const { data: views } = await supabase
          .from('page_views')
          .select('path, session_id, created_at')
          .gte('created_at', thirtyDaysAgo) as any;

        if (!views || views.length === 0) {
          setLoading(false);
          return;
        }

        setTotalViews(views.length);
        const uniqueSet = new Set(views.map((v: any) => v.session_id));
        setUniqueSessions(uniqueSet.size);

        // Daily views
        const byDay: Record<string, { views: number; sessions: Set<string> }> = {};
        views.forEach((v: any) => {
          const day = format(new Date(v.created_at), 'dd.MM');
          if (!byDay[day]) byDay[day] = { views: 0, sessions: new Set() };
          byDay[day].views++;
          byDay[day].sessions.add(v.session_id);
        });
        setDailyViews(
          Object.entries(byDay)
            .map(([date, d]) => ({ date, views: d.views, unique: d.sessions.size }))
            .slice(-14)
        );

        // Top pages
        const byPath: Record<string, number> = {};
        views.forEach((v: any) => { byPath[v.path] = (byPath[v.path] || 0) + 1; });
        setTopPages(
          Object.entries(byPath)
            .map(([path, views]) => ({ path, views }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 10)
        );
      } catch (err) {
        console.error('Analytics error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Seitenaufrufe (30 Tage)</span>
            </div>
            <p className="text-2xl font-bold">{totalViews}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Unique Sessions</span>
            </div>
            <p className="text-2xl font-bold">{uniqueSessions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <MousePointerClick className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Seiten/Session</span>
            </div>
            <p className="text-2xl font-bold">
              {uniqueSessions > 0 ? (totalViews / uniqueSessions).toFixed(1) : '0'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seitenaufrufe pro Tag</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyViews.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyViews}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Aufrufe" />
                <Bar dataKey="unique" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Unique" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">Noch keine Daten vorhanden</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top-Seiten</CardTitle>
        </CardHeader>
        <CardContent>
          {topPages.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seite</TableHead>
                  <TableHead className="text-right">Aufrufe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPages.map(p => (
                  <TableRow key={p.path}>
                    <TableCell className="font-mono text-sm">{p.path}</TableCell>
                    <TableCell className="text-right">{p.views}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">Noch keine Daten vorhanden</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
