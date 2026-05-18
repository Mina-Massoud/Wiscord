import { useState } from 'react';
import { Check, X } from 'lucide-react';

import { getIdenticonDataUrl } from '@/lib/avatar';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateProfile, useUsernameAvailable } from '@/queries/profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MediaImg } from '@/components/ui/media-img';
import type { VoiceStyle } from '@/types/auth';
import { SettingsDivider, SettingsPanelTitle, SettingsSection } from '../SettingsShell';

const USERNAME_RE = /^[a-z0-9_]{2,32}$/i;

/**
 * My Account — identity card + inline-edit rows for the three core fields
 * the backend supports today (Display Name, Username, Email read-only). The
 * Wiscord-specific Gen Z voice radio lives at the bottom under its own
 * "Voice" subsection.
 *
 * Each row collapses back to read-only after a successful PATCH; cancelling
 * discards local edits. Username editing checks availability via the
 * existing `useUsernameAvailable` probe so the user can't submit a taken
 * handle and bounce off the server.
 */
export function MyAccountPanel(): React.JSX.Element {
  const { profile } = useAuth();
  if (!profile) return <SettingsPanelTitle>My Account</SettingsPanelTitle>;

  const seed = profile.username ?? profile.email;
  const avatarSrc = profile.avatar_url ?? getIdenticonDataUrl(seed);
  const displayName = profile.display_name ?? profile.username;

  return (
    <div>
      <SettingsPanelTitle>My Account</SettingsPanelTitle>

      {/* Identity card — banner strip + avatar + name. Discord-style flat
          surface, no border; relies on a subtle bg lift to separate it from
          the canvas. */}
      <div className="bg-surface-1 mt-6 overflow-hidden rounded-lg">
        <div className="bg-blurple/40 h-20" aria-hidden />
        <div className="flex items-center gap-4 px-5 pt-3 pb-4">
          <MediaImg
            src={avatarSrc}
            alt=""
            width={72}
            height={72}
            className="ring-surface-1 -mt-10 size-[72px] shrink-0 rounded-full ring-4"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-ink text-subhead truncate font-semibold">{displayName}</span>
            <span className="text-ink-muted text-caption truncate">@{profile.username}</span>
          </div>
        </div>

        <div className="flex flex-col px-5 pb-2">
          <DisplayNameRow current={profile.display_name} fallback={profile.username} />
          <UsernameRow current={profile.username} />
          <EmailRow email={profile.email} />
        </div>
      </div>

      <SettingsDivider />

      <SettingsSection
        title="Voice"
        description="Pick how Wiscord talks to you — toasts, empty states, and tab labels adapt."
      >
        <VoiceStyleRadio current={profile.voice_style} />
      </SettingsSection>
    </div>
  );
}

// ── Reusable inline-edit row ──────────────────────────────────────────────

interface EditableRowProps {
  label: string;
  /** What to render in read-only mode. */
  display: React.ReactNode;
  /** When provided, "Edit" toggles to the edit form rendered by the caller. */
  renderEdit?: (props: { onDone: () => void }) => React.ReactNode;
  /** Extra trailing action (e.g. "Remove" next to "Edit"). */
  trailing?: React.ReactNode;
}

