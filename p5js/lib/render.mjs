import { createReadStream } from "node:fs";
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import {
  P5JS_DIRECTORY,
  REPOSITORY_ROOT,
  repositoryPath,
  thumbnailFrame
} from "./catalog.mjs";

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"]
]);

function serveFile(response, path) {
  response.statusCode = 200;
  response.setHeader("Content-Type", CONTENT_TYPES.get(extname(path)) ?? "application/octet-stream");
  createReadStream(path).on("error", () => {
    if (!response.headersSent) {
      response.statusCode = 404;
    }
    response.end("Not found");
  }).pipe(response);
}

/**
 * The artwork pages ask for p5 at `../../vendor/p5.min.js`, which resolves to this path
 * from any artwork directory. A relative reference is what lets the same page work here and
 * under a deployment that lives in a subdirectory rather than at a host's root; the library
 * itself is not in the repository, so it is served straight out of node_modules here and
 * copied into place when the site is built.
 */
const VENDOR_P5_PATH = "/p5js/vendor/p5.min.js";

function resolveRequestPath(requestUrl, root) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  // Only over the repository. A built site carries its own copy of the library at this
  // path, and serving node_modules in its place would quietly excuse a build that had
  // failed to put one there.
  if (root === REPOSITORY_ROOT && pathname === VENDOR_P5_PATH) {
    return resolve(P5JS_DIRECTORY, "node_modules/p5/lib/p5.min.js");
  }
  const requestPath = resolve(root, `.${pathname}`);
  if (!requestPath.startsWith(`${root}${sep}`)) {
    return undefined;
  }
  return requestPath;
}

/**
 * A static server over the repository, with the one mapping the artwork pages need: p5 is
 * not in the tree, so the vendor path is served out of node_modules. Exported so that a
 * check which has to open real pages can use the same server the renderer does rather than
 * keep a second copy of these rules.
 *
 * A root can be given instead, for a check that has to open the pages as a reader gets
 * them: the site build adds things to the pages it copies, and a page taken from the
 * repository is a page those additions have not been made to.
 */
export async function startStaticServer(root = REPOSITORY_ROOT) {
  const server = createServer((request, response) => {
    const requestPath = resolveRequestPath(request.url ?? "/", root);
    if (!requestPath) {
      response.statusCode = 403;
      response.end("Forbidden");
      return;
    }
    serveFile(response, requestPath);
  });
  await new Promise((resolveListening, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListening);
  });
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolveClose, reject) => {
      server.close((error) => error ? reject(error) : resolveClose());
    })
  };
}

async function runCommand(command, argumentsList) {
  return await new Promise((resolveCommand, reject) => {
    const child = spawn(command, argumentsList, { stdio: ["ignore", "pipe", "pipe"] });
    let standardOutput = "";
    let standardError = "";
    child.stdout.on("data", (chunk) => {
      standardOutput += chunk;
    });
    child.stderr.on("data", (chunk) => {
      standardError += chunk;
    });
    child.once("error", reject);
    child.once("close", (exitCode) => {
      if (exitCode === 0) {
        resolveCommand({ standardOutput, standardError });
        return;
      }
      reject(new Error(`${command} exited with ${exitCode}:\n${standardError}`));
    });
  });
}

async function removeTemporaryDirectory(path) {
  const temporaryRoot = await realpath(tmpdir());
  const resolvedPath = await realpath(path);
  if (
    dirname(resolvedPath) !== temporaryRoot
    || !basename(resolvedPath).startsWith("generative-art-render-")
  ) {
    throw new Error(`Refusing to remove unexpected temporary directory: ${resolvedPath}`);
  }
  await rm(resolvedPath, { recursive: true });
}

async function verifyVideo(path, outputSize, maximumSeconds) {
  const { standardOutput } = await runCommand("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration",
    "-of", "json",
    path
  ]);
  const probe = JSON.parse(standardOutput);
  const stream = probe.streams?.[0];
  const duration = Number(probe.format?.duration);
  if (
    stream?.width !== outputSize.width
    || stream?.height !== outputSize.height
    || !Number.isFinite(duration)
    || duration > maximumSeconds
  ) {
    throw new Error(`Video verification failed for ${path}.`);
  }
  return duration;
}

