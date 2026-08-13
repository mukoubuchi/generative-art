import { GOLDEN_ANGLE } from "../artworks/voronoi-bloom/bloom.js";
import { quoteYearSuffix } from "./post-text.mjs";

/**
 * The reveal order is phyllotaxis in time. Each card's delay is the golden angle's
 * position on the circle after i turns, which is the same rule that places the sites in
 * Voronoi Bloom and the colonies in Reaction Diffusion Coral. It has the property those
 * artworks are built on: the sequence never repeats and never clumps, so the cards arrive
 * in an order that reads as neither a sweep nor a shuffle.
 */
export const REVEAL_WINDOW_SECONDS = 0.62;

/**
 * Where three.js is served from, relative to the site root. The import map below and the
 * build's copy step both take it from here, so the addresses the page hands the browser
 * cannot drift from the files the build puts there.
 */
export const VENDOR_THREE = "p5js/vendor/three";

export function revealDelay(index) {
  const turns = (index * GOLDEN_ANGLE) / (Math.PI * 2);
  return (turns - Math.floor(turns)) * REVEAL_WINDOW_SECONDS;
}

/** The site mirrors the repository, so a page's URL is its manifest entry without the file. */
export function artworkHref(artwork) {
  return artwork.entry.replace(/[^/]+$/u, "");
}

/**
 * Where the artwork's code is read. Built from the same path as the gallery link, so the
 * two cannot name different directories for one artwork: both are the manifest's `entry`
 * with the file dropped, and the base is the repository's own tree.
 */
export function sourceHref(manifest, artwork) {
  return new URL(artworkHref(artwork), manifest.defaults.sourceBaseUrl).href;
}

export function thumbnailHref(artwork) {
  return `thumbnails/${artwork.id}.jpg`;
}

/**
 * The two icons the artwork pages carry, drawn inline rather than referenced from the sprite
 * above: those pages are standalone documents that share nothing with the index, so a
 * `<use>` would have nothing to point at. Both are Font Awesome Free's solid style, copied
 * unmodified from the npm distribution and recorded in THIRD_PARTY_LICENSES, which carries
 * the attribution their CC BY 4.0 licence requires. `code` is the same glyph the gallery
 * card uses for the same destination; `table-cells-large` stands for the gallery because
 * the gallery is that picture — a grid of cards — where a bare arrow, once its label was
 * dropped, would have read as the browser's own back button.
 */
const GRID_ICON = '<svg class="page-nav__icon" viewBox="0 0 448 512" aria-hidden="true" focusable="false">'
  + '<path fill="currentColor" d="M384 96l-128 0 0 128 128 0 0-128zm64 128l0 192c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 96C0 60.7 28.7 32 64 32l320 0c35.3 0 64 28.7 64 64l0 128zM64 288l0 128 128 0 0-128-128 0zm128-64l0-128-128 0 0 128 128 0zm64 64l0 128 128 0 0-128-128 0z"/></svg>';

const CODE_ICON = '<svg class="page-nav__icon" viewBox="0 0 576 512" aria-hidden="true" focusable="false">'
  + '<path fill="currentColor" d="M360.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm64.6 136.1c-12.5 12.5-12.5 32.8 0 45.3l73.4 73.4-73.4 73.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l96-96c12.5-12.5 12.5-32.8 0-45.3l-96-96c-12.5-12.5-32.8-12.5-45.3 0zm-274.7 0c-12.5-12.5-32.8-12.5-45.3 0l-96 96c-12.5 12.5-12.5 32.8 0 45.3l96 96c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 150.6 182.6c12.5-12.5 12.5-32.8 0-45.3z"/></svg>';

/**
 * How far an artwork page has to climb to reach the site root, counted from its own address
 * rather than assumed. The site mirrors the repository, so today every page is three levels
 * down; an artwork filed somewhere else would still get a link that arrives.
 */
export function siteRootFrom(artwork) {
  const depth = artworkHref(artwork).replace(/\/$/u, "").split("/").length;
  return "../".repeat(depth);
}

