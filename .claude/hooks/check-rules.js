#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const filePath = payload?.tool_input?.file_path;
  if (!filePath || typeof filePath !== "string") process.exit(0);

  const isFrontend = filePath.includes("/frontend/src/");
  const isBackend = filePath.includes("/backend/src/");
  if (!isFrontend && !isBackend) process.exit(0);
  if (!/\.(tsx?|jsx?)$/.test(filePath)) process.exit(0);

  // shadcn drops are upstream-owned per CLAUDE.md — skip
  if (filePath.includes("/frontend/src/components/ui/")) process.exit(0);
  // Test files are allowed to use console.log etc.
  if (/\.(test|spec)\.tsx?$/.test(filePath)) process.exit(0);

  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    process.exit(0);
  }

  const violations = [];

  if (isFrontend) {
    if (/type=["']time["']/.test(content)) {
      violations.push(
        'Native `<input type="time">` — use `<CalendarTimeField>` from @/components/calendar/CalendarTimeField',
      );
    }
    if (/type=["']date["']/.test(content)) {
      violations.push(
        'Native `<input type="date">` — never the browser-native date input; build/use a shadcn-based date picker',
      );
    }
    if (/<select[\s>]/.test(content)) {
      violations.push(
        "Raw `<select>` — use shadcn `<Select>` from @/components/ui/select",
      );
    }
    if (/<dialog[\s>]/.test(content)) {
      violations.push(
        "Raw `<dialog>` — use shadcn `<Dialog>` from @/components/ui/dialog",
      );
    }
    if (/from ["']sonner["']/.test(content)) {
      violations.push(
        "`sonner` import — never re-introduce sonner; use the custom `@/lib/toast` singleton",
      );
    }
    if (/(^|[^./\w])console\.log\(/m.test(content)) {
      violations.push(
        "`console.log` — use `logger.info` / `logger.warn` / `logger.error` from @/lib/logger (frontend/CLAUDE.md)",
      );
    }
    if (/(^|[^.\w])alert\(/m.test(content)) {
      violations.push("`alert()` — use shadcn `<AlertDialog>` instead");
    }
    if (/(^|[^.\w])confirm\(/m.test(content)) {
      violations.push("`confirm()` — use shadcn `<AlertDialog>` instead");
    }

    // Hex literals in Tailwind arbitrary value classes
    const hexMatch = content.match(
      /(?:bg|text|border|from|to|via|fill|stroke|ring|shadow|outline|decoration|accent|caret)-\[#[0-9a-fA-F]{3,8}\]/,
    );
    if (hexMatch) {
      violations.push(
        `Hex literal in Tailwind arbitrary value \`${hexMatch[0]}\` — add a named token to tailwind.config.ts and use the semantic class instead`,
      );
    }

    // Arbitrary pixel typography in components
    const arbTypoMatch = content.match(/\btext-\[\d+(?:px|rem)\]/);
    if (arbTypoMatch) {
      violations.push(
        `Arbitrary typography size \`${arbTypoMatch[0]}\` — use the named UI scale (text-badge / text-caption / text-control / text-tab / text-subhead / text-body / text-display)`,
      );
    }

    // Tailwind's built-in text-xs/sm/base/lg/xl... should not appear in app components
    const builtinTypoMatch = content.match(
      /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b/,
    );
    if (builtinTypoMatch) {
      violations.push(
        `Built-in Tailwind text size \`${builtinTypoMatch[0]}\` — frontend/CLAUDE.md requires the named UI scale (text-badge…text-display)`,
      );
    }

    // Raw fetch() outside src/queries/
    if (
      !filePath.includes("/frontend/src/queries/") &&
      /(^|[^.\w])fetch\(/m.test(content)
    ) {
      violations.push(
        "Raw `fetch()` outside `src/queries/` — use a typed query hook from @/queries (frontend/CLAUDE.md)",
      );
    }

    // Third-party brand surfaces must use real logo assets, not lucide stand-ins.
    // The lucide-react icons below are brand marks for specific companies — if
    // you import one, you're rendering a fake logo. Drop the real PNG under
    // public/logo/<service>.webp instead (see frontend/CLAUDE.md → "Third-party
    // brand surfaces use the real brand logo").
    const lucideImportMatch = content.match(/from\s+["']lucide-react["']\s*;?/);
    if (lucideImportMatch) {
      // Pull every named import from any lucide-react import statement.
      const importRegex = /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/g;
      const imported = new Set();
      let m;
      while ((m = importRegex.exec(content)) !== null) {
        for (const raw of m[1].split(",")) {
          const name = raw
            .trim()
            .split(/\s+as\s+/)[0]
            .trim();
          if (name) imported.add(name);
        }
      }
      const BRAND_ICONS = [
        "Github",
        "Youtube",
        "Twitter",
        "Facebook",
        "Linkedin",
        "Twitch",
        "Instagram",
        "Slack",
        "Chrome",
        "Figma",
        "Dribbble",
        "Codepen",
      ];
      const offending = BRAND_ICONS.filter((n) => imported.has(n));
      if (offending.length > 0) {
        violations.push(
          `Lucide brand-mark icon(s) ${offending
            .map((n) => "`" + n + "`")
            .join(
              ", ",
            )} — never substitute lucide for a real brand logo. Download the official PNG, convert via scripts/img-to-webp.sh, place under public/logo/<service>.webp, and render with <img src="/logo/<service>.webp">. (frontend/CLAUDE.md → "Third-party brand surfaces use the real brand logo")`,
        );
      }
      // Soft pairing: lucide `Music` icon used in a file that also names
      // Spotify / Apple Music / Tidal / Deezer / SoundCloud → likely a fake
      // logo. Same idea for `Headphones` and `Disc`/`Disc3`.
      const MUSIC_BRAND_NAMES =
        /\b(Spotify|Apple Music|Tidal|Deezer|SoundCloud|YouTube Music)\b/;
      const musicShaped = [
        "Music",
        "Music2",
        "Headphones",
        "Disc",
        "Disc3",
      ].filter((n) => imported.has(n));
      if (musicShaped.length > 0 && MUSIC_BRAND_NAMES.test(content)) {
        violations.push(
          `Lucide ${musicShaped
            .map((n) => "`" + n + "`")
            .join(
              ", ",
            )} icon next to a music-service brand name — render the real brand logo under /logo/<service>.webp instead of a generic music glyph. (frontend/CLAUDE.md → "Third-party brand surfaces use the real brand logo")`,
        );
      }
    }

    // GenZ tone reminder for new toast text (low-signal nudge, not a block-grade rule):
    // intentionally NOT enforced as a violation — left as a note in the catch-all below.
  }

  if (isBackend) {
    if (/from ["']@supabase/.test(content)) {
      violations.push(
        "Supabase import on backend — Wiscord is Express + Mongoose + MongoDB; no Supabase, ever (memory: no_supabase)",
      );
    }
    if (/createClient\s*\(.*supabase/is.test(content)) {
      violations.push(
        "Supabase `createClient` call on backend — Wiscord uses Mongoose models; translate to the Express equivalent",
      );
    }
  }

  if (violations.length === 0) process.exit(0);

  const rel = path.relative(process.cwd(), filePath);
  process.stderr.write(`[claude-hook] CLAUDE.md violations in ${rel}:\n`);
  for (const v of violations) process.stderr.write(`  - ${v}\n`);
  process.stderr.write(
    "\nFix these before continuing. The hook scans the file as written; remove the offending pattern and the next edit will pass.\n",
  );
  process.exit(2);
});
