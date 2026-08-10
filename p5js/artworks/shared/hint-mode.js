/**
 * Whether the key hint is drawn, and how large.
 *
 * Three cases. The interactive page draws it at its own size, because that is where the
 * keys work. A capture for posting does not draw it at all, because a still or a clip
 * cannot be typed at. A gallery thumbnail is a capture that draws it anyway, and larger:
 * the thumbnail is a picture of the page rather than a work in its own right, and the card
 * shows the canvas at around two fifths of its size, where the page's own type would be
 * present but unreadable.
 *
 * The two parameters come from the renderer, which is the only thing that asks for a
 * thumbnail; nothing on a page sets them.
 */
export function hintMode(parameters, capturing) {
  return {
    shown: !capturing || parameters.get("hint") === "1",
    scale: Number.parseFloat(parameters.get("hintScale") ?? "1") || 1
  };
}
