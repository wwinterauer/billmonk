import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  FileText,
  FileSpreadsheet,
  File,
  Printer,
  CalendarIcon,
  Euro,
  Receipt,
  Percent,
  Calculator,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const Reports = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Period state
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | 'year' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedQuarter, setSelectedQuarter] = useState(
    Math.ceil((new Date().getMonth() + 1) / 3).toString()
  );
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const months = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  
  const years = [2024, 2025, 2026];

  // Calculate date range based on period selection
  const dateRange = useMemo(() => {
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const quarter = parseInt(selectedQuarter);

    switch (periodType) {
      case 'month':
        return {
          from: new Date(year, month, 1),
          to: new Date(year, month + 1, 0)
        };
      case 'quarter':
        return {
          from: new Date(year, (quarter - 1) * 3, 1),
          to: new Date(year, quarter * 3, 0)
        };
      case 'year':
        return {
          from: new Date(year, 0, 1),
          to: new Date(year, 11, 31)
        };
      case 'custom':
        return { from: dateFrom, to: dateTo };
      default:
        return { from: new Date(), to: new Date() };
    }
  }, [periodType, selectedMonth, selectedYear, selectedQuarter, dateFrom, dateTo]);

  // Fetch receipts data for selected period
  const { data: receipts, isLoading } = useQuery({
    queryKey: ['reports', dateRange.from?.toISOString(), dateRange.to?.toISOString(), user?.id],
    queryFn: async () => {
      if (!user || !dateRange.from || !dateRange.to) return [];
      
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user.id)
        .gte('receipt_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('receipt_date', format(dateRange.to, 'yyyy-MM-dd'))
        .eq('status', 'approved');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!dateRange.from && !!dateRange.to,
  });

  // Fetch categories for color mapping
  const { data: categories } = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${user.id},is_system.eq.true`);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch previous period data for comparison
  const previousPeriodRange = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return null;
    
    const periodLength = dateRange.to.getTime() - dateRange.from.getTime();
    const previousFrom = new Date(dateRange.from.getTime() - periodLength - 86400000);
    const previousTo = new Date(dateRange.from.getTime() - 86400000);
    
    return { from: previousFrom, to: previousTo };
  }, [dateRange]);

  const { data: previousReceipts } = useQuery({
    queryKey: ['reports-previous', previousPeriodRange?.from?.toISOString(), previousPeriodRange?.to?.toISOString(), user?.id],
    queryFn: async () => {
      if (!user || !previousPeriodRange?.from || !previousPeriodRange?.to) return [];
      
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user.id)
        .gte('receipt_date', format(previousPeriodRange.from, 'yyyy-MM-dd'))
        .lte('receipt_date', format(previousPeriodRange.to, 'yyyy-MM-dd'))
        .eq('status', 'approved');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!previousPeriodRange?.from && !!previousPeriodRange?.to,
  });

  // Calculate KPIs
  const stats = useMemo(() => {
    if (!receipts) return null;

    const totalGross = receipts.reduce((sum, r) => sum + (r.amount_gross || 0), 0);
    const totalNet = receipts.reduce((sum, r) => sum + (r.amount_net || 0), 0);
    const totalVat = receipts.reduce((sum, r) => sum + (r.vat_amount || 0), 0);
    const count = receipts.length;
    const avgAmount = count > 0 ? totalGross / count : 0;

    // Previous period stats for comparison
    const prevTotalGross = previousReceipts?.reduce((sum, r) => sum + (r.amount_gross || 0), 0) || 0;
    const prevCount = previousReceipts?.length || 0;

    // Calculate percentage change
    const grossChange = prevTotalGross > 0 
      ? ((totalGross - prevTotalGross) / prevTotalGross) * 100 
      : null;
    const countChange = prevCount > 0 
      ? ((count - prevCount) / prevCount) * 100 
      : null;

    return {
      totalGross,
      totalNet,
      totalVat,
      count,
      avgAmount,
      grossChange,
      countChange,
    };
  }, [receipts, previousReceipts]);

  // Group data by category
  const categoryData = useMemo(() => {
    if (!receipts) return [];

    // Create a map for category colors
    const categoryColorMap = new Map<string, string>();
    categories?.forEach((cat) => {
      categoryColorMap.set(cat.name, cat.color || '#94A3B8');
    });

    const grouped = receipts.reduce((acc: Record<string, { name: string; color: string; amount: number; count: number; vat: number }>, receipt) => {
      const catName = receipt.category || 'Ohne Kategorie';
      const catColor = categoryColorMap.get(catName) || '#94A3B8';

      if (!acc[catName]) {
        acc[catName] = {
          name: catName,
          color: catColor,
          amount: 0,
          count: 0,
          vat: 0,
        };
      }

      acc[catName].amount += receipt.amount_gross || 0;
      acc[catName].count += 1;
      acc[catName].vat += receipt.vat_amount || 0;

      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => b.amount - a.amount);
  }, [receipts, categories]);

  // Prepare data for Pie Chart
  const pieChartData = useMemo(() => {
    return categoryData.map((cat) => ({
      name: cat.name,
      value: cat.amount,
      color: cat.color,
    }));
  }, [categoryData]);

  // Time series data - grouped by month
  const timeSeriesData = useMemo(() => {
    if (!receipts) return [];

    const grouped = receipts.reduce((acc: Record<string, { key: string; label: string; date: Date; amount: number; count: number; vat: number }>, receipt) => {
      if (!receipt.receipt_date) return acc;
      
      const date = new Date(receipt.receipt_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = `${months[date.getMonth()].substring(0, 3)} ${date.getFullYear()}`;

      if (!acc[key]) {
        acc[key] = {
          key,
          label,
          date,
          amount: 0,
          count: 0,
          vat: 0,
        };
      }

      acc[key].amount += receipt.amount_gross || 0;
      acc[key].count += 1;
      acc[key].vat += receipt.vat_amount || 0;

      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [receipts, months]);

  // Monthly comparison data (current year vs previous year)
  const monthlyComparisonData = useMemo(() => {
    if (!receipts) return [];

    const currentYear = parseInt(selectedYear);
    const previousYear = currentYear - 1;

    // Initialize all months
    const monthData: Record<string, { month: string; currentYear: number; previousYear: number }> = {};
    months.forEach((month, index) => {
      monthData[index.toString()] = {
        month: month.substring(0, 3),
        currentYear: 0,
        previousYear: 0,
      };
    });

    // Group current period receipts
    receipts.forEach((receipt) => {
      if (!receipt.receipt_date) return;
      const date = new Date(receipt.receipt_date);
      const year = date.getFullYear();
      const monthIndex = date.getMonth();

      if (year === currentYear) {
        monthData[monthIndex.toString()].currentYear += receipt.amount_gross || 0;
      }
    });

    // We need previous year data - this is already in the current query if year view
    // For simplicity, we'll show available data
    previousReceipts?.forEach((receipt) => {
      if (!receipt.receipt_date) return;
      const date = new Date(receipt.receipt_date);
      const monthIndex = date.getMonth();
      monthData[monthIndex.toString()].previousYear += receipt.amount_gross || 0;
    });

    return Object.values(monthData);
  }, [receipts, previousReceipts, selectedYear, months]);

  // Trend indicators
  const trendIndicators = useMemo(() => {
    if (!timeSeriesData || timeSeriesData.length === 0) {
      return { highest: null, lowest: null, average: 0 };
    }

    const sorted = [...timeSeriesData].sort((a, b) => b.amount - a.amount);
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];
    const average = timeSeriesData.reduce((sum, m) => sum + m.amount, 0) / timeSeriesData.length;

    return { highest, lowest, average };
  }, [timeSeriesData]);

  // Quick period selection
  const setQuickPeriod = (period: 'thisMonth' | 'lastMonth' | 'thisYear') => {
    const now = new Date();
    
    switch (period) {
      case 'thisMonth':
        setPeriodType('month');
        setSelectedMonth(now.getMonth().toString());
        setSelectedYear(now.getFullYear().toString());
        break;
      case 'lastMonth':
        setPeriodType('month');
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        setSelectedMonth(lastMonth.toString());
        setSelectedYear(lastMonthYear.toString());
        break;
      case 'thisYear':
        setPeriodType('year');
        setSelectedYear(now.getFullYear().toString());
        break;
    }
  };

  // Export handlers
  const exportReport = (formatType: 'pdf' | 'excel' | 'csv') => {
    toast({
      title: 'Export gestartet',
      description: `Der Bericht wird als ${formatType.toUpperCase()} exportiert...`,
    });
    // TODO: Implement actual export logic
  };

  // Format date range for display
  const formattedDateRange = useMemo(() => {
    if (!dateRange.from) return 'Zeitraum wählen';
    if (!dateRange.to) return format(dateRange.from, 'dd.MM.yyyy', { locale: de });
    return `${format(dateRange.from, 'dd.MM.yyyy', { locale: de })} – ${format(dateRange.to, 'dd.MM.yyyy', { locale: de })}`;
  }, [dateRange]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Render change indicator
  const renderChange = (change: number | null, inverted = false) => {
    if (change === null) return null;
    
    const isPositive = inverted ? change < 0 : change > 0;
    const isNegative = inverted ? change > 0 : change < 0;
    
    return (
      <div className="flex items-center mt-2 text-sm">
        {isNegative ? (
          <>
            <TrendingDown className="w-4 h-4 text-success mr-1" />
            <span className="text-success">{Math.abs(change).toFixed(1)}%</span>
          </>
        ) : isPositive ? (
          <>
            <TrendingUp className="w-4 h-4 text-destructive mr-1" />
            <span className="text-destructive">+{change.toFixed(1)}%</span>
          </>
        ) : (
          <span className="text-muted-foreground">±0%</span>
        )}
        <span className="text-muted-foreground ml-1">vs. Vorperiode</span>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Berichte & Auswertungen</h1>
            <p className="text-muted-foreground">Analysiere deine Ausgaben im Detail</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Exportieren
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportReport('pdf')}>
                  <FileText className="w-4 h-4 mr-2" />
                  Als PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportReport('excel')}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Als Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportReport('csv')}>
                  <File className="w-4 h-4 mr-2" />
                  Als CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Print Button */}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Drucken
            </Button>
          </div>
        </div>

        {/* Period Selection */}
        <Card className="mb-6 border-border/50">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Period Type */}
              <div className="flex items-center gap-2">
                <Label className="text-muted-foreground">Zeitraum:</Label>
                <Select value={periodType} onValueChange={(v) => setPeriodType(v as typeof periodType)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monat</SelectItem>
                    <SelectItem value="quarter">Quartal</SelectItem>
                    <SelectItem value="year">Jahr</SelectItem>
                    <SelectItem value="custom">Benutzerdefiniert</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Month Selection */}
              {periodType === 'month' && (
                <div className="flex items-center gap-2">
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month, i) => (
                        <SelectItem key={i} value={i.toString()}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Quarter Selection */}
              {periodType === 'quarter' && (
                <div className="flex items-center gap-2">
                  <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Q1</SelectItem>
                      <SelectItem value="2">Q2</SelectItem>
                      <SelectItem value="3">Q3</SelectItem>
                      <SelectItem value="4">Q4</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Year Selection */}
              {periodType === 'year' && (
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Custom Date Range */}
              {periodType === 'custom' && (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[140px] justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "dd.MM.yyyy") : "Von"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground">–</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[140px] justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "dd.MM.yyyy") : "Bis"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Quick-Select Buttons */}
              <div className="flex items-center gap-1 ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuickPeriod('thisMonth')}
                >
                  Dieser Monat
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuickPeriod('lastMonth')}
                >
                  Letzter Monat
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuickPeriod('thisYear')}
                >
                  Dieses Jahr
                </Button>
              </div>
            </div>

            {/* Selected Period Display */}
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Ausgewählter Zeitraum: <span className="font-medium text-foreground">{formattedDateRange}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {/* Gesamtausgaben */}
          <Card className="border-border/50">
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Gesamtausgaben</p>
                      <p className="text-2xl font-bold text-foreground">
                        {formatCurrency(stats?.totalGross || 0)}
                      </p>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Euro className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  {renderChange(stats?.grossChange ?? null, true)}
                </>
              )}
            </CardContent>
          </Card>

          {/* Nettobetrag */}
          <Card className="border-border/50">
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Nettobetrag</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(stats?.totalNet || 0)}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-full">
                    <Receipt className="w-5 h-5 text-blue-500" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vorsteuer */}
          <Card className="border-border/50">
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Vorsteuer</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(stats?.totalVat || 0)}
                    </p>
                  </div>
                  <div className="p-3 bg-success/10 rounded-full">
                    <Percent className="w-5 h-5 text-success" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Anzahl Belege */}
          <Card className="border-border/50">
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Belege</p>
                      <p className="text-2xl font-bold text-foreground">
                        {stats?.count || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-warning/10 rounded-full">
                      <FileText className="w-5 h-5 text-warning" />
                    </div>
                  </div>
                  {renderChange(stats?.countChange ?? null, false)}
                </>
              )}
            </CardContent>
          </Card>

          {/* Durchschnitt */}
          <Card className="border-border/50">
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Ø pro Beleg</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(stats?.avgAmount || 0)}
                    </p>
                  </div>
                  <div className="p-3 bg-pink-500/10 rounded-full">
                    <Calculator className="w-5 h-5 text-pink-500" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Category Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Pie Chart - Expenses by Category */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Ausgaben nach Kategorie</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Skeleton className="h-[200px] w-[200px] rounded-full" />
                </div>
              ) : pieChartData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Keine Daten für den gewählten Zeitraum
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) =>
                          `${name} (${(percent * 100).toFixed(0)}%)`
                        }
                        labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bar Chart - Top Categories */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Top Kategorien</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex flex-col justify-center gap-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : categoryData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Keine Daten für den gewählten Zeitraum
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData.slice(0, 5)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `€${v}`}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: 'hsl(var(--foreground))' }}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                        {categoryData.slice(0, 5).map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Category Detail Table */}
        <Card className="border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Detailübersicht nach Kategorie</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : categoryData.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Keine Daten für den gewählten Zeitraum
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kategorie</TableHead>
                    <TableHead className="text-right">Anzahl</TableHead>
                    <TableHead className="text-right">Brutto</TableHead>
                    <TableHead className="text-right">Netto</TableHead>
                    <TableHead className="text-right">Vorsteuer</TableHead>
                    <TableHead className="text-right">Anteil</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryData.map((cat) => (
                    <TableRow key={cat.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{cat.count}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(cat.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(cat.amount - cat.vat)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(cat.vat)}
                      </TableCell>
                      <TableCell className="text-right">
                        {stats?.totalGross
                          ? ((cat.amount / stats.totalGross) * 100).toFixed(1)
                          : 0}
                        %
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-medium">Gesamt</TableCell>
                    <TableCell className="text-right font-medium">
                      {stats?.count || 0}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(stats?.totalGross || 0)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(stats?.totalNet || 0)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(stats?.totalVat || 0)}
                    </TableCell>
                    <TableCell className="text-right font-medium">100%</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Time Series Section */}
        <Card className="border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Ausgaben im Zeitverlauf</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[350px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : timeSeriesData.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                Keine Daten für den gewählten Zeitraum
              </div>
            ) : (
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      tickFormatter={(v) => `€${v}`}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'amount') return [formatCurrency(value), 'Brutto'];
                        if (name === 'vat') return [formatCurrency(value), 'Vorsteuer'];
                        return [value, name];
                      }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      name="Brutto"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="vat"
                      name="Vorsteuer"
                      stroke="hsl(var(--success))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--success))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Comparison Chart */}
        {periodType === 'year' && (
          <Card className="border-border/50 mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Monatsvergleich</CardTitle>
              <CardDescription>Aktuelles Jahr vs. Vorjahr</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="month"
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: 'hsl(var(--foreground))' }}
                      />
                      <YAxis
                        tickFormatter={(v) => `€${v}`}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="currentYear"
                        name={selectedYear}
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="previousYear"
                        name={String(parseInt(selectedYear) - 1)}
                        fill="hsl(var(--muted))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Trend Indicators */}
        {timeSeriesData.length > 1 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Highest Month */}
            <Card className="border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-destructive/10 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Höchste Ausgaben</p>
                    <p className="font-semibold text-foreground">
                      {trendIndicators.highest?.label}
                    </p>
                    <p className="text-lg font-bold text-destructive">
                      {formatCurrency(trendIndicators.highest?.amount || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lowest Month */}
            <Card className="border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <TrendingDown className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Niedrigste Ausgaben</p>
                    <p className="font-semibold text-foreground">
                      {trendIndicators.lowest?.label}
                    </p>
                    <p className="text-lg font-bold text-success">
                      {formatCurrency(trendIndicators.lowest?.amount || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Average */}
            <Card className="border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Activity className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Monatsdurchschnitt</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(trendIndicators.average)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reports;
