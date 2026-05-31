

export function TypingIndicator({ usernames }: { usernames: string[] }) {
  if (usernames.length === 0) return null;

  let text = '';
  if (usernames.length === 1) {
    text = `${usernames[0]} is typing...`;
  } else if (usernames.length === 2) {
    text = `${usernames[0]} and ${usernames[1]} are typing...`;
  } else {
    text = `${usernames[0]}, ${usernames[1]}, and ${usernames.length - 2} others are typing...`;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-2">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
      </div>
      <span>{text}</span>
    </div>
  );
}
