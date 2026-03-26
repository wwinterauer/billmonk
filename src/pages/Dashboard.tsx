import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { 
  TrendingDown, 
  TrendingUp, 
  Receipt, 
  Search,
  Plus,
  ArrowRight,
  Calendar,
  AlertCircle,
  RefreshCw,
  Tag,
  Euro,
  FileText,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ReceiptDetailPanel } from '@/components/receipts/ReceiptDetailPanel';
import { FeatureGate } from '@/components/FeatureGate';
import { useDashboardData } from '@/hooks/useDashboardData';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Offen', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  processing: { label: 'Verarbeitung', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  review: { label: 'Review', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  approved: { label: 'Freigegeben', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  rejected: { label: 'Abgelehnt', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

const DEFAULT_COLORS = [
  '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', 
  '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#8B5CF6'
];

const Dashboard = () => {
  const navigate = useNavigate();
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  
  // Detail panel state
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  const { 
    loading, 
    error, 
    stats, 
    categoryData,
    tagData,
    untaggedTotal,
    recentReceipts, 
    percentageChange,
    refetch 
  } = useDashboardData(selectedYear, selectedMonth);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-AT', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(value);
  };

  const formatDate = (dateStr: string | null, createdAt: string) => {
    const date = dateStr ? new Date(dateStr) : new Date(createdAt);
    return format(date, 'dd.MM.yyyy', { locale: de });
  };

  // Generate month options
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    monthOptions.push({
      value: `${date.getFullYear()}-${date.getMonth() + 1}`,
      label: format(date, 'MMMM yyyy', { locale: de }),
      year: date.getFullYear(),
      month: date.getMonth() + 1,
    });
  }

  const handleMonthChange = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  const openReceiptDetail = (id: string) => {
    setSelectedReceiptId(id);
    setDetailPanelOpen(true);
  };

  // Prepare chart data
  const chartData = categoryData.map((cat, index) => ({
    name: cat.category,
    value: cat.total,
    color: cat.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
  }));

  const totalCategorySum = chartData.reduce((sum, d) => sum + d.value, 0);

  // Stats cards configuration
  const statsCards = [
    {
      title: 'Ausgaben',
      value: loading ? null : formatCurrency(stats.totalExpenses),
      change: percentageChange !== null 
        ? `${percentageChange >= 0 ? '↑' : '↓'} ${Math.abs(percentageChange)}% vs. Vormonat`
        : 'Kein Vormonatsvergleich',
      changeType: percentageChange !== null 
        ? (percentageChange <= 0 ? 'positive' : 'warning')
        : 'neutral',
      icon: percentageChange !== null && percentageChange <= 0 ? TrendingDown : TrendingUp,
    },
    {
      title: 'Vorsteuer',
      value: loading ? null : formatCurrency(stats.totalVat),
      change: 'Dieser Monat',
      changeType: 'neutral',
      icon: Receipt,
    },
    {
      title: 'Belege erfasst',
      value: loading ? null : stats.receiptCount.toString(),
      change: stats.openReceiptCount + stats.reviewReceiptCount > 0 
        ? `${stats.openReceiptCount + stats.reviewReceiptCount} noch offen`
        : 'Alle verarbeitet',
      changeType: stats.openReceiptCount + stats.reviewReceiptCount > 0 ? 'warning' : 'positive',
      icon: Receipt,
    },
    {
      title: 'Trefferquote',
      value: loading ? null : (stats.avgAiConfidence !== null
        ? `${Math.round(stats.avgAiConfidence * 100)}%`
        : '–'),
      change: 'KI-Genauigkeit',
      changeType: 'positive',
      icon: Search,
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Übersicht deiner Ausgaben</p>
          </div>
          <div className="flex items-center gap-4">
            <Select 
              value={`${selectedYear}-${selectedMonth}`} 
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="w-48">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Monat wählen" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link to="/upload">
              <Button className="gradient-primary hover:opacity-90">
                <Plus className="h-4 w-4 mr-2" />
                Beleg hochladen
              </Button>
            </Link>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-destructive">{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Erneut laden
            </Button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-muted-foreground">{stat.title}</span>
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <stat.icon className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-24 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-foreground mb-1 font-mono">{stat.value}</p>
                      <p className={`text-sm ${
                        stat.changeType === 'positive' ? 'text-success' :
                        stat.changeType === 'warning' ? 'text-warning' :
                        'text-muted-foreground'
                      }`}>
                        {stat.change}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Income KPIs (Business feature) */}
        <FeatureGate feature="invoiceModule" className="mb-8">
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">Einnahmen (Monat)</span>
                  <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Euro className="h-4 w-4 text-green-600" />
                  </div>
                </div>
                {loading ? (
                  <>
                    <Skeleton className="h-8 w-24 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-foreground mb-1 font-mono">{formatCurrency(stats.paidThisMonth)}</p>
                    <p className="text-sm text-muted-foreground">Bezahlte Rechnungen</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">Offene Rechnungen</span>
                  <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-orange-500" />
                  </div>
                </div>
                {loading ? (
                  <>
                    <Skeleton className="h-8 w-24 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-foreground mb-1 font-mono">{formatCurrency(stats.openInvoiceAmount)}</p>
                    <p className="text-sm text-muted-foreground">{stats.openInvoiceCount} Rechnung{stats.openInvoiceCount !== 1 ? 'en' : ''} offen</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">Gewinn/Verlust</span>
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                </div>
                {loading ? (
                  <>
                    <Skeleton className="h-8 w-24 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </>
                ) : (
                  <>
                    <p className={`text-2xl font-bold mb-1 font-mono ${stats.paidThisMonth - stats.totalExpenses >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {formatCurrency(stats.paidThisMonth - stats.totalExpenses)}
                    </p>
                    <p className="text-sm text-muted-foreground">Einnahmen − Ausgaben</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </FeatureGate>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Receipts */}
          <motion.div 
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Letzte Belege</CardTitle>
                <Link to="/expenses">
                  <Button variant="ghost" size="sm">
                    Alle anzeigen
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-10 w-10 rounded-lg" />
                          <div>
                            <Skeleton className="h-4 w-32 mb-2" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-6 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentReceipts.length === 0 ? (
                  <div className="py-8 text-center">
                    <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Noch keine Belege vorhanden</p>
                    <Link to="/upload">
                      <Button className="mt-4 gradient-primary hover:opacity-90" size="sm">
                        Ersten Beleg hochladen
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentReceipts.map((receipt) => (
                      <div
                        key={receipt.id}
                        onClick={() => openReceiptDetail(receipt.id)}
                        className="flex items-center justify-between py-3 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            <Receipt className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {receipt.vendor || 'Unbekannter Lieferant'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(receipt.receipt_date, receipt.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-medium text-foreground font-mono">
                            {receipt.amount_gross !== null
                              ? formatCurrency(receipt.amount_gross)
                              : '–'
                            }
                          </span>
                          <Badge 
                            variant="outline"
                            className={STATUS_CONFIG[receipt.status]?.className || ''}
                          >
                            {STATUS_CONFIG[receipt.status]?.label || receipt.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Sidebar Content */}
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            {/* Actions Required */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Aktionen erforderlich</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <Skeleton className="h-4 w-20 mb-2" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                      <Skeleton className="h-8 w-16" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {stats.reviewReceiptCount} Beleg{stats.reviewReceiptCount !== 1 ? 'e' : ''}
                        </p>
                        <p className="text-sm text-muted-foreground">warten auf Review</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate('/expenses')}
                        disabled={stats.reviewReceiptCount === 0}
                      >
                        Prüfen
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {stats.unmatchedTransactions} Buchung{stats.unmatchedTransactions !== 1 ? 'en' : ''}
                        </p>
                        <p className="text-sm text-muted-foreground">nicht zugeordnet</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate('/reconciliation')}
                        disabled={stats.unmatchedTransactions === 0}
                      >
                        Abgleichen
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Category Chart */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Ausgaben nach Kategorie</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-48 flex items-center justify-center">
                    <Skeleton className="h-32 w-32 rounded-full" />
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Keine Kategorien-Daten</p>
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [
                            `${formatCurrency(value)} (${Math.round((value / totalCategorySum) * 100)}%)`,
                            name
                          ]}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend 
                          layout="vertical" 
                          align="right" 
                          verticalAlign="middle"
                          formatter={(value, entry: any) => (
                            <span className="text-xs text-foreground">{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tag Statistics */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Ausgaben nach Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                ) : tagData.length === 0 && untaggedTotal === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-sm text-muted-foreground">Keine Tag-Daten</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tagData.slice(0, 5).map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center justify-between py-1.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div 
                            className="h-3 w-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="text-sm text-foreground truncate">{tag.name}</span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {tag.count}
                          </Badge>
                        </div>
                        <span className="text-sm font-medium text-foreground ml-2">
                          {formatCurrency(tag.total)}
                        </span>
                      </div>
                    ))}
                    {untaggedTotal > 0 && (
                      <div className="flex items-center justify-between py-1.5 border-t pt-2 mt-2">
                        <span className="text-sm text-muted-foreground">(ohne Tags)</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(untaggedTotal)}
                        </span>
                      </div>
                    )}
                    {tagData.length > 5 && (
                      <p className="text-xs text-muted-foreground pt-1">
                        +{tagData.length - 5} weitere Tags
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Floating Action Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Link 
            to="/upload"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full gradient-primary shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity lg:hidden z-50"
          >
            <Plus className="h-6 w-6 text-primary-foreground" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Beleg hochladen</p>
        </TooltipContent>
      </Tooltip>

      {/* Receipt Detail Panel */}
      <ReceiptDetailPanel
        receiptId={selectedReceiptId}
        open={detailPanelOpen}
        onClose={() => {
          setDetailPanelOpen(false);
          setSelectedReceiptId(null);
        }}
        onUpdate={refetch}
      />
    </DashboardLayout>
  );
};

export default Dashboard;
