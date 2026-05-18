import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';

export function AnimatedPercent({ value }: { value: number }): React.JSX.Element {
  const animated = useAnimatedNumber(value);
  return <span aria-hidden>{Math.round(animated * 100)}%</span>;
}
