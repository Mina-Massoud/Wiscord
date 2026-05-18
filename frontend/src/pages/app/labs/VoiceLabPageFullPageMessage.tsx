export function FullPageMessage({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="bg-canvas text-ink flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      {children}
    </div>
  );
}
