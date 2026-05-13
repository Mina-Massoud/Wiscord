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
    <div className="bg-canvas relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Wallpaper */}
      <img
        src="/background/auth-bg.webp"
        alt=""
        aria-hidden="true"
        loading="eager"
        fetchPriority="high"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />

      {/* Veil — dark wash over the photo so glass surfaces read regardless of
          local luminance. Sits between the photo and the card. */}
      <div aria-hidden="true" className="bg-glass-veil pointer-events-none absolute inset-0" />

      <div
        className={cn(
          'bg-glass-shell shadow-glass backdrop-blur-glass border-glass-border relative w-full rounded-xl border p-8',
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
          {subtitle && <p className="text-ink-muted text-center text-sm">{subtitle}</p>}
        </div>

        {children}
      </div>
    </div>
  );
}
