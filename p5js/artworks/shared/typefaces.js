/**
 * The typefaces an artwork may set its own text in, chosen by role and weight from one table.
 *
 * An artwork that names a generic family is drawn in whatever face the machine has under
 * that name. In a diagnostic run the system's match for monospace was DejaVu Sans Mono on
 * CI's runner and WenQuanYi Zen Hei Mono in Playwright's image, and the cards built in the
 * two environments set Atan2's and Still There's words differently. A face named here is
 * served from this repository instead, at a weight it actually has. Asking for a role or a
 * weight the table does not hold is an error rather than a fallback: a browser asked for a
 * weight it has no face for may stand another weight's face in for it, or thicken one into
 * a bold, and a page drawn that way would look finished.
 *
 * The faces are IBM Plex Mono and IBM Plex Sans, by IBM, under the SIL Open Font License
 * 1.1, whose text sits beside them in fonts/ibm-plex/. Each file is IBM's own Latin1 cut
 * from the split web fonts of the family's npm package, copied byte for byte. Nothing here
 * cuts or renames a font: a cut made here would be a Modified Version, which the license's
 * Reserved Font Name, "Plex", would oblige to take another name.
 *
 * Each face text is set in is noted as it is chosen, with whether the page had loaded it by
 * then, and so is each character outside TYPEFACE_CHARACTERS that a string reaches. A
 * reader's page goes on in whatever the browser puts in their place. The capture paths
 * refuse a page whose faces did not all load, that set text in a face it had not loaded,
 * or whose text reached such a character (see `typefaceRefusal` in lib/render.mjs).
 */

/**
 * The characters every face holds: the range IBM's stylesheet gives the Latin1 files. It is
 * printable ASCII and the Latin-1 letters and signs (the degree, plus-minus, multiplication
 * and division signs among them), with the dashes, the curly quotes, the ellipsis, the euro
 * and the minus sign. The letter π and the arrows are in IBM's other cuts, which are not
 * served.
 */
export const TYPEFACE_CHARACTERS =
  "U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2013-2014,U+2018-201A," +
  "U+201C-201E,U+2020-2022,U+2026,U+2030,U+2039-203A,U+2044,U+20AC,U+2122,U+2212,U+FB01-FB02";

/**
 * Each role's family name in the page, the browser's own family a reader is offered if a
 * face never arrives, and the file for each weight the role is served at. The family is the
 * page's name for the face rather than the face's own, so that the name can reach only the
 * file served here, not a copy of IBM Plex installed on the reader's machine. A weight is
 * added by copying IBM's file for it beside these and naming it here; nothing else needs to
 * change.
 */
export const TYPEFACES = {
  mono: {
    family: "Gallery Mono",
    fallback: "monospace",
    weights: {
      400: new URL("./fonts/ibm-plex/IBMPlexMono-Regular-Latin1.woff2", import.meta.url),
      700: new URL("./fonts/ibm-plex/IBMPlexMono-Bold-Latin1.woff2", import.meta.url)
    }
  },
  sans: {
    family: "Gallery Sans",
    fallback: "sans-serif",
    weights: {
      400: new URL("./fonts/ibm-plex/IBMPlexSans-Regular-Latin1.woff2", import.meta.url),
      700: new URL("./fonts/ibm-plex/IBMPlexSans-Bold-Latin1.woff2", import.meta.url)
    }
  }
};

function servedFace(role, weight) {
  const file = TYPEFACES[role]?.weights?.[weight];
  if (!file) {
    throw new Error(
      `No ${role} face is served at weight ${weight}: add its file to TYPEFACES rather than letting the browser imitate it.`
    );
  }
  const { family, fallback } = TYPEFACES[role];
  return { family, fallback, file };
}

/** The code points TYPEFACE_CHARACTERS covers. */
export const TYPEFACE_CODE_POINTS = new Set(
  TYPEFACE_CHARACTERS.split(",").flatMap((range) => {
    const [first, last = first] = range.replace(/U\+/gu, "").split("-").map((hex) => Number.parseInt(hex, 16));
    return Array.from({ length: last - first + 1 }, (unused, index) => first + index);
  })
);

