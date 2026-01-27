import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileCheck, AlertCircle, Upload, Share2 } from 'lucide-react';

type Status = 'processing' | 'success' | 'error' | 'no-files' | 'auth-required';

export default function ShareReceive() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [status, setStatus] = useState<Status>('processing');
  const [errorMessage, setErrorMessage] = useState('');
  const [processedCount, setProcessedCount] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);

  useEffect(() => {
    handleSharedFiles();
  }, []);

  const handleSharedFiles = async () => {
    try {
      // Check for errors from service worker
      const error = searchParams.get('error');
      if (error === 'no-files') {
        setStatus('no-files');
        return;
      }
      if (error === 'processing') {
        setStatus('error');
        setErrorMessage('Fehler beim Verarbeiten der geteilten Dateien');
        return;
      }

      // Get shareId from URL
      const shareId = searchParams.get('shareId');
      if (!shareId) {
        setStatus('no-files');
        return;
      }

      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setStatus('auth-required');
        // Store shareId for after login
        sessionStorage.setItem('pendingShareId', shareId);
        return;
      }

      // Retrieve files from service worker cache
      const cache = await caches.open('shared-files');
      const keys = await cache.keys();
      
      // Filter keys for this share
      const shareKeys = keys.filter(key => 
        key.url.includes(`shared-file-${shareId}`)
      );

      if (shareKeys.length === 0) {
        setStatus('no-files');
        return;
      }

      setTotalFiles(shareKeys.length);
      let successCount = 0;

      for (const key of shareKeys) {
        try {
          const response = await cache.match(key);
          if (!response) continue;

          const blob = await response.blob();
          const fileName = decodeURIComponent(response.headers.get('X-File-Name') || 'document');
          const file = new File([blob], fileName, { type: blob.type });

          if (file.size > 0) {
            await uploadSharedFile(file, user.id);
            successCount++;
            setProcessedCount(successCount);
          }

          // Remove from cache
          await cache.delete(key);
        } catch (err) {
          console.error('Failed to process file:', err);
        }
      }

      if (successCount > 0) {
        setStatus('success');
        queryClient.invalidateQueries({ queryKey: ['receipts'] });
        
        toast({
          title: "Import erfolgreich",
          description: `${successCount} Beleg${successCount > 1 ? 'e' : ''} importiert`,
        });

        // Navigate to review after delay
        setTimeout(() => navigate('/review'), 2500);
      } else {
        setStatus('no-files');
      }

    } catch (error: any) {
      console.error('Share receive error:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Unbekannter Fehler');
    }
  };

  const uploadSharedFile = async (file: File, userId: string) => {
    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      throw new Error('Nur PDF und Bilder werden unterstützt');
    }

    let storagePath: string;
    let fileName: string;
    let fileHash: string;

    if (isImage) {
      // Convert image to PDF
      const base64 = await fileToBase64(file);
      
      const { data, error } = await supabase.functions.invoke('convert-image-to-pdf', {
        body: {
          imageData: base64.split(',')[1],
          fileName: file.name,
          contentType: file.type,
          userId: userId,
        }
      });

      if (error) throw error;

      storagePath = data.storagePath;
      fileName = data.fileName;
      fileHash = data.fileHash;
    } else {
      // Upload PDF directly
      const now = new Date();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      storagePath = `${userId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}_${safeName}`;

      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(storagePath, bytes, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Calculate hash
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
      fileHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      fileName = safeName;
    }

    // Create receipt
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        user_id: userId,
        file_url: storagePath,
        file_name: fileName,
        file_type: 'application/pdf',
        file_hash: fileHash,
        status: 'processing',
        source: 'share',
      })
      .select()
      .single();

    if (receiptError) throw receiptError;

    // Trigger AI extraction
    if (receipt) {
      supabase.functions.invoke('extract-receipt', {
        body: { receiptId: receipt.id }
      }).catch(console.error);
    }
  };

  const handleLogin = () => {
    navigate('/login?redirect=/share-receive');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {status === 'processing' && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-2">Belege werden importiert...</h2>
              {totalFiles > 0 && (
                <p className="text-muted-foreground">
                  {processedCount} von {totalFiles} verarbeitet
                </p>
              )}
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-8">
              <FileCheck className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2 text-green-700">Import erfolgreich!</h2>
              <p className="text-muted-foreground mb-4">
                {processedCount} Beleg{processedCount > 1 ? 'e' : ''} importiert
              </p>
              <p className="text-sm text-muted-foreground">
                Weiterleitung zur Überprüfung...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2 text-red-700">Fehler beim Import</h2>
              <p className="text-muted-foreground mb-4">{errorMessage}</p>
              <Button onClick={() => navigate('/expenses')}>
                Zurück zur Übersicht
              </Button>
            </div>
          )}

          {status === 'no-files' && (
            <div className="text-center py-8">
              <Share2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Keine Dateien empfangen</h2>
              <p className="text-muted-foreground mb-4">
                Teile ein PDF oder Bild aus einer anderen App, um es zu importieren.
              </p>
              <div className="space-y-2">
                <Button onClick={() => navigate('/upload')} className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  Manuell hochladen
                </Button>
                <Button variant="outline" onClick={() => navigate('/expenses')} className="w-full">
                  Zur Übersicht
                </Button>
              </div>
            </div>
          )}

          {status === 'auth-required' && (
            <div className="text-center py-8">
              <Share2 className="h-12 w-12 mx-auto text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-2">Anmeldung erforderlich</h2>
              <p className="text-muted-foreground mb-4">
                Bitte melde dich an, um die geteilten Dateien zu importieren.
              </p>
              <Button onClick={handleLogin} className="w-full">
                Jetzt anmelden
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}