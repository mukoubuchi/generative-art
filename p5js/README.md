# p5.js artworks and daily post pipeline

This directory contains browser-native artworks and a headless pipeline that can render one artwork, pair it with a verified public-domain quotation, validate the post body, and optionally publish it to X.

Publishing is disabled by default. A normal run is a dry run, and the X API is called only when both `--publish` and `X_POSTING_ENABLED=true` are supplied.

## Artworks

| ID | Logical canvas | Export | Timing |
| --- | --- | --- | --- |
| `koch-curves` | 680×680 | 1360×1360 PNG | Static |
| `recursive-pentagram` | 680×680 | 1360×1360 MP4 at 30 fps | 12 seconds drawing plus 1.5 seconds hold |
| `sierpinski-gasket` | 680×680 | 1360×1360 PNG | Static |
| `fibonacci-spiral` | 1010×640 | 2020×1280 MP4 at 30 fps | 10 seconds, taken down by ← and rebuilt by →; interactive page |
| `bounding-spots` | 960×480 | 1920×960 MP4 at 30 fps | 10 seconds, one revolution of the outermost dot |
| `loader` | 680×680 | 1360×1360 MP4 at 30 fps | 7.8 seconds, four grow-and-close cycles |
| `windmill` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, one wind-up and coast; interactive page |
| `atan2` | 680×680 | 1360×1360 MP4 at 30 fps | 8 seconds, one sweep of the point; interactive page |
| `toggle-color-ball` | 680×680 | 1360×1360 MP4 at 30 fps | 6 seconds, one full handover cycle |
| `pulse-button` | 680×680 | 1360×1360 MP4 at 30 fps | 7.5 seconds, three taps; interactive page |
| `spring-polygon` | 680×680 | 1360×1360 MP4 at 30 fps | 7 seconds, one pull and the settling; interactive page |
| `nautilus` | 680×680 | 1360×1360 PNG | Static |
| `ammonite` | 680×680 | 1360×1360 PNG | Static |
| `herringbone` | 680×680 | 1360×1360 PNG | Static |
| `pinwheel` | 680×680 | 1360×1360 PNG | Static |
| `hex-triangle` | 680×680 | 1360×1360 MP4 at 30 fps | 8.4 seconds, four orbits |
| `kanizsa-square` | 680×680 | 1360×1360 MP4 at 30 fps | 8.1 seconds, three rounds of the four states |
| `eyes-pattern` | 680×680 | 1360×1360 PNG | Static |
| `necker-cube` | 680×680 | 1360×1360 MP4 at 30 fps | 6 seconds, one turn; interactive page |
| `harriss-spiral` | 795×600 | 1590×1200 PNG | Static |
| `reaction-diffusion-coral` | 680×680 | 1360×1360 PNG | Static |
| `truchet-tides` | 960×640 | 1920×1280 PNG | Static |
| `voronoi-bloom` | 800×640 | 1600×1280 PNG | Static |
| `flow-field` | 960×640 | 1920×1280 PNG | Static capture, interactive page |
| `strange-attractor` | 680×680 | 1360×1360 PNG | Static |
| `moebius-band` | 800×600 | 1600×1200 MP4 at 30 fps | 10 seconds, two laps of the marker, two turns of the stage |
| `ulam-spiral` | 680×680 | 1360×1360 PNG | Static capture, animated page |

Koch Curves, Recursive Pentagram and Sierpinski Gasket are inherently radial or square constructions, so square logical canvases preserve their symmetry. The 680 px display size follows the laptop-sized square established by the earlier artworks. A per-artwork export scale produces higher-resolution media without enlarging the interactive canvas.

Recursive Pentagram preserves the Processing sketch's 60 draw steps and 200 line segments. Self-similar geometry construction is recursive, while list counting and rendering are iterative. Each outward step contains all five rotational branches so they appear simultaneously.

Sierpinski Gasket keeps the Processing sketch's seven generations and 1093 triangles. Its root radius and recursion cutoff are ratios of the canvas, so the generation count is independent of canvas size. The Processing sketch anchored the figure on its circumcentre, which left a much wider margin on the left than on the right; the port shifts the anchor left by a quarter radius so the bounding box is centred. The geometry is otherwise a translation of the original.

Fibonacci Spiral keeps the golden ratio in floating-point composition rather than in the integer canvas. The Processing sketch used an 806×500 canvas as the root rectangle and divided by the literal 1.618, so neither the root nor the ratio was exactly golden. Here the canvas is only a display frame, and the largest exact golden rectangle that fits inside the margins is centred within it. Because the root is exact, each quarter arc's radii land precisely on the boundaries the neighbouring rectangles already draw.

Its page keeps the original arrow-key interaction: Right Arrow adds a section, Left Arrow removes the newest one. The page says so on the canvas, at its foot. The Processing sketch never cleared its background, so Left Arrow dropped a rectangle from the list without erasing it; the port redraws the whole list each time, which makes removal visible.

The captured clip is those keys at work. It opens on the finished spiral and holds it — the first frame is what X shows as the clip's still, so the strongest picture stands at the door — then the left arrow takes the sections down one press at a time to the first rectangle, and the right arrow builds them back. Both key-caps are drawn in the clip and light as they are pressed. The spiral is subdivided until a rectangle's short side falls below half an output pixel, which comes to fifteen sections, and a test ties the clip's declared duration to that count so the two cannot drift apart.

There is a small asymmetry in what the two halves of the clip show. Removal happens on a cleared and redrawn canvas — the correction above — so the take-down the clip records is the port's behaviour, not the original's ghost-leaving one.

Bounding Spots keeps the Processing sketch's 2:1 canvas and its twenty orbital radii. Angular speed is stored as seconds per revolution rather than radians per frame, so the motion is the same at any canvas size. The trail is one dot per simulation step over a near-transparent black wash, which makes the step rate part of the artwork's appearance: the simulation runs at Processing's 60 steps per second and the 30 fps video samples every second step, so the beads stay as closely spaced as in the original.

Because each frame depends on every frame before it, Bounding Spots replays from the start whenever a frame is requested out of order. The renderer's own sequential walk still costs one step per frame, and the same frame index always produces the same image.

Loader is the one artwork whose canvas needed a real redesign. The Processing sketch drew an 80 px arc with a 20 px stroke on a 100 px canvas, so the stroke reached exactly the canvas edge and the indicator was clipped. The port keeps the indicator's proportions — the stroke is 2/5 of the outer radius and the arc's centre line 4/5 of it — and scales the whole thing to 4/10 of the canvas so it has room to spin. One grow-and-close cycle is 117 steps, measured from the state machine rather than hard-coded, and the clip is four of them. It starts at the step where the arc is fully extended, because the state machine's own first step draws nothing.

Two details of the Processing sketch are corrected. It reset its rotation to zero once the angle passed a full turn, which snapped the arc back by about a degree; the port takes the remainder instead. It also restarted the trailing end from a value that had just overshot the sweep, so the arc spanned a negative angle for one step at each handover; the port restarts from the leading end's actual position.

Windmill keeps the Processing sketch's acceleration of 0.001 radians per step and its cap of 0.3, so the wheel needs 300 steps to wind up and the same to coast back to rest. The captured clip is exactly one of those cycles: hold for the wind-up, release, stop. It therefore opens and closes on a stationary wheel. The Processing sketch stored speed and angle as vectors with only a z component and read them back through `mag()`, which made them non-negative scalars in practice; the port stores them as scalars. Holding K on the page accelerates the wheel and releasing lets it coast, as before. The page says so on the canvas, at its foot.

At the speed cap the wheel turns 0.6 radians between video frames, comfortably inside the quarter-turn symmetry of the four blades, so the sampled video never appears to stall or run backwards. A test pins that relationship.

Atan2 is the one artwork here that explains itself rather than only being looked at, so the capture drives the point once around the origin instead of following a recorded pointer path. That sweep necessarily crosses the negative x axis, where atan2 flips from +PI to -PI even though the point has barely moved; a test pins that the sweep crosses it exactly once. The Processing sketch put its axes at exactly half the canvas, which cut the arrowheads off at the edge; the port pulls them in to 0.47. Readouts are printed to a fixed number of decimal places, because Java and JavaScript disagree about how many digits a float deserves.

Toggle Color Ball keeps the Processing sketch's counter, which advances two degrees per step over a 720 degree period, so one handover cycle is 360 steps and six seconds. Every frame is a function of that counter alone. The discs run past the canvas edge at full swing in the original too; that full-bleed crop is the composition rather than an accident of the canvas size, so the port keeps it.

