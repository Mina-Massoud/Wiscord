import { cn } from '@/lib/cn';

interface OnboardingProgressProps {
  /** 1-based step index. 3-step flow: role → vibe → profile. */
  step: 1 | 2 | 3;
}

/**
 * Three-segment progress strip across the top of every onboarding
 * card. Mirrors the Mobbin/Brilliant onboarding pattern (active +
 * remaining + done). Active segment uses the blurple accent; the
 * rest stay surface-2 so the bar reads as quiet chrome until the
 * user advances.
 */
export function OnboardingProgress({ step }: OnboardingProgressProps): React.JSX.Element {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={3}
      aria-valuenow={step}
      aria-label={`Onboarding — step ${step} of 3`}
      className="mb-6 flex w-full gap-1.5"
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            'ease-wiscord h-1 flex-1 rounded-full transition-colors duration-200',
            i <= step ? 'bg-blurple' : 'bg-glass-surface-2',
          )}
        />
      ))}
    </div>
  );
}
