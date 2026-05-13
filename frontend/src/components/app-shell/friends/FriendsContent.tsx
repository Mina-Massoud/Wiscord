import { useMemo, useState } from 'react';
import { Info, Search, X } from 'lucide-react';
import { fakeFriends } from '@/data/fake-shell';
import { fakeFriendsAnnouncement, fakeFriendsTips } from '@/data/fake-active-now';
import { FriendRow } from './FriendRow';
import { AnnouncementBanner } from './showcase/AnnouncementBanner';
import { TipChips } from './showcase/TipChips';
import type { FriendsTab } from './FriendsTopBar';

interface FriendsContentProps {
  activeTab: FriendsTab;
}

/**
 * Main content pane of the friends view.
 * Tab state is owned by the page (so `FriendsTopBar` can sit in the shell's spanning top bar).
 * Owns the local banner-dismiss + search filter. Static — no backend reads.
 */
export function FriendsContent({ activeTab }: FriendsContentProps): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base =
      activeTab === 'online'
        ? fakeFriends.filter((f) => f.user.presence === 'online')
        : activeTab === 'all'
          ? fakeFriends
          : [];
    if (!term) return base;
    return base.filter(
      (f) =>
        f.user.displayName.toLowerCase().includes(term) ||
        f.user.username.toLowerCase().includes(term),
    );
  }, [activeTab, search]);

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

      {activeTab === 'online' || activeTab === 'all' ? (
        <div className="px-4 pt-3">
          <AnnouncementBanner announcement={fakeFriendsAnnouncement} />
        </div>
      ) : null}

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
        {visible.length === 0 ? (
          <p className="text-ink-muted text-control px-4 py-8">No one matches that search.</p>
        ) : (
          visible.map((friend) => <FriendRow key={friend.user.id} friend={friend} />)
        )}
      </div>

      {activeTab === 'online' || activeTab === 'all' ? (
        <div className="mt-6 px-4 pb-6">
          <TipChips tips={fakeFriendsTips} />
        </div>
      ) : null}
    </div>
  );
}
