import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { REPOSITORY_ROOT } from "../lib/catalog.mjs";

/**
 * Nothing in this repository may carry a provenance mark, visible or not.
 *
 * Tools have begun stamping what they touch: statistical watermarks threaded through text
 * as invisible code points, and C2PA signature blocks embedded in images. Whatever any one
 * tool does this month, the exposure is permanent — a marked file, once pushed, is marked
 * in every clone — so the check is not a one-off audit but part of the suite: the moment
 * anything in the toolchain starts marking output, this goes red before the push.
 *
 * Two scans. Text is any tracked file without a NUL byte, and must contain none of the
 * invisible or control code points below. Binaries are the rest, and must not contain the
 * byte signatures of provenance containers. The one legitimate invisible character in the
 * tree — the joiner inside a deliberately emoji fixture — is admitted by an allowlist that
 * names the file, the code point, and how many, so a fourth one fails.
 */
const run = promisify(execFile);

/** [first, last] code point ranges that have no business in this repository's text. */
const FORBIDDEN_RANGES = [
  [0x200B, 0x200D], // zero-width space, non-joiner, joiner
  [0x2060, 0x2060], // word joiner
  [0xFEFF, 0xFEFF], // byte-order mark, anywhere
  [0x200E, 0x200F], // bidi marks
  [0x202A, 0x202E], // bidi embedding and override controls
  [0x2066, 0x2069], // bidi isolates
  [0x00AD, 0x00AD], // soft hyphen
  [0xFE00, 0xFE0F], // variation selectors
  [0xE0100, 0xE01EF], // variation selector supplement
  [0xE0000, 0xE007F], // tag characters
  [0x0000, 0x0008], // C0 controls, except tab, line feed and carriage return
  [0x000B, 0x000C],
  [0x000E, 0x001F],
  [0x007F, 0x009F] // delete and the C1 controls
];

/** One line per admitted occurrence set: repository path, code point, exact count. */
const ALLOWED = [
  ["p5js/test/post-text.test.mjs", 0x200D, 3] // the family-emoji fixture's joiners
];

/** Byte signatures of provenance and authorship containers, matched case-blind. */
const BINARY_MARKERS = /c2pa|jumbf|contentauth|xmpmeta|anthropic|claude/giu;

function forbidden(codePoint) {
  return FORBIDDEN_RANGES.some(([first, last]) => codePoint >= first && codePoint <= last);
}

const { stdout } = await run("git", ["-C", REPOSITORY_ROOT, "ls-files", "-z"]);
const tracked = stdout.split("\0").filter(Boolean);
const texts = new Map();
const binaries = new Map();
for (const file of tracked) {
  const buffer = await readFile(resolve(REPOSITORY_ROOT, file));
  (buffer.includes(0) ? binaries : texts).set(file, buffer);
}

test("the tree is worth scanning at all", () => {
  // If ls-files ever returns nothing, the two scans below would pass vacuously.
  assert.ok(texts.size > 100, `only ${texts.size} tracked text files were found`);
  assert.ok(binaries.size > 0, "no tracked binaries were found");
});

test("no tracked text carries an invisible or control code point", () => {
  const failures = [];
  for (const [file, buffer] of texts) {
    const counts = new Map();
    for (const character of buffer.toString("utf8")) {
      const codePoint = character.codePointAt(0);
      if (forbidden(codePoint)) {
        counts.set(codePoint, (counts.get(codePoint) ?? 0) + 1);
      }
    }
    for (const [codePoint, count] of counts) {
      const admitted = ALLOWED.some(([path, allowedPoint, allowedCount]) =>
        path === file && allowedPoint === codePoint && allowedCount === count);
      if (!admitted) {
        failures.push(`${file}: U+${codePoint.toString(16).toUpperCase().padStart(4, "0")} x${count}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test("every allowlist entry still earns its line", () => {
  // An allowlist that outlives what it admitted is a hole, not a record.
  for (const [file, codePoint, count] of ALLOWED) {
    const buffer = texts.get(file);
    assert.ok(buffer, `${file} is allowlisted but no longer tracked as text`);
    let found = 0;
    for (const character of buffer.toString("utf8")) {
      found += character.codePointAt(0) === codePoint ? 1 : 0;
    }
    assert.equal(found, count, `${file} no longer has exactly ${count} of U+${codePoint.toString(16)}`);
  }
});

test("no tracked binary carries a provenance container's signature", () => {
  const failures = [];
  for (const [file, buffer] of binaries) {
    const hits = buffer.toString("latin1").match(BINARY_MARKERS);
    if (hits) {
      failures.push(`${file}: ${[...new Set(hits.map((hit) => hit.toLowerCase()))].join(", ")}`);
    }
  }
  assert.deepEqual(failures, []);
});
