/**
 * Gen Z copy for the live quiz analytics dashboard. Kept in a single file so
 * the register can be tuned in one place without touching components.
 *
 * Tone: lowkey, "the gang", "lock in", "cooking", "real ones", "midd". Avoid
 * fad slang that ages within a quarter (no "skibidi", no "rizz", no current
 * dance reference). Numbers and verbs are honest — slang sits on top of an
 * accurate label, never replaces it.
 *
 * Capitalization: sentence-case for descriptions, Title Case for chips and
 * column headings (mirrors the broader Wiscord copy registry).
 */
export const quizGenZ = {
  // Status pills
  liveBadge: 'live · cooking',
  closedBadge: 'wrapped',

  // Stat row
  participants: {
    label: 'Cooking now',
    detail: (n: number) =>
      n === 0
        ? 'nobody pulled up yet'
        : n === 1
          ? '1 real one in the kitchen'
          : `${n} folks cooking`,
  },
  submitted: {
    label: 'Locked in',
    detail: (n: number, total: number) =>
      total === 0
        ? 'waiting on the gang'
        : n === 0
          ? 'nobody hit submit yet'
          : `${n} of ${total} sent it`,
  },
  averageScore: {
    label: 'Class vibe',
    detail: (avg: number, submittedCount: number) => {
      if (submittedCount === 0) return 'no scores in yet';
      const pct = Math.round(avg * 100);
      if (pct >= 80) return `${pct}% avg — we cooked`;
      if (pct >= 50) return `${pct}% avg — mid energy`;
      return `${pct}% avg — rough patch`;
    },
  },
  accuracy: {
    label: 'Hit rate',
    detail: (acc: number) => {
      if (acc === 0) return 'no shots taken';
      const pct = Math.round(acc * 100);
      if (pct >= 80) return `${pct}% are real ones`;
      if (pct >= 50) return `${pct}% landing it`;
      return `${pct}% — kinda midd`;
    },
  },

  // Per-question breakdown
  perQuestion: {
    sectionTitle: 'Vibes per question',
    answered: (n: number) =>
      n === 0 ? 'nobody touched this one' : n === 1 ? '1 answer in' : `${n} answers in`,
    accuracyTag: (acc: number) => {
      if (acc === 0) return 'cold';
      const pct = Math.round(acc * 100);
      if (pct >= 80) return `${pct}% real ones`;
      if (pct >= 50) return `${pct}% landed`;
      return `${pct}% midd`;
    },
    correctChip: 'real ones',
    pickedThis: (n: number) =>
      n === 0 ? 'nobody picked this' : n === 1 ? '1 picked this' : `${n} picked this`,
    emptyShort: 'no responses yet',
  },

  // Leaderboard
  leaderboard: {
    title: 'Top of the food chain',
    empty: 'no scores yet — once the gang submits, ranks pull up here',
    youTag: 'you',
    pending: 'still cooking',
    submittedAtRel: (iso: string) => {
      const date = new Date(iso);
      const diffMs = Date.now() - date.getTime();
      const minutes = Math.floor(diffMs / 60_000);
      if (minutes < 1) return 'just landed';
      if (minutes === 1) return '1 min ago';
      if (minutes < 60) return `${minutes} min ago`;
      const hours = Math.floor(minutes / 60);
      if (hours === 1) return '1 hr ago';
      return `${hours} hr ago`;
    },
    scoreLine: (pct: number) => `${pct}% locked`,
  },

  // Close-quiz action (host wraps up a live/open quiz)
  closeQuiz: {
    trigger: 'Wrap it up',
    pendingTrigger: 'Wrapping…',
    confirmTitle: 'Wrap the quiz?',
    confirmBody:
      "Once you wrap, the gang can't lock in any new answers. The final dashboard stays right here.",
    confirmCta: 'Yeah, wrap it',
    cancel: 'Keep cooking',
    successToast: 'Wrapped. Final scores are in.',
    errorToast: "Couldn't wrap it up. Try again?",
  },

  // Empty states + errors
  empty: {
    title: 'No plates served yet',
    body: 'launch the quiz and watch the gang pull up — answers land here in real time.',
  },
  error: {
    title: "Couldn't pull up the numbers",
    body: 'something flopped on our end. give it another tap.',
    retry: 'Try again',
  },
} as const;