/**
 * The two ways out of an artwork page: back to the gallery it belongs to, and on to the
 * code that made it.
 *
 * A post links to the artwork's own page, so that page is where a reader arrives and where
 * they must find everything else — without it they can see one work and nothing around it.
 * The markup is added by the site build rather than written into the artwork pages,
 * because the source address is already derived from the manifest for the gallery card, and
 * deriving it a second time is how two links come to disagree about where a work lives.
 */
export function renderArtworkNav(manifest, artwork) {
  // Icons only, so each link says where it goes twice over: `aria-label` for a screen
  // reader, `title` for the tooltip a pointer hovers up. Without them an icon-only link
  // is a door with no name on it.
  return `    <nav class="page-nav" aria-label="Artwork page navigation">
      <a class="page-nav__link" href="${escapeHtml(siteRootFrom(artwork))}"
        title="Generative Art — all works" aria-label="Generative Art — all works">${GRID_ICON}</a>
      <a class="page-nav__link" href="${escapeHtml(sourceHref(manifest, artwork))}"
        target="_blank" rel="noopener noreferrer"
        title="View source on GitHub" aria-label="View source on GitHub">${CODE_ICON}</a>
    </nav>`;
}


const ESCAPES = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&#39;"]
]);

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ESCAPES.get(character));
}

function quoteFor(artwork, quoteCatalog) {
  return quoteCatalog.quotes.find((quote) => quote.id === artwork.quoteIds[0]);
}

/**
 * How a work that pays homage says whose figure it is drawing.
 *
 * Some of these works are not inventions. A Koch curve is Koch's, a Möbius band is
 * Möbius's, and the Café Wall illusion was Gregory's before it was anybody's screensaver;
 * making one of them faithfully is the whole intention, and the finished thing should say
 * so rather than leave a reader to assume the figure was thought of here. So the manifest
 * carries an optional `homage` — a name and, where it is certain, a year — and the card
 * prints it in the form galleries have always used for a work made after another.
 *
 * The year is optional on purpose. Möbius's band and de Jong's attractor both have dates
 * that depend on which of discovery, paper and publication is being counted, and a year
 * printed with more confidence than it deserves is worse than no year: the point of the
 * line is to be trustworthy about provenance. Names are certain; some dates are not.
 *
 * Nothing is inferred. A work is an homage only where the manifest says it is, because the
 * alternative — guessing from a title — would put an attribution under a picture on the
 * strength of a word, and attributions are not the place to be clever.
 */
export function homageLine(artwork) {
  if (!artwork.homage) {
    return null;
  }
  const year = artwork.homage.year;
  return year === undefined || year === null
    ? `After ${artwork.homage.after}`
    : `After ${artwork.homage.after}, ${year}`;
}

/**
 * Font Awesome Free's `quote-left` in the solid style, copied unmodified from the npm
 * distribution and recorded in THIRD_PARTY_LICENSES, which carries the attribution its
 * CC BY 4.0 licence requires. Its box is 448 by 512, not square.
 *
 * The path is defined once as a symbol and referenced from each card. Repeating it inline
 * once per card would add some 15 kB to a 27 kB page for one glyph.
 */
const QUOTE_SYMBOL_ID = "icon-quote-left";
const CODE_SYMBOL_ID = "icon-code";
const RULE_SYMBOL_ID = "icon-rule";

/**
 * The stroke a link's underline is drawn along: not quite straight, so that drawing it
 * reads as a stroke of a pen rather than as a bar growing. Its length in the symbol's own
 * units, which is what the stylesheet dashes it by.
 */
export const RULE_LENGTH = 122;

