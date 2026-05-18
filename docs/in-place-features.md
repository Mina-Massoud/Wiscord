# In-Place Features

Brainstorm — features that **live where they're useful**, not in their own tab. Same Gen Z energy as the current activity overlay + quiz waiting state. No settings pages. No new top-level routes. Everything slots into surfaces that already exist.

The rule: if a feature needs you to leave the voice channel to use it, the feature is wrong.

---

## The Calendar problem (fix first)

The calendar is buried in its own route. People don't go check a calendar — they want the calendar to come to them. Move it into surfaces that catch the user mid-flow:

### Voice idle "Up next" card

When you're on the voice grid (not in an activity), the empty-state card at the top of the grid shows:

```
┌──────────────────────────────────────────┐
│  📅  Up next                             │
│      Calc study · in 1h 12m              │
│      Mina, Sam, Ali going                │
│                          [ Remind me ]   │
└──────────────────────────────────────────┘
```

- One card max. Shows the next event in this channel (or this server, if no channel-scoped event).
- 2h before → "in 1h 12m"
- 5 min before → "starts in 5 min — joining lobby"
- During → "Live now — Mina is hosting"

Same data we already have, just rendered in-place.

### "Joining soon" toast

5 minutes before a scheduled event you said you'd attend, soft toast pops up: *"Calc study in 5 min. Joining lobby?"* with a Join button. One click, you're in the right voice channel.

### Activity header → next-up strip

While you're in an activity, a tiny bar at the bottom of the chrome shows the next scheduled thing in the channel: *"Next: Pomodoro at 4:00 PM"*. Doesn't interrupt — it's just there.

### Calendar as a widget, not a page

Keep the calendar route for power use, but kill the "go to calendar to see what's next" mental model. The calendar feeds in-place widgets everywhere.

---

## Voice channel — surface-level vibes

### Energy meter

Tiny bar at the top of the voice grid showing the room's energy. Aggregates:
- How many mics are on
- Typing activity in the activity (Notes/Whiteboard)
- Quiz answers landing

Three states: 🌱 *low key* / 🔥 *locked in* / 💤 *fading*. Teacher (or anyone) can glance and know.

### Whisper mode

A toggle on the voice control bar: 🤫 *whisper*. When on, your mic auto-ducks loud volumes, sensitivity boosts whisper-level input. For late-night study where you don't want to wake the house.

### Soundboard pins

Pin 4 short sounds per channel — favorite ad-lib, study chime, victory horn. Tap → plays to everyone. Limit 4 so it doesn't become Discord soundboard hell.

### Channel mood

Set a one-word mood per channel: `locked in`, `chill`, `chaos`, `study sesh`. Shows above the participant tiles. Changeable on the fly. Just personality, no logic.

### Wallpaper hour

The voice channel wallpaper shifts subtly by time of day. Late-night auto-tints warmer. Pre-dawn cool blue. Tiny detail, big feel.

---

## On the user tile

### Status line — but useful

Already have presence + activityKind. Add a one-line status the user sets themselves:
- `prepping for calc final`
- `figuring out arpeggios`
- `vibes only`

Shows under the name on hover. Sets the room's tone without anyone having to ask.

### Streak chip

Tiny number next to the avatar — `12d`. Days you showed up. Tooltip explains. Not a leaderboard, just yours. Resets at midnight local. Click → "what's a streak?" mini-explainer.

### "Currently learning" pin

User profile carries 1–3 tags: `Piano`, `Spanish A2`, `Calc 2`. Shows in tooltip. Future: surface to teacher discovery, or auto-suggest people in the same channel learning the same thing.

### Now-playing chip

Spotify/Apple Music presence under the name — *"♫ Lo-fi beats to study to"*. Discord has it; people love it. Soft opt-in.

### Birthday / milestone confetti

On someone's birthday, their voice tile gets a subtle confetti loop for the day. Same for a 100-hour focus milestone. No announcements, just the visual.

