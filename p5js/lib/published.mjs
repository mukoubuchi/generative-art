/**
 * Waiting for a deployment to be the thing that is actually being served.
 *
 * `deploy-pages` finishing means the artifact has been handed over, not that a reader asking
 * for the site gets it. What answers a reader is a content network, and it is allowed to go
 * on answering with what it already has: the site declares `cache-control: max-age=600`, and
 * a request for it comes back with an `age` saying how far through that it is. So a check
 * that starts measuring the moment the deployment step goes green can measure the previous
 * deployment, find it correct, and report that the new one is.
 *
 * That is the failure this exists to prevent, and it is worth naming plainly, because it is
 * the failure the whole job is a repair for one level up: on 2026-08-13 the phone check was
 * green on every push for six hours while the site a reader opened was six hours old. A
 * published check that could be answered by a cached copy would recreate that exactly.
 */

import { readBuildStamp } from "./gallery.mjs";

/**
 * How long a stale answer stays explainable, in seconds.
 *
 * Taken from the site rather than chosen. GitHub Pages serves `cache-control: max-age=600`,
 * so for ten minutes an edge may hold a copy and answer from it, and a shorter limit would
 * fail a build for a cache behaving exactly as it says it does. A longer one buys nothing:
 * past `max-age` the copy has to be revalidated, so an answer still stale after that is no
 * longer explained by the policy, and waiting on is waiting on a fault.
 */
export const PROPAGATION_LIMIT_SECONDS = 600;

/** Between attempts. Short enough that the usual case costs a few seconds, not a minute. */
export const POLL_EVERY_SECONDS = 5;

/** A commit as GitHub states it: this is what the marker has to match to count as a match. */
const COMMIT = /^[0-9a-f]{40}$/u;

/**
 * What the response says about how long it may be held, so that the limit above can be
 * checked against the policy it was derived from instead of quietly outliving it.
 */
export function declaredMaxAge(headers) {
  const found = (headers.get("cache-control") ?? "").match(/max-age=(\d+)/u);
  return found ? Number(found[1]) : null;
}

/**
 * Fetches a page in a way that cannot be answered from anything already held: a query nobody
 * has asked before, and a request that declines to use or fill a store of its own.
 */
async function fetchFresh(url, attempt) {
  const address = new URL(url);
  address.searchParams.set("published-check", String(attempt));
  const response = await fetch(address, { cache: "no-store" });
  return { response, html: await response.text() };
}

/**
 * Waits until the page at `url` is the one built from `commit`, and reports what happened.
 *
 * Returns `{ matched, waited, saw, maxAge }`. It never throws for staleness and never
 * decides what staleness means: the caller fails on `matched === false`. What it must not do
 * is run out of patience and let the caller carry on measuring, since the whole point of the
 * marker is that measuring the wrong copy is indistinguishable from success.
 */
export async function waitForBuild({
  url,
  commit,
  limitSeconds = PROPAGATION_LIMIT_SECONDS,
  pollSeconds = POLL_EVERY_SECONDS,
  now = () => Date.now(),
  sleep = (ms) => new Promise((wake) => { setTimeout(wake, ms); }),
  note = () => {}
}) {
  if (!COMMIT.test(commit)) {
    throw new Error(
      `A published site is checked against a commit, and ${JSON.stringify(commit)} is not one.`
    );
  }

  const startedAt = now();
  const seen = [];
  let maxAge = null;
  for (let attempt = 1; ; attempt += 1) {
    const elapsed = Math.round((now() - startedAt) / 1000);
    let stamp = null;
    let status = null;
    try {
      const { response, html } = await fetchFresh(url, attempt);
      status = response.status;
      maxAge = declaredMaxAge(response.headers) ?? maxAge;
      stamp = response.ok ? readBuildStamp(html) : null;
    } catch (error) {
      status = error.message.split("\n")[0];
    }
    seen.push(stamp ?? String(status));
    // Every attempt is recorded rather than only the last. A check that fails after ten
    // minutes without saying what it kept being answered with leaves whoever reads the red
    // with nowhere to start.
    note(
      `  t=${String(elapsed).padStart(3)}s  http ${status}  live ${(stamp ?? "no marker").slice(0, 12)}`
      + `  want ${commit.slice(0, 12)}`
    );
    if (stamp === commit) {
      return { matched: true, waited: elapsed, saw: seen, maxAge };
    }
    if (elapsed + pollSeconds > limitSeconds) {
      return { matched: false, waited: elapsed, saw: seen, maxAge };
    }
    await sleep(pollSeconds * 1000);
  }
}
