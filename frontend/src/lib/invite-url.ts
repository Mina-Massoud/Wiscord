/** Public invite link shown in the share dialog and copied to clipboard. */
export function inviteUrl(code: string): string {
  return `${window.location.origin}/invite/${code}`;
}