async function renderImage(page, artifactPath) {
  await page.locator("canvas").screenshot({ path: artifactPath });
  const artifactStats = await stat(artifactPath);
  if (artifactStats.size === 0) {
    throw new Error(`Image renderer produced an empty file: ${artifactPath}`);
  }
  return { bytes: artifactStats.size };
}

async function renderVideo(page, artwork, artifactPath, defaults, outputSize) {
  const frameCount = Math.round(artwork.render.durationSeconds * defaults.fps);
  const frameDirectory = await mkdtemp(join(tmpdir(), "generative-art-render-"));
  try {
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const state = await page.evaluate(
        (requestedFrame) => window.__renderFrame(requestedFrame),
        frameIndex
      );
      if (state.frameIndex !== frameIndex || state.totalFrames !== frameCount) {
        throw new Error(`Artwork returned inconsistent state for frame ${frameIndex}.`);
      }
      await page.locator("canvas").screenshot({
        path: join(frameDirectory, `frame-${String(frameIndex).padStart(6, "0")}.png`)
      });
    }

    await runCommand("ffmpeg", [
      "-y",
      "-framerate", String(defaults.fps),
      "-start_number", "0",
      "-i", join(frameDirectory, "frame-%06d.png"),
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      artifactPath
    ]);
    const duration = await verifyVideo(
      artifactPath,
      outputSize,
      defaults.maxVideoSeconds
    );
    return { frameCount, duration };
  } finally {
    await removeTemporaryDirectory(frameDirectory);
  }
}

/**
 * Opens an artwork at a given export scale and waits for it to declare itself drawn. The
 * caller is handed the page and is responsible for closing it.
 */
/**
 * How much larger the key hint is drawn in a thumbnail than on the page.
 *
 * A card fits the canvas into a 4:3 opening about 350 pixels wide, so a square artwork
 * arrives there at around two fifths of its own size and the page's 18-point hint would
 * land at seven. This brings it back to something a reader can actually read. It is the
 * one thing in a thumbnail that is not to scale, and it is chrome rather than artwork.
 */
export const THUMBNAIL_HINT_SCALE = 1.7;

