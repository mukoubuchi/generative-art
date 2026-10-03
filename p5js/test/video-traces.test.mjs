import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isTraceFree, mp4Boxes, videoTraces } from "../lib/mp4.mjs";
import { videoEncodeArguments } from "../lib/render.mjs";

/**
 * A rendered clip carries no trace of the tools that encoded it.
 *
 * Both specimens are the same thirty 64×64 frames of ffmpeg's testsrc2 pattern, encoded with
 * libx264. `traced.mp4` was encoded with the pipeline's arguments as they stood before the
 * trace removal; its SEI unit and its encoder tag are real, and only their words were then
 * overwritten in place with "(text replaced) " (the SEI's 16-byte identifier with 0x11), so
 * the tools' names are not kept in this repository. `clean.mp4` was encoded with
 * `videoEncodeArguments` as it is now. Both decode to the same thirty frames (framemd5).
 */
const read = (name) => readFileSync(new URL(`fixtures/video-encoder-traces/${name}`, import.meta.url));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const TRACED = read("traced.mp4");
const CLEAN = read("clean.mp4");

test("the traced specimen still carries a real SEI unit and a real tag, and the check fires on it", () => {
  assert.equal(sha256(TRACED), "339e85b9015ca66b3b338a82db2df603a76bcdd03e53aa22207601b96a47213c");
  const traces = videoTraces(TRACED);
  assert.deepEqual(traces, { seiUnits: 1, pictureUnits: 30, metadataItems: 1, toolWords: [] });
  assert.equal(isTraceFree(traces), false);
});

test("a clip encoded with the pipeline's arguments has no SEI unit, no tag and no tool name", () => {
  assert.equal(sha256(CLEAN), "b7bd46b338d3a4d6236b7677fe45f8d9aa96384bd670e2ad639553af83ae129b");
  const traces = videoTraces(CLEAN);
  assert.deepEqual(traces, { seiUnits: 0, pictureUnits: 30, metadataItems: 0, toolWords: [] });
  assert.equal(isTraceFree(traces), true);
  // The muxer still writes an empty item list under its handler; it holds no tag.
  assert.deepEqual(mp4Boxes(CLEAN).filter((box) => box.path.startsWith("moov/udta")).map((box) => box.path),
    ["moov/udta", "moov/udta/meta"]);
  // And a tool's name anywhere in the file is seen: the handler's name, same length, renamed.
  const named = Buffer.from(CLEAN);
  Buffer.from("Lavf1.Handlr", "latin1").copy(named, named.indexOf(Buffer.from("VideoHandler", "latin1")));
  assert.deepEqual(videoTraces(named).toolWords, ["Lavf"]);
  assert.equal(isTraceFree(videoTraces(named)), false);
});

test("each kind of trace is enough on its own to make a clip unclean", () => {
  // One control per clause: an SEI unit alone, a tag alone, a tool name alone.
  const clean = { seiUnits: 0, pictureUnits: 30, metadataItems: 0, toolWords: [] };
  assert.equal(isTraceFree(clean), true);
  assert.equal(isTraceFree({ ...clean, seiUnits: 1 }), false);
  assert.equal(isTraceFree({ ...clean, metadataItems: 1 }), false);
  assert.equal(isTraceFree({ ...clean, toolWords: ["x264"] }), false);
});

test("the pipeline encodes with the arguments the clean specimen was made with", () => {
  assert.deepEqual(videoEncodeArguments("frames/frame-%06d.png", 30, "out.mp4"), [
    "-y", "-framerate", "30", "-start_number", "0", "-i", "frames/frame-%06d.png",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    "-bsf:v", "filter_units=remove_types=6",
    "-fflags", "+bitexact",
    "-flags:v", "+bitexact",
    "-map_metadata", "-1",
    "-metadata:s:v:0", "encoder=",
    "-movflags", "+faststart",
    "out.mp4"
  ]);
});

test("bytes that are not an H.264 MP4 are refused rather than counted as clean", () => {
  assert.throws(() => videoTraces(Buffer.from("not a video at all")), /not an MP4|expected one media data box/u);
  assert.throws(() => videoTraces(CLEAN.subarray(0, CLEAN.length - 100)), /not an MP4|whole NAL units/u);
});
