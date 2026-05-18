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
    mine: () => ['notes', 'mine'] as const,
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

  media: {
    root: ['media'] as const,
    byId: (id: string) => ['media', id] as const,
    mine: () => ['media', 'mine'] as const,
  },

  voiceActivity: {
    root: ['voice-activity'] as const,
    byChannel: (channelId: string) => ['voice-activity', channelId] as const,
  },

  friends: {
    root: ['friends'] as const,
    list: () => ['friends', 'list'] as const,
    incoming: () => ['friends', 'requests', 'incoming'] as const,
    outgoing: () => ['friends', 'requests', 'outgoing'] as const,
    search: (q: string) => ['friends', 'search', q] as const,
  },

  activityHistory: {
    root: ['activity-history'] as const,
    byKindChannel: (kind: 'notes' | 'whiteboard', channelId: string) =>
      ['activity-history', kind, channelId] as const,
  },

  calendar: {
    root: ['calendar'] as const,
    events: (scope: { channelId: string | null; from: string; to: string }) =>
      ['calendar', 'events', scope.channelId ?? 'personal', scope.from, scope.to] as const,
    eventsRoot: (channelId: string | null) =>
      ['calendar', 'events', channelId ?? 'personal'] as const,
    categories: (scope: 'user' | 'channel', ownerId: string) =>
      ['calendar', 'categories', scope, ownerId] as const,
    categoriesRoot: ['calendar', 'categories'] as const,
  },

  privacy: {
    root: ['privacy'] as const,
    me: () => ['privacy', 'me'] as const,
  },

  security: {
    root: ['security'] as const,
    currentSession: () => ['security', 'current-session'] as const,
  },

  billing: {
    root: ['billing'] as const,
    subscription: () => ['billing', 'subscription'] as const,
    invoices: () => ['billing', 'invoices'] as const,
  },

  integrations: {
    root: ['integrations'] as const,
    all: () => ['integrations', 'all'] as const,
  },

  music: {
    root: ['music'] as const,
    search: (q: string) => ['music', 'search', q] as const,
  },
} as const;
