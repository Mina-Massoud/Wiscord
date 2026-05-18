import type { Vibe } from '@/types/auth';

/**
 * Canned Wismate previews used by the onboarding vibe step. Each
 * entry is a tiny scripted exchange the user can read to feel how
 * the AI will sound. Kept short on purpose — long previews crowd
 * the card grid; this is a vibe taste-test, not a transcript.
 *
 * The toast / button samples are the same key surfaces the live
 * UI swaps through the copy registry. Showing them on this screen
 * sets the user's expectation that the choice is everywhere, not
 * just in the AI.
 */
export interface VibeSample {
  label: string;
  description: string;
  /** Pretend user message + Wismate reply for the bubble preview. */
  bubble: { user: string; ai: string };
  /** Surface chips for the secondary preview row. Matches what the
   *  copy registry would produce on a real session. */
  toast: string;
  button: string;
}

export const VIBE_SAMPLES: Record<Vibe, VibeSample> = {
  genz: {
    label: 'Gen Z',
    description: 'Lowkey, dry, group-chat energy. Built for the original Wiscord vibe.',
    bubble: {
      user: 'i failed my exam',
      ai: 'oof. retake territory or "we move" territory?',
    },
    toast: 'Bestie locked in.',
    button: 'Pull Up',
  },
  chill: {
    label: 'Chill',
    description:
      'Warm and casual without the slang. Sounds like a friend who texts in full sentences.',
    bubble: {
      user: 'i failed my exam',
      ai: "sorry, that's rough. is it retake territory, or are you moving on?",
    },
    toast: 'Friend added.',
    button: 'Join lounge',
  },
  professional: {
    label: 'Professional',
    description:
      'Clear, polite, full sentences. Safe to forward in an email. Default for teachers.',
    bubble: {
      user: 'I failed my exam.',
      ai: "I'm sorry to hear that. Is a retake an option, or are you moving on?",
    },
    toast: 'Contact added.',
    button: 'Join channel',
  },
};
