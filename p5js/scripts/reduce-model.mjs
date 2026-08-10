#!/usr/bin/env node
/**
 * Cuts the masthead's head model down to a size worth serving over the web.
 *
 * The model is generated from a photograph by an image-to-3D service and arrives at about
 * 47 MB: an 8192-square base colour map, two 4096-square maps, and a whole standing figure
 * of which the page shows only the head. This turns that into something under a megabyte by
 * doing the two obvious things — throw away what is never on screen, and size the textures
 * to the screen they are drawn on.
 *
 *   node scripts/reduce-model.mjs <input.glb> <output.glb>
 *
 * Requires ImageMagick (`magick`) for the textures. The original stays outside the
 * repository; only the reduced file is committed, and this script is how it is reproduced.
 *
 * The input is assumed to be what the service produces: one node, one mesh, one primitive,
 * float positions, normals and texture coordinates, and 32-bit indices. Anything else is
 * refused rather than half-handled.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Triangles wholly below this height are dropped.
 *
 * Not at the collar, which is where the head stops being interesting. The camera frames the
 * head and the stylesheet fades the foot of that frame, and a fade needs something dull to
 * dissolve: cut at the tie and the fade has to eat the tie, cut a fifth of a unit lower and
 * it dissolves plain suit instead. The cut edge itself is a flat horizontal boundary
 * against nothing, which is a stair-stepped line wherever it is left in shot.
 */
const KEEP_ABOVE_Y = -0.2;

/**
 * The head is drawn about 300 pixels wide and its texture is one island in a scattered
 * atlas, so a quarter of the source resolution still leaves more texels on the face than
 * the display has pixels. The other two maps carry lower-frequency information and are
 * taken down further.
 */
const TEXTURE_SIZES = [
  { name: "base colour", size: 1024, quality: 88 },
  { name: "metallic-roughness", size: 256, quality: 85 },
  { name: "normal", size: 512, quality: 90 }
];

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const UNSIGNED_INT = 5125;
const TRIANGLES = 4;

function readGlb(buffer) {
  if (buffer.readUInt32LE(0) !== GLB_MAGIC || buffer.readUInt32LE(4) !== 2) {
    throw new Error("Not a glTF binary file of version 2.");
  }
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === CHUNK_JSON) {
      json = JSON.parse(body.toString("utf8"));
    }
    if (type === CHUNK_BIN) {
      bin = body;
    }
    offset += 8 + length;
  }
  if (!json || !bin) {
    throw new Error("The file is missing its JSON or its binary chunk.");
  }
  return { json, bin };
}

/** Reads one accessor as a flat typed array. Only the tightly packed case the input uses. */
function readAccessor(json, bin, index, componentType, componentsPer) {
  const accessor = json.accessors[index];
  if (accessor.componentType !== componentType) {
    throw new Error(`Accessor ${index} has component type ${accessor.componentType}.`);
  }
  const view = json.bufferViews[accessor.bufferView];
  if (view.byteStride !== undefined) {
    throw new Error(`Accessor ${index} is interleaved, which this script does not handle.`);
  }
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const count = accessor.count * componentsPer;
  const Type = componentType === FLOAT ? Float32Array : Uint32Array;
  // A copy, not a view: the source buffer's offset is not guaranteed to be aligned.
  return new Type(bin.buffer.slice(bin.byteOffset + start, bin.byteOffset + start + count * Type.BYTES_PER_ELEMENT));
}

/**
 * Keeps every triangle with a corner above the cut and renumbers what survives, so the
 * vertices that only the discarded triangles used are gone too.
 */
function cropToHead(positions, normals, uvs, indices) {
  const kept = [];
  for (let triangle = 0; triangle < indices.length; triangle += 3) {
    const corners = [indices[triangle], indices[triangle + 1], indices[triangle + 2]];
    if (corners.some((corner) => positions[corner * 3 + 1] > KEEP_ABOVE_Y)) {
      kept.push(corners);
    }
  }

  const renumbered = new Map();
  const position = [];
  const normal = [];
  const uv = [];
  const index = [];
  for (const corners of kept) {
    for (const corner of corners) {
      let moved = renumbered.get(corner);
      if (moved === undefined) {
        moved = renumbered.size;
        renumbered.set(corner, moved);
        position.push(positions[corner * 3], positions[corner * 3 + 1], positions[corner * 3 + 2]);
        normal.push(normals[corner * 3], normals[corner * 3 + 1], normals[corner * 3 + 2]);
        uv.push(uvs[corner * 2], uvs[corner * 2 + 1]);
      }
      index.push(moved);
    }
  }
  return {
    positions: new Float32Array(position),
    normals: new Float32Array(normal),
    uvs: new Float32Array(uv),
    indices: index
  };
}

function bounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let vertex = 0; vertex < positions.length; vertex += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[vertex + axis]);
      max[axis] = Math.max(max[axis], positions[vertex + axis]);
    }
  }
  return { min, max };
}

