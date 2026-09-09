import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImagePreviewModalProps {
  isOpen: boolean;
  src: string | null;
  alt?: string;
  title?: string;
  onClose: () => void;
}

export function ImagePreviewModal({
  isOpen,
  src,
  alt = 'Image Preview',
  title,
  onClose
}: ImagePreviewModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // References for touch gesture handling
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartScaleRef = useRef<number>(1);
  const lastTouchPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  // Reset transform whenever modal opens/closes or src changes
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, src]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const handleZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Double tap to toggle zoom
  const handleDoubleTap = () => {
    if (scale > 1) {
      handleResetZoom();
    } else {
      setScale(2.5);
    }
  };

  // Helper for touch distance (Pinch)
  const getDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch started
      const dist = getDistance(e.touches[0], e.touches[1]);
      touchStartDistRef.current = dist;
      touchStartScaleRef.current = scale;
    } else if (e.touches.length === 1) {
      // Check for double tap
      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
        handleDoubleTap();
        lastTapTimeRef.current = 0;
        return;
      }
      lastTapTimeRef.current = now;

      // Single touch pan if zoomed
      lastTouchPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      // Handle pinch zoom
      const currentDist = getDistance(e.touches[0], e.touches[1]);
      const factor = currentDist / touchStartDistRef.current;
      const newScale = Math.min(Math.max(touchStartScaleRef.current * factor, 1), 4);
      setScale(newScale);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && lastTouchPosRef.current && scale > 1) {
      // Handle single finger pan
      const dx = e.touches[0].clientX - lastTouchPosRef.current.x;
      const dy = e.touches[0].clientY - lastTouchPosRef.current.y;
      setPosition((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      lastTouchPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
    lastTouchPosRef.current = null;
    setIsDragging(false);
  };

  // Wheel zoom support for desktop / mouse
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + 0.25, 4));
    } else {
      setScale((prev) => {
        const next = Math.max(prev - 0.25, 1);
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Mouse pan handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    lastTouchPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !lastTouchPosRef.current || scale <= 1) return;
    const dx = e.clientX - lastTouchPosRef.current.x;
    const dy = e.clientY - lastTouchPosRef.current.y;
    setPosition((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy
    }));
    lastTouchPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    lastTouchPosRef.current = null;
  };

  if (!isOpen || !src) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-200 select-none touch-none"
      onClick={onClose}
    >
      <div
        className="relative max-w-full max-h-full flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar */}
        <div className="absolute -top-14 left-0 right-0 flex items-center justify-between px-1 pointer-events-auto">
          {/* Title / Member Name */}
          <div className="truncate text-sm font-semibold text-white/90 drop-shadow-md max-w-[50vw]">
            {title || alt}
          </div>

          {/* Action buttons (Zoom Out, Reset, Zoom In, Close) */}
          <div className="flex items-center gap-1.5 bg-zinc-900/80 backdrop-blur-md px-2 py-1 rounded-full border border-white/15 shadow-xl">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 1}
              aria-label="Zoom Out"
              className="p-1.5 rounded-full hover:bg-white/20 active:scale-95 text-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="text-[11px] font-mono font-bold text-white/90 px-1 min-w-[36px] text-center">
              {Math.round(scale * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= 4}
              aria-label="Zoom In"
              className="p-1.5 rounded-full hover:bg-white/20 active:scale-95 text-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {scale > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                aria-label="Reset Zoom"
                className="p-1.5 rounded-full hover:bg-white/20 active:scale-95 text-white/90 transition-all ml-0.5"
                title="Reset"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="w-[1px] h-4 bg-white/20 mx-0.5" />

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all shadow-md focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Zoomed Image Container */}
        <div
          ref={containerRef}
          className={`overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/90 shadow-2xl max-h-[80vh] max-w-[92vw] flex items-center justify-center relative ${
            scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
          }`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
            className="max-h-[80vh] max-w-[92vw] object-contain select-none rounded-2xl will-change-transform"
          />
        </div>

        {/* Mobile touch hint */}
        <div className="absolute -bottom-7 text-[11px] text-white/60 font-medium tracking-wide">
          {scale > 1
            ? 'حرّك للتنقل • انقر مرتين للرجوع'
            : 'استخدم اصبعين للتكبير (Pinch to zoom)'}
        </div>
      </div>
    </div>
  );
}
