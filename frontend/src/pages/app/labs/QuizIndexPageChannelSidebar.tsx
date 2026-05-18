import { Sidebar } from '@/components/ui/sidebar-shell';
import { ListChecks } from 'lucide-react';
import { ChannelRow } from './QuizIndexPageChannelRow';
import type { ChannelGroup } from './QuizIndexPage';

interface ChannelSidebarProps {
  groups: ChannelGroup[];
  isLoading: boolean;
  isError: boolean;
  onSelect: (channelId: string) => void;
}

export function ChannelSidebar({
  groups,
  isLoading,
  isError,
  onSelect,
}: ChannelSidebarProps): React.JSX.Element {
  return (
    <Sidebar.Root>
      <Sidebar.Header
        icon={<ListChecks className="text-ink-muted size-4 shrink-0" aria-hidden />}
        title="Labs · Quiz"
      />

      <Sidebar.Body>
        <Sidebar.Section title="Channels">
          {isLoading && <Sidebar.ListSkeleton rows={3} dotClassName="size-4 rounded" />}

          {isError && <Sidebar.Error>Couldn&apos;t load channels.</Sidebar.Error>}

          {!isLoading && !isError && groups.length === 0 && (
            <Sidebar.Empty>You haven&apos;t hosted any quizzes yet.</Sidebar.Empty>
          )}

          {groups.map((group) => (
            <ChannelRow
              key={group.channelId}
              group={group}
              onSelect={() => onSelect(group.channelId)}
            />
          ))}
        </Sidebar.Section>
      </Sidebar.Body>
    </Sidebar.Root>
  );
}
