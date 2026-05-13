import { cn } from '@/lib/cn';

interface StepIndicatorProps {
  current: 1 | 2;
  total: 2;
}

export default function StepIndicator({
  current,
  total,
}: StepIndicatorProps): React.JSX.Element {
  return (
    <div
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label="Onboarding step"
      className="flex items-center gap-2"
    >
      {Array.from({ length: total }, (_, i) => {
        const step = (i + 1) as 1 | 2;
        return (
          <div
            key={step}
            className={cn(
              'h-2 w-4 rounded-full transition-colors',
              step === current ? 'bg-primary' : 'bg-border',
            )}
          />
        );
      })}
    </div>
  );
}
