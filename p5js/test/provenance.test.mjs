import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { REPOSITORY_ROOT } from "../lib/catalog.mjs";
import { metadataSegments } from "../lib/jpeg.mjs";
import { videoTraces } from "../lib/mp4.mjs";
import { cmapCodePoints, isWoff2, nameStrings, woff2Contents } from "../lib/woff2.mjs";

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
 * invisible or control code points below. Binaries are the rest, and must carry nothing
 * but their picture (or, for the one font, its glyphs): no text-bearing metadata in any
 * format this test can read, no byte signature of a provenance container, and no format
 * it cannot read. The rule names
 * structures, never a tool or its maker, so it holds whoever does the stamping. The one
 * legitimate invisible character in the tree — the joiner inside a deliberately emoji
 * fixture — is admitted by an allowlist that names the file, the code point, and how many,
 * so a fourth one fails; the frozen specimens that carry what the binary rule refuses are
 * admitted the same way.
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

/** Byte signatures of provenance containers, matched case-blind wherever they stand. */
const CONTAINER_WORDS = /c2pa|jumbf|contentauth|xmpmeta/giu;

/** The PNG chunks a picture needs; any other chunk is about the file, not the picture. */
const PICTURE_CHUNKS = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);

/** The chunk types of a PNG, in order. */
function pngChunks(bytes) {
  const types = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    types.push(bytes.toString("latin1", offset + 4, offset + 8));
    offset += 12 + length;
  }
  return types;
}

