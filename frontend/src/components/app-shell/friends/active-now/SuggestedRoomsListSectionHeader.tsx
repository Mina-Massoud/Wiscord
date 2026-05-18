interface SectionHeaderProps {
  id: string;
  children: React.ReactNode;
}

export function SectionHeader({ id, children }: SectionHeaderProps): React.JSX.Element {
  return (
    <div className="mt-4 flex items-center justify-between px-4 pb-1">
      <span id={id} className="text-ink-subtle text-badge font-bold tracking-wider uppercase">
        {children}
      </span>
    </div>
  );
}