Pulse Button keeps the Processing sketch's pulse of 110 steps, during which the button grows by half and fades to nothing before snapping back. Clicking the button on the page starts a pulse, as before; the capture clicks it on a schedule instead, resting 40 steps between taps, so the clip is three taps and opens and closes on the button at rest. The Processing sketch was called ButtonExpanding; the button swells and fades rather than sending a ripple out from the touch, so the port is named for the pulse its own module already described.

The original's `mousePressed` wrapped its hit test in a `pushMatrix`/`popMatrix` pair that had nothing to transform, and took `abs()` of pointer coordinates that are never negative. Neither changed the result, and neither survives the port.

Spring Polygon keeps the Processing sketch's five bobs, its anchors at twice the rest length, and its two spring constants, so the network starts already stretched and never quite stops moving. Dragging a bob on the page disturbs it, as before; the capture grabs the first bob, pulls it towards a corner, lets go, and spends the rest of the clip on the settling.

The original cleared each bob's grab offset inside its integrator, one call before the drag used it, so a grabbed bob always snapped its centre onto the pointer. It also ran the drag inside the nested bob loop, which placed a dragged bob partway through its own interactions. The port applies the drag once, straight after the bob integrates, and keeps the offset the grab recorded.

Nautilus keeps the Processing sketch's shrink schedule, which steps the radius by 5/200 of the start radius at the rim and eases to 0.1/200 at the centre, so the turns crowd together into a shell rather than spreading like a plain spiral. That schedule lands on 158 squares whether it is run in the original's 32-bit floats at radius 200 or in doubles at radius 1, so the port expresses every constant against a start radius of 1 and fits the result to the canvas. Rendered at the original's own placement, the port differs from the Processing image by 0.6 of a grey level per pixel on average, and their mean luminances agree to within half a level.

Every square shares one corner at the anchor, which leaves the anchor well outside the middle of the figure; the Processing sketch anchored on the canvas centre and the shell drifted up and to the left of it. The port measures the bounding box of all 158 squares and centres that instead, filling 88 per cent of the shorter side.

Ammonite keeps the Processing sketch's five bands, its 12-degree sampling, and its rule that a band's radius doubles over one turn and hands the doubled value to the next band, so the strip is one unbroken spiral of 310 vertices and 308 triangles. Drawn at the original's own placement the two images are the same figure; they differ by about one grey level per pixel, which is what a 0.2-device-pixel line comes to when two renderers antialias it.

The original relied on `TRIANGLE_STRIP` with `noFill()` to outline every triangle. The port builds the triangles from the strip explicitly instead, so the drawing does not depend on how a given renderer treats the strip mode. As with Nautilus, the spiral is not symmetric about the pole it is drawn around, so the port centres its bounding box rather than its pole.

Herringbone works in grid units rather than pixels. The Processing sketch laid a 50 px grid on a 500 px canvas; the port keeps the same ten units across, tiles three units long, and runs starting four units apart, so the weave fits any canvas without recomputing a single length. Each run drifts one unit sideways per row, which is what turns a stack of tiles into a diagonal, and the vertical family starts its runs one unit off the horizontal family's lattice so the two fill each other's gaps.

The sketch never called `background()`, so it drew on Processing's default grey with the default black stroke. That grey is what the sketch renders, so the port states it rather than substituting white — it is a default rather than a colour the author chose, but the artwork is what runs.

Pinwheel is built by the same construction as Herringbone, with three constants changed: runs start five units apart instead of four, horizontal runs drift two units per row instead of one, and vertical runs drift three per column. That is the whole difference between a diagonal braid and a paving of large and small squares turned about each other, and stating the three drifts as named constants is what makes it legible. It inherits the same default grey.

The Processing sketch called this one HerringboneSquare, after the construction it shares with its sibling. The result is not a herringbone, though — a herringbone is rectangles laid in a zigzag, and this is squares of two sizes in rotation, which paving calls a pinwheel. The port takes the name of the figure rather than of the method.

Hex Triangle keeps the Processing sketch's two triangular paths, its six triangles, and the sixth of a turn between the paths that points their triangles opposite ways and makes the hexagram. Each triangle walks one edge of its path per cycle and ends on the corner its neighbour started from, so the six of them return to the same six places and the clip loops without a jump. The original advanced by 0.05 radians a frame, which put 125.66 steps in a turn and never closed exactly; the port rounds to a whole 126, a third of a per cent slower.

Its path radius comes from an expression that did not mean what it looks like. The sketch computed `(1 + 1/2) * hexagonRadius * sin(PI/3)`, but in Java that `1/2` is integer division, so the factor was 1 rather than 1.5. The value it actually produced is what makes the figure fit — at 1.5 the triangles would reach a third of the way past the canvas edge — so the port keeps the effective radius and drops the expression. A test pins that the figure fits at 1 and would not at 1.5.

The sketch also advanced a second angle every frame that only a commented-out `rotate` ever read. It does not survive the port.

Kanizsa Square is that illusion put through four states: the inducers spin until the illusion breaks, the figure rests, the mouths fill in and the square that was never drawn is drawn and turned away from them, and the figure rests again. The eased step decides how long each state lasts, so the port measures the cycle from the state machine rather than transcribing it — 69, 12, 69 and 12 steps, 162 in all, and the same in 32-bit floats as in doubles. The clip is three cycles and both its first and last frames are the resting figure.

Twelve steps spread across the four states were rendered at the original's own placement and compared with the Processing frames pixel by pixel. Each differs by under 0.05 of a grey level on average, with no pixel flipped between black and white. That was worth checking because of one detail: the original turned the coordinate system again between placing the discs and closing the quadrilateral, and whether that turn reached the shape decided whether the square pulls away from the discs or stays pinned to them. It reaches it, and the square turns at twice the rate of either.

Eyes Pattern works in grid units like the two herringbones: four circles across the canvas, each one unit in diameter, one lattice on the integer points and a second on the half points. Nothing but circles is drawn — the eyes are the lenses two overlapping circles cut out of each other. The original wrote a slightly different loop bound for each lattice, one canvas plus a diameter and the other plus a radius; both come to five circles a side, so the port states the bound once. It inherits the same default grey as the herringbones.

The lattice is the tiling Japanese pattern books call *shippō tsunagi*; the artwork keeps the original sketch's name for it.

Necker Cube keeps the Processing sketch's isometric projection — the corner angle of a sixth of a turn is what sets it — and its mapping from pointer to rotation, so crossing the canvas turns the cube once. Moving the pointer on the page turns it, as before; the capture walks the pointer from the left edge to just short of the right one, so the clip's last frame meets its first.

The figure repeats every quarter turn, which is the cube's own symmetry rather than a fault in the sampling, and a test pins it. Between those positions the cube flattens to a plain rectangle divided in three, which is the moment a face comes square to the viewer.

The original relied on `QUAD_STRIP`; the port builds the four quads from the strip explicitly, so the drawing does not depend on how a renderer treats the strip mode. Rendered at the original's own placement, seven pointer positions differ from the Processing frames by about 0.3 of a grey level each. The one deliberate change is the anchor: every far corner trails one radius behind its near corner, so the envelope of the whole rotation reaches a radius further one way than the other, and the original's anchor left the figure a little above centre. The port measures that envelope and centres it.

The Processing sketch was called SpinCube. What it draws is the classical reversible figure, so the port takes its established name.

Harriss Spiral keeps the Processing sketch's construction unchanged: a rectangle in the plastic ratio splits into one square and two smaller rectangles of the same proportion, and both children recurse. That the three pieces tile the parent exactly is the identity rho^3 = rho + 1, and a test checks it on all 405 subdivisions rather than on the ratio alone. Construction is recursive because the figure is self-similar; the drawing walks the finished list iteratively.

The canvas is a display frame and the proportion belongs to the construction, as with Fibonacci Spiral: the largest exact plastic rectangle that fits inside the margins is centred in it. Every length the sketch set against its 600 px height — the margin, the recursion cutoff, the arc sampling and both stroke weights — is kept as a fraction of the height.

Against the Processing image the port differs by 1.6 grey levels per pixel on average, higher than the other ports because the drawing is some sixteen hundred hairlines and every one of them is antialiased differently by the two renderers. The figures are the same; no line is displaced.

The Processing sketch was called HarrisSpiral. The spiral is named after Edmund Harriss, whose surname has two s, so the port spells it that way.