async function openArtworkPage(browser, serverBaseUrl, artwork, scale, extraParameters = {}) {
  const outputSize = {
    width: artwork.canvas.width * scale,
    height: artwork.canvas.height * scale
  };
  const page = await browser.newPage({ viewport: outputSize, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    const entryUrl = new URL(`/${artwork.entry}`, serverBaseUrl);
    entryUrl.searchParams.set("capture", "1");
    entryUrl.searchParams.set("renderScale", String(scale));
    for (const [name, value] of Object.entries(extraParameters)) {
      entryUrl.searchParams.set(name, String(value));
    }
    await page.goto(entryUrl.href, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__ARTWORK_READY__ === true, undefined, {
      timeout: 15_000
    });
    if (pageErrors.length > 0) {
      throw new Error(`Artwork page failed:\n${pageErrors.join("\n")}`);
    }

    const canvasSize = await page.locator("canvas").evaluate((canvas) => ({
      width: canvas.width,
      height: canvas.height
    }));
    if (canvasSize.width !== outputSize.width || canvasSize.height !== outputSize.height) {
      throw new Error(`Unexpected canvas size: ${canvasSize.width}x${canvasSize.height}`);
    }
  } catch (error) {
    await page.close();
    throw error;
  }
  return { page, outputSize };
}

async function renderArtworkPage(browser, serverBaseUrl, manifest, artwork) {
  const defaults = manifest.defaults;
  const artifactPath = repositoryPath(artwork.render.artifact);
  await mkdir(dirname(artifactPath), { recursive: true });

  const { page, outputSize } = await openArtworkPage(
    browser,
    serverBaseUrl,
    artwork,
    artwork.render.scale
  );
  try {
    const details = artwork.render.kind === "image"
      ? await renderImage(page, artifactPath)
      : await renderVideo(page, artwork, artifactPath, defaults, outputSize);
    return { artifactPath, outputSize, ...details };
  } finally {
    await page.close();
  }
}

async function captureThumbnail(browser, serverBaseUrl, manifest, artwork, width) {
  // Thumbnails are taken at the logical size: a gallery card never needs the export scale,
  // and for the eleven moving artworks it saves rendering a whole clip to keep one frame.
  //
  // Unlike an export, a thumbnail carries the key hint. It is a picture of a page that can
  // be typed at, and a reader deciding whether to open a card should be able to see that
  // there is something to do there.
  const { page } = await openArtworkPage(browser, serverBaseUrl, artwork, 1, {
    hint: "1",
    hintScale: THUMBNAIL_HINT_SCALE
  });
  try {
    const frame = thumbnailFrame(manifest, artwork);
    if (frame !== undefined) {
      await page.evaluate((requested) => window.__renderFrame(requested), frame);
    }

    // Whether a legend fits can only be settled where the text is measured, so it is
    // settled here, on the picture about to be written. The card sets the note 1.7
    // times larger than the page does on a canvas of the same width, so this is the
    // place a legend overruns first — and the run stops rather than writing a card with
    // the words running off the edge.
    const hint = await page.evaluate(() => window.__KEY_HINT_BOUNDS__ ?? null);
    if (hint && (hint.left < 0 || hint.right > hint.canvas.width || hint.bottom > hint.canvas.height)) {
      throw new Error(
        `${artwork.id}: the legend runs outside the canvas ` +
        `(${hint.left.toFixed(1)}..${hint.right.toFixed(1)} of ${hint.canvas.width})`
      );
    }
    // Scaled down and encoded inside the page, so no image library is needed on this side.
    const dataUrl = await page.evaluate((targetWidth) => {
      const source = document.querySelector("canvas");
      const target = document.createElement("canvas");
      target.width = Math.min(targetWidth, source.width);
      target.height = Math.round(source.height * (target.width / source.width));
      const context = target.getContext("2d");
      context.imageSmoothingQuality = "high";
      context.drawImage(source, 0, 0, target.width, target.height);
      return target.toDataURL("image/jpeg", 0.82);
    }, width);
    return { frame, bytes: Buffer.from(dataUrl.split(",")[1], "base64") };
  } finally {
    await page.close();
  }
}

async function withBrowserSession(run) {
  const server = await startStaticServer();
  let browser;
  try {
    const channel = process.env.PLAYWRIGHT_CHANNEL?.trim();
    browser = await chromium.launch({
      headless: true,
      ...(channel ? { channel } : {})
    });
    return await run(browser, server.baseUrl);
  } finally {
    if (browser) {
      await browser.close();
    }
    await server.close();
  }
}

export async function renderArtworks(manifest, artworks) {
  return await withBrowserSession(async (browser, serverBaseUrl) => {
    const results = [];
    for (const artwork of artworks) {
      results.push(await renderArtworkPage(browser, serverBaseUrl, manifest, artwork));
    }
    return results;
  });
}

/**
 * One JPEG per artwork, written into `directory` as `<id>.jpg`. Nothing here is committed:
 * the gallery is built from these at deploy time.
 */
export async function renderThumbnails(manifest, artworks, directory, width) {
  await mkdir(directory, { recursive: true });
  return await withBrowserSession(async (browser, serverBaseUrl) => {
    const results = [];
    for (const artwork of artworks) {
      const { frame, bytes } = await captureThumbnail(
        browser,
        serverBaseUrl,
        manifest,
        artwork,
        width
      );
      const path = join(directory, `${artwork.id}.jpg`);
      await writeFile(path, bytes);
      results.push({ id: artwork.id, path, frame, bytes: bytes.length });
    }
    return results;
  });
}

export async function renderArtwork(manifest, artwork) {
  const [result] = await renderArtworks(manifest, [artwork]);
  return result;
}
