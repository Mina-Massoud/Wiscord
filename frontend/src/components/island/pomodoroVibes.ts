/**
 * Pomodoro vibe content — large pools of gen-z ego quotes and
 * practical session tips, picked deterministically from seeds that
 * incorporate the current time *bucket*. Different cadences per
 * pool so the user doesn't see everything flip at the same moment:
 *
 *   - ego quote     rotates every  2 minutes (long enough to read it,
 *                                              short enough to refresh)
 *   - focus tip     rotates every  90 seconds
 *   - break tip     rotates every  60 seconds (breaks are short)
 *
 * Seed inputs (round, sessions-today, time bucket) make sure two
 * concurrent sessions on the same day don't all show the same line,
 * and that the line changes naturally while the timer ticks.
 */

const EGO_QUOTES = [
  "You're THAT person. Lock in.",
  'The grind respects no one but the one who shows up.',
  "Future you is watching. Don't make them cringe.",
  'Pomodoros are how main characters operate.',
  'Distractions are for NPCs.',
  '25 minutes. The line between "wants to" and "does".',
  'Lock in. Glow up. Repeat.',
  "You didn't come this far to only come this far.",
  'Bro literally just sit there and do the thing.',
  'Soft launch your work ethic this session.',
  'The streak is the moat. Protect it.',
  'Vibes are for breaks. This block? Different mode.',
  "It's giving 'wins the week.'",
  "Touch grass after. Right now we're touching the keyboard.",
  'No thoughts head empty just deep work.',
  'Cooked the algorithm yesterday. Today we cook the syllabus.',
  "The work doesn't care if you feel like it. Sit down.",
  "Excellence is a habit. Habits are what you do when you don't feel like it.",
  'Everyone has 25 minutes. Some people use them.',
  'Discipline is self-respect in a different outfit.',
  "Don't break the chain. The chain is your personality now.",
  'You are one focus block away from being slightly insufferable (the good way).',
  "Watch yourself become the person you said you'd be.",
  "Phone? Don't know her.",
  "The work IS the dopamine. You just haven't trained for it yet.",
  'Average is loud. Greatness happens quietly. Be quiet.',
  'Future you wants you to lock in. Be a team player.',
  "Hot girls (and gents) do pomodoros. It's the law.",
  'Closed lips. Open laptop.',
  'You can scroll forever or you can be a problem. Pick one.',
  'This is the part where you show up.',
  "We don't negotiate with procrastination.",
  "Brain off. Hands on. Let's go.",
  "Glow up isn't aesthetic, it's logistic. Sit down.",
  "25 min from now you're either proud or kicking yourself. Vote.",
  'The work is the brag.',
  'Discipline > motivation. Motivation called in sick.',
  "You vs. you. You're winning if you're still here.",
  'Trust the bit. Stay in the bit.',
  'Operators operate. Operate.',
  "Don't be a vibes-only entity. Get the W.",
  'Tap in. Tap nothing else.',
  'The minutes you waste do the same to you. Negotiate accordingly.',
  "Reps. We're here for reps.",
  'Be unserious online, serious in the doc.',
  'Don\'t break for "5 minutes" — that 5 turns 50.',
  'Make the deadline scared of you.',
  'Locked. In.',
  'You owe past-you a session.',
  'Be so consistent it gets boring. Then keep going.',
  'Touch the keyboard like it owes you money.',
  "The plan is the boring part. We're past the plan.",
];

