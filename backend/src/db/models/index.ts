// Barrel: import { User, MagicLinkToken } from '@/db/models'
export { User } from './User.js';
export type { UserDoc, UserRow } from './User.js';
export { MagicLinkToken } from './MagicLinkToken.js';
export type { MagicLinkTokenDoc, MagicLinkTokenRow } from './MagicLinkToken.js';
export { Quiz } from './Quiz.js';
export type { QuizDoc, QuizDocShape, LiveState } from './Quiz.js';
export { QuizAttempt } from './QuizAttempt.js';
export type { QuizAttemptDoc, QuizAttemptDocShape, AnswerShape } from './QuizAttempt.js';
export { ChannelWhiteboard } from './ChannelWhiteboard.js';
export type { ChannelWhiteboardDoc, ChannelWhiteboardRow } from './ChannelWhiteboard.js';
export { ChannelNotes } from './ChannelNotes.js';
export type { ChannelNotesDoc, ChannelNotesRow } from './ChannelNotes.js';
export {
  CalendarCategory,
  CALENDAR_CATEGORY_COLOR_SLUGS,
  CALENDAR_BUILTIN_SLUGS,
} from './CalendarCategory.js';
export type {
  CalendarCategoryDoc,
  CalendarCategoryRow,
  CalendarCategoryScope,
  CalendarCategoryColor,
  CalendarBuiltinSlug,
} from './CalendarCategory.js';
export { CalendarEvent } from './CalendarEvent.js';
export type {
  CalendarEventDoc,
  CalendarEventRow,
  CalendarRecurrence,
  CalendarRecurrenceFreq,
} from './CalendarEvent.js';
export { MediaAsset, MEDIA_KINDS } from './MediaAsset.js';
export type { MediaAssetDoc, MediaAssetRow, MediaKind } from './MediaAsset.js';
