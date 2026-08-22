import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  ACT_FRAMES,
  ACTS,
  ADDED_AREA,
  ADDED_AREA_QUARTERS,
  COMPLETED_AREA,
  COMPLETED_AREA_QUARTERS,
  COMPLETED_SIDE,
  COMPLETED_SIDE_ON_PAGE,
  COMPLETED_SIDE_TWICE,
  DURATION_SECONDS,
  GIVEN_AREA,
  HALF_UNITS_PER_UNIT,
  LOGICAL_SIZE,
  PAGE_MARGIN,
  PLAYBACK_FPS,
  PROOF_SIDE_COUNT,
  REGIONS,
  ROOT_COEFFICIENT,
  SIDE_WIDTH_TWICE,
  TOTAL_FRAMES,
  UNIT_ON_PAGE,
  UNKNOWN_SIDE,
  UNKNOWN_SIDE_TWICE,
  WING_COUNT,
  WING_WIDTH,
  WING_WIDTH_TWICE,
  WINGS_PER_SIDE,
  actAt,
  areaInQuarterUnits,
  equationInQuarterUnits,
  positiveHalfUnitSolutions,
  reducedRational,
  regionArea,
  regionOnPage,
  sceneAt
} from "../artworks/made-whole/made-whole.js";
import { renderIndexPage } from "../lib/gallery.mjs";
import {
  buildPostBody,
  validatePostBody
} from "../lib/post-text.mjs";

const SKETCH = readFileSync(
  new URL("../artworks/made-whole/sketch.js", import.meta.url),
  "utf8"
);
const INDEX_HTML = readFileSync(
  new URL("../artworks/made-whole/index.html", import.meta.url),
  "utf8"
);
const MODEL = readFileSync(
  new URL("../artworks/made-whole/made-whole.js", import.meta.url),
  "utf8"
);
const README = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const SCHEDULE_TEST = readFileSync(new URL("./schedule.test.mjs", import.meta.url), "utf8");
const TEST_SOURCE = readFileSync(new URL(import.meta.url), "utf8");
const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));

test("ten roots yield the half-widths used by both geometric proofs", () => {
  assert.equal(ROOT_COEFFICIENT, 10);
  assert.equal(GIVEN_AREA, 39);
  assert.equal(WING_COUNT, 4);
  assert.equal(PROOF_SIDE_COUNT, 2);

  assert.deepEqual(WING_WIDTH, { numerator: 5, denominator: 2 });
  assert.equal(WING_WIDTH_TWICE, 5);
  assert.equal(WINGS_PER_SIDE, 2);
  assert.equal(SIDE_WIDTH_TWICE, WING_WIDTH_TWICE * WINGS_PER_SIDE);
  assert.equal(SIDE_WIDTH_TWICE / HALF_UNITS_PER_UNIT, 5);

  // Control: reduction is doing work rather than returning the two inputs unchanged.
  assert.deepEqual(reducedRational(10, 4), { numerator: 5, denominator: 2 });
  assert.throws(() => reducedRational(1, 0), /non-zero denominator/u);
});

test("three is the only positive half-unit solution of the stated equation", () => {
  const solutions = positiveHalfUnitSolutions();
  assert.deepEqual(solutions, [6]);
  assert.equal(UNKNOWN_SIDE_TWICE, solutions[0]);
  assert.equal(UNKNOWN_SIDE, 3);

  const target = GIVEN_AREA * HALF_UNITS_PER_UNIT ** 2;
  assert.equal(equationInQuarterUnits(UNKNOWN_SIDE_TWICE), target);
  assert.equal(
    areaInQuarterUnits(UNKNOWN_SIDE_TWICE, UNKNOWN_SIDE_TWICE)
      + PROOF_SIDE_COUNT * areaInQuarterUnits(UNKNOWN_SIDE_TWICE, SIDE_WIDTH_TWICE),
    target
  );

  // Constructed control: changing only thirty-nine to forty makes the known root fail and
  // the same exhaustive half-unit scan finds no substitute.
  assert.notEqual(
    equationInQuarterUnits(UNKNOWN_SIDE_TWICE),
    40 * HALF_UNITS_PER_UNIT ** 2
  );
  assert.deepEqual(positiveHalfUnitSolutions(ROOT_COEFFICIENT, 40), []);
});

function overlapInQuarterUnits(first, second) {
  const width = Math.max(0,
    Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));
  const height = Math.max(0,
    Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));
  return width * height;
}

