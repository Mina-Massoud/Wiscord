import { z } from 'zod';

// ─── Color presets ────────────────────────────────────────────────────────────

export const COLOR_PRESETS = [
    { name: 'Blurple', value: '#5865F2' },
    { name: 'Pink', value: '#EB459E' },
    { name: 'Green', value: '#57F287' },
    { name: 'Yellow', value: '#FEE75C' },
    { name: 'Red', value: '#ED4245' },
] as const;

// ─── Form schema ──────────────────────────────────────────────────────────────

export const eventFormSchema = z
    .object({
        title: z.string().trim().min(1, 'Title is required').max(100, 'Title is too long (max 100 characters)'),
        description: z.string().trim().max(2000, 'Description is too long (max 2000 characters)').optional().nullable(),
        type: z.enum(['voice_channel', 'stage_channel', 'external']),
        channelId: z.string().optional().nullable(),
        externalLink: z.string().trim().max(2048, 'URL is too long').optional().nullable(),
        startsAt: z.string().min(1, 'Start date & time is required'),
        endsAt: z.string().optional().nullable(),
        coverColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional().nullable(),
        addToCalendar: z.boolean().default(true),
    })
    .superRefine((data, ctx) => {
        if (data.type !== 'external' && !data.channelId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Channel is required for voice/stage channel events',
                path: ['channelId'],
            });
        }
        if (data.type === 'external') {
            if (!data.externalLink) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'External link is required for external events',
                    path: ['externalLink'],
                });
            } else {
                try {
                    new URL(data.externalLink);
                } catch {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Must be a valid absolute URL (e.g. https://...)',
                        path: ['externalLink'],
                    });
                }
            }
        }
        if (data.endsAt && data.startsAt && new Date(data.endsAt) <= new Date(data.startsAt)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'End date must be after start date',
                path: ['endsAt'],
            });
        }
    });

export type EventFormValues = z.infer<typeof eventFormSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converts an ISO UTC string to a value suitable for <input type="datetime-local">. */
export function toDatetimeLocal(isoString: string | null | undefined): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}