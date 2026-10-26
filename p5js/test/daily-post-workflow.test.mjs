import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { P5JS_DIRECTORY } from "../lib/catalog.mjs";
import { queueDecision, renderNotice } from "../lib/queue-status.mjs";

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

/** A named step's whole block: from its name to the next step's, or to the end. */
function blockOf(name) {
  const from = stepIndex(name);
  const next = workflow.indexOf("- name:", from + 1);
  return next === -1 ? workflow.slice(from) : workflow.slice(from, next);
}

test("the queue is reported after the night's post, and cannot take it down", () => {
  const post = stepIndex("Render and prepare post");
  const report = stepIndex("Report the queue level");
  assert.ok(post < report, "the count must describe the queue as the night leaves it");
  // A missed reminder is recoverable in a way a missed post is not: the report may fail
  // without failing the run, and it speaks only on scheduled runs that actually publish.
  assert.match(blockOf("Report the queue level"), /continue-on-error: true/u);
  assert.equal(
    guardOf("Report the queue level"),
    "env.PUBLISH == 'true' && env.ARTWORK_INPUT == ''"
  );
});

test("the report runs on empty nights and sits out the rehearsals", () => {
  const guard = guardOf("Report the queue level");
  // No looked-up artwork condition: the final notice belongs to the night nothing is scheduled.
  assert.ok(!guard.includes("steps.today.outputs.artwork"));
  // No rehearse_tokens: a token rehearsal is not a posting night and must stay silent.
  assert.ok(!guard.includes("rehearse_tokens"));
});

function evaluateReportGuard(workflowText, { eventName, inputs = {} }) {
  const artworkExpr = workflowText.match(/^\s*ARTWORK_INPUT:\s*\$\{\{\s*(.+?)\s*\}\}$/mu)?.[1];
  const publishExpr = workflowText.match(/^\s*PUBLISH:\s*\$\{\{\s*(.+?)\s*\}\}$/mu)?.[1];
  assert.ok(artworkExpr, "missing ARTWORK_INPUT job env expression");
  assert.ok(publishExpr, "missing PUBLISH job env expression");

  const github = { event_name: eventName };
  const normalizedInputs = {
    artwork: inputs.artwork ?? "",
    enable_posting: inputs.enable_posting ?? false,
    rehearse_tokens: inputs.rehearse_tokens ?? false,
    rehearse_queue_notice: inputs.rehearse_queue_notice ?? ""
  };
  const env = {
    ARTWORK_INPUT: String(
      new Function("github", "inputs", `return (${artworkExpr});`)(github, normalizedInputs) ?? ""
    ),
    PUBLISH: String(
      Boolean(new Function("github", "inputs", `return (${publishExpr});`)(github, normalizedInputs))
    )
  };
  const from = workflowText.indexOf("- name: Report the queue level");
  const guard = workflowText.slice(from).match(/^\s*if: (.+)$/mu)?.[1];
  assert.ok(guard, "missing Report the queue level guard");
  return Boolean(new Function("github", "inputs", "env", `return (${guard});`)(github, normalizedInputs, env));
}

test("a manual one-off artwork post does not report the queue or close the issue", () => {
  const openIssue = { open: true, recordedLastDate: null, noticeDates: [] };
  const today = "2026-10-27";

  // Scheduled cron runs and manual schedule runs still report the queue.
  assert.equal(evaluateReportGuard(workflow, { eventName: "schedule" }), true);
  assert.equal(
    evaluateReportGuard(workflow, {
      eventName: "workflow_dispatch",
      inputs: { artwork: "", enable_posting: true }
    }),
    true
  );
  assert.equal(
    evaluateReportGuard(workflow, {
      eventName: "workflow_dispatch",
      inputs: { artwork: "", enable_posting: false }
    }),
    false
  );

  // Manual one-off post of a specific artwork skips queue-status.mjs, so the open issue is not
  // falsely told "Nothing was posted tonight" or closed.
  const oneOffContext = {
    eventName: "workflow_dispatch",
    inputs: { artwork: "not-in-the-field", enable_posting: true }
  };
  const shouldRunFixed = evaluateReportGuard(workflow, oneOffContext);
  assert.equal(shouldRunFixed, false);
  const fixedOutcome = shouldRunFixed ? queueDecision(schedule, today, openIssue) : null;
  assert.equal(fixedOutcome, null);

  // Negative control: removing "&& env.ARTWORK_INPUT == ''" from the workflow guard runs
  // queue-status.mjs after a manual one-off post, falsely emitting "Nothing was posted tonight"
  // and closing the issue.
  const mutatedWorkflow = workflow.replace(
    "if: env.PUBLISH == 'true' && env.ARTWORK_INPUT == ''",
    "if: env.PUBLISH == 'true'"
  );
  assert.notEqual(mutatedWorkflow, workflow);
  const shouldRunMutated = evaluateReportGuard(mutatedWorkflow, oneOffContext);
  assert.equal(shouldRunMutated, true);
  const mutatedOutcome = shouldRunMutated ? queueDecision(schedule, today, openIssue) : null;
  assert.equal(mutatedOutcome?.act, "notice");
  assert.equal(mutatedOutcome?.kind, "final");
  assert.equal(mutatedOutcome?.close, true);
  assert.match(renderNotice(mutatedOutcome, today), /Nothing was posted tonight/u);
});

test("the queue steps hold the repository token and never an X secret", () => {
  for (const name of ["Report the queue level", "Rehearse the queue notice"]) {
    const block = blockOf(name);
    assert.match(block, /GH_TOKEN: \$\{\{ github\.token \}\}/u);
    assert.ok(!block.includes("secrets."), `"${name}" reaches into the secret store`);
    assert.ok(!block.includes("X_"), `"${name}" touches the X pipeline's environment`);
  }
});

test("the rehearsal fires only when asked with a date", () => {
  assert.equal(guardOf("Rehearse the queue notice"), "inputs.rehearse_queue_notice != ''");
});

test("the workflow may write issues, read contents, and nothing else", () => {
  const block = workflow.match(/^permissions:\n((?:  [a-z-]+: [a-z-]+\n)+)/mu);
  assert.ok(block, "the workflow declares no permissions block");
  assert.deepEqual(
    block[1].trim().split("\n").map((line) => line.trim()).sort(),
    ["contents: read", "issues: write"]
  );
});
