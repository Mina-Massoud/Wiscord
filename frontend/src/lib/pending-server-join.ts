const STORAGE_KEY = 'wiscord_pending_server_join';

/** After redeeming an invite before onboarding, resume into this server. */
export function setPendingServerJoin(serverId: string): void {
  sessionStorage.setItem(STORAGE_KEY, serverId);
}

export function consumePendingServerJoin(): string | null {
  const value = sessionStorage.getItem(STORAGE_KEY);
  if (value) sessionStorage.removeItem(STORAGE_KEY);
  return value;
}
