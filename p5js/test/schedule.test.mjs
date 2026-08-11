import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog } from "../lib/catalog.mjs";
import { dateInZone, loadSchedule, scheduledPost, validateSchedule } from "../lib/schedule.mjs";

const catalog = await loadCatalog();

function scheduleOf(...posts) {
  return { version: 1, timeZone: "Asia/Tokyo", posts };
}

test("the committed schedule names artworks the manifest has, once each", async () => {
  const schedule = await loadSchedule(catalog.manifest);
  const named = schedule.posts.map((post) => post.artwork);

  assert.equal(new Set(named).size, named.length);
  assert.equal(new Set(schedule.posts.map((post) => post.date)).size, named.length);
  for (const artwork of named) {
    assert.ok(catalog.manifest.artworks.some((candidate) => candidate.id === artwork));
  }
});

/**
 * Artworks finished and merged but not yet given a posting date; scheduling one retires
 * its line here. Kept as an explicit roster so that no artwork can be in neither place:
 * finished work missing from both would be work nobody will ever post, silently.
 */
const AWAITING_SCHEDULE = [
  "moebius-band",
  "ulam-spiral",
  "hilbert-curve",
  "cafe-wall",
  "dla-frost",
  "circle-packing",
  "moire-rings",
  "lorenz-ribbon"
];

test("every artwork is scheduled, or named as still waiting for a date", async () => {
  const schedule = await loadSchedule(catalog.manifest);
  const scheduled = new Set(schedule.posts.map((post) => post.artwork));
  for (const artwork of catalog.manifest.artworks) {
    // Exactly one of the two: a waiting entry that gets scheduled must leave the roster,
    // and an artwork in neither place fails rather than being quietly forgotten.
    assert.notEqual(
      scheduled.has(artwork.id),
      AWAITING_SCHEDULE.includes(artwork.id),
      `${artwork.id} must be either scheduled or on the waiting roster, and not both`
    );
  }
  assert.equal(scheduled.size + AWAITING_SCHEDULE.length, catalog.manifest.artworks.length);
});

test("a schedule is rejected before it can post the wrong thing", () => {
  const good = catalog.manifest.artworks[0].id;
  const other = catalog.manifest.artworks[1].id;

  assert.throws(
    () => validateSchedule(scheduleOf({ date: "2026-08-12", artwork: "no-such-artwork" }), catalog.manifest),
    /the manifest does not have/
  );
  assert.throws(
    () => validateSchedule(
      scheduleOf({ date: "2026-08-12", artwork: good }, { date: "2026-08-12", artwork: other }),
      catalog.manifest
    ),
    /out of order|posts twice/
  );
  assert.throws(
    () => validateSchedule(
      scheduleOf({ date: "2026-08-13", artwork: good }, { date: "2026-08-12", artwork: other }),
      catalog.manifest
    ),
    /out of order/
  );
  assert.throws(
    () => validateSchedule(
      scheduleOf({ date: "2026-08-12", artwork: good }, { date: "2026-08-13", artwork: good }),
      catalog.manifest
    ),
    /more than once/
  );
  assert.throws(
    () => validateSchedule(scheduleOf({ date: "12 August", artwork: good }), catalog.manifest),
    /invalid date/
  );
  assert.throws(
    () => validateSchedule({ ...scheduleOf(), timeZone: "Mars/Olympus" }, catalog.manifest),
    /unknown time zone/
  );
});

test("the day is read where the schedule is kept, not where the runner is", () => {
  // The cron fires at 15:00 UTC, which is the next day in Tokyo. Reading the date off the
  // runner's clock would look up the previous day's entry every single night.
  const fired = new Date("2026-08-11T15:00:00Z");
  assert.equal(dateInZone("Asia/Tokyo", fired), "2026-08-12");
  assert.equal(dateInZone("UTC", fired), "2026-08-11");
});

test("a day with nothing on it looks up as nothing", async () => {
  const schedule = await loadSchedule(catalog.manifest);
  assert.equal(scheduledPost(schedule, "1999-01-01"), undefined);
  assert.equal(scheduledPost(schedule, schedule.posts[0].date).artwork, schedule.posts[0].artwork);
});
