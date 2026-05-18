import { SidebarRowShell } from './LabsChannelSidebarSidebarRowShell';

interface OptimisticMeRowProps {
  identity: string;
  displayName: string;
}

/**
 * Ghost row rendered between the moment the user clicks Join and the
 * moment they show up in the server-side presence sweep (or LiveKit
 * reports Connected). Same shell, same avatar, lower opacity — gives the
 * feeling that the click landed without waiting on the round-trip.
 */
export function OptimisticMeRow({ identity, displayName }: OptimisticMeRowProps) {
  return (
    <SidebarRowShell seed={identity || displayName} dimmed>
      <span className="text-ink-muted text-control min-w-0 flex-1 truncate">
        {displayName}
        <span className="ml-1 opacity-60">· you</span>
      </span>
    </SidebarRowShell>
  );
}
