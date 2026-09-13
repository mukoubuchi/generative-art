/**
 * The jobs the stylesheet cannot do on its own: noticing that something has been scrolled
 * to, noticing where the page was touched, and holding a navigation open long enough to
 * answer a click. Everything those three discover is handed back to the stylesheet as a
 * class or an element placed where the touch was; no motion is described here.
 *
 * The reveal compares positions rather than using an observer or a scroll-driven timeline,
 * because `animation-timeline` is still uneven across browsers and a gallery that fails to
 * appear is worse than one that appears plainly. Each card keeps the delay the generator
 * gave it, so the golden-angle order survives being revealed a screenful at a time.
 */
/** A thing is revealed once it has risen this far into the viewport. */
const REVEAL_LINE = 0.88;

/**
 * Coming back to the top loads the arrival again, so the gallery can be watched a second
 * time by scrolling up rather than by reloading.
 *
 * Two lines rather than one, because a single line at the top would fire on every small
 * wobble a trackpad makes there. The page has to have gone down past REARM_AFTER of a
 * screen before a return counts at all, and the return itself has to reach REARM_AT of the
 * top. Between those, nothing happens.
 */
const REARM_AFTER = 0.9;
const REARM_AT = 24;

/** The angle the cards are ordered by, and now the blocks of the shutter too. */
const GOLDEN_ANGLE = 2.399963229728653;

/** Blocks in the shutter that closes as an artwork is opened. */
const SHUTTER_BLOCKS = 9;

/**
 * The least time between one ring and the next while the page is being scrolled. It is
 * the time one ring takes to spread, so a scroll that goes on produces rings one after
 * another rather than a pile of them at every tick of the wheel.
 */
const SCROLL_RING_GAP = 780;

/** Rings kept in flight at once; past this the oldest is dropped before a new one starts. */
const RIPPLES_AT_MOST = 12;

/**
 * How long the shutter is given before the page changes. Short enough that it reads as an
 * answer to the click rather than as a wait: the navigation is never held for longer, and
 * the blocks are still falling when it happens.
 */
const SHUTTER_WAIT = 260;

/**
 * Reveals everything that has reached the line, and loads the arrival again whenever the
 * page is brought back to the top.
 *
 * This deliberately does not use IntersectionObserver. An observer never reports a card
 * that goes straight from below the viewport to above it — pressing End, following an
 * anchor, or flinging the page — because its intersection ratio stays at zero throughout
 * and no threshold is crossed. Those cards stayed hidden until they were scrolled back to,
 * which measured as 10 of 25 revealed after a jump to the foot of the page. Comparing
 * positions has no such blind spot, and it costs one pass per frame of scrolling over a
 * list that is usually empty.
 *
 * Only what is below the fold is loaded again. A card in front of the reader keeps what it
 * has: nothing on screen is allowed to blink out and arrive a second time, which is the
 * difference between an entrance that can be watched again and a page that flickers.
 */
function revealOnApproach(elements) {
  let pending = elements;
  let queued = false;
  let wentDown = false;

  /** Puts back everything that has left the foot of the screen, and only that. */
  function rearm() {
    const below = window.innerHeight;
    for (const element of elements) {
      if (pending.includes(element) || element.getBoundingClientRect().top < below) {
        continue;
      }
      element.classList.remove("is-revealed");
      pending.push(element);
    }
  }

  const sweep = () => {
    queued = false;
    if (window.scrollY > window.innerHeight * REARM_AFTER) {
      wentDown = true;
    } else if (wentDown && window.scrollY <= REARM_AT) {
      wentDown = false;
      rearm();
    }

    const line = window.innerHeight * REVEAL_LINE;
    pending = pending.filter((element) => {
      if (element.getBoundingClientRect().top >= line) {
        return true;
      }
      element.classList.add("is-revealed");
      return false;
    });
  };

  function request() {
    if (queued) {
      return;
    }
    queued = true;
    requestAnimationFrame(sweep);
  }

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request, { passive: true });
  sweep();
}

/**
 * A ring from wherever the page is touched: a press anywhere on it, or the point of
 * contact while it is being scrolled.
 *
 * The rings live on one fixed layer over the whole page rather than inside each card, so
 * a press is answered wherever it lands — on a card, on the epigraph, on the empty ground
 * between — and with a finger as with a pointer. A scroll is answered from where the
 * reader last touched the page: the finger on a touch screen, the pointer on a desk, or,
 * when the page has only been scrolled from the keyboard, the middle of the view. While
 * the scrolling goes on the rings follow one another with a beat between, which is the
 * rhythm the adapted animation had before it was made to fire once.
 *
 * Nothing rings until the reader has done something. A browser restoring its scroll
 * position fires the same event a reader does, and a ring that arrives with the page
 * would be answering nobody.
 *
 * The elements are all this makes; the stylesheet owns the motion. Each is taken off the
 * layer when its second ring finishes, and the layer is kept short in case one never does.
 */