function marginsOf(regions) {
  const left = Math.min(...regions.map((region) => region.x));
  const top = Math.min(...regions.map((region) => region.y));
  const right = LOGICAL_SIZE - Math.max(...regions.map((region) => region.x + region.width));
  const bottom = LOGICAL_SIZE - Math.max(...regions.map((region) => region.y + region.height));
  return [left, top, right, bottom];
}

test("the two strips and their missing corner partition one exact eight-by-eight square", () => {
  assert.deepEqual(REGIONS.map((region) => region.id), [
    "unknown",
    "root-horizontal",
    "root-vertical",
    "completion"
  ]);
  assert.deepEqual(REGIONS.map(regionArea), [9, 15, 15, 25]);
  assert.equal(REGIONS.slice(0, 3).reduce((sum, region) => sum + regionArea(region), 0), GIVEN_AREA);
  assert.equal(REGIONS.reduce((sum, region) => sum + regionArea(region), 0), COMPLETED_AREA);
  assert.equal(ADDED_AREA_QUARTERS, 100);
  assert.equal(ADDED_AREA, 25);
  assert.equal(COMPLETED_AREA_QUARTERS, 256);
  assert.equal(COMPLETED_AREA, 64);
  assert.equal(COMPLETED_SIDE_TWICE, UNKNOWN_SIDE_TWICE + SIDE_WIDTH_TWICE);
  assert.equal(COMPLETED_SIDE, 8);

  let pairs = 0;
  for (let first = 0; first < REGIONS.length; first += 1) {
    for (let second = first + 1; second < REGIONS.length; second += 1) {
      pairs += 1;
      assert.equal(overlapInQuarterUnits(REGIONS[first], REGIONS[second]), 0);
    }
  }
  assert.equal(pairs, 6);

  const onPage = REGIONS.map(regionOnPage);
  assert.ok(onPage.flatMap((region) => Object.values(region)).every(Number.isInteger));
  assert.equal(COMPLETED_SIDE_ON_PAGE, COMPLETED_SIDE * UNIT_ON_PAGE);
  assert.equal(PAGE_MARGIN, 100);
  assert.deepEqual(marginsOf(onPage), [PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN]);

  // Constructed control: moving the final corner by one half-unit breaks the right margin,
  // which shows that the margin survey depends on the composite rather than the canvas alone.
  const shifted = onPage.map((region, index) => (
    index === 3 ? { ...region, x: region.x + UNIT_ON_PAGE / 2 } : region
  ));
  assert.notDeepEqual(marginsOf(shifted), [PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN]);
});

test("the clip has four ordered acts and each adds only what the proof calls for", () => {
  assert.equal(TOTAL_FRAMES, PLAYBACK_FPS * DURATION_SECONDS);
  assert.equal(TOTAL_FRAMES, 300);
  assert.deepEqual(ACTS, ["unknown", "roots", "completion", "count"]);
  assert.equal(ACT_FRAMES.reduce((sum, frames) => sum + frames, 0), TOTAL_FRAMES);

  let previous = -1;
  const seen = new Set();
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const act = actAt(frame);
    assert.ok(act >= previous, `frame ${frame} went back from act ${previous} to ${act}`);
    previous = act;
    seen.add(act);
    assert.deepEqual(sceneAt(frame), sceneAt(frame), `frame ${frame} is not deterministic`);
  }
  assert.deepEqual([...seen], [0, 1, 2, 3]);

  const unknown = sceneAt(30);
  assert.equal(unknown.actName, "unknown");
  assert.deepEqual([unknown.horizontalRoot, unknown.verticalRoot, unknown.completion, unknown.count],
    [0, 0, 0, 0]);

  const roots = sceneAt(135);
  assert.equal(roots.actName, "roots");
  assert.deepEqual([roots.horizontalRoot, roots.verticalRoot], [1, 1]);
  assert.deepEqual([roots.completion, roots.count], [0, 0]);

  const corner = sceneAt(220);
  assert.equal(corner.actName, "completion");
  assert.equal(corner.completion, 1);
  assert.equal(corner.count, 0);

  const count = sceneAt(285);
  assert.equal(count.actName, "count");
  assert.equal(count.completion, 1);
  assert.equal(count.count, 1);
  assert.equal(actAt(TOTAL_FRAMES), 0);
});

