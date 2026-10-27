import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import test from "node:test";
import { P5JS_DIRECTORY, REPOSITORY_ROOT } from "../lib/catalog.mjs";
import { typefaceRefusal } from "../lib/render.mjs";
import { cmapCodePoints, isWoff2, nameStrings, woff2Contents } from "../lib/woff2.mjs";
import {
  TYPEFACES,
  TYPEFACE_CODE_POINTS,
  loadTypefaces,
  noteText,
  typefaceFont,
  uncoveredCharacters,
  useTypeface
} from "../artworks/shared/typefaces.js";

/**
 * The faces an artwork may set its own text in. Held here: that every face the table names
 * is a file of this repository, at the weight it is named for, holding every character the
 * table says and no other printable one, with the very bytes THIRD_PARTY_LICENSES records
 * from IBM's package and the license beside it; that a weight nobody served is refused
 * rather than imitated; that a face which fails to load, and text that reaches outside the
 * faces, are recorded; and that the capture paths refuse either.
 */

const ARTWORKS = resolve(P5JS_DIRECTORY, "artworks");
const PLEX = resolve(ARTWORKS, "shared/fonts/ibm-plex");

/** The family each role's file has to say it is. */
const FAMILY_NAMES = { mono: "IBM Plex Mono", sans: "IBM Plex Sans" };

function served() {
  return Object.entries(TYPEFACES).flatMap(([role, { family, weights }]) =>
    Object.entries(weights).map(([weight, file]) => ({ role, family, weight: Number(weight), file }))
  );
}

/** Each test starts from a page that has recorded nothing. */
function freshRecord() {
  delete globalThis.__TYPEFACES__;
}

/** A face that loads at once, as a served file does, into a page that keeps nothing. */
class Arriving {
  constructor(family, source, descriptors) {
    Object.assign(this, { family, source, descriptors });
  }
  load() {
    return Promise.resolve(this);
  }
}
const PAGE = { fonts: { add() {} } };
const QUIET = { error() {} };

function loadArriving(requests) {
  return loadTypefaces(requests, { FontFace: Arriving, document: PAGE, console: QUIET });
}

/** Runs `draw` with the console's errors collected rather than printed, and returns them. */
function collectingErrors(draw) {
  const errors = [];
  const original = globalThis.console;
  globalThis.console = { error: (message) => errors.push(message) };
  try {
    draw();
  } finally {
    globalThis.console = original;
  }
  return errors;
}

const SKETCH = { textFont() {}, textWeight() {}, textSize() {} };

