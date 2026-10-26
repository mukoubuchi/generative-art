import { GOLDEN_ANGLE } from "../artworks/voronoi-bloom/bloom.js";
import { publicSource } from "./citation.mjs";

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
 * What a thumbnail is called for a reader who cannot see it: the artwork's title, which is
 * all the catalog says about any picture. A sentence describing each one would be a
 * description, and the catalog refuses those (see `validateManifest`). Kept in one place so
 * that the gallery card and the share card cannot call one picture by two names.
 */
export function thumbnailAlt(artwork) {
  return artwork.title;
}

/**
 * What the site calls itself to anything outside the page: the index's title, the end of
 * every artwork page's title, and the site name a link preview shows.
 */
export const SITE_NAME = "Generative Art";

/** What the index says about itself, to a search result and to a link preview alike. */
const SITE_DESCRIPTION = "Generative works in p5.js, each paired with an aphorism in English. "
  + "Art beyond the claims of utility.";

/**
 * The address an artwork page is published at, spelled out in full: the card's own link,
 * resolved against `siteBaseUrl`. A post builds the same address another way, from
 * `interactiveBaseUrl` and `interactivePath`, and a test holds the two to one value. Every
 * place a page names itself to the outside — its canonical link, its share card, the
 * sitemap — takes the address from here, so none of them can name a page a post does not
 * lead to.
 */
export function artworkUrl(manifest, artwork) {
  return new URL(artworkHref(artwork), manifest.defaults.siteBaseUrl).href;
}

/**
 * Where an artwork's share image is published, relative to the site root. A link preview
 * gets a picture of its own rather than the card's thumbnail, because X specifies 2:1 for its
 * large-image card and the canvases run from 2:1 to square.
 */
export const SHARE_DIRECTORY = "share";

/**
 * The share image's size, and the margin kept clear round the picture on every side. 2:1 as
 * X specifies. The margin is mount showing round the picture, so that no part of the artwork
 * meets the edge of the image, and it is wide enough that no picture is enlarged to fill its
 * box: the 2:1 canvas, 960 by 480, is drawn at its own size, and every other canvas in the
 * manifest is drawn down. A test holds every canvas to that.
 */
export const SHARE_IMAGE = { width: 1200, height: 600, margin: 60 };

/** The mount the picture is set on: the gallery card's own, `--ground-raised` in gallery.css. */
export const SHARE_MOUNT = "#1c1e25";

export function shareImageHref(artwork) {
  return `${SHARE_DIRECTORY}/${artwork.id}.jpg`;
}

export function shareImageUrl(manifest, artwork) {
  return new URL(shareImageHref(artwork), manifest.defaults.siteBaseUrl).href;
}

/**
 * Where the picture goes in its share image: as large as fits inside the margin, centred, in
 * the canvas's own proportions. Fitted rather than cropped, as the gallery card fits it, so
 * the whole artwork is there; in whole pixels, so this is the box it is actually drawn into.
 */
