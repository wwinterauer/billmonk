import { useState, useCallback, useRef } from 'react';
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
  PenLine
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { useReceipts, type UploadProgress, type UploadStatus, type Receipt } from '@/hooks/useReceipts';
import { motion, AnimatePresence } from 'framer-motion';

interface FileUpload extends UploadProgress {
  file: File;
  previewUrl?: string;
}

const Upload = () => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState<Map<string, FileUpload>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { validateFiles, uploadAndProcessReceipt, ALLOWED_TYPES, MAX_FILE_SIZE, MAX_FILES } = useReceipts();

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

  const processFiles = async (files: File[]) => {
    const { validFiles, errors } = validateFiles(files);

    if (errors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Einige Dateien wurden abgelehnt',
        description: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n...und ${errors.length - 3} weitere` : ''),
      });
    }

    if (validFiles.length === 0) return;

    // Check total count including existing pending/uploading files
    const pendingCount = Array.from(uploads.values()).filter(
      u => u.status === 'pending' || u.status === 'uploading' || u.status === 'processing'
    ).length;

    if (pendingCount + validFiles.length > MAX_FILES) {
      toast({
        variant: 'destructive',
        title: 'Zu viele Dateien',
        description: `Maximal ${MAX_FILES} Dateien gleichzeitig erlaubt.`,
      });
      return;
    }

    // Add files to upload queue
    const newUploads = new Map(uploads);
    const filesToUpload: FileUpload[] = [];

    for (const file of validFiles) {
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
      };
      newUploads.set(id, upload);
      filesToUpload.push(upload);
    }

    setUploads(newUploads);

    // Start uploading files sequentially
    for (const upload of filesToUpload) {
      await uploadFile(upload);
    }
  };

  const uploadFile = async (upload: FileUpload) => {
    // Update status to uploading
    setUploads(prev => {
      const updated = new Map(prev);
      const current = updated.get(upload.id);
      if (current) {
        updated.set(upload.id, { 
          ...current, 
          status: 'uploading', 
          progress: 5,
          statusText: 'Wird hochgeladen...'
        });
      }
      return updated;
    });

    try {
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
      });

      const finalStatus: UploadStatus = result.aiSuccess ? 'complete' : 'complete-manual';
      const finalStatusText = result.aiSuccess 
        ? `KI: ${Math.round((result.aiConfidence || 0) * 100)}%` 
        : 'Manuelle Eingabe';

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
            aiConfidence: result.aiConfidence
          });
        }
        return updated;
      });

      if (result.aiSuccess) {
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, [validateFiles, toast, uploads]);

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

  const handleContinue = () => {
    navigate('/expenses');
  };

  const getStatusIcon = (upload: FileUpload) => {
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

        {/* Upload Area */}
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

        {/* Cloud Import */}
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
                  onClick={() => handleCloudImport('Google Drive')}
                >
                  <Badge className="absolute top-2 right-2 text-xs bg-muted text-muted-foreground">
                    Coming Soon
                  </Badge>
                  <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                    <Cloud className="h-5 w-5 text-yellow-500" />
                  </div>
                  <span className="text-muted-foreground">Google Drive</span>
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

        {/* Upload Progress */}
        <AnimatePresence>
          {uploadsArray.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Hochgeladene Dateien</CardTitle>
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
                          {(upload.status === 'uploading' || upload.status === 'processing') && (
                            <div className="mt-2">
                              <Progress value={upload.progress} className="h-1.5" />
                              <p className="text-xs text-muted-foreground mt-1">
                                {upload.progress < 50 ? 'Upload' : 'KI-Analyse'}: {upload.progress}%
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
      </div>
    </DashboardLayout>
  );
};

export default Upload;
