import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'neon' | 'glass';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}) {
  const base = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] select-none";
  
  const variants = {
    default: "bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)]",
    neon: "bg-emerald-400 text-zinc-950 font-bold hover:bg-emerald-300 shadow-[0_0_25px_rgba(52,211,153,0.4)] hover:shadow-[0_0_35px_rgba(52,211,153,0.6)]",
    glass: "bg-zinc-900/70 border border-zinc-750 backdrop-blur-md text-zinc-200 hover:bg-zinc-800/80 hover:text-white hover:border-zinc-600 shadow-sm",
    outline: "border border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-300 hover:text-white hover:border-zinc-700",
    secondary: "bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700/80 hover:text-white border border-zinc-700/50",
    ghost: "text-zinc-400 hover:bg-zinc-850 hover:text-zinc-100",
    destructive: "bg-rose-600/90 text-white hover:bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
  };

  const sizes = {
    default: "h-10 px-4 py-2 text-sm",
    sm: "h-8 px-3 text-xs rounded-lg",
    lg: "h-12 px-6 text-base rounded-xl font-semibold",
    icon: "h-10 w-10 p-0"
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/80 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-800/80 bg-zinc-900/60 shadow-xl backdrop-blur-xl text-zinc-100",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col space-y-1.5 p-6 border-b border-zinc-800/60", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-lg font-bold leading-none tracking-tight text-white", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-zinc-400 font-normal leading-relaxed", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-6", className)} {...props}>
      {children}
    </div>
  );
}

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'active' | 'expiring' | 'expired' | 'unpaid' | 'secondary' | 'outline';
}) {
  const variants = {
    default: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ring-1 ring-emerald-500/20",
    active: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ring-1 ring-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
    expiring: "bg-amber-500/10 text-amber-400 border border-amber-500/30 ring-1 ring-amber-500/20 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.2)]",
    expired: "bg-rose-500/10 text-rose-400 border border-rose-500/30 ring-1 ring-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.2)]",
    unpaid: "bg-orange-500/10 text-orange-400 border border-orange-500/30 ring-1 ring-orange-500/20 shadow-[0_0_12px_rgba(249,115,22,0.2)]",
    secondary: "bg-zinc-800/80 text-zinc-300 border border-zinc-700/60",
    outline: "border border-zinc-800 text-zinc-400"
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
