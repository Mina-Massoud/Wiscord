import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { VoiceActivitySnapshot } from '@/queries/client';
import type { VoiceChannelParticipant } from '@/queries/voice-presence';
import { ActiveActivitiesOverlay } from './ActiveActivitiesOverlay';

function participant(overrides: Partial<VoiceChannelParticipant>): VoiceChannelParticipant {
  return {
    identity: 'u1',
    name: 'Mina',
    joinedAt: 0,
    activityKind: null,
    ...overrides,
  };
}

function quizActivity(hostUserId: string): VoiceActivitySnapshot {
  return {
    channelId: '6a2e65b788bf4ef93573b19f',
    kind: 'quiz',
    hostUserId,
    startedAt: '2026-06-16T00:00:00.000Z',
    source: null,
    state: null,
    currentTimeMs: 0,
    lastTickAt: null,
    quizId: null,
    pomodoro: null,
  };
}

describe('ActiveActivitiesOverlay', () => {
  it('shows a card from per-user presence', () => {
    render(
      <ActiveActivitiesOverlay
        participants={[participant({ identity: 'host', name: 'Noura', activityKind: 'quiz' })]}
        meIdentity="me"
        onJoin={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();
    expect(screen.getByText(/Noura is cooking/i)).toBeInTheDocument();
  });

  it('surfaces a host-led activity from the durable doc even when presence has no kind', () => {
    // The host is present in voice but their ephemeral activityKind never
    // landed — a freshly-joined viewer must still see the running quiz.
    render(
      <ActiveActivitiesOverlay
        participants={[participant({ identity: 'host', name: 'Noura', activityKind: null })]}
        meIdentity="me"
        activity={quizActivity('host')}
        onJoin={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();
    expect(screen.getByText(/Noura is cooking/i)).toBeInTheDocument();
  });

  it('falls back to "Host" when the activity host is not in the presence snapshot', () => {
    render(
      <ActiveActivitiesOverlay
        participants={[]}
        meIdentity="me"
        activity={quizActivity('host')}
        onJoin={vi.fn()}
      />,
    );
    expect(screen.getByText(/Host is cooking/i)).toBeInTheDocument();
  });

  it('does not show a card for the local user own activity', () => {
    render(
      <ActiveActivitiesOverlay
        participants={[]}
        meIdentity="me"
        activity={quizActivity('me')}
        onJoin={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Join' })).not.toBeInTheDocument();
  });

  it('renders nothing when nobody else is in an activity', () => {
    const { container } = render(
      <ActiveActivitiesOverlay
        participants={[]}
        meIdentity="me"
        activity={null}
        onJoin={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
