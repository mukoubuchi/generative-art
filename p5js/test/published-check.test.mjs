/**
 * Waiting for a deployment to be the thing that is actually being served, and refusing to
 * measure until it is.
 *
 * These are the browser-free halves of a check whose whole subject is a browser. The last one
 * matters more than it looks: the failure this apparatus exists to prevent is a check that
 * measures the wrong copy of the site and passes, so a wait that gave up and let the
 * measuring proceed would put back exactly what it was built to stop.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { repositoryPath } from "../lib/catalog.mjs";
import { BUILD_META_NAME, UNPUBLISHED_BUILD } from "../lib/gallery.mjs";
import { PROPAGATION_LIMIT_SECONDS, declaredMaxAge, waitForBuild } from "../lib/published.mjs";

const COMMIT = "a".repeat(40);
const OTHER_COMMIT = "b".repeat(40);
const stamped = (commit) => `<!doctype html><meta name="${BUILD_META_NAME}" content="${commit}">`;

test("the wait is as long as the site says it may be cached for", () => {
  // Not a number somebody liked. GitHub Pages serves `cache-control: max-age=600`, so for ten
  // minutes an edge may answer with a copy it already has, and a shorter limit would fail a
  // build for a cache doing exactly what it says. This is asserted here because the control
  // that proves the wait ends has to shorten it in order to run at all, and so cannot also
  // show what it is by default.
  assert.equal(PROPAGATION_LIMIT_SECONDS, 600);
  assert.equal(declaredMaxAge(new Headers({ "cache-control": "max-age=600" })), 600);
  assert.equal(declaredMaxAge(new Headers({ "cache-control": "no-store" })), null);
  assert.equal(declaredMaxAge(new Headers({})), null);
});

test("waiting for a commit that never arrives ends in a refusal, not in measuring anyway", async () => {
  let clock = 0;
  const asked = [];
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    return new Response(stamped(OTHER_COMMIT), {
      status: 200,
      headers: { "cache-control": "max-age=600" }
    });
  };
  try {
    const arrival = await waitForBuild({
      url: "https://example.test/index.html",
      commit: COMMIT,
      limitSeconds: 20,
      pollSeconds: 5,
      now: () => clock,
      sleep: async (ms) => { clock += ms; }
    });
    assert.equal(arrival.matched, false);
    assert.ok(arrival.waited >= 15, `gave up after ${arrival.waited}s, before the limit`);
    assert.ok(asked.length >= 3, `only ${asked.length} attempts were made`);
    // Every attempt has to be distinguishable, or an intermediary is free to answer them all
    // from one held copy and the wait could never observe a change.
    assert.equal(new Set(asked).size, asked.length, "two attempts asked for the same address");
    assert.deepEqual([...new Set(arrival.saw)], [OTHER_COMMIT]);
  } finally {
    delete globalThis.fetch;
  }
});

test("a page that cannot be reached at all is not mistaken for the one being waited for", async () => {
  let clock = 0;
  globalThis.fetch = async () => new Response("not here", { status: 404 });
  try {
    const arrival = await waitForBuild({
      url: "https://example.test/index.html",
      commit: COMMIT,
      limitSeconds: 10,
      pollSeconds: 5,
      now: () => clock,
      sleep: async (ms) => { clock += ms; }
    });
    assert.equal(arrival.matched, false);
    assert.deepEqual([...new Set(arrival.saw)], ["404"]);
  } finally {
    delete globalThis.fetch;
  }
});

test("waiting stops as soon as the commit is the one being checked", async () => {
  let clock = 0;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return new Response(stamped(attempts < 3 ? OTHER_COMMIT : COMMIT), { status: 200 });
  };
  try {
    const arrival = await waitForBuild({
      url: "https://example.test/index.html",
      commit: COMMIT,
      limitSeconds: 600,
      pollSeconds: 5,
      now: () => clock,
      sleep: async (ms) => { clock += ms; }
    });
    assert.equal(arrival.matched, true);
    assert.equal(attempts, 3);
    assert.equal(arrival.waited, 10);
  } finally {
    delete globalThis.fetch;
  }
});

test("a commit is what the published site is identified by, and nothing else is accepted", async () => {
  // A branch name or a tag would be a marker that several different builds could satisfy,
  // which is not identification.
  for (const notACommit of ["main", "v1.3.0", UNPUBLISHED_BUILD, "abc123", ""]) {
    await assert.rejects(
      () => waitForBuild({ url: "https://example.test/", commit: notACommit }),
      /is not one/u,
      `${notACommit || "an empty string"} was accepted as a commit`
    );
  }
});

test("the published check runs only where it can mean something, and outlasts its own wait", async () => {
  const workflow = await readFile(repositoryPath(".github/workflows/pages.yml"), "utf8");
  const job = workflow.slice(workflow.indexOf("  verify-published:"));
  assert.ok(job.startsWith("  verify-published:"), "there is no published check in the workflow");

  // It has to be impossible for this to run on a push. A push builds without publishing, so
  // the site it would measure is whatever was deployed last -- it would pass, every time,
  // while saying nothing at all about the commit that triggered it.
  assert.match(job, /needs: deploy/u);
  assert.match(job, /if: inputs\.deploy/u);

  // The job must outlast the wait inside it. Copying the deploy job's ten minutes would
  // cancel the run at the very moment the wait reached its limit, and a cancelled job reports
  // that it was cancelled -- not what it had been waiting for, or for how long.
  const limit = Number(job.match(/timeout-minutes: (\d+)/u)[1]);
  assert.ok(
    limit > PROPAGATION_LIMIT_SECONDS / 60,
    `the job is cut off at ${limit} minutes, inside its own ${PROPAGATION_LIMIT_SECONDS / 60}-minute wait`
  );

  // Where the site is, taken from the deployment rather than written down. A literal address
  // here would keep passing after the site moved, by measuring somewhere it no longer is.
  assert.match(job, /--base \$\{\{ needs\.deploy\.outputs\.page_url \}\}/u);
  assert.match(job, /--sha \$\{\{ github\.sha \}\}/u);
  assert.ok(!/--base https?:/u.test(job), "the published address is written into the workflow");
  assert.match(
    workflow.slice(workflow.indexOf("  deploy:"), workflow.indexOf("  verify-published:")),
    /outputs:\s*\n\s*page_url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/u
  );
});
