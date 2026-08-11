import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { P5JS_DIRECTORY, REPOSITORY_ROOT } from "./catalog.mjs";
import {
  VENDOR_THREE,
  artworkHref,
  renderArtworkAttribution,
  renderArtworkNav,
  renderIndexPage
} from "./gallery.mjs";
import { renderThumbnails } from "./render.mjs";

export const SITE_DIRECTORY = resolve(REPOSITORY_ROOT, "site");
export const THUMBNAIL_WIDTH = 640;

/**
 * Files copied verbatim into the site, as [source, destination] relative to the repository
 * root and the site root. The artwork tree keeps its repository path, which is what makes a
 * page's URL on the deployed site the same as its manifest entry.
 */
const COPIES = [
  ["p5js/artworks", "p5js/artworks"],
  ["p5js/gallery/gallery.css", "assets/gallery.css"],
  ["p5js/gallery/gallery.js", "assets/gallery.js"],
  ["p5js/gallery/character.js", "assets/character.js"],
  ["p5js/gallery/character-3d.js", "assets/character-3d.js"],
  ["p5js/gallery/character", "assets/character"],
  ["LICENSE", "LICENSE"],
  ["THIRD_PARTY_LICENSES", "THIRD_PARTY_LICENSES"]
];

/** The library is not in the repository, so it is taken from the pinned npm copy. */
const VENDOR_SOURCE = resolve(P5JS_DIRECTORY, "node_modules/p5/lib/p5.min.js");
const VENDOR_DESTINATION = "p5js/vendor/p5.min.js";

/**
 * three.js, likewise from the pinned npm copy, and likewise served from this site rather
 * than a content network.
 *
 * Five files, not one. The minified build imports its own core by relative path, and the
 * glTF loader — which is distributed as source, not as a build — imports two helpers the
 * same way. So the layout under `examples/jsm` has to survive the copy: flattening it
 * breaks the loader's own imports.
 */
export const VENDOR_THREE_FILES = [
  ["build/three.module.min.js", "three.module.min.js"],
  ["build/three.core.min.js", "three.core.min.js"],
  ["examples/jsm/loaders/GLTFLoader.js", "loaders/GLTFLoader.js"],
  ["examples/jsm/utils/BufferGeometryUtils.js", "utils/BufferGeometryUtils.js"],
  ["examples/jsm/utils/SkeletonUtils.js", "utils/SkeletonUtils.js"]
];

/**
 * Gives each copied artwork page its way back to the gallery, its way on to its source,
 * and the quotation it will be posted with, attributed to the primary source it was
 * verified against.
 *
 * Done here, on the copy, rather than in the artwork pages themselves: everything is
 * derived from the manifest and the quote catalog, so none of it can drift from the
 * gallery's or the posts', and the pages stay what they are in the repository — a canvas
 * and the sketch that fills it.
 *
 * The markup is written into the file rather than added by a script on load, because it has
 * to survive a reader with scripting turned off, who is exactly the reader most likely to
 * be looking at a page that never drew anything.
 */
async function decorateArtworkPages(directory, manifest, quoteCatalog) {
  for (const artwork of manifest.artworks) {
    const page = resolve(directory, artworkHref(artwork), "index.html");
    const html = await readFile(page, "utf8");
    if (!html.includes("</body>")) {
      throw new Error(`${artwork.id} has no body to decorate.`);
    }
    const additions = `${renderArtworkNav(manifest, artwork)}\n${renderArtworkAttribution(artwork, quoteCatalog)}\n  </body>`;
    await writeFile(page, html.replace("</body>", additions), "utf8");
  }
}

async function removeSiteDirectory(directory) {
  // Only ever the build output, never a path that happens to be passed in.
  if (directory !== SITE_DIRECTORY || basename(directory) !== "site") {
    throw new Error(`Refusing to clean a directory that is not the site build: ${directory}`);
  }
  await rm(directory, { recursive: true, force: true });
}

export async function buildSite(manifest, quoteCatalog, options = {}) {
  const directory = options.directory ?? SITE_DIRECTORY;
  if (options.clean) {
    await removeSiteDirectory(directory);
  }
  await mkdir(directory, { recursive: true });

  await writeFile(
    resolve(directory, "index.html"),
    renderIndexPage(manifest, quoteCatalog),
    "utf8"
  );

  for (const [source, destination] of COPIES) {
    const target = resolve(directory, destination);
    await mkdir(dirname(target), { recursive: true });
    await cp(resolve(REPOSITORY_ROOT, source), target, { recursive: true });
  }

  await decorateArtworkPages(directory, manifest, quoteCatalog);

  const vendorTarget = resolve(directory, VENDOR_DESTINATION);
  await mkdir(dirname(vendorTarget), { recursive: true });
  await cp(VENDOR_SOURCE, vendorTarget);

  for (const [source, destination] of VENDOR_THREE_FILES) {
    const target = resolve(directory, VENDOR_THREE, destination);
    await mkdir(dirname(target), { recursive: true });
    await cp(resolve(P5JS_DIRECTORY, "node_modules/three", source), target);
  }

  const thumbnails = options.thumbnails === false
    ? []
    : await renderThumbnails(
      manifest,
      manifest.artworks,
      resolve(directory, "thumbnails"),
      options.thumbnailWidth ?? THUMBNAIL_WIDTH
    );

  return { directory, thumbnails: thumbnails.length };
}
