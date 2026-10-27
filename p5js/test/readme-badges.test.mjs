import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { P5JS_DIRECTORY } from "../lib/catalog.mjs";

/**
 * The badges at the head of the root README state facts that are recorded elsewhere in the
 * repository: which workflow reports the tests, which version of p5.js the artworks load,
 * what the licence is called, where the gallery is published, whose releases the release
 * badge follows. A badge is the first thing a reader sees and the last thing
 * anyone remembers to update, so each of those statements is checked here against its
 * source rather than trusted to stay true. The one number deliberately left off the row is
 * the count of artworks, for the same reason the gallery's opening lines no longer give it.
 * The release badge carries no number of its own either: Shields derives the version from
 * GitHub's release data, and its cached image may lag a new release.
 */
const REPOSITORY_ROOT = resolve(P5JS_DIRECTORY, "..");

/** `[![alt](https://github.com/owner/repo/actions/workflows/<file>/badge.svg)](…)` */
const STATUS_BADGE =
  /\[!\[(?<alt>[^\]]+)\]\(https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/actions\/workflows\/(?<workflow>[^/\s]+)\/badge\.svg\)\]/u;

const P5_BADGE = /img\.shields\.io\/badge\/p5\.js-(?<version>[\d.]+)-/u;

/** Shields writes a literal hyphen as a doubled one, so the label has to be read back. */
const LICENSE_BADGE = /img\.shields\.io\/badge\/License-(?<name>[^-\s)]+(?:--[^-\s)]+)*)-/u;

/** `[![Gallery](…shields…)](https://…/)` — the badge's destination, not its picture. */
const GALLERY_BADGE = /\[!\[Gallery\]\(https:\/\/img\.shields\.io\/badge\/Gallery-[^)]+\)\]\((?<href>[^)\s]+)\)/u;

/** The repository a workflow status badge reports on. */
const STATUS_REPOSITORY = /https:\/\/github\.com\/(?<owner>[^/\s]+)\/(?<repo>[^/\s]+)\/actions\/workflows\/[^/\s]+\/badge\.svg/u;

/** `[![alt](https://img.shields.io/github/v/release/<owner>/<repo>)](…)`: the release Shields reads from GitHub. */
const RELEASE_BADGE =
  /\[!\[(?<alt>[^\]]+)\]\(https:\/\/img\.shields\.io\/github\/v\/release\/(?<owner>[^/\s)?]+)\/(?<repo>[^/\s)?]+)(?<query>\?[^)\s]*)?\)\]\((?<href>[^)\s]+)\)/u;

function readRepositoryFile(path) {
  return readFile(resolve(REPOSITORY_ROOT, path), "utf8");
}

/**
 * What is wrong with a README's release badge, one line each; empty when it is right. It
 * has to follow the releases of the repository the status badge reports on, with no query
 * narrowing which release it shows, and lead to that repository's latest release. Its words
 * have to say release and nothing about the site: a release is cut before the site is
 * deployed, so the badge says nothing about what the site is serving.
 */
function releaseBadgeProblems(readme) {
  const badge = readme.match(RELEASE_BADGE);
  if (!badge) {
    return ["the README has no badge that reads the latest release from GitHub"];
  }
  const { alt, owner, repo, query, href } = badge.groups;
  const status = readme.match(STATUS_REPOSITORY);
  const problems = [];
  if (!status || status.groups.owner !== owner || status.groups.repo !== repo) {
    problems.push(`the release badge follows ${owner}/${repo}, not the repository the status badge reports on`);
  }
  if (query) {
    problems.push(`the release badge is narrowed by ${query}`);
  }
  if (href !== `https://github.com/${owner}/${repo}/releases/latest`) {
    problems.push(`the release badge leads to ${href}, not to the latest release`);
  }
  if (!/release/iu.test(alt) || /pages|site|live|deploy|publish/iu.test(alt)) {
    problems.push(`the release badge reads "${alt}"`);
  }
  return problems;
}

