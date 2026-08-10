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

/**
 * Whether the input indicator is drawn — the complement of the hint, capture-side.
 *
 * The clip gets the indicator and no legend: it shows the artwork being operated, and an
 * instruction to operate would be false there. The page gets the legend and no indicator:
 * the reader's own pointer is on it, and a phantom one would be a lie in the other
 * direction. The thumbnail gets the legend and no indicator, because it is a picture of
 * the page. So the indicator appears exactly when capturing without the hint.
 */
export function indicatorShown(parameters, capturing) {
  return capturing && parameters.get("hint") !== "1";
}
