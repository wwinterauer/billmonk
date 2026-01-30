import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import { CameraCapture } from './CameraCapture';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export function CameraButton() {
  const [showCamera, setShowCamera] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleComplete = async (files: File[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");

      let storagePath: string;
      let fileName: string;
      let fileHash: string;

      if (files.length === 1) {
        // Einzelne Seite → bestehende Bild-zu-PDF Konvertierung nutzen
        toast({
          title: "Beleg wird verarbeitet",
          description: "Bild wird zu PDF konvertiert...",
        });

        const file = files[0];
        const base64 = await fileToBase64(file);

        // Note: userId is now extracted from auth token server-side, not passed in body
        const { data, error } = await supabase.functions.invoke('convert-image-to-pdf', {
          body: {
            imageData: base64.split(',')[1],
            fileName: file.name,
            contentType: file.type,
          }
        });

        if (error) throw error;
        storagePath = data.storagePath;
        fileName = data.fileName;
        fileHash = data.fileHash;

      } else {
        // Mehrere Seiten → kombinieren
        toast({
          title: "Beleg wird erstellt",
          description: `${files.length} Seiten werden zu PDF kombiniert...`,
        });

        const base64Images = await Promise.all(
          files.map(async (file) => ({
            data: (await fileToBase64(file)).split(',')[1],
            contentType: file.type,
          }))
        );

        const { data, error } = await supabase.functions.invoke('combine-images-to-pdf', {
          body: {
            images: base64Images,
            fileName: `beleg-${Date.now()}.pdf`,
          }
        });

        if (error) throw error;
        storagePath = data.storagePath;
        fileName = data.fileName;
        fileHash = data.fileHash;
      }

      // Receipt erstellen mit .select() um ID zu bekommen
      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .insert({
          user_id: user.id,
          file_url: storagePath,
          file_name: fileName,
          file_type: 'application/pdf',
          file_hash: fileHash,
          status: 'processing',
          source: 'camera',
        })
        .select()
        .single();

      if (receiptError) throw receiptError;

      toast({
        title: "Beleg aufgenommen",
        description: "KI-Analyse wird gestartet...",
      });

      // KI-Extraktion triggern
      supabase.functions.invoke('extract-receipt', {
        body: { receiptId: receipt.id }
      }).then(() => {
        // Query invalidieren nach KI-Verarbeitung
        queryClient.invalidateQueries({ queryKey: ['receipts'] });
      }).catch(err => {
        console.error('KI-Extraktion Fehler:', err);
      });

      // Receipts-Liste sofort neu laden
      queryClient.invalidateQueries({ queryKey: ['receipts'] });

      // Zur Review-Seite navigieren
      navigate('/review');

    } catch (error: any) {
      console.error('Camera upload error:', error);
      toast({
        title: "Fehler",
        description: error.message || "Beleg konnte nicht hochgeladen werden",
        variant: "destructive",
      });
    }
  };

  // Kamera nur auf Geräten mit Kamera anzeigen
  const isCameraAvailable = typeof navigator !== 'undefined' && 
    'mediaDevices' in navigator && 
    'getUserMedia' in navigator.mediaDevices;

  if (!isCameraAvailable) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button - nur auf Mobile */}
      <Button
        onClick={() => setShowCamera(true)}
        size="lg"
        className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg md:hidden"
      >
        <Camera className="h-6 w-6" />
      </Button>

      {/* Kamera-Vollbild */}
      {showCamera && (
        <CameraCapture
          onComplete={handleComplete}
          onClose={() => setShowCamera(false)}
        />
      )}
    </>
  );
}

// Helper
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}
