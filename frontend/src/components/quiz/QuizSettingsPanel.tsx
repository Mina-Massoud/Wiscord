import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { QuizSettings } from '@/types/quiz';

interface QuizSettingsPanelProps {
  settings: QuizSettings;
  onChange: (patch: Partial<QuizSettings>) => void;
}

const TIME_CHOICES: Array<{ label: string; value: string }> = [
  { label: '15 seconds', value: '15' },
  { label: '30 seconds', value: '30' },
  { label: '60 seconds', value: '60' },
  { label: '90 seconds', value: '90' },
  { label: '2 minutes', value: '120' },
  { label: 'No time limit', value: 'none' },
];

/**
 * Quiz-level settings: per-question timer, shuffle questions/options, show
 * leaderboard. Time limit is live-mode only — async ignores it. Shuffle and
 * leaderboard work for both. The panel is purely declarative — the parent
 * owns the draft state and the debounced save.
 */
export function QuizSettingsPanel({
  settings,
  onChange,
}: QuizSettingsPanelProps): React.JSX.Element {
  const timeValue =
    settings.timePerQuestionSec === null ? 'none' : String(settings.timePerQuestionSec);

  return (
    <section
      aria-labelledby="quiz-settings-heading"
      className="bg-glass-surface-1 border-glass-border flex flex-col gap-4 rounded-lg border p-5"
    >
      <h3 id="quiz-settings-heading" className="text-ink text-subhead font-semibold">
        Settings
      </h3>

      <Row
        label="Time per question (live mode)"
        helper="Async takers ignore this and answer at their own pace."
      >
        <Select
          value={timeValue}
          onValueChange={(v) => onChange({ timePerQuestionSec: v === 'none' ? null : Number(v) })}
        >
          <SelectTrigger className="bg-surface-composer h-9 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_CHOICES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <Row label="Shuffle questions" helper="Randomize order for each participant.">
        <Switch
          checked={settings.shuffleQuestions}
          onCheckedChange={(v) => onChange({ shuffleQuestions: v })}
          aria-label="Shuffle questions"
        />
      </Row>

      <Row label="Shuffle options" helper="MCQ option order is randomized per participant.">
        <Switch
          checked={settings.shuffleOptions}
          onCheckedChange={(v) => onChange({ shuffleOptions: v })}
          aria-label="Shuffle options"
        />
      </Row>

      <Row label="Show leaderboard" helper="Top scores appear at the end (live mode only).">
        <Switch
          checked={settings.showLeaderboard}
          onCheckedChange={(v) => onChange({ showLeaderboard: v })}
          aria-label="Show leaderboard"
        />
      </Row>
    </section>
  );
}

interface RowProps {
  label: string;
  helper: string;
  children: React.ReactNode;
}

function Row({ label, helper, children }: RowProps): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-ink text-control font-medium">{label}</span>
        <span className="text-ink-muted text-caption">{helper}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
