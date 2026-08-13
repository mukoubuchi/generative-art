/**
 * The face in the masthead looks towards the pointer, and looks about it when there is none.
 *
 * This is a flat drawing standing in for a real three-dimensional head, and it is meant to
 * be replaced by one. The interface it presents is deliberately small, so that replacing it
 * touches nothing else:
 *
 *   - it drives one element, the first `[data-character]` in the document;
 *   - it writes three custom properties on that element and nothing else — `--look-x` and
 *     `--look-y`, each running from -1 to 1 for the direction of the pointer, and
 *     `--look-x-abs`, the magnitude of the first;
 *   - everything visible is done by the stylesheet from those three numbers.
 *
 * A GLB and a renderer would take over the same element and could read the same two
 * numbers, or ignore them and use the pointer directly. Nothing else in the page knows how
 * the figure is drawn.
 *
 * A plain script rather than a module, like the gallery's own, so it still runs when the
 * page is opened over file://.
 */
(function character() {
  const root = document.querySelector("[data-character]");
  if (!root) {
    return;
  }

  // No context menu over the figure, whether it is the drawing or the model that replaces
  // it. This asks rather than prevents: the picture is still in the page and anyone who
  // opens the developer tools has it. It is here because the likeness is the author's, not
  // because a browser can be stopped from showing what it has downloaded.
  root.addEventListener("contextmenu", (event) => event.preventDefault());

  // Motion is the gate that stops everything, and the only one: a reader who has asked for
  // no motion is asking about the figure as much as about the cards.
  const wantsMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!wantsMotion) {
    return;
  }

  // A fine pointer gates the following, and nothing else. On a touch screen `pointermove`
  // fires while the page is being dragged, which would make the figure lurch at the moment
  // the reader is trying to scroll past it — so a touch screen gets what a fine pointer gets
  // when it has been still, which is the wandering below. That was always the behaviour
  // waiting behind this test; it is only that nobody without a mouse could reach it.
  const followsPointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /** How far the pointer travels before the look is at full extent. */
  const REACH_RATIO = 0.42;
  /** The eyes sit three fifths down the layer; the look is measured from there, not from
   *  the middle of the box. */
  const EYE_HEIGHT = 0.6;

  /**
   * Left alone, the head looks around by itself.
   *
   * Where it looks is the golden angle again — the same constant that orders the cards'
   * arrival and places the sites in Voronoi Bloom. Stepping a direction by 137.5 degrees
   * each time gives a sequence that never repeats and never clusters, so the wandering has
   * no period a watcher can catch, and the one number this whole site is built on is doing
   * the one thing on the page nobody was going to look for.
   */
  const GOLDEN_ANGLE = 2.399963229728653;
  /** How long the pointer must be still before the head stops waiting for it. */
  const IDLE_AFTER = 9000;
  /** How long it holds each direction. */
  const DRIFT_EVERY = 2600;
  const DRIFT_REACH = 0.72;

  let pending = null;
  let idleTimer = null;
  let driftTimer = null;
  let step = 0;

  function drift() {
    const angle = step * GOLDEN_ANGLE;
    step += 1;
    root.style.setProperty("--look-x", (Math.cos(angle) * DRIFT_REACH).toFixed(3));
    root.style.setProperty("--look-y", (Math.sin(angle) * DRIFT_REACH * 0.6).toFixed(3));
    root.style.setProperty("--look-x-abs", Math.abs(Math.cos(angle) * DRIFT_REACH).toFixed(3));
  }

  function stopWaiting() {
    window.clearTimeout(idleTimer);
    window.clearInterval(driftTimer);
  }

  function beginDrifting() {
    stopWaiting();
    drift();
    driftTimer = window.setInterval(drift, DRIFT_EVERY);
  }

  function waitForStillness() {
    stopWaiting();
    idleTimer = window.setTimeout(beginDrifting, IDLE_AFTER);
  }

  function apply() {
    const event = pending;
    pending = null;
    const box = root.getBoundingClientRect();
    if (box.width === 0) {
      return;
    }
    const reach = Math.max(window.innerWidth, window.innerHeight) * REACH_RATIO;
    const centreX = box.left + box.width * 0.5;
    const centreY = box.top + box.height * EYE_HEIGHT;
    const x = Math.max(-1, Math.min(1, (event.clientX - centreX) / reach));
    const y = Math.max(-1, Math.min(1, (event.clientY - centreY) / reach));

    root.style.setProperty("--look-x", x.toFixed(3));
    root.style.setProperty("--look-y", y.toFixed(3));
    root.style.setProperty("--look-x-abs", Math.abs(x).toFixed(3));
  }

  function attend(event) {
    waitForStillness();
    const queued = pending !== null;
    pending = event;
    if (!queued) {
      requestAnimationFrame(apply);
    }
  }

  if (followsPointer) {
    window.addEventListener("pointermove", attend, { passive: true });
    // Waiting rather than wandering: there is a pointer to attend to, and the head only
    // gives up on it after it has been still for a while.
    waitForStillness();
    return;
  }

  // A tap is the one thing a touch screen says about where the reader is, and it says it
  // once rather than all the way through a scroll, so it cannot fight one. After it, the
  // head goes back to wandering by the same nine-second rule a still mouse gets.
  window.addEventListener("pointerdown", attend, { passive: true });
  beginDrifting();
}());