async function resizeTexture(bytes, { size, quality }, workspace, label) {
  const from = join(workspace, `${label}-in.jpg`);
  const to = join(workspace, `${label}-out.jpg`);
  await writeFile(from, bytes);
  await run("magick", [
    from,
    "-filter", "Lanczos",
    "-resize", `${size}x${size}`,
    "-quality", String(quality),
    "-strip",
    "-interlace", "none",
    "-sampling-factor", "4:2:0",
    to
  ]);
  return readFile(to);
}

/** Lays out the binary chunk, keeping every view at a four-byte boundary as glTF requires. */
function packBinary(parts) {
  const views = [];
  const chunks = [];
  let offset = 0;
  for (const part of parts) {
    const padding = (4 - (offset % 4)) % 4;
    if (padding > 0) {
      chunks.push(Buffer.alloc(padding));
      offset += padding;
    }
    views.push({ buffer: 0, byteOffset: offset, byteLength: part.length });
    chunks.push(part);
    offset += part.length;
  }
  return { bin: Buffer.concat(chunks), views };
}

function writeGlb(json, bin) {
  const jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPadded = Buffer.concat([jsonBytes, Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20)]);
  const binPadded = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0)]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonHeader.writeUInt32LE(CHUNK_JSON, 4);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binPadded.length, 0);
  binHeader.writeUInt32LE(CHUNK_BIN, 4);

  return Buffer.concat([header, jsonHeader, jsonPadded, binHeader, binPadded]);
}

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/reduce-model.mjs <input.glb> <output.glb>");
  process.exit(1);
}

const source = await readFile(inputPath);
const { json, bin } = readGlb(source);

if (json.meshes?.length !== 1 || json.meshes[0].primitives.length !== 1) {
  throw new Error("Expected exactly one mesh with one primitive.");
}
const primitive = json.meshes[0].primitives[0];
if ((primitive.mode ?? TRIANGLES) !== TRIANGLES) {
  throw new Error("Expected a triangle mesh.");
}

const positions = readAccessor(json, bin, primitive.attributes.POSITION, FLOAT, 3);
const normals = readAccessor(json, bin, primitive.attributes.NORMAL, FLOAT, 3);
const uvs = readAccessor(json, bin, primitive.attributes.TEXCOORD_0, FLOAT, 2);
const indices = readAccessor(json, bin, primitive.indices, UNSIGNED_INT, 1);

const head = cropToHead(positions, normals, uvs, indices);
const vertexCount = head.positions.length / 3;
if (vertexCount > 65535) {
  throw new Error(`${vertexCount} vertices is too many for 16-bit indices; the cut is too low.`);
}
console.log(`vertices ${positions.length / 3} -> ${vertexCount}`);
console.log(`triangles ${indices.length / 3} -> ${head.indices.length / 3}`);

const workspace = await mkdtemp(join(tmpdir(), "reduce-model-"));
let images;
try {
  images = await Promise.all(json.images.map(async (image, order) => {
    const view = json.bufferViews[image.bufferView];
    const start = view.byteOffset ?? 0;
    const original = bin.subarray(start, start + view.byteLength);
    const plan = TEXTURE_SIZES[order];
    const reduced = await resizeTexture(original, plan, workspace, String(order));
    console.log(`${plan.name}: ${original.length} -> ${reduced.length} bytes at ${plan.size} square`);
    return reduced;
  }));
} finally {
  await rm(workspace, { recursive: true, force: true });
}

// Indices fit in 16 bits once the body is gone, which halves them.
const indexBytes = Buffer.alloc(head.indices.length * 2);
head.indices.forEach((value, at) => indexBytes.writeUInt16LE(value, at * 2));

const { bin: packed, views } = packBinary([
  Buffer.from(head.positions.buffer),
  Buffer.from(head.normals.buffer),
  Buffer.from(head.uvs.buffer),
  indexBytes,
  ...images
]);

const box = bounds(head.positions);
const reduced = {
  asset: { version: "2.0", generator: "generative-art reduce-model" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, mode: TRIANGLES, material: 0 }] }],
  accessors: [
    { bufferView: 0, componentType: FLOAT, count: vertexCount, type: "VEC3", min: box.min, max: box.max },
    { bufferView: 1, componentType: FLOAT, count: vertexCount, type: "VEC3" },
    { bufferView: 2, componentType: FLOAT, count: vertexCount, type: "VEC2" },
    { bufferView: 3, componentType: UNSIGNED_SHORT, count: head.indices.length, type: "SCALAR" }
  ],
  bufferViews: views,
  buffers: [{ byteLength: packed.length }],
  images: images.map((unused, order) => ({ mimeType: "image/jpeg", bufferView: 4 + order })),
  samplers: json.samplers,
  textures: json.textures,
  materials: json.materials
};

const output = writeGlb(reduced, packed);
await writeFile(outputPath, output);
console.log(`${inputPath}: ${source.length} bytes -> ${outputPath}: ${output.length} bytes`
  + ` (${(output.length / source.length * 100).toFixed(1)}%)`);
