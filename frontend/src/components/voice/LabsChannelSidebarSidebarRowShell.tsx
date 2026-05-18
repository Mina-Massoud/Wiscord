import { cn } from '@/lib/cn';
import { getIdenticonDataUrl } from '@/lib/avatar';

interface SidebarRowShellProps {
  seed: string;
  isSpeaking?: boolean;
  dimmed?: boolean;
  children: React.ReactNode;
}

export function SidebarRowShell({
  seed,
  isSpeaking = false,
  dimmed = false,
  children,
}: SidebarRowShellProps) {
  return (
    <li
      className={cn(
        'hover:bg-glass-hover duration-base compact:gap-2 compact:py-0.5 spacious:gap-3 spacious:py-2.5 flex items-center gap-3 rounded-md px-2 py-1.5 transition-[opacity,background-color]',
        dimmed ? 'opacity-50' : 'opacity-100',
      )}
    >
      <img
        src={getIdenticonDataUrl(seed, 64)}
        alt=""
        width={24}
        height={24}
        className={cn(
          'duration-base size-6 shrink-0 rounded-full transition-shadow',
          isSpeaking && 'ring-success ring-2 ring-offset-0',
        )}
        aria-hidden
      />
      {children}
    </li>
  );
}
