/**
 * Hard-coded fake data for the static post-login app shell.
 * Single source of truth — no imports of React, queries, or I/O.
 * Replace with real backend wiring once the channels/messages endpoints land.
 *
 * Cast and server set are tuned to Wiscord's v1 study objective
 * (synchronized Pomodoro, room-scoped AI, focus sessions) — see
 * ../../../docs/overview.md.
 */

import type {
  FakeChannel,
  FakeFriend,
  FakeMessage,
  FakeRecentRoom,
  FakeServer,
  FakeUser,
} from './fake-shell.types';

// ── Users ────────────────────────────────────────────────────────────────────

export const fakeUsers: Record<string, FakeUser> = {
  alex: {
    id: 'u_alex',
    username: 'alex',
    displayName: 'Alex Rivera',
    avatarSeed: 'alex',
    presence: 'online',
  },
  maya: {
    id: 'u_maya',
    username: 'maya',
    displayName: 'Maya Chen',
    avatarSeed: 'maya',
    presence: 'online',
  },
  sam: {
    id: 'u_sam',
    username: 'sam',
    displayName: 'Sam Whitaker',
    avatarSeed: 'sam',
    presence: 'online',
  },
  jordan: {
    id: 'u_jordan',
    username: 'jordan',
    displayName: 'Jordan P.',
    avatarSeed: 'jordan',
    presence: 'idle',
  },
  priya: {
    id: 'u_priya',
    username: 'priya',
    displayName: 'Priya Patel',
    avatarSeed: 'priya',
    presence: 'online',
  },
  liam: {
    id: 'u_liam',
    username: 'liam',
    displayName: "Liam O'Connor",
    avatarSeed: 'liam',
    presence: 'idle',
  },
  studybot: {
    id: 'u_studybot',
    username: 'wiscord-tutor',
    displayName: 'Wiscord Tutor',
    avatarSeed: 'wiscord-tutor',
    presence: 'online',
    status: 'AI study assistant',
    isBot: true,
  },
  noor: {
    id: 'u_noor',
    username: 'noor',
    displayName: 'Noor Hassan',
    avatarSeed: 'noor',
    presence: 'dnd',
  },
  ethan: {
    id: 'u_ethan',
    username: 'ethan',
    displayName: 'Ethan Brooks',
    avatarSeed: 'ethan',
    presence: 'offline',
  },
  riley: {
    id: 'u_riley',
    username: 'riley',
    displayName: 'Riley Adams',
    avatarSeed: 'riley',
    presence: 'online',
  },
  casey: {
    id: 'u_casey',
    username: 'casey',
    displayName: 'Casey Lin',
    avatarSeed: 'casey',
    presence: 'idle',
  },
  morgan: {
    id: 'u_morgan',
    username: 'morgan',
    displayName: 'Morgan Reed',
    avatarSeed: 'morgan',
    presence: 'online',
  },
  focusCrew: {
    id: 'u_focus_crew',
    username: 'dsa-focus-crew',
    displayName: 'DSA Focus Crew',
    avatarSeed: 'dsa-focus-crew',
    presence: 'online',
  },
  avery: {
    id: 'u_avery',
    username: 'avery',
    displayName: 'Avery Stone',
    avatarSeed: 'avery',
    presence: 'offline',
  },
  parker: {
    id: 'u_parker',
    username: 'parker',
    displayName: 'Parker Hayes',
    avatarSeed: 'parker',
    presence: 'online',
  },
};

// ── Messages for the headline channel ────────────────────────────────────────

