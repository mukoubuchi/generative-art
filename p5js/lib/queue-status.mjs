import { scheduledPost } from "./schedule.mjs";

/**
 * A queue that runs out does so silently: the cron keeps firing, every night is a correct
 * green no-op, and nobody is told. These functions decide when the nightly run should say
 * something about the queue itself, and what.
 *
 * The channel is one repository issue, because a comment there reaches the owner's inbox
 * through GitHub's own notifications — no new credential, and no address written down
 * anywhere. The decision is a pure function of three things the run already has: the
 * schedule, the date, and a snapshot of that issue. The issue is also where the state
 * lives — whether it is open, which dates its comments already cover, and the last
 * scheduled date its body recorded when it closed — so nothing is ever reset by hand:
 * refilling the schedule changes the inputs, and the decisions follow.
 */

/** The exact title the runner finds the issue by; renaming it would orphan the state. */
export const ISSUE_TITLE = "Posting queue status";

/** Nights that leave this many scheduled posts, or fewer, are told the count. */
export const LOW_WATER = 10;

/*
 * Every notice carries its date in a marker, and the next run reads the markers before it
 * speaks, which is what makes re-running a night idempotent. A rehearsal's marker is
 * deliberately a different word: the dedup that guards live notices must never see one,
 * or rehearsing a date would silence the real notice when the date arrives.
 */
const NOTICE_MARKER = /<!-- queue-status (\d{4}-\d{2}-\d{2}) -->/gu;
const REHEARSAL_MARKER = /<!-- queue-status-rehearsal (\d{4}-\d{2}-\d{2}) -->/gu;
const RECORDED_LAST_DATE = /<!-- last-scheduled-date: (\d{4}-\d{2}-\d{2}) -->/u;

const REFILL =
  "To refill, append future dates to the `posts` array in `p5js/schedule.json` — "
  + '`{ "date": "YYYY-MM-DD", "artwork": "<manifest id>" }`, dates ascending, each artwork '
  + "at most once, so a refill usually begins by registering new artworks in "
  + "`p5js/manifest.json`. `npm test --prefix p5js` checks the file, and these notices "
  + "manage themselves from its dates.";

/** The notice dates already present in a set of comment bodies, live and rehearsed apart. */
export function noticeDates(commentBodies) {
  const dates = { notices: [], rehearsals: [] };
  for (const body of commentBodies) {
    for (const [, date] of body.matchAll(NOTICE_MARKER)) {
      dates.notices.push(date);
    }
    for (const [, date] of body.matchAll(REHEARSAL_MARKER)) {
      dates.rehearsals.push(date);
    }
  }
  return dates;
}

/** The last scheduled date a closed issue's body recorded, or null when it never closed. */
export function recordedLastDate(issueBody) {
  return issueBody?.match(RECORDED_LAST_DATE)?.[1] ?? null;
}

/**
 * What tonight's run should do about the queue.
 *
 * @param schedule a validated schedule
 * @param today the date in the schedule's own zone, as "YYYY-MM-DD"
 * @param issue null when no status issue exists, else the snapshot the runner read back:
 *        { open, recordedLastDate, noticeDates }
 * @returns { act: "none", reason } or { act: "notice", kind: "low" | "final", ... }
 */
export function queueDecision(schedule, today, issue) {
  const tonight = scheduledPost(schedule, today);
  const remaining = schedule.posts.filter((post) => post.date > today).length;
  const last = schedule.posts.at(-1) ?? null;

  if (issue?.noticeDates.includes(today)) {
    return { act: "none", reason: "tonight's notice is already on the issue" };
  }
  if (tonight) {
    if (remaining > LOW_WATER) {
      return { act: "none", reason: `${remaining} scheduled posts remain, which needs no saying` };
    }
    // Every low night speaks, the last post's night included: the reader hears that the
    // queue is empty while there is still an evening to do something about it.
    return {
      act: "notice", kind: "low", timeZone: schedule.timeZone,
      tonight, remaining, last,
      reopen: issue !== null && !issue.open, close: false
    };
  }
  if (last !== null && last.date > today) {
    // A date with no entry while later dates exist is a deliberate pause, not exhaustion.
    return { act: "none", reason: "nothing tonight, but later dates exist" };
  }
  if (issue !== null && !issue.open && issue.recordedLastDate === (last?.date ?? null)) {
    return { act: "none", reason: "the final notice for this schedule has been sent" };
  }
  // The first empty night: one more comment, marked final, and the issue closes. The last
  // date recorded at that closing is what lets a refill speak again with no manual reset —
  // a longer schedule no longer matches it, and the silence rule above stops applying.
  return {
    act: "notice", kind: "final", timeZone: schedule.timeZone,
    tonight: undefined, remaining: 0, last,
    reopen: false, close: true
  };
}

/** The status issue's body; given a date, records it as the era the final notice closed. */
export function renderIssueBody(lastDate = null) {
  const body =
    "Nightly reports on the posting queue in `p5js/schedule.json`, written by the "
    + "daily-post workflow after the night's posting step.\n\n"
    + `- More than ${LOW_WATER} scheduled posts left: silence.\n`
    + `- ${LOW_WATER} or fewer: a comment each posting night, with the count.\n`
    + "- Queue exhausted: one final comment, and the issue closes.\n\n"
    + "Appending future dates to the schedule is the whole reset: the notices, and the "
    + "reopening, follow from the file.";
  return lastDate === null ? body : `${body}\n\n<!-- last-scheduled-date: ${lastDate} -->`;
}

/** The comment a notice decision comes to, as Markdown. */
export function renderNotice(decision, today, { rehearsal = false } = {}) {
  const lines = [];
  if (decision.kind === "low") {
    const { tonight, remaining, last } = decision;
    const standing = remaining === 0
      ? "**No scheduled posts remain** — tonight's was the last in the queue."
      : `**${remaining}** scheduled ${remaining === 1 ? "post remains" : "posts remain"} `
        + `after tonight; the last is \`${last.artwork}\` on **${last.date}**.`;
    lines.push(
      `**${today}** (${decision.timeZone}) — tonight's post was \`${tonight.artwork}\`. ${standing}`,
      "",
      REFILL
    );
  } else {
    const ending = decision.last === null
      ? "The schedule has no entries at all."
      : `The last scheduled entry was \`${decision.last.artwork}\` on **${decision.last.date}**.`;
    lines.push(
      `**This is the final notice.** Nothing was posted tonight — **${today}** `
      + `(${decision.timeZone}) has no entry, and no later date has one. ${ending} `
      + "The nightly run keeps firing and keeps finding nothing; an empty night touches "
      + "no token and spends nothing.",
      "",
      REFILL,
      "",
      "This issue now closes and stays quiet. New dates reopen it with their first "
      + "notice; nothing needs resetting by hand."
    );
  }
  if (rehearsal) {
    return [
      `<!-- queue-status-rehearsal ${today} -->`,
      "",
      `**Rehearsal.** A manual run asked what the notice for **${today}** would say. `
      + "Nothing has been posted, no live notice has fired, and the nightly run does not "
      + "read rehearsal markers, so the real notice for this date will still be sent. "
      + "The text it will send:",
      "",
      "---",
      "",
      ...lines
    ].join("\n");
  }
  return [`<!-- queue-status ${today} -->`, "", ...lines].join("\n");
}
