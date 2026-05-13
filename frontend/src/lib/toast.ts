import { useSyncExternalStore } from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'loading';

export interface ToastOptions {
  description?: string;
  duration?: number;
}

export interface ToastRecord {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  closing: boolean;
}

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  error: 5000,
  info: 4000,
  loading: Number.POSITIVE_INFINITY,
};

const CLOSE_ANIMATION_MS = 200;

let toasts: ToastRecord[] = [];
const listeners = new Set<() => void>();
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();
const removeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emit(): void {
  for (const listener of listeners) listener();
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

function clearTimer(map: Map<string, ReturnType<typeof setTimeout>>, id: string): void {
  const t = map.get(id);
  if (t !== undefined) {
    clearTimeout(t);
    map.delete(id);
  }
}

function enqueue(variant: ToastVariant, title: string, options?: ToastOptions): string {
  const id = generateId();
  const record: ToastRecord = {
    id,
    variant,
    title,
    description: options?.description,
    closing: false,
  };
  toasts = [...toasts, record];
  emit();

  const duration = options?.duration ?? DEFAULT_DURATION[variant];
  if (Number.isFinite(duration)) {
    const timer = setTimeout(() => beginClose(id), duration);
    dismissTimers.set(id, timer);
  }

  return id;
}

function beginClose(id: string): void {
  clearTimer(dismissTimers, id);

  const existing = toasts.find((t) => t.id === id);
  if (existing === undefined || existing.closing) return;

  toasts = toasts.map((t) => (t.id === id ? { ...t, closing: true } : t));
  emit();

  const timer = setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    removeTimers.delete(id);
    emit();
  }, CLOSE_ANIMATION_MS);
  removeTimers.set(id, timer);
}

function dismiss(id: string): void {
  beginClose(id);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ToastRecord[] {
  return toasts;
}

export function useToasts(): ToastRecord[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const toast = {
  success: (title: string, options?: ToastOptions): string => enqueue('success', title, options),
  error: (title: string, options?: ToastOptions): string => enqueue('error', title, options),
  info: (title: string, options?: ToastOptions): string => enqueue('info', title, options),
  loading: (title: string, options?: ToastOptions): string => enqueue('loading', title, options),
  dismiss,
};
