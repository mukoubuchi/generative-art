import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { P5JS_DIRECTORY } from "../lib/catalog.mjs";

/**
 * The badges at the head of the root README state facts that are recorded elsewhere in the
 * repository: which workflow reports the tests, which version of p5.js the artworks load,
 * what the licence is called, where the gallery is published. A badge is the first thing a
 * reader sees and the last thing
 * anyone remembers to update, so each of those statements is checked here against its
 * source rather than trusted to stay true. The one number deliberately left off the row is
 * the count of artworks, for the same reason the gallery's opening lines no longer give it.
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

function readRepositoryFile(path) {
  return readFile(resolve(REPOSITORY_ROOT, path), "utf8");
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
