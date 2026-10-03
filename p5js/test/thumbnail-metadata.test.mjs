import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { jpegSegments, metadataSegments, withoutMetadata } from "../lib/jpeg.mjs";
import { thumbnailFromDataUrl } from "../lib/render.mjs";

/**
 * A gallery thumbnail carries, before its scan, only what a decoder reads to draw it.
 *
 * The specimen is the No Such Passage thumbnail as v1.32.3 published it (SHA-256
 * b84f70ab55aeca0b4494b4866ab7c9ae0d8e1a31154d3880b61fed7891056dfd), with one change:
 * the 32 bytes at offsets 462 to 493, the UTF-16 text of its ICC profile's copyright tag,
 * are overwritten with "(text replaced) " of the same length, so the vendor's text is not
 * kept in this repository. Every other byte is as published, so the APP2 segment the
 * encoder added keeps its size and its place, and it is the control the check must fire
 * on. It is kept outside `artworks/`.
 */
const SPECIMEN = readFileSync(new URL("fixtures/thumbnail-encoder-profile/no-such-passage.jpg", import.meta.url));
const SPECIMEN_SHA256 = "e6719e59a3a81bae2e514df2e1ff326a4f4619d8bda94244808d12f410b5e661";

/** Words that name a tool or a vendor, as ASCII and as the UTF-16 an ICC profile uses. */
const TOOL_WORDS = ["Google", "Skia", "ICC_PROFILE", "Exif", "http://ns.adobe.com", "Adobe", "Apple", "Lavc"];

function toolWordsIn(header) {
  return TOOL_WORDS.filter((word) =>
    header.includes(Buffer.from(word, "latin1")) || header.includes(Buffer.from(word, "utf16le").swap16())
  );
}

function headerOf(bytes) {
  return bytes.subarray(0, jpegSegments(bytes).scanStart);
}

const markersOf = (bytes) => jpegSegments(bytes).segments.map((segment) => segment.marker);

function segment(marker, payload) {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(payload.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), length, payload]);
}

/** The specimen with `extra` segments put in front of its own, after start-of-image. */
function dressed(...extra) {
  return Buffer.concat([SPECIMEN.subarray(0, 2), ...extra, SPECIMEN.subarray(2)]);
}

test("the specimen is the published thumbnail and still carries the encoder's profile", () => {
  // Pinned, so the control cannot quietly turn into a clean file and pass for the wrong reason.
  assert.equal(createHash("sha256").update(SPECIMEN).digest("hex"), SPECIMEN_SHA256);
  assert.deepEqual(metadataSegments(SPECIMEN), ["APP2 ICC_PROFILE"]);
  assert.ok(SPECIMEN.subarray(462, 494).equals(Buffer.from("(text replaced) ", "utf16le").swap16()));
  assert.deepEqual(toolWordsIn(headerOf(SPECIMEN)), ["ICC_PROFILE"]);
});

test("a thumbnail taken through the pipeline keeps the picture and drops the encoder's profile", () => {
  const thumbnail = thumbnailFromDataUrl(`data:image/jpeg;base64,${SPECIMEN.toString("base64")}`);

  assert.deepEqual(metadataSegments(thumbnail), []);
  assert.deepEqual(toolWordsIn(headerOf(thumbnail)), []);
  // What is left is the JFIF marker, the two quantisation tables, the frame and the four
  // Huffman tables -- every segment the decoder reads -- in the order they came.
  assert.deepEqual(markersOf(thumbnail), [0xe0, 0xdb, 0xdb, 0xc0, 0xc4, 0xc4, 0xc4, 0xc4]);
  assert.deepEqual(markersOf(SPECIMEN), [0xe0, 0xe2, 0xdb, 0xdb, 0xc0, 0xc4, 0xc4, 0xc4, 0xc4]);

  // The kept segments and the scan are the specimen's own bytes, so a decoder reads the same
  // pixels from both.
  const kept = (bytes) => jpegSegments(bytes).segments
    .filter((part) => part.marker !== 0xe2)
    .map((part) => bytes.subarray(part.start, part.end).toString("hex"));
  assert.deepEqual(kept(thumbnail), kept(SPECIMEN));
  const scan = (bytes) => bytes.subarray(jpegSegments(bytes).scanStart);
  assert.ok(scan(SPECIMEN).length > 20_000, "the scan is the bulk of the file");
  assert.ok(scan(thumbnail).equals(scan(SPECIMEN)));
  assert.equal(SPECIMEN.length - thumbnail.length, 474, "exactly the APP2 segment is gone");
});

test("comments and every other application segment go too, and only the JFIF marker stays", () => {
  const jfxx = segment(0xe0, Buffer.from("JFXX\0\x10", "latin1"));
  const exif = segment(0xe1, Buffer.from("Exif\0\0Skia", "latin1"));
  const comment = segment(0xfe, Buffer.from("Lavc61.3.100", "latin1"));
  const vendor = segment(0xeb, Buffer.from("JP\0\0Google", "latin1"));
  const restart = segment(0xdd, Buffer.from([0, 0]));
  // A fill byte before a marker, four segments about the file, and a restart interval.
  const file = dressed(Buffer.from([0xff]), exif, jfxx, comment, vendor, restart);
  assert.deepEqual(metadataSegments(file), ["APP1 Exif", "APP0 JFXX", "COM Lavc61.3.100", "APP11 JP", "APP2 ICC_PROFILE"]);

  const cleaned = withoutMetadata(file);
  assert.deepEqual(metadataSegments(cleaned), []);
  assert.deepEqual(toolWordsIn(headerOf(cleaned)), []);
  assert.deepEqual(markersOf(cleaned), [0xdd, 0xe0, 0xdb, 0xdb, 0xc0, 0xc4, 0xc4, 0xc4, 0xc4]);
  const applications = markersOf(cleaned).filter((marker) => marker >= 0xe0 && marker <= 0xef);
  assert.deepEqual(applications, [0xe0], "one JFIF marker, no more and no fewer");
});

test("a segment of a kind nobody has vetted stops the thumbnail instead of being published", () => {
  // 0xF0 is one of the markers the standard reserves; here it carries words.
  const reserved = dressed(segment(0xf0, Buffer.from("written by", "latin1")));
  assert.deepEqual(metadataSegments(reserved), ["0xF0 written by", "APP2 ICC_PROFILE"]);
  assert.throws(() => withoutMetadata(reserved), /unvetted JPEG segment before the scan: 0xF0 written by/u);
  assert.throws(
    () => thumbnailFromDataUrl(`data:image/jpeg;base64,${reserved.toString("base64")}`),
    /unvetted JPEG segment/u
  );
});

test("bytes that are not a JPEG are refused rather than passed through", () => {
  assert.throws(() => withoutMetadata(Buffer.from("\x89PNG\r\n\x1a\n", "latin1")), /not a JPEG/u);
  assert.throws(() => withoutMetadata(SPECIMEN.subarray(0, 600)), /not a JPEG/u);
});
