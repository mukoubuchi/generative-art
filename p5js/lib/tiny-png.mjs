import { crc32, deflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type, data) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  header.write(type, 4, "ascii");
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), data])), 0);
  return Buffer.concat([header, data, checksum]);
}

/**
 * A one-pixel PNG, built here rather than committed or borrowed from `exports/`.
 *
 * It exists for one purpose: to ask X's upload endpoint whether these credentials may
 * upload media at all. That question is worth asking with the smallest honest image there
 * is — a real PNG, so nothing is being fooled, and seventy-odd bytes, so the answer costs
 * as little as an answer can.
 */
export function tinyPng(red = 0, green = 0, blue = 0) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;  // bits per channel
  header[9] = 2;  // truecolour, no palette
  // The remaining three bytes are the only compression, filter and interlace methods PNG
  // defines, and they are all zero.
  const scanline = Buffer.from([0, red, green, blue]);
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanline)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
