import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog } from "../lib/catalog.mjs";
import { loadSchedule } from "../lib/schedule.mjs";
import {
  ISSUE_TITLE,
  LOW_WATER,
  noticeDates,
  queueDecision,
  recordedLastDate,
  renderIssueBody,
  renderNotice
} from "../lib/queue-status.mjs";

/**
 * The queue notices exist to break a silence, so the thing to test is that they speak on
 * exactly the right nights and no others. The first test replays the whole first run,
 * night by night, against the real schedule — which also guarantees these tests cannot
 * pass vacuously — and the rest pin the boundaries one at a time: the night before the
 * threshold, the night after the final notice, the refill that speaks again, and the
 * rehearsal that must never be mistaken for the real thing.
 */
const { manifest } = await loadCatalog();
const schedule = await loadSchedule(manifest);

function* days(from, to) {
  for (let at = new Date(`${from}T00:00:00Z`); ; at = new Date(at.getTime() + 86_400_000)) {
    const day = at.toISOString().slice(0, 10);
    if (day > to) {
      return;
    }
    yield day;
  }
}

/** Replays nightly runs, evolving the issue snapshot the way the runner's actions would. */
function simulate(subject, from, to) {
  const notices = [];
  let issue = null;
  for (const today of days(from, to)) {
    const decision = queueDecision(subject, today, issue);
    if (decision.act === "none") {
      continue;
    }
    notices.push({ today, ...decision });
    issue ??= { open: true, recordedLastDate: null, noticeDates: [] };
    if (decision.reopen) {
      issue.open = true;
    }
    issue.noticeDates = [...issue.noticeDates, today];
    if (decision.close) {
      issue.open = false;
      issue.recordedLastDate = decision.last?.date ?? null;
    }
  }
  return notices;
}

test("the first run's era, replayed night by night", () => {
  assert.equal(schedule.posts.length, 25, "the schedule this replay rests on has moved");
  const notices = simulate(schedule, "2026-08-11", "2026-09-30");

  // Eleven low nights and one final notice; every other night in the window is silent.
  assert.equal(notices.length, 12);
  assert.equal(notices[0].today, "2026-08-26");
  assert.equal(notices[0].tonight.artwork, "flow-field");
  for (const [index, notice] of notices.slice(0, 11).entries()) {
    assert.equal(notice.kind, "low");
    assert.equal(notice.remaining, LOW_WATER - index);
  }
  const final = notices.at(-1);
  assert.equal(final.today, "2026-09-06");
  assert.equal(final.kind, "final");
  assert.equal(final.close, true);
  assert.equal(final.last.date, "2026-09-05");
});

test("a healthy queue is not worth a comment", () => {
  // The negative controls: the first cron night of all, and the last night above the
  // threshold. Eleven remaining is not yet low; ten is.
  assert.equal(queueDecision(schedule, "2026-08-12", null).act, "none");
  assert.equal(queueDecision(schedule, "2026-08-25", null).act, "none");
  assert.equal(queueDecision(schedule, "2026-08-26", null).act, "notice");
});

test("a night never comments twice", () => {
  const commented = { open: true, recordedLastDate: null, noticeDates: ["2026-08-26"] };
  assert.equal(queueDecision(schedule, "2026-08-26", commented).act, "none");
  const finalNight = { open: true, recordedLastDate: null, noticeDates: ["2026-09-06"] };
  assert.equal(queueDecision(schedule, "2026-09-06", finalNight).act, "none");
});

test("the final notice is sent once, and the nights after it are quiet", () => {
  const closed = { open: false, recordedLastDate: "2026-09-05", noticeDates: [] };
  assert.equal(queueDecision(schedule, "2026-09-07", closed).act, "none");
  assert.equal(queueDecision(schedule, "2026-10-01", closed).act, "none");
});