function rippleOnContact() {
  const layer = document.createElement("div");
  layer.className = "ripples";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);

  let contact = null;
  let engaged = false;
  let lastRingAt = -Infinity;

  function ring(x, y, now) {
    const mark = document.createElement("span");
    mark.className = "ripple";
    mark.style.left = `${x}px`;
    mark.style.top = `${y}px`;
    mark.addEventListener("animationend", (event) => {
      if (event.animationName === "ripple" && event.pseudoElement === "::after") {
        mark.remove();
      }
    });
    while (layer.childElementCount >= RIPPLES_AT_MOST) {
      layer.firstElementChild.remove();
    }
    layer.append(mark);
    lastRingAt = now;
  }

  const engage = () => {
    engaged = true;
  };
  const remember = (event) => {
    engaged = true;
    contact = { x: event.clientX, y: event.clientY };
  };
  window.addEventListener("pointermove", remember, { passive: true });
  window.addEventListener("keydown", engage, { passive: true });
  window.addEventListener("wheel", engage, { passive: true });
  window.addEventListener("pointerdown", (event) => {
    remember(event);
    ring(event.clientX, event.clientY, performance.now());
  }, { passive: true });
  window.addEventListener("scroll", () => {
    const now = performance.now();
    if (!engaged || now - lastRingAt < SCROLL_RING_GAP) {
      return;
    }
    const x = contact ? contact.x : window.innerWidth / 2;
    const y = contact ? contact.y : window.innerHeight / 2;
    ring(x, y, now);
  }, { passive: true });
}

/** The blocks fall in the order the cards arrived in: the page leaves the way it came. */
function dropShutter() {
  const shutter = document.createElement("div");
  shutter.className = "shutter";
  shutter.setAttribute("aria-hidden", "true");
  for (let index = 0; index < SHUTTER_BLOCKS; index += 1) {
    const turns = (index * GOLDEN_ANGLE) / (Math.PI * 2);
    const block = document.createElement("span");
    block.style.setProperty("--block-delay", `${Math.round((turns - Math.floor(turns)) * 150)}ms`);
    shutter.append(block);
  }
  document.body.append(shutter);
}

/**
 * Closes the gallery before an artwork opens.
 *
 * Only an ordinary activation is taken over. A click carrying a modifier is a request for
 * a new tab or a download and must reach the browser untouched, and the navigation that
 * replaces the default is queued immediately rather than waiting for the blocks to land —
 * the animation is never what decides when the page changes.
 */
function leaveThroughShutter(cards) {
  for (const card of cards) {
    const link = card.querySelector(".card__link");
    if (!link) {
      continue;
    }
    link.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0
        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      dropShutter();
      window.setTimeout(() => {
        window.location.href = link.href;
      }, SHUTTER_WAIT);
    });
  }
}

/**
 * The shutter must not outlive the departure it dressed. The back-forward cache freezes
 * the page as it left — fallen blocks and all — and restores it without re-running any
 * script, so a reader coming back through the browser's own button found the gallery
 * alive but under an opaque lid. Both ends of the journey are swept: pagehide, so the
 * frozen snapshot is taken clean where the browser allows that, and pageshow on a
 * persisted restore, for the snapshots that kept the lid anyway.
 */
function liftShutterOnReturn() {
  const lift = () => {
    for (const shutter of document.querySelectorAll(".shutter")) {
      shutter.remove();
    }
  };
  window.addEventListener("pagehide", lift);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      lift();
    }
  });
}

const cards = [...document.querySelectorAll(".card")];
const footRule = document.querySelector(".colophon__rule");
// Tells the page's own timer that the reveal is in hand, so it leaves the hidden state
// alone. If this file never runs, that timer unhides everything instead.
document.documentElement.dataset.gallery = "ready";
revealOnApproach(footRule ? [...cards, footRule] : cards);
// Registered whether or not motion is allowed: the sweep must run even if the reader's
// motion preference changed between leaving and coming back.
liftShutterOnReturn();
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  rippleOnContact();
  leaveThroughShutter(cards);
}
