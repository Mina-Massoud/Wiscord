import { nanoid } from 'nanoid';

/**
 * Hand-rolled tldraw record builders for the load-test swarm.
 *
 * Rather than instantiate a full headless tldraw editor (which pulls
 * DOM + React + a 480 KB bundle), we ship valid records straight at
 * the wire protocol. The shapes match the v5 schema validators in
 * `@tldraw/tlschema` exactly — keep these in lock-step with the
 * `*ShapeProps` definitions if you bump the tldraw version.
 */

const DEFAULT_PAGE_ID = 'page:page' as const;

export type TldrawRecord =
  | TldrawShapeRecord
  | TldrawPresenceRecord;

interface TldrawShapeRecord {
  id: string;
  typeName: 'shape';
  type: 'geo' | 'text' | 'note';
  x: number;
  y: number;
  rotation: number;
  index: string;
  parentId: string;
  isLocked: boolean;
  opacity: number;
  meta: Record<string, never>;
  props: Record<string, unknown>;
}

interface TldrawPresenceRecord {
  id: string;
  typeName: 'instance_presence';
  userId: string;
  userName: string;
  lastActivityTimestamp: number;
  followingUserId: null;
  cursor: { x: number; y: number; type: 'default'; rotation: number };
  color: string;
  camera: { x: number; y: number; z: number };
  screenBounds: { x: number; y: number; w: number; h: number };
  selectedShapeIds: never[];
  currentPageId: typeof DEFAULT_PAGE_ID;
  brush: null;
  scribbles: never[];
  chatMessage: string;
  meta: Record<string, never>;
}

const SHAPE_COLORS = [
  'blue',
  'green',
  'orange',
  'red',
  'violet',
  'yellow',
  'light-blue',
  'light-green',
] as const;

const NOTE_PHRASES = [
  'gn study session',
  'wait what',
  'lol',
  'idea: try recursion',
  'TODO: ask prof',
  'hi from the load swarm',
  'this slaps',
  'pomodoro 3 done',
  'big oof',
  'lecture notes here',
  'cooking now',
  'real',
  'ok focus',
  'sticky note vibes',
  'send help',
] as const;

const TEXT_PHRASES = [
  'hello',
  'wiscord',
  'study',
  'focus',
  'group sesh',
  'brainstorm',
  'midterms',
  'finals soon',
  'lecture',
  'office hours',
  'big idea',
  'rough draft',
] as const;

const GEO_KINDS = ['rectangle', 'ellipse', 'diamond', 'star', 'hexagon'] as const;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)] as T;
}

function fractionalIndex(): string {
  // tldraw uses `@tldraw/store`'s fractional indexing; an alphanumeric
  // string between `a0` and `zZ` keeps shapes orderable without us
  // pulling in the full `fractional-indexing` runtime.
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const len = 4;
  let out = 'a';
  for (let i = 0; i < len; i += 1) {
    out += charset[Math.floor(Math.random() * charset.length)];
  }
  return out;
}

function richText(text: string): { type: 'doc'; content: unknown[] } {
  // Mirrors `@tldraw/tlschema`'s `toRichText(text)` exactly so the
  // server's richTextValidator accepts the record without flagging it
  // INVALID_RECORD.
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: text ? [{ type: 'text', text }] : undefined,
      },
    ],
  };
}

function makeGeoShape(x: number, y: number): TldrawShapeRecord {
  return {
    id: `shape:${nanoid()}`,
    typeName: 'shape',
    type: 'geo',
    x,
    y,
    rotation: 0,
    index: fractionalIndex(),
    parentId: DEFAULT_PAGE_ID,
    isLocked: false,
    opacity: 1,
    meta: {},
    props: {
      geo: pick(GEO_KINDS),
      w: rand(80, 240),
      h: rand(60, 180),
      color: pick(SHAPE_COLORS),
      labelColor: 'black',
      fill: 'semi',
      dash: 'draw',
      size: 'm',
      font: 'draw',
      align: 'middle',
      verticalAlign: 'middle',
      growY: 0,
      scale: 1,
      url: '',
      richText: richText(''),
    },
  };
}

function makeNoteShape(x: number, y: number): TldrawShapeRecord {
  return {
    id: `shape:${nanoid()}`,
    typeName: 'shape',
    type: 'note',
    x,
    y,
    rotation: 0,
    index: fractionalIndex(),
    parentId: DEFAULT_PAGE_ID,
    isLocked: false,
    opacity: 1,
    meta: {},
    props: {
      color: pick(SHAPE_COLORS),
      labelColor: 'black',
      size: 'm',
      font: 'draw',
      fontSizeAdjustment: null,
      align: 'middle',
      verticalAlign: 'middle',
      growY: 0,
      url: '',
      richText: richText(pick(NOTE_PHRASES)),
      scale: 1,
      textFirstEditedBy: null,
    },
  };
}

function makeTextShape(x: number, y: number): TldrawShapeRecord {
  return {
    id: `shape:${nanoid()}`,
    typeName: 'shape',
    type: 'text',
    x,
    y,
    rotation: 0,
    index: fractionalIndex(),
    parentId: DEFAULT_PAGE_ID,
    isLocked: false,
    opacity: 1,
    meta: {},
    props: {
      color: pick(SHAPE_COLORS),
      size: 'm',
      font: 'draw',
      textAlign: 'middle',
      w: 200,
      scale: 1,
      autoSize: true,
      richText: richText(pick(TEXT_PHRASES)),
    },
  };
}

export function makeRandomShape(): TldrawShapeRecord {
  const x = rand(-800, 800);
  const y = rand(-500, 500);
  const roll = Math.random();
  if (roll < 0.45) return makeGeoShape(x, y);
  if (roll < 0.85) return makeNoteShape(x, y);
  return makeTextShape(x, y);
}

interface PresenceArgs {
  userId: string;
  userName: string;
  color: string;
  cursorX: number;
  cursorY: number;
}

export function makePresenceRecord(args: PresenceArgs): TldrawPresenceRecord {
  // Presence ids must be unique per session; reusing the userId keeps
  // the record stable so subsequent patches update the same row instead
  // of leaving orphaned cursors on the host's canvas.
  return {
    id: `instance_presence:${args.userId}`,
    typeName: 'instance_presence',
    userId: args.userId,
    userName: args.userName,
    lastActivityTimestamp: Date.now(),
    followingUserId: null,
    cursor: { x: args.cursorX, y: args.cursorY, type: 'default', rotation: 0 },
    color: args.color,
    camera: { x: 0, y: 0, z: 1 },
    screenBounds: { x: 0, y: 0, w: 1280, h: 800 },
    selectedShapeIds: [],
    currentPageId: DEFAULT_PAGE_ID,
    brush: null,
    scribbles: [],
    chatMessage: '',
    meta: {},
  };
}

export function randomCursorPoint(): { x: number; y: number } {
  return { x: rand(-1000, 1000), y: rand(-700, 700) };
}
