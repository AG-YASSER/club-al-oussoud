import React from 'react';
import { X } from 'lucide-react';

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
  if (!isOpen || !src) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        className="relative max-w-full max-h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-12 right-0 p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all backdrop-blur-md shadow-lg border border-white/10 focus:outline-none"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Title / Member Name */}
        {title && (
          <div className="absolute -top-10 left-0 right-14 truncate text-sm font-semibold text-white/90 drop-shadow-md">
            {title}
          </div>
        )}

        {/* Zoomed Image Container */}
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/80 shadow-2xl max-h-[82vh] max-w-[92vw] flex items-center justify-center">
          <img
            src={src}
            alt={alt}
            className="max-h-[82vh] max-w-[92vw] object-contain select-none rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </div>
  );
}
