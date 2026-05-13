import { cn } from '@/lib/cn';

interface AuthLayoutProps {
  children: React.ReactNode;
  subtitle?: string;
  /**
   * Card width. 'default' = 440px (single column), 'wide' = 760px (two-column layouts).
   * Width transitions smoothly so steps that need more room can expand in place.
   */
  size?: 'default' | 'wide';
}

const sizeClass = {
  default: 'max-w-[440px]',
  wide: 'max-w-[760px]',
} as const;

export default function AuthLayout({
  children,
  subtitle,
  size = 'default',
}: AuthLayoutProps): React.JSX.Element {
  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Wallpaper */}
      <img
        src="/background/auth-bg.webp"
        alt=""
        aria-hidden="true"
        loading="eager"
        fetchPriority="high"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      {/* Scrim — keeps the card legible regardless of wallpaper contrast */}
      {/* <div aria-hidden="true" className="bg-background/70 pointer-events-none absolute inset-0" /> */}

      <div
        className={cn(
          'border-border bg-card/85 shadow-modal relative w-full rounded-md border p-8 backdrop-blur-md',
          'ease-wiscord transition-[max-width] duration-[350ms]',
          sizeClass[size],
        )}
      >
        {/* Lockup */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <img
            src="/logo/logo-text.webp"
            alt="Wiscord"
            width={1066}
            height={313}
            className="h-10 w-auto select-none"
            draggable={false}
          />
          {subtitle && <p className="text-muted-foreground text-center text-sm">{subtitle}</p>}
        </div>

        {children}
      </div>
    </div>
  );
}
