import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';

export function AnimatedInt({ value }: { value: number }): React.JSX.Element {
  const animated = useAnimatedNumber(value);
  return <span aria-hidden>{Math.round(animated)}</span>;
}
