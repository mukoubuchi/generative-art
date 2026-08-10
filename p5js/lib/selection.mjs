const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function dayNumber(date) {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid pipeline date: ${date}`);
  }
  return Math.floor(timestamp / MILLISECONDS_PER_DAY);
}

export function eligibleArtworks(manifest, quoteCatalog, warn = console.warn) {
  const quotesById = new Map(quoteCatalog.quotes.map((quote) => [quote.id, quote]));
  const eligible = [];

  for (const artwork of manifest.artworks) {
    const quotes = artwork.quoteIds
      .map((quoteId) => quotesById.get(quoteId))
      .filter((quote) => quote?.publicDomain === true);
    if (quotes.length === 0) {
      warn(`Skipping ${artwork.id}: no verified public-domain quote candidate is available.`);
      continue;
    }
    eligible.push({ artwork, quotes });
  }
  return eligible;
}

export function selectTarget(
  manifest,
  quoteCatalog,
  { artworkId, quoteId, date, warn = console.warn } = {}
) {
  const eligible = eligibleArtworks(manifest, quoteCatalog, warn);
  if (eligible.length === 0) {
    throw new Error("No artwork has a verified public-domain quote candidate.");
  }

  const selectionDay = dayNumber(date ?? new Date().toISOString().slice(0, 10));
  const target = artworkId
    ? eligible.find((candidate) => candidate.artwork.id === artworkId)
    : eligible[selectionDay % eligible.length];
  if (!target) {
    throw new Error(`Artwork is unavailable or has no verified quote: ${artworkId}`);
  }

  const quote = quoteId
    ? target.quotes.find((candidate) => candidate.id === quoteId)
    : target.quotes[selectionDay % target.quotes.length];
  if (!quote) {
    throw new Error(`Quote is not an eligible candidate for ${target.artwork.id}: ${quoteId}`);
  }
  return { artwork: target.artwork, quote };
}
