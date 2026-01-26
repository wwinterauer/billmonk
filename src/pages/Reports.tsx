import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Download,
  FileText,
  FileSpreadsheet,
  File,
  Printer,
  CalendarIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
import { cn } from '@/lib/utils';

const Reports = () => {
  const { toast } = useToast();
  
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
  const exportReport = (format: 'pdf' | 'excel' | 'csv') => {
    toast({
      title: 'Export gestartet',
      description: `Der Bericht wird als ${format.toUpperCase()} exportiert...`,
    });
    // TODO: Implement actual export logic
  };

  // Format date range for display
  const formattedDateRange = useMemo(() => {
    if (!dateRange.from) return 'Zeitraum wählen';
    if (!dateRange.to) return format(dateRange.from, 'dd.MM.yyyy', { locale: de });
    return `${format(dateRange.from, 'dd.MM.yyyy', { locale: de })} – ${format(dateRange.to, 'dd.MM.yyyy', { locale: de })}`;
  }, [dateRange]);

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

        {/* Placeholder for Reports Content */}
        <Card className="border-border/50">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium mb-2">Berichte werden hier angezeigt</p>
              <p className="text-sm">Wähle einen Zeitraum aus, um die Auswertungen zu sehen.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