const isPng = (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const isJpeg = (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8;
const isMp4 = (bytes) => bytes.toString("latin1", 4, 8) === "ftyp";
const isGlb = (bytes) => bytes.toString("latin1", 0, 4) === "glTF";

/**
 * The tables a font needs to draw its glyphs, lay them out and be named, and nothing it
 * might carry about itself: no signature table, no `meta` table of free-form data, no
 * table this list has not been told about. They are the tables the legends' face holds.
 */
const FONT_TABLES = new Set([
  "GDEF", "GPOS", "GSUB", "OS/2", "STAT", "cmap", "gasp", "glyf", "head", "hhea", "hmtx",
  "loca", "maxp", "name", "post", "prep"
]);

/**
 * A WOFF2 font's findings: a table outside the list, the format's own metadata and private
 * blocks, and the words of a provenance container. The tables are one Brotli stream, so
 * the words are looked for in the tables as the font holds them, and in the name table's
 * strings as they read, which are UTF-16 and would slip past a byte scan.
 */
function woff2Findings(bytes) {
  const found = [];
  const { tables, metadata, privateData } = woff2Contents(bytes);
  for (const { tag } of tables) {
    if (!FONT_TABLES.has(tag)) found.push(`WOFF2 table ${tag.trim()}`);
  }
  if (metadata) found.push("WOFF2 metadata");
  if (privateData) found.push("WOFF2 private data");
  for (const { data } of tables) {
    for (const word of data.toString("latin1").match(CONTAINER_WORDS) ?? []) {
      found.push(`WOFF2 container word ${word.toLowerCase()}`);
    }
  }
  const name = tables.find(({ tag }) => tag === "name");
  for (const { text } of name ? nameStrings(name.data) : []) {
    for (const word of text.match(CONTAINER_WORDS) ?? []) found.push(`WOFF2 name word ${word.toLowerCase()}`);
  }
  return found;
}

/** What a WOFF2 font says, uncompressed: its tables, its two blocks and its name strings. */
function woff2Words(bytes) {
  const { tables, metadata, privateData } = woff2Contents(bytes);
  const name = tables.find(({ tag }) => tag === "name");
  return [
    ...tables.map(({ data }) => data.toString("latin1")),
    metadata?.toString("utf8") ?? "",
    privateData?.toString("latin1") ?? "",
    ...(name ? nameStrings(name.data).map(({ text }) => text) : [])
  ].join("\n");
}

/** The glTF fields that hold words about a model rather than the model itself. */
const GLTF_ABOUT = new Set(["generator", "copyright", "extras"]);

/**
 * A binary glTF's findings: any field about the model, wherever it stands in the JSON, and
 * whatever the images it embeds carry, by the same rule as a file of their own.
 */
function glbFindings(bytes) {
  const found = [];
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
  const walk = (value, path) => {
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (GLTF_ABOUT.has(key)) found.push(`glTF ${path}${key}`);
      walk(child, Array.isArray(value) ? path : `${path}${key}.`);
    }
  };
  walk(json, "");
  const binaryStart = 20 + jsonLength + 8;
  for (const image of json.images ?? []) {
    const view = json.bufferViews[image.bufferView];
    const start = binaryStart + (view.byteOffset ?? 0);
    for (const finding of findings(bytes.subarray(start, start + view.byteLength), false)) {
      found.push(`glTF image ${finding}`);
    }
  }
  return found;
}

/**
 * Everything a binary carries besides its picture, one label per finding: chunks a PNG
 * does not need, a JPEG's application segments and comments other than its JFIF header,
 * an MP4's metadata items and SEI units, a glTF's fields about the model and whatever its
 * embedded images carry, a WOFF2 font's tables and blocks beyond what it draws with, the
 * words of a provenance container anywhere, and a format this test cannot read at all.
 */
function findings(bytes, wholeFile = true) {
  const found = [];
  if (isPng(bytes)) {
    for (const type of pngChunks(bytes)) {
      if (!PICTURE_CHUNKS.has(type)) found.push(`PNG ${type}`);
    }
  } else if (isJpeg(bytes)) {
    for (const segment of metadataSegments(bytes)) found.push(`JPEG ${segment}`);
  } else if (isMp4(bytes)) {
    const traces = videoTraces(bytes);
    for (let item = 0; item < traces.metadataItems; item += 1) found.push("MP4 metadata item");
    for (let unit = 0; unit < traces.seiUnits; unit += 1) found.push("MP4 SEI unit");
  } else if (isGlb(bytes)) {
    found.push(...glbFindings(bytes));
  } else if (isWoff2(bytes)) {
    found.push(...woff2Findings(bytes));
  } else {
    found.push("unreadable format");
  }
  // The words are looked for once, over the whole file, not again in what it embeds.
  if (wholeFile) {
    for (const word of bytes.toString("latin1").match(CONTAINER_WORDS) ?? []) {
      found.push(`container word ${word.toLowerCase()}`);
    }
  }
  return found;
}

/**
 * The frozen specimens that carry what the binary rule refuses, each finding with its exact
 * count. The provenance-marks specimens each hold one refused kind and the words "neutral
 * marker"; the other two are real faults, kept for their own tests.
 */
const MARKS = "p5js/test/fixtures/provenance-marks";
const ALLOWED_FINDINGS = [
  [`${MARKS}/text-chunk.png`, "PNG tEXt", 1],
  [`${MARKS}/exif-chunk.png`, "PNG eXIf", 1],
  [`${MARKS}/unknown-chunk.png`, "PNG caBX", 1],
  [`${MARKS}/container-word.png`, "container word c2pa", 1],
  [`${MARKS}/app1-segment.jpg`, "JPEG APP1 Exif", 1],
  [`${MARKS}/comment.jpg`, "JPEG COM neutral marker", 1],
  [`${MARKS}/unknown-format.bin`, "unreadable format", 1],
  [`${MARKS}/generator.glb`, "glTF asset.generator", 1],
  [`${MARKS}/image-chunk.glb`, "glTF image PNG tEXt", 1],
  [`${MARKS}/metadata-block.woff2`, "WOFF2 metadata", 1],
  [`${MARKS}/private-block.woff2`, "WOFF2 private data", 1],
  [`${MARKS}/meta-table.woff2`, "WOFF2 table meta", 1],
  [`${MARKS}/name-word.woff2`, "WOFF2 name word c2pa", 1],
  ["p5js/test/fixtures/thumbnail-encoder-profile/no-such-passage.jpg", "JPEG APP2 ICC_PROFILE", 1],
  ["p5js/test/fixtures/video-encoder-traces/traced.mp4", "MP4 metadata item", 1],
  ["p5js/test/fixtures/video-encoder-traces/traced.mp4", "MP4 SEI unit", 1]
];

function tally(labels) {
  const counts = new Map();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return counts;
}

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

test("no tracked binary carries anything but its picture", () => {
  const failures = [];
  for (const [file, buffer] of binaries) {
    for (const [label, count] of tally(findings(buffer))) {
      const admitted = ALLOWED_FINDINGS.some(([path, allowedLabel, allowedCount]) =>
        path === file && allowedLabel === label && allowedCount === count);
      if (!admitted) failures.push(`${file}: ${label} x${count}`);
    }
  }
  assert.deepEqual(failures, []);
});

test("every refused kind is caught on its frozen specimen, and every admitted finding is still there", () => {
  // Each specimen yields exactly the findings it is admitted for: so the rule still fires
  // on every kind it refuses, and no admission outlives what it admitted.
  const bySpecimen = new Map();
  for (const [path, label, count] of ALLOWED_FINDINGS) {
    bySpecimen.set(path, { ...(bySpecimen.get(path) ?? {}), [label]: count });
  }
  assert.equal(bySpecimen.size, 15);
  for (const [path, expected] of bySpecimen) {
    const buffer = binaries.get(path);
    assert.ok(buffer, `${path} is admitted but not tracked as a binary`);
    assert.deepEqual(Object.fromEntries(tally(findings(buffer))), expected, path);
  }
  // The new specimens name no tool and no maker, only what they are. A font's words are
  // compressed, so they are read where the font holds them.
  for (const path of bySpecimen.keys()) {
    if (path.startsWith(MARKS) && !path.endsWith(".bin")) {
      const buffer = binaries.get(path);
      const words = isWoff2(buffer) ? woff2Words(buffer) : buffer.toString("latin1");
      assert.ok(words.includes("neutral marker"), `${path} lost its neutral marker`);
    }
  }
});

test("the binary rule reads every format the tree holds, and each holds a clean picture", () => {
  // A rule that cannot parse a file would pass it by finding nothing: every tracked binary
  // outside the specimens is a PNG, a JPEG, an MP4, a glTF or a font the rule actually walked.
  const specimens = new Set(ALLOWED_FINDINGS.map(([path]) => path));
  const kinds = { png: 0, jpeg: 0, mp4: 0, glb: 0, embedded: 0, woff2: 0 };
  for (const [file, buffer] of binaries) {
    if (specimens.has(file)) continue;
    if (isPng(buffer)) {
      kinds.png += 1;
      const chunks = pngChunks(buffer);
      assert.equal(chunks[0], "IHDR", file);
      assert.equal(chunks.at(-1), "IEND", file);
    } else if (isJpeg(buffer)) {
      kinds.jpeg += 1;
    } else if (isMp4(buffer)) {
      kinds.mp4 += 1;
      assert.ok(videoTraces(buffer).pictureUnits > 0, `${file} has no picture the rule could find`);
    } else if (isGlb(buffer)) {
      kinds.glb += 1;
      const json = JSON.parse(buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12)));
      assert.ok(json.asset, `${file} has no asset the rule could read`);
      // The images it embeds are walked too: the gallery's head carries three textures.
      kinds.embedded += (json.images ?? []).length;
    } else if (isWoff2(buffer)) {
      kinds.woff2 += 1;
      const { tables } = woff2Contents(buffer);
      const cmap = tables.find(({ tag }) => tag === "cmap");
      assert.ok(cmap && cmapCodePoints(cmap.data).size > 0, `${file} maps no character the rule could find`);
    } else {
      assert.fail(`${file} is a binary of a format the rule cannot read`);
    }
  }
  assert.deepEqual(kinds, { png: 4, jpeg: 0, mp4: 1, glb: 1, embedded: 3, woff2: 0 });
});
