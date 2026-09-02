import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconCamera,
  IconRefresh,
  IconCheck,
  IconX,
  IconUpload,
  IconSparkles,
  IconFocus2
} from '@tabler/icons-react';
import { Button, Card, CardHeader, CardTitle, CardContent } from './ui/components';

interface CameraCaptureProps {
  onCapture: (webpBase64: string) => void;
  onCancel?: () => void;
  initialImage?: string;
}

export function CameraCapture({ onCapture, onCancel, initialImage }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(initialImage || null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [imageSizeKb, setImageSizeKb] = useState<number | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 },
          facingMode: 'user'
        },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Webcam unavailable. Check permissions or upload an image file.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (!capturedImage) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, []);

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
    startCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;

        canvas.width = 400;
        canvas.height = 400;
        ctx.drawImage(img, startX, startY, size, size, 0, 0, 400, 400);

        const webpData = canvas.toDataURL('image/webp', 0.88);
        setCapturedImage(webpData);
        setImageSizeKb(Math.round((webpData.length * 3) / 4 / 1024));
        stopCamera();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2 }}
      className="max-w-md w-full mx-auto"
    >
      <Card className="border-zinc-800 bg-zinc-900/90 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-zinc-800/80 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <IconCamera className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-white tracking-tight">
                Live Face Capture
              </CardTitle>
              <p className="text-[11px] text-zinc-400">Auto 1:1 square crop & WebP encoder</p>
            </div>
          </div>
          {onCancel && (
            <button
              onClick={() => {
                stopCamera();
                onCancel();
              }}
              className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition"
            >
              <IconX className="w-5 h-5" />
            </button>
          )}
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-inner scanner-grid">
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
                      <Button variant="outline" size="sm" onClick={startCamera}>
                        <IconRefresh className="w-4 h-4 mr-2" /> Retry Camera
                      </Button>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform -scale-x-100"
                      />
                      {/* Modern Target HUD Overlay */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                        <div className="w-full h-full border border-emerald-500/30 rounded-full border-dashed animate-pulse flex items-center justify-center">
                          <IconFocus2 className="w-12 h-12 text-emerald-400/40" />
                        </div>
                      </div>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-zinc-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-zinc-700/60 text-[10px] text-emerald-400 font-mono flex items-center gap-1.5 shadow-lg">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        LIVE STREAM (640×640)
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
                    alt="Member Snap"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 right-3 bg-zinc-950/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-emerald-500/30 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 shadow-xl">
                    <IconSparkles className="w-3.5 h-3.5 text-emerald-400" />
                    WebP {imageSizeKb ? `~${imageSizeKb} KB` : 'Ready'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2.5 pt-1">
            {!capturedImage ? (
              <>
                <Button
                  variant="default"
                  className="flex-1 h-11 text-sm font-bold"
                  onClick={snapPhoto}
                  disabled={isCapturing || !!cameraError}
                >
                  <IconCamera className="w-4 h-4 mr-2" />
                  Capture Member Photo
                </Button>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button variant="outline" type="button" className="h-11 px-3.5">
                    <IconUpload className="w-4 h-4" />
                  </Button>
                </label>
              </>
            ) : (
              <>
                <Button variant="outline" className="flex-1 h-11" onClick={handleRetake}>
                  <IconRefresh className="w-4 h-4 mr-2" />
                  Retake Photo
                </Button>
                <Button
                  variant="default"
                  className="flex-1 h-11 font-bold"
                  onClick={() => onCapture(capturedImage)}
                >
                  <IconCheck className="w-4 h-4 mr-2" />
                  Confirm Image
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
