interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Reusable Discord-style section header. The big title at the top of the
 * pane uses `<h2>` and reads as the panel's title; subsequent sections
 * within the same panel use `<h3>` with a divider above.
 */
export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps): React.JSX.Element {
  return (
    <section className="mt-8 first:mt-0">
      <h3 className="text-ink text-subhead font-semibold">{title}</h3>
      {description ? <p className="text-ink-muted text-control mt-1">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
