import { Volume2 } from 'lucide-react';

import type { ChannelDto } from '@/queries/channels';

interface ServerChannelVoicePaneProps {
  channel: ChannelDto;
}

export function ServerChannelVoicePane({ channel }: ServerChannelVoicePaneProps): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="bg-glass-callout border-glass-border flex size-14 items-center justify-center rounded-full border">
        <Volume2 className="text-ink-muted size-7" aria-hidden />
      </div>
      <h2 className="text-ink text-subhead font-semibold">{channel.name}</h2>
      <p className="text-ink-muted text-body max-w-sm">
        Voice lounge UI ships next — join, mute, and study together here.
      </p>
    </div>
  );
}
