import { useCopy } from '@/lib/copy/useCopy';
import { useMemo, useState } from 'react';
import { useFriends } from '@/queries/friends';
import type { FriendDto } from '@/queries/client';
import { Info, Search, X } from 'lucide-react';
import { AnnouncementBanner } from './showcase/AnnouncementBanner';
import { fakeFriendsAnnouncement } from '@/data/fake-active-now';
import { FriendsEmptyState } from './FriendsEmptyState';
import { FriendRow } from './FriendRow';
import type { FriendsTab } from './FriendsTopBar';
import { RowsSkeleton } from './FriendsContentRowsSkeleton';
import { SearchEmpty } from './FriendsContentSearchEmpty';

interface FriendsListProps {
  activeTab: 'online' | 'all';
  onTabChange: (tab: FriendsTab) => void;
}

export function FriendsList({ activeTab, onTabChange }: FriendsListProps): React.JSX.Element {
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