---

## In the activity area

### Reaction confetti

Tap a button on a participant tile during an activity — a tiny emoji floats up from their tile: `🔥` `💯` `🤯`. Ephemeral, no chat clutter. Mostly for the during-quiz / during-whiteboard moments.

### "I'm stuck" hand

Press `?` while in an activity → tiny hand icon appears on your tile + private DM ping to the activity host. No interruption, no awkward "raising hand."

### Anonymous temperature check

Floating button: 🌡️. Anyone can hit it to fire a 10-second anonymous poll to the channel — *"Got it"* / *"Lost"* / *"Slow down"*. Bar chart appears in the activity header for 30s. Best when students don't want to be the one to ask.

### Goal card

Pin a goal at the top of the activity: *"By end of today: finish chapter 3."* Anyone in the channel can check it off when done. Confetti when 100%. Stays pinned across the session, snapshots with the canvas.

### Cool-down timer

Hit the timer chip → "10 min break" overlay on the activity. All mics auto-mute, the whiteboard freezes, a soft animation runs. After 10 min, room un-freezes with a chime. Brain breaks built in.

### Race mode (in quiz)

Quiz has a hidden "race" toggle for the host. When on, first correct answer wins a star. Top 3 by stars at the end. Voluntary leaderboard.

### Inside-jokes button

Each channel has a tiny "++" button on the user tile. Tap → it plays the channel's signature sound or phrase. Built up over time, like an inside joke that compounds.

---

## Between sessions (async, in-place)

### "Bring me up to speed"

You join a channel where people are mid-activity. A pill at the top of the activity: *"Catch up · last 5 min"*. Tap → plays the recording fast-forward, scrubs through the whiteboard delta, shows what notes got added. 30 seconds, you're caught up.

### Voice notes pinned

Pin a 30-second voice memo to the channel — *"Today's intention"* / *"Today's prompt"*. Plays automatically when you next open the channel, then sits in the sidebar.

### Late check-in

Join late → soft toast pops on the channel: *"Welcome back, Mina. Sam just hit chapter 3."* No interruption, just orientation. Reads recent activity state and summarizes.

### Drop-in invites

When someone you've studied with before joins voice, a tiny chip appears in your sidebar: *"Mina just joined #calc — drop in?"* One click, you're there. Opt-in per person.

### Smart "notify when"

On any user's profile: *"Notify me when Mina is in voice next."* Once. No repeat without re-subscribing.

---

## Shared listening / watching by default

### Drop-a-link → watch together

Paste a YouTube link in any channel chat → preview card with a single *"Watch together with everyone in voice"* button. One click → activity launches for everyone in the voice channel. No "start activity → pick source" friction.

### Spotify shared queue (later)

A channel has a shared queue. Anyone adds songs. Plays through everyone's voice (with consent). Skip needs 50% vote. Lofi background by default.

### Sync background

Voice channels carry an ambient background sound — coffee shop, rain, lofi. Same volume across everyone. Toggle off if it's a serious session.

---

## Profile / discovery (without being LinkedIn)

### Profile cards that say something

Three things visible on a profile tooltip:
- Current learning tags (`Piano`, `Spanish A2`)
- Streak (`12d`)
- "Vibes" — a one-line bio the user writes once

That's it. No portfolio, no resume, no DMs preview.

### Find your people

A side panel (not a route) inside any channel sidebar: *"People learning Piano in this server."* List of names, current presence dots. Spawns natural drop-ins.

### Study buddies

After studying with someone for 3+ sessions, they become a "study buddy" — their card pins to your sidebar. Soft, opt-out-able. Builds the friend graph from real co-presence, not connect requests.

---

## Notifications that respect you

### "Quiet window"

Inside any voice channel, no notifications fire for that channel — you're already there. Other channels still poke through unless you set "do not disturb" globally. This already happens implicitly; surface it.

### Smart batches

