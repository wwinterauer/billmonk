import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload as UploadIcon, 
  Cloud, 
  FileText, 
  X, 
  Check,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
}

const Upload = () => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const simulateUpload = (file: File) => {
    const id = Math.random().toString(36).substring(7);
    const newFile: UploadedFile = {
      id,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading',
    };

    setUploadedFiles(prev => [...prev, newFile]);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadedFiles(prev => prev.map(f => {
        if (f.id === id && f.progress < 100) {
          const newProgress = Math.min(f.progress + Math.random() * 30, 100);
          return {
            ...f,
            progress: newProgress,
            status: newProgress === 100 ? 'complete' : 'uploading',
          };
        }
        return f;
      }));
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      setUploadedFiles(prev => prev.map(f => 
        f.id === id ? { ...f, progress: 100, status: 'complete' } : f
      ));
    }, 2000);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      const isValid = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type);
      const isSmallEnough = file.size <= 10 * 1024 * 1024; // 10MB
      return isValid && isSmallEnough;
    });

    if (validFiles.length !== files.length) {
      toast({
        variant: 'destructive',
        title: 'Einige Dateien wurden abgelehnt',
        description: 'Nur PDF, JPG und PNG bis 10MB sind erlaubt.',
      });
    }

    validFiles.forEach(simulateUpload);
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(simulateUpload);
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const completedCount = uploadedFiles.filter(f => f.status === 'complete').length;

  const handleContinue = () => {
    toast({
      title: 'Belege werden verarbeitet',
      description: `${completedCount} Beleg(e) werden von der KI analysiert...`,
    });
    navigate('/review');
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
                  border-2 border-dashed rounded-xl p-12 text-center transition-colors
                  ${isDragOver 
                    ? 'border-primary bg-primary/5' 
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
                    type="file"
                    id="file-upload"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
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
                  PDF, JPG, PNG bis 10MB
                </p>
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
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Cloud className="h-5 w-5 text-blue-500" />
                  </div>
                  <span>OneDrive verbinden</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                    <Cloud className="h-5 w-5 text-yellow-500" />
                  </div>
                  <span>Google Drive verbinden</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <div className="h-10 w-10 rounded-lg bg-blue-600/10 flex items-center justify-center">
                    <Cloud className="h-5 w-5 text-blue-600" />
                  </div>
                  <span>Dropbox verbinden</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Upload Progress */}
        <AnimatePresence>
          {uploadedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Hochgeladene Dateien</CardTitle>
                  {completedCount > 0 && (
                    <Button 
                      className="gradient-primary hover:opacity-90"
                      onClick={handleContinue}
                    >
                      Weiter zur Prüfung
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {uploadedFiles.map((file) => (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg"
                      >
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{file.name}</p>
                          <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                          {file.status === 'uploading' && (
                            <Progress value={file.progress} className="h-1.5 mt-2" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {file.status === 'uploading' && (
                            <Loader2 className="h-5 w-5 text-primary animate-spin" />
                          )}
                          {file.status === 'complete' && (
                            <div className="h-8 w-8 rounded-full bg-success flex items-center justify-center">
                              <Check className="h-4 w-4 text-success-foreground" />
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(file.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
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
