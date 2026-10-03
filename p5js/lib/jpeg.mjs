/**
 * The header of a JPEG, and the part of it a published thumbnail may keep.
 *
 * The gallery's thumbnails are encoded by Chromium. Every one of the fifty-eight it had
 * published by v1.32.3 carried an APP2 segment holding an sRGB ICC profile, whose
 * copyright field identified the library that wrote it. The profile only restates sRGB:
 * without it those thumbnails decode to the same pixels, and Chromium and WebKit display
 * them the same.
 *
 * So a thumbnail keeps, before its scan, only the segments a decoder reads to draw it --
 * the JFIF marker, the quantisation and Huffman tables, the frame header, the restart
 * interval and the arithmetic-coding conditioning -- each copied byte for byte. Application
 * segments and comments are taken out. Any other marker stops the write, so a segment
 * nobody has looked at is never published.
 */

const SOI = 0xd8;
const SOS = 0xda;
const COM = 0xfe;
const APP0 = 0xe0;
const APP15 = 0xef;
const DQT = 0xdb;
const DHT = 0xc4;
const DAC = 0xcc;
const DRI = 0xdd;
const JFIF = Buffer.from("JFIF\0", "latin1");

/** The start-of-frame markers: 0xC0 to 0xCF, less DHT, DAC and the reserved 0xC8. */
function isFrameHeader(marker) {
  return marker >= 0xc0 && marker <= 0xcf && marker !== DHT && marker !== DAC && marker !== 0xc8;
}

/** Markers that stand alone, with no length after them. */
function standalone(marker) {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

/**
 * The segments in front of the first scan, in file order, and where the scan starts.
 *
 * Each segment is `{ marker, start, payload, end }`: `start` is the offset of its 0xFF,
 * `payload` of the first byte after its length, and `end` just past its payload.
 * Everything from `scanStart` on -- the SOS header, the entropy-coded data and whatever
 * follows -- is the picture itself.
 */
export function jpegSegments(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) {
    throw new Error("not a JPEG: it does not open with a start-of-image marker");
  }
  const segments = [];
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      throw new Error(`not a JPEG: expected a marker at byte ${offset}`);
    }
    // Any number of 0xFF bytes may pad the space before a marker.
    let markerAt = offset + 1;
    while (markerAt < bytes.length && bytes[markerAt] === 0xff) {
      markerAt += 1;
    }
    const marker = bytes[markerAt];
    if (marker === undefined) {
      break;
    }
    if (marker === SOS) {
      return { segments, scanStart: offset };
    }
    if (standalone(marker)) {
      segments.push({ marker, start: offset, payload: markerAt + 1, end: markerAt + 1 });
      offset = markerAt + 1;
      continue;
    }
    if (markerAt + 3 > bytes.length) {
      throw new Error(`not a JPEG: segment 0x${marker.toString(16)} is cut short`);
    }
    // The length counts its own two bytes and the payload, not the marker.
    const end = markerAt + 1 + bytes.readUInt16BE(markerAt + 1);
    if (end > bytes.length) {
      throw new Error(`not a JPEG: segment 0x${marker.toString(16)} runs past the end`);
    }
    segments.push({ marker, start: offset, payload: markerAt + 3, end });
    offset = end;
  }
  throw new Error("not a JPEG: no scan follows the header");
}

function isJfif(bytes, segment) {
  return bytes.subarray(segment.payload, segment.payload + JFIF.length).equals(JFIF);
}

/** A segment the decoder reads to draw the picture: kept, byte for byte. */
function isPicture(bytes, segment) {
  const { marker } = segment;
  return (marker === APP0 && isJfif(bytes, segment))
    || marker === DQT || marker === DHT || marker === DAC || marker === DRI
    || isFrameHeader(marker);
}

/** A segment that carries data about the file rather than the picture: taken out. */
function isAboutTheFile(segment) {
  return segment.marker === COM || (segment.marker >= APP0 && segment.marker <= APP15);
}

/** A short name for a segment: its marker, and the identifier its payload opens with. */
function describe(bytes, segment) {
  const { marker } = segment;
  const name = marker === COM ? "COM"
    : marker >= APP0 && marker <= APP15 ? `APP${marker - APP0}`
      : `0x${marker.toString(16).toUpperCase()}`;
  const payload = bytes.subarray(segment.payload, Math.min(segment.end, segment.payload + 32));
  const zero = payload.indexOf(0);
  const identifier = payload.subarray(0, zero === -1 ? payload.length : zero).toString("latin1");
  return /^[\x20-\x7e]+$/u.test(identifier) ? `${name} ${identifier}` : name;
}

/** Every segment before the scan that a thumbnail may not keep, described, in file order. */
export function metadataSegments(bytes) {
  const { segments } = jpegSegments(bytes);
  return segments
    .filter((segment) => !isPicture(bytes, segment))
    .map((segment) => describe(bytes, segment));
}

/**
 * The same JPEG with its application segments, other than the JFIF one, and its comments
 * taken out. The kept segments and the scan are copied byte for byte, so the decoded pixels
 * cannot change. A marker that is neither kept nor about the file is refused.
 */
export function withoutMetadata(bytes) {
  const { segments, scanStart } = jpegSegments(bytes);
  const unknown = segments.filter((segment) => !isPicture(bytes, segment) && !isAboutTheFile(segment));
  if (unknown.length > 0) {
    throw new Error(`unvetted JPEG segment before the scan: ${unknown.map((segment) => describe(bytes, segment)).join(", ")}`);
  }
  return Buffer.concat([
    bytes.subarray(0, 2),
    ...segments
      .filter((segment) => isPicture(bytes, segment))
      .map((segment) => bytes.subarray(segment.start, segment.end)),
    bytes.subarray(scanStart)
  ]);
}
