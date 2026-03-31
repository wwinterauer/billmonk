import { useEffect, useState } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { Button } from '@/components/ui/button';
import { 
  Camera, 
  X, 
  SwitchCamera, 
  Check, 
  RotateCcw,
  Loader2,
  AlertCircle,
  Plus,
  FileText,
  Trash2,
  Smartphone,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CapturedPage {
  file: File;
  dataUrl: string;
}

interface CameraCaptureProps {
  onComplete: (files: File[]) => void;
  onClose: () => void;
}

export function CameraCapture({ onComplete, onClose }: CameraCaptureProps) {
  const { videoRef, state, startCamera, stopCamera, capturePhoto, switchCamera } = useCamera();
  
  // Alle aufgenommenen Seiten
  const [capturedPages, setCapturedPages] = useState<CapturedPage[]>([]);
  
  // Aktuelle Vorschau (gerade aufgenommenes Bild)
  const [currentPreview, setCurrentPreview] = useState<CapturedPage | null>(null);
  
  // Galerie-Ansicht
  const [showGallery, setShowGallery] = useState(false);

  // Scan-App-Hinweis
  const [showScanTip, setShowScanTip] = useState(() => {
    return !sessionStorage.getItem('camera-scan-tip-dismissed');
  });
  const [showScanSteps, setShowScanSteps] = useState(false);

  const dismissScanTip = () => {
    setShowScanTip(false);
    sessionStorage.setItem('camera-scan-tip-dismissed', 'true');
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Foto aufnehmen
  const handleCapture = async () => {
    const result = await capturePhoto();
    if (result) {
      setCurrentPreview(result);
    }
  };

  // Foto akzeptieren → zur Liste hinzufügen
  const handleAcceptPhoto = () => {
    if (currentPreview) {
      setCapturedPages(prev => [...prev, currentPreview]);
      setCurrentPreview(null);
    }
  };

  // Foto verwerfen → neu aufnehmen
  const handleRetakePhoto = () => {
    if (currentPreview) {
      URL.revokeObjectURL(currentPreview.dataUrl);
    }
    setCurrentPreview(null);
  };

  // Seite aus Liste entfernen
  const handleRemovePage = (index: number) => {
    setCapturedPages(prev => {
      const newPages = [...prev];
      URL.revokeObjectURL(newPages[index].dataUrl);
      newPages.splice(index, 1);
      return newPages;
    });
  };

  // Fertig → an Parent übergeben
  const handleFinish = () => {
    const allFiles: File[] = [...capturedPages.map(p => p.file)];
    if (currentPreview) {
      allFiles.push(currentPreview.file);
    }
    
    if (allFiles.length > 0) {
      onComplete(allFiles);
    }
    handleClose();
  };

  // Cleanup
  const handleClose = () => {
    capturedPages.forEach(p => URL.revokeObjectURL(p.dataUrl));
    if (currentPreview) {
      URL.revokeObjectURL(currentPreview.dataUrl);
    }
    stopCamera();
    onClose();
  };

  const totalPages = capturedPages.length + (currentPreview ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={handleClose} className="text-white hover:bg-white/20">
          <X className="h-6 w-6" />
        </Button>
        
        {/* Seitenzähler */}
        {totalPages > 0 && (
          <Button
            variant="ghost"
            onClick={() => setShowGallery(true)}
            className="text-white hover:bg-white/20 gap-2"
          >
            <FileText className="h-5 w-5" />
            {totalPages} {totalPages === 1 ? 'Seite' : 'Seiten'}
          </Button>
        )}

        {state.isActive && !currentPreview && (
          <Button variant="ghost" size="icon" onClick={switchCamera} className="text-white hover:bg-white/20">
            <SwitchCamera className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Hauptbereich */}
      <div className="flex-1 relative overflow-hidden">
        {state.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <span className="ml-3 text-white">Kamera wird gestartet...</span>
          </div>
        )}

        {state.error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-white mb-4">{state.error}</p>
            <Button onClick={startCamera} variant="secondary">
              Erneut versuchen
            </Button>
          </div>
        )}

        {currentPreview ? (
          // Vorschau
          <div className="absolute inset-0 flex flex-col">
            <img 
              src={currentPreview.dataUrl} 
              alt="Aufgenommenes Foto" 
              className="flex-1 object-contain"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <p className="text-white text-center text-sm">
                Qualität prüfen - scharf und gut lesbar?
              </p>
            </div>
          </div>
        ) : (
          // Kamera-Vorschau
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="absolute inset-0 w-full h-full object-cover"
            />
            {state.isActive && capturedPages.length === 0 && !currentPreview && showScanTip && (
              <div className="absolute top-2 left-2 right-2 z-10 rounded-lg bg-black/70 backdrop-blur-sm p-3 text-white">
                <div className="flex items-start gap-2">
                  <Smartphone className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                  <div className="flex-1 text-xs space-y-1">
                    <p>Für beste Scan-Qualität empfehlen wir <strong>Google Drive Scan</strong> oder <strong>Adobe Scan</strong>. Teile den gescannten Beleg dann direkt an BillMonk.</p>
                    {showScanSteps ? (
                      <ol className="list-decimal list-inside space-y-0.5 text-white/80">
                        <li>Scanne deinen Beleg mit deiner Scan-App</li>
                        <li>Tippe auf Teilen</li>
                        <li>Wähle BillMonk</li>
                      </ol>
                    ) : (
                      <button
                        onClick={() => setShowScanSteps(true)}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        So geht's <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <button onClick={dismissScanTip} className="shrink-0 text-white/60 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            {state.isActive && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Dokument-Rahmen */}
                <div className="absolute inset-8 md:inset-16 border-2 border-white/50 rounded-lg">
                  {/* Ecken */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  
                  {/* Hinweis-Text */}
                  <div className="absolute -bottom-12 left-0 right-0 text-center">
                    <span className="text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                      {capturedPages.length === 0 
                        ? 'Beleg im Rahmen positionieren' 
                        : `Seite ${capturedPages.length + 1} aufnehmen`
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 bg-black/50 backdrop-blur-sm">
        {currentPreview ? (
          // Vorschau-Modus
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center justify-center gap-8">
              <Button
                variant="ghost"
                size="lg"
                onClick={handleRetakePhoto}
                className="text-white hover:bg-white/20 flex-col h-auto py-3"
              >
                <RotateCcw className="h-8 w-8 mb-1" />
                <span className="text-xs">Neu</span>
              </Button>
              
              <Button
                variant="ghost"
                size="lg"
                onClick={handleAcceptPhoto}
                className="text-white hover:bg-white/20 flex-col h-auto py-3"
              >
                <Plus className="h-8 w-8 mb-1" />
                <span className="text-xs">Nächste Seite</span>
              </Button>
              
              <Button
                variant="default"
                size="lg"
                onClick={handleFinish}
                className="flex-col h-auto py-3 bg-primary hover:bg-primary/90"
              >
                <Check className="h-8 w-8 mb-1" />
                <span className="text-xs">Fertig</span>
              </Button>
            </div>
            
            {capturedPages.length > 0 && (
              <p className="text-white/70 text-sm">
                {capturedPages.length} weitere Seite{capturedPages.length > 1 ? 'n' : ''} bereits aufgenommen
              </p>
            )}
          </div>
        ) : (
          // Kamera-Modus
          <div className="flex items-center justify-center gap-8">
            {capturedPages.length > 0 && (
              <Button
                variant="secondary"
                onClick={handleFinish}
              >
                <Check className="h-5 w-5 mr-2" />
                Fertig ({capturedPages.length})
              </Button>
            )}
            
            <button
              onClick={handleCapture}
              disabled={!state.isActive}
              className={cn(
                "w-20 h-20 rounded-full border-4 border-white flex items-center justify-center",
                "transition-all duration-200",
                state.isActive 
                  ? "bg-white/20 hover:bg-white/30 active:scale-95" 
                  : "bg-gray-500/50 cursor-not-allowed"
              )}
            >
              <Camera className="h-8 w-8 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Galerie-Modal */}
      {showGallery && capturedPages.length > 0 && (
        <div className="absolute inset-0 bg-black/95 z-10 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-white/20">
            <h2 className="text-white font-semibold">Aufgenommene Seiten</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowGallery(false)}
              className="text-white"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 gap-4">
              {capturedPages.map((page, index) => (
                <div key={index} className="relative group aspect-[3/4] rounded-lg overflow-hidden">
                  <img 
                    src={page.dataUrl} 
                    alt={`Seite ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-center">
                    <span className="text-white text-sm">Seite {index + 1}</span>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleRemovePage(index)}
                    className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-4 border-t border-white/20">
            <Button variant="secondary" className="w-full" onClick={() => setShowGallery(false)}>
              Zurück zur Kamera
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
