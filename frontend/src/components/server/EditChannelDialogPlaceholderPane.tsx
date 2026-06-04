interface EditChannelDialogPlaceholderPaneProps {
  label: string;
}

export function EditChannelDialogPlaceholderPane({
  label,
}: EditChannelDialogPlaceholderPaneProps): React.JSX.Element {
  return (
    <div className="border-border flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
      <p className="text-tab text-ink-subtle">{label} — coming soon</p>
    </div>
  );
}
