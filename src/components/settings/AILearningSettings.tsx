import { useState, useEffect } from 'react';
import {
  Brain,
  FileText,
  Pencil,
  Sparkles,
  ArrowRight,
  Eye,
  RotateCcw,
  Circle,
  Loader2 as LoaderIcon,
  CheckCircle,
  Award,
  Search,
  Tag,
  Trash2,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategories } from '@/hooks/useCategories';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LEARNABLE_FIELDS, LEARNING_LEVELS, type LearningLevel } from '@/types/learning';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface VendorLearningData {
  id: string;
  vendor_id: string;
  learning_level: number;
  total_corrections: number;
  successful_predictions: number;
  confidence_boost: number;
  field_patterns: Record<string, {
    prefixes?: string[];
    suffixes?: string[];
    common_mistakes?: Array<{ detected: string; correct: string; count: number }>;
    typical_range?: { min: number; max: number };
    confidence?: number;
  }> | null;
  layout_hints: Record<string, {
    position?: string;
    near_text?: string;
    format?: string;
    notes?: string;
  }> | null;
  updated_at: string | null;
  vendor: {
    display_name: string;
    receipt_count: number | null;
  } | null;
}

interface CategoryRule {
  id: string;
  keyword: string;
  category_name: string;
  match_count: number | null;
  tax_type_name: string | null;
  tax_type_match_count: number | null;
  updated_at: string | null;
}

interface VendorDefaultCategory {
  vendor_id: string;
  vendor_name: string;
  default_category_id: string;
  category_name: string;
}

interface Stats {
  totalVendors: number;
  trainedVendors: number;
  totalCorrections: number;
  fieldStats: Record<string, number>;
  categoryRulesCount: number;
}

function LearningLevelBadge({ level }: { level: number }) {
  const safeLevel = (level >= 0 && level <= 3 ? level : 0) as LearningLevel;
  const config = LEARNING_LEVELS[safeLevel];

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Circle,
    Loader2: LoaderIcon,
    CheckCircle,
    Award,
  };

  const Icon = iconMap[config.icon] || Circle;

  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
  };

  return (
    <Badge variant="outline" className={cn(colorClasses[config.color] || colorClasses.gray)}>
      <Icon className={cn("w-3 h-3 mr-1", config.color === 'yellow' && 'animate-spin')} />
      {config.name}
    </Badge>
  );
}

