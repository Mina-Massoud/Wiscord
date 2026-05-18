import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { quizGenZ } from '@/lib/copy/quiz-genz';

export function AnimatedPicked({ count }: { count: number }): React.JSX.Element {
  const animated = useAnimatedNumber(count);
  return <>{quizGenZ.perQuestion.pickedThis(Math.round(animated))}</>;
}
