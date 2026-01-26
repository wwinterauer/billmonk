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
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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

        {/* Placeholder for Charts */}
        <Card className="border-border/50">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium mb-2">Diagramme werden hier angezeigt</p>
              <p className="text-sm">Weitere Auswertungen folgen in den nächsten Schritten.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
