import { useMemo, useState } from 'react';
import { Info, Search, X } from 'lucide-react';

import { fakeFriendsAnnouncement } from '@/data/fake-active-now';
import { useCopy } from '@/lib/copy/useCopy';
import { useFriends } from '@/queries/friends';
import type { FriendDto } from '@/queries/client';
import { Skeleton } from '@/components/ui/skeleton';
import { FriendRow } from './FriendRow';
import { FriendsEmptyState } from './FriendsEmptyState';
import { PendingTab } from './PendingTab';
import { AddFriendTab } from './AddFriendTab';
import { AnnouncementBanner } from './showcase/AnnouncementBanner';
import type { FriendsTab } from './FriendsTopBar';

interface FriendsContentProps {
  activeTab: FriendsTab;
  onTabChange: (tab: FriendsTab) => void;
}

/**
 * Main content pane of the friends view. Dispatches to the right tab
 * surface — online/all share a list filtered by presence (not wired in
 * this slice; online tab will be empty until per-user presence ships).
 */
export function FriendsContent({ activeTab, onTabChange }: FriendsContentProps): React.JSX.Element {
  if (activeTab === 'pending') return <PendingTab />;
  if (activeTab === 'add') return <AddFriendTab />;
  return <FriendsList activeTab={activeTab} onTabChange={onTabChange} />;
}

interface FriendsListProps {
  activeTab: 'online' | 'all';
  onTabChange: (tab: FriendsTab) => void;
}

function FriendsList({ activeTab, onTabChange }: FriendsListProps): React.JSX.Element {
  const t = useCopy();
  const [search, setSearch] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const friendsQuery = useFriends();
  const friends = useMemo(() => friendsQuery.data ?? [], [friendsQuery.data]);

  // Online tab is presence-gated. We don't have per-user presence yet, so
  // the filter passes through nothing — the empty state explains why.
  const baseRows: FriendDto[] = activeTab === 'online' ? [] : friends;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return baseRows;
    return baseRows.filter((f) => {
      const name = (f.user.displayName ?? '').toLowerCase();
      return name.includes(term) || f.user.username.toLowerCase().includes(term);
    });
  }, [baseRows, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {!bannerDismissed ? (
        <div className="text-control flex items-center gap-3 px-4 pt-3">
          <Info className="text-ink-muted size-4 shrink-0" />
          <p className="text-ink-muted flex-1">
            Looking for accounts you&apos;ve blocked or ignored?{' '}
            <button type="button" className="text-blurple hover:underline">
              Go to settings
            </button>
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setBannerDismissed(true)}
            className="text-ink-muted hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="px-4 pt-3">
        <AnnouncementBanner announcement={fakeFriendsAnnouncement} />
      </div>

      <div className="px-4 pt-3">
        <div className="relative">
          <Search className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="bg-glass-surface-2 border-glass-border text-ink text-control placeholder:text-ink-subtle focus:border-blurple h-10 w-full rounded-md border pr-3 pl-9 focus:outline-none"
          />
        </div>
      </div>

      <h2 className="text-ink-muted text-caption mt-5 px-4 font-semibold tracking-wider uppercase">
        {activeTab === 'online' ? 'Focusing now' : 'All study buddies'} — {visible.length}
      </h2>

      <div className="cv-auto mt-2 flex flex-col">
        {friendsQuery.isLoading ? (
          <RowsSkeleton />
        ) : friendsQuery.error ? (
          <p className="text-destructive text-control px-4 py-8">
            Couldn&apos;t load your friends. Try again in a sec.
          </p>
        ) : visible.length === 0 ? (
          search ? (
            <SearchEmpty />
          ) : (
            <FriendsEmptyState
              title={
                activeTab === 'online'
                  ? t('friends.empty.online.title')
                  : t('friends.empty.all.title')
              }
              body={
                activeTab === 'online'
                  ? t('friends.empty.online.body')
                  : t('friends.empty.all.body')
              }
              ctaLabel={activeTab === 'all' ? t('friends.empty.cta') : undefined}
              onCtaClick={activeTab === 'all' ? () => onTabChange('add') : undefined}
            />
          )
        ) : (
          visible.map((friend) => <FriendRow key={friend.user.id} friend={friend} />)
        )}
      </div>
    </div>
  );
}

function RowsSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 px-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex h-[62px] items-center gap-3 px-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchEmpty(): React.JSX.Element {
  return (
    <div className="px-4 py-8">
      <p className="text-ink text-control font-medium">No one matches that search.</p>
    </div>
  );
}
