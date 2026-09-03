import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent, Button } from './ui/shadcn';
import { Camera, RefreshCw, SwitchCamera, Check, X, Sparkles, Target } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (webpDataUrl: string) => void;
  onCancel?: () => void;
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageSizeKb, setImageSizeKb] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Initialize Camera Stream with facingMode
  const startCamera = async (facing: 'user' | 'environment' = cameraFacing) => {
    try {
      setCameraError(null);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Camera access failed:', err);
      setCameraError("Impossible d'accéder à la caméra. Vérifiez les autorisations.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    startCamera(cameraFacing);
    return () => {
      stopCamera();
    };
  }, [cameraFacing]);

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
  };

  const snapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;

    canvas.width = 400;
    canvas.height = 400;

    // Flip horizontally only if using user (selfie) camera
    if (cameraFacing === 'user') {
      ctx.translate(400, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, startX, startY, size, size, 0, 0, 400, 400);
    const webpData = canvas.toDataURL('image/webp', 0.88);
    setCapturedImage(webpData);

    const head = 'data:image/webp;base64,';
    const sizeInBytes = Math.round(((webpData.length - head.length) * 3) / 4);
    setImageSizeKb(Math.round(sizeInBytes / 1024));

    stopCamera();
    setIsCapturing(false);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setImageSizeKb(null);
    startCamera(cameraFacing);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2 }}
      className="max-w-md w-full mx-auto"
    >
      <Card className="border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-zinc-800/80 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-white">
                Photo du Membre
              </CardTitle>
              <p className="text-[11px] text-zinc-400">
                {cameraFacing === 'user' ? 'Caméra Avant (Selfie)' : 'Caméra Arrière'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!capturedImage && (
              <button
                type="button"
                onClick={toggleCameraFacing}
                className="text-zinc-300 hover:text-white p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition flex items-center gap-1 text-xs font-semibold"
                title="Changer de caméra"
              >
                <SwitchCamera className="w-4 h-4 text-orange-400" />
                <span className="text-[10px] hidden sm:inline">Changer</span>
              </button>
            )}

            {onCancel && (
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onCancel();
                }}
                className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3">
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-inner">
            <AnimatePresence mode="wait">
              {!capturedImage ? (
                <motion.div
                  key="live-video"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative w-full h-full"
                >
                  {cameraError ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                      <p className="text-xs text-amber-400 font-medium">{cameraError}</p>
                      <Button variant="outline" size="sm" onClick={() => startCamera(cameraFacing)}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Réessayer
                      </Button>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${cameraFacing === 'user' ? 'transform -scale-x-100' : ''}`}
                      />
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                        <div className="w-48 h-48 border-2 border-orange-500/40 rounded-full border-dashed animate-pulse flex items-center justify-center">
                          <Target className="w-8 h-8 text-orange-400/40" />
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="captured-preview"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative w-full h-full"
                >
                  <img
                    src={capturedImage}
                    alt="Photo Membre"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 right-3 bg-zinc-950/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-emerald-500/30 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 shadow-xl">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    WebP {imageSizeKb ? `~${imageSizeKb} KB` : 'Prêt'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            {!capturedImage ? (
              <>
                <Button
                  variant="default"
                  className="flex-1 h-11 text-sm font-bold bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={snapPhoto}
                  disabled={isCapturing || !!cameraError}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Prendre la photo
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={toggleCameraFacing}
                  className="h-11 px-4 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                  title="Changer vers caméra avant / arrière"
                >
                  <SwitchCamera className="w-5 h-5 text-orange-400" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="flex-1 h-11 border-zinc-700 text-zinc-200" onClick={handleRetake}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reprendre
                </Button>
                <Button
                  variant="default"
                  className="flex-1 h-11 font-bold bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={() => onCapture(capturedImage)}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Valider la photo
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
