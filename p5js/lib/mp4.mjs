/**
 * What an H.264 MP4 says about the tools that made it.
 *
 * Two places carry it. The video stream can hold SEI units (NAL type 6): x264 writes one
 * into the first frame with its version and every option it was run with. The container
 * can hold metadata items in its user data (`udta`): ffmpeg's muxer writes its own name and
 * version there as an encoder tag, and the codec's name into the sample description. None
 * of it changes a decoded frame. `videoTraces` counts the SEI units and the metadata items
 * by structure, so a specimen whose words have been overwritten is still counted.
 */

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "udta", "dinf"]);
const TOOL_WORDS = ["Lavf", "Lavc", "x264", "videolan", "libx264"];

/** The boxes between `start` and `end`, each `{ type, start, payload, end }`. */
function boxesIn(bytes, start, end) {
  const boxes = [];
  let offset = start;
  while (offset < end) {
    if (offset + 8 > end) {
      throw new Error(`not an MP4: a box header at byte ${offset} is cut short`);
    }
    let size = bytes.readUInt32BE(offset);
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    let payload = offset + 8;
    if (size === 1) {
      size = Number(bytes.readBigUInt64BE(offset + 8));
      payload = offset + 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < payload - offset || offset + size > end) {
      throw new Error(`not an MP4: box ${type} at byte ${offset} runs past its parent`);
    }
    boxes.push({ type, start: offset, payload, end: offset + size });
    offset += size;
  }
  return boxes;
}

/** Every box in the file, depth first, with its path such as "moov/trak/mdia". */
export function mp4Boxes(bytes) {
  const all = [];
  const walk = (start, end, parent) => {
    for (const box of boxesIn(bytes, start, end)) {
      const path = parent ? `${parent}/${box.type}` : box.type;
      all.push({ ...box, path });
      if (CONTAINERS.has(box.type)) {
        walk(box.payload, box.end, path);
      }
    }
  };
  walk(0, bytes.length, "");
  return all;
}

/** The NAL length size the stream uses, from the avcC record of its sample description. */
function nalLengthSize(bytes, boxes) {
  const stsd = boxes.find((box) => box.path.endsWith("stbl/stsd"));
  if (!stsd) {
    throw new Error("not an H.264 MP4: no sample description");
  }
  const avcC = bytes.indexOf(Buffer.from("avcC", "latin1"), stsd.payload);
  if (avcC === -1 || avcC > stsd.end) {
    throw new Error("not an H.264 MP4: no avcC record");
  }
  // avcC payload: version, profile, compatibility, level, then 6 reserved bits and
  // lengthSizeMinusOne in the low two bits.
  return (bytes[avcC + 4 + 4] & 0x03) + 1;
}

/**
 * The traces a video carries: how many SEI units its stream holds, how many bytes of user
 * data its container holds, and which tool names appear anywhere in the file.
 */
export function videoTraces(bytes) {
  const boxes = mp4Boxes(bytes);
  const mdat = boxes.filter((box) => box.type === "mdat");
  if (mdat.length !== 1) {
    throw new Error(`expected one media data box, found ${mdat.length}`);
  }
  const lengthSize = nalLengthSize(bytes, boxes);
  const nalTypes = new Map();
  let offset = mdat[0].payload;
  while (offset < mdat[0].end) {
    const length = bytes.readUIntBE(offset, lengthSize);
    const type = bytes[offset + lengthSize] & 0x1f;
    nalTypes.set(type, (nalTypes.get(type) ?? 0) + 1);
    offset += lengthSize + length;
  }
  if (offset !== mdat[0].end) {
    throw new Error("the media data does not divide into whole NAL units");
  }
  return {
    seiUnits: nalTypes.get(6) ?? 0,
    pictureUnits: (nalTypes.get(1) ?? 0) + (nalTypes.get(5) ?? 0),
    metadataItems: metadataItems(bytes, boxes),
    toolWords: TOOL_WORDS.filter((word) => bytes.includes(Buffer.from(word, "latin1")))
  };
}

/**
 * The tags held in user data. An item list (`ilst`) inside a `meta` box holds one box per
 * tag; any other box straight inside `udta` is a QuickTime-style tag of its own. An empty
 * item list, which the muxer writes with its handler even when there are no tags, holds none.
 */
function metadataItems(bytes, boxes) {
  let items = 0;
  for (const udta of boxes.filter((box) => box.type === "udta")) {
    for (const child of boxesIn(bytes, udta.payload, udta.end)) {
      if (child.type !== "meta") {
        items += 1;
        continue;
      }
      // meta is a full box: four bytes of version and flags come before its children.
      for (const part of boxesIn(bytes, child.payload + 4, child.end)) {
        if (part.type === "ilst") {
          items += boxesIn(bytes, part.payload, part.end).length;
        }
      }
    }
  }
  return items;
}

/** True when a video carries none of the traces above. */
export function isTraceFree(traces) {
  return traces.seiUnits === 0 && traces.metadataItems === 0 && traces.toolWords.length === 0;
}