function EditableRow({
  label,
  display,
  renderEdit,
  trailing,
}: EditableRowProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-col gap-2 border-b border-white/5 py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-ink-muted text-caption font-semibold tracking-wider uppercase">
            {label}
          </span>
          {!editing ? <div className="text-ink text-control mt-1">{display}</div> : null}
        </div>
        {!editing ? (
          <div className="flex items-center gap-2">
            {trailing}
            {renderEdit ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-ink-muted hover:bg-glass-hover text-control rounded-md bg-white/5 px-3 py-1 font-medium transition-colors hover:text-white"
              >
                Edit
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {editing && renderEdit ? (
        <div className="mt-1">{renderEdit({ onDone: () => setEditing(false) })}</div>
      ) : null}
    </div>
  );
}

// ── Field-specific rows ───────────────────────────────────────────────────

interface DisplayNameRowProps {
  current: string | null;
  fallback: string;
}

function DisplayNameRow({ current, fallback }: DisplayNameRowProps): React.JSX.Element {
  const update = useUpdateProfile();

  return (
    <EditableRow
      label="Display name"
      display={current ?? <span className="text-ink-muted">{fallback}</span>}
      renderEdit={({ onDone }) => (
        <InlineTextEdit
          initial={current ?? ''}
          maxLength={64}
          placeholder="Pick a display name"
          submitting={update.isPending}
          onCancel={onDone}
          onSubmit={(value) => {
            const trimmed = value.trim();
            update.mutate(
              { display_name: trimmed.length === 0 ? null : trimmed },
              {
                onSuccess: () => {
                  toast.success('Display name updated.');
                  onDone();
                },
                onError: () => toast.error("Couldn't save. Try again?"),
              },
            );
          }}
        />
      )}
    />
  );
}

interface UsernameRowProps {
  current: string;
}

function UsernameRow({ current }: UsernameRowProps): React.JSX.Element {
  const update = useUpdateProfile();
  const [draft, setDraft] = useState(current);
  const { isChecking, isAvailable } = useUsernameAvailable(draft === current ? '' : draft);
  const valid = USERNAME_RE.test(draft);
  const isSame = draft === current;
  const canSubmit = valid && !isSame && !isChecking && isAvailable !== false && !update.isPending;

  return (
    <EditableRow
      label="Username"
      display={<span>@{current}</span>}
      renderEdit={({ onDone }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            update.mutate(
              { username: draft },
              {
                onSuccess: () => {
                  toast.success('Username updated.');
                  onDone();
                },
                onError: (err) => toast.error(err.message ?? "Couldn't save. Try again?"),
              },
            );
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={32}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={!canSubmit}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(current);
                onDone();
              }}
            >
              Cancel
            </Button>
          </div>
          <p className="text-caption">
            <UsernameHint
              draft={draft}
              isSame={isSame}
              valid={valid}
              isChecking={isChecking}
              isAvailable={isAvailable}
            />
          </p>
        </form>
      )}
    />
  );
}

interface UsernameHintProps {
  draft: string;
  isSame: boolean;
  valid: boolean;
  isChecking: boolean;
  isAvailable: boolean | null;
}

function UsernameHint({
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

interface EmailRowProps {
  email: string;
}

function EmailRow({ email }: EmailRowProps): React.JSX.Element {
  const [revealed, setRevealed] = useState(false);
  const masked = maskEmail(email);
  return (
    <EditableRow
      label="Email"
      display={
        <span>
          {revealed ? email : masked}{' '}
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="text-blurple hover:underline"
          >
            {revealed ? 'Hide' : 'Reveal'}
          </button>
        </span>
      }
    />
  );
}

function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${'•'.repeat(Math.max(local.length, 4))}@${domain}`;
}

// ── Inline text edit ──────────────────────────────────────────────────────

interface InlineTextEditProps {
  initial: string;
  maxLength: number;
  placeholder?: string;
  submitting: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

function InlineTextEdit({
  initial,
  maxLength,
  placeholder,
  submitting,
  onSubmit,
  onCancel,
}: InlineTextEditProps): React.JSX.Element {
  const [value, setValue] = useState(initial);
  const dirty = value !== initial;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!dirty || submitting) return;
        onSubmit(value);
      }}
      className="flex items-center gap-2"
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        autoFocus
        autoComplete="off"
        className="flex-1"
      />
      <Button type="submit" size="icon" disabled={!dirty || submitting} aria-label="Save">
        <Check className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onCancel}
        disabled={submitting}
        aria-label="Cancel"
      >
        <X className="size-4" />
      </Button>
    </form>
  );
}

// ── Voice style radio ─────────────────────────────────────────────────────

interface VoiceStyleRadioProps {
  current: VoiceStyle;
}

function VoiceStyleRadio({ current }: VoiceStyleRadioProps): React.JSX.Element {
  const update = useUpdateProfile();

  function set(value: VoiceStyle): void {
    if (value === current) return;
    update.mutate(
      { voice_style: value },
      {
        onError: () => toast.error("Couldn't save your voice. Try again?"),
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <VoiceRadioOption
        active={current === 'default'}
        onClick={() => set('default')}
        title="Default"
        body="Friends. Pending. Add Friend. Standard product copy."
      />
      <VoiceRadioOption
        active={current === 'genz'}
        onClick={() => set('genz')}
        title="Gen Z"
        body="The Gang. On Pending. Add a Bestie. Same product, looser tone."
      />
    </div>
  );
}

interface VoiceRadioOptionProps {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}

function VoiceRadioOption({
  active,
  onClick,
  title,
  body,
}: VoiceRadioOptionProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors',
        active
          ? 'border-blurple bg-blurple/10'
          : 'border-glass-border bg-glass-surface-2 hover:border-glass-border-strong',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          active ? 'border-blurple' : 'border-ink-muted',
        )}
      >
        {active ? <span className="bg-blurple size-2 rounded-full" /> : null}
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-ink text-control font-semibold">{title}</span>
        <span className="text-ink-muted text-caption mt-0.5">{body}</span>
      </div>
    </button>
  );
}
