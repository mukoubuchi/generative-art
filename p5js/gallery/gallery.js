/**
 * The jobs the stylesheet cannot do on its own: noticing that something has been scrolled
 * to, noticing where the pointer is, and holding a navigation open long enough to answer a
 * click. Everything those three discover is handed back to the stylesheet as a class or a
 * custom property; no motion is described here.
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

/** The glow grows from where the pointer actually entered, not from the middle. */
function followPointer(cards) {
  for (const card of cards) {
    const frame = card.querySelector(".card__frame");
    if (!frame) {
      continue;
    }
    card.addEventListener("pointermove", (event) => {
      const bounds = frame.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) {
        return;
      }
      const x = ((event.clientX - bounds.left) / bounds.width) * 100;
      const y = ((event.clientY - bounds.top) / bounds.height) * 100;
      frame.style.setProperty("--pointer-x", `${x.toFixed(1)}%`);
      frame.style.setProperty("--pointer-y", `${y.toFixed(1)}%`);
    });
  }
}

/**
 * A ring from where the card was pressed. The class is all this does; the stylesheet owns
 * the rest. It is taken off again when the second ring finishes, so a second press starts
 * the animation over rather than finding it already spent.
 */
function rippleOnPress(cards) {
  for (const card of cards) {
    card.addEventListener("pointerdown", () => {
      card.classList.remove("is-pressed");
      // Reading a layout property between the two flushes the removal, which is what makes
      // the animation restart rather than continue.
      void card.offsetWidth;
      card.classList.add("is-pressed");
    });
    card.addEventListener("animationend", (event) => {
      if (event.animationName === "ripple" && event.pseudoElement === "::after") {
        card.classList.remove("is-pressed");
      }
    });
  }
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

const cards = [...document.querySelectorAll(".card")];
const footRule = document.querySelector(".colophon__rule");
// Tells the page's own timer that the reveal is in hand, so it leaves the hidden state
// alone. If this file never runs, that timer unhides everything instead.
document.documentElement.dataset.gallery = "ready";
revealOnApproach(footRule ? [...cards, footRule] : cards);
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  followPointer(cards);
  rippleOnPress(cards);
  leaveThroughShutter(cards);
}
