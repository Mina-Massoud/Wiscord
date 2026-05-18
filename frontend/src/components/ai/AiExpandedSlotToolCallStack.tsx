import { type AiToolCall } from '@/queries/ai';
import { ToolCallRow } from './AiExpandedSlotToolCallRow';

/**
 * Renders each tool call attached to an assistant turn. Two
 * shapes: a status chip for resolved/non-destructive calls, and a
 * confirm card for destructive calls waiting on the user. The
 * confirm path calls `confirmTool` and optimistically marks the
 * call resolved so feedback lands instantly.
 */
export function ToolCallStack({ toolCalls }: { toolCalls: AiToolCall[] }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      {toolCalls.map((call) => (
        <ToolCallRow key={call.callId} call={call} />
      ))}
    </div>
  );
}
