import { Users, MessageSquarePlus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCopy } from '@/lib/copy/useCopy';
import type { CopyKey } from '@/lib/copy/registry';

export type FriendsTab = 'online' | 'all' | 'suggestions' | 'add';

interface FriendsTopBarProps {
  activeTab: FriendsTab;
  suggestionsCount?: number;
  onTabChange: (tab: FriendsTab) => void;
}

const TABS: Array<{ key: Exclude<FriendsTab, 'add'>; copyKey: CopyKey }> = [
  { key: 'online', copyKey: 'friends.tab.online' },
  { key: 'all', copyKey: 'friends.tab.all' },
  { key: 'suggestions', copyKey: 'friends.tab.suggestions' },
];

/**
 * Top bar that spans the main pane + the Active Now rail.
 * Left: section label + tab strip + primary "Add Friend" CTA.
 * Right: a single "new message" affordance pinned to the rail edge.
 */
export function FriendsTopBar({
  activeTab,
  suggestionsCount,
  onTabChange,
}: FriendsTopBarProps): React.JSX.Element {
  const t = useCopy();

  return (
    <header className="border-b-glass-border flex h-12 shrink-0 items-center gap-4 border-b px-4">
      <div className="text-ink flex items-center gap-2">
        <Users className="text-ink-muted size-5" />
        <span className="text-subhead font-semibold">{t('friends.title')}</span>
      </div>

      <span aria-hidden className="bg-glass-border h-5 w-px" />

      <nav aria-label="Friends tabs" className="flex items-center gap-0.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'text-tab flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-glass-active text-ink'
                : 'text-ink-muted hover:bg-glass-hover hover:text-ink',
            )}
          >
            <span>{t(tab.copyKey)}</span>
            {tab.key === 'suggestions' && suggestionsCount ? (
              <span className="bg-destructive text-badge inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-bold text-white">
                {suggestionsCount > 99 ? '99+' : suggestionsCount}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => onTabChange('add')}
        className={cn(
          'text-control rounded-md px-3 py-1 font-medium transition-colors',
          'bg-blurple hover:bg-blurple-hover text-white',
        )}
      >
        {t('friends.add')}
      </button>

      <button
        type="button"
        aria-label="New message"
        onClick={(e) => e.preventDefault()}
        className="text-ink-muted hover:text-ink ml-auto"
      >
        <MessageSquarePlus className="size-5" />
      </button>
    </header>
  );
}