export function AILearningSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { userCategories } = useCategories();
  const [isLoading, setIsLoading] = useState(true);
  const [learningData, setLearningData] = useState<VendorLearningData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLearning, setSelectedLearning] = useState<VendorLearningData | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetTarget, setResetTarget] = useState<VendorLearningData | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);
  const [vendorDefaults, setVendorDefaults] = useState<VendorDefaultCategory[]>([]);
  const [categoryRuleSearch, setCategoryRuleSearch] = useState('');
  const [isDeletingRule, setIsDeletingRule] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadLearningData();
    }
  }, [user]);

  const loadLearningData = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      // Load learning data with vendor info
      const { data: learning, error: learningError } = await supabase
        .from('vendor_learning')
        .select(`
          *,
          vendor:vendors(display_name, receipt_count)
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (learningError) throw learningError;

      // Load corrections for stats
      const { data: corrections, error: correctionsError } = await supabase
        .from('field_corrections')
        .select('field_name')
        .eq('user_id', user.id);

      if (correctionsError) throw correctionsError;

      // Load category rules
      const { data: rules, error: rulesError } = await supabase
        .from('category_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('match_count', { ascending: false });

      if (rulesError) throw rulesError;
      setCategoryRules(rules || []);

      // Load vendors with default categories
      const { data: vendorsWithDefaults, error: vendorDefaultsError } = await supabase
        .from('vendors')
        .select('id, display_name, default_category_id')
        .eq('user_id', user.id)
        .not('default_category_id', 'is', null);

      if (vendorDefaultsError) throw vendorDefaultsError;

      // Load category names for vendor defaults
      if (vendorsWithDefaults && vendorsWithDefaults.length > 0) {
        const categoryIds = [...new Set(vendorsWithDefaults.map(v => v.default_category_id).filter(Boolean))];
        const { data: catData } = await supabase
          .from('categories')
          .select('id, name')
          .in('id', categoryIds as string[]);

        const categoryMap = new Map((catData || []).map(c => [c.id, c.name]));
        setVendorDefaults(vendorsWithDefaults.map(v => ({
          vendor_id: v.id,
          vendor_name: v.display_name,
          default_category_id: v.default_category_id!,
          category_name: categoryMap.get(v.default_category_id!) || 'Unbekannt',
        })));
      } else {
        setVendorDefaults([]);
      }

      // Calculate field stats
      const fieldStats: Record<string, number> = {};
      corrections?.forEach((c) => {
        fieldStats[c.field_name] = (fieldStats[c.field_name] || 0) + 1;
      });

      // Cast the learning data properly
      const typedLearning = (learning || []).map((l) => ({
        ...l,
        field_patterns: l.field_patterns as VendorLearningData['field_patterns'],
        layout_hints: l.layout_hints as VendorLearningData['layout_hints'],
        vendor: l.vendor as VendorLearningData['vendor'],
      }));

      setLearningData(typedLearning);
      setStats({
        totalVendors: typedLearning.length,
        trainedVendors: typedLearning.filter((l) => (l.learning_level ?? 0) >= 2).length,
        totalCorrections: corrections?.length || 0,
        fieldStats,
        categoryRulesCount: rules?.length || 0,
      });
    } catch (error) {
      console.error('Error loading learning data:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler beim Laden',
        description: 'Lern-Daten konnten nicht geladen werden.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetLearning = async () => {
    if (!resetTarget || !user) return;

    setIsResetting(true);

    try {
      // Delete corrections for this learning record
      const { error: deleteError } = await supabase
        .from('field_corrections')
        .delete()
        .eq('vendor_learning_id', resetTarget.id);

      if (deleteError) throw deleteError;

      // Reset learning data
      const { error: updateError } = await supabase
        .from('vendor_learning')
        .update({
          field_patterns: {},
          layout_hints: {},
          learning_level: 0,
          total_corrections: 0,
          successful_predictions: 0,
          confidence_boost: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resetTarget.id);

      if (updateError) throw updateError;

      toast({
        title: 'Lern-Daten zurückgesetzt',
        description: `Training für "${resetTarget.vendor?.display_name}" wurde zurückgesetzt.`,
      });

      // Reload data
      await loadLearningData();
    } catch (error) {
      console.error('Error resetting learning:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Lern-Daten konnten nicht zurückgesetzt werden.',
      });
    } finally {
      setIsResetting(false);
      setShowResetDialog(false);
      setResetTarget(null);
    }
  };

  const handleDeleteCategoryRule = async (ruleId: string) => {
    setIsDeletingRule(ruleId);
    try {
      const { error } = await supabase
        .from('category_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      setCategoryRules(prev => prev.filter(r => r.id !== ruleId));
      toast({
        title: 'Regel gelöscht',
        description: 'Die Kategorie-Regel wurde entfernt.',
      });
    } catch (error) {
      console.error('Error deleting category rule:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Regel konnte nicht gelöscht werden.',
      });
    } finally {
      setIsDeletingRule(null);
    }
  };

  const handleUpdateVendorCategory = async (vendorId: string, categoryId: string | null) => {
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ default_category_id: categoryId })
        .eq('id', vendorId);

      if (error) throw error;

      toast({
        title: 'Standard-Kategorie aktualisiert',
        description: categoryId ? 'Die Standard-Kategorie wurde geändert.' : 'Die Standard-Kategorie wurde entfernt.',
      });

      await loadLearningData();
    } catch (error) {
      console.error('Error updating vendor category:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Standard-Kategorie konnte nicht aktualisiert werden.',
      });
    }
  };

  const filteredCategoryRules = categoryRules.filter(
    (r) =>
      !categoryRuleSearch ||
      r.keyword.toLowerCase().includes(categoryRuleSearch.toLowerCase()) ||
      r.category_name.toLowerCase().includes(categoryRuleSearch.toLowerCase())
  );

  const filteredData = learningData.filter(
    (l) =>
      !searchQuery ||
      l.vendor?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const progressPercentage =
    stats && stats.totalVendors > 0
      ? Math.round((stats.trainedVendors / stats.totalVendors) * 100)
      : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{stats?.totalVendors || 0}</p>
              <p className="text-sm text-muted-foreground">Lieferanten mit Lern-Daten</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{stats?.trainedVendors || 0}</p>
              <p className="text-sm text-muted-foreground">Gut trainiert</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{stats?.totalCorrections || 0}</p>
              <p className="text-sm text-muted-foreground">Korrekturen gesamt</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">{stats?.categoryRulesCount || 0}</p>
              <p className="text-sm text-muted-foreground">Kategorie-Regeln</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">{progressPercentage}%</p>
              <p className="text-sm text-muted-foreground">Trainings-Fortschritt</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">So funktioniert das automatische Lernen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {[
              { icon: FileText, label: 'KI erkennt Beleg', bgColor: 'bg-primary/10', textColor: 'text-primary' },
              { icon: Pencil, label: 'Du korrigierst', bgColor: 'bg-orange-100', textColor: 'text-orange-600' },
              { icon: Brain, label: 'KI lernt Muster', bgColor: 'bg-blue-100', textColor: 'text-blue-600' },
              { icon: Sparkles, label: 'Bessere Erkennung', bgColor: 'bg-green-100', textColor: 'text-green-600' },
            ].map((step, i) => (
              <div key={i} className="flex items-center">
                <div className="text-center">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2',
                      step.bgColor
                    )}
                  >
                    <step.icon className={cn('w-6 h-6', step.textColor)} />
                  </div>
                  <p className="text-sm font-medium">{step.label}</p>
                </div>
                {i < 3 && <ArrowRight className="w-6 h-6 text-muted-foreground/30 mx-2 md:mx-4" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Frequently corrected fields */}
      {stats?.fieldStats && Object.keys(stats.fieldStats).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Häufig korrigierte Felder</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.fieldStats)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([fieldName, count]) => {
                  const field = LEARNABLE_FIELDS.find((f) => f.id === fieldName);
                  const percentage = (count / stats.totalCorrections) * 100;

                  return (
                    <div key={fieldName} className="flex items-center gap-3">
                      <span className="w-32 text-sm truncate">{field?.label || fieldName}</span>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">{count}x</span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vendor Learning Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Lern-Status pro Lieferant</CardTitle>
            <div className="relative w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Lieferant suchen..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {learningData.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Noch keine Lern-Daten vorhanden</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Korrigiere Belege und die KI lernt automatisch
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lieferant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Korrekturen</TableHead>
                    <TableHead>Gelernte Felder</TableHead>
                    <TableHead className="text-center">Konfidenz-Boost</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((learning) => (
                    <TableRow key={learning.id}>
                      <TableCell className="font-medium">
                        {learning.vendor?.display_name || 'Unbekannt'}
                      </TableCell>
                      <TableCell>
                        <LearningLevelBadge level={learning.learning_level ?? 0} />
                      </TableCell>
                      <TableCell className="text-center">{learning.total_corrections ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(learning.field_patterns || {})
                            .slice(0, 3)
                            .map((fieldId) => (
                              <Badge key={fieldId} variant="outline" className="text-xs">
                                {LEARNABLE_FIELDS.find((f) => f.id === fieldId)?.label || fieldId}
                              </Badge>
                            ))}
                          {Object.keys(learning.field_patterns || {}).length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{Object.keys(learning.field_patterns || {}).length - 3}
                            </Badge>
                          )}
                          {Object.keys(learning.field_patterns || {}).length === 0 && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600 font-medium">
                          +{learning.confidence_boost ?? 0}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedLearning(learning);
                                  setShowDetailsDialog(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Details anzeigen</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setResetTarget(learning);
                                  setShowResetDialog(true);
                                }}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Zurücksetzen</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gelernte Kategorie-Regeln */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="w-5 h-5 text-purple-600" />
              Gelernte Kategorie-Regeln
            </CardTitle>
            {categoryRules.length > 0 && (
              <div className="relative w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Regel suchen..."
                  className="pl-8"
                  value={categoryRuleSearch}
                  onChange={(e) => setCategoryRuleSearch(e.target.value)}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {categoryRules.length === 0 ? (
            <div className="text-center py-8">
              <Tag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Noch keine Kategorie-Regeln</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Ändere eine Kategorie bei einem Beleg und das System merkt sich das automatisch.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead className="text-center">Kat.-Treffer</TableHead>
                    <TableHead>Buchungsart</TableHead>
                    <TableHead className="text-center">BA-Treffer</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategoryRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <code className="bg-muted px-2 py-0.5 rounded text-sm">{rule.keyword}</code>
                      </TableCell>
                      <TableCell>
                        {rule.category_name ? <Badge variant="outline">{rule.category_name}</Badge> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-muted-foreground">{rule.match_count || 0}x</span>
                      </TableCell>
                      <TableCell>
                        {rule.tax_type_name ? <Badge variant="outline">{rule.tax_type_name}</Badge> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-muted-foreground">{rule.tax_type_match_count || 0}x</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={isDeletingRule === rule.id}
                              onClick={() => handleDeleteCategoryRule(rule.id)}
                            >
                              {isDeletingRule === rule.id ? (
                                <LoaderIcon className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Regel löschen</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lieferanten-Standard-Kategorien */}
      {vendorDefaults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-600" />
              Lieferanten-Standard-Kategorien
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lieferant</TableHead>
                    <TableHead>Standard-Kategorie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendorDefaults.map((vd) => (
                    <TableRow key={vd.vendor_id}>
                      <TableCell className="font-medium">{vd.vendor_name}</TableCell>
                      <TableCell>
                        <Select
                          value={vd.default_category_id}
                          onValueChange={(value) =>
                            handleUpdateVendorCategory(vd.vendor_id, value === '__none__' ? null : value)
                          }
                        >
                          <SelectTrigger className="w-[220px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Keine Standard-Kategorie</SelectItem>
                            {userCategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Lern-Details: {selectedLearning?.vendor?.display_name}
            </DialogTitle>
            <DialogDescription>
              Übersicht der gelernten Muster und Korrekturen
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* Status Overview */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <LearningLevelBadge level={selectedLearning?.learning_level ?? 0} />
                  <p className="text-xs text-muted-foreground mt-1">Status</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xl font-bold">{selectedLearning?.total_corrections ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Korrekturen</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xl font-bold text-green-600">
                    +{selectedLearning?.confidence_boost ?? 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Boost</p>
                </div>
              </div>

              {/* Learned Patterns */}
              <div>
                <h4 className="font-medium mb-3">Gelernte Muster</h4>
                {selectedLearning?.field_patterns &&
                Object.keys(selectedLearning.field_patterns).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(selectedLearning.field_patterns).map(([fieldId, pattern]) => {
                      const field = LEARNABLE_FIELDS.find((f) => f.id === fieldId);
                      return (
                        <div key={fieldId} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{field?.label || fieldId}</span>
                            {pattern.confidence && (
                              <Badge variant="outline" className="text-xs">
                                {pattern.confidence}% Konfidenz
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {pattern.prefixes && pattern.prefixes.length > 0 && (
                              <p>
                                Präfixe:{' '}
                                {pattern.prefixes.map((p) => (
                                  <code key={p} className="bg-muted px-1 rounded mr-1">
                                    {p}
                                  </code>
                                ))}
                              </p>
                            )}
                            {pattern.suffixes && pattern.suffixes.length > 0 && (
                              <p>
                                Suffixe:{' '}
                                {pattern.suffixes.map((s) => (
                                  <code key={s} className="bg-muted px-1 rounded mr-1">
                                    {s}
                                  </code>
                                ))}
                              </p>
                            )}
                            {pattern.typical_range && (
                              <p>
                                Typischer Bereich: €{pattern.typical_range.min.toFixed(2)} -{' '}
                                €{pattern.typical_range.max.toFixed(2)}
                              </p>
                            )}
                            {pattern.common_mistakes && pattern.common_mistakes.length > 0 && (
                              <div>
                                <p className="mb-1">Häufige Korrekturen:</p>
                                <ul className="ml-4 space-y-0.5">
                                  {pattern.common_mistakes.slice(0, 3).map((m, i) => (
                                    <li key={i} className="text-xs">
                                      <code className="bg-red-100 px-1 rounded line-through">
                                        {m.detected || '(leer)'}
                                      </code>
                                      {' → '}
                                      <code className="bg-green-100 px-1 rounded">{m.correct}</code>
                                      <span className="text-muted-foreground ml-1">({m.count}x)</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Noch keine Muster gelernt</p>
                )}
              </div>

              {/* Layout Hints */}
              {selectedLearning?.layout_hints &&
                Object.keys(selectedLearning.layout_hints).length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Manuelle Hinweise</h4>
                    <div className="space-y-2">
                      {Object.entries(selectedLearning.layout_hints).map(([fieldId, hint]) => {
                        const field = LEARNABLE_FIELDS.find((f) => f.id === fieldId);
                        return (
                          <div key={fieldId} className="border rounded-lg p-3 text-sm">
                            <span className="font-medium">{field?.label || fieldId}:</span>
                            <ul className="mt-1 text-muted-foreground space-y-0.5">
                              {hint.position && <li>Position: {hint.position}</li>}
                              {hint.near_text && <li>Beschriftung: "{hint.near_text}"</li>}
                              {hint.format && <li>Format: {hint.format}</li>}
                              {hint.notes && <li>Notizen: {hint.notes}</li>}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Last Updated */}
              {selectedLearning?.updated_at && (
                <p className="text-xs text-muted-foreground">
                  Zuletzt aktualisiert:{' '}
                  {format(new Date(selectedLearning.updated_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                </p>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="w-5 h-5" />
              Lern-Daten zurücksetzen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Die KI vergisst alle gelernten Muster für "{resetTarget?.vendor?.display_name}".
              Dies kann nicht rückgängig gemacht werden. Zukünftige Belege dieses Lieferanten
              müssen neu trainiert werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetLearning}
              className="bg-destructive hover:bg-destructive/90"
              disabled={isResetting}
            >
              {isResetting ? (
                <>
                  <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                  Setze zurück...
                </>
              ) : (
                'Zurücksetzen'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