const FOCUS_TIPS = [
  'Phone face down. No exceptions.',
  'Water within reach. Stand at the break.',
  'Pick ONE task. Not three. One.',
  "Closing tabs you don't need is part of the session.",
  "If you stop, you start over. So don't stop.",
  "Headphones on even with no music — it's a signal.",
  'No new tabs. Write the idea down for later.',
  'Tell your phone to shut up. Focus mode. Now.',
  "The first 2 minutes feel hard. Then you're in.",
  'Write the task title at the top of your doc before you start.',
  'Define "done" before you begin. Otherwise it never is.',
  "If you check the time, you're not in deep work yet.",
  'Hardest task first. Reward yourself with easier work in round 2.',
  'Notifications off — not silent. OFF.',
  "Door closed if you have one. Sign on it if you don't.",
  'Bathroom now, not in 8 minutes.',
  'Snack before, not during. Mid-session crunching breaks rhythm.',
  'Resist the urge to "just check Slack". That\'s the trap.',
  'Two monitors: one for the task, the other for nothing.',
  "Whatever app you'd open instinctively — close it before you start.",
  'Posture: ears over shoulders, not over the keyboard.',
  "If you blank on the next step, write the question. Don't search yet.",
  'The tab on the side IS the distraction. Move it to a new window.',
  'Browser fullscreen. No address bar, no bookmarks. Less surface.',
  "If music helps, lyrics in a language you don't speak helps more.",
  '90 seconds of outline saves 20 minutes of mess.',
  "Wrong session vibe? Reset the timer. Don't drag a broken session.",
  'Hands on the keyboard, not on the phone. Even briefly.',
  "The thing you're avoiding IS the task. Start there.",
  'Don\'t tab to a "quick" thing. Quick is never quick.',
  'Look up in the same browser tab. New tabs are little holidays.',
  'Voice-memo fleeting thoughts. Off your hands, into the file.',
  'Email is not deep work. Email later.',
  'Group chat updates wait 25 minutes. Promise.',
  'Track WHAT you did in this block, not just that you did one.',
  'Stuck 5+ min? Switch sub-tasks within the same goal.',
  "Don't grade your work mid-session. Just produce.",
  'Slightly cool > slightly warm. Performance temperature.',
  'Caffeine timing matters. Now or never for this block.',
  "Don't read all the docs. Read the ONE doc you need.",
  'The "I\'ll just answer one message" thought is a lie.',
  "Save the file. Now. Don't lose the block to a crash.",
  'Use the back of your hand on the trackpad — fewer idle swipes.',
  "Don't refactor mid-session. Make it work first.",
  "Don't open the design file unless you're designing.",
  'Aim for one specific output. "Make progress" is too vague.',
  'Inner-block goal: "Get to function X by minute 15."',
  'The block ends when the timer says, not when you feel finished.',
  'Stand desk users: switch posture at minute 13.',
  "If your eyes hurt, drop the brightness, don't drop the session.",
  'Browser zoom 110% if reading. Less squinting, more producing.',
  'Type your next thought BEFORE you check anything. Always.',
];

const BREAK_TIPS = [
  'Stand up. Stretch. Look out a window.',
  '5 minutes. No scrolling — eyes on something >20 ft away.',
  'Drink water. Boring but true.',
  "Don't open the group chat. You'll never come back in 5.",
  'Breathe like you mean it. 4 in, 4 out, 4 times.',
  'Quick walk if you can. Even one lap.',
  "Don't start anything new. Rest.",
  'Eyes off the screen entirely.',
  'Wash your face if you can. Reset signal.',
  "Don't sit. Standing break is a different break.",
  'Open a window. Real air.',
  'Stretch your neck. Slow circles, both directions.',
  'If you fell into a chair, stand and unfall.',
  'Tea > coffee on the second break.',
  'Quick text to a friend is fine. Quick TikTok is not.',
  'Don\'t check email "just to clear it". You won\'t.',
  'Music with no vocals if you must have audio.',
  'Mini-snack. Protein > sugar for the next session.',
  'Plan the NEXT block. Two sentences max.',
  'If you got something done, say it out loud. Earned it.',
  "Don't read news. News is a 5-minute black hole.",
  'Posture reset before you sit back down.',
  'Look at the ceiling. Far focus, eye reset.',
  "If you're sore, you've been sitting too long. Move.",
  "Eyes water? You haven't blinked enough. Blink slow ×10.",
  'Hands off the keyboard the entire break. Force it.',
  "Don't reorganize anything. Resist.",
  'Praise self. Out loud is even better. Yes really.',
  'Hydrate before the next focus block starts.',
  'Plan a tiny treat for after round 4. Future-you wins.',
  "Whatever you were just doing — don't re-open it yet.",
  "Wiggle your toes. Don't laugh, do it.",
  'Watch one short, then put the phone face-down.',
];

/** Stable pick from a list, seeded by a single number. */
function pick<T>(list: readonly T[], seed: number): T {
  const i = Math.abs(Math.floor(seed)) % list.length;
  return list[i] as T;
}

interface VibeContext {
  round: number;
  sessionsCompletedToday: number;
  /** Wall-clock now-ms. Each picker buckets it at its own cadence so
   *  quotes and tips rotate independently — they don't all flip at
   *  the same moment, which would feel choreographed and fake. */
  nowMs: number;
}

export function pickEgoQuote({ round, sessionsCompletedToday, nowMs }: VibeContext): string {
  const bucket = Math.floor(nowMs / 120_000); // 2 min
  return pick(EGO_QUOTES, round * 79 + sessionsCompletedToday * 19 + bucket * 17);
}

export function pickFocusTip({ round, sessionsCompletedToday, nowMs }: VibeContext): string {
  const bucket = Math.floor(nowMs / 90_000); // 90s
  return pick(FOCUS_TIPS, round * 73 + sessionsCompletedToday * 13 + bucket * 11);
}

export function pickBreakTip({ round, sessionsCompletedToday, nowMs }: VibeContext): string {
  const bucket = Math.floor(nowMs / 60_000); // 1 min — breaks are short
  return pick(BREAK_TIPS, round * 67 + sessionsCompletedToday * 11 + bucket * 23);
}
