const URL_PATTERN = /https?:\/\/[^\s]+/giu;
const EMOJI_PATTERN = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u;
const GRAPHEME_SEGMENTER = new Intl.Segmenter("en", { granularity: "grapheme" });

function isSingleWeightCodePoint(codePoint) {
  return codePoint <= 0x10ff
    || (codePoint >= 0x2000 && codePoint <= 0x200d)
    || (codePoint >= 0x2010 && codePoint <= 0x201f)
    || (codePoint >= 0x2032 && codePoint <= 0x2037);
}

function plainTextWeight(text) {
  const normalizedText = text.normalize("NFC");
  let weight = 0;
  for (const { segment } of GRAPHEME_SEGMENTER.segment(normalizedText)) {
    if (EMOJI_PATTERN.test(segment)) {
      weight += 2;
      continue;
    }
    for (const character of segment) {
      weight += isSingleWeightCodePoint(character.codePointAt(0)) ? 1 : 2;
    }
  }
  return weight;
}

export function weightedCharacterCount(text) {
  let weight = 0;
  let offset = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    weight += plainTextWeight(text.slice(offset, match.index));
    weight += 23;
    offset = match.index + match[0].length;
  }
  return weight + plainTextWeight(text.slice(offset));
}

export function buildPostBody(artwork, quote, interactiveBaseUrl) {
  const normalizedBaseUrl = interactiveBaseUrl.endsWith("/")
    ? interactiveBaseUrl
    : `${interactiveBaseUrl}/`;
  const interactiveUrl = new URL(artwork.interactivePath, normalizedBaseUrl).href;
  return [
    quote.text,
    `— ${quote.author}, ${quote.source}`,
    "",
    artwork.description,
    "",
    interactiveUrl
  ].join("\n");
}

export function validatePostBody(body, maximumWeight) {
  const weight = weightedCharacterCount(body);
  if (weight > maximumWeight) {
    throw new Error(
      `Post body weighs ${weight} characters; the configured maximum is ${maximumWeight}.`
    );
  }
  return weight;
}
