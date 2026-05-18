interface UsernameHintProps {
  draft: string;
  isSame: boolean;
  valid: boolean;
  isChecking: boolean;
  isAvailable: boolean | null;
}

export function UsernameHint({
  draft,
  isSame,
  valid,
  isChecking,
  isAvailable,
}: UsernameHintProps): React.JSX.Element {
  if (draft.length < 2) return <span className="text-ink-muted">2–32 letters, numbers, or _</span>;
  if (!valid)
    return <span className="text-destructive">Letters, numbers, and underscores only.</span>;
  if (isSame) return <span className="text-ink-muted">That&apos;s your current username.</span>;
  if (isChecking) return <span className="text-ink-muted">Checking…</span>;
  if (isAvailable === false) return <span className="text-destructive">Already taken.</span>;
  if (isAvailable === true) return <span className="text-presence-online">Available.</span>;
  return <span className="text-ink-muted">&nbsp;</span>;
}
