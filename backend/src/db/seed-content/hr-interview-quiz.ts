import type { QuizQuestion } from '../../modules/quiz/schemas.js';

/**
 * 30-question HR interview screen used by the load-test demo seeder. All
 * questions are auto-gradable (mcq_single or true_false) so the load runner's
 * resulting "average score" and "accuracy" numbers are meaningful without
 * any human grading step in the loop.
 *
 * Topic coverage:
 *   1–8   Communication, professionalism, written / verbal etiquette
 *   9–14  Teamwork, collaboration, conflict resolution
 *   15–20 Time management, prioritization, ownership
 *   21–25 Ethics, integrity, confidentiality
 *   26–30 Adaptability, learning agility, customer focus
 *
 * Every option carries a stable short slug `id` so the analytics distribution
 * buckets stay consistent across re-seeds.
 */
export const HR_QUIZ_TITLE = 'HR Interview Screen — Core Professional Skills';

export const HR_QUIZ_QUESTIONS: QuizQuestion[] = [
  // ── 1–8: Communication & professionalism ────────────────────────────
  {
    id: 'q01',
    type: 'mcq_single',
    prompt:
      'A colleague sends a long email with three different questions buried in the middle. What is the most professional response?',
    options: [
      { id: 'a', text: 'Reply only to the first question and move on.', isCorrect: false },
      {
        id: 'b',
        text: 'Number each of their questions in your reply and answer them in order.',
        isCorrect: true,
      },
      { id: 'c', text: 'Forward the email to your manager so they can sort it out.', isCorrect: false },
      { id: 'd', text: 'Wait until the next standup to answer in person.', isCorrect: false },
    ],
  },
  {
    id: 'q02',
    type: 'mcq_single',
    prompt:
      'You realize halfway through a meeting that you misunderstood the agenda. The best next step is to:',
    options: [
      {
        id: 'a',
        text: 'Stay quiet and try to follow along to avoid looking unprepared.',
        isCorrect: false,
      },
      {
        id: 'b',
        text: 'Politely ask the facilitator to clarify the goal of the meeting.',
        isCorrect: true,
      },
      { id: 'c', text: 'Leave the meeting and rejoin when you have caught up.', isCorrect: false },
      {
        id: 'd',
        text: 'Send a private message to a colleague mocking the agenda.',
        isCorrect: false,
      },
    ],
  },
  {
    id: 'q03',
    type: 'true_false',
    prompt:
      'It is appropriate to use the same level of casual language in a customer-facing email as in an internal team chat.',
    correct: false,
  },
  {
    id: 'q04',
    type: 'mcq_single',
    prompt:
      'A stakeholder asks for a status update on a project that is two days behind schedule. You should:',
    options: [
      {
        id: 'a',
        text: 'Tell them everything is fine to avoid worrying them.',
        isCorrect: false,
      },
      {
        id: 'b',
        text: 'Share the current status, the cause of the delay, and the new ETA.',
        isCorrect: true,
      },
      {
        id: 'c',
        text: 'Defer the conversation until the work is back on track.',
        isCorrect: false,
      },
      {
        id: 'd',
        text: 'Forward the question to whoever caused the delay.',
        isCorrect: false,
      },
    ],
  },
  {
    id: 'q05',
    type: 'mcq_single',
    prompt: 'Which of the following is the strongest example of active listening?',
    options: [
      { id: 'a', text: 'Nodding along while drafting your reply in your head.', isCorrect: false },
      {
        id: 'b',
        text: 'Restating the speaker’s point in your own words to confirm understanding.',
        isCorrect: true,
      },
      { id: 'c', text: 'Waiting for a pause so you can share a related story.', isCorrect: false },
      { id: 'd', text: 'Taking detailed notes without making eye contact.', isCorrect: false },
    ],
  },
  {
    id: 'q06',
    type: 'true_false',
    prompt: 'Sending follow-up notes after an important meeting is a sign of professional discipline.',
    correct: true,
  },
  {
    id: 'q07',
    type: 'mcq_single',
    prompt:
      'You receive negative feedback from your manager that surprises you. The most professional first reaction is to:',
    options: [
      { id: 'a', text: 'Defend yourself immediately with counter-examples.', isCorrect: false },
      {
        id: 'b',
        text: 'Thank them, take notes, and ask clarifying questions before responding.',
        isCorrect: true,
      },
      { id: 'c', text: 'Ask for the feedback in writing so you have a record to dispute.', isCorrect: false },
      { id: 'd', text: 'Mention the feedback to peers to see if they agree.', isCorrect: false },
    ],
  },
  {
    id: 'q08',
    type: 'mcq_single',
    prompt: 'In a written message, what is the best way to convey urgency without sounding aggressive?',
    options: [
      { id: 'a', text: 'Use ALL CAPS in the subject line.', isCorrect: false },
      {
        id: 'b',
        text: 'State the deadline clearly and explain why it matters.',
        isCorrect: true,
      },
      { id: 'c', text: 'Add multiple exclamation marks at the end of sentences.', isCorrect: false },
      { id: 'd', text: 'Send the same message every hour until you get a reply.', isCorrect: false },
    ],
  },

  // ── 9–14: Teamwork, collaboration, conflict resolution ───────────────
  {
    id: 'q09',
    type: 'mcq_single',
    prompt:
      'Two teammates disagree on a technical approach. As a peer, the most constructive action is to:',
    options: [
      { id: 'a', text: 'Side with the more senior teammate to end the argument.', isCorrect: false },
      {
        id: 'b',
        text: 'Help them frame the trade-offs and surface the decision criteria.',
        isCorrect: true,
      },
      { id: 'c', text: 'Stay out of it — it is not your problem.', isCorrect: false },
      { id: 'd', text: 'Escalate to a manager immediately.', isCorrect: false },
    ],
  },
  {
    id: 'q10',
    type: 'true_false',
    prompt:
      'Disagreement on a team is unhealthy and should be avoided whenever possible.',
    correct: false,
  },
  {
    id: 'q11',
    type: 'mcq_single',
    prompt:
      'You notice a coworker is consistently missing deadlines that affect your work. The best first step is to:',
    options: [
      { id: 'a', text: 'Complain to your manager about them privately.', isCorrect: false },
      {
        id: 'b',
        text: 'Talk to them directly, ask about blockers, and see if you can help.',
        isCorrect: true,
      },
      { id: 'c', text: 'Cover for them silently to avoid awkwardness.', isCorrect: false },
      { id: 'd', text: 'Stop depending on them in your plans.', isCorrect: false },
    ],
  },
  {
    id: 'q12',
    type: 'mcq_single',
    prompt: 'Which behavior most strongly signals being a team player?',
    options: [
      { id: 'a', text: 'Volunteering for highly visible work only.', isCorrect: false },
      {
        id: 'b',
        text: 'Sharing credit, asking for help when stuck, and helping unblock others.',
        isCorrect: true,
      },
      { id: 'c', text: 'Finishing your own tasks early and logging off.', isCorrect: false },
      { id: 'd', text: 'Always agreeing with the group to keep the peace.', isCorrect: false },
    ],
  },
  {
    id: 'q13',
    type: 'true_false',
    prompt: 'Giving credit to a colleague in front of leadership undermines your own standing.',
    correct: false,
  },
  {
    id: 'q14',
    type: 'mcq_single',
    prompt: 'A respectful way to handle a tense disagreement in a meeting is to:',
    options: [
      {
        id: 'a',
        text: 'Speak more loudly than the other person so your point lands.',
        isCorrect: false,
      },
      {
        id: 'b',
        text: 'Acknowledge their point, then explain where you see it differently.',
        isCorrect: true,
      },
      { id: 'c', text: 'Roll your eyes to signal you disagree.', isCorrect: false },
      { id: 'd', text: 'Drop the topic and bring it up later behind their back.', isCorrect: false },
    ],
  },

  // ── 15–20: Time management & ownership ───────────────────────────────
  {
    id: 'q15',
    type: 'mcq_single',
    prompt: 'You have three tasks due today and only time for two. The best move is to:',
    options: [
      { id: 'a', text: 'Pick the easiest two so you can mark them done.', isCorrect: false },
      {
        id: 'b',
        text: 'Surface the conflict to your manager early and propose a prioritization.',
        isCorrect: true,
      },
      { id: 'c', text: 'Work late hoping you can finish all three.', isCorrect: false },
      { id: 'd', text: 'Pick the one your favorite stakeholder asked for.', isCorrect: false },
    ],
  },
  {
    id: 'q16',
    type: 'true_false',
    prompt: 'Saying "I will get back to you with a real ETA" is more professional than guessing a date you cannot hit.',
    correct: true,
  },
  {
    id: 'q17',
    type: 'mcq_single',
    prompt: 'A clear sign someone takes ownership of their work is that they:',
    options: [
      { id: 'a', text: 'Only escalate problems after they are already on fire.', isCorrect: false },
      {
        id: 'b',
        text: 'Flag risks early, propose options, and follow through to completion.',
        isCorrect: true,
      },
      { id: 'c', text: 'Always say yes to new requests regardless of capacity.', isCorrect: false },
      { id: 'd', text: 'Avoid asking questions so they look self-sufficient.', isCorrect: false },
    ],
  },
  {
    id: 'q18',
    type: 'mcq_single',
    prompt:
      'You miss an internal deadline because of a blocker outside your control. The right way to communicate is:',
    options: [
      { id: 'a', text: 'Stay quiet until someone asks where the work is.', isCorrect: false },
      {
        id: 'b',
        text: 'Notify stakeholders proactively, explain the blocker, and share a recovery plan.',
        isCorrect: true,
      },
      { id: 'c', text: 'Blame the team that caused the blocker.', isCorrect: false },
      { id: 'd', text: 'Move the deadline in the tracker without telling anyone.', isCorrect: false },
    ],
  },
  {
    id: 'q19',
    type: 'true_false',
    prompt:
      'Tracking your own commitments in a personal task list is a form of accountability.',
    correct: true,
  },
  {
    id: 'q20',
    type: 'mcq_single',
    prompt: 'When estimating effort for a new task, the most accurate approach is usually to:',
    options: [
      { id: 'a', text: 'Pick the most optimistic estimate to motivate yourself.', isCorrect: false },
      {
        id: 'b',
        text: 'Break the task into smaller steps and estimate each, including review and testing.',
        isCorrect: true,
      },
      { id: 'c', text: 'Match the estimate to what your manager wants to hear.', isCorrect: false },
      { id: 'd', text: 'Always estimate exactly one week, regardless of scope.', isCorrect: false },
    ],
  },

  // ── 21–25: Ethics, integrity, confidentiality ────────────────────────
  {
    id: 'q21',
    type: 'mcq_single',
    prompt:
      'A peer asks you to share confidential salary information about another colleague. You should:',
    options: [
      { id: 'a', text: 'Share it, but ask them not to tell anyone else.', isCorrect: false },
      {
        id: 'b',
        text: 'Decline politely and explain that compensation details are confidential.',
        isCorrect: true,
      },
      { id: 'c', text: 'Share an approximate range instead of the exact number.', isCorrect: false },
      { id: 'd', text: 'Share it only if they share something in return.', isCorrect: false },
    ],
  },
  {
    id: 'q22',
    type: 'true_false',
    prompt:
      'It is acceptable to use a friend’s login credentials to access an internal system if your own account is temporarily locked.',
    correct: false,
  },
  {
    id: 'q23',
    type: 'mcq_single',
    prompt: 'You discover an honest mistake in a report you already sent leadership. The right move is to:',
    options: [
      { id: 'a', text: 'Hope nobody notices the error.', isCorrect: false },
      {
        id: 'b',
        text: 'Send a correction promptly, explain what changed, and update the underlying source.',
        isCorrect: true,
      },
      { id: 'c', text: 'Quietly fix the document and re-share it without comment.', isCorrect: false },
      { id: 'd', text: 'Blame the data source for the error.', isCorrect: false },
    ],
  },
  {
    id: 'q24',
    type: 'mcq_single',
    prompt:
      'A recruiter friend at another company asks you for confidential roadmap information about your team. You should:',
    options: [
      { id: 'a', text: 'Share only the publicly announced parts.', isCorrect: false },
      {
        id: 'b',
        text: 'Decline entirely and remind them you cannot share internal information.',
        isCorrect: true,
      },
      { id: 'c', text: 'Share it informally if they promise not to tell.', isCorrect: false },
      { id: 'd', text: 'Trade information so it feels fair.', isCorrect: false },
    ],
  },
  {
    id: 'q25',
    type: 'true_false',
    prompt:
      'Owning a mistake quickly and publicly is generally more career-positive than hiding it.',
    correct: true,
  },

  // ── 26–30: Adaptability, learning, customer focus ────────────────────
  {
    id: 'q26',
    type: 'mcq_single',
    prompt:
      'Your team’s priorities shift mid-quarter and several of your projects are deprioritized. The most professional response is to:',
    options: [
      { id: 'a', text: 'Push back hard so your work is not deprioritized.', isCorrect: false },
      {
        id: 'b',
        text: 'Understand the reasoning, document where the old work landed, and reorient.',
        isCorrect: true,
      },
      { id: 'c', text: 'Keep working on the old priorities anyway.', isCorrect: false },
      { id: 'd', text: 'Disengage until things settle down.', isCorrect: false },
    ],
  },
  {
    id: 'q27',
    type: 'true_false',
    prompt:
      'Asking thoughtful questions in your first 30 days at a new job is a sign of weakness.',
    correct: false,
  },
  {
    id: 'q28',
    type: 'mcq_single',
    prompt:
      'A customer is unhappy with a feature that works as designed. The healthiest response is to:',
    options: [
      { id: 'a', text: 'Tell them the feature is working correctly and end the conversation.', isCorrect: false },
      {
        id: 'b',
        text: 'Listen to the underlying problem they are trying to solve, then explore options.',
        isCorrect: true,
      },
      { id: 'c', text: 'Promise to change the feature without checking with your team.', isCorrect: false },
      { id: 'd', text: 'Suggest they switch to a competitor.', isCorrect: false },
    ],
  },
  {
    id: 'q29',
    type: 'mcq_single',
    prompt: 'Which is the strongest sign of a "growth mindset"?',
    options: [
      { id: 'a', text: 'Believing your skills are mostly fixed at birth.', isCorrect: false },
      {
        id: 'b',
        text: 'Treating feedback and setbacks as inputs to improvement.',
        isCorrect: true,
      },
      { id: 'c', text: 'Never showing uncertainty in front of teammates.', isCorrect: false },
      { id: 'd', text: 'Avoiding tasks where you might fail.', isCorrect: false },
    ],
  },
  {
    id: 'q30',
    type: 'mcq_single',
    prompt:
      'Three months in, you realize a process your team follows is wasteful. The best way to raise it is to:',
    options: [
      { id: 'a', text: 'Complain about it in a group chat.', isCorrect: false },
      {
        id: 'b',
        text: 'Bring data, propose a concrete change, and invite feedback from the team.',
        isCorrect: true,
      },
      { id: 'c', text: 'Stay quiet — you are still new and shouldn’t suggest changes.', isCorrect: false },
      { id: 'd', text: 'Quietly skip the process when nobody is watching.', isCorrect: false },
    ],
  },
];
