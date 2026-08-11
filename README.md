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
| [Koch Curves](p5js/artworks/koch-curves/) | An 85-degree Koch substitution rendered as a static PNG |
| [Recursive Pentagram](p5js/artworks/recursive-pentagram/) | Recursive inward and synchronized outward pentagrams rendered as an MP4 |
| [Sierpinski Gasket](p5js/artworks/sierpinski-gasket/) | Seven generations of half-size triangles ringing each parent, rendered as a static PNG |
| [Fibonacci Spiral](p5js/artworks/fibonacci-spiral/) | Golden rectangles and quarter arcs taken down and rebuilt with the arrow keys, rendered as an MP4 |
| [Bounding Spots](p5js/artworks/bounding-spots/) | Twenty dots sweeping nested half circles at speeds set by their radius, rendered as an MP4 |
| [Loader](p5js/artworks/loader/) | A rotating arc whose two ends take turns leading, rendered as an MP4 |
| [Windmill](p5js/artworks/windmill/) | Four blades wound up by holding a key and left to coast, rendered as an MP4 |
| [Atan2](p5js/artworks/atan2/) | The polar angle of a moving point and its two Cartesian parts, rendered as an MP4 |
| [Toggle Color Ball](p5js/artworks/toggle-color-ball/) | Four discs swinging in opposition, handing the front colour on in turn, rendered as an MP4 |
| [Pulse Button](p5js/artworks/pulse-button/) | A play button that swells and fades when tapped, rendered as an MP4 |
| [Spring Polygon](p5js/artworks/spring-polygon/) | Five coupled bobs disturbed by a drag and left to settle, rendered as an MP4 |
| [Nautilus](p5js/artworks/nautilus/) | Translucent squares shrinking and turning into a chambered shell, rendered as a static PNG |
| [Ammonite](p5js/artworks/ammonite/) | A triangle strip spiralling out through five radius-doubling bands, rendered as a static PNG |
| [Herringbone](p5js/artworks/herringbone/) | Identical tiles woven in two perpendicular directions, rendered as a static PNG |
| [Pinwheel](p5js/artworks/pinwheel/) | Large and small squares turned about each other into a pinwheel paving, rendered as a static PNG |
| [Hex Triangle](p5js/artworks/hex-triangle/) | Six triangles orbiting a hexagon, closing on the centre and opening out, rendered as an MP4 |
| [Kanizsa Square](p5js/artworks/kanizsa-square/) | An illusory square broken by turning its inducers and then made real, rendered as an MP4 |
| [Eyes Pattern](p5js/artworks/eyes-pattern/) | Two offset lattices of circles whose overlaps read as eyes, rendered as a static PNG |
| [Necker Cube](p5js/artworks/necker-cube/) | A reversible wireframe cube turned by the pointer, rendered as an MP4 |
| [Harriss Spiral](p5js/artworks/harriss-spiral/) | A branching spiral on recursively subdivided plastic rectangles, rendered as a static PNG |
| [Reaction Diffusion Coral](p5js/artworks/reaction-diffusion-coral/) | A Gray-Scott colony grown from seeded specks, rendered as a static PNG |
| [Truchet Tides](p5js/artworks/truchet-tides/) | Noise-turned Truchet tiles joining into tidal currents, rendered as a static PNG |
| [Voronoi Bloom](p5js/artworks/voronoi-bloom/) | Voronoi boundaries lit from golden-angle sites, rendered as a static PNG |
| [Flow Field](p5js/artworks/flow-field/) | Particle trails combed into streams by a noise field, rendered as a static PNG |
| [Strange Attractor](p5js/artworks/strange-attractor/) | A de Jong orbit accumulated into a luminous cloud, rendered as a static PNG |
| [Möbius Band](p5js/artworks/moebius-band/) | A half-twisted band a traveller must lap twice to come home, rendered as an MP4 |
| [Ulam Spiral](p5js/artworks/ulam-spiral/) | The primes alone on a square spiral of the counting numbers, rendered as a static PNG |
| [Hilbert Curve](p5js/artworks/hilbert-curve/) | One unbroken line eased through six degrees of filling a square, rendered as an MP4 |
| [Café Wall](p5js/artworks/cafe-wall/) | Horizontal courses bowed into wedges by an offset and a grey, rendered as an MP4 |
| [DLA Frost](p5js/artworks/dla-frost/) | Walkers frozen where they first touched a growing crystal, rendered as a static PNG |
| [Circle Packing](p5js/artworks/circle-packing/) | Darts kept greedy-first, each grown into the largest circle that fits, rendered as a static PNG |
| [Moiré Rings](p5js/artworks/moire-rings/) | Two families of rings beating into hyperbolas around the pointer, rendered as an MP4 |
| [Lorenz Ribbons](p5js/artworks/lorenz-ribbon/) | Two orbits a breath apart parting onto different wings, rendered as an MP4 |

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
