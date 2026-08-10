#!/usr/bin/env node

import { loadCatalog } from "../lib/catalog.mjs";
import { dateInZone, loadSchedule, scheduledPost } from "../lib/schedule.mjs";

/**
 * Prints the artwork scheduled for today — today in the schedule's own time zone — or
 * nothing at all.
 *
 * It exists so the workflow can ask the question *before* it spends anything. A refresh
 * consumes the stored refresh token, and storing the replacement is the one step whose
 * failure strands the chain; a night with nothing scheduled used to run that gamble anyway
 * and then find out. The answer has to come from the same lookup the pipeline itself will
 * make, which is why this is these two functions and not a reimplementation.
 */
const { manifest } = await loadCatalog();
const schedule = await loadSchedule(manifest);
const post = scheduledPost(schedule, dateInZone(schedule.timeZone));
if (post) {
  console.log(post.artwork);
}