const ICON_SPRITE = `    <svg class="sprite" aria-hidden="true" focusable="false">
      <symbol id="${QUOTE_SYMBOL_ID}" viewBox="0 0 448 512">
        <path fill="currentColor" d="M0 216C0 149.7 53.7 96 120 96l8 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-8 0c-30.9 0-56 25.1-56 56l0 8 64 0c35.3 0 64 28.7 64 64l0 64c0 35.3-28.7 64-64 64l-64 0c-35.3 0-64-28.7-64-64L0 216zm256 0c0-66.3 53.7-120 120-120l8 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-8 0c-30.9 0-56 25.1-56 56l0 8 64 0c35.3 0 64 28.7 64 64l0 64c0 35.3-28.7 64-64 64l-64 0c-35.3 0-64-28.7-64-64l0-136z"/>
      </symbol>
      <symbol id="${CODE_SYMBOL_ID}" viewBox="0 0 576 512">
        <path fill="currentColor" d="M360.8 1.2c-17-4.9-34.7 5-39.6 22l-128 448c-4.9 17 5 34.7 22 39.6s34.7-5 39.6-22l128-448c4.9-17-5-34.7-22-39.6zm64.6 136.1c-12.5 12.5-12.5 32.8 0 45.3l73.4 73.4-73.4 73.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l96-96c12.5-12.5 12.5-32.8 0-45.3l-96-96c-12.5-12.5-32.8-12.5-45.3 0zm-274.7 0c-12.5-12.5-32.8-12.5-45.3 0l-96 96c-12.5 12.5-12.5 32.8 0 45.3l96 96c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 150.6 182.6c12.5-12.5 12.5-32.8 0-45.3z"/>
      </symbol>
      <symbol id="${RULE_SYMBOL_ID}" viewBox="0 0 120 8" preserveAspectRatio="none">
        <polyline fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"
          points="0 5.2 20 3.7 40 5.4 60 3.9 80 5.5 100 4.1 120 4.9"/>
      </symbol>
    </svg>`;

/** The underline itself, drawn by the stylesheet along the stroke above. */
const RULE = `<svg class="rule" viewBox="0 0 120 8" preserveAspectRatio="none"`
  + ` aria-hidden="true" focusable="false"><use href="#${RULE_SYMBOL_ID}"/></svg>`;

/**
 * Set inline at the head of the quotation rather than positioned over the block, so it
 * wraps with the text it belongs to and cannot land on top of a line at any width.
 */
const QUOTE_MARK = `<svg class="card__quote-mark" aria-hidden="true" focusable="false">`
  + `<use href="#${QUOTE_SYMBOL_ID}"/></svg>`;

function renderCard(manifest, artwork, quote, index) {
  const href = escapeHtml(artworkHref(artwork));
  const moving = artwork.render.kind === "video";
  const after = homageLine(artwork);

  return `        <li class="card" style="--reveal-delay: ${revealDelay(index).toFixed(3)}s">
          <a class="card__link" href="${href}">
            <figure class="card__frame">
              <img
                class="card__image"
                src="${escapeHtml(thumbnailHref(artwork))}"
                alt="${escapeHtml(artwork.title)}"
                width="${artwork.canvas.width}"
                height="${artwork.canvas.height}"
                loading="lazy"
                decoding="async">
              ${moving ? '<span class="card__moving"><span class="card__orbit" aria-hidden="true"></span>moving</span>' : ""}
              <!-- Opposite the moving badge, on the corner the legend at the foot can never
                   reach. No glyph beside it: the moving badge earns one because a still
                   picture cannot say by itself that it moves, whereas this is a claim about
                   where the figure came from, and a claim about provenance should be read
                   rather than recognised. The name and year are under the title, where
                   there is room; this is the mark that survives being read at grid size. -->
              ${after ? '<span class="card__homage">homage</span>' : ""}
              <span class="card__trace" aria-hidden="true"></span>
              <span class="card__ripple" aria-hidden="true"></span>
            </figure>
            <div class="card__label">
              <h2 class="card__title">${escapeHtml(artwork.title)}</h2>
              ${after ? `<p class="card__after">${escapeHtml(after)}</p>` : ""}
              <p class="card__description">${escapeHtml(artwork.description)}</p>
              ${quote ? `<blockquote class="card__quote" lang="${escapeHtml(quote.lang)}">
                <p class="card__quote-text">${QUOTE_MARK}${escapeHtml(quote.text)}</p>
                <cite class="card__cite">—&nbsp;<b>${escapeHtml(quote.author)}</b>, ${escapeHtml(quote.source)}${escapeHtml(quoteYearSuffix(quote))}</cite>
              </blockquote>` : ""}
            </div>
          </a>
          <!-- Outside the card's own link: an anchor cannot be nested inside another, and
               the two destinations should not be confused in any case. The card leads to
               the artwork; this leads to how it is made. -->
          <a class="card__source" href="${escapeHtml(sourceHref(manifest, artwork))}"
            target="_blank" rel="noopener noreferrer">
            <svg class="card__source-icon" aria-hidden="true" focusable="false"><use href="#${CODE_SYMBOL_ID}"/></svg>Source${RULE}
          </a>
        </li>`;
}