Reaction Diffusion Coral is the first port whose image cannot be reproduced pixel for pixel, and deliberately so. It keeps the Processing sketch's Gray-Scott model exactly — the same 420-square grid, 1200 iterations, diffusion rates, feed and kill fields, nine-point Laplacian and seeded colonies — but the fields and the colony positions are drawn from p5's noise and random rather than Processing's, and those generators differ. The figure is the same kind of colony in a different arrangement.

What is checked instead is that it is the same kind. Against the Processing image the colony covers 19.95 per cent of the frame against 19.50, at a mean luminance of 26.5 against 25.0, with its lit pixels a mean 0.472 of the half-frame from the centre against 0.456 and reaching 0.771 against 0.774. Coverage, brightness and spread agree; only the placement differs.

Both generators are seeded at the top of `draw` rather than in `setup`, so the image is a function of the seed alone however many times the sketch is drawn. The simulation module takes `noise` and `random` as arguments, which is what lets the model be tested in Node without a browser. The Processing sketch wrote packed HSB colours straight into its pixel buffer; p5's buffer is RGBA bytes, so the port converts explicitly and a test pins the conversion against known colours.

Truchet Tides keeps the Processing sketch's grid, tiles and four stacked passes. Its 28 columns of 32 pixels divide the framed area exactly, and every tile is one of two quarter-turn pairs whose ends meet the midpoints of its edges — which is why the curves join across the grid however the orientations fall, and what a test pins. Orientation is a noise field pushed one way or the other by a travelling sine wave; the noise alone would scatter the tiles, and the wave is what makes whole bands agree and read as currents.

As with Reaction Diffusion Coral the generators differ from Processing's, so the orientations differ and the image is not reproduced pixel for pixel. Coverage and the length of the currents are: ink over 10.71 per cent of the frame against the original's 10.37, and diagonal runs averaging 2.71 and 4.91 pixels against 1.53 and 2.54 at half the resolution, so 2.71 against 3.06 and 4.91 against 5.08 once the export scale is taken out.

The paper is painted through the pixel buffer, which ignores the transform, so its texture is read in logical coordinates and the export scale changes the resolution of the image without changing the size of the grain.

Voronoi Bloom draws its diagram without ever building a polygon. For each pixel it finds the two nearest of the 42 sites; the gap between those two distances falls to zero exactly on a Voronoi edge, so shading by that gap lights the boundaries. A test pins the gap vanishing halfway between two sites. The sites themselves sit on a golden-angle spiral whose radius is raised to 0.62, which packs them more tightly towards the rim than a square root would and gives the bloom its dense centre.

The connecting lines follow the original's rule: each site finds its nearest neighbour and the line is drawn only when the site holds the lower index, so mutual pairs appear once and there are fewer lines than sites.

Its generators differ from Processing's like the other two, and this artwork's appearance rests on 42 positions rather than on a field, so a different draw moves the statistics further: lit pixels cover 13.97 per cent of the frame against 12.31, at a mean luminance of 31.3 against 28.3, a mean 0.655 of the half-frame from the centre against 0.599. The palette, the glow and the structure are the same; the cells fall differently.

Flow Field is the first artwork here ported from py5 rather than from Processing. It keeps the py5 sketch's 1850 particles, its step of 1.4 pixels, and its 900 steps, so the finished image is 1,665,000 segments laid down at six per cent opacity: a density map rather than a drawing, in which a trail is visible only where many particles have followed the same line. The field's angle spans two whole revolutions of the noise value rather than one. That matters more than it looks: noise never reaches its own bounds, so a single turn would leave a wedge of directions unreachable and the whole field would lean one way, while two turns fold the range back on itself and produce the facing streams that meet along a seam.

A particle that leaves the canvas is replaced, and the step that carried it out is drawn before the bounds are tested, which is what lets the trails run off the edge instead of stopping short of it. Replacement draws three numbers from the shared random sequence, so how many particles left the canvas earlier in a step changes what every later replacement receives; a test pins that ordering. The segments are drawn straight to the 2D context with one colour string cached per particle, because formatting a colour 1.665 million times would cost more than drawing the segments.

Its generators differ from py5's, so the field is a different one and the image is not reproduced pixel for pixel. What matches is the structure. Coverage is 72.94 per cent of the frame against the original's 73.08, and a horizontal cut crosses 216 filaments on average against 239, so the trails are neither merged nor multiplied. What differs is contrast: mean luminance 37.3 against 40.7, pixels above the bright threshold 2.44 per cent against 4.49, and a mean gradient of 6.33 against 8.83. The port's hairlines are softer, which is what a 1.1 pixel line at six per cent opacity comes to when Chromium antialiases it rather than Java2D.

On the page the field fills in one step per frame, so the 900 steps the capture runs at once can be watched forming instead.

Strange Attractor keeps the py5 sketch's Peter de Jong coefficients, its 336,000 points, its 1000-step warmup and its 32 colour bands. Every point is drawn at eight and a half per cent opacity into an additive layer, so the brightness of a place is the number of times the orbit has visited it: the image is a histogram of the attractor rather than a plot of it. The bands are keyed to a point's height within the cloud rather than to its position in the sequence, which is why the colour follows the figure's shape instead of scattering across it.

This is the one stochastic port whose image does not depend on the generators at all. The py5 sketch seeded a starting point within a hundredth of the origin, but the map pulls any start onto the same attractor and the first thousand iterations are discarded, so the figure is a property of the four coefficients. A test measures that directly: two starts far apart on that scale agree on the share of the cloud in every one of the 32 bands to within 0.4 per cent, and on the fitted scale to within one per cent. The port keeps the seeded start anyway, because that is how the sketch was written.

So the two images can be compared as the same figure, and they are: the ink's centroid sits at 0.483 and 0.469 of the frame against the original's 0.487 and 0.475, with a radius of gyration of 0.366 against 0.376, and a horizontal cut crosses 73.3 filaments on average against 70.3. The port is brighter — lit pixels cover 7.83 per cent of the frame against 4.58, at a mean luminance of 12.25 against 10.47 — because a 0.72 pixel dot is spread across four pixels by Chromium's antialiasing where an OpenGL point sprite lands on one, and because the reference image is a JPEG, which attenuates isolated faint specks. Neither moves the figure.

The points are ordered into their colour bands with a counting sort and drawn in 32 passes of one stroke colour. Additive blending is commutative, so grouping them changes the cost and not the image; each point is still stroked separately, because a single path stroked once would composite its overlaps as one shape and lose the accumulation the artwork is made of.

Möbius Band is the first artwork here that is not a port, and the first drawn through WEBGL. The band is one identity: sweep a segment around a circle while turning it at half the rate, and P(u + 2π, v) = P(u, −v) — a lap glues the strip to itself with a flip. The tests assert that identity and then its consequences one by one: the surface normal comes back negated after a lap, so the band has one side; the rim needs 4π to close, so it has one edge; and the marker riding the centre line stands at its starting point halfway through the clip the wrong way up, needing the second lap to come home. The clip is that journey — a bead carrying a pin along the surface normal, the stage turning twice while the bead laps twice, so the last frame hands back to the first.

The band is shaded in the sketch rather than by the renderer's lights, and the light is folded in |N·L|. Which way the normal points is not a fact a one-sided surface can supply — that is the artwork's whole subject — so any shading that reads the sign of the normal has to tear somewhere along the ring; the absolute value is exactly the part of the lighting the band can answer for. The marker is drawn twice, once as a dim ghost with the depth test off, because the half of the journey that happens behind the band is the half that makes the point.

Two WEBGL particulars are worth recording for the next 3D artwork. Stroke weights there are screen pixels and ignore the model transform, so the sketch multiplies them by the export scale itself. And the drawing buffer is asked to persist, because the thumbnail reads the canvas from a later task than the one that drew it, which with a transient buffer reads back black.

Ulam Spiral winds the counting numbers into a square coil — one per cell, turning left whenever it can, each pair of legs one step longer — and draws nothing but the primes. The layout never consults primality, which is what makes the picture strange: the primes crowd onto diagonals anyway. That is a fact about the grid rather than an accident of the drawing, and it is pinned as one: along any diagonal the values' second difference is a constant 8, so a diagonal carries a quadratic polynomial, and some quadratics are rich in primes. The walk is tested against the spiral's classical coordinates — the odd squares marching down one diagonal, ring by ring — and the sieve against published counts: 25 primes below one hundred, 1229 below ten thousand.

The canvas is 399 cells across, 159,201 numbers, because the diagonals are a statistical surplus and a statistic needs a population — at fewer rings the figure reads as speckle. The page lays the numbers down from the centre out, since the order of construction is the explanation, and its pace is cubic in time: the first seconds walk the innermost rings slowly enough to watch the winding rule, and the outer rings, which only repeat the lesson, sweep past. The capture draws the finished figure.

