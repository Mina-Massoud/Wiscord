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
  },

  servers: {
    root: ['servers'] as const,
    all: () => ['servers', 'all'] as const,
    byId: (id: string) => ['servers', id] as const,
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
} as const;
