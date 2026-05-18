import { useSettingsStore } from '@/lib/settings-store';
import { cn } from '@/lib/cn';
import type { NavGroup } from './SettingsShell';

interface SidebarGroupProps {
  group: NavGroup;
}

export function SidebarGroup({ group }: SidebarGroupProps): React.JSX.Element {
  const activeTab = useSettingsStore((s) => s.activeTab);
  const setTab = useSettingsStore((s) => s.setTab);

  return (
    <div className="mb-4">
      <h3 className="text-ink-subtle text-badge mb-1 px-3 font-bold tracking-wider uppercase">
        {group.label}
      </h3>
      <ul className="flex flex-col">
        {group.items.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => setTab(item.key)}
                className={cn(
                  'text-control w-full rounded-md px-3 py-1.5 text-left transition-colors',
                  isActive
                    ? 'bg-glass-active text-ink'
                    : 'text-ink-muted hover:bg-glass-hover hover:text-ink',
                )}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
