import { useState } from 'react';
import { Calendar, Search } from 'lucide-react';
import { EventCard } from './EventCard';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { EventWithMeta } from '@/types/event';

interface EventListProps {
  events: EventWithMeta[];
  serverId: string;
  currentUserId: string | undefined;
  serverOwnerId: string | undefined;
  onEdit: (event: EventWithMeta) => void;
  onDelete: (event: EventWithMeta) => void;
}

export function EventList({
  events,
  serverId,
  currentUserId,
  serverOwnerId,
  onEdit,
  onDelete,
}: EventListProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');

  const now = new Date();

  // Filter events by tab
  const tabFilteredEvents = events.filter((event) => {
    const isPast = new Date(event.startsAt) < now && event.status !== 'active';
    if (activeTab === 'upcoming') {
      return !isPast;
    } else {
      return isPast;
    }
  });

  // Filter by search query
  const searchedEvents = tabFilteredEvents.filter((event) => {
    const matchTitle = event.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchDesc = event.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
    return matchTitle || matchDesc;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Search & Tabs Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'upcoming' | 'past')}
          className="w-full sm:w-auto"
        >
          <TabsList className="bg-glass-surface-1 border-glass-border border">
            <TabsTrigger value="upcoming" className="text-control px-4">
              Upcoming ({events.filter((e) => !(new Date(e.startsAt) < now && e.status !== 'active')).length})
            </TabsTrigger>
            <TabsTrigger value="past" className="text-control px-4">
              Past ({events.filter((e) => new Date(e.startsAt) < now && e.status !== 'active').length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search bar */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-ink-muted absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-glass-surface-1 border-glass-border pl-9 pr-4 text-control"
          />
        </div>
      </div>

      {/* Grid List */}
      {searchedEvents.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {searchedEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              serverId={serverId}
              currentUserId={currentUserId}
              serverOwnerId={serverOwnerId}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="border-glass-border bg-glass-surface-1 flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 px-4 text-center">
          <div className="bg-blurple/10 border-blurple/20 flex size-12 items-center justify-center rounded-2xl border text-blurple">
            <Calendar className="size-6" />
          </div>
          <h3 className="text-body mt-4 font-semibold text-ink">
            {searchQuery
              ? 'No matching events found'
              : activeTab === 'upcoming'
                ? 'No upcoming events scheduled'
                : 'No past events found'}
          </h3>
          <p className="text-caption text-ink-muted mt-2 max-w-sm">
            {searchQuery
              ? 'Try refining your search keywords or check spelling.'
              : activeTab === 'upcoming'
                ? 'Keep your community active by scheduling study groups, game nights, or audio hangouts!'
                : 'Any finished or expired events will show up here.'}
          </p>
        </div>
      )}
    </div>
  );
}
