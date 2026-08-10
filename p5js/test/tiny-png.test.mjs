import assert from "node:assert/strict";
import test from "node:test";
import { crc32 } from "node:zlib";
import { tinyPng } from "../lib/tiny-png.mjs";

const SIGNATURE = "89504e470d0a1a0a";

/** Walks the chunks the way a decoder does, checking each length and checksum. */
function readChunks(png) {
  const chunks = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    const stated = png.readUInt32BE(offset + 8 + length);
    assert.equal(
      stated,
      crc32(Buffer.concat([Buffer.from(type, "ascii"), data])),
      `the ${type} chunk's checksum does not cover its own bytes`
    );
    chunks.push({ type, data });
    offset += 12 + length;
  }
  assert.equal(offset, png.length, "the chunks do not account for the whole file");
  return chunks;
}

test("the check image is a real PNG a decoder would accept", () => {
  const png = tinyPng();
  assert.equal(png.subarray(0, 8).toString("hex"), SIGNATURE);

  const chunks = readChunks(png);
  assert.deepEqual(chunks.map((chunk) => chunk.type), ["IHDR", "IDAT", "IEND"]);

  const [header] = chunks;
  assert.equal(header.data.readUInt32BE(0), 1);
  assert.equal(header.data.readUInt32BE(4), 1);
  assert.equal(header.data[8], 8);
  assert.equal(header.data[9], 2);
  assert.deepEqual([...header.data.subarray(10)], [0, 0, 0]);
});

test("the check image is small enough to be a rounding error", () => {
  // The point of building it rather than sending one of the exports is that the question
  // "may these credentials upload?" should not cost a four-megabyte upload to ask.
  assert.ok(tinyPng().length < 200, "the one-pixel PNG has grown unreasonably");
});
