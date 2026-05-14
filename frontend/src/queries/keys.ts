/**
 * Hierarchical query-key factory.
 * Namespaces are stubs — Worker B+ will add specific keys.
 * Pattern: each namespace has a `root` (for broad invalidation)
 * plus typed sub-key factories.
 */
export const qk = {
  auth: {
    root: ['auth'] as const,
    session: () => ['auth', 'session'] as const,
  },

  profiles: {
    root: ['profiles'] as const,
    byId: (id: string) => ['profiles', id] as const,
    me: () => ['profiles', 'me'] as const,
    usernameCheck: (candidate: string) => ['profiles', 'username-check', candidate] as const,
  },

  servers: {
    root: ['servers'] as const,
    all: () => ['servers', 'all'] as const,
    byId: (id: string) => ['servers', id] as const,
    mine: () => ['servers', 'mine'] as const,
  },

  members: {
    root: ['members'] as const,
    byServer: (serverId: string) => ['members', serverId] as const,
  },

  invites: {
    root: ['invites'] as const,
    byServer: (serverId: string) => ['invites', serverId] as const,
  },

  channels: {
    root: ['channels'] as const,
    byServer: (serverId: string) => ['channels', serverId] as const,
    byId: (id: string) => ['channels', 'detail', id] as const,
  },

  messages: {
    root: ['messages'] as const,
    byChannel: (channelId: string) => ['messages', channelId] as const,
  },

  presence: {
    root: ['presence'] as const,
    byServer: (serverId: string) => ['presence', serverId] as const,
  },

  focus: {
    root: ['focus'] as const,
    session: () => ['focus', 'session'] as const,
    goals: () => ['focus', 'goals'] as const,
  },

  notes: {
    root: ['notes'] as const,
    byChannel: (channelId: string) => ['notes', channelId] as const,
  },

  voice: {
    root: ['voice'] as const,
    byChannel: (channelId: string) => ['voice', channelId] as const,
    participants: (channelId: string) => ['voice', 'participants', channelId] as const,
  },

  quiz: {
    root: ['quiz'] as const,
    mine: () => ['quiz', 'mine'] as const,
    byChannel: (channelId: string) => ['quiz', 'by-channel', channelId] as const,
    byId: (quizId: string) => ['quiz', 'detail', quizId] as const,
    attempts: (quizId: string) => ['quiz', 'attempts', quizId] as const,
    myAttempt: (quizId: string) => ['quiz', 'my-attempt', quizId] as const,
    analytics: (quizId: string) => ['quiz', 'analytics', quizId] as const,
  },

  whiteboard: {
    root: ['whiteboard'] as const,
    mine: () => ['whiteboard', 'mine'] as const,
    byChannel: (channelId: string) => ['whiteboard', channelId] as const,
    snapshot: (channelId: string) => ['whiteboard', 'snapshot', channelId] as const,
  },
} as const;
