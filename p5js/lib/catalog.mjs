import { readFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const LIBRARY_DIRECTORY = dirname(fileURLToPath(import.meta.url));
export const P5JS_DIRECTORY = resolve(LIBRARY_DIRECTORY, "..");
export const REPOSITORY_ROOT = resolve(P5JS_DIRECTORY, "..");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function assertRelativeRepositoryPath(path, label) {
  if (typeof path !== "string" || path.length === 0) {
    throw new Error(`${label} must be a non-empty repository-relative path.`);
  }
  const resolvedPath = resolve(REPOSITORY_ROOT, path);
  if (!resolvedPath.startsWith(`${REPOSITORY_ROOT}${sep}`)) {
    throw new Error(`${label} escapes the repository: ${path}`);
  }
}

function assertUniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    if (!item.id || ids.has(item.id)) {
      throw new Error(`${label} contains a missing or duplicate id: ${item.id ?? "<missing>"}`);
    }
    ids.add(item.id);
  }
}

export function validateManifest(manifest) {
  if (manifest.version !== 1 || !Array.isArray(manifest.artworks)) {
    throw new Error("manifest.json must use version 1 and contain an artworks array.");
  }
  const defaults = manifest.defaults;
  if (
    !defaults
    || !Number.isInteger(defaults.fps)
    || defaults.fps <= 0
    || defaults.maxVideoSeconds <= 0
    || defaults.maxVideoSeconds > 140
    || !Number.isInteger(defaults.maxWeightedCharacters)
    || defaults.maxWeightedCharacters <= 0
  ) {
    throw new Error("manifest.json has invalid rendering or post defaults.");
  }
  if (!URL.canParse(defaults.interactiveBaseUrl)) {
    throw new Error("manifest.json has an invalid interactive base URL.");
  }
  // A base a relative path is resolved against has to end in a separator, or the last
  // segment is replaced rather than appended to and every link loses a directory.
  if (!URL.canParse(defaults.sourceBaseUrl) || !defaults.sourceBaseUrl.endsWith("/")) {
    throw new Error("manifest.json has an invalid source base URL.");
  }

  assertUniqueIds(manifest.artworks, "manifest.json");
  for (const artwork of manifest.artworks) {
    assertRelativeRepositoryPath(artwork.entry, `${artwork.id}.entry`);
    assertRelativeRepositoryPath(artwork.render?.artifact, `${artwork.id}.render.artifact`);
    if (!Array.isArray(artwork.quoteIds) || artwork.quoteIds.length === 0) {
      throw new Error(`${artwork.id} must declare at least one quote candidate.`);
    }
    if (!artwork.description || !artwork.interactivePath) {
      throw new Error(`${artwork.id} is missing a description or interactive path.`);
    }
    if (
      !Number.isInteger(artwork.canvas?.width)
      || artwork.canvas.width <= 0
      || artwork.canvas.width > 1280
      || !Number.isInteger(artwork.canvas?.height)
      || artwork.canvas.height <= 0
      || artwork.canvas.height > 720
    ) {
      throw new Error(`${artwork.id} has an invalid laptop-sized logical canvas.`);
    }
    if (
      !Number.isInteger(artwork.render.scale)
      || artwork.render.scale <= 0
      || artwork.render.scale > 4
    ) {
      throw new Error(`${artwork.id} has an invalid export scale.`);
    }
    if (artwork.render.kind === "video") {
      if (
        artwork.render.durationSeconds <= 0
        || artwork.render.durationSeconds > defaults.maxVideoSeconds
      ) {
        throw new Error(`${artwork.id} has an invalid video duration.`);
      }
    } else if (artwork.render.kind !== "image") {
      throw new Error(`${artwork.id} has an unsupported render kind.`);
    }
    // Optional: which frame of a moving artwork stands for it in the gallery. A still
    // artwork has only one frame to choose from, so declaring one is a mistake worth
    // reporting rather than ignoring.
    if (artwork.thumbnail !== undefined) {
      const frameCount = Math.round(artwork.render.durationSeconds * defaults.fps);
      if (artwork.render.kind !== "video") {
        throw new Error(`${artwork.id} declares a thumbnail frame but does not move.`);
      }
      if (
        !Number.isInteger(artwork.thumbnail.frame)
        || artwork.thumbnail.frame < 0
        || artwork.thumbnail.frame >= frameCount
      ) {
        throw new Error(`${artwork.id} has a thumbnail frame outside its own clip.`);
      }
    }
  }
}

function validateQuotes(quoteCatalog) {
  if (quoteCatalog.version !== 1 || !Array.isArray(quoteCatalog.quotes)) {
    throw new Error("quotes.json must use version 1 and contain a quotes array.");
  }
  assertUniqueIds(quoteCatalog.quotes, "quotes.json");
  for (const quote of quoteCatalog.quotes) {
    if (
      !quote.text
      || !quote.author
      || !quote.source
      || quote.publicDomain !== true
      || (quote.year !== null && !Number.isInteger(quote.year))
    ) {
      throw new Error(`Quote ${quote.id} is incomplete or is not verified as public domain.`);
    }
    try {
      Intl.getCanonicalLocales(quote.lang);
    } catch {
      throw new Error(`Quote ${quote.id} has an invalid BCP 47 language tag.`);
    }
    if (!URL.canParse(quote.sourceUrl) || !quote.sourceUrl.startsWith("https://")) {
      throw new Error(`Quote ${quote.id} must include an HTTPS source URL.`);
    }
  }
}

export async function loadCatalog() {
  const [manifest, quoteCatalog] = await Promise.all([
    readJson(resolve(P5JS_DIRECTORY, "manifest.json")),
    readJson(resolve(P5JS_DIRECTORY, "quotes.json"))
  ]);
  validateManifest(manifest);
  validateQuotes(quoteCatalog);
  return { manifest, quoteCatalog };
}

/**
 * Which frame of a moving artwork stands for it in the gallery. Halfway through is the
 * default: several clips open and close on a resting state, so their ends say least. An
 * artwork whose telling moment lies elsewhere overrides it in the manifest — Temple Bell
 * is mid-toll at frame 40, and Recursive Pentagram is still drawing itself at its middle.
 */
export function thumbnailFrame(manifest, artwork) {
  if (artwork.render.kind !== "video") {
    return undefined;
  }
  const frameCount = Math.round(artwork.render.durationSeconds * manifest.defaults.fps);
  return artwork.thumbnail?.frame ?? Math.round(frameCount / 2);
}

export function repositoryPath(relativePath) {
  assertRelativeRepositoryPath(relativePath, "path");
  return resolve(REPOSITORY_ROOT, relativePath);
}
