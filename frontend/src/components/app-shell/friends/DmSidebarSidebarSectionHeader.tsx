interface SidebarSectionHeaderProps {
  label: string;
}

export function SidebarSectionHeader({ label }: SidebarSectionHeaderProps): React.JSX.Element {
  return (
    <div className="mt-4 px-4 pb-1">
      <span className="text-ink-subtle text-badge font-bold tracking-wider uppercase">{label}</span>
    </div>
  );
}