const generalMessages: FakeMessage[] = [
  {
    id: 'm_1',
    authorId: 'u_maya',
    timestamp: '2026-05-10T15:54:00Z',
    body: 'maya just landed.',
    kind: 'system-join',
  },
  {
    id: 'm_2',
    authorId: 'u_maya',
    timestamp: '2026-05-10T15:54:30Z',
    body: 'anyone up for a 25-min focus block?',
    kind: 'message',
  },
  {
    id: 'm_3',
    authorId: 'u_sam',
    timestamp: '2026-05-10T15:55:00Z',
    body: 'in. goal: finish two-pointer review.',
    kind: 'message',
  },
  {
    id: 'm_4',
    authorId: 'u_priya',
    timestamp: '2026-05-10T15:55:10Z',
    body: "i'm in. goal: 10 SC writing-task outlines.",
    kind: 'message',
  },
  {
    id: 'm_5',
    authorId: 'u_studybot',
    timestamp: '2026-05-10T15:55:30Z',
    body: 'Wiscord Tutor is here. Ask anything about this room.',
    kind: 'system-join',
  },
  {
    id: 'm_6',
    authorId: 'u_maya',
    timestamp: '2026-05-10T15:55:45Z',
    body: "@Wiscord Tutor what's the trick for sliding-window vs two-pointer?",
    kind: 'message',
  },
  {
    id: 'm_7',
    authorId: 'u_studybot',
    timestamp: '2026-05-10T15:55:46Z',
    body: 'Quick rule of thumb — sliding window when the answer lives over a *contiguous* range and you can extend/shrink the window in O(1) (sums, counts, max length). Two-pointer when the pointers move based on a relationship between elements (sorted-pair sums, reverse-in-place, dedupe). If the input is sorted and you compare two values, reach for two-pointer first.',
    kind: 'message',
  },
  {
    id: 'm_8',
    authorId: 'u_sam',
    timestamp: '2026-05-10T15:55:47Z',
    body: 'starting the timer 🚀',
    kind: 'message',
  },
  {
    id: 'm_9',
    authorId: 'u_priya',
    timestamp: '2026-05-10T16:20:48Z',
    body: '✅ hit my goal.',
    kind: 'message',
  },
];

const dsaHubChannels: FakeChannel[] = [
  {
    id: 'c_general',
    kind: 'text',
    name: 'general',
    messages: generalMessages,
  },
  {
    id: 'c_daily_leetcode',
    kind: 'text',
    name: 'daily-leetcode',
    messages: [],
  },
  {
    id: 'c_interview_prep',
    kind: 'text',
    name: 'interview-prep',
    messages: [],
  },
  {
    id: 'c_voice_focus',
    kind: 'voice',
    name: 'Focus Room',
    messages: [],
  },
];

const ieltsPrepChannels: FakeChannel[] = [
  {
    id: 'c_ielts_general',
    kind: 'text',
    name: 'general',
    messages: [
      {
        id: 'm_ielts_1',
        authorId: 'u_priya',
        timestamp: '2026-05-12T10:15:00Z',
        body: 'Speaking practice at 8pm — voice room open, bring a topic.',
        kind: 'message',
      },
    ],
  },
  {
    id: 'c_ielts_writing',
    kind: 'text',
    name: 'writing-tasks',
    messages: [],
  },
  {
    id: 'c_ielts_speaking',
    kind: 'text',
    name: 'speaking-practice',
    messages: [],
  },
  {
    id: 'c_ielts_voice',
    kind: 'voice',
    name: 'Reading Lounge',
    messages: [],
  },
];

const frontendMastersChannels: FakeChannel[] = [
  {
    id: 'c_fe_general',
    kind: 'text',
    name: 'general',
    messages: [],
  },
  {
    id: 'c_fe_react',
    kind: 'text',
    name: 'react-deep-dive',
    messages: [],
  },
  {
    id: 'c_fe_css',
    kind: 'text',
    name: 'css-clinic',
    messages: [],
  },
];

const medSchoolChannels: FakeChannel[] = [
  {
    id: 'c_med_study_room',
    kind: 'text',
    name: 'study-room',
    messages: [],
  },
];

const languageExchangeChannels: FakeChannel[] = [
  {
    id: 'c_lang_general',
    kind: 'text',
    name: 'general',
    messages: [],
  },
  {
    id: 'c_lang_vocab',
    kind: 'text',
    name: 'vocab-of-the-day',
    messages: [],
  },
  {
    id: 'c_lang_voice',
    kind: 'voice',
    name: 'Conversation Booth',
    messages: [],
  },
];

// ── Servers ──────────────────────────────────────────────────────────────────

export const fakeServers: FakeServer[] = [
  {
    id: 's_dsa_hub',
    name: 'DSA Hub',
    iconSeed: 's_dsa_hub',
    hasUnread: true,
    unreadCount: 2,
    channels: dsaHubChannels,
  },
  {
    id: 's_ielts_prep',
    name: 'IELTS Prep',
    iconSeed: 's_ielts_prep',
    hasUnread: true,
    unreadCount: 1,
    channels: ieltsPrepChannels,
  },
  {
    id: 's_frontend_masters',
    name: 'Frontend Masters',
    iconSeed: 's_frontend_masters',
    hasUnread: true,
    unreadCount: 208,
    channels: frontendMastersChannels,
  },
  {
    id: 's_med_school',
    name: 'Med School',
    iconSeed: 's_med_school',
    channels: medSchoolChannels,
  },
  {
    id: 's_language_exchange',
    name: 'Language Exchange',
    iconSeed: 's_language_exchange',
    hasUnread: true,
    unreadCount: 13,
    channels: languageExchangeChannels,
  },
];