test("the status badge names a workflow this repository actually has", async () => {
  const readme = await readRepositoryFile("README.md");
  const badge = readme.match(STATUS_BADGE);
  assert.ok(badge, "the README has no workflow status badge");

  // Throws if the workflow was renamed or removed, which is exactly the failure a badge
  // hides: GitHub serves a badge reading "no status" and the README looks unchanged.
  const workflow = await readRepositoryFile(`.github/workflows/${badge.groups.workflow}`);

  // The left half of the badge is the workflow's own name, so the link text has to match it
  // or the README reads differently from the picture GitHub serves beside it.
  assert.match(workflow, new RegExp(`^name: ${badge.groups.alt}$`, "mu"));
});

test("the p5.js badge names the version the artworks load", async () => {
  const readme = await readRepositoryFile("README.md");
  const badge = readme.match(P5_BADGE);
  assert.ok(badge, "the README has no p5.js version badge");

  const { dependencies } = JSON.parse(await readFile(resolve(P5JS_DIRECTORY, "package.json"), "utf8"));
  assert.equal(
    badge.groups.version,
    dependencies.p5,
    "the badge and the pinned dependency disagree about which p5.js this is"
  );
});

test("the licence badge names the licence as the licence names itself", async () => {
  const readme = await readRepositoryFile("README.md");
  const badge = readme.match(LICENSE_BADGE);
  assert.ok(badge, "the README has no licence badge");

  const name = badge.groups.name.replaceAll("--", "-");
  const license = await readRepositoryFile("LICENSE");
  assert.match(license, new RegExp(`^generative-art — ${name} License$`, "mu"));
});

test("the gallery badge leads to the site the manifest sends readers to", async () => {
  const readme = await readRepositoryFile("README.md");
  const badge = readme.match(GALLERY_BADGE);
  assert.ok(badge, "the README has no gallery badge");

  // The manifest already carries the published address, because the daily post has to link
  // a reader to the page an artwork is on. The badge is the same site's front door, so it
  // is checked against that entry rather than written out a second time from memory.
  const { defaults } = JSON.parse(await readFile(resolve(P5JS_DIRECTORY, "manifest.json"), "utf8"));
  assert.ok(
    defaults.interactiveBaseUrl.startsWith(badge.groups.href),
    `the badge points at ${badge.groups.href}, which is not where ${defaults.interactiveBaseUrl} lives`
  );
});

test("the release badge follows this repository's releases and leads to its latest one", async () => {
  const readme = await readRepositoryFile("README.md");
  assert.deepEqual(releaseBadgeProblems(readme), []);

  // And the check says no to the badges it is there to keep out.
  const status =
    "[![Tests](https://github.com/mukoubuchi/generative-art/actions/workflows/tests.yml/badge.svg)](https://github.com/mukoubuchi/generative-art/actions/workflows/tests.yml)\n";
  const latest = "https://github.com/mukoubuchi/generative-art/releases/latest";
  const wrong = {
    "a version written into the badge": `[![Latest release](https://img.shields.io/badge/release-v1.42.0-blue)](${latest})`,
    "another repository": `[![Latest release](https://img.shields.io/github/v/release/mukoubuchi/other)](https://github.com/mukoubuchi/other/releases/latest)`,
    "a narrowed release": `[![Latest release](https://img.shields.io/github/v/release/mukoubuchi/generative-art?include_prereleases)](${latest})`,
    "a link to the site": "[![Latest release](https://img.shields.io/github/v/release/mukoubuchi/generative-art)](https://mukoubuchi.github.io/generative-art/)",
    "words about the site": `[![Deployed version](https://img.shields.io/github/v/release/mukoubuchi/generative-art)](${latest})`
  };
  for (const [what, badge] of Object.entries(wrong)) {
    assert.notDeepEqual(releaseBadgeProblems(status + badge), [], `${what} passed the check`);
  }
});
