# generative-art

[![Gallery](https://img.shields.io/badge/Gallery-mukoubuchi.github.io-1f6feb)](https://mukoubuchi.github.io/generative-art/)
[![Tests](https://github.com/mukoubuchi/generative-art/actions/workflows/tests.yml/badge.svg)](https://github.com/mukoubuchi/generative-art/actions/workflows/tests.yml)
[![License: Source-Available](https://img.shields.io/badge/License-Source--Available-blue)](LICENSE)
[![p5.js 2.3.2](https://img.shields.io/badge/p5.js-2.3.2-ed225d)](https://p5js.org/)

A collection of generative artworks made with p5.js.

The artworks began as Processing and py5 sketches. All 25 have been ported to p5.js and the originals removed; each port's README records what it kept from its original and where it departed. Newer artworks are born browser-native — there is no original to keep faith with, so their notes explain the construction instead.

## Repository layout

| Path | Description |
| --- | --- |
| [p5js/](p5js/) | Browser artworks and the dry-run-first daily publishing pipeline |
| `exports/` | Generated frame sequences, still images, and videos; excluded from Git |

## Artworks

| Artwork | Description |
| --- | --- |
| [Koch Curves](p5js/artworks/koch-curves/) | One angled substitution erupting along every side of a square, faster each generation, rendered as an MP4 |
| [Recursive Pentagram](p5js/artworks/recursive-pentagram/) | An endless dive through nested pentagrams, each found inside the last, rendered as an MP4 |
| [Sierpinski Gasket](p5js/artworks/sierpinski-gasket/) | A built triangle pyramid and a random rain that wets nowhere else, rendered as an MP4 |
| [Fibonacci Spiral](p5js/artworks/fibonacci-spiral/) | A golden mark drawing the spiral through fifteen integer Fibonacci squares, rendered as an MP4 |
| [The Love That Moves](p5js/artworks/the-love-that-moves/) | Twenty nested pendulums whose cadences differ by exactly one, waving and realigning, rendered as an MP4 |
| [Under the Sun](p5js/artworks/under-the-sun/) | A spinning arc that relays the same ring forever over its own fading track, rendered as an MP4 |
| [Windmill](p5js/artworks/windmill/) | A mill with framed sails, turned by gusts a held key raises and stopped by its own friction, rendered as an MP4 |
| [Electric Fan](p5js/artworks/electric-fan/) | The same rotor with a motor behind it, climbing to a governed speed and coasting back to a dead stop, rendered as an MP4 |
| [Atan2](p5js/artworks/atan2/) | A field of needles all answering atan2 toward one probe, torn along a single ray, rendered as an MP4 |
| [One Yin, One Yang](p5js/artworks/one-yin-one-yang/) | Four discs on a turning ring, the nearest one forward, warm and cool by turns, rendered as an MP4 |
| [Temple Bell](p5js/artworks/pulse-button/) | A struck bell whose sound crosses the dark and dies away exponentially, rendered as an MP4 |
| [Troubling of a Star](p5js/artworks/troubling-of-a-star/) | A ring of five stars lit by the energy one pulled star sends around it, rendered as an MP4 |
| [Nautilus](p5js/artworks/nautilus/) | A chambered shell built room by room, coloured by age from abyss teal to pearl, rendered as a static PNG |
| [Ammonite](p5js/artworks/ammonite/) | A radius-doubling spiral that grows forever without changing shape, looping one doubling per clip, rendered as an MP4 |
| [Herringbone](p5js/artworks/herringbone/) | Two families of planks laid together into a diagonal weave, russet one way and steel the other, rendered as an MP4 |
| [Pinwheel](p5js/artworks/pinwheel/) | Walls go up and squares of two sizes take the places left for them, one russet at two strengths, rendered as an MP4 |
| [Hex Triangle](p5js/artworks/hex-triangle/) | Six walking triangles that close into one exact hexagon and open out again, rendered as an MP4 |
| [Kanizsa Square](p5js/artworks/kanizsa-square/) | A square drawn by nothing, starved and turned away until it goes, then made real, rendered as an MP4 |
| [Shippō Tsunagi](p5js/artworks/shippo-tsunagi/) | Two circle lattices on indigo; the eyes open only when the second family arrives, rendered as an MP4 |
| [Necker Cube](p5js/artworks/necker-cube/) | One shadow that is exactly two cubes, turning opposite ways, rendered as an MP4 |
| [Harriss Spiral](p5js/artworks/harriss-spiral/) | The plastic-ratio cascade drawn wave by wave in garden greens, rendered as an MP4 |
| [Reaction Diffusion Coral](p5js/artworks/reaction-diffusion-coral/) | A Gray-Scott colony grown from seeded specks, rendered as a static PNG |
| [Truchet Tides](p5js/artworks/truchet-tides/) | Truchet tiles turned by a drifting field, their channels cut and rejoined, rendered as an MP4 |
| [Voronoi Bloom](p5js/artworks/voronoi-bloom/) | Voronoi boundaries lit from golden-angle sites, rendered as a static PNG |
| [Clinamen](p5js/artworks/clinamen/) | Particle trails combed into streams by a noise field, rendered as a static PNG |
| [De Jong Attractor](p5js/artworks/de-jong-attractor/) | A de Jong orbit accumulated into a luminous cloud, rendered as a static PNG |
| [Möbius Band](p5js/artworks/moebius-band/) | A half-twisted band of glass, one-sided and one-edged, rendered as an MP4 |
| [Ulam Spiral](p5js/artworks/ulam-spiral/) | The primes alone on a square spiral of the counting numbers, rendered as a static PNG |
| [Hilbert Curve](p5js/artworks/hilbert-curve/) | One unbroken line eased through six degrees of filling a square, rendered as an MP4 |
| [Café Wall](p5js/artworks/cafe-wall/) | Horizontal courses bowed into wedges by an offset and a grey, rendered as an MP4 |
| [DLA Frost](p5js/artworks/dla-frost/) | Walkers frozen where they first touched a growing crystal, rendered as a static PNG |
| [Kissing Circles](p5js/artworks/kissing-circles/) | Darts kept greedy-first, each grown into the largest circle that fits, rendered as a static PNG |
| [Moiré Rings](p5js/artworks/moire-rings/) | Two families of rings beating into hyperbolas around the pointer, rendered as an MP4 |
| [Lorenz Ribbons](p5js/artworks/lorenz-ribbon/) | Two orbits a breath apart parting onto different wings, rendered as an MP4 |
| [Platonic Duals](p5js/artworks/platonic-duals/) | Two solids trading places, each one's face centres already the other's corners, rendered as an MP4 |
| [Thirty Spokes](p5js/artworks/thirty-spokes/) | Loops stirred past recognition, each still caught the same number of times on one hole, rendered as an MP4 |
| [No Common Measure](p5js/artworks/no-common-measure/) | Curves strung with whole numbers crowding towards the one that stays bare, rendered as a static PNG |
| [Turn It and Turn It](p5js/artworks/turn-it-and-turn-it/) | Every ring one more turn, and the gaps between the marks only ever three lengths, rendered as a static PNG |
| [What Hangs Stands](p5js/artworks/what-hangs-stands/) | One loaded chain reflected into the compression arch that carries the same forces, rendered as an MP4 |
| [Mystic Hexagram](p5js/artworks/mystic-hexagram/) | Six points moving on one conic while the intersections of opposite sides keep one line, rendered as an MP4 |

See [p5js/README.md](p5js/README.md) for rendering, dry runs, quote provenance, and the nightly publishing workflow.

## Adding sketches

Keep each browser artwork in its own kebab-case directory and register it in `p5js/manifest.json`.

```text
p5js/artworks/<artwork-id>/index.html
p5js/artworks/<artwork-id>/sketch.js
```

Then:

- Store generated images and videos in `exports/`, which is excluded from Git. No rendered image is committed; `npm run render` reproduces any of them from the manifest.
- Choose canvas dimensions and aspect ratios that suit each artwork while keeping the sketch window within a typical laptop display. As a guideline, use a maximum width of about 1280 px and a maximum height of about 720 px.
- Prefix commit subjects with an English [Conventional Commits](https://www.conventionalcommits.org/) type, for example `feat: add a flow-field artwork`.

## Render verification

Each artwork's geometry lives in a module that runs under `node --test` without a browser, so what a sketch draws is pinned by tests rather than by rendering it twice and comparing the files. `npm run render` then drives a headless browser that writes the same file for the same manifest entry every time. See [p5js/README.md](p5js/README.md).

## Gallery

`npm run site --prefix p5js` builds a browsable gallery of every artwork in the manifest into `site/`, generated from it rather than from a hand-written list. Nothing it produces is committed. See [p5js/README.md](p5js/README.md).

## License

This repository is source-available, not open source: reading and study are welcome, reuse is not. See [LICENSE](LICENSE) for what is and is not permitted, and [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES) for the components distributed with the gallery, which keep their own terms.
