#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadCatalog } from "../lib/catalog.mjs";
import { dateInZone, loadSchedule } from "../lib/schedule.mjs";
import {
  ISSUE_TITLE,
  noticeDates,
  queueDecision,
  recordedLastDate,
  renderIssueBody,
  renderNotice
} from "../lib/queue-status.mjs";

/**
 * Speaks for the queue: reads the "Posting queue status" issue, asks lib/queue-status.mjs
 * what tonight's run should say, and says it there. Every judgement is in that pure
 * module; this file only ferries state in and comments out, through the gh CLI with the
 * workflow's own repository token. It never handles an X credential, so the night the
 * queue is empty it can still speak while the pipeline rightly touches nothing.
 *
 * --rehearse <date> posts what that date's notice would say, on the same issue and
 * through the same renderer, but marked as a rehearsal: none of the state moves — no
 * reopen, no close, no recorded date — and its marker is not the one the nightly dedup
 * reads, so rehearsing a date can never silence the real notice. It exists to prove the
 * channel end to end (issue, comment, inbox) months before the first live notice is due.
 */

const run = promisify(execFile);

async function gh(...ghArguments) {
  const { stdout } = await run("gh", ghArguments);
  return stdout;
}

function parseArguments(argumentsList) {
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    if (argumentsList[index] === "--rehearse" && argumentsList[index + 1]) {
      options.rehearse = argumentsList[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown or incomplete option: ${argumentsList[index]}`);
  }
  if (options.rehearse !== undefined && !/^\d{4}-\d{2}-\d{2}$/u.test(options.rehearse)) {
    throw new Error("--rehearse takes a date in the form YYYY-MM-DD.");
  }
  return options;
}

const options = parseArguments(process.argv.slice(2));
const { manifest } = await loadCatalog();
const schedule = await loadSchedule(manifest);
const today = options.rehearse ?? dateInZone(schedule.timeZone);

const repository = process.env.GITHUB_REPOSITORY
  ?? JSON.parse(await gh("repo", "view", "--json", "nameWithOwner")).nameWithOwner;

async function openIssue() {
  const url = (await gh(
    "issue", "create", "--repo", repository,
    "--title", ISSUE_TITLE, "--body", renderIssueBody()
  )).trim();
  const number = Number(url.split("/").at(-1));
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Could not read an issue number back from: ${url}`);
  }
  console.log(`Opened ${url}`);
  return number;
}

// Listing and filtering by exact title, rather than searching, because the search index
// lags behind writes and a notice must find the issue the previous notice just made.
const listed = JSON.parse(await gh(
  "issue", "list", "--repo", repository, "--state", "all",
  "--limit", "100", "--json", "number,title,state,body"
));
const existing = listed
  .filter((issue) => issue.title === ISSUE_TITLE)
  .sort((first, second) => first.number - second.number)[0] ?? null;

let dates = { notices: [], rehearsals: [] };
if (existing !== null) {
  const { comments } = JSON.parse(await gh(
    "issue", "view", String(existing.number), "--repo", repository, "--json", "comments"
  ));
  dates = noticeDates(comments.map((comment) => comment.body));
}

const decision = queueDecision(schedule, today, existing === null ? null : {
  open: existing.state === "OPEN",
  recordedLastDate: recordedLastDate(existing.body),
  noticeDates: dates.notices
});

if (options.rehearse !== undefined) {
  if (dates.rehearsals.includes(today)) {
    console.log(`A rehearsal for ${today} is already on the issue; nothing added.`);
    process.exit(0);
  }
  if (decision.act === "none") {
    console.log(`A run on ${today} would send no notice: ${decision.reason}.`);
    process.exit(0);
  }
  const number = existing?.number ?? await openIssue();
  await gh(
    "issue", "comment", String(number), "--repo", repository,
    "--body", renderNotice(decision, today, { rehearsal: true })
  );
  console.log(`Rehearsed the ${decision.kind} notice for ${today} on issue #${number}.`);
  process.exit(0);
}

if (decision.act === "none") {
  console.log(`No queue notice tonight: ${decision.reason}.`);
  process.exit(0);
}

const number = existing?.number ?? await openIssue();
if (decision.reopen && existing?.state === "CLOSED") {
  await gh("issue", "reopen", String(number), "--repo", repository);
}
await gh(
  "issue", "comment", String(number), "--repo", repository,
  "--body", renderNotice(decision, today)
);
if (decision.close) {
  // The recorded date is what tomorrow's run reads to know this final notice was for
  // this schedule and not for a longer one; it goes into the body before the door shuts.
  await gh(
    "issue", "edit", String(number), "--repo", repository,
    "--body", renderIssueBody(decision.last?.date ?? null)
  );
  if (existing === null || existing.state === "OPEN") {
    await gh("issue", "close", String(number), "--repo", repository);
  }
}
console.log(`Sent the ${decision.kind} notice for ${today} to issue #${number}.`);
