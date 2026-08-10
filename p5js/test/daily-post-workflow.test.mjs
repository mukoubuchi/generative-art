import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { P5JS_DIRECTORY } from "../lib/catalog.mjs";

/**
 * The nightly workflow's token handling is an ordering, and the ordering is the safety:
 * look before spending, spend before storing, store before posting. It lives in YAML the
 * unit suite cannot execute, so its shape is pinned here the way the badges are — read
 * back and checked against what the design requires, rather than trusted to stay true
 * through the next well-meant edit.
 */
const workflow = await readFile(
  resolve(P5JS_DIRECTORY, "..", ".github/workflows/daily-post.yml"),
  "utf8"
);
const schedule = JSON.parse(await readFile(resolve(P5JS_DIRECTORY, "schedule.json"), "utf8"));

function stepIndex(name) {
  const index = workflow.indexOf(`- name: ${name}`);
  assert.notEqual(index, -1, `the workflow has no step named "${name}"`);
  return index;
}

/** The `if:` guard of a named step: the first `if:` line after its name. */
function guardOf(name) {
  const from = stepIndex(name);
  const match = workflow.slice(from).match(/^\s*if: (.+)$/mu);
  assert.ok(match, `the "${name}" step has no condition at all`);
  return match[1];
}

test("the day is looked up before any token is touched", () => {
  const lookup = stepIndex("Look up the day's entry");
  const refresh = stepIndex("Refresh the X access token");
  const store = stepIndex("Store the rotated refresh token");
  const post = stepIndex("Render and prepare post");

  assert.ok(lookup < refresh, "the lookup must come before the refresh it gates");
  assert.ok(refresh < store, "the refresh produces what the store stores");
  assert.ok(store < post, "storing after posting strands the chain when a post fails");
});

test("an empty day spends nothing, unless the run is a rehearsal", () => {
  for (const name of ["Refresh the X access token", "Store the rotated refresh token"]) {
    const guard = guardOf(name);
    assert.ok(
      guard.includes("steps.today.outputs.artwork != ''"),
      `"${name}" runs even when nothing is scheduled`
    );
    // The rehearsal rotates the chain on purpose, with nothing riding on it. That is what
    // a rehearsal is for, so it must not be gated on the schedule.
    assert.ok(
      guard.includes("inputs.rehearse_tokens"),
      `"${name}" cannot be rehearsed on an empty day`
    );
  }
});

test("the refresh and its store share one condition", () => {
  // If the two guards ever differ, there is an input for which a token is spent and its
  // replacement thrown away with the runner.
  assert.equal(
    guardOf("Refresh the X access token"),
    guardOf("Store the rotated refresh token")
  );
});

test("the cron fires at midnight in the schedule's own time zone", () => {
  assert.equal(schedule.timeZone, "Asia/Tokyo");
  assert.match(workflow, /^\s*- cron: "0 15 \* \* \*"$/mu);
});