function drawingFunctions(source) {
  return [...source.matchAll(/\bfunction draw(?<name>[A-Z][A-Za-z]+)\(/gu)]
    .map((match) => match.groups.name)
    .sort();
}

function forbiddenMarks(source) {
  const calls = [...source.matchAll(
    /\bp\.(?<name>text|textAlign|textFont|textLeading|textSize|triangle)\s*\(/gu
  )].map((match) => match.groups.name);
  if (/\bdrawKeyHint\b/u.test(source)) {
    calls.push("drawKeyHint");
  }
  return calls.sort();
}

test("the drawing vocabulary has fields, hatching, grids and borders but no notation", () => {
  const allowedFunctions = [
    "CellGrid",
    "CountingGrid",
    "Field",
    "Frame",
    "Hatch",
    "InsideBorder",
    "Region"
  ];
  assert.deepEqual(drawingFunctions(SKETCH), allowedFunctions);
  for (const name of allowedFunctions) {
    const calls = [...SKETCH.matchAll(new RegExp(`\\bdraw${name}\\(`, "gu"))];
    assert.ok(calls.length >= 2, `draw${name} is declared but never survives into the drawing`);
  }
  assert.deepEqual(forbiddenMarks(SKETCH), []);
  assert.doesNotMatch(SKETCH, /\b(?:Math\.)?random\s*\(/u);

  const roles = [...new Set(REGIONS.map((region) => region.role))].sort();
  assert.deepEqual(roles, ["completion", "root", "unknown"]);
  assert.ok(REGIONS.every((region) => roles.includes(region.role)));

  // Constructed controls: both a semantic label layer and p5's text API are caught. These
  // are controls made for this detector, not defects that ever appeared in the artwork.
  assert.ok(drawingFunctions(`${SKETCH}\nfunction drawLabel() {}` ).includes("Label"));
  assert.deepEqual(forbiddenMarks(`${SKETCH}\np.text("8", 0, 0);`), ["text"]);
});

test("umber belongs only to the missing corner and cannot be changed by a URL", () => {
  assert.match(SKETCH, /const UMBER = \[156, 100, 66\];/u);
  assert.match(SKETCH, /const COMPLETION_INK = UMBER;/u);
  assert.match(SKETCH, /colour: COMPLETION_INK,/u);
  assert.match(SKETCH, /fillAlpha: 28,/u);
  assert.match(SKETCH, /hatchAlpha: 142,/u);
  assert.match(SKETCH, /gridAlpha: 54,/u);
  assert.match(SKETCH, /palette: "umber",/u);
  assert.doesNotMatch(SKETCH, /PARAMETERS\.get\("palette"\)/u);
  assert.equal((SKETCH.match(/colour: COMPLETION_INK,/gu) ?? []).length, 1);
});

test("the manifest registers a ten-second square clip and its completed thumbnail", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "made-whole");
  assert.equal(artwork.title, "Made Whole");
  assert.equal(artwork.entry, "p5js/artworks/made-whole/index.html");
  assert.equal(artwork.interactivePath, "made-whole/");
  assert.deepEqual(artwork.canvas, { width: LOGICAL_SIZE, height: LOGICAL_SIZE });
  assert.deepEqual(artwork.quoteIds, ["khwarizmi-mal-wa-ashara"]);
  assert.deepEqual(artwork.thumbnail, { frame: 285 });
  assert.deepEqual(artwork.render, {
    kind: "video",
    artifact: "exports/p5js/MadeWhole.mp4",
    durationSeconds: DURATION_SECONDS,
    scale: 2
  });

  assert.match(SKETCH, /from "\.\/made-whole\.js"/u);
  assert.doesNotMatch(SKETCH, /roots:\s*10/u);
  assert.match(INDEX_HTML, /<title>Made Whole<\/title>/u);
});

test("the Arabic catalog text is Rosen's page reading, codepoint for codepoint", () => {
  const quote = CATALOG.quotes.find((entry) => entry.id === "khwarizmi-mal-wa-ashara");
  assert.equal(quote.text, "مال وعشرة اجذاره يعدل تسعة وثلثين درهما");
  assert.equal(quote.text.normalize("NFC"), quote.text);
  assert.equal(quote.text.length, 39);
  assert.deepEqual([...quote.text].map((character) => character.codePointAt(0)), [
    0x0645, 0x0627, 0x0644, 0x0020, 0x0648, 0x0639, 0x0634, 0x0631, 0x0629,
    0x0020, 0x0627, 0x062c, 0x0630, 0x0627, 0x0631, 0x0647, 0x0020, 0x064a,
    0x0639, 0x062f, 0x0644, 0x0020, 0x062a, 0x0633, 0x0639, 0x0629, 0x0020,
    0x0648, 0x062b, 0x0644, 0x062b, 0x064a, 0x0646, 0x0020, 0x062f, 0x0631,
    0x0647, 0x0645, 0x0627
  ]);
  assert.equal(quote.lang, "ar");
  assert.equal(quote.author, "محمد بن موسى الخوارزمي");
  assert.equal(quote.source, "كتاب الجبر والمقابلة، الأموال والجذور التي تعدل العدد");
  assert.equal(quote.year, null);
  assert.equal(quote.publicDomain, true);
  assert.equal(
    quote.sourceUrl,
    "https://archive.org/details/algebraofmohamme00khuwuoft/page/n351/mode/1up"
  );

  assert.equal(CATALOG.quotes.filter((entry) => entry.lang === "ar").length, 1);
  assert.equal(CATALOG.quotes.length, 45);
});

test("the gallery card and post carry the same Arabic record within the post limit", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "made-whole");
  const quote = CATALOG.quotes.find((entry) => entry.id === "khwarizmi-mal-wa-ashara");
  const body = buildPostBody(artwork, quote, MANIFEST.defaults.interactiveBaseUrl);
  assert.equal(validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters), 160);
  assert.equal(body, [
    quote.text,
    `— ${quote.author}, ${quote.source}`,
    "",
    "#generativeart",
    "",
    "https://mukoubuchi.github.io/generative-art/p5js/artworks/made-whole/"
  ].join("\n"));

  const index = renderIndexPage(MANIFEST, CATALOG);
  const cardStart = index.indexOf('<h2 class="card__title">Made Whole</h2>');
  const card = index.slice(cardStart, index.indexOf("</li>", cardStart));
  assert.ok(cardStart >= 0);
  assert.match(card, /<blockquote class="card__quote" lang="ar">/u);
  assert.ok(card.includes(quote.text));
  assert.ok(card.includes(quote.author));
  assert.ok(card.includes(quote.source));
});

