# Classroom Ideas

Brainstorm — turning Wiscord into a Discord-vibe e-learning platform. No promises, no shipping order. Just stuff that would be fun and worth thinking about.

The tagline that keeps showing up: **"Discord for class. Classroom for Discord."**

---

## The shape

A Class is just a Server with a curriculum.

A Lesson is just a voice channel with a teacher who hits Start.

A Quiz is just an activity that posts grades.

Everything else is what we already built. We just need a teacher / student role and a curriculum layer on top.

---

## Roles & vibe

- **Teacher** runs the room. Their rocket icon is gold, not blurple.
- **TA** can help — same powers as teacher minus end-of-class actions.
- **Student** is everyone else. Same Discord energy as today.
- **Guest** — drop-in for the first lesson, no grades. Useful for trial classes.
- **Roles can be per-class.** Mina is a student in piano, a teacher in calc.

---

## Class shapes

- **Cohort class** — fixed group, scheduled lessons, group chat.
- **Open class** — drop-in study room, no schedule, no grades.
- **1:1 lesson** — private channel, single student, scheduled.
- **Drop-in office hours** — the teacher is on, students raise hand to join.

All four are the same data model with different defaults. The only switch is "who can join."

---

## Live lesson flow

1. Teacher schedules a lesson → it appears on the student calendar.
2. 5 minutes before, students see a "Class starts soon" toast.
3. Teacher hits **Start lesson** → students get a chime, voice channel pulls them in.
4. The lesson runs through the existing activity launcher — Whiteboard for problems, Notes for shared notes, Quiz for a check-in, Screen Share for slides.
5. Teacher hits **End** → snapshot of the whiteboard + notes auto-saves to the class library, recording (if on) starts processing.
6. Students who missed it see "Recording available" in their dashboard 10 min later.

---

## The Lesson Replay

A recorded lesson isn't just a video. It's the **activity timeline** played back:

- Scrubber across the bottom
- Whiteboard rewinds in place — you can pause and the board shows what was drawn at that moment
- Notes show their editing state at that timestamp
- Audio is the teacher's voice
- "Jump to the quiz" / "Jump to question 3" markers on the scrubber

Better than Zoom recordings because each layer is structured, not pixels.

---

## Attendance + engagement (without being creepy)

- Joined the voice = attended.
- Mic was muted whole class but they were there = "passive attendance."
- Answered the in-class quiz = "engaged attendance."
- Three tiers, no surveillance, no "did they look at the camera" nonsense.
- Teacher sees the rollup; student sees their own only.

---

## Async between lessons

- Each class has a **text channel** (Discord style) for between-lesson chat.
- Teacher posts assignments here. Pinned.
- Students ask questions; AI suggested-answer hint shows under the post for the teacher to riff on or send as-is.
- Voice DMs to the teacher = async office hours. Teacher can reply with a 30-second voice memo.

---

## Assignments & grading

- Three types: **submit text**, **submit file**, **take quiz**.
- Teachers grade in a single pane: student work on the left, rubric on the right, voice memo button. Teacher records a 20-second comment, attaches a score, moves to next student.
- **Audio comments are the differentiator** — written feedback gets skimmed, voice feedback gets listened to.

---

## Grade book

- Spreadsheet vibe. Sortable. Exportable.
- Each cell has a hover-card with: the submission, the teacher's voice memo, the rubric scores.
- Filter "everyone below 70 on Quiz 3" → opens a chat panel pre-addressed to them.

---

## Student dashboard

- "Next up": next lesson + assignments due.
- "Recent": last lesson recording, last grade.
- "Streak": days you showed up. Yes it's gamification, deal with it.
- "Help": one button → teacher's office hours / DM.

---

## Teacher tools that don't exist anywhere else

### Pull a student up
Teacher clicks a student tile during a lesson → that student becomes the "active" speaker, others auto-mute, whiteboard temporarily transfers to them. "Mina, show us how you solved 3."

### Break-out rooms
Right-click the voice channel header → "split into 3 rooms." Wiscord spins up sub-channels, evenly distributes students, teacher can hop between rooms. Each room shares its own whiteboard. Hit "regroup" → everyone snaps back, sub-room whiteboards become snapshots in the main channel's library.

### Silent quiz
Teacher kicks off a quiz mid-lesson. Students answer. Teacher sees results live (existing analytics dashboard). Choose to share results or keep them private — "looks like most of you said B; can someone explain why?"

### Whiteboard tear-off
A snapshot from today's whiteboard becomes a homework problem with one click. Students get it in their dashboard.

### Cool-down timer
A focused work block during a lesson. Teacher hits "20 minutes silent work" — all mics auto-mute, a shared timer counts down on every screen, students can stay on the notes/whiteboard activity to work. Pomodoro for classrooms.

### "I'm stuck" hand
Student presses a key combo → tiny hand icon appears on their tile + private DM to teacher. No interruption to the lesson. Teacher can reply with text or jump to their tile.

---

## Music vertical — what makes it land

### Sheet music as an activity
- Render MusicXML in a shared activity.
- Play cursor moves in sync for every student in the activity.
- Teacher highlights bars in real time ("look at bar 14").
- Students can scribble fingerings on the score (whiteboard layer over the sheet).
- Snapshot saves the marked-up score to the class library.

