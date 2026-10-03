/**
 * The source line a quotation is credited to wherever the public sees it: on a gallery card
 * and in a post. Both print the same words, and neither prints a date. The catalog's
 * `source` and `year` stay bibliographic records; when a `source` carries a date of its own,
 * `siteSource` is the same reference without it.
 */
export function publicSource(quote) {
  return quote.siteSource ?? quote.source;
}
