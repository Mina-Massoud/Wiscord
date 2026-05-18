import { segmentAssistantText, type AiSource } from '@/queries/ai';
import { useNavigate } from 'react-router';
import { useAiCapsuleStore } from './useAiCapsuleStore';
import { InlineCitationBadge } from './AiExpandedSlotInlineCitationBadge';

/**
 * Renders an assistant turn with `[note:id]` / `[event:id]` /
 * `[attempt:id]` / `[activity:id]` markers swapped for inline
 * interactive badges. Clicking an event or note badge opens the
 * matching inline source pane via the AI capsule store — event
 * badges carry the cited day so the calendar lands on the right
 * date instead of always opening on "today".
 *
 * Unknown ids (matched by regex but absent from the turn's
 * `sources` array) fall through as the raw bracket text — better
 * to show the original marker than silently drop content.
 */
export function CitedText({
  text,
  sources,
}: {
  text: string;
  sources: AiSource[];
}): React.JSX.Element {
  const navigate = useNavigate();
  const openSourcePane = useAiCapsuleStore((s) => s.openSourcePane);
  const segments = segmentAssistantText(text, sources);
  if (segments.length === 0) return <span>{text}</span>;
  return (
    <span>
      {segments.map((seg, idx) =>
        seg.kind === 'text' ? (
          <span key={idx}>{seg.value}</span>
        ) : (
          <InlineCitationBadge
            key={idx}
            source={seg.source}
            onOpen={() => {
              const rawId = seg.source.id.split(':').slice(1).join(':');
              if (seg.source.kind === 'event') {
                openSourcePane({
                  kind: 'event',
                  id: rawId,
                  title: seg.source.label,
                  startAt: seg.source.startAt,
                });
              } else if (seg.source.kind === 'note') {
                openSourcePane({
                  kind: 'note',
                  id: rawId,
                  title: seg.source.label,
                });
              } else if (seg.source.kind === 'quiz' && seg.source.channelId) {
                // Quiz chips deep-link straight into the workshop —
                // the user just confirmed the generation; they want
                // to land on the editable draft, not in a sidepane.
                navigate(`/app/labs/quiz/${seg.source.channelId}?quiz=${rawId}`);
              }
              // attempt / activity have no inline pane — clicks fall
              // through to a no-op for now; deep-linking to existing
              // pages is the next polish pass.
            }}
          />
        ),
      )}
    </span>
  );
}
