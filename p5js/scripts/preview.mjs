#!/usr/bin/env node

/**
 * Serves the built site the way GitHub Pages serves a project site: under a path prefix
 * rather than at the root of a host. Opening site/index.html from the file system is not
 * the same test — the artwork pages load their sketches as modules, which a browser
 * refuses to fetch over file://, so every artwork would come up blank.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { SITE_DIRECTORY } from "../lib/site.mjs";

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"]
]);

function option(argumentsList, name, fallback) {
  const index = argumentsList.indexOf(name);
  return index === -1 || !argumentsList[index + 1] ? fallback : argumentsList[index + 1];
}

const argumentsList = process.argv.slice(2);
const prefix = option(argumentsList, "--prefix", "/generative-art").replace(/\/$/u, "");
const port = Number.parseInt(option(argumentsList, "--port", "4173"), 10);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error("Usage: npm run preview -- [--port <number>] [--prefix </path>]");
  process.exit(2);
}

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  if (!pathname.startsWith(`${prefix}/`) && pathname !== prefix) {
    response.statusCode = 302;
    response.setHeader("Location", `${prefix}/`);
    response.end();
    return;
  }

  let path = resolve(SITE_DIRECTORY, `.${pathname.slice(prefix.length) || "/"}`);
  if (!path.startsWith(`${SITE_DIRECTORY}${sep}`) && path !== SITE_DIRECTORY) {
    response.statusCode = 403;
    response.end("Forbidden");
    return;
  }
  try {
    if ((await stat(path)).isDirectory()) {
      path = join(path, "index.html");
    }
  } catch {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }

  response.setHeader(
    "Content-Type",
    CONTENT_TYPES.get(extname(path)) ?? "application/octet-stream"
  );
  createReadStream(path)
    .on("error", () => {
      response.statusCode = 404;
      response.end("Not found");
    })
    .pipe(response);
});

// A preview server is run by hand, so its failures are read by a person. The common one is
// a second copy started while the first is still up, which otherwise arrives as an
// unhandled 'error' event and a stack trace.
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use — a preview may already be running at`);
    console.error(`  http://127.0.0.1:${port}${prefix}/`);
    console.error("Open that, or start this one elsewhere with: npm run preview -- --port 4174");
    process.exit(1);
  }
  if (error.code === "EACCES") {
    console.error(`Port ${port} needs privileges this process does not have.`);
    console.error("Pick a port above 1023, for example: npm run preview -- --port 4173");
    process.exit(1);
  }
  throw error;
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${SITE_DIRECTORY}`);
  console.log(`  http://127.0.0.1:${port}${prefix}/`);
  console.log("Press Ctrl+C to stop.");
});