## Install

Node.js 22 or later and ffmpeg are required.

```bash
cd p5js
npm ci
npx playwright install chromium
```

## Test and render

```bash
npm test
npm run render -- --all
npm run render -- --artwork koch-curves
npm run render -- --artwork recursive-pentagram
npm run thumbnails
```

Generated media is written under `exports/p5js/` and is excluded from Git.

`npm run thumbnails` writes one JPEG per artwork into `site/thumbnails/`, for the gallery to show. It is much cheaper than a full render: everything is captured at the logical size rather than the export scale, and a moving artwork gives up one frame instead of a whole encoded clip, so the whole set takes about twenty seconds and under a megabyte between them. The frame chosen is halfway through by default, because several clips open and close on a resting state; an artwork whose telling moment lies elsewhere sets `thumbnail.frame` in the manifest. Three do. Pulse Button spends its middle mid-fade and is shown at rest, Recursive Pentagram is still drawing itself and is shown finished, and Atan2's middle is the instant the angle flips between +PI and -PI, which puts the point on the axis and the readout at its least legible.

The renderer uses the Chromium build that `npx playwright install chromium` downloads, matching CI. Set `PLAYWRIGHT_CHANNEL` only to fall back to a locally installed browser channel; its antialiasing differs from CI's Chromium, so rendered output is no longer comparable.

Möbius Band draws through WebGL, which headless Chromium rasterizes in software — SwiftShader — by default, on a laptop with a GPU exactly as in CI without one. The shared rasterizer is what keeps its pixels comparable between the two, and repeated headless renders measured byte-identical on it, across processes: twice over on this machine, and twice over between independent CI runs. The two machines' files still differ from each other, because their ffmpeg builds do; the copy that posts is always the one CI rendered. Forcing a real GPU (`--use-angle` and friends) swaps the rasterizer and moves about one pixel in a hundred by up to half its range, which takes the output out of comparison the same way `PLAYWRIGHT_CHANNEL` does for the 2D artworks.

The renderer serves the pinned npm copy of p5.js to a headless Chromium page. Canvas dimensions and export scale are artwork-level manifest properties rather than global defaults. Static canvases are captured directly. Animated canvases expose deterministic frame control to Playwright; the captured PNG sequence is encoded with ffmpeg and checked with ffprobe. Video duration is capped at 140 seconds by the manifest validator. The `--all` path reuses one browser process across the batch instead of repeatedly launching Chromium.

## Posting schedule

`schedule.json` says which artwork goes out on which day, in the time zone it names. The
pipeline reads the day's entry and does what it says; there is no rule that turns a date
into an artwork, and nothing is written back after a post.

That is a deliberate trade. A rule — the date modulo the number of artworks, say — needs no
file, but its answer changes under you the moment an artwork is added, so the same date
names a different work before and after, and no one can read next week's posts off the page.
A queue is refilled by appending to the list; a run is paused by removing the days.

```json
{ "date": "2026-08-12", "artwork": "strange-attractor" }
```

An entry may add `"quote"` to choose among an artwork's candidates. The first run covers all
twenty-five artworks, one a day. Their order is not the manifest's: each family of work —
the spirals, the tilings, the illusions, the fields, the recursions, the moving toys — is
spread evenly across the run rather than posted in a block, still and moving alternate as
far as the counts allow, and no two consecutive days quote the same language. The day it
opens on is Strange Attractor, whose Nietzsche is about chaos giving birth to a dancing star.

Nothing scheduled for today is not an error: the pipeline says so and stops. That is what
the end of a run looks like from the inside, and it is what the cron finds every night until
the list is refilled.

## Dry run

The pipeline prepares today's scheduled post:

```bash
npm run pipeline
```

Pin the selection when reviewing an output, which also bypasses the schedule:

```bash
npm run pipeline -- --artwork recursive-pentagram --quote pascal-infinite-sphere
npm run pipeline -- --date 2026-08-20
```

Rehearse the whole run at once — every body built and weighed, every artifact confirmed to
be on disk — which is how a quotation two characters too long is found before its day
arrives rather than on it:

```bash
npm run render -- --all
npm run pipeline -- --all
```

A dry run renders the media and prints the complete post body, weighted character count, quote ID, and artifact path. Use `--skip-render` only when the expected artifact already exists.

Post text follows this layout:

```text
<original quotation>
— <author>, <source>

<short artwork description>

<interactive URL>
```

The weighted count follows twitter-text v3. Plain-text spans are normalized to NFC before counting. Code points from U+0000–U+10FF, U+2000–U+200D, U+2010–U+201F, and U+2032–U+2037 have weight 1; other code points have weight 2. Emoji grapheme clusters have weight 2 and each HTTP or HTTPS URL has weight 23. The default maximum is 280 and can be changed with `--max-weighted-chars`. An over-limit body fails; it is never truncated.

The manifest points at the published gallery, so a post links to a page that is actually there. Override the base URL during review with `--base-url`.

## Quote catalog

Every entry in `quotes.json` records the original text, a BCP 47 language tag, author, source, year, public-domain verification, and a source URL. Each artwork lists candidate quote IDs in `manifest.json`. If none of an artwork's candidates resolve to a verified public-domain entry, the selector warns and excludes that artwork.

The sources are:

