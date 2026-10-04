import { brotliDecompressSync } from "node:zlib";

/**
 * Reading a WOFF2 font far enough to say what it carries.
 *
 * The legends are set in a typeface served from this repository, and a font is a binary
 * like any other: it can carry words about itself as well as the glyphs it draws. WOFF2
 * compresses its tables into one Brotli stream, so a scan of the file's bytes sees none
 * of them. This undoes the compression and hands back the tables as the font holds them,
 * with the two blocks WOFF2 adds of its own (an XML metadata block and a private block),
 * and reads the two tables a check needs: which characters the font maps, and what its
 * name table says.
 *
 * It reads; it does not rebuild. A transformed `glyf`, `loca` or `hmtx` comes back in its
 * transformed form, which is enough to know it is there and how long it is.
 */

const SIGNATURE = "wOF2";
const HEADER_LENGTH = 48;

/** The tags WOFF2 encodes by index, in the order the format gives them. */
const KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf",
  "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT",
  "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT",
  "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar",
  "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd",
  "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill"
];

export const isWoff2 = (bytes) => bytes.toString("latin1", 0, 4) === SIGNATURE;

/** A UIntBase128, as WOFF2 writes its lengths: seven bits a byte, high bit to go on. */
function base128(bytes, offset) {
  let value = 0;
  for (let index = 0; index < 5; index += 1) {
    const byte = bytes[offset + index];
    if (index === 0 && byte === 0x80) throw new Error("WOFF2: a length with a leading zero");
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, next: offset + index + 1 };
  }
  throw new Error("WOFF2: a length longer than five bytes");
}

/**
 * The font's tables, in directory order, each `{ tag, transformed, data }`; and the
 * metadata and private blocks, decompressed where WOFF2 compresses them, or null.
 */
export function woff2Contents(bytes) {
  if (!isWoff2(bytes)) throw new Error("not a WOFF2 font");
  const flavor = bytes.toString("latin1", 4, 8);
  if (flavor === "ttcf") throw new Error("WOFF2: a font collection, which this does not read");
  const numTables = bytes.readUInt16BE(12);
  const totalCompressedSize = bytes.readUInt32BE(20);
  const metaOffset = bytes.readUInt32BE(28);
  const metaLength = bytes.readUInt32BE(32);
  const privOffset = bytes.readUInt32BE(40);
  const privLength = bytes.readUInt32BE(44);

  const directory = [];
  let offset = HEADER_LENGTH;
  for (let index = 0; index < numTables; index += 1) {
    const flags = bytes[offset];
    offset += 1;
    let tag = KNOWN_TAGS[flags & 0x3f];
    if ((flags & 0x3f) === 0x3f) {
      tag = bytes.toString("latin1", offset, offset + 4);
      offset += 4;
    }
    const version = flags >> 6;
    const original = base128(bytes, offset);
    offset = original.next;
    // For glyf and loca, version 0 is the transform and 3 is none; for every other table
    // it is the other way about, and only a transformed table records its new length.
    const transformed = tag === "glyf" || tag === "loca" ? version !== 3 : version !== 0;
    let length = original.value;
    if (transformed) {
      const transform = base128(bytes, offset);
      offset = transform.next;
      length = transform.value;
    }
    directory.push({ tag, transformed, length });
  }

  // The tables follow one another in the stream in directory order, with no padding.
  const stream = brotliDecompressSync(bytes.subarray(offset, offset + totalCompressedSize));
  const tables = [];
  let position = 0;
  for (const { tag, transformed, length } of directory) {
    tables.push({ tag, transformed, data: stream.subarray(position, position + length) });
    position += length;
  }
  if (position !== stream.length) {
    throw new Error(`WOFF2: the tables account for ${position} of ${stream.length} bytes`);
  }

  return {
    flavor,
    tables,
    metadata: metaLength > 0 ? brotliDecompressSync(bytes.subarray(metaOffset, metaOffset + metaLength)) : null,
    privateData: privLength > 0 ? bytes.subarray(privOffset, privOffset + privLength) : null
  };
}

/** Every code point a cmap table maps, from its format 4 and format 12 subtables. */
export function cmapCodePoints(cmap) {
  const points = new Set();
  const count = cmap.readUInt16BE(2);
  for (let record = 0; record < count; record += 1) {
    const subtable = cmap.readUInt32BE(4 + record * 8 + 4);
    const format = cmap.readUInt16BE(subtable);
    if (format === 4) {
      const segments = cmap.readUInt16BE(subtable + 6) / 2;
      const ends = subtable + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const rangeOffsets = deltas + segments * 2;
      for (let segment = 0; segment < segments; segment += 1) {
        const end = cmap.readUInt16BE(ends + segment * 2);
        const start = cmap.readUInt16BE(starts + segment * 2);
        const delta = cmap.readInt16BE(deltas + segment * 2);
        const rangeOffsetAt = rangeOffsets + segment * 2;
        const rangeOffset = cmap.readUInt16BE(rangeOffsetAt);
        for (let point = start; point <= end && point !== 0xffff; point += 1) {
          // A code point maps only if it reaches a glyph other than .notdef.
          let glyph;
          if (rangeOffset === 0) {
            glyph = (point + delta) & 0xffff;
          } else {
            const raw = cmap.readUInt16BE(rangeOffsetAt + rangeOffset + (point - start) * 2);
            glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
          }
          if (glyph !== 0) points.add(point);
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(subtable + 12);
      for (let group = 0; group < groups; group += 1) {
        const at = subtable + 16 + group * 12;
        const first = cmap.readUInt32BE(at);
        const last = cmap.readUInt32BE(at + 4);
        const glyph = cmap.readUInt32BE(at + 8);
        for (let point = first; point <= last; point += 1) {
          if (glyph + (point - first) !== 0) points.add(point);
        }
      }
    }
  }
  return points;
}

/** Every string in a name table, as `{ nameId, text }`, decoded as its platform writes it. */
export function nameStrings(name) {
  const count = name.readUInt16BE(2);
  const storage = name.readUInt16BE(4);
  const strings = [];
  for (let record = 0; record < count; record += 1) {
    const at = 6 + record * 12;
    const platform = name.readUInt16BE(at);
    const nameId = name.readUInt16BE(at + 6);
    const length = name.readUInt16BE(at + 8);
    const start = storage + name.readUInt16BE(at + 10);
    const raw = name.subarray(start, start + length);
    // Unicode and Windows strings are UTF-16 big-endian; Macintosh ones are single bytes.
    const text = platform === 1 ? raw.toString("latin1") : Buffer.from(raw).swap16().toString("utf16le");
    strings.push({ nameId, text });
  }
  return strings;
}
