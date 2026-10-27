/**
 * Where the site's CI gets its browsers from, and what still decides whether it publishes.
 *
 * The build and the check on the published site run in Playwright's own image, which already
 * holds Chromium, WebKit and the system libraries they need, so neither job downloads those
 * libraries from the Ubuntu archive. That download is what ran six builds out of their twenty
 * minutes on 2026-10-26 and 27. The image only works at the Playwright release it was made
 * for, since Playwright looks for the browsers of its own version, so its tag is held here to
 * the version the lockfile pins. Moving the jobs into a container must not move publishing
 * either: deploying still waits on the deploy input, which only a workflow_dispatch run carries.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { repositoryPath } from "../lib/catalog.mjs";

const workflow = await readFile(repositoryPath(".github/workflows/pages.yml"), "utf8");
const lock = JSON.parse(await readFile(repositoryPath("p5js/package-lock.json"), "utf8"));
const manifest = JSON.parse(await readFile(repositoryPath("p5js/package.json"), "utf8"));
const PINNED = lock.packages["node_modules/playwright"].version;

/** The jobs that open a browser: the build and its checks, and the check on the live site. */
const BROWSER_JOBS = ["build", "verify-published"];

/** A job's own lines, from its name to the next job at the same indentation. */
function jobText(text, name) {
  const start = text.indexOf(`\n  ${name}:\n`);
  if (start === -1) {
    return null;
  }
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][a-z-]*:\n/u);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

/** What keeps a browser job from running in the image the lockfile pins, as complaints. */
function browserJobProblems(text, pinned) {
  const problems = [];
  for (const name of BROWSER_JOBS) {
    const job = jobText(text, name);
    if (job === null) {
      problems.push(`${name}: no such job`);
      continue;
    }
    const container = job.match(/^ {4}container:\n {6}image: (\S+)\n {6}options: (.+)$/mu);
    if (!container) {
      problems.push(`${name}: does not run in a container`);
      continue;
    }
    if (container[1] !== `mcr.microsoft.com/playwright:v${pinned}-noble`) {
      problems.push(`${name}: runs in ${container[1]}, but the lockfile pins Playwright ${pinned}`);
    }
    // Read as arguments, so that `--user 10010` is not taken for `--user 1001`.
    const options = container[2].trim().split(/\s+/u);
    const user = options.indexOf("--user");
    if (user === -1 || options[user + 1] !== "1001") {
      problems.push(`${name}: its container does not start as user 1001`);
    }
    if (!options.includes("--ipc=host")) {
      problems.push(`${name}: its container starts without --ipc=host`);
    }
    if (!/^ {4}defaults:\n {6}run:\n {8}shell: bash$/mu.test(job)) {
      problems.push(`${name}: its run steps fall back to sh`);
    }
    // The image is the whole point. Installing with `--with-deps`, or running `install-deps`,
    // fetches the browsers' system libraries from the Ubuntu archive again, which is the slow
    // path this replaced; a plain browser install would fetch only the browsers themselves.
    if (/playwright install-deps|playwright install[^\n]*--with-deps/u.test(job)) {
      problems.push(`${name}: installs browser system libraries of its own`);
    }
  }
  return problems;
}

/** What would let the workflow publish without being asked to, as complaints. */
function publishingProblems(text) {
  const problems = [];
  const deploy = jobText(text, "deploy");
  if (deploy === null || !/^ {4}needs: build$/mu.test(deploy) || !/^ {4}if: inputs\.deploy$/mu.test(deploy)) {
    problems.push("deploy: no longer waits on the build and the deploy input");
  }
  if (!/^ {6}deploy:\n {8}description: [^\n]+\n {8}required: true\n {8}default: false\n {8}type: boolean$/mu.test(text)) {
    problems.push("the deploy input is no longer a boolean that defaults to false");
  }
  return problems;
}

test("the browser jobs run in Playwright's image at the version the lockfile pins", () => {
  // package.json pins the release exactly, so the lockfile cannot move to another one on its
  // own; the image follows whichever release that is.
  assert.equal(manifest.dependencies.playwright, PINNED);
  assert.deepEqual(browserJobProblems(workflow, PINNED), []);
});

test("publishing still waits on the deploy input that only a workflow_dispatch run carries", () => {
  assert.deepEqual(publishingProblems(workflow), []);
});

test("the checks say no to a workflow that is wrong", () => {
  // Each sample is the real workflow with one fault put into it, so that a check that never
  // complains cannot pass for one that found nothing to complain about.
  const older = workflow.replaceAll(`playwright:v${PINNED}-noble`, "playwright:v1.61.0-noble");
  assert.ok(browserJobProblems(older, PINNED).some((problem) => problem.includes("lockfile pins")));

  const bare = workflow.replace(
    /( {2}verify-published:\n[\s\S]*?) {4}container:\n {6}image: \S+\n {6}options: .+\n/u,
    "$1"
  );
  assert.ok(browserJobProblems(bare, PINNED).includes("verify-published: does not run in a container"));

  const installing = workflow.replace(
    "      - name: Run unit tests\n",
    "      - name: Install browsers\n        run: npx playwright install --with-deps chromium\n\n      - name: Run unit tests\n"
  );
  assert.ok(browserJobProblems(installing, PINNED).includes("build: installs browser system libraries of its own"));

  const otherUser = workflow.replace("--user 1001 --ipc=host", "--user 10010 --ipc=host");
  assert.ok(browserJobProblems(otherUser, PINNED).includes("build: its container does not start as user 1001"));

  const otherIpc = workflow.replace("--user 1001 --ipc=host", "--user 1001 --ipc=hostile");
  assert.ok(browserJobProblems(otherIpc, PINNED).includes("build: its container starts without --ipc=host"));

  const sh = workflow.replace("    defaults:\n      run:\n        shell: bash\n", "");
  assert.ok(browserJobProblems(sh, PINNED).includes("build: its run steps fall back to sh"));

  const ungated = workflow.replace("    if: inputs.deploy\n", "");
  assert.ok(publishingProblems(ungated).length > 0);
});
