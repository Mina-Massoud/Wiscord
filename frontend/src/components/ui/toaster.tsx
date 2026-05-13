import { useEffect, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { toast, useToasts, type ToastRecord, type ToastVariant } from '@/lib/toast';

interface VariantStyle {
  stripe: string;
  icon: string;
  Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const VARIANT_STYLES: Record<ToastVariant, VariantStyle> = {
  success: { stripe: 'bg-success', icon: 'text-success', Icon: CheckCircle2 },
  error: { stripe: 'bg-destructive', icon: 'text-destructive', Icon: AlertCircle },
  info: { stripe: 'bg-blurple', icon: 'text-blurple', Icon: Info },
  loading: { stripe: 'bg-ink-muted', icon: 'text-ink-muted', Icon: Loader2 },
};

interface ToastItemProps {
  record: ToastRecord;
}

function ToastItem({ record }: ToastItemProps): React.JSX.Element {
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => setOpened(true));
    return () => cancelAnimationFrame(rafId);
  }, []);

  const variant = VARIANT_STYLES[record.variant];
  const state = !opened || record.closing ? 'closed' : 'open';
  const liveness = record.variant === 'error' ? 'assertive' : 'polite';

  function handleClose(): void {
    toast.dismiss(record.id);
  }

  return (
    <li
      role="status"
      aria-live={liveness}
      data-state={state}
      className={cn(
        'group pointer-events-auto relative flex w-[360px] max-w-full items-start gap-2.5 overflow-hidden',
        'border-border bg-surface-2 text-ink shadow-modal rounded-md border px-3 py-2.5',
        'duration-base ease-wiscord transition-[transform,opacity] motion-reduce:transition-none',
        'data-[state=closed]:translate-x-[110%] data-[state=closed]:opacity-0',
        'data-[state=open]:translate-x-0 data-[state=open]:opacity-100',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('absolute top-0 left-0 h-full w-[2px]', variant.stripe)}
      />
      <variant.Icon
        aria-hidden={true}
        className={cn(
          'mt-px h-4 w-4 shrink-0',
          variant.icon,
          record.variant === 'loading' && 'animate-spin motion-reduce:animate-none',
        )}
      />
      <div className="min-w-0 flex-1 pr-5">
        <p className="text-ink text-[13px] leading-5 font-medium">{record.title}</p>
        {record.description !== undefined ? (
          <p className="text-ink-muted mt-0.5 text-[12px] leading-4">{record.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Dismiss notification"
        className={cn(
          'absolute top-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-sm',
          'text-ink-muted duration-fast ease-wiscord opacity-0 transition-[color,background-color,opacity]',
          'hover:bg-surface-3 hover:text-ink',
          'focus-visible:ring-ring focus-visible:opacity-100 focus-visible:ring-1 focus-visible:outline-none',
          'group-hover:opacity-100',
          'motion-reduce:transition-none',
        )}
      >
        <X className="h-3 w-3" aria-hidden={true} />
      </button>
    </li>
  );
}

const PORTAL_ID = 'wiscord-toaster-root';

export function Toaster(): React.JSX.Element | null {
  const records = useToasts();
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let el = document.getElementById(PORTAL_ID);
    let created = false;
    if (el === null) {
      el = document.createElement('div');
      el.id = PORTAL_ID;
      document.body.appendChild(el);
      created = true;
    }
    setContainer(el);
    return () => {
      if (created && el?.parentNode !== null && el?.parentNode !== undefined) {
        el.parentNode.removeChild(el);
      }
    };
  }, []);

  if (container === null) return null;

  return createPortal(
    <ol
      aria-label="Notifications"
      className="pointer-events-none fixed top-4 right-4 z-[100] flex w-full max-w-[360px] flex-col gap-2 outline-none"
    >
      {records.map((record) => (
        <ToastItem key={record.id} record={record} />
      ))}
    </ol>,
    container,
  );
}
