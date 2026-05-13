/**
 * Static seeds for the right-rail "Active Now" showcase. Pure data — no React,
 * no I/O. Lives next to fake-shell.ts but in its own file so neither balloons
 * past the modular-code line budget.
 *
 * The right rail is decorative in v1 (see docs/overview.md): one feature
 * spotlight, a "Focusing now" list, and a "Suggested rooms" list. None of
 * this is wired to realtime — replace once Supabase Presence + channel
 * activity queries land.
 */

import type {
  FakeAnnouncement,
  FakeFocusingRoom,
  FakeSuggestedRoom,
  FakeTipHint,
  FeatureSpotlight,
} from './fake-shell.types';

export const fakeFeatureSpotlight: FeatureSpotlight = {
  id: 'spot_sync_timer',
  icon: 'timer',
  title: 'Sync timer',
  blurb: 'Start a Pomodoro and the whole room counts down with you.',
};

export const fakeFocusingRooms: FakeFocusingRoom[] = [
  {
    id: 'fr_dsa_general',
    serverId: 's_dsa_hub',
    serverName: 'DSA Hub',
    serverIconSeed: 's_dsa_hub',
    channelId: 'c_general',
    channelName: 'general',
    channelKind: 'text',
    focusCount: 4,
    minutesLeft: 17,
  },
  {
    id: 'fr_ielts_voice',
    serverId: 's_ielts_prep',
    serverName: 'IELTS Prep',
    serverIconSeed: 's_ielts_prep',
    channelId: 'c_ielts_voice',
    channelName: 'Reading Lounge',
    channelKind: 'voice',
    focusCount: 2,
    minutesLeft: 9,
  },
  {
    id: 'fr_med_study',
    serverId: 's_med_school',
    serverName: 'Med School',
    serverIconSeed: 's_med_school',
    channelId: 'c_med_study_room',
    channelName: 'study-room',
    channelKind: 'text',
    focusCount: 1,
    minutesLeft: 22,
  },
];

export const fakeFriendsAnnouncement: FakeAnnouncement = {
  id: 'ann_room_ai_citations',
  tag: 'New',
  headline: 'Room AI now cites the chat.',
  tagline: 'Ask anything about your room — answers link back to the exact message.',
};

export const fakeFriendsTips: FakeTipHint[] = [
  {
    id: 'tip_sync_timer',
    icon: 'timer',
    title: 'Sync timer',
    blurb: 'One Pomodoro for the whole room. Set a goal at the start, check it off at the end.',
  },
  {
    id: 'tip_room_ai',
    icon: 'ai',
    title: 'Ask the room',
    blurb: 'Each room has its own AI. It reads recent chat and notes, then cites what it used.',
  },
  {
    id: 'tip_voice_lounge',
    icon: 'voice',
    title: 'Voice lounges',
    blurb: 'Drop into voice to body-double — audio only, no camera, no screen-share pressure.',
  },
];

export const fakeSuggestedRooms: FakeSuggestedRoom[] = [
  {
    id: 'sr_fe_react',
    serverId: 's_frontend_masters',
    serverName: 'Frontend Masters',
    serverIconSeed: 's_frontend_masters',
    channelId: 'c_fe_react',
    channelName: 'react-deep-dive',
    channelKind: 'text',
    blurb: 'Hooks, rendering, server components — read alongside.',
  },
  {
    id: 'sr_lang_voice',
    serverId: 's_language_exchange',
    serverName: 'Language Exchange',
    serverIconSeed: 's_language_exchange',
    channelId: 'c_lang_voice',
    channelName: 'Conversation Booth',
    channelKind: 'voice',
    blurb: 'Drop in for a 10-minute conversation, any level.',
  },
  {
    id: 'sr_dsa_leet',
    serverId: 's_dsa_hub',
    serverName: 'DSA Hub',
    serverIconSeed: 's_dsa_hub',
    channelId: 'c_daily_leetcode',
    channelName: 'daily-leetcode',
    channelKind: 'text',
    blurb: 'One problem a day, discussed together after the timer.',
  },
];