- Ralph Waldo Emerson, *Essays: First Series*, “History” (1841): [Project Gutenberg transcription](https://www.gutenberg.org/files/2944/2944-h/2944-h.htm)
- Blaise Pascal, *Pensées*, article I (published 1670): [French Wikisource transcription aligned to the scanned Havet edition](https://fr.wikisource.org/wiki/Page%3APascal_-_Pens%C3%A9es%2C_%C3%A9d._Havet.djvu/81)
- Jonathan Swift, *On Poetry: a Rhapsody* (1733): [English Wikisource transcription aligned to the scanned Sheridan and Nichols edition](https://en.wikisource.org/wiki/Page%3AThe_Works_of_the_Rev._Jonathan_Swift%2C_Volume_8.djvu/186)
- Jakob Bernoulli's epitaph in Basel Minster (1705): [Florian Cajori, *A History of Mathematics* (1893), page 237](https://en.wikisource.org/wiki/Page%3AA_History_of_Mathematics_(1893).djvu/256), which records that Bernoulli willed the curve to be engraved on his tombstone with this inscription
- Dante Alighieri, *Divina Commedia*, *Paradiso* XXXIII, the closing line (completed 1321): [Italian Wikisource transcription](https://it.wikisource.org/wiki/Divina_Commedia/Paradiso/Canto_XXXIII)
- *Vulgata Clementina*, Ecclesiastes 1:10 (1592 edition): [Latin Wikisource transcription](https://la.wikisource.org/wiki/Vulgata_Clementina/Liber_Ecclesiastes)
- Miguel de Cervantes, *Don Quijote* I, chapter VIII (1605): [Spanish Wikisource transcription of the 1608 edition](https://es.wikisource.org/wiki/Page%3AEl_ingenioso_hidalgo_Don_Quijote_de_la_Mancha.djvu/74). The quoted words are spelled the same in the 1608 text as in modern editions.
- René Descartes, *Discours de la méthode*, second part (1637): [French Wikisource transcription of the Cousin edition](https://fr.wikisource.org/wiki/Page%3A%C5%92uvres_de_Descartes%2C_%C3%A9d._Cousin%2C_tome_I.djvu/147)
- *Yijing*, Xici Shang, chapter 5: [Chinese Wikisource transcription](https://zh.wikisource.org/wiki/%E6%98%93%E5%82%B3/%E7%B9%AB%E8%BE%AD%E4%B8%8A). The catalog credits the *Yizhuan* rather than Confucius, to whom the commentary is traditionally but not securely attributed, and tags the text `lzh` for Literary Chinese rather than the broader `zh`. Its date is recorded as unknown.
- *Heike monogatari*, book 1, “Gion Shōja”: [National Diet Library scan of the *Kōchū Nihon bungaku taikei* edition](https://dl.ndl.go.jp/info:ndljp/pid/1018053/152). That edition prints the opening in pre-war orthography — 鐘の**聲**, 響あり without the okurigana き — so the catalog stores it that way rather than in the modernised form the passage is usually quoted in. Its date is recorded as unknown.
- Francis Thompson, *The Mistress of Vision* (1897): [English Wikisource transcription of *The Poets' Chantry* (1912), page 149](https://en.wikisource.org/wiki/Page%3AThe_Poet%27s_Chantry_pg_149.jpg), which prints the stanza these lines close
- Charles Baudelaire, “Correspondances”, *Les Fleurs du mal* (1861): [French Wikisource transcription of the 1861 edition, validated against the scan](https://fr.wikisource.org/wiki/Page%3ABaudelaire_-_Les_Fleurs_du_mal_1861.djvu/24)
- Titus Lucretius Carus, *De rerum natura* II.221–222: [the Perseus digital library text](https://scaife.perseus.org/reader/urn:cts:latinLit:phi0550.phi001.perseus-lat1:2.221-2.222/). Its date is recorded as unknown, since the poem was left unfinished at Lucretius's death and is dated only by inference.
- Friedrich Nietzsche, *Also sprach Zarathustra*, Zarathustra's Vorrede 5 (first published 1883): [the scanned Insel-Verlag edition of 1908, page 8](https://archive.org/details/alsosprachzarath00niet_0/page/n20/mode/1up). That edition prints the old orthography, and the catalog keeps it: “muß”, not the modern “muss”.
- Kamo no Chōmei, *Hōjōki* (1212): [Japanese Wikisource transcription of the *Kokubun taikan* edition (Itakuraya Shobō, 1903), from the National Diet Library scan](https://ja.wikisource.org/wiki/%E6%96%B9%E4%B8%88%E8%A8%98_(%E5%9C%8B%E6%96%87%E5%A4%A7%E8%A7%80)). As with the *Heike*, the received modern form differs from the printed one: the opening is usually quoted as ゆく河の流れは絶えずして、しかももとの水にあらず, where this edition prints 行く川のながれは絕えずして、しかも本の水にあらず. The *Gunsho ruijū* text differs again, ending each clause with a full stop rather than a comma. The catalog follows the edition it cites.
- A. M. Turing, “The Chemical Basis of Morphogenesis”, *Philosophical Transactions of the Royal Society of London B* 237 (1952), 37–72: [doi:10.1098/rstb.1952.0012](https://doi.org/10.1098/rstb.1952.0012), quoting the abstract as the publisher records it. Turing died in 1954, so the text entered the public domain in the United Kingdom on 1 January 2025.
- Gottfried Wilhelm Leibniz, *La Monadologie*, 67 (1714): [French Wikisource transcription of the Alcan 1900 edition of the *Œuvres philosophiques*](https://fr.wikisource.org/wiki/Page%3A%C5%92uvres_philosophiques_de_Leibniz%2C_Alcan%2C_1900%2C_tome_1.djvu/746). Editions punctuate the section differently — Gerhardt has no comma after “conçue” or “jardin” where this one does — so the catalog follows the edition it cites.
- Plato, *Politeia* VII 515c (Stephanus numbering): [John Burnet's 1905 Oxford text in the Perseus digital library](https://scaife.perseus.org/reader/urn:cts:greekLit:tlg0059.tlg030.perseus-grc2:7.515c/). The line chosen from the cave allegory is the one about taking shadows for the things themselves, which is what a reversible figure asks the viewer to do. Its date is recorded as unknown.
- Plotinus, *Enneades* I.6.9: [Richard Volkmann's 1883–84 Teubner text in the Open Greek and Latin corpus](https://scaife.perseus.org/reader/urn:cts:greekLit:tlg2000.tlg001.1st1K-grc1:1.6.9/). Goethe's proem to the *Farbenlehre* — “Wär' nicht das Auge sonnenhaft” — adapts this sentence, so the two Goethe-adjacent artworks quote the source and the adaptation rather than Goethe twice. Its date is recorded as unknown.
- Johann Wolfgang von Goethe, *Maximen und Reflexionen*: [*Sprüche in Prosa, Maximen und Reflexionen* (Leipzig: Insel, 1908), page 153](https://archive.org/details/sprcheinprosam00goetuoft/page/n169/mode/1up). The maxim is usually quoted as “Die Sinne trügen nicht, **aber** das Urteil trügt”; this edition prints it without the “aber”, and the catalog follows the page. The Fraktur was read from the scan rather than taken from its OCR.
- Plato, *Timaeus* 54e (Stephanus numbering): [John Burnet's 1905 Oxford text in the Perseus digital library](https://scaife.perseus.org/reader/urn:cts:greekLit:tlg0059.tlg031.perseus-grc2:54e/). The passage was assigned as the construction of the elements from triangles; this line is the step of it that says six triangles make one, which is what the artwork shows. Its date is recorded as unknown.
- Aurelius Augustinus, *De civitate Dei* XIX.13 (completed 426): [Latin Wikisource transcription of the Migne 1841 edition](https://la.wikisource.org/wiki/De_civitate_Dei_(ed._Migne)/19)
- Heraclitus, DK 22 B51, quoted by Hippolytus, *Refutatio omnium haeresium* IX.9.2: [Paul Wendland's 1916 edition in the Open Greek and Latin corpus](https://scaife.perseus.org/reader/urn:cts:greekLit:tlg2115.tlg060.opp-grc1:9.9.2/). Its date is recorded as unknown.
- Publius Ovidius Naso, *Metamorphoses* XV.165 (completed AD 8): [Hugo Magnus's 1892 edition in the Perseus digital library](https://scaife.perseus.org/reader/urn:cts:latinLit:phi0959.phi006.perseus-lat2:15.165/). The line opens a new sentence there and is capitalised accordingly; the quotation stops before the colon that follows it.
- Oliver Wendell Holmes, “The Chambered Nautilus”, in *The Autocrat of the Breakfast-Table*, chapter IV (1858): [English Wikisource transcription of the scanned first book edition, page 111](https://en.wikisource.org/wiki/Page%3AThe_Autocrat_of_the_Breakfast-Table_(1858)_Holmes.djvu/139). The title page names him without the “Sr.” later used to distinguish him from his son, so the catalog does too.
- Euclid, *Elements* IX.20: [Heiberg's text in the Perseus digital library](https://scaife.perseus.org/reader/urn:cts:greekLit:tlg1799.tlg001.perseus-grc2:9.prop.20/), quoting the proposition's enunciation — that the primes are more than any assigned multitude of primes. Its date is recorded as unknown.
- August Ferdinand Möbius, “Zur Theorie der Polyëder und der Elementarverwandtschaft”, printed from his manuscripts in the *Gesammelte Werke*, volume 2 (1886): [the scanned edition, page 520](https://archive.org/details/gesammeltewerkeh02mbuoft/page/520). The sentence describes the strip that comes out one-sided when its end is glued on after an odd number of half-turns. The words are Möbius's own from notebook D₉ — the editor marks the unaltered manuscript text with quotation marks, and dates the discovery to late 1858, which is the year the catalog records; Möbius himself never published it.

Versification differs between editions: the Clementine Vulgate places “Nihil sub sole novum” at 1:10, while editions following the Hebrew numbering — and most modern translations — place it at the end of 1:9. The catalog cites the verse number of the edition it quotes.

The Swift passage is often quoted as “Hath smaller fleas”; the proofread transcription reads “Has”, and that is what the catalog stores.

The Heraclitus fragment turns on a textual split. Hippolytus, who transmits it, has παλίντροπος — a harmony that turns back on itself — while Plutarch and Porphyry have παλίντονος, back-stretched like a bow. Diels prints Hippolytus's reading and so does the catalog, which quotes only the two words that carry it and cites Hippolytus directly. The wider passage in the digital text has evident transcription slips, which is the other reason for keeping the quotation to those two words.

The Lucretius quotation is a complete conditional, but the sentence it belongs to runs on for two more lines before its full stop, so the catalog ends it with an ellipsis rather than supplying a stop the edition does not have.

Holmes revised the line between its two 1858 printings. [*The Atlantic Monthly*, volume I, number IV, page 469](https://en.wikisource.org/wiki/Page%3AThe_Atlantic_Monthly_Volume_1.djvu/477) reads “Build thee more stately mansions, my soul”; the book collecting the series reads “O my soul”, which is the received text. The catalog quotes the book.

## Optional X publishing

The uploader walks the v2 chunked media endpoints —
[`POST /2/media/upload/initialize`](https://docs.x.com/x-api/media/media-upload-initialize),
[`POST /2/media/upload/{id}/append`](https://docs.x.com/x-api/media/media-upload-append),
[`POST /2/media/upload/{id}/finalize`](https://docs.x.com/x-api/media/media-upload-finalize),
optional STATUS polling — and then [`POST /2/tweets`](https://docs.x.com/x-api/posts/create-or-edit-post)
with the returned media ID.

Not the shape the [chunked upload quickstart](https://docs.x.com/x-api/media/quickstart/media-upload-chunked)
describes, which is one path with a `command` field naming the step. That guide is behind
the service: `POST /2/media/upload` is now the *simple* upload, which takes a whole file
under a `media` field, so a form saying `command=INIT` is answered with
`400 Missing media field in JSON`. The reference pages linked above are what the service
actually does, and the client's test pins those paths so the tidier-looking older shape
cannot come back.

### Why OAuth 2.0, and what it costs

Both endpoints are reached with an OAuth 2.0 user access token, asked for with the scopes
`tweet.read tweet.write users.read media.write offline.access`. An app-only bearer token
cannot post, and the OAuth 1.0a route is not available for media: the v1.1 upload endpoint
that took it was [retired on 9 June 2025](https://devcommunity.x.com/t/deprecating-the-v1-1-media-upload-endpoints/238196),
and [`POST /2/media/upload`](https://docs.x.com/x-api/media/upload-media) documents the
OAuth 2.0 scope instead.

What that costs is a token lifecycle. An access token lasts two hours, so a nightly job
never has a live one and always starts by refreshing; a refresh spends the refresh token it
was given and issues a different one, which has to be stored before anything else happens.
The workflow does exactly that, in two steps in that order — see below.

Authorize once, by hand, to mint the first refresh token. The script opens nothing and
prints nothing but progress: the code, the verifier and the tokens stay in the process and
in the files it writes.

```bash
read -rsp "Client ID: " X_CLIENT_ID; echo
read -rsp "Client secret: " X_CLIENT_SECRET; echo
export X_CLIENT_ID X_CLIENT_SECRET

npm run x:authorize
```

It writes both tokens to a fresh temporary directory and prints the three commands to run
next — the check, the store, and the removal — with the paths filled in.

The secret is read rather than typed into the command, because a value written on the
command line is written into the shell's history file too, and that file outlives the
session by design.

**The tokens are written outside the repository, and the scripts refuse a path inside it.**
Not a warning — an error, and a test holds it there. A file that is never in the working
tree cannot be swept into a commit by a careless `git add`, and that particular carelessness
has no undo: rewriting the branch leaves the old commit fetchable at its own address, so the
only remedy for a credential that reached a public repository is to revoke it.

The check asks the upload endpoint one question — may these credentials upload media? — by
sending the INIT of a one-pixel PNG the script builds on the spot. Nothing is appended,
nothing is finalized, and no post is created; an initialized upload that is never finished
expires by itself.

It is asked in this order on purpose. The access token comes from the authorization that
just happened rather than from a refresh, so the refresh token about to be stored is still
untouched: if the answer is no, nothing has been spent and the OAuth 1.0a keys are still an
option. Doing the same check from the workflow would mean refreshing, storing, and finding
out — with the chain already rotated once — inside a log that a public repository keeps.

The app needs **Read and write** permissions, the **Web App, Automated App or Bot** type —
which is what makes it a confidential client and issues a client secret — and
`http://127.0.0.1:8080/callback` registered as a callback URI, spelled exactly that way.
The address rather than `localhost`, because that name resolves to both `::1` and
`127.0.0.1` and a browser may knock at whichever the server is not listening on;
`--redirect-host` overrides it if the app is already registered with the name.

Publishing by hand, with an access token already in hand:

```bash
X_POSTING_ENABLED=true \
X_OAUTH2_ACCESS_TOKEN=... \
npm run pipeline -- --artwork koch-curves --publish
```

## GitHub Actions

`.github/workflows/daily-post.yml` runs nightly at 15:00 UTC — midnight in the schedule's
own time zone — and can also be dispatched by hand. The nightly run publishes by
definition, posting whatever `schedule.json` names for the new day and spending nothing on
a day it names nothing; a dispatched run publishes only when its `enable_posting` input is
explicitly enabled, `X_POSTING_ENABLED` is true, `--publish` is passed, and the secrets
are present. Either way the generated artifact is uploaded for review.

Four secrets, and no credentials in the manifest or the quote catalog:

| Secret | What it is |
| --- | --- |
| `X_CLIENT_ID` | The app's OAuth 2.0 client ID |
| `X_CLIENT_SECRET` | Its client secret; a confidential client authenticates the refresh itself |
| `X_REFRESH_TOKEN` | The refresh token, replaced on every run |
| `X_TOKEN_ROTATION_PAT` | A fine-grained token for this repository with Secrets: read and write, which is what lets the run store the replacement |

The refresh and the store are separate steps, and the store comes first, because a run that
posted before storing would strand the chain whenever the post failed: the old refresh token
is already spent, the new one would be lost with the runner, and someone would have to open
a browser and authorize again.

One run posts at most once, and the schedule gives each date a single entry, so the nightly
cron cannot post twice for the same day. It is worth being exact about what that does not
cover: dispatching the workflow again by hand, with posting enabled, will post again. There
is no read-back against the timeline to prevent it.

### Queue notifications

A queue that runs out does so silently: the cron keeps firing, and every night is a
correct, green no-op. So the nightly run reports on the queue itself, to the one issue
titled "Posting queue status", where a comment reaches the owner's inbox through GitHub's
own notifications — no new credential, and no address written down anywhere.

While more than ten scheduled posts remain, nothing is said. From the night that leaves
ten or fewer, every posting night gets a comment with the count, the last scheduled date,
and how to refill. The first night that finds the queue empty gets one more, marked as the
final notice, and the issue closes. Refilling `schedule.json` is the whole reset: the
notices resume, and the issue reopens, from the file's own dates — the last scheduled date
recorded in the closed issue's body is what tells a new, longer schedule apart from the
one already reported dead.

The step runs after the post, on publishing runs only, under `continue-on-error`, and with
the repository token alone: a missed reminder must not cost a post, and the reporter never
holds an X credential. Re-running a night cannot comment twice, because each notice
carries its date in a marker the next run reads first. The `rehearse_queue_notice`
dispatch input takes a date and posts what that night's notice would say, marked as a
rehearsal and carrying a marker the nightly dedup deliberately does not read — which is
how the channel is proved end to end long before the first live notice is due.

## Gallery

```bash
npm run site
npm run site -- --clean
npm run site -- --skip-thumbnails
npm run preview
```

`npm run preview` serves the built site at `http://127.0.0.1:4173/generative-art/`, under a path prefix rather than at the root of the host, which is how GitHub Pages serves a project site. Use it rather than opening `site/index.html` from the file system: the artwork pages load their sketches as modules, and a browser refuses to fetch a module over `file://`, so every artwork would come up blank. The index page works either way, but only the drawing of the head appears there — the model that replaces it is a module too.

`npm run site` builds `site/`: an index page generated from the manifest, the artwork pages copied with their repository paths intact, the thumbnails, the pinned copies of p5.js and three.js, and the two license files. Nothing it produces is committed, and `--clean` is opt-in so a build never removes anything unless it is asked to.

The index has no hand-written list of artworks. It is generated from `manifest.json` and `quotes.json`, so an artwork that is registered always appears with a link and a quotation, and one that is not registered cannot appear at all. Because the artwork tree keeps its repository path, a card's link is the same URL that `interactiveBaseUrl` and `interactivePath` produce for a post; a test asserts the two agree rather than trusting them to.

Every frame is the same shape whatever its artwork's canvas is, and the picture is fitted inside rather than cropped to it. The canvases run from 2:1 to square, so sizing each frame to its own artwork left the rows visibly ragged, and cropping them to a common shape would cut the apex off a triangle and the ends off an arc. Matting each work on a common mount is what a gallery does with prints of different sizes.

### Telling the reader what there is to do

Six artworks answer to the reader, and none of them said so, which left the interaction discoverable only by reading the source. Each page now prints a single line at the foot of its canvas:

| Artwork | Control | The line it prints |
| --- | --- | --- |
| `fibonacci-spiral` | arrow keys | `→` add a section · `←` remove the newest |
| `windmill` | K | `K` hold to spin up · `release` coast to rest |
| `atan2` | pointer | `move` the pointer places the point |
| `necker-cube` | pointer | `move` the pointer turns the cube |
| `pulse-button` | click | `click` the button pulses once |
| `spring-polygon` | drag | `drag` pull a bob and let it settle |

The line is drawn where the line is drawn: an artwork that only plays a fixed loop says nothing, because there is nothing to say. Flow Field is the near case — its page is live, and its trails accumulate as you watch — but nothing it does depends on the reader, so it carries no line.

Each control is set in a token of its own and its effect follows in plain type, which is how a legend reads rather than how a sentence reads: the eye finds the key before the clause. An arrow key needs no more than its own glyph; a letter and a mouse action are named in the token. Atan2 is the one that sets its own colours — it prints readouts of its own, and the lower of them passes behind the legend, so its plate is opaque where the others let a little of the artwork through.

It is never drawn into a captured export. A still or a clip posted elsewhere cannot be typed at, so the instruction would be an untruth printed on the artwork.

What the exported clips carry instead is the cause. Each of the six replays a recorded gesture — a key held, a button clicked, a bob dragged, a pointer swept — and for a while the clips showed only the consequence: the wheel started turning on its own, the bob leapt unprompted. Now the hand is in the picture. Pointer-driven works draw an abstract dot at the position the scenario is driving, dark-cored and light-rimmed so it reads on white artworks and black ones alike, with a ring rippling out at the moment of a press; key-driven works draw the legend's own key-cap tokens, lit while the key is down. The distinction from the legend matters: these marks depict what the clip's scenario is actually doing, which is always true, where a legend would instruct a viewer who cannot comply, which is always false. Every mark is a pure function of the frame index the clips are already rendered from, so they stay deterministic. The page draws neither — the reader's own hand is on it — and the thumbnail draws the legend, because it is a picture of the page.

The gallery thumbnail is the other way about. It is a picture of a page that *can* be typed at, and a reader choosing which card to open should be able to see there is something to do there, so the thumbnail carries the hint — and carries it 1.7 times larger than the page does. That is the one thing in a thumbnail that is not to scale, and it is chrome rather than artwork: a card fits the canvas into an opening about 353 pixels wide, so both artworks arrive there at about two fifths of their size, and the page's own eighteen-point line would land at seven. A test pins the enlarged size to the range that survives the shrink without competing with the picture. The badge on artworks that move sits at the head of the frame for the same reason — at the foot it collided with the words, whichever corner it was pushed to, once a legend grew long enough.

The line sits at the bottom left rather than the bottom right because the artwork pages do not scale their canvas to the window — it is drawn at its own size and clipped — so on a narrow screen the right of the canvas is the part that disappears. It is set on a pale plate, which is close to invisible on a white artwork and is what makes the line readable on one that is not: Fibonacci Spiral opens on a saturated red rectangle reaching the foot of the canvas, where grey text alone could not be read.

### Where the motion comes from

The page's two timing constants are taken from the artworks rather than chosen by eye, which is also why it resembles no other gallery.

The reveal order is the golden angle: card `i` is delayed by the angle's position on the circle after `i` turns. This is the same rule that places the sites in Voronoi Bloom and the colonies in Reaction Diffusion Coral, and it is used here for the property those artworks rely on — the sequence never repeats and never clumps, so the cards arrive in an order that reads as neither a sweep nor a shuffle. A test asserts both halves of that: the delays are not sorted, and no gap between successive delays exceeds twice the average.

The durations are a ladder in the plastic ratio, the real root of `x³ = x + 1` that Harriss Spiral is built on. Each nested layer of a card moves for the previous layer's time divided by that ratio, so the frame settles before the card does and the label before the frame.

### The head in the masthead

The head looks towards the pointer. There are two of them: a drawing, which is what the page paints, and a model, which replaces it once the page has finished loading. Both are driven by the same three numbers.

`gallery/character.js` measures the pointer and writes `--look-x` and `--look-y` on the first `[data-character]` in the document, each running from -1 to 1, plus `--look-x-abs`. That is the whole interface. The stylesheet turns the drawing from those numbers; `gallery/character-3d.js` reads the same ones and turns the model. Neither knows anything about the other, and replacing either means honouring those numbers and nothing else.

The head follows the pointer wherever it is on the page, not only over the masthead. Neither version runs on a touch screen — `pointermove` fires there while dragging, and the head would lurch at the moment the reader is trying to scroll past it — or under `prefers-reduced-motion`, where the drawing rests exactly as it was drawn. A megabyte and a half of model is not fetched in either case.

**The drawing.** One layer of a picture, cut at the neck. Only its last twenty-fifth is masked away, so the collar and the knot of the tie are there and the picture stops in nothing rather than at the straight line it was cut along; the model's own fade is deeper, a seventh, because it has suit below the tie to dissolve where this has nothing; the mask is set on the image and not on the box around it, so the same transform carries it and the fade stays square to the drawing however far the head is turned. It turns through seven degrees, not the fifteen a real turn would take: this is one flat drawing, and past about eight the tilt stops reading as a head turning and starts reading as the whole portrait leaning. The narrowing carries the rest of the impression, since a face turning away is a face growing narrower.

**The model.** A glTF binary drawn with three.js, which is served from this site like every other dependency — the page carries an import map naming the local copies, and nothing is fetched from a content delivery network. The module is the only one on the page, and it waits for the `load` event before fetching anything: measured over seven runs each, first contentful paint is 48 ms with and without it, and three.js is requested after the load event rather than before it. If any step fails — no WebGL, a blocked module, a missing model — the drawing is simply left where it is. It is never removed from the document, only faded behind the canvas, so a lost context has something to fall back to.

The turn is about the neck rather than the model's own origin, which is down at the cut; the model hangs off a group placed at the neck and the group is what rotates. Thirty-four degrees at full extent is the three-quarter view, and it stops there deliberately: the back of the head is the part a photograph cannot tell a model about, so it is invented, and it looks it. The nod is a sixth of that. The camera is not positioned by hand but framed — the model is pulled back until it fills its share of the width and the camera raised until the crown sits where the drawing's does, so the two swap without the masthead shifting. It is pulled back far enough for the collar and the tie to be in shot: the tie is the one saturated thing on the figure, and it is what makes a turn read as a turn rather than as a head sliding sideways. Nothing is drawn while the masthead is off screen or the tab is in the background.

Right-clicking the head does nothing, and only the head: no other part of the gallery is touched. This asks rather than prevents. The picture is in the page and anyone who opens the developer tools has it — it is there because the likeness is the owner's, not because a browser can be stopped from showing what it has downloaded.

### Making the model small enough to serve

The model is generated from a photograph by an image-to-3D service and arrives at about 47 MB, which is not a thing to put on a web page. `scripts/reduce-model.mjs` turns it into under two megabytes by doing the two obvious things: throwing away what is never on screen, and sizing the textures to the screen they are drawn on.

```
node scripts/reduce-model.mjs <original.glb> gallery/character/head.glb
```

It needs ImageMagick (`magick`) for the textures. The original is not in this repository — only the reduced file is committed, and this script is how it is reproduced from a new export.

What it does, and what each step is worth:

| | before | after |
| --- | --- | --- |
| base colour | 8192², 33.7 MB | 1024², 224 kB |
| normal | 4096², 8.1 MB | 512², 12 kB |
| metallic-roughness | 4096², 1.8 MB | 256², 4 kB |
| vertices | 62,196 | 38,405 |
| triangles | 112,184 | 69,169 |
| file | 46.9 MB | 1.89 MB |

The export is a whole standing figure and the page shows a head, so every triangle below the chest goes; what survives is renumbered, which drops the vertices only those triangles used. That leaves few enough vertices for 16-bit indices, halving them. The cut is a fifth of a unit below the tie rather than at it, which costs about 330 kB and is what lets the stylesheet fade the foot of the frame over plain suit: a flat horizontal edge of geometry against nothing is a stair-stepped line wherever it is left in shot, and no amount of multisampling helps a boundary that is genuinely a straight cut. The textures are one scattered atlas shared with the discarded body, so they cannot be cropped, only scaled — but the head is drawn about 300 pixels wide, and a quarter of the source resolution still leaves more texels on the face than the display has pixels.

The remaining 1.9 MB is mostly geometry. Quantising the attributes under `KHR_mesh_quantization` would take perhaps another 500 kB off it. That is not done: the file is fetched after the page has loaded, only on a machine with a mouse, and the saving is not worth the extra machinery in a script that has to stay readable.

### What is adapted from yui540's css-animations

The gallery's motion has two layers, and they are independent: the timing layer above decides when a thing moves, and the shape layer below decides what the movement looks like.

The shape layer is adapted from [yui540's css-animations](https://github.com/yui540/css-animations), by yui540, under MIT, with the licence reproduced in [THIRD_PARTY_LICENSES](../THIRD_PARTY_LICENSES). No file is copied. What is taken is the shape of each movement — its keyframes, the relationship between its layers, and in several cases its easing curve — rewritten against this site's own markup, palette and timings. Each is named in a comment at the rule that carries it. Ten are used, and the ten below are all of them.

**The card's entrance**, from `popup` in `2026-04-17/tips-1.html`. A ball grows from nothing, overshoots, undershoots and settles, and the trick is that the two axes disagree — 1.2 against 1.25, then 0.9 against 0.95 — which reads as squash and stretch rather than as a zoom. Opacity finishes early so what is watched is the shape. Here it starts from 0.9 rather than 0 and overshoots by a few per cent rather than a fifth: a card carrying a picture should arrive, not bounce.

**The thumbnail's arrival**, from the paper-turning animation in `2026-04-17/tips-2.html`. A panel slides in while its top right corner un-rounds from a full quarter circle, over two durations that deliberately do not match, so the corner is still opening after the slide has landed — which is what makes it read as a sheet being turned rather than a box arriving. Here the entry is vertical only, where the original also slid sideways: these cards sit in a grid, and a diagonal entry fights the columns.

**The heading and the card titles**, from the lettering in the same file, which stands a character up from a squashed baseline — `scale(1.4, 0)` to `scale(1, 1)` about `bottom center`, so it is briefly wide and flat before it rises. Here it is widened by 6 per cent rather than 40. Theirs is one enormous character, where stretching it by two fifths is legible; a line of words widened that far is a smear.

**The curtain over the artworks**, from `2026-04-22/tips-2.html`. Two sheets, each half again as tall as the opening, swing away about their top corner rather than sliding flat — the slant is the whole of it, because a panel that leaves at an angle reads as cloth and one that leaves square reads as a wipe. A shadow deepens under the leading edge as it goes, then lifts. Here only the opening half is kept, the two greys become two weights of this page's own ground, and it covers the grid alone. A curtain over the whole page would put its own duration in front of the first thing a reader sees; over the artworks, the masthead is painted at once and the cards arrive behind the parting, which is what a gallery opening actually looks like. Both panels animate to a state they hold, so a browser that runs no script cannot be left with the grid covered.

**The shutter that closes as an artwork opens**, from `2026-04-22/tips-1.html`, whose blocks drop past their resting height and settle back — 15 to 75 to 73, an overshoot of a few per cent, which is what keeps it from reading as a blind being lowered evenly. Here the blocks fall in the golden-angle order the cards arrived in, and the navigation is queued the moment the click is taken over: 260 ms is what the animation gets, and it never decides when the page changes. A click carrying a modifier is left alone, because that is a request for a new tab.

**The underline under a link**, from `2026-04-29/tips-1.html`, where a stroke is laid down by lengthening its dash while thickening from under half its weight to full — the pressure of a pen being pushed, which is what separates it from a bar growing sideways. The stroke it runs along is not quite straight, for the same reason. Theirs then wipes the line away by running the dash off the far end; a pointer leaving has no animation to trigger in CSS, only a state to return from, so here the line retreats the way it came. On the colophon's links the plain underline fades out from under the drawn one, so a link still looks like a link before it is pointed at and there is never a moment with two.

**The quotation's rule**, from the scroll in `2026-04-25/tips-1.html`, where a roller travels along and the paper appears behind it: two things moving in step, one leaving the other, and the paper arrives by sliding in whole from the far end rather than by growing. The roller is not drawn here. There is no room for a rod above a line of type, and animating one across a box of unknown width costs a layout every frame. What is kept is the relationship — the rule slides in from the end, brighter at its leading edge, and the quotation follows out from under it. Every artwork on this site is paired with a quotation, so that is where the best of what was on offer went.

**The ring from a pressed card**, from `2026-04-25/tips-4.html`, where two rings grow from nothing and are already invisible at four fifths of the way out, so there is a beat of empty space between one and the next rather than a continuous pulse. Here it fires once, from wherever the card was pressed. A press starts a navigation, and until the page changes there is nothing to say the press was received.

**The mark on artworks that move**, from the orbit in `2026-05-02/tips-4.html`, where a small body circles a larger one and its own turn finishes at 80 per cent of the cycle, so it comes to rest for the last fifth before setting off again — that pause is what stops a loop from reading as a spinner. Here it is the badge itself. A mark that says an artwork moves may as well move, and this site's artworks are made of orbits and spirals. It makes one lap as the card arrives and only keeps going under the pointer: thirteen of the twenty-seven carry it, and thirteen things circling on their own is a page that will not sit still.

**The rule above the colophon**, from the painting-in of `2026-04-22/tips-3.html`, where lines of unequal length slide in from the same side one after another. The unevenness is the point: three equal bars arriving in order is a progress bar, and three unequal ones is a rule being laid down. Here they stay, where the original sends them out again, and they arrive when the foot of the page is reached rather than on a timer — it is the one rule on the page a reader scrolls towards, so it is the one that can afford to be drawn rather than simply be there.

Under `prefers-reduced-motion` all ten are switched off. Two of them are removed rather than shown still — the pressed ring and the curtain — because each is motion and nothing else, and a curtain that has not opened is simply a wall.

### Two things nobody is told about

Neither is announced. One is found by leaving the page alone, the other by going back to where you started.

**The head looks around when it is left alone.** After nine seconds without the pointer moving it stops waiting and starts choosing its own directions, holding each for a couple of seconds. Where it looks is the golden angle again — 137.5 degrees on from the last one, the same constant that orders the cards' arrival and places the sites in Voronoi Bloom. Stepping by it gives a sequence that never repeats and never clusters, so the wandering has no period to catch, and the one number this site is built on is doing the one thing on the page nobody was going to look for. Moving the pointer takes it back.

**Coming back to the top loads the arrival again.** The golden-angle order the cards appear in is spent in the first second and a half of a visit, and a reader still on the heading never sees it; scrolling back up and down again plays it a second time, without a reload.

Two lines guard it rather than one. The page has to have gone down past nine tenths of a screen before a return counts at all, and the return has to reach within 24 pixels of the top: a single line there would fire on every small wobble a trackpad makes. And only what is below the fold is put back. A card in front of the reader keeps what it has, because a card blinking out and arriving again in plain sight is not an entrance being replayed, it is a page flickering.

Neither runs under `prefers-reduced-motion`, where every card is simply present, and the first needs a pointer that can be still.

### Credits

The masthead's head, which follows the pointer, was inspired by [Ahmed Dahbi's personal site](https://dahbiahmed.com/). Nothing of it is used here — no code, no asset, no markup — only the idea of a head that watches where the reader is. Everything under the idea is this repository's own: the drawing, the model made from it, the framing, the turn, and the fall back to a picture when three dimensions are not available or not wanted.

The gallery's motion is adapted from yui540's css-animations, as described above and recorded in [THIRD_PARTY_LICENSES](../THIRD_PARTY_LICENSES) with the MIT licence it is offered under.

### Deploying

`.github/workflows/pages.yml` builds the site and, only when its `deploy` input is explicitly enabled, publishes it with `actions/deploy-pages`. It also builds on any pull request that touches `p5js/`, without deploying, which is what catches a broken gallery before anyone is looking at one.

The site is uploaded as a Pages artifact rather than committed to a branch, because everything in it is generated: an index built from the manifest, thumbnails, and a copy of the library. Committing that output would put rendered images in the history and leave the gallery able to disagree with the manifest it claims to come from.

GitHub Pages is not enabled on this repository, and the workflow cannot enable it. Turning it on, and making the repository public, are the owner's decisions.

### What the gallery does without JavaScript, and without motion

The entrance is an enhancement rather than a precondition. The stylesheet hides a card only under a `js` class that the page sets on itself before the first paint, so a browser that never runs the script shows every card instead of an empty page. Under `prefers-reduced-motion` the animations are switched off and everything is simply present.

The reveal compares positions on a throttled scroll rather than using an IntersectionObserver. An observer never reports a card that goes straight from below the viewport to above it — pressing End, following an anchor, or flinging the page — because its intersection ratio stays at zero and no threshold is crossed. That left cards permanently blank until they were scrolled back to: 10 of the then-25 revealed after a jump to the foot of the page, against all of them now. The listener stays for the life of the page rather than being dropped once the last card is out, because returning to the top is what loads the arrival again; the pass it costs is over a list that is empty most of the time.

All four behaviours are checked against the built site served under a `/generative-art/` prefix: no JavaScript, reduced motion, a 360 px viewport with no horizontal overflow, and a jump to the bottom.

Hiding the cards until the script reveals them is only safe while something is guaranteed to bring them back, so the page carries its own undo: if the gallery script has not reported for duty within a second and a half, the inline snippet drops the `js` class and every card is simply present. Blocking `gallery.js` outright and measuring gives every card visible. That covers a blocked or failed script, which the `js` class alone does not — a script that is absent and a script that is prevented from loading look the same to CSS.
