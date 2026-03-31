import { useState } from 'react';
import { RefreshCw, Loader2, AlertTriangle, Check, X, Pause, StickyNote, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useRecurringExpenses, type RecurringExpense } from '@/hooks/useRecurringExpenses';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Monatlich',
  quarterly: 'Quartalsweise',
  semi_annual: 'Halbjährlich',
  annual: 'Jährlich',
};

const FREQ_COLORS: Record<string, string> = {
  monthly: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  quarterly: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  semi_annual: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  annual: 'bg-green-500/10 text-green-600 border-green-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  detected: 'Erkannt',
  confirmed: 'Bestätigt',
  paused: 'Pausiert',
  cancelled: 'Abgebrochen',
};

const STATUS_COLORS: Record<string, string> = {
  detected: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  confirmed: 'bg-green-500/10 text-green-600 border-green-500/20',
  paused: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export function RecurringExpensesTab() {
  const {
    expenses,
    loading,
    detecting,
    monthlyFixedCosts,
    alerts,
    runDetection,
    updateStatus,
    updateNotes,
    updateCategory,
  } = useRecurringExpenses();
  const { userCategories } = useCategories();

  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<RecurringExpense | null>(null);
  const [noteText, setNoteText] = useState('');

  const openNoteDialog = (expense: RecurringExpense) => {
    setNoteTarget(expense);
    setNoteText(expense.notes || '');
    setNoteDialogOpen(true);
  };

  const saveNote = async () => {
    if (noteTarget) {
      await updateNotes(noteTarget.id, noteText);
      setNoteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with action */}
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={runDetection} disabled={detecting} size="sm">
          {detecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Analyse starten
        </Button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(alert => (
            <Alert key={alert.id} variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Monthly fixed costs card */}
      <Card>
        <CardContent className="py-4 px-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Monatliche Fixkosten</p>
              <p className="text-2xl font-bold">
                €{monthlyFixedCosts.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {expenses.filter(e => e.status === 'confirmed').length} bestätigt
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {expenses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Keine wiederkehrenden Ausgaben erkannt.</p>
            <p className="text-sm mt-1">Klicke auf "Analyse starten" um deine Belege zu analysieren.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {expenses.map(expense => (
            <Card key={expense.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{expense.vendor_name}</span>
                      <Badge variant="outline" className={cn('text-xs', FREQ_COLORS[expense.frequency])}>
                        {FREQ_LABELS[expense.frequency]}
                      </Badge>
                      <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[expense.status])}>
                        {STATUS_LABELS[expense.status]}
                      </Badge>
                      {expense.confidence >= 0.8 ? (
                        <span className="text-xs text-green-600">● Hohe Konfidenz</span>
                      ) : (
                        <span className="text-xs text-yellow-600">● Mittlere Konfidenz</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      {expense.category && (
                        <span>{expense.category.name}</span>
                      )}
                      {expense.matched_description && (
                        <span className="truncate max-w-[300px]" title={expense.matched_description}>
                          „{expense.matched_description}"
                        </span>
                      )}
                      {expense.next_expected_date && (
                        <span>
                          Nächste: {new Date(expense.next_expected_date).toLocaleDateString('de-AT')}
                        </span>
                      )}
                      {expense.notes && (
                        <span className="flex items-center gap-1">
                          <StickyNote className="h-3 w-3" />
                          {expense.notes.substring(0, 40)}{expense.notes.length > 40 ? '…' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold whitespace-nowrap">
                      €{expense.average_amount.toLocaleString('de-AT', { minimumFractionDigits: 2 })}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {expense.status !== 'confirmed' && (
                          <DropdownMenuItem onClick={() => updateStatus(expense.id, 'confirmed', true)}>
                            <Check className="h-4 w-4 mr-2" /> Bestätigen
                          </DropdownMenuItem>
                        )}
                        {expense.status !== 'paused' && (
                          <DropdownMenuItem onClick={() => updateStatus(expense.id, 'paused')}>
                            <Pause className="h-4 w-4 mr-2" /> Pausieren
                          </DropdownMenuItem>
                        )}
                        {expense.status === 'paused' && (
                          <DropdownMenuItem onClick={() => updateStatus(expense.id, 'detected')}>
                            <RefreshCw className="h-4 w-4 mr-2" /> Fortsetzen
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => openNoteDialog(expense)}>
                          <StickyNote className="h-4 w-4 mr-2" /> Notiz
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(expense.id, 'dismissed')}>
                          <X className="h-4 w-4 mr-2" /> Ablehnen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Select
                      value={expense.category_id || 'none'}
                      onValueChange={(v) => updateCategory(expense.id, v === 'none' ? null : v)}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue placeholder="Kategorie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Keine</SelectItem>
                        {userCategories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Note dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notiz zu {noteTarget?.vendor_name}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Notiz eingeben..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={saveNote}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