export function sharePlacement(artwork) {
  const { width, height, margin } = SHARE_IMAGE;
  const fit = Math.min(
    (width - 2 * margin) / artwork.canvas.width,
    (height - 2 * margin) / artwork.canvas.height
  );
  const boxWidth = Math.round(artwork.canvas.width * fit);
  const boxHeight = Math.round(artwork.canvas.height * fit);
  return {
    x: Math.round((width - boxWidth) / 2),
    y: Math.round((height - boxHeight) / 2),
    width: boxWidth,
    height: boxHeight
  };
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

/**
 * The size the artwork was drawn at, handed to the page's stylesheet.
 *
 * The stylesheet has to know it in order to hold the canvas inside a screen narrower than
 * the picture without changing its shape, and it cannot read the manifest. It cannot take
 * the numbers off the canvas either: what a canvas reports as its own size is its backing
 * store, which is two or three times this on a dense display. So the one place that does
 * know says so, per page, and `artworks/shared.css` explains what it does with them.
 *
 * Both or neither: the stylesheet's rule names both properties in its selector, so a page
 * that carried one of them would be left alone rather than half fitted.
 */
export function canvasSizeProperties(artwork) {
  return `--art-w: ${artwork.canvas.width}; --art-h: ${artwork.canvas.height}`;
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
 *
 * The class is passed in because two blocks quote — the cards, and the epigraph under the
 * title — and the mark is sized in `em`. Taking the class of the block it sits in is what
 * lets one symbol follow two sizes of type without either being told the other's measure.
 */
const quoteMark = (className) => `<svg class="${className}" aria-hidden="true" focusable="false">`
  + `<use href="#${QUOTE_SYMBOL_ID}"/></svg>`;

/**
 * A short English epigraph linking life beyond utility to sovereignty.
 * Wording located in Timothy Lavenz, "Sovereign Disregard", Epoché, July 2020:
 * https://epochemagazine.org/33/sovereign-disregard-on-batailles-accursed-share/
 * It cites The Accursed Share, volume III, p. 198. This is a secondary-source
 * check, not a fresh collation of the French text or the English edition.
 * The epigraph stays outside the artwork catalog and the posting path.
 */
export const EPIGRAPH = {
  text: "Life beyond utility is the domain of sovereignty.",
  lang: "en",
  author: "Georges Bataille",
  source: "The Accursed Share, vol. III",
  year: null
};

function renderCard(manifest, artwork, quote, index) {
  const href = escapeHtml(artworkHref(artwork));
  const moving = artwork.render.kind === "video";

  return `        <li class="card" style="--reveal-delay: ${revealDelay(index).toFixed(3)}s">
          <a class="card__link" href="${href}">
            <figure class="card__frame">
              <img
                class="card__image"
                src="${escapeHtml(thumbnailHref(artwork))}"
                alt="${escapeHtml(thumbnailAlt(artwork))}"
                width="${artwork.canvas.width}"
                height="${artwork.canvas.height}"
                loading="lazy"
                decoding="async">
              ${moving ? '<span class="card__moving"><span class="card__orbit" aria-hidden="true"></span>moving</span>' : ""}
              <span class="card__trace" aria-hidden="true"></span>
            </figure>
            <div class="card__label">
              <h2 class="card__title">${escapeHtml(artwork.title)}</h2>
              ${quote ? `<blockquote class="card__quote" lang="${escapeHtml(quote.lang)}">
                <p class="card__quote-text">${quoteMark("card__quote-mark")}${escapeHtml(quote.text)}</p>
                <cite class="card__cite">—&nbsp;<b>${escapeHtml(quote.author)}</b>, ${escapeHtml(publicSource(quote))}</cite>
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

/**
 * The commit a page was built from, written into the page itself.
 *
 * Not into a file of its own beside it. What is served goes through a content network that
 * caches each address separately -- the site declares `max-age=600`, and a request for it
 * comes back with an `age` -- so a marker kept in one file says that *that file* is current
 * and says nothing whatever about the page a reader, or a check, loads next. A check that
 * read the marker from one address and then measured another could find the marker new and
 * the page a quarter of an hour old, and pass. The marker has to be printed on the sheet
 * being measured.
 */
export const BUILD_META_NAME = "build";

/** What a build is stamped with when nothing supplies a commit: see `buildStamp`. */
export const UNPUBLISHED_BUILD = "development";

/**
 * A build with no commit behind it says so, rather than borrowing the working tree's HEAD.
 * The tree may have uncommitted changes, which would make the marker a claim about a commit
 * whose contents are not what was built. And since the published check demands a forty-digit
 * match against the commit being deployed, `development` is a marker that cannot satisfy it:
 * a site built by hand can never be mistaken for one that was published.
 */
export function buildStamp(build) {
  return `<meta name="${BUILD_META_NAME}" content="${escapeHtml(build || UNPUBLISHED_BUILD)}">`;
}

/**
 * And the marker read back off a page, kept next to the writing of it so that the one format
 * is stated once. By regular expression rather than by a parser, because whoever asks this is
 * asking before opening a browser, and the answer decides whether opening one means anything.
 */
export function readBuildStamp(html) {
  const found = html.match(
    new RegExp(`<meta\\s+name="${BUILD_META_NAME}"\\s+content="([^"]*)"`, "u")
  );
  return found ? found[1] : null;
}

/**
 * The quotation and its attribution as one line: what a search result shows under an
 * artwork's title, and a link preview under its picture. Word for word the two lines a post
 * opens with (see `buildPostBody`), joined by a space rather than a line break. The gallery
 * card and the post are the only words the site gives a work, and a summary written for
 * search engines alone would be a third set that nobody on the site ever reads.
 */
export function quotationSummary(quote) {
  return `${quote.text} — ${quote.author}, ${publicSource(quote)}`;
}

/**
 * The head elements that search engines and link previews read. They go in the head, and the
 * page's body is left as it was.
 *
 * The canonical link is absolute, as Google asks, and names the page's own address, so that a
 * copy of the page reached some other way — by `…/index.html`, say — names the address a post
 * links to as the one to prefer. That is a preference stated to search engines, which they
 * weigh with other signals rather than obey. Open Graph carries the title, the summary and
 * the picture, and X's card documentation names each of those as the fallback for its own
 * tag, so the card type is the only X tag written. `twitter:site` would name an account,
 * which is a decision about the account rather than about the page, and is left out.
 */
function renderShareMetadata({ url, title, description, image, card }) {
  return [
    description === undefined ? null : `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    description === undefined ? null : `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    ...(image === undefined ? [] : [
      `<meta property="og:image" content="${escapeHtml(image.url)}">`,
      `<meta property="og:image:width" content="${image.width}">`,
      `<meta property="og:image:height" content="${image.height}">`,
      `<meta property="og:image:alt" content="${escapeHtml(image.alt)}">`
    ]),
    `<meta name="twitter:card" content="${escapeHtml(card)}">`
  ].filter((tag) => tag !== null).join("\n    ");
}

/**
 * An artwork page's title and the metadata under it, which the site build writes over the
 * page's own `<title>`.
 *
 * The title gains the site's name after a delimiter, which is how Google asks a page to
 * carry its site's name. Google Search does not support site names for a site that lives in
 * a subdirectory of its host, as this one does, so the title is the place the name can go. A
 * browser shows the title on its tab. The share card is the large one, because the picture
 * is the work, and its picture is the share image; an artwork without a quotation gets no
 * summary rather than an invented one, as its card gets no quotation.
 */
export function renderArtworkHead(manifest, quoteCatalog, artwork) {
  const quote = quoteFor(artwork, quoteCatalog);
  return [
    `<title>${escapeHtml(artwork.title)} — ${escapeHtml(SITE_NAME)}</title>`,
    renderShareMetadata({
      url: artworkUrl(manifest, artwork),
      title: artwork.title,
      description: quote ? quotationSummary(quote) : undefined,
      image: {
        url: shareImageUrl(manifest, artwork),
        width: SHARE_IMAGE.width,
        height: SHARE_IMAGE.height,
        alt: thumbnailAlt(artwork)
      },
      card: "summary_large_image"
    })
  ].join("\n    ");
}

/**
 * Every page the site wants found, by the address each one claims for itself.
 *
 * Written beside the index, at the root of the project rather than of the host, which is as
 * high as a project site reaches: a sitemap may list what lies at or below its own
 * directory, and every page here does. There is no `lastmod`, because Google uses it only
 * when it is accurate, and when a page last changed in a way a reader would notice is not
 * something the build knows. No robots.txt names the sitemap either, and none is shipped:
 * crawlers read that file only at the root of the host, and GitHub Pages serves the root of
 * this host from the owner's user site, not from this repository. So the way to point Google
 * at the sitemap is to submit it in Search Console, which Google treats as a hint: it does
 * not promise to fetch the sitemap or to use it. The same file is meant for Bing, submitted
 * in Bing Webmaster Tools or imported there from Search Console.
 */
export function renderSitemap(manifest) {
  const addresses = [
    manifest.defaults.siteBaseUrl,
    ...manifest.artworks.map((artwork) => artworkUrl(manifest, artwork))
  ];
  const entries = addresses
    .map((address) => `  <url>\n    <loc>${escapeHtml(address)}</loc>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

export function renderIndexPage(manifest, quoteCatalog, build) {
  const cards = manifest.artworks
    .map((artwork, index) => renderCard(manifest, artwork, quoteFor(artwork, quoteCatalog), index))
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${buildStamp(build)}
    <title>${escapeHtml(SITE_NAME)}</title>
    ${renderShareMetadata({
      url: manifest.defaults.siteBaseUrl,
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      // No picture. X asks for one that represents the page itself rather than a logo or a
      // portrait standing for the whole site, and no single artwork stands for the gallery.
      card: "summary"
    })}
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
  <!-- The document is pinned to the screen and this is the box that scrolls, so a key
       press has nothing to move unless the focus is inside it. Focusable, and the script
       gives it the focus on arrival; out of the tab order, since it is not a control. -->
  <body tabindex="-1">
${ICON_SPRITE}

    <header class="masthead">
      <div class="masthead__text">
        <h1 class="masthead__title">Generative Art</h1>
        <!-- No count: it would be one more place to remember when an artwork is added, and
             the page is generated from the manifest precisely so nothing has to be kept in
             step by hand. -->
        <!-- The epigraph over the door, set in the register the cards use for their own
             quotations so that the head of the page and the grid below it read as one
             catalog. For its source and its place outside the artwork catalog,
             see EPIGRAPH in lib/gallery.mjs. -->
        <blockquote class="masthead__epigraph" lang="${escapeHtml(EPIGRAPH.lang)}">
          <p class="masthead__epigraph-text">${quoteMark("masthead__quote-mark")}${escapeHtml(EPIGRAPH.text)}</p>
          <cite class="masthead__cite">—&nbsp;<b>${escapeHtml(EPIGRAPH.author)}</b>, ${escapeHtml(publicSource(EPIGRAPH))}</cite>
        </blockquote>
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
