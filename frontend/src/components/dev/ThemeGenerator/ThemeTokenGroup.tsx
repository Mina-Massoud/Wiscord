import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/cn';

import { ThemeColorRow } from './ThemeColorRow';
import type { ThemeOverrides } from './theme-css-emitter';
import type { ThemeToken, TokenGroup } from './theme-tokens';

interface ThemeTokenGroupProps {
  group: TokenGroup;
  tokens: ThemeToken[];
  overrides: ThemeOverrides;
  isOverridden: (id: string) => boolean;
  onChange: (id: string, value: string) => void;
  onReset: (id: string) => void;
  defaultOpen?: boolean;
}

export function ThemeTokenGroup({
  group,
  tokens,
  overrides,
  isOverridden,
  onChange,
  onReset,
  defaultOpen = false,
}: ThemeTokenGroupProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const overriddenCount = tokens.reduce(
    (acc, token) => (isOverridden(token.id) ? acc + 1 : acc),
    0,
  );

  return (
    <section className="border-glass-border border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left',
          'hover:bg-glass-hover transition-colors',
        )}
        aria-expanded={isOpen}
      >
        <div className="flex flex-col">
          <span className="text-control text-ink font-medium">{group.label}</span>
          <span className="text-badge text-ink-subtle">{group.description}</span>
        </div>
        <div className="flex items-center gap-2">
          {overriddenCount > 0 && (
            <span className="text-badge bg-blurple/20 text-blurple rounded-pill px-2 py-0.5 font-mono">
              {overriddenCount}
            </span>
          )}
          <ChevronDown
            className={cn('text-ink-muted size-4 transition-transform', isOpen && 'rotate-180')}
          />
        </div>
      </button>
      {isOpen && (
        <div className="px-3 pb-2">
          {tokens.map((token) => (
            <ThemeColorRow
              key={token.id}
              token={token}
              currentValue={overrides[token.id] ?? token.defaultValue}
              isOverridden={isOverridden(token.id)}
              onChange={(value) => onChange(token.id, value)}
              onReset={() => onReset(token.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
