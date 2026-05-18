import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, UserPlus } from 'lucide-react';

import { cn } from '@/lib/cn';
import { getIdenticonDataUrl } from '@/lib/avatar';
import { useCopy } from '@/lib/copy/useCopy';
import { ApiError } from '@/queries/client';
import { useSearchUsers, useSendFriendRequest } from '@/queries/friends';
import { Button } from '@/components/ui/button';
import { MediaImg } from '@/components/ui/media-img';
import { ResultSkeleton } from './AddFriendTabResultSkeleton';

const SEND_ERROR_COPY: Record<string, string> = {
  user_not_found: "Hmm, we couldn't find anyone with that username.",
  cannot_friend_self: "You can't add yourself.",
  already_friends: "You're already friends with this user.",
  request_pending: 'You already have a pending request with this user.',
};

const USERNAME_RE = /^[a-z0-9_]{2,32}$/i;

type FeedbackKind = 'success' | 'accepted' | 'error';

interface Feedback {
  kind: FeedbackKind;
  message: string;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * Add Friend tab — Discord-style submit bar with a live results dropdown
 * underneath. Typing 2+ characters fires a debounced prefix search; matching
 * users render as click-to-send rows so users don't have to type the exact
 * handle. The Enter / button path still works for usernames that don't show
 * up in search (newly-registered users, etc.) — the dropdown is a helper,
 * not a gate.
 *
 * Feedback (success / error) renders inline below the bar in the relevant
 * semantic color. Errors map server codes to friendly copy via
 * `SEND_ERROR_COPY`; unknown codes fall through to the server message.
 */
export function AddFriendTab(): React.JSX.Element {
  const t = useCopy();
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const send = useSendFriendRequest();

  // Strip a leading `@` — the prefix is a UI convention, not part of the
  // username on the wire. Server-side regex rejects `@` so submitting it
  // raw would 400. Same cleanup gates the typeahead, so the user never
  // sees a flash of "invalid input" while they type `@handle`.
  const cleaned = value.trim().toLowerCase().replace(/^@+/, '');
  const isValid = USERNAME_RE.test(cleaned);
  const disabled = !isValid || send.isPending;

  const searchableQuery = isValid ? cleaned : '';
  const debounced = useDebouncedValue(searchableQuery, 200);
  const search = useSearchUsers(debounced);
  const showResults = debounced.length >= 2;
  const results = search.data ?? [];

  function sendTo(username: string): void {
    if (send.isPending) return;
    send.mutate(
      { username },
      {
        onSuccess: (request) => {
          if (request.status === 'accepted') {
            setFeedback({
              kind: 'accepted',
              message: t('friends.add.accepted').replace('{username}', username),
            });
          } else {
            setFeedback({
              kind: 'success',
              message: t('friends.add.success').replace('{username}', username),
            });
          }
          setValue('');
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code in SEND_ERROR_COPY) {
            setFeedback({ kind: 'error', message: SEND_ERROR_COPY[err.code]! });
            return;
          }
          const message = err instanceof ApiError ? err.message : 'Something went wrong.';
          setFeedback({ kind: 'error', message });
        },
      },
    );
  }

  function onSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!isValid) return;
    sendTo(cleaned);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
      {/* Header band: title/subtitle + mascot */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col">
          <h2 className="text-ink text-display font-bold">{t('friends.add.title')}</h2>
          <p className="text-ink-muted text-control mt-1 max-w-md">{t('friends.add.subtitle')}</p>
        </div>
        <img
          src="/logo/sleepy.webp"
          alt=""
          width={120}
          height={120}
          className="size-24 shrink-0 opacity-70 sm:size-28"
          loading="lazy"
          aria-hidden
        />
      </div>

      {/* Inline submit bar */}
      <form
        onSubmit={onSubmit}
        className={cn(
          'bg-glass-surface-2 border-glass-border focus-within:border-blurple mt-5 flex items-center gap-1 rounded-lg border p-1.5 transition-colors',
        )}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (feedback) setFeedback(null);
          }}
          placeholder={t('friends.add.placeholder')}
          aria-label={t('friends.add.placeholder')}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          maxLength={32}
          className="text-ink text-control placeholder:text-ink-subtle flex-1 bg-transparent px-3 py-2 focus:outline-none"
        />
        <Button type="submit" size="sm" disabled={disabled}>
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t('friends.add.cta')}
        </Button>
      </form>

      {/* Inline feedback */}
      {feedback ? (
        <p
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'text-control mt-2',
            feedback.kind === 'error' ? 'text-destructive' : 'text-presence-online',
          )}
        >
          {feedback.message}
        </p>
      ) : null}

      {/* Live results dropdown */}
      {showResults ? (
        <div className="mt-4">
          <h3 className="text-ink-muted text-caption px-1 pb-2 font-semibold tracking-wider uppercase">
            Matches
          </h3>
          <div className="bg-glass-surface-1 border-glass-border flex flex-col rounded-lg border p-1">
            {search.isLoading ? (
              <>
                <ResultSkeleton />
                <ResultSkeleton />
              </>
            ) : search.error ? (
              <p className="text-destructive text-control px-3 py-4">
                Couldn&apos;t search — try again in a sec.
              </p>
            ) : results.length === 0 ? (
              <p className="text-ink-muted text-control px-3 py-4">
                No matches. Double-check the spelling, or hit{' '}
                <span className="text-ink font-medium">{t('friends.add.cta')}</span> to send anyway.
              </p>
            ) : (
              results.map((user) => {
                const displayName = user.displayName ?? user.username;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => sendTo(user.username)}
                    disabled={send.isPending}
                    className="hover:bg-glass-hover focus-visible:bg-glass-hover flex h-[58px] items-center gap-3 rounded-md px-3 text-left transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <MediaImg
                      src={user.avatarUrl ?? undefined}
                      fallbackSrc={getIdenticonDataUrl(user.username)}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 shrink-0 rounded-full"
                      loading="lazy"
                    />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="text-ink text-subhead truncate font-semibold">
                        {displayName}
                      </span>
                      <span className="text-ink-muted text-caption truncate">@{user.username}</span>
                    </span>
                    <span className="text-ink-muted group-hover:text-ink flex shrink-0 items-center gap-1.5">
                      <UserPlus className="size-4" />
                      <span className="text-control font-medium">{t('friends.add.cta')}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
