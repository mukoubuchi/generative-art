import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, posix, resolve } from "node:path";
import test from "node:test";
import { P5JS_DIRECTORY, loadCatalog } from "../lib/catalog.mjs";
import { VENDOR_THREE, renderIndexPage } from "../lib/gallery.mjs";
import { VENDOR_THREE_FILES } from "../lib/site.mjs";

const THREE_DIRECTORY = resolve(P5JS_DIRECTORY, "node_modules/three");

/** Every path the build writes under the site root, as the page would address it. */
const published = new Set(VENDOR_THREE_FILES.map(([, destination]) => posix.join(VENDOR_THREE, destination)));

function importMap(html) {
  const [, body] = html.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/u);
  return JSON.parse(body).imports;
}

/** Resolves a bare specifier the way a browser would, given the map and the page's location. */
function resolveSpecifier(imports, specifier) {
  if (imports[specifier]) {
    return posix.normalize(imports[specifier]);
  }
  const prefix = Object.keys(imports)
    .filter((key) => key.endsWith("/") && specifier.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  assert.ok(prefix, `nothing in the import map covers ${specifier}`);
  return posix.normalize(imports[prefix] + specifier.slice(prefix.length));
}

test("the import map points at files the build actually copies", async () => {
  const { manifest, quoteCatalog } = await loadCatalog();
  const imports = importMap(renderIndexPage(manifest, quoteCatalog));

  for (const specifier of ["three", "three/addons/loaders/GLTFLoader.js"]) {
    const address = resolveSpecifier(imports, specifier);
    assert.ok(
      published.has(address),
      `the map sends ${specifier} to ${address}, which the build does not write`
    );
  }
});

test("the copied three.js files can resolve their own relative imports", async () => {
  // The minified build imports its core, and the glTF loader is shipped as source and
  // imports its helpers, all by relative path. Copying one file without the others leaves a
  // page that fails only in the browser, so the imports are followed here instead: an
  // upgrade that adds a helper fails this test rather than the masthead.
  const copied = new Map(VENDOR_THREE_FILES);
  const pending = [...copied.keys()];
  const seen = new Set();

  while (pending.length > 0) {
    const file = pending.pop();
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);
    assert.ok(copied.has(file), `${file} is imported but not copied into the site`);

    const source = await readFile(resolve(THREE_DIRECTORY, file), "utf8");
    const specifiers = [...source.matchAll(/(?:^|[\s;])(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/gmu)]
      .map(([, specifier]) => specifier)
      .filter((specifier) => specifier.startsWith("."));

    for (const specifier of specifiers) {
      pending.push(posix.normalize(posix.join(dirname(file), specifier)));
    }
  }

  // Nothing is carried along that nothing asks for.
  assert.deepEqual(seen, new Set(copied.keys()));
});
