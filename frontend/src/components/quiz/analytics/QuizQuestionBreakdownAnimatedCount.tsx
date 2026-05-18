import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';

export function AnimatedCount({ value }: { value: number }): React.JSX.Element {
  const animated = useAnimatedNumber(value);
  return <>{Math.round(animated)}</>;
}
