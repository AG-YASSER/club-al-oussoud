import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setFade(true);
    }, 2000);

    const timer2 = setTimeout(() => {
      onComplete();
    }, 2400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between bg-[var(--background)] transition-opacity duration-500 select-none px-4 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] h-full min-h-[100dvh] w-full ${
        fade ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Top spacer for perfect vertical centering */}
      <div className="w-full h-4" />

      {/* Main Center Brand Content */}
      <div className="relative flex flex-col items-center animate-in zoom-in-95 duration-500 w-full max-w-xs text-center">
        {/* Glowing aura behind the logo */}
        <div className="absolute w-64 h-64 rounded-full bg-orange-500/20 blur-3xl animate-pulse pointer-events-none -top-6" />

        {/* Large, Clear Official Logo */}
        <div className="relative mb-5 transform transition-transform hover:scale-105 duration-300">
          <img
            src="/logo.png"
            alt="Club Al Oussoud"
            className="w-44 h-44 sm:w-56 sm:h-56 object-contain drop-shadow-[0_10px_35px_rgba(249,115,22,0.4)]"
          />
        </div>

        {/* Brand Name */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2 leading-none">
          CLUB <span className="text-orange-500">AL OUSSOUD</span>
        </h1>
        <p className="text-xs font-semibold tracking-widest text-zinc-400 uppercase mt-2">
          Lions Gym & Fitness Club
        </p>

        {/* Modern Animated Loading Bar */}
        <div className="w-40 h-1.5 bg-zinc-800/80 rounded-full mt-7 overflow-hidden border border-zinc-700/50 shadow-inner">
          <div className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 rounded-full animate-[shimmer_1.5s_infinite] w-full" />
        </div>
      </div>

      {/* Subtle Copyright Footer at the very bottom */}
      <div className="text-center pb-2">
        <p className="text-[10px] font-medium tracking-wide text-zinc-500 select-none">
          Tous droits réservés © {new Date().getFullYear()} • <span className="text-zinc-400">Yasser Latrech</span>
        </p>
      </div>
    </div>
  );
}