export function renderIndexPage(manifest, quoteCatalog) {
  const cards = manifest.artworks
    .map((artwork, index) => renderCard(manifest, artwork, quoteFor(artwork, quoteCatalog), index))
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Generative Art</title>
    <meta name="description" content="Generative works in p5.js, each bearing an aphorism kept in its original tongue and verified against a primary source.">
    <link rel="stylesheet" href="assets/gallery.css">
    <!-- three.js resolves its own parts by name, and its glTF loader reaches for the
         library the same way, so the names are given addresses here. Nothing is fetched by
         declaring them: the map is read when the first module asks for one, which does not
         happen until the page has loaded. The library is served from this site like every
         other dependency; no request leaves it. -->
    <script type="importmap">
      {
        "imports": {
          "three": "./${VENDOR_THREE}/three.module.min.js",
          "three/addons/": "./${VENDOR_THREE}/"
        }
      }
    </script>
    <!-- Marks that scripting is running, before the first paint. The stylesheet hides the
         cards only under this class, so a browser that never gets here shows all of them
         instead of an empty page, and one that does gets no flash of un-hidden content.

         The timer undoes it if the gallery script never reports for duty: the class alone
         would leave a blank page whenever the script is blocked rather than absent, which
         is what happens when the page is opened over file:// or behind a strict policy.
         Hiding the cards is only safe while something is guaranteed to bring them back. -->
    <script>
      document.documentElement.classList.add("js");
      setTimeout(function () {
        if (document.documentElement.dataset.gallery !== "ready") {
          document.documentElement.classList.remove("js");
        }
      }, 1500);
    </script>
  </head>
  <body>
${ICON_SPRITE}

    <header class="masthead">
      <div class="masthead__text">
        <h1 class="masthead__title">Generative Art</h1>
        <!-- No count: it would be one more place to remember when an artwork is added, and
             the page is generated from the manifest precisely so nothing has to be kept in
             step by hand. -->
        <p class="masthead__lede">
          Every work here is a program: its geometry dwells in a module that needs no
          browser, and the picture is its visible consequence. Each opus bears an aphorism,
          kept in its original tongue and verified against a primary source.
        </p>
      </div>
      <!-- The face, and it looks towards the pointer. The script writes the direction here
           as custom properties and the stylesheet does the rest; with no script, or with
           motion turned down, it rests exactly where the drawing was cut and is simply a
           portrait. -->
      <div class="character" data-character>
        <img class="character__head" src="assets/character/head.png" alt=""
          width="340" height="234" decoding="async">
      </div>
    </header>

    <main class="stage">
      <!-- The gallery opens. Two panels part over the artworks and nothing else, so the
           masthead is painted at once and only the pictures wait; a curtain over the whole
           page would put its own duration in front of the first thing the reader sees.
           Both panels are animated to a state they hold, so a browser that runs no script,
           or one that stops midway, cannot leave the grid covered. -->
      <div class="curtain" aria-hidden="true">
        <span class="curtain__panel curtain__panel--left"></span>
        <span class="curtain__panel curtain__panel--right"></span>
      </div>
      <ul class="grid">
${cards}
      </ul>
    </main>

    <footer class="colophon">
      <div class="colophon__rule" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <p>
        Reading and study are welcome; reuse is not. See
        <a href="LICENSE">LICENSE${RULE}</a> and
        <a href="THIRD_PARTY_LICENSES">THIRD_PARTY_LICENSES${RULE}</a>.
      </p>
    </footer>

    <!-- A classic script, not a module: it imports nothing, and a module would refuse to
         load over file://, which is how a built site is most often opened by hand. -->
    <script src="assets/gallery.js" defer></script>
    <script src="assets/character.js" defer></script>
    <!-- A module, and the only one on the page: it is the one script here that may be
         skipped entirely. It waits for the load event before fetching anything, and where
         modules do not run at all — a page opened from a file, say — the drawing above
         stands in unchanged. -->
    <script type="module" src="assets/character-3d.js"></script>
  </body>
</html>
`;
}