Async messages in text channels batch into one digest if you weren't around. *"5 things happened in #calc-help while you were out — open."* Not 5 separate red dots.

### Streak reminders, not shame

Streak about to break → soft toast at the user's *preferred* time, not 11:59 PM panic. *"5-min stretch to keep your streak?"* Skip is a button, not a guilt trip.

---

## Goal-tracking that doesn't suck

### Today's pin

At the top of the user panel: a one-line goal you set this morning. *"Finish chapter 3."* Tap to mark done — small confetti, then it disappears. Don't carry over to tomorrow; it's today only.

### Weekly arc

A subtle progress ring around your avatar that fills based on weekly study hours toward a goal you set. No notifications, no "you're behind" guilt. Just a visual.

### Co-op quests

A channel can pin a shared multi-day goal: *"Get through chapter 5 by Sunday."* Everyone's contribution adds up. Progress bar in the channel header. Confetti when done.

---

## Voice-channel-as-coworking energy

### Body double mode

Toggle: *"Body double · soft presence."* You stay in voice with mic muted. Soft white-noise floor. Tile dims when others are body-doubling too. Nobody talks, but you're not alone.

### Silent study queue

Channel-level toggle: *"Silent · no voice."* Everyone can join, mics force-mute, voice tiles show focus rings instead. Activity area is the real surface. For when conversation would derail.

### Shared focus session

One person hits "Start a 50/10 cycle." Everyone in the channel gets a timer in their chrome — synced. When the 10-min break hits, everyone's mics unmute briefly, then re-mute. Coordinated focus blocks without anyone running them.

---

## Gen Z language passes worth doing

Audit existing copy for tone. Current bad-vs-better samples:

| Today | Better |
|---|---|
| "Loading…" | "Loading… one sec." / "Pulling up…" |
| "Error: failed to connect" | "Couldn't reach the server. Try again?" |
| "Are you sure?" | "Cool with that?" |
| "Submit" | (specific verb — "Send", "Ship it", "Post") |
| "No data" | "Nothing here yet." / "Empty for now." |
| "Profile" | "You" |
| "Settings" | "Settings" (some things should stay literal) |

Don't overdo it. The vibe is *low-friction friendly*, not *trying too hard*. One Gen Z phrase per surface, not three.

---

## What this lets us NOT do

If we ship even half of this, we don't need:
- A separate "Activity Feed" tab — events surface where they belong
- A "Notifications" page — toasts + presence carry the load
- A "Friends" page — the friend graph builds itself from co-presence
- A "Calendar" page as a primary surface — widgets do 80% of the job
- A "Profile" page worth visiting — the hover-card is enough
- A "Settings" wizard for the first session — defaults are warm

The product feels smaller, not bigger, as we add these.

---

## Picking what to ship next

Easy 1–day shippables that punch above their weight:
- **Voice idle "Up next" card** (fixes the calendar feel-bad)
- **Status line under the name** (user-set, free-form)
- **Streak chip on avatar** (just a number, big psychological lift)
- **"Bring me up to speed" button** (uses existing snapshots — 1 day)
- **Channel mood** (one-word vibe, in the channel header)

The ones worth a real week:
- **Energy meter** (aggregates existing signals into one chip)
- **Cool-down timer** (interrupts activities cleanly — needs cross-activity hook)
- **Anonymous temperature check** (new presence-style stream)
- **Goal card pinned to activity** (uses snapshot + a checkbox model)
- **Sync background sound** (LiveKit audio routing — fiddly but cool)

The bigger bets:
- **Lesson Replay** of the activity timeline (recording pipeline)
- **Spotify shared queue** (third-party integration, OAuth)
- **Body double mode** (mic detection + dim states)

---

## One framing rule, restated

> If a feature has its own route, it failed.
>
> Everything good slots into the voice channel, the activity area, or the user tile. The product should look the same a year from now — just more alive in the same spaces.
