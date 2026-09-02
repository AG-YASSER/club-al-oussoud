import React from 'react';

interface LionLogoProps {
  size?: number;
  className?: string;
  primaryColor?: string;
}

export function LionLogo({ size = 44, className = '' }: LionLogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Club Al Oussoud Logo"
      width={size}
      height={size}
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`object-contain drop-shadow-[0_2px_12px_rgba(249,115,22,0.35)] shrink-0 transition-transform active:scale-95 ${className}`}
    />
  );
}