/** The characters of `text` that no served face holds, each once, in the order they appear. */
export function uncoveredCharacters(text) {
  return [...new Set([...String(text)].filter((character) => !TYPEFACE_CODE_POINTS.has(character.codePointAt(0))))];
}

/**
 * What this page has loaded, set and noted, read by the capture paths: each requested face
 * and how its load stands, each face text was set in before it had loaded, and each
 * character no served face holds.
 */
function record(page = globalThis) {
  const scope = typeof page.window === "object" ? page.window : page;
  scope.__TYPEFACES__ ??= { faces: {}, unready: [], missing: [] };
  return scope.__TYPEFACES__;
}

/**
 * Loads each requested `[role, weight]` into the page's fonts, and says how each went:
 * "loaded", "failed", or "absent" where there is no page to load into, as when a test draws.
 * While a face is on its way, the page's record says "loading".
 *
 * Awaited at the top of an artwork's module, before its sketch starts, so that the sketch
 * draws nothing before its faces have either loaded or failed. A failed face does not stop
 * the artwork: for the reader, the browser sets the text in the role's fallback family or
 * whatever it puts in its place. It is the capture paths that stop, on the record this
 * publishes.
 */
export async function loadTypefaces(requests, { FontFace: Face, document: page, console: log } = globalThis) {
  const faces = {};
  const known = record().faces;
  for (const [role, weight] of requests) {
    const { family, file } = servedFace(role, weight);
    const key = `${role} ${weight}`;
    if (typeof Face !== "function" || !page?.fonts) {
      faces[key] = known[key] = "absent";
      continue;
    }
    known[key] = "loading";
    try {
      const face = new Face(family, `url("${file.href}")`, { weight: String(weight), style: "normal" });
      await face.load();
      page.fonts.add(face);
      faces[key] = known[key] = "loaded";
    } catch (error) {
      log?.error(`The ${role} face at weight ${weight} did not load: ${error?.message ?? error}`);
      faces[key] = known[key] = "failed";
    }
  }
  return faces;
}

/**
 * The face a drawing call is about to set its text in, noted if the page had not loaded it
 * by then: never requested, still loading, failed or absent. The browser may set that text
 * in another of its faces, or thicken one into a bold, so the capture paths refuse a page
 * that has noted one, even if the face arrived later.
 */
function chosenFace(role, weight, log = globalThis.console) {
  const face = servedFace(role, weight);
  const key = `${role} ${weight}`;
  const page = record();
  const status = page.faces[key] ?? "not requested";
  if (status !== "loaded") {
    const entry = `${key} (${status})`;
    if (!page.unready.includes(entry)) {
      page.unready.push(entry);
      log?.error(`The ${role} face at weight ${weight} was set before the page had loaded it (${status}); the browser may set the text in another face.`);
    }
  }
  return face;
}

/**
 * Notes the characters of `text` that no served face holds, and hands the text back, so that
 * a drawing call can take it as it is: `p.text(noteText(line), x, y)`.
 */
export function noteText(text, log = globalThis.console) {
  const missing = uncoveredCharacters(text);
  if (missing.length > 0) {
    const noted = record().missing;
    for (const character of missing) {
      if (!noted.includes(character)) {
        noted.push(character);
        log?.error(`No served face holds ${JSON.stringify(character)}; the browser would set it in a face of its own.`);
      }
    }
  }
  return text;
}

/**
 * The CSS font for a canvas's own context: `ctx.font = typefaceFont("mono", 400, 10)`. It is
 * the string p5 sets on its context for the same choice, which quotes a name with a space.
 */
export function typefaceFont(role, weight, size) {
  const { family, fallback } = chosenFace(role, weight);
  return `${weight} ${size}px "${family}", ${fallback}`;
}

/** The same choice made for a p5 sketch: its family, its weight, and, if given, its size. */
export function useTypeface(p, role, weight, size) {
  const { family, fallback } = chosenFace(role, weight);
  p.textFont(`${family}, ${fallback}`);
  p.textWeight(weight);
  if (size !== undefined) {
    p.textSize(size);
  }
}
