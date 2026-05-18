export function Progress({
  total,
  answered,
  current,
}: {
  total: number;
  answered: number;
  current: number;
}): React.JSX.Element {
  return (
    <div
      className="flex w-full max-w-2xl items-center gap-1.5"
      aria-label={`Progress: ${answered} of ${total} answered`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={
            i === current
              ? 'bg-blurple rounded-pill h-1.5 flex-1'
              : i < answered
                ? 'bg-blurple/60 rounded-pill h-1.5 flex-1'
                : 'bg-surface-active rounded-pill h-1.5 flex-1'
          }
        />
      ))}
    </div>
  );
}
