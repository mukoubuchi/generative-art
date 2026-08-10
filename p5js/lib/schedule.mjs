import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { P5JS_DIRECTORY } from "./catalog.mjs";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * What posts on a given day is written down rather than worked out. The alternative — a
 * rule that turns the date into an index — has to be re-derived every time an artwork is
 * added or the run is paused, and the answer it gives cannot be read off the page before
 * the day arrives. A list of dates can be reviewed, and a queue is refilled by appending
 * to it.
 *
 * The schedule carries no state of its own: nothing is written back after a post. That
 * keeps the pipeline safe to run twice on the same input, and it keeps the repository from
 * having a file whose history is a log of what a robot did.
 */
export function validateSchedule(schedule, manifest) {
  if (schedule.version !== 1 || !Array.isArray(schedule.posts)) {
    throw new Error("schedule.json must use version 1 and contain a posts array.");
  }
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: schedule.timeZone });
  } catch {
    throw new Error(`schedule.json has an unknown time zone: ${schedule.timeZone}`);
  }

  const known = new Set(manifest.artworks.map((artwork) => artwork.id));
  const seenDates = new Set();
  const seenArtworks = new Set();
  let previousDate = "";

  for (const post of schedule.posts) {
    if (!DATE_PATTERN.test(post.date) || Number.isNaN(Date.parse(`${post.date}T00:00:00Z`))) {
      throw new Error(`schedule.json has an invalid date: ${post.date}`);
    }
    // Ascending order is not needed to look a date up, but a list that reads down the page
    // in the order it will happen is the point of writing it out at all.
    if (post.date <= previousDate) {
      throw new Error(`schedule.json is out of order at ${post.date}.`);
    }
    if (seenDates.has(post.date)) {
      throw new Error(`schedule.json posts twice on ${post.date}.`);
    }
    if (!known.has(post.artwork)) {
      throw new Error(`schedule.json names an artwork the manifest does not have: ${post.artwork}`);
    }
    if (seenArtworks.has(post.artwork)) {
      throw new Error(`schedule.json posts ${post.artwork} more than once.`);
    }
    if (post.quote !== undefined && typeof post.quote !== "string") {
      throw new Error(`schedule.json has an invalid quote override on ${post.date}.`);
    }
    seenDates.add(post.date);
    seenArtworks.add(post.artwork);
    previousDate = post.date;
  }
  return schedule;
}

export async function loadSchedule(manifest) {
  const schedule = JSON.parse(await readFile(resolve(P5JS_DIRECTORY, "schedule.json"), "utf8"));
  return validateSchedule(schedule, manifest);
}

/**
 * The calendar date where the schedule is kept, which is not the runner's. The cron fires
 * at 15:00 UTC so that it lands at midnight in Tokyo, and midnight in Tokyo is the previous
 * day in UTC — reading the date off the runner would post yesterday's artwork every night.
 */
export function dateInZone(timeZone, instant = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(instant);
}

export function scheduledPost(schedule, date) {
  return schedule.posts.find((post) => post.date === date);
}