test("every face is IBM's own file, at its weight, holding the table's characters", async () => {
  const faces = served();
  assert.equal(faces.length, 4, "the table serves another number of faces than it was written with");
  const licences = await readFile(resolve(REPOSITORY_ROOT, "THIRD_PARTY_LICENSES"), "utf8");
  const source = await readFile(resolve(ARTWORKS, "shared/typefaces.js"), "utf8");
  assert.doesNotMatch(source, /https?:\/\//u, "the typeface module names another host");

  for (const { role, weight, file } of faces) {
    assert.equal(file.protocol, "file:", `${role} ${weight} is not served from beside the module`);
    const path = fileURLToPath(file);
    assert.equal(resolve(path, ".."), PLEX, `${role} ${weight} is not beside IBM Plex's license`);
    const bytes = await readFile(path);
    assert.ok(isWoff2(bytes), `${role} ${weight} is not a WOFF2 font`);
    const { tables } = woff2Contents(bytes);
    const table = (tag) => tables.find((candidate) => candidate.tag === tag);

    // A static face at the weight it is named for: no variation table that a browser could
    // move along, and the weight class the file itself declares.
    assert.equal(table("fvar"), undefined, `${role} ${weight} is a variable font`);
    assert.equal(table("OS/2").data.readUInt16BE(4), weight, `${role} ${weight} declares another weight`);

    // Every character the table names, so that what noteText lets through is what the face
    // can draw; and no printable character it does not name, so that the table says what
    // the faces are. IBM's sans files also map two control characters, which nothing draws.
    const held = new Set(cmapCodePoints(table("cmap").data));
    assert.deepEqual(
      [...TYPEFACE_CODE_POINTS].filter((point) => !held.has(point)),
      [],
      `${role} ${weight} lacks characters TYPEFACE_CHARACTERS names`
    );
    assert.deepEqual(
      [...held].filter((point) => point >= 0x20 && !TYPEFACE_CODE_POINTS.has(point)),
      [],
      `${role} ${weight} holds printable characters TYPEFACE_CHARACTERS does not name`
    );

    // The family the role is named for, as IBM named it: nothing here renames a face.
    const names = new Map(nameStrings(table("name").data).map(({ nameId, text }) => [nameId, text]));
    assert.equal(names.get(1), FAMILY_NAMES[role], `${role} ${weight} is not ${FAMILY_NAMES[role]}`);

    // IBM's bytes, with the record naming the file and these very bytes.
    const digest = createHash("sha256").update(bytes).digest("hex");
    const named = path.split("/").at(-1);
    assert.ok(
      licences.includes(`${named}\n`) || licences.includes(`${named} `),
      `THIRD_PARTY_LICENSES does not name ${named}`
    );
    assert.ok(licences.includes(digest), `THIRD_PARTY_LICENSES does not record ${named} (${digest})`);
  }

  // The license IBM ships with the faces sits beside them, as IBM ships it.
  const licence = await readFile(resolve(PLEX, "LICENSE.txt"));
  assert.match(licence.toString("utf8"), /^Copyright © 2017 IBM Corp\. with Reserved Font Name "Plex"/u);
  assert.match(licence.toString("utf8"), /SIL OPEN FONT LICENSE Version 1\.1/u);
  assert.ok(
    licences.includes(createHash("sha256").update(licence).digest("hex")),
    "THIRD_PARTY_LICENSES does not record the license beside the faces"
  );
});

test("the 400 and the 700 of a role are two faces, not one drawn twice", async () => {
  for (const [role, { weights }] of Object.entries(TYPEFACES)) {
    if (weights[400] && weights[700]) {
      const [regular, bold] = await Promise.all([400, 700].map((weight) => readFile(fileURLToPath(weights[weight]))));
      assert.notDeepEqual(regular, bold, `${role}'s 400 and 700 are the same file`);
    }
  }
});

test("a weight nobody served is refused, not imitated", async () => {
  freshRecord();
  assert.throws(() => typefaceFont("sans", 300, 10), /No sans face is served at weight 300/u);
  assert.throws(() => typefaceFont("serif", 400, 10), /No serif face is served/u);
  const sketch = { textFont() {}, textWeight() {}, textSize() {} };
  assert.throws(() => useTypeface(sketch, "sans", 900), /weight 900/u);
  await assert.rejects(loadTypefaces([["sans", 300]], {}), /weight 300/u);
});

test("the same choice reaches a p5 sketch and a canvas's own context", async () => {
  freshRecord();
  await loadArriving([["mono", 700], ["sans", 700]]);
  for (const [role, fallback] of [["mono", "monospace"], ["sans", "sans-serif"]]) {
    const calls = [];
    const sketch = {
      textFont: (family) => calls.push(["family", family]),
      textWeight: (weight) => calls.push(["weight", weight]),
      textSize: (size) => calls.push(["size", size])
    };
    useTypeface(sketch, role, 700, 12);
    const { family } = TYPEFACES[role];
    assert.deepEqual(calls, [["family", `${family}, ${fallback}`], ["weight", 700], ["size", 12]]);
    // What p5 sets on its context for that choice: it quotes a name with a space in it.
    assert.equal(typefaceFont(role, 700, 12), `700 12px "${family}", ${fallback}`);
  }
  assert.deepEqual(globalThis.__TYPEFACES__.unready, []);
  freshRecord();
});

test("a face set before the page had loaded it is noted, by either path, and stops a capture", async () => {
  // Never asked for: the page did not call the loader at all.
  for (const choose of [() => typefaceFont("mono", 700, 16), () => useTypeface(SKETCH, "mono", 700, 16)]) {
    freshRecord();
    const errors = collectingErrors(choose);
    noteText("123");
    assert.deepEqual(globalThis.__TYPEFACES__.unready, ["mono 700 (not requested)"]);
    assert.equal(errors.length, 1);
    assert.match(
      typefaceRefusal("atan2", globalThis.__TYPEFACES__),
      /^atan2: it set text in faces it had not loaded \(mono 700 \(not requested\)\)/u
    );
  }

  // The regular loaded and the bold chosen: the page holds no bold of the family to use.
  freshRecord();
  await loadArriving([["mono", 400]]);
  const errors = collectingErrors(() => {
    for (const choose of [useTypeface.bind(null, SKETCH), typefaceFont]) {
      choose("mono", 400, 16);
      choose("mono", 700, 16);
    }
  });
  assert.deepEqual(globalThis.__TYPEFACES__.unready, ["mono 700 (not requested)"]);
  assert.equal(errors.length, 1, "a face is noted once, however often it is set");
  assert.match(typefaceRefusal("atan2", globalThis.__TYPEFACES__), /\(mono 700 \(not requested\)\)/u);

  // Still loading when chosen: noted, and not forgiven when the face arrives afterwards.
  freshRecord();
  let arrive;
  class Slow extends Arriving {
    load() {
      return new Promise((resolve) => {
        arrive = () => resolve(this);
      });
    }
  }
  const loading = loadTypefaces([["mono", 400]], { FontFace: Slow, document: PAGE, console: QUIET });
  assert.equal(globalThis.__TYPEFACES__.faces["mono 400"], "loading");
  collectingErrors(() => typefaceFont("mono", 400, 16));
  arrive();
  assert.deepEqual(await loading, { "mono 400": "loaded" });
  assert.deepEqual(globalThis.__TYPEFACES__.unready, ["mono 400 (loading)"]);
  assert.match(typefaceRefusal("atan2", globalThis.__TYPEFACES__), /\(mono 400 \(loading\)\)/u);

  // Failed: the capture is refused for the load, and the choice is noted with it.
  freshRecord();
  class Refusing extends Arriving {
    load() {
      return Promise.reject(new Error("NetworkError"));
    }
  }
  await loadTypefaces([["mono", 400]], { FontFace: Refusing, document: PAGE, console: QUIET });
  collectingErrors(() => useTypeface(SKETCH, "mono", 400, 16));
  assert.deepEqual(globalThis.__TYPEFACES__.unready, ["mono 400 (failed)"]);
  assert.match(typefaceRefusal("atan2", globalThis.__TYPEFACES__), /have not loaded \(mono 400 \(failed\)\)/u);
  freshRecord();
});

test("a face set once the page has loaded it is let through", async () => {
  freshRecord();
  await loadArriving([["mono", 400], ["sans", 700]]);
  const errors = collectingErrors(() => {
    useTypeface(SKETCH, "mono", 400, 16);
    typefaceFont("mono", 400, 16);
    typefaceFont("sans", 700, 12);
  });
  noteText("STILL THERE  +3");
  assert.deepEqual(errors, []);
  assert.deepEqual(globalThis.__TYPEFACES__, {
    faces: { "mono 400": "loaded", "sans 700": "loaded" },
    unready: [],
    missing: []
  });
  assert.equal(typefaceRefusal("atan2", globalThis.__TYPEFACES__), null);
  freshRecord();
});

test("each face is loaded under its family at its weight, and a failure is recorded", async () => {
  freshRecord();
  const added = [];
  const errors = [];
  const page = { fonts: { add: (face) => added.push(face) } };
  const log = { error: (message) => errors.push(message) };
  class Loading {
    constructor(family, source, descriptors) {
      Object.assign(this, { family, source, descriptors });
    }
    load() {
      return Promise.resolve(this);
    }
  }
  const loaded = await loadTypefaces([["sans", 400], ["sans", 700]], { FontFace: Loading, document: page, console: log });
  assert.deepEqual(loaded, { "sans 400": "loaded", "sans 700": "loaded" });
  assert.deepEqual(added.map(({ family, descriptors }) => [family, descriptors.weight]), [
    [TYPEFACES.sans.family, "400"],
    [TYPEFACES.sans.family, "700"]
  ]);
  assert.equal(added[1].source, `url("${TYPEFACES.sans.weights[700].href}")`);

  class Refusing extends Loading {
    load() {
      return Promise.reject(new Error("NetworkError"));
    }
  }
  assert.deepEqual(
    await loadTypefaces([["sans", 700]], { FontFace: Refusing, document: page, console: log }),
    { "sans 700": "failed" }
  );
  assert.equal(errors.length, 1);
  // The page's record keeps the failure, which is what the capture paths read.
  assert.equal(globalThis.__TYPEFACES__.faces["sans 700"], "failed");
  // Outside a browser there is nothing to load into, and the record says so.
  assert.deepEqual(await loadTypefaces([["sans", 400]], {}), { "sans 400": "absent" });
  freshRecord();
});

test("text that reaches outside the faces is noted, and text inside them is not", () => {
  freshRecord();
  const errors = [];
  const log = { error: (message) => errors.push(message) };
  const line = "atan2(y, x) = +0.942 rad = + 54.0°";
  assert.equal(noteText(line, log), line);
  assert.deepEqual(uncoveredCharacters(line), []);
  assert.equal(errors.length, 0);
  assert.equal(noteText("θ = 0.5π", log), "θ = 0.5π");
  assert.deepEqual(globalThis.__TYPEFACES__.missing, ["θ", "π"]);
  // Noted once, however often it is drawn.
  noteText("θ", log);
  assert.equal(errors.length, 2);
  freshRecord();
});

test("a capture is never written in a fallback face, nor with characters no face holds", () => {
  // A page that neither asks for a face nor sets text in one records nothing and is asked nothing.
  assert.equal(typefaceRefusal("lorenz", null), null);
  assert.equal(typefaceRefusal("atan2", { faces: { "mono 400": "loaded" }, unready: [], missing: [] }), null);
  for (const status of ["loading", "failed", "absent"]) {
    assert.match(
      typefaceRefusal("atan2", { faces: { "mono 400": "loaded", "sans 700": status }, unready: [], missing: [] }),
      new RegExp(`^atan2: its typefaces have not loaded \\(sans 700 \\(${status}\\)\\)`, "u")
    );
  }
  assert.match(
    typefaceRefusal("atan2", { faces: { "mono 400": "loaded" }, unready: ["mono 700 (not requested)"], missing: [] }),
    /^atan2: it set text in faces it had not loaded \(mono 700 \(not requested\)\)/u
  );
  assert.match(
    typefaceRefusal("atan2", { faces: { "mono 400": "loaded" }, unready: [], missing: ["θ"] }),
    /^atan2: its text reaches characters no served face holds \(θ\)/u
  );
});