// ── Recent rooms (left rail of the friends view) ─────────────────────────────
// v1 has no 1:1 DMs; the sidebar list surfaces channels you've recently been
// in, grouped visually by their parent server. Each row links to a real
// channel route (/app/servers/:serverId/channels/:channelId).

export const fakeRecentRooms: FakeRecentRoom[] = [
  {
    id: 'r_1',
    serverId: 's_dsa_hub',
    serverName: 'DSA Hub',
    serverIconSeed: 's_dsa_hub',
    channelId: 'c_general',
    channelName: 'general',
    channelKind: 'text',
    hasUnread: true,
    unreadCount: 2,
  },
  {
    id: 'r_2',
    serverId: 's_dsa_hub',
    serverName: 'DSA Hub',
    serverIconSeed: 's_dsa_hub',
    channelId: 'c_voice_focus',
    channelName: 'Focus Room',
    channelKind: 'voice',
  },
  {
    id: 'r_3',
    serverId: 's_dsa_hub',
    serverName: 'DSA Hub',
    serverIconSeed: 's_dsa_hub',
    channelId: 'c_daily_leetcode',
    channelName: 'daily-leetcode',
    channelKind: 'text',
  },
  {
    id: 'r_4',
    serverId: 's_ielts_prep',
    serverName: 'IELTS Prep',
    serverIconSeed: 's_ielts_prep',
    channelId: 'c_ielts_general',
    channelName: 'general',
    channelKind: 'text',
    hasUnread: true,
    unreadCount: 1,
  },
  {
    id: 'r_5',
    serverId: 's_ielts_prep',
    serverName: 'IELTS Prep',
    serverIconSeed: 's_ielts_prep',
    channelId: 'c_ielts_voice',
    channelName: 'Reading Lounge',
    channelKind: 'voice',
  },
  {
    id: 'r_6',
    serverId: 's_frontend_masters',
    serverName: 'Frontend Masters',
    serverIconSeed: 's_frontend_masters',
    channelId: 'c_fe_react',
    channelName: 'react-deep-dive',
    channelKind: 'text',
    hasUnread: true,
    unreadCount: 12,
  },
  {
    id: 'r_7',
    serverId: 's_frontend_masters',
    serverName: 'Frontend Masters',
    serverIconSeed: 's_frontend_masters',
    channelId: 'c_fe_css',
    channelName: 'css-clinic',
    channelKind: 'text',
  },
  {
    id: 'r_8',
    serverId: 's_med_school',
    serverName: 'Med School',
    serverIconSeed: 's_med_school',
    channelId: 'c_med_study_room',
    channelName: 'study-room',
    channelKind: 'text',
  },
  {
    id: 'r_9',
    serverId: 's_language_exchange',
    serverName: 'Language Exchange',
    serverIconSeed: 's_language_exchange',
    channelId: 'c_lang_voice',
    channelName: 'Conversation Booth',
    channelKind: 'voice',
  },
  {
    id: 'r_10',
    serverId: 's_language_exchange',
    serverName: 'Language Exchange',
    serverIconSeed: 's_language_exchange',
    channelId: 'c_lang_vocab',
    channelName: 'vocab-of-the-day',
    channelKind: 'text',
    hasUnread: true,
    unreadCount: 3,
  },
];

// ── Online friends (main pane on the friends view) ───────────────────────────

export const fakeFriends: FakeFriend[] = [
  { user: fakeUsers.alex! },
  { user: fakeUsers.maya! },
  { user: fakeUsers.sam! },
  { user: fakeUsers.jordan! },
  { user: fakeUsers.priya! },
  { user: fakeUsers.noor! },
  { user: fakeUsers.riley! },
  { user: fakeUsers.casey! },
  { user: fakeUsers.ethan! },
  { user: fakeUsers.avery! },
];

// ── Lookup helpers ───────────────────────────────────────────────────────────

export function findServerById(serverId: string): FakeServer | undefined {
  return fakeServers.find((server) => server.id === serverId);
}

export function findChannelById(
  serverId: string,
  channelId: string,
): { server: FakeServer; channel: FakeChannel } | undefined {
  const server = findServerById(serverId);
  if (!server) return undefined;
  const channel = server.channels.find((c) => c.id === channelId);
  if (!channel) return undefined;
  return { server, channel };
}

export function findUserById(userId: string): FakeUser | undefined {
  return Object.values(fakeUsers).find((user) => user.id === userId);
}

export function firstTextChannel(server: FakeServer): FakeChannel | undefined {
  return server.channels.find((c) => c.kind === 'text');
}
