import { PendingTab } from './PendingTab';
import { AddFriendTab } from './AddFriendTab';
import type { FriendsTab } from './FriendsTopBar';
import { FriendsList } from './FriendsContentFriendsList';

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
