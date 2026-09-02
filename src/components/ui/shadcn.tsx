import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Button
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "orange"
  size?: "default" | "sm" | "lg" | "icon"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const base = "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]"
    const variants = {
      default: "bg-orange-500 text-white shadow hover:bg-orange-600 active:bg-orange-600",
      orange: "bg-orange-500 text-white shadow-md shadow-orange-500/20 hover:bg-orange-600 active:bg-orange-600",
      destructive: "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
      outline: "border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-200",
      secondary: "bg-zinc-800 text-zinc-200 hover:bg-zinc-700",
      ghost: "hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-100",
      link: "text-orange-500 underline-offset-4 hover:underline",
    }
    const sizes = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-11 rounded-md px-8 text-base",
      icon: "h-9 w-9 p-0",
    }
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

// Input
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-sm text-zinc-100 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500 focus-visible:border-orange-500 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"

// Card
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-900/50 text-zinc-100 shadow-sm",
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-4", className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-semibold leading-none tracking-tight text-zinc-100", className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-zinc-400", className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0", className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-4 pt-0", className)} {...props} />
}

// Badge
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "orange" | "green"
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-orange-500 text-white",
    secondary: "border-transparent bg-zinc-800 text-zinc-300",
    destructive: "border-red-500/20 bg-red-500/10 text-red-400",
    outline: "border-zinc-800 text-zinc-300",
    orange: "border-orange-500/20 bg-orange-500/10 text-orange-400",
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  }
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

// Sheet / Drawer Bottom Sheet
export function Sheet({
  isOpen,
  onClose,
  title,
  description,
  children
}: {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
}) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-0 animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-2xl shadow-2xl p-4 flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-3" />
        {(title || description) && (
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
            <div>
              {title && <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>}
              {description && <p className="text-xs text-zinc-400">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

// Avatar
export function Avatar({
  src,
  fallback,
  className
}: {
  src?: string
  fallback: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-800 border border-zinc-700/80 items-center justify-center text-xs font-semibold text-zinc-300",
        className
      )}
    >
      {src ? (
        <img src={src} alt="Avatar" className="aspect-square h-full w-full object-cover" />
      ) : (
        <span>{fallback}</span>
      )}
    </div>
  )
}