### Practice recorder
- Student records audio in-browser.
- Submits to lesson.
- Teacher hears it later, plays back at half speed, scrubs to a problem spot, leaves a voice memo there.
- Pitch detection draws over the playhead so the student can see where they were sharp/flat.

### Backing track
- Teacher loads a backing track.
- Hits play → every student hears it in sync.
- Student plays along, their audio overlays the track.
- Teacher mutes their own playback, listens to a student's overlay, gives feedback.

### Tempo / metronome
- Shared metronome, teacher controls tempo, every student's metronome ticks in sync.
- Bonus: tempo gradually ramps up during a "1 BPM per loop" drill.

### Ear training as a quiz variant
- Audio prompt → multiple-choice answer.
- Same engine as the existing quiz, just with audio question types.

### "Listen-along" Watch activity
- Teacher plays a recording for analysis.
- Pauses to ask "what just happened in the bass?"
- Students answer in a quiz overlay.
- Resume.

### The killer demo
- Teacher screen-shares a sheet of music.
- Student plays it on their instrument, audio comes through voice.
- Teacher pauses them mid-piece → "right here, the F was flat — try again from bar 14."
- The score auto-scrolls to bar 14 on every student's screen.

That demo doesn't exist anywhere. Yousician doesn't have a teacher. Zoom doesn't have a score. Discord doesn't have a quiz. **We have all three in the same surface already.**

---

## Other verticals (template'd from music)

### Language teacher
- Pronunciation submission (record + AI feedback layer).
- Conjugation quiz with locked answers.
- Vocab flashcards as an activity (someone gets the card, others see "Mina is on flashcards").
- Live translation chat: a student types in Spanish, the teacher's tile shows them an English subtitle (Whisper + translate).

### Math teacher
- Equation editor as an activity (KaTeX bar, scribble field for working).
- Graph plotter as an activity.
- Show-your-work submissions — the student's whiteboard *is* the work.
- "Spot the error" quiz where the prompt is a wrong proof.

### Coding teacher
- Code editor activity (Monaco) with shared cursors — same Yjs sync as notes.
- Run button → outputs in a panel everyone sees.
- Test harness: teacher writes hidden tests, student code runs against them.
- Pair programming mode — two students, one editor, one rotates control every 5 minutes.

### Art teacher
- Whiteboard already does most of this.
- Add brush presets, layers, save-as-image to the existing canvas.
- "Live crit" — every student's tile is their canvas thumbnail, teacher rotates through.

---

## Discovery (if we ever go public)

- Public teacher pages — "Mina teaches Piano, Tuesdays 4 PM, $20/lesson."
- Browse classes by subject, age range, language.
- First lesson free (trial).
- Reviews from students, with teacher-can-respond.
- Class calendar embedded in the teacher's page so students can see availability.

But all of this is Phase later. Private-first ships faster.

---

## Pricing experiments worth running

- **Free tier**: 1 class, 10 students, no recordings.
- **Teacher pro**: unlimited classes, recordings, grade book — $X/month.
- **Per-student**: split between teacher and platform; teacher sets price.
- **Sponsored classes**: companies sponsor a free class on a topic ("Coding 101 by GitHub").
- **School / district plan**: per-seat, SSO, FERPA — different sales motion entirely.

Worth A/B'ing on real teachers, not picking from a whiteboard.

---

## What makes Wiscord different (the bet, plainly)

> Every other classroom tool is **shaped like a school**.
> Wiscord is **shaped like a friend group**.
>
> The same energy that gets a student to hang out in a Discord study server until 2 AM is the energy that should run their actual class. Discord's emotional default is "show up because your people are here." A classroom should feel like that. Most don't.

The technical bet:
- Realtime collab on the canvas + sheet + code + notes is *already* what students do informally.
- We surface it as the actual curriculum scaffolding.
- Teacher tools are a thin layer on top of activities that students would use anyway.

---

## Things to explicitly NOT do (yet)

- AI auto-grading of subjective work. Teachers grade.
- "AI tutor" replacing the teacher. The teacher is the product.
- Surveillance features (eye tracking, screen monitoring, fullscreen lock during quizzes). Different platform, different ethics.
- Gamified XP/level systems that turn learning into a slot machine. Streaks are fine; loot boxes are not.
- Public leaderboards across all classes. Within a class, opt-in only.

---

## Open questions for the founder

1. **Audience priority** — solo teachers first, or institutions first?
2. **Sync vs async ratio** — live-lesson-led, or self-paced with optional live?
3. **Free for whom** — free for students, paid for teacher? Free for teacher, paid for students? Both pay?
4. **First vertical** — music (clearer demo), language (bigger market), math (less crowded)?
5. **Hosted-only or self-host option?**
6. **Recording-first or live-first product story?**

Answer these and the order of the roadmap reshuffles itself.

---

## The smallest classroom MVP

If we wanted to test the idea in 3 weeks, the absolute minimum is:

1. **Add a Class concept**: a Server with `kind: 'class'` and a `teacherId`.
2. **Role-gate the activity launcher**: teachers see all activities, students see "Join existing only."
3. **Quiz becomes graded by default in a class**: scores roll up to a per-class table the teacher can see.
4. **Add `/app/classes` route** with "My classes" + a class detail page showing channels + grade table.

That's it. Everything else — sheet music, recordings, grade book exports, payments — is gravy.

Three weeks of work, and we'd know whether real teachers actually want this version of Discord.
