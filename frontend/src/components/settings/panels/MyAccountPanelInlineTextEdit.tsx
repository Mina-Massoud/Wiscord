import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface InlineTextEditProps {
  initial: string;
  maxLength: number;
  placeholder?: string;
  submitting: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function InlineTextEdit({
  initial,
  maxLength,
  placeholder,
  submitting,
  onSubmit,
  onCancel,
}: InlineTextEditProps): React.JSX.Element {
  const [value, setValue] = useState(initial);
  const dirty = value !== initial;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!dirty || submitting) return;
        onSubmit(value);
      }}
      className="flex items-center gap-2"
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        autoFocus
        autoComplete="off"
        className="flex-1"
      />
      <Button type="submit" size="icon" disabled={!dirty || submitting} aria-label="Save">
        <Check className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onCancel}
        disabled={submitting}
        aria-label="Cancel"
      >
        <X className="size-4" />
      </Button>
    </form>
  );
}