test("refilling the schedule speaks again with nobody resetting anything", () => {
  const closed = { open: false, recordedLastDate: "2026-09-05", noticeDates: [] };
  const refilled = {
    ...schedule,
    posts: [
      ...schedule.posts,
      { date: "2026-09-15", artwork: "encore-one" },
      { date: "2026-09-16", artwork: "encore-two" }
    ]
  };
  const low = queueDecision(refilled, "2026-09-15", closed);
  assert.equal(low.act, "notice");
  assert.equal(low.kind, "low");
  assert.equal(low.reopen, true, "a resumed queue must reopen the closed issue");
  // A refill that has itself already lapsed earns its own final notice: the recorded
  // date no longer matches, so the old one cannot keep the new exhaustion quiet.
  const lapsed = queueDecision(refilled, "2026-09-20", closed);
  assert.equal(lapsed.kind, "final");
});

test("a pause is not exhaustion", () => {
  const paused = {
    ...schedule,
    posts: schedule.posts.filter((post) => post.date !== "2026-09-01")
  };
  const active = { open: true, recordedLastDate: null, noticeDates: [] };
  // Mid-low-period, a night with no entry but later dates: silence, not a final notice.
  assert.equal(queueDecision(paused, "2026-09-01", active).act, "none");
});

test("a low notice says the number, the horizon, and where to refill", () => {
  const decision = queueDecision(schedule, "2026-08-26", null);
  const text = renderNotice(decision, "2026-08-26");
  assert.ok(text.includes("<!-- queue-status 2026-08-26 -->"));
  for (const piece of ["**10**", "flow-field", "spring-polygon", "2026-09-05", "p5js/schedule.json", "Asia/Tokyo"]) {
    assert.ok(text.includes(piece), `the notice does not mention ${piece}`);
  }
  // The renderer and the parser agree on the marker, or dedup dies quietly.
  assert.deepEqual(noticeDates([text]), { notices: ["2026-08-26"], rehearsals: [] });
});

test("the last posting night is told the queue is empty", () => {
  const text = renderNotice(queueDecision(schedule, "2026-09-05", null), "2026-09-05");
  assert.match(text, /No scheduled posts remain/u);
});

test("the final notice names itself", () => {
  const decision = queueDecision(schedule, "2026-09-06", null);
  const text = renderNotice(decision, "2026-09-06");
  assert.ok(text.includes("This is the final notice."));
  assert.ok(text.includes("<!-- queue-status 2026-09-06 -->"));
  assert.ok(text.includes("spring-polygon"));
});

test("a rehearsal can never silence the real notice", () => {
  const decision = queueDecision(schedule, "2026-08-26", null);
  const text = renderNotice(decision, "2026-08-26", { rehearsal: true });
  assert.ok(text.includes("Rehearsal"));
  const parsed = noticeDates([text]);
  assert.deepEqual(parsed.notices, [], "the live dedup must not see a rehearsal's marker");
  assert.deepEqual(parsed.rehearsals, ["2026-08-26"]);
});

test("no notice carries an address", () => {
  // The channel works because GitHub knows where to deliver it; the text never has to.
  for (const today of ["2026-08-26", "2026-09-05", "2026-09-06"]) {
    for (const rehearsal of [false, true]) {
      const text = renderNotice(queueDecision(schedule, today, null), today, { rehearsal });
      assert.doesNotMatch(text, /\S+@\S+/u);
    }
  }
  assert.doesNotMatch(renderIssueBody("2026-09-05"), /\S+@\S+/u);
});

test("the issue body carries the recorded date only when given one", () => {
  assert.equal(recordedLastDate(renderIssueBody("2026-09-05")), "2026-09-05");
  assert.equal(recordedLastDate(renderIssueBody()), null);
});

test("the issue is found by an exact, stable title", () => {
  // The title is the address of the state. Renaming it would orphan the recorded date
  // and every dedup marker, so a change here must be a decision, not a drive-by.
  assert.equal(ISSUE_TITLE, "Posting queue status");
});