test("the notes state the proof choice, attribution boundary and witness level", () => {
  assert.match(README, /The four-wing explanation is equally part of the text/u);
  assert.match(README, /its two `5×x` rectangles and its `5×5` corner lie on one unit grid/u);
  assert.match(README, /No letter, numeral, arrow or dimension line is drawn/u);
  assert.match(README, /The attribution separates the statement from the proof/u);
  assert.ok(README.includes("ثلثين] Rosen 1830/31, p. 5 : ثلاثين Cairo 1937, p. 18"));
  assert.match(README, /two printed editions read from page images, both derived from the same Oxford manuscript/u);
  assert.match(README, /not two independent manuscript lines/u);
  assert.match(README, /Digital Bodleian currently exposes one canvas labelled fol\. 4v–5r/u);
  assert.match(README, /Metadata is a different surface/u);
  assert.match(README, /Turn It and Turn It is the closest earlier work in register/u);
  assert.match(README, /title takes the older concrete sense carried by the Arabic root/u);
  assert.match(README, /al-jabr\* names the operation of moving a subtracted term to the other side/u);
  assert.match(README, /does not call the completion of this square \*al-jabr\*/u);
  assert.match(README, /The missing corner alone is given one earth-coloured umber/u);
  assert.doesNotMatch(README, /visual gate/u);
});

test("the retired slug and title have no live references", () => {
  const retiredId = ["completing", "the", "square"].join("-");
  const retiredTitle = ["Completing", "the", "Square"].join(" ");
  const liveSurfaces = [
    INDEX_HTML,
    MODEL,
    SKETCH,
    README,
    SCHEDULE_TEST,
    TEST_SOURCE,
    JSON.stringify(MANIFEST)
  ];
  for (const source of liveSurfaces) {
    assert.equal(source.includes(retiredId), false);
    assert.equal(source.includes(retiredTitle), false);
  }
  assert.equal(existsSync(new URL(`../artworks/${retiredId}/`, import.meta.url)), false);
  assert.equal(existsSync(new URL("../artworks/made-whole/", import.meta.url)), true);
  assert.doesNotMatch(renderIndexPage(MANIFEST, CATALOG), new RegExp(retiredId, "u"));
});
