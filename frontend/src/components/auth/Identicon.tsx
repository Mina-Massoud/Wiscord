import { getIdenticonDataUrl } from '@/lib/avatar';
import { cn } from '@/lib/cn';

const SIZE_MAP = {
  sm: 32,
  md: 48,
  lg: 96,
} as const;

interface IdenticonProps {
  seed: string;
  size?: keyof typeof SIZE_MAP;
  className?: string;
}

export default function Identicon({
  seed,
  size = 'md',
  className,
}: IdenticonProps): React.JSX.Element {
  const sizePx = SIZE_MAP[size];
  const src = getIdenticonDataUrl(seed, sizePx);

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={sizePx}
      height={sizePx}
      className={cn('rounded-md', className)}
    />
  );
}
