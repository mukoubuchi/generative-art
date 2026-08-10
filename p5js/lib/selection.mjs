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

/**
 * Which artwork goes out is no longer worked out here. It used to be the date modulo the
 * number of eligible artworks, which meant the answer changed under you whenever an artwork
 * was added — the same date would name a different work before and after. The schedule
 * names the work instead, and this is left with the two things that depend on the catalog:
 * that the artwork exists and is publishable, and which of its quotations to use.
 */
export function selectTarget(manifest, quoteCatalog, { artworkId, quoteId, warn = console.warn }) {
  if (!artworkId) {
    throw new Error("An artwork id is required; the schedule or --artwork supplies it.");
  }
  const eligible = eligibleArtworks(manifest, quoteCatalog, warn);
  const target = eligible.find((candidate) => candidate.artwork.id === artworkId);
  if (!target) {
    throw new Error(`Artwork is unavailable or has no verified quote: ${artworkId}`);
  }

  // The first candidate unless one is named. The manifest lists an artwork's quotations in
  // the order they were chosen for it, so the first is the one it was matched with.
  const quote = quoteId
    ? target.quotes.find((candidate) => candidate.id === quoteId)
    : target.quotes[0];
  if (!quote) {
    throw new Error(`Quote is not an eligible candidate for ${target.artwork.id}: ${quoteId}`);
  }
  return { artwork: target.artwork, quote };
}
