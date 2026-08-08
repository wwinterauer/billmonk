import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload as UploadIcon, 
  Cloud, 
  FileText, 
  FileImage,
  X, 
  Check,
  Loader2,
  XCircle,
  AlertCircle,
  Sparkles,
  Clock,
  PenLine,
  Copy,
  Zap,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { useReceipts, type UploadProgress, type UploadStatus, type Receipt, type MatchedVendor, type VendorSuggestion } from '@/hooks/useReceipts';
import { VendorSelectionDialog } from '@/components/receipts/VendorSelectionDialog';
import { DuplicateCheckDialog, type FileCheckResult } from '@/components/upload/DuplicateCheckDialog';
import { FileCheckProgress } from '@/components/upload/FileCheckProgress';
import { UploadStatusFilter, type UploadFilterStatus, type UploadStatusCounts } from '@/components/upload/UploadStatusFilter';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageMeta } from '@/components/PageMeta';
import { saveQueue, clearQueue, runWithConcurrency } from '@/lib/upload-queue';
import { UploadRunOverview } from '@/components/upload/UploadRunOverview';

const UPLOAD_CONCURRENCY = 3;

interface FileUpload extends UploadProgress {
  file: File;
  previewUrl?: string;
  fileHash?: string;
  isDuplicate?: boolean;
  duplicateScore?: number;
}

interface UploadRunSummary {
  total: number;
  uploaded: number;
  duplicates: number;
  rejected: number;
  failed: number;
  pending: number;
}

// Represents a receipt loaded from the database (processing/pending/recently completed status)
interface PendingReceiptFromDB {
  id: string;
  fileName: string;
  fileUrl: string | null;
  status: 'pending' | 'processing' | 'review' | 'approved' | 'rejected' | 'not_a_receipt' | 'duplicate';
  aiConfidence: number | null;
  createdAt: string;
  vendor: string | null;
  amountGross: number | null;
  notes: string | null;
  autoApproved: boolean;
}

interface VendorDecisionQueueItem {
  uploadId: string;
  receiptId: string;
  extractedData: Partial<Receipt>;
  detectedName: string;
  suggestions: VendorSuggestion[];
}

// Upload phase state
type UploadPhase = 'idle' | 'checking' | 'resolving-duplicates' | 'uploading';

interface CheckProgress {
  current: number;
  total: number;
}

