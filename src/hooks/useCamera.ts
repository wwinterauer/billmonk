import { useState, useRef, useCallback } from 'react';

interface UseCameraOptions {
  facingMode?: 'user' | 'environment';
  width?: number;
  height?: number;
}

interface CameraState {
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean | null;
}

export function useCamera(options: UseCameraOptions = {}) {
  const {
    facingMode = 'environment', // Rückkamera für Dokumente
    width = 1920,
    height = 1080
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [state, setState] = useState<CameraState>({
    isActive: false,
    isLoading: false,
    error: null,
    hasPermission: null,
  });

  // Kamera starten
  const startCamera = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Kamera wird von diesem Browser nicht unterstützt');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setState({
        isActive: true,
        isLoading: false,
        error: null,
        hasPermission: true,
      });
    } catch (error: any) {
      let errorMessage = 'Kamera konnte nicht gestartet werden';

      if (error.name === 'NotAllowedError') {
        errorMessage = 'Kamera-Zugriff wurde verweigert. Bitte erlaube den Zugriff in den Browser-Einstellungen.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Keine Kamera gefunden';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Kamera wird bereits von einer anderen App verwendet';
      }

      setState({
        isActive: false,
        isLoading: false,
        error: errorMessage,
        hasPermission: error.name === 'NotAllowedError' ? false : null,
      });
    }
  }, [facingMode, width, height]);

  // Kamera stoppen
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setState(prev => ({ ...prev, isActive: false }));
  }, []);

  // Foto aufnehmen - gibt File und DataURL zurück
  const capturePhoto = useCallback((): Promise<{ file: File; dataUrl: string } | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current || !state.isActive) {
        resolve(null);
        return;
      }

      const video = videoRef.current;

      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(video, 0, 0);

      // DataURL für Vorschau
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

      // File für Upload
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const timestamp = Date.now();
            const file = new File([blob], `seite-${timestamp}.jpg`, {
              type: 'image/jpeg',
            });
            resolve({ file, dataUrl });
          } else {
            resolve(null);
          }
        },
        'image/jpeg',
        0.92
      );
    });
  }, [state.isActive]);

  // Kamera wechseln (Front/Back)
  const switchCamera = useCallback(async () => {
    stopCamera();
    await new Promise(resolve => setTimeout(resolve, 100));
    // Hinweis: facingMode wechsel müsste über options gesteuert werden
    await startCamera();
  }, [stopCamera, startCamera]);

  return {
    videoRef,
    state,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
  };
}