const Upload = () => {
  const { user } = useAuth();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState<Map<string, FileUpload>>(new Map());
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceiptFromDB[]>([]);
  const [loadingPendingReceipts, setLoadingPendingReceipts] = useState(true);
  const [activeFilter, setActiveFilter] = useState<UploadFilterStatus>('all');
  
  // Phase-based state for batch duplicate checking
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [checkProgress, setCheckProgress] = useState<CheckProgress>({ current: 0, total: 0 });
  const [duplicatesToResolve, setDuplicatesToResolve] = useState<FileCheckResult[]>([]);
  const [nonDuplicateFiles, setNonDuplicateFiles] = useState<{ file: File; hash: string }[]>([]);
  
  // Vendor selection states
  const [showVendorSelectionDialog, setShowVendorSelectionDialog] = useState(false);
  const [vendorDecisionQueue, setVendorDecisionQueue] = useState<VendorDecisionQueueItem[]>([]);
  const [currentVendorDecision, setCurrentVendorDecision] = useState<VendorDecisionQueueItem | null>(null);
  const [applyToAll, setApplyToAll] = useState(false);
  const [isProcessingVendor, setIsProcessingVendor] = useState(false);
  
  const [overviewRunId, setOverviewRunId] = useState<string | null>(null);
  const [runSummary, setRunSummary] = useState<UploadRunSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeRunRef = useRef<string | null>(null);
  const eventIdsRef = useRef(new WeakMap<File, string>());
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    validateFile,
    uploadAndProcessReceipt, 
    generateFileHash,
    finalizeReceiptWithVendor,
    createVendorForReceipt,
    MAX_FILE_SIZE, 
    MAX_FILES 
  } = useReceipts();

  const updateFileEvent = useCallback(async (
    file: File,
    values: {
      phase?: string;
      outcome?: 'pending' | 'uploaded' | 'duplicate' | 'rejected' | 'failed';
      reason_code?: string | null;
      error_message?: string | null;
      receipt_id?: string | null;
      file_hash?: string;
    },
  ) => {
    const eventId = eventIdsRef.current.get(file);
    if (!eventId) return;
    const { error } = await supabase.from('upload_file_events').update(values).eq('id', eventId);
    if (error) console.error('Upload protocol update failed:', error);
    // Keep the sidebar review badge in sync as soon as a file reaches a final state.
    if (values.outcome && values.outcome !== 'pending') {
      window.dispatchEvent(new Event('refresh-review-count'));
    }
  }, []);

  const finishUploadRun = useCallback(async (runId: string) => {
    const { data, error } = await supabase
      .from('upload_file_events')
      .select('outcome')
      .eq('run_id', runId);
    if (error || !data) {
      console.error('Upload protocol summary failed:', error);
      return;
    }
    const summary: UploadRunSummary = {
      total: data.length,
      uploaded: data.filter(item => item.outcome === 'uploaded').length,
      duplicates: data.filter(item => item.outcome === 'duplicate').length,
      rejected: data.filter(item => item.outcome === 'rejected').length,
      failed: data.filter(item => item.outcome === 'failed').length,
      pending: data.filter(item => item.outcome === 'pending').length,
    };
    await supabase.from('upload_runs').update({
      status: summary.pending > 0 ? 'failed' : 'completed',
      uploaded_count: summary.uploaded,
      duplicate_count: summary.duplicates,
      rejected_count: summary.rejected,
      failed_count: summary.failed,
      pending_count: summary.pending,
      completed_at: new Date().toISOString(),
    }).eq('id', runId);
    setRunSummary(summary);
    activeRunRef.current = null;
  }, []);

  // Load pending/processing receipts from database (used on mount and as a
  // refresh callback for realtime + polling while uploads are in flight).
  const loadPendingReceipts = useCallback(async () => {
    if (!user) {
      setLoadingPendingReceipts(false);
      return;
    }

    try {
      // Get the timestamp for 2 hours ago to show recently processed receipts
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('receipts')
        .select('id, file_name, file_url, status, ai_confidence, created_at, vendor, amount_gross, notes, auto_approved')
        .eq('user_id', user.id)
        .or(`status.in.(processing,pending,not_a_receipt,duplicate),and(status.in.(review,rejected,approved),created_at.gte.${twoHoursAgo})`)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        console.error('Error loading pending receipts:', error);
      } else if (data) {
        setPendingReceipts(data.map(r => ({
          id: r.id,
          fileName: r.file_name || 'Unbekannte Datei',
          fileUrl: r.file_url,
          status: r.status as PendingReceiptFromDB['status'],
          aiConfidence: r.ai_confidence,
          createdAt: r.created_at,
          vendor: r.vendor,
          amountGross: r.amount_gross,
          notes: r.notes,
          autoApproved: r.auto_approved ?? false,
        })));
      }
    } catch (err) {
      console.error('Failed to load pending receipts:', err);
    } finally {
      setLoadingPendingReceipts(false);
    }
  }, [user]);

  useEffect(() => {
    loadPendingReceipts();
  }, [loadPendingReceipts]);

  // Load the most recent upload run so the overview (and any interrupted run)
  // is visible again after a reload.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('upload_runs')
        .select('id')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data?.id) setOverviewRunId(data.id);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Warn before leaving the page while an upload is still running.
  useEffect(() => {
    if (uploadPhase === 'idle') return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [uploadPhase]);


  // Realtime subscription: keep the pending-receipts list (and the status
  // counter chips) in sync while uploads are happening in the background,
  // so the user sees Erfolgreich/Wartend/… counts update live without a
  // page reload.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`upload-page-receipts-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'receipts', filter: `user_id=eq.${user.id}` },
        () => { loadPendingReceipts(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadPendingReceipts]);

  // Fallback polling while uploads are in flight — covers the case where
  // realtime briefly drops or the tab was backgrounded.
  useEffect(() => {
    const hasActiveUploads = Array.from(uploads.values()).some(
      u => u.status === 'uploading' || u.status === 'processing'
    );
    if (!hasActiveUploads) return;
    const interval = setInterval(() => { loadPendingReceipts(); }, 3000);
    return () => clearInterval(interval);
  }, [uploads, loadPendingReceipts]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const truncateFileName = (name: string, maxLength = 30) => {
    if (name.length <= maxLength) return name;
    const ext = name.split('.').pop() || '';
    const nameWithoutExt = name.slice(0, name.length - ext.length - 1);
    const truncated = nameWithoutExt.slice(0, maxLength - ext.length - 4) + '...';
    return `${truncated}.${ext}`;
  };

  const isImageFile = (file: File) => {
    return file.type.startsWith('image/');
  };

  const createPreviewUrl = (file: File): string | undefined => {
    if (isImageFile(file)) {
      return URL.createObjectURL(file);
    }
    return undefined;
  };

  // Check all files for duplicates in batch, then show dialog
  const checkFilesForDuplicates = async (files: File[]): Promise<{
    duplicates: FileCheckResult[];
    nonDuplicates: { file: File; hash: string }[];
  }> => {
    if (!user) throw new Error('Nicht angemeldet');
    const results: FileCheckResult[] = [];
    
    // Calculate all hashes in parallel for speed
    const hashPromises = files.map(async (file) => {
      const hash = await generateFileHash(file);
      return { file, hash };
    });
    
    const filesWithHashes = await Promise.all(hashPromises);
    await Promise.all(filesWithHashes.map(({ file, hash }) => updateFileEvent(file, {
      phase: 'hash-calculated',
      file_hash: hash,
    })));
    
    // Get all hashes to check in one query
    // Only consider certain statuses as duplicates - exclude rejected/not_a_receipt
    const hashes = filesWithHashes.map(f => f.hash);
    
    const { data: existingReceipts } = await supabase
      .from('receipts')
      .select('id, file_name, file_url, file_hash, vendor, amount_gross, receipt_date, status')
      .eq('user_id', user.id)
      .in('file_hash', hashes)
      .in('status', ['pending', 'processing', 'review', 'approved', 'duplicate']);
    
    const existingMap = new Map(
      (existingReceipts || []).map(r => [r.file_hash, r])
    );
    
    // Categorize files. Keep only the first occurrence of a hash in this
    // selection; later occurrences are logged as in-batch duplicates.
    const seenHashes = new Map<string, File>();
    for (const { file, hash } of filesWithHashes) {
      const firstFile = seenHashes.get(hash);
      if (firstFile) {
        results.push({ file, hash, isDuplicate: true });
        await updateFileEvent(file, {
          phase: 'duplicate-check',
          outcome: 'duplicate',
          reason_code: 'duplicate_in_selection',
          error_message: `Identisch mit ${firstFile.name}`,
        });
        continue;
      }
      seenHashes.set(hash, file);
      const existing = existingMap.get(hash);
      results.push({
        file,
        hash,
        isDuplicate: !!existing,
        existingReceipt: existing ? {
          id: existing.id,
          file_name: existing.file_name,
          file_url: existing.file_url,
          vendor: existing.vendor,
          amount_gross: existing.amount_gross,
          receipt_date: existing.receipt_date,
        } : undefined,
      });
      await updateFileEvent(file, {
        phase: 'duplicate-check',
        ...(existing ? {} : { reason_code: null, error_message: null }),
      });
    }
    
    return {
      duplicates: results.filter(r => r.isDuplicate && r.existingReceipt),
      nonDuplicates: results.filter(r => !r.isDuplicate).map(r => ({ file: r.file, hash: r.hash })),
    };
  };

  const processFiles = async (files: File[]) => {
    if (!user || files.length === 0) return;
    if (activeRunRef.current) {
      toast({
        variant: 'destructive',
        title: 'Upload läuft bereits',
        description: 'Bitte warte auf die Abschlussübersicht, bevor du weitere Dateien hinzufügst.',
      });
      return;
    }

    setRunSummary(null);
    const runId = crypto.randomUUID();
    activeRunRef.current = runId;
    setOverviewRunId(runId);
    const initialEvents = files.map((file, ordinal) => ({
      id: crypto.randomUUID(),
      run_id: runId,
      user_id: user.id,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      ordinal,
      phase: 'selected',
      outcome: 'pending' as const,
    }));
    const { error: runError } = await supabase.from('upload_runs').insert({
      id: runId,
      user_id: user.id,
      expected_count: files.length,
      pending_count: files.length,
    });
    const { error: eventError } = runError
      ? { error: runError }
      : await supabase.from('upload_file_events').insert(initialEvents);
    if (eventError) {
      activeRunRef.current = null;
      toast({ variant: 'destructive', title: 'Protokollierung fehlgeschlagen', description: eventError.message });
      return;
    }
    files.forEach((file, index) => eventIdsRef.current.set(file, initialEvents[index].id));

    const validFiles: File[] = [];
    const errors: string[] = [];
    for (const file of files.slice(0, MAX_FILES)) {
      const validation = validateFile(file);
      if (validation.valid) {
        validFiles.push(file);
        await updateFileEvent(file, { phase: 'validated' });
      } else {
        const message = validation.error || 'Datei wurde abgelehnt';
        errors.push(`${file.name}: ${message}`);
        await updateFileEvent(file, {
          phase: 'validation', outcome: 'rejected',
          reason_code: file.size > MAX_FILE_SIZE ? 'file_too_large' : 'unsupported_type',
          error_message: message,
        });
      }
    }
    for (const file of files.slice(MAX_FILES)) {
      const message = `Maximal ${MAX_FILES} Dateien pro Lauf erlaubt`;
      errors.push(`${file.name}: ${message}`);
      await updateFileEvent(file, { phase: 'validation', outcome: 'rejected', reason_code: 'batch_limit', error_message: message });
    }

    if (errors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Einige Dateien wurden abgelehnt',
        description: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n...und ${errors.length - 3} weitere` : ''),
      });
    }

    if (validFiles.length === 0) {
      await finishUploadRun(runId);
      return;
    }

    // Check total count including only actively uploading/processing files (not completed ones)
    const activeUploadCount = Array.from(uploads.values()).filter(
      u => u.status === 'pending' || u.status === 'uploading' || u.status === 'processing'
    ).length;

    if (activeUploadCount + validFiles.length > MAX_FILES) {
      toast({
        variant: 'destructive',
        title: 'Zu viele Dateien',
        description: `Maximal ${MAX_FILES} Dateien gleichzeitig erlaubt. Aktuell ${activeUploadCount} in Bearbeitung.`,
      });
      await Promise.all(validFiles.map(file => updateFileEvent(file, {
        phase: 'queue', outcome: 'rejected', reason_code: 'active_upload_limit',
        error_message: 'Maximale Zahl gleichzeitig aktiver Uploads überschritten',
      })));
      await finishUploadRun(runId);
      return;
    }

    // Phase 1: Check all files for duplicates
    setUploadPhase('checking');
    setCheckProgress({ current: 0, total: validFiles.length });

    try {
      // Update progress as we check
      let checked = 0;
      const progressInterval = setInterval(() => {
        checked = Math.min(checked + Math.ceil(validFiles.length / 10), validFiles.length);
        setCheckProgress({ current: checked, total: validFiles.length });
      }, 100);

      const { duplicates, nonDuplicates } = await checkFilesForDuplicates(validFiles);
      
      clearInterval(progressInterval);
      setCheckProgress({ current: validFiles.length, total: validFiles.length });

      // Store non-duplicates for later upload
      setNonDuplicateFiles(nonDuplicates);

      if (duplicates.length > 0) {
        // Phase 2: Show dialog for all duplicates at once
        setDuplicatesToResolve(duplicates);
        setUploadPhase('resolving-duplicates');
      } else {
        // No duplicates - start uploading directly
        setUploadPhase('uploading');
        await startUploading(nonDuplicates, [], runId);
      }
    } catch (error) {
      console.error('Error checking files:', error);
      setUploadPhase('idle');
      toast({
        variant: 'destructive',
        title: 'Fehler beim Prüfen',
        description: 'Die Dateien konnten nicht auf Duplikate geprüft werden.',
      });
      await Promise.all(validFiles.map(file => updateFileEvent(file, {
        phase: 'duplicate-check', outcome: 'failed', reason_code: 'duplicate_check_failed',
        error_message: error instanceof Error ? error.message : 'Unbekannter Fehler',
      })));
      await finishUploadRun(runId);
    }
  };

  // Handle decisions from duplicate dialog
  const handleDuplicateDecisions = async (decisions: Map<File, 'skip' | 'upload'>) => {
    setUploadPhase('uploading');
    
    // Collect files to upload based on decisions
    const duplicatesToUpload: { file: File; hash: string; duplicateOfId: string }[] = [];
    
    for (const [file, decision] of decisions) {
      if (decision === 'upload') {
        const duplicateInfo = duplicatesToResolve.find(d => d.file === file);
        const duplicateOfId = duplicateInfo?.existingReceipt?.id;
        if (duplicateInfo && duplicateOfId) {
          duplicatesToUpload.push({
            file,
            hash: duplicateInfo.hash,
            duplicateOfId,
          });
        }
      }
      if (decision === 'skip') {
        await updateFileEvent(file, {
          phase: 'duplicate-decision', outcome: 'duplicate', reason_code: 'existing_duplicate_skipped',
        });
      }
    }
    
    // Clear duplicate state
    setDuplicatesToResolve([]);
    
    // Start uploading all files
    const runId = activeRunRef.current;
    if (runId) await startUploading(nonDuplicateFiles, duplicatesToUpload, runId);
  };

  // Handle cancel from duplicate dialog
  const handleDuplicateCancel = () => {
    const runId = activeRunRef.current;
    void Promise.all([...nonDuplicateFiles.map(item => item.file), ...duplicatesToResolve.map(item => item.file)].map(file =>
      updateFileEvent(file, { phase: 'cancelled', outcome: 'failed', reason_code: 'user_cancelled' })
    )).then(() => runId && finishUploadRun(runId));
    setUploadPhase('idle');
    setDuplicatesToResolve([]);
    setNonDuplicateFiles([]);
    
    toast({
      title: 'Upload abgebrochen',
      description: 'Der Vorgang wurde abgebrochen.',
    });
  };

  // Start uploading files after duplicate resolution
  const startUploading = async (
    nonDuplicates: { file: File; hash: string }[],
    duplicatesToUpload: { file: File; hash: string; duplicateOfId: string }[],
    runId: string,
  ) => {
    // Add all files to upload queue
    const newUploads = new Map(uploads);
    const filesToUpload: { upload: FileUpload; isDuplicate: boolean; duplicateOfId?: string }[] = [];

    // Add non-duplicates
    for (const { file, hash } of nonDuplicates) {
      const id = crypto.randomUUID();
      const upload: FileUpload = {
        id,
        fileName: file.name,
        fileSize: file.size,
        progress: 0,
        status: 'pending',
        statusText: 'Warten...',
        file,
        previewUrl: createPreviewUrl(file),
        fileHash: hash,
      };
      newUploads.set(id, upload);
      filesToUpload.push({ upload, isDuplicate: false });
    }

    // Add duplicates that user chose to upload
    for (const { file, hash, duplicateOfId } of duplicatesToUpload) {
      const id = crypto.randomUUID();
      const upload: FileUpload = {
        id,
        fileName: file.name,
        fileSize: file.size,
        progress: 0,
        status: 'pending',
        statusText: 'Warten...',
        file,
        previewUrl: createPreviewUrl(file),
        fileHash: hash,
      };
      newUploads.set(id, upload);
      filesToUpload.push({ upload, isDuplicate: true, duplicateOfId });
    }

    setUploads(newUploads);
    setNonDuplicateFiles([]);
    setUploadPhase('idle');

    // Show summary toast
    const skippedCount = duplicatesToResolve.length - duplicatesToUpload.length;
    if (skippedCount > 0 || duplicatesToUpload.length > 0) {
      toast({
        title: 'Duplikat-Prüfung abgeschlossen',
        description: `${nonDuplicates.length + duplicatesToUpload.length} Dateien werden hochgeladen${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ''}.`,
      });
    }

    // Persist a snapshot of the planned queue so that, if the tab is reloaded
    // or crashes mid-upload, we can show the user a recovery hint with the
    // list of filenames that never finished.
    if (user) {
      saveQueue(user.id, {
        startedAt: Date.now(),
        total: filesToUpload.length,
        items: filesToUpload.map(({ upload }) => ({
          fileName: upload.fileName,
          fileSize: upload.fileSize,
          fileHash: upload.fileHash,
          status: 'pending',
        })),
      });
    }

    // Upload with bounded concurrency instead of strictly sequential — keeps
    // the edge function from being hammered while drastically improving
    // throughput on large drops.
    await runWithConcurrency(filesToUpload, UPLOAD_CONCURRENCY, async ({ upload, isDuplicate, duplicateOfId }) => {
      await uploadFile(upload, {
        skipDuplicateCheck: false,
        markAsDuplicate: isDuplicate,
        duplicateOfId,
        fileHash: upload.fileHash,
      });
    });

    // All done — drop the recovery snapshot.
    if (user) clearQueue(user.id);
    await finishUploadRun(runId);
  };

  const uploadFile = async (upload: FileUpload, options?: { skipDuplicateCheck?: boolean; markAsDuplicate?: boolean; duplicateOfId?: string; fileHash?: string }) => {
    await updateFileEvent(upload.file, { phase: 'storage-upload' });
    // Update status to uploading
    setUploads(prev => {
      const updated = new Map(prev);
      const current = updated.get(upload.id);
      if (current) {
        updated.set(upload.id, { 
          ...current, 
          status: 'uploading', 
          progress: 5,
          statusText: 'Wird hochgeladen...',
          fileHash: options?.fileHash || current.fileHash,
        });
      }
      return updated;
    });

    try {
      const fileHash = options?.fileHash || await generateFileHash(upload.file);

      const result = await uploadAndProcessReceipt(upload.file, (progress, statusText) => {
        setUploads(prev => {
          const updated = new Map(prev);
          const current = updated.get(upload.id);
          if (current) {
            const status: UploadStatus = progress < 50 ? 'uploading' : 'processing';
            updated.set(upload.id, { 
              ...current, 
              progress,
              status,
              statusText: statusText || current.statusText
            });
          }
          return updated;
        });
      }, {
        fileHash,
        skipDuplicateCheck: options?.skipDuplicateCheck,
        markAsDuplicate: options?.markAsDuplicate,
        duplicateOfId: options?.duplicateOfId,
      });

      // Check if vendor decision is needed
      if (result.vendorDecision) {
        await updateFileEvent(upload.file, {
          phase: 'vendor-decision', outcome: 'uploaded', receipt_id: result.receipt.id,
        });
        // Add to vendor decision queue
        const queueItem: VendorDecisionQueueItem = {
          uploadId: upload.id,
          receiptId: result.vendorDecision.receiptId,
          extractedData: result.vendorDecision.extractedData,
          detectedName: result.vendorDecision.detectedName,
          suggestions: result.vendorDecision.suggestions
        };

        setVendorDecisionQueue(prev => [...prev, queueItem]);
        
        // Update upload status to waiting for vendor selection
        setUploads(prev => {
          const updated = new Map(prev);
          const current = updated.get(upload.id);
          if (current) {
            updated.set(upload.id, { 
              ...current, 
              status: 'processing',
              progress: 85,
              statusText: 'Lieferant auswählen...',
              receipt: result.receipt,
              aiConfidence: result.aiConfidence,
            });
          }
          return updated;
        });

        // Show vendor selection dialog if not already open
        if (!showVendorSelectionDialog && !currentVendorDecision) {
          showNextVendorDecision();
        }
        
        return;
      }

      // Check if content-based duplicate was detected
      const hasDuplicate = result.duplicateCheck?.isDuplicate;
      const finalStatus: UploadStatus = hasDuplicate 
        ? 'complete' 
        : (result.aiSuccess ? 'complete' : 'complete-manual');
      const finalStatusText = hasDuplicate
        ? `Duplikat (${result.duplicateCheck?.score}%)`
        : (result.aiSuccess 
          ? `KI: ${Math.round((result.aiConfidence || 0) * 100)}%` 
          : 'Manuelle Eingabe');

      setUploads(prev => {
        const updated = new Map(prev);
        const current = updated.get(upload.id);
        if (current) {
          updated.set(upload.id, { 
            ...current, 
            status: finalStatus, 
            progress: 100,
            statusText: finalStatusText,
            receipt: result.receipt,
            aiConfidence: result.aiConfidence,
            isDuplicate: hasDuplicate,
            duplicateScore: result.duplicateCheck?.score,
          });
        }
        return updated;
      });
      const isKnownDuplicate = Boolean(options?.markAsDuplicate || hasDuplicate);
      await updateFileEvent(upload.file, {
        phase: isKnownDuplicate ? 'duplicate-recorded' : 'completed',
        outcome: isKnownDuplicate ? 'duplicate' : 'uploaded',
        reason_code: options?.markAsDuplicate ? 'existing_duplicate_uploaded' : hasDuplicate ? 'content_duplicate' : null,
        receipt_id: result.receipt.id,
      });

      if (hasDuplicate) {
        toast({
          title: 'Moment — den Beleg kennen wir schon.',
          description: `${result.duplicateCheck?.matchReasons.join(', ')} (${result.duplicateCheck?.score}%)`,
          variant: 'default',
        });
      } else if (result.aiSuccess) {
        toast({
          title: 'Beleg analysiert',
          description: `${truncateFileName(upload.fileName, 25)} - bitte überprüfen`,
        });
      } else {
        toast({
          title: 'Beleg hochgeladen',
          description: `${truncateFileName(upload.fileName, 25)} - bitte manuell ausfüllen`,
          variant: 'default',
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      const isDuplicateError = errorMessage.startsWith('DUPLICATE:');
      await updateFileEvent(upload.file, {
        phase: 'failed',
        outcome: isDuplicateError ? 'duplicate' : 'failed',
        reason_code: isDuplicateError ? 'race_duplicate_preinsert' : 'upload_or_processing_failed',
        error_message: errorMessage,
      });
      
      setUploads(prev => {
        const updated = new Map(prev);
        const current = updated.get(upload.id);
        if (current) {
          updated.set(upload.id, { 
            ...current, 
            status: 'error', 
            progress: 0,
            statusText: 'Fehler',
            error: errorMessage 
          });
        }
        return updated;
      });

      toast({
        variant: 'destructive',
        title: 'Upload fehlgeschlagen',
        description: `${truncateFileName(upload.fileName, 25)}: ${errorMessage}`,
      });
    }
  };

  // Vendor selection handlers
  const showNextVendorDecision = () => {
    setVendorDecisionQueue(prev => {
      if (prev.length === 0) {
        setShowVendorSelectionDialog(false);
        setCurrentVendorDecision(null);
        return prev;
      }
      
      const [next, ...rest] = prev;
      setCurrentVendorDecision(next);
      setShowVendorSelectionDialog(true);
      setApplyToAll(false);
      return rest;
    });
  };

  const handleSelectExistingVendor = async (vendor: MatchedVendor) => {
    if (!currentVendorDecision) return;
    
    setIsProcessingVendor(true);
    
    try {
      // Get items with same detected name for "apply to all" feature
      const sameNameItems = applyToAll 
        ? vendorDecisionQueue.filter(q => q.detectedName === currentVendorDecision.detectedName)
        : [];
      
      // Process current item
      await finalizeReceiptWithVendor(
        currentVendorDecision.receiptId,
        currentVendorDecision.extractedData,
        vendor,
        currentVendorDecision.detectedName
      );
      
      // Update upload status
      updateUploadStatus(currentVendorDecision.uploadId);
      
      // Process same-name items if "apply to all"
      if (applyToAll && sameNameItems.length > 0) {
        for (const item of sameNameItems) {
          await finalizeReceiptWithVendor(
            item.receiptId,
            item.extractedData,
            vendor,
            item.detectedName
          );
          updateUploadStatus(item.uploadId);
        }
        
        // Remove processed items from queue
        setVendorDecisionQueue(prev => 
          prev.filter(q => q.detectedName !== currentVendorDecision.detectedName)
        );
        
        toast({
          title: 'Lieferant zugeordnet',
          description: `${sameNameItems.length + 1} Belege "${vendor.display_name}" zugeordnet`,
        });
      } else {
        toast({
          title: 'Lieferant zugeordnet',
          description: `Beleg "${vendor.display_name}" zugeordnet`,
        });
      }
      
      // Show next vendor decision or close dialog
      setTimeout(showNextVendorDecision, 300);
      
    } catch (error) {
      console.error('Error selecting vendor:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Lieferant konnte nicht zugeordnet werden',
      });
    } finally {
      setIsProcessingVendor(false);
    }
  };

  const handleCreateNewVendor = async () => {
    if (!currentVendorDecision) return;
    
    setIsProcessingVendor(true);
    
    try {
      // Get legal name from extractedData if different from detected name
      const legalName = currentVendorDecision.extractedData.vendor !== currentVendorDecision.detectedName
        ? currentVendorDecision.extractedData.vendor || undefined
        : undefined;
      
      // Create new vendor with legal name
      const newVendor = await createVendorForReceipt(
        currentVendorDecision.detectedName,
        { legalName }
      );
      
      if (!newVendor) {
        throw new Error('Vendor creation failed');
      }
      
      // Get items with same detected name for "apply to all" feature
      const sameNameItems = applyToAll 
        ? vendorDecisionQueue.filter(q => q.detectedName === currentVendorDecision.detectedName)
        : [];
      
      // Process current item
      await finalizeReceiptWithVendor(
        currentVendorDecision.receiptId,
        currentVendorDecision.extractedData,
        newVendor
      );
      
      // Update upload status
      updateUploadStatus(currentVendorDecision.uploadId);
      
      // Process same-name items if "apply to all"
      if (applyToAll && sameNameItems.length > 0) {
        for (const item of sameNameItems) {
          await finalizeReceiptWithVendor(
            item.receiptId,
            item.extractedData,
            newVendor
          );
          updateUploadStatus(item.uploadId);
        }
        
        // Remove processed items from queue
        setVendorDecisionQueue(prev => 
          prev.filter(q => q.detectedName !== currentVendorDecision.detectedName)
        );
        
        toast({
          title: 'Neuer Lieferant erstellt',
          description: `${sameNameItems.length + 1} Belege "${newVendor.display_name}" zugeordnet`,
        });
      } else {
        toast({
          title: 'Neuer Lieferant erstellt',
          description: `"${newVendor.display_name}" angelegt und zugeordnet`,
        });
      }
      
      // Show next vendor decision or close dialog
      setTimeout(showNextVendorDecision, 300);
      
    } catch (error) {
      console.error('Error creating vendor:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Lieferant konnte nicht erstellt werden',
      });
    } finally {
      setIsProcessingVendor(false);
    }
  };

  const handleSkipVendorSelection = async () => {
    if (!currentVendorDecision) return;
    
    setIsProcessingVendor(true);
    
    try {
      // Finalize without vendor
      await finalizeReceiptWithVendor(
        currentVendorDecision.receiptId,
        currentVendorDecision.extractedData,
        null
      );
      
      // Update upload status
      setUploads(prev => {
        const updated = new Map(prev);
        const current = updated.get(currentVendorDecision.uploadId);
        if (current) {
          updated.set(currentVendorDecision.uploadId, { 
            ...current, 
            status: 'complete',
            progress: 100,
            statusText: 'Ohne Lieferant',
          });
        }
        return updated;
      });
      
      toast({
        title: 'Beleg gespeichert',
        description: 'Ohne Lieferanten-Zuordnung',
      });
      
      // Show next vendor decision or close dialog
      setTimeout(showNextVendorDecision, 300);
      
    } catch (error) {
      console.error('Error skipping vendor:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Beleg konnte nicht gespeichert werden',
      });
    } finally {
      setIsProcessingVendor(false);
    }
  };

  const updateUploadStatus = (uploadId: string) => {
    setUploads(prev => {
      const updated = new Map(prev);
      const current = updated.get(uploadId);
      if (current) {
        updated.set(uploadId, { 
          ...current, 
          status: 'complete',
          progress: 100,
          statusText: `KI: ${Math.round((current.aiConfidence || 0) * 100)}%`,
        });
      }
      return updated;
    });
  };

  // Count same-name items in queue for "apply to all" feature
  const sameNameCount = currentVendorDecision 
    ? vendorDecisionQueue.filter(q => q.detectedName === currentVendorDecision.detectedName).length
    : 0;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, [user, uploads]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    // Reset input to allow selecting same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeUpload = (id: string) => {
    setUploads(prev => {
      const updated = new Map(prev);
      const upload = updated.get(id);
      // Revoke preview URL if exists
      if (upload?.previewUrl) {
        URL.revokeObjectURL(upload.previewUrl);
      }
      updated.delete(id);
      return updated;
    });
  };

  const handleCloudImport = (provider: string) => {
    toast({
      title: 'Cloud-Import kommt bald!',
      description: `${provider} Integration wird in Kürze verfügbar sein.`,
    });
  };

  const uploadsArray = Array.from(uploads.values());
  const completedCount = uploadsArray.filter(u => u.status === 'complete' || u.status === 'complete-manual').length;
  const isAnyProcessing = uploadsArray.some(u => u.status === 'uploading' || u.status === 'processing');
  const canRemove = (status: UploadStatus) => status !== 'uploading' && status !== 'processing';

  // Combine active uploads with pending receipts from DB (exclude already shown in uploads)
  const uploadReceiptIds = new Set(
    uploadsArray.flatMap(upload => upload.receipt?.id ? [upload.receipt.id] : []),
  );
  const allPendingReceipts = pendingReceipts.filter(pr => !uploadReceiptIds.has(pr.id));

  // Calculate status counts for filter
  const statusCounts = useMemo((): UploadStatusCounts => {
    const counts: UploadStatusCounts = {
      all: allPendingReceipts.length,
      success: 0,
      processing: 0,
      pending: 0,
      duplicate: 0,
      error: 0,
      skipped: 0,
    };

    allPendingReceipts.forEach(r => {
      if (r.status === 'review') {
        counts.success++;
      } else if (r.status === 'processing') {
        counts.processing++;
      } else if (r.status === 'pending') {
        counts.pending++;
      } else if (r.status === 'duplicate') {
        counts.duplicate++;
      } else if (r.status === 'rejected' || r.status === 'not_a_receipt') {
        counts.skipped++;
      }
    });

    return counts;
  }, [allPendingReceipts]);

  // Filter receipts based on active filter
  const filteredPendingReceipts = useMemo(() => {
    if (activeFilter === 'all') return allPendingReceipts;
    
    return allPendingReceipts.filter(r => {
      switch (activeFilter) {
        case 'success':
          return r.status === 'review';
        case 'processing':
          return r.status === 'processing';
        case 'pending':
          return r.status === 'pending';
        case 'duplicate':
          return r.status === 'duplicate';
        case 'skipped':
          return r.status === 'rejected' || r.status === 'not_a_receipt';
        default:
          return true;
      }
    });
  }, [allPendingReceipts, activeFilter]);

  const handleContinue = () => {
    navigate('/expenses');
  };

  const getStatusIcon = (upload: FileUpload) => {
    // Check for duplicate status
    if (upload.isDuplicate) {
      return (
        <>
          <PageMeta title="Belege hochladen — BillMonk" description="Belege per Foto, Datei oder E-Mail hochladen und automatisch erfassen lassen." canonical="/upload" noindex />
        <div className="h-8 w-8 rounded-full bg-warning flex items-center justify-center">
          <Copy className="h-4 w-4 text-warning-foreground" />
        </div>
      
        </>
      );
    }

    switch (upload.status) {
      case 'uploading':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case 'processing':
        return (
          <div className="relative">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          </div>
        );
      case 'complete':
        return (
          <div className="h-8 w-8 rounded-full bg-success flex items-center justify-center">
            <Check className="h-4 w-4 text-success-foreground" />
          </div>
        );
      case 'complete-manual':
        return (
          <div className="h-8 w-8 rounded-full bg-warning flex items-center justify-center">
            <PenLine className="h-4 w-4 text-warning-foreground" />
          </div>
        );
      case 'error':
        return (
          <div className="h-8 w-8 rounded-full bg-destructive flex items-center justify-center">
            <XCircle className="h-4 w-4 text-destructive-foreground" />
          </div>
        );
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (upload: FileUpload) => {
    // Show duplicate badge
    if (upload.isDuplicate && upload.duplicateScore) {
      return (
        <Badge variant="secondary" className="text-xs bg-warning/20 text-warning-foreground border-warning/30">
          Duplikat ({upload.duplicateScore}%)
        </Badge>
      );
    }

    if (upload.status === 'complete' && upload.aiConfidence !== undefined) {
      const confidence = upload.aiConfidence;
      let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
      
      if (confidence >= 0.8) {
        variant = 'default';
      } else if (confidence >= 0.5) {
        variant = 'secondary';
      } else {
        variant = 'destructive';
      }

      return (
        <Badge variant={variant} className="text-xs">
          KI: {Math.round(confidence * 100)}%
        </Badge>
      );
    }

    if (upload.status === 'complete-manual') {
      return (
        <Badge variant="outline" className="text-xs">
          Manuelle Eingabe
        </Badge>
      );
    }

    if (upload.statusText && (upload.status === 'uploading' || upload.status === 'processing')) {
      return (
        <span className="text-xs text-muted-foreground">
          {upload.statusText}
        </span>
      );
    }

    return null;
  };

  const getThumbnail = (upload: FileUpload) => {
    if (upload.previewUrl) {
      return (
        <img 
          src={upload.previewUrl} 
          alt={upload.fileName}
          className="h-10 w-10 rounded-lg object-cover"
        />
      );
    }
    
    const isPdf = upload.file.type === 'application/pdf';
    return (
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        {isPdf ? (
          <FileText className="h-5 w-5 text-primary" />
        ) : (
          <FileImage className="h-5 w-5 text-primary" />
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Belege hochladen</h1>
          <p className="text-muted-foreground">Lade deine Belege hoch und lass die KI sie analysieren</p>
        </div>

        {/* Live overview: today's upload sessions, grouped by day */}
        {user && (
          <UploadRunOverview
            userId={user.id}
            activeRunId={uploadPhase !== 'idle' ? overviewRunId : null}
            isActive={uploadPhase !== 'idle'}
            onRunClosed={() => { activeRunRef.current = null; }}
          />
        )}


        {/* File Check Progress - shown during checking phase */}
        {uploadPhase === 'checking' && (
          <FileCheckProgress current={checkProgress.current} total={checkProgress.total} />
        )}

        {/* Upload Area - only show when idle or uploading */}
        {(uploadPhase === 'idle' || uploadPhase === 'uploading') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-border/50 mb-8">
              <CardContent className="p-8">
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  className={`
                    border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200
                    ${isDragOver 
                      ? 'border-primary bg-primary/10 scale-[1.02]' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/30'
                    }
                  `}
                >
                  <div className="h-16 w-16 rounded-2xl gradient-primary mx-auto mb-6 flex items-center justify-center">
                    <UploadIcon className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Belege hierher ziehen
                  </h3>
                  <p className="text-muted-foreground mb-6">oder</p>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="file-upload"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <label htmlFor="file-upload">
                      <Button asChild className="gradient-primary hover:opacity-90 cursor-pointer">
                        <span>Dateien auswählen</span>
                      </Button>
                    </label>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    PDF, JPG, PNG, WebP bis {MAX_FILE_SIZE / 1024 / 1024}MB • Max. {MAX_FILES} Dateien
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-4 text-sm text-primary">
                    <Sparkles className="h-4 w-4" />
                    <span>KI-Erkennung analysiert automatisch Lieferant, Betrag & MwSt</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Scan-App Hint */}
        {uploadPhase === 'idle' && (
          <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/50 p-3 mb-4 text-sm text-muted-foreground">
            <Smartphone className="h-5 w-5 shrink-0" />
            <span>Du bist unterwegs? Scanne Belege mit deiner Scan-App und teile sie direkt an BillMonk.</span>
            <Button
              variant="link"
              size="sm"
              className="shrink-0 text-primary"
              onClick={() => navigate('/settings?tab=email-import')}
            >
              Mehr erfahren
            </Button>
          </div>
        )}

        {/* Cloud Import */}
        {(uploadPhase === 'idle' || uploadPhase === 'uploading') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="border-border/50 mb-8">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  Cloud Import
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-auto py-4 flex-col gap-2 relative overflow-hidden"
                    onClick={() => handleCloudImport('OneDrive')}
                  >
                    <Badge className="absolute top-2 right-2 text-xs bg-muted text-muted-foreground">
                      Coming Soon
                    </Badge>
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Cloud className="h-5 w-5 text-blue-500" />
                    </div>
                    <span className="text-muted-foreground">OneDrive</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto py-4 flex-col gap-2 relative overflow-hidden"
                    onClick={() => navigate('/settings?tab=cloud-storage')}
                  >
                    <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                      <Cloud className="h-5 w-5 text-yellow-500" />
                    </div>
                    <span className="text-foreground">Google Drive</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto py-4 flex-col gap-2 relative overflow-hidden"
                    onClick={() => handleCloudImport('Dropbox')}
                  >
                    <Badge className="absolute top-2 right-2 text-xs bg-muted text-muted-foreground">
                      Coming Soon
                    </Badge>
                    <div className="h-10 w-10 rounded-lg bg-blue-600/10 flex items-center justify-center">
                      <Cloud className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-muted-foreground">Dropbox</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Upload Progress - Active Uploads */}
        <AnimatePresence>
          {uploadsArray.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="border-border/50 mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Aktuelle Uploads</CardTitle>
                    {completedCount > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {completedCount} Beleg{completedCount !== 1 ? 'e' : ''} verarbeitet
                      </p>
                    )}
                  </div>
                  {completedCount > 0 && !isAnyProcessing && (
                    <Button 
                      className="gradient-primary hover:opacity-90"
                      onClick={handleContinue}
                    >
                      Zur Übersicht
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {uploadsArray.map((upload) => (
                      <motion.div
                        key={upload.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={`
                          flex items-center gap-4 p-4 rounded-lg transition-colors
                          ${upload.status === 'error' 
                            ? 'bg-destructive/10 border border-destructive/20' 
                            : upload.status === 'complete-manual'
                            ? 'bg-warning/10 border border-warning/20'
                            : 'bg-muted/30'
                          }
                        `}
                      >
                        {getThumbnail(upload)}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground truncate">
                              {truncateFileName(upload.fileName)}
                            </p>
                            {getStatusBadge(upload)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(upload.fileSize)}
                          </p>
                          {/* Show image-to-PDF conversion hint */}
                          {isImageFile(upload.file) && (upload.status === 'pending' || (upload.status === 'uploading' && upload.progress < 30)) && (
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-primary">
                              <FileText className="h-3 w-3" />
                              <span>Wird automatisch zu PDF konvertiert</span>
                            </div>
                          )}
                          {(upload.status === 'uploading' || upload.status === 'processing') && (
                            <div className="mt-2">
                              <Progress value={upload.progress} className="h-1.5" />
                              <p className="text-xs text-muted-foreground mt-1">
                                {upload.progress < 30 && isImageFile(upload.file) 
                                  ? 'Bild → PDF' 
                                  : upload.progress < 50 
                                  ? 'Upload' 
                                  : 'KI-Analyse'}: {upload.progress}%
                              </p>
                            </div>
                          )}
                          {upload.status === 'error' && upload.error && (
                            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {upload.error}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {getStatusIcon(upload)}
                          {canRemove(upload.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeUpload(upload.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending Receipts from Database - Shown when navigating back to page */}
        <AnimatePresence>
          {allPendingReceipts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="border-border/50">
                <CardHeader className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Aktuelle Upload-Session
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {statusCounts.all} Belege insgesamt
                      </p>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={() => navigate('/review')}
                    >
                      Zur Überprüfung
                    </Button>
                  </div>
                  
                  {/* Status Filter */}
                  <UploadStatusFilter
                    counts={statusCounts}
                    activeFilter={activeFilter}
                    onFilterChange={setActiveFilter}
                  />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredPendingReceipts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Keine Belege mit diesem Status
                      </div>
                    ) : (
                    filteredPendingReceipts.map((receipt) => (
                      <motion.div
                        key={receipt.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center gap-4 p-3 rounded-lg ${
                          receipt.status === 'approved'
                            ? 'bg-success/10 border border-success/20'
                            : receipt.status === 'review' 
                            ? 'bg-success/10 border border-success/20' 
                            : receipt.status === 'duplicate'
                            ? 'bg-warning/10 border border-warning/20'
                            : (receipt.status === 'rejected' || receipt.status === 'not_a_receipt')
                            ? 'bg-destructive/10 border border-destructive/20'
                            : 'bg-muted/30'
                        }`}
                      >
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          receipt.status === 'approved'
                            ? 'bg-success'
                            : receipt.status === 'review' 
                            ? 'bg-success' 
                            : receipt.status === 'duplicate'
                            ? 'bg-warning'
                            : (receipt.status === 'rejected' || receipt.status === 'not_a_receipt')
                            ? 'bg-destructive'
                            : 'bg-primary/10'
                        }`}>
                          {receipt.status === 'approved' ? (
                            <Zap className="h-4 w-4 text-success-foreground" />
                          ) : receipt.status === 'review' ? (
                            <Check className="h-4 w-4 text-success-foreground" />
                          ) : receipt.status === 'duplicate' ? (
                            <Copy className="h-4 w-4 text-warning-foreground" />
                          ) : (receipt.status === 'rejected' || receipt.status === 'not_a_receipt') ? (
                            <XCircle className="h-4 w-4 text-destructive-foreground" />
                          ) : (
                            <FileText className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground truncate text-sm">
                              {truncateFileName(receipt.fileName, 40)}
                            </p>
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${
                                receipt.status === 'approved'
                                  ? 'bg-success/20 text-success-foreground border-success/30'
                                  : receipt.status === 'review'
                                  ? 'bg-success/20 text-success-foreground border-success/30'
                                  : receipt.status === 'duplicate'
                                  ? 'bg-warning/20 text-warning border-warning/30'
                                  : (receipt.status === 'rejected' || receipt.status === 'not_a_receipt')
                                  ? 'bg-destructive/20 text-destructive border-destructive/30'
                                  : receipt.status === 'processing' 
                                  ? 'bg-primary/20 text-primary' 
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {receipt.status === 'approved' && receipt.autoApproved
                                ? 'Auto-freigegeben'
                                : receipt.status === 'approved'
                                ? 'Freigegeben'
                                : receipt.status === 'review' 
                                ? `Fertig${receipt.aiConfidence ? ` (${Math.round(receipt.aiConfidence * 100)}%)` : ''}`
                                : receipt.status === 'duplicate'
                                ? 'Duplikat'
                                : receipt.status === 'not_a_receipt'
                                ? 'Kein Beleg'
                                : receipt.status === 'rejected'
                                ? 'Abgelehnt'
                                : receipt.status === 'processing' 
                                ? 'KI-Analyse' 
                                : 'Wartend'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{format(new Date(receipt.createdAt), 'HH:mm', { locale: de })}</span>
                            {receipt.vendor && <span>• {receipt.vendor}</span>}
                            {receipt.amountGross && <span>• € {receipt.amountGross.toFixed(2)}</span>}
                          </div>
                          {/* Show rejection reason for rejected/not_a_receipt items */}
                          {(receipt.status === 'rejected' || receipt.status === 'not_a_receipt') && receipt.notes && (
                            <p className="text-xs text-destructive/80 mt-1 italic">
                              Grund: {receipt.notes}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {receipt.status === 'approved' ? (
                            <Zap className="h-4 w-4 text-success" />
                          ) : receipt.status === 'review' ? (
                            <Check className="h-4 w-4 text-success" />
                          ) : receipt.status === 'duplicate' ? (
                            <Copy className="h-4 w-4 text-warning" />
                          ) : (receipt.status === 'rejected' || receipt.status === 'not_a_receipt') ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : receipt.status === 'processing' ? (
                            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </motion.div>
                    ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State for Pending Receipts */}
        {loadingPendingReceipts && uploadsArray.length === 0 && (
          <Card className="border-border/50">
            <CardContent className="p-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-primary animate-spin mr-3" />
              <span className="text-muted-foreground">Lade Uploads...</span>
            </CardContent>
          </Card>
        )}

        {/* Duplicate Check Dialog */}
        <DuplicateCheckDialog
          open={uploadPhase === 'resolving-duplicates'}
          duplicates={duplicatesToResolve}
          nonDuplicateCount={nonDuplicateFiles.length}
          onComplete={handleDuplicateDecisions}
          onCancel={handleDuplicateCancel}
        />

        {/* Vendor Selection Dialog */}
        <VendorSelectionDialog
          open={showVendorSelectionDialog}
          onOpenChange={(open) => {
            if (!open) handleSkipVendorSelection();
          }}
          detectedName={currentVendorDecision?.detectedName || ''}
          suggestions={currentVendorDecision?.suggestions || []}
          onSelectExisting={handleSelectExistingVendor}
          onCreateNew={handleCreateNewVendor}
          onSkip={handleSkipVendorSelection}
          isLoading={isProcessingVendor}
        />

        {/* Apply to all checkbox in dialog - shown when multiple items have same vendor */}
        {showVendorSelectionDialog && sameNameCount > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-card border rounded-lg shadow-lg p-3 flex items-center gap-2">
            <Checkbox 
              id="applyToAll" 
              checked={applyToAll}
              onCheckedChange={(checked) => setApplyToAll(checked === true)}
            />
            <Label htmlFor="applyToAll" className="text-sm">
              Für alle {sameNameCount + 1} Belege mit "{currentVendorDecision?.detectedName}" übernehmen
            </Label>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Upload;
