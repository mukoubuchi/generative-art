# p5.js artworks and daily post pipeline

This directory contains browser-native artworks and a headless pipeline that can render one artwork, pair it with a verified public-domain quotation, validate the post body, and optionally publish it to X.

Publishing is disabled by default. A normal run is a dry run, and the X API is called only when both `--publish` and `X_POSTING_ENABLED=true` are supplied.

## Artworks

| ID | Logical canvas | Export | Timing |
| --- | --- | --- | --- |
| `koch-curves` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, five eruptions, each faster |
| `recursive-pentagram` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, one nesting of the dive |
| `sierpinski-gasket` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, the skeleton, then the rain |
| `fibonacci-spiral` | 1010×640 | 2020×1280 MP4 at 30 fps | 10 seconds, taken down by ← and rebuilt by →; interactive page |
| `bounding-spots` | 960×480 | 1920×960 MP4 at 30 fps | 10 seconds, exactly one realignment of the ladder |
| `loader` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, five relayings of the one ring |
| `windmill` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, one afternoon of wind; interactive page |
| `atan2` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, one orbit of the probe; interactive page |
| `toggle-color-ball` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, one turn of the ring, four handovers |
| `pulse-button` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, three tolls; interactive page |
| `spring-polygon` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, one pull and the answer to it; interactive page |
| `nautilus` | 680×680 | 1360×1360 PNG | Static capture, animated page |
| `ammonite` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, one doubling of the shell |
| `herringbone` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, the weave laid, held, let go |
| `pinwheel` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, walls first, then the squares |
| `hex-triangle` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, five gatherings |
| `kanizsa-square` | 680×680 | 1360×1360 MP4 at 30 fps | 8.1 seconds, three turns of the machine's own cycle |
| `eyes-pattern` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, one lattice, then the eyes |
| `necker-cube` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, one rock and two readings; interactive page |
| `harriss-spiral` | 795×600 | 1590×1200 MP4 at 30 fps | 10 seconds, fifteen waves of the cascade |
| `reaction-diffusion-coral` | 680×680 | 1360×1360 PNG | Static |
| `truchet-tides` | 960×640 | 1920×1280 PNG | Static |
| `voronoi-bloom` | 800×640 | 1600×1280 PNG | Static |
| `flow-field` | 960×640 | 1920×1280 PNG | Static capture, interactive page |
| `strange-attractor` | 680×680 | 1360×1360 PNG | Static |
| `moebius-band` | 800×600 | 1600×1200 MP4 at 30 fps | 10 seconds, two laps of the marker, two turns of the stage |
| `ulam-spiral` | 680×680 | 1360×1360 PNG | Static capture, animated page |
| `hilbert-curve` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, degree one eased through degree six |
| `cafe-wall` | 960×640 | 1920×1280 MP4 at 30 fps | 10 seconds, each of the illusion's two levers pulled and put back |
| `dla-frost` | 680×680 | 1360×1360 PNG | Static capture, animated page |
| `circle-packing` | 680×680 | 1360×1360 PNG | Static capture, animated page |
| `moire-rings` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, out, once around, and home; interactive page |
| `lorenz-ribbon` | 800×600 | 1600×1200 MP4 at 30 fps | 10 seconds, both orbits grown and held |
| `platonic-duals` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, one dual cycle, ending where it began; interactive page |
| `thirty-spokes` | 680×680 | 1360×1360 MP4 at 30 fps | 10 seconds, one swing of the stirring each way |

Koch Curves, Recursive Pentagram and Sierpinski Gasket are inherently radial or square constructions, so square logical canvases preserve their symmetry. The 680 px display size follows the laptop-sized square established by the earlier artworks. A per-artwork export scale produces higher-resolution media without enlarging the interactive canvas.

Koch Curves is recreated around its own law: one angled substitution — four equal children over a peak of eighty-five degrees, joining the parent's endpoints exactly — repeated along every side of a square. At this angle each generation multiplies the rim by about 1.84, more than twentyfold over the clip, and the pacing makes the divergence felt: each generation's eruption takes six tenths of the time the last one took, an accelerando pinned geometric to within a frame. An eruption starts with every peak lying flat on its parent, at exactly the old perimeter, and raises them all at once to exactly the new one, each rising pair carrying a warm spark that cools into the standing ice. It is deliberately the opposite grammar to Hilbert Curve's: where that curve refines in stillness — held degrees, samples sliding along an unbroken arc, even pacing — this one folds outward, all its corners at once, in less and less time.

Recursive Pentagram is recreated as the dive its geometry always implied. Five chords make the star; the star's own crossings are intersected and the child pentagon is found rather than placed — turned half a step, smaller by exactly one over phi squared, both pinned against what the intersections return. The nest is invariant under that one zoom-and-turn, so the camera falls at a constant rate and arrives, after a single nesting, exactly where it began: every star on its parent's radius and bearing, the loop sealed without a seam, the centre being approached revealed as the whole being left — Pascal's sentence as the picture's structure. Ink width and the fade at the bottomless centre are keyed to screen radius, since only self-similar rules can let the loop close.

Sierpinski Gasket keeps its seven generations and 1093 triangles, and its recreation stages two constructions that never mention each other. First the skeleton is built level by level, three half-size triangles ringing every parent; then the chaos game rains — a wanderer jumping halfway to a random corner, its trail drawn where it lands — and the ember rain fills exactly the steel lace, because it cannot land anywhere else. The agreement is pinned, not narrated: five hundred seeded raindrops each follow the tree to its bottom level (or within one, on a shared edge), while uniform rain over the box is orphaned by the third level more often than not. The dimension is measured from the construction — triangles triple as the radius halves — and the figure's envelope is centred as the shells' are.

Fibonacci Spiral is recreated as the convergence it is named for. The tiling is integers now: fifteen rectangles from 987 by 610 units down to 1 by 1, every side a Fibonacci number, each square split off with no remainder anywhere because that is what the recurrence says in carpentry — pinned with strict equality, not tolerance. Each section carries its convergent F(n+1)/F(n), and the tests hold the walk: the ratios close on phi from alternate sides, the error shrinking by phi squared each step, the root's own aspect missing phi by about one part in a million. Colour is the convergence — rough inner ratios in ember, sections all but arrived in gold, so adding a section visibly gilds the spiral — and the exact golden rectangle stays as a faint skeleton: covered to sub-pixel exactness while the tiling stands, and revealed as the limit the integers were building toward whenever the left arrow takes them down.

Its page keeps the original arrow-key interaction: Right Arrow adds a section, Left Arrow removes the newest one. The page says so on the canvas, at its foot. The Processing sketch never cleared its background, so Left Arrow dropped a rectangle from the list without erasing it; the port redraws the whole list each time, which makes removal visible.

The captured clip is those keys at work. It opens on the finished spiral and holds it — the first frame is what X shows as the clip's still, so the strongest picture stands at the door — then the left arrow takes the sections down one press at a time to the first rectangle, and the right arrow builds them back. Both key-caps are drawn in the clip and light as they are pressed. The spiral is subdivided until a rectangle's short side falls below half an output pixel, which comes to fifteen sections, and a test ties the clip's declared duration to that count so the two cannot drift apart.

There is a small asymmetry in what the two halves of the clip show. Removal happens on a cleared and redrawn canvas — the correction above — so the take-down the clip records is the port's behaviour, not the original's ghost-leaving one.

Bounding Spots keeps the Processing sketch's 2:1 canvas and its twenty nested half circles, and changes one thing: the cadences. They were the reciprocals of an arithmetic sequence, which never brings the twenty home together; they are now an arithmetic ladder — the widest arc completes one oscillation while the clip runs, the next two, the next three, down to twenty for the innermost — with the fastest and slowest ends of the range exactly where the original left them. That single decision is the whole artwork. The travelling wave, the twist into many arms, the moment of pure disorder and the snap back into one line are choreographed nowhere; they are what an arithmetic ladder does, and the module only says where each spot is.

Because the ladder is integers, so are the phases. A spot's position is read from a whole number of steps into its own oscillation, and the division into turns happens last, for the drawing alone — so the artwork's claims are equalities rather than measurements with a tolerance. The ensemble stands together at the closing step and at no step before it. Halfway through, the twenty stand alternately at the two ends of their arcs, exactly. And every moment of visible order in between is accounted for by one line: at step s the spots fall into exactly as many ranks as the period has over its common divisor with s, or into twenty when that would be more spots than there are — which is why the famous two, three, four and five-rank instants of a pendulum wave arrive when they do. The tests hold that at all six hundred steps of the period, and record that the ordered instants are the rare ones: nine tenths of the clip is twenty separate phases.

The clip's length is not chosen either. The module computes when the ladder realigns, by the least common multiple of the spots' own return times, and the sketch takes its length from that answer, so the loop closes because the arithmetic closes. The sweep is a pendulum's rather than a constant sweep — cosine in the phase, so a spot dwells at the ends of its arc, which is where the trail gathers into bright caps on the rail. Colour is the arc a spot rides: gold at the quick centre through to blue at the slow rim.

The trail is still one dot per simulation step over a wash, but the wash is a tenth of the original's, and that number decides what the artwork is about: painted faintly, every arc fills in and the live wave is lost inside twenty solid domes; painted at a tenth, each spot keeps a comet of its last dozen steps and what the eye reads is the ensemble's present shape. Because the wash means a frame depends on the frames before it, the sketch runs one silent period before the first frame: the wash forgets a blank opening canvas within a few dozen steps, so the trails the first frame carries are the ones the last frame leaves, and the loop closes in the picture as exactly as it closes in the arithmetic.

Loader is the first of the recreated artworks. The mechanism is the indicator it always was — the leading end runs 300 degrees ahead, the trailing end closes the gap easing off as it arrives, the whole figure spins — and the recreation adds one exact relationship between those motions: over a cycle the arc's own offsets advance 300 degrees and the spin adds 60, one whole turn, so each cycle lays the ring exactly once and lays it exactly on the ring the cycle before it laid. However long the machine labours, the picture never changes, which is what the artwork's own verse says of the sun. The tests measure the cycle from the machine — sixty growing steps, sixty closing — assert the retrace at every phase of the cycle, and hold that no point of the ring is ever older than the cycle that just relaid it.

The clip keeps that past visible. Every point of the ring is lit by how recently the arc last passed it, and the moment of passing is placed by interpolating the trailing end's travel within its step, so the fade is as continuous as the motion that made it — sampled coverage would age the track in step-wide blocks and miss the sliver-thin windows near the moment the arc closes. The ages stay exact; the paint alone is then smoothed by a three-degree kernel along the track, because a fade whose slope snaps at each machine step reads as faint spokes at close range. The kernel runs along the track only and clamps at its ends, so the frontier where the oldest light meets the live arc stays a knife edge. What stands just ahead of the bright arc is always its own previous pass, one cycle old, about to be repainted; the clip opens mid-growth on exactly that frontier and closes back onto it five cycles later. The indicator's proportions are the classical ones the artwork has always had: stroke 2/5 of the outer radius, centre line 4/5, the figure 4/10 of the canvas.

Windmill was a wheel that a key wound up at a fixed rate and a cap held back, and is recreated as a mill with real weather on it. Nothing commands the wheel now. The sails feel the wind less their own tip speed and push with a thrust quadratic in what is left; the bearing takes a viscous toll; and a dry friction holds the mill where it stands until the wind is worth more than the friction — the breakaway, which is why the thing sleeps through a breeze and the tests exercise from both sides of the threshold. That balance is integrated with the same fourth-order stepper the Lorenz artwork uses, at a fixed sixtieth of a second, and the wind is seeded value noise wandering between a lull and a gale, so the whole afternoon is reproducible to the bit: the tests measure the stepper's order, hold the gusts inside their range and to a bounded rate of change, and require the track to retrace itself for its own seed and to differ for any other.

Holding K raises the wind rather than the wheel, and the clip is one afternoon of it — a calm, the wind coming up and holding, then falling away, and the mill running down against friction until it stops truly, at a step the tests locate. It does not creep afterwards, because the stiction that held it asleep holds it again. Under a steady gale the simulation settles onto the speed where thrust and loss agree, which the tests find independently by bisection rather than read off the run. The seed is a design choice like a palette: it was searched so that the clip turns the mill three revolutions to within a third of a milliradian — a tenth of a pixel at the sail tips — so the four sails' own quarter-turn symmetry closes the loop on the silhouette it opened with, the mill at rest at both doors.

The figure is the original's and stays that way: four black triangles on white, each the previous one turned a quarter, reaching four tenths of the canvas. It was built up once into a tower and cap against a dusk sky, with lattice sails and the wind drawn as streaks, and that was the wrong place to spend the work — none of it made the breakaway, the balance or the true stop any easier to see, and all of it made the picture busier than what it is about. The wheel's four-fold symmetry is the one part of the figure the artwork's claims lean on, since it is what lets three revolutions close the loop, and it is the part the tests keep.

Atan2 was a single diagram — one point, its angle read out — and is recreated as a field that asks the diagram's question from everywhere. Two hundred needles each point from their own foot to the probe and wear the answer as colour: gold for positive angles, steel for negative, deeper the further from zero. The two families meet twice, and differently, and that difference is the artwork. At zero they cross smoothly through a shared neutral; at half a turn they collide at full depth, and the collision is not scattered anywhere but lies exactly on the ray due east of the probe — the one direction whose answer cannot decide its sign. No needle computes the seam. The line is where honest answers disagree, and the tests hold it to that: a walk around the probe meets exactly one jump, a whole turn wide, due east, while the western ray crosses zero with no jump at all. The centre needle keeps the original's diagram around itself — the journey divided into its two legs, the arc between them, the answer printed to fixed decimals — so the recreation still explains what every needle is doing. The capture orbits the probe once, carrying the seam across every row it can reach; on the page the probe is the pointer.

Toggle Color Ball kept a table. The Processing sketch listed which disc came forward in each quarter of its counter — the third one was the yellow, out of order — and turned the whole group a quarter turn to suit. A table is a claim nobody can check, and there was nothing in the picture that made one disc belong in front of another, because all four sat at the same distance and simply swung in and out together.

The recreation puts them on a ring and asks. Four discs ride a ring leaned back from edge-on, the near side low and the far side high; a disc's depth is where it is on that ring, and what covers what is decided by sorting on it, every frame. Nothing lists an order. The front changes hands wherever two discs are equally far away, and the module finds those moments rather than stating them: it walks the turn, notices where the nearest disc stops being the same disc, and bisects. The answer comes back as forty-five degrees past each quarter — an eighth of a turn, to the last decimal a double can hold, and a whole number of simulation steps, so no frame straddles a handover. Distance is drawn as well as sorted: the eye stands three and a half ring radii away, which makes the near disc about three halves the size of the far one, a ratio the tests measure rather than choose.

The alternation the artwork is named for then comes out of the arrangement. The discs are laid alternately around the ring — warm, cool, warm, cool — and a disc can only be overtaken by the one beside it, so whatever comes forward is always the opposite kind to what came forward last. One yin, one yang: the sentence from the Book of Changes is the ring's own structure rather than a rule applied to it once a quarter, and the tests hold the alternation without any of the code enforcing it. The clip is one whole turn, so it closes on the arrangement it opened with, and the discs still run past the canvas edge as they did in the original, where that full-bleed crop was the composition rather than an accident of the canvas size.

Temple Bell was Pulse Button — a click study in which a disc swelled and faded — and is recreated as what its own quotation describes: a bell struck in the dark, the sound already passing. A strike makes one wavefront that leaves the bell's rim at a fixed speed, and everything that fades — the front's light, the bell's afterglow, the breath of swell the strike gives the body — follows the one exponential law, which the tests pin as a law rather than as pixels: equal intervals of time take equal fractions of what remains. The horizon past which a ring is dropped is proved to lose nothing an 8-bit channel could show, and just before each next toll the last is measured nearly gone — the quotation's second clause as arithmetic. The clip is three tolls. It opens on the faint remnant of a toll it never sounded and closes as another fades, so the passing has neither a first frame nor a last; clicking the bell on the page tolls it, and tolls can overlap, as bells do.

Spring Polygon was five bobs on stretched springs that jostled and never quite stopped, and is recreated as the sentence it was given: stir one, and the rest are troubled. The mechanics are rebuilt for that claim to be measurable. Five masses ring a pentagon of springs, each staked to an anchor three radii out, damped by a viscous drag on velocity, and integrated as one twenty-dimensional system by the same fourth-order stepper at a fixed sixtieth of a second — no per-step velocity multiplier, no collision impulses, nothing that quietly adds or removes energy. Every rest length is the distance the figure opens with, so the opening pentagon is a true equilibrium: the tests find the net force zero everywhere, the energy exactly nothing, and the figure motionless if it is left alone. Whatever the clip shows afterwards is therefore the hand's doing and nobody else's.

What the drawing paints is that energy. Each star carries its own share — its motion, half of each ring spring it ends, all of its own stake — and the shares sum to the system's whole, which the tests hold as an identity rather than a rounding. The share sets the glow, on a logarithmic scale whose top is the scenario's own brightest instant, and the colour says which form the energy is in: amber while it is strain in stretched springs, ice-blue while it is motion. So the pull arrives as a swelling gold, snaps blue at the moment of release, and travels the ring as a wave of colour that is the physics rather than a decoration of it.

The propagation is pinned as propagation. A kick from perfect rest reaches the two near stars before the two far ones — a signal speed, measured in steps — and because the clip's pull runs straight up the figure's own axis of symmetry, the two sides answer as exact mirror images, which the tests check at every step of the fold. The damping then drains every mode at one rate, so the whole system's energy falls on a single exponential: successive two-second windows each keep the same fraction of what is left, within a few parts in a hundred of the law. That constant is the artwork's one tuned number, chosen so the ring is still answering for most of the clip yet has settled under the drawing's own rest threshold before the end — so the last frame is as dark as the first and the loop closes on the quiet it opened in.

Nautilus keeps the shrink schedule it has always had — steps of 5/200 of the start radius at the rim easing to 0.1/200 at the centre, 158 chambers, ten degrees each — and is recreated around the order the animal lived it: smallest room first, each outgrowing the last, which the tests pin as a strictly rising radius from under a hundredth of the start to the whole of it. Colour is age, paced by the room's own size rather than its ordinal — the first eighty rooms fit inside a coin, so a palette walked by ordinal would spend half its colours where the eye cannot follow — and it runs abyss teal through sea glass and sand to pearl for the great chambers.

The walls are a translucent whisper of their age colour. Every chamber shares the anchor corner, so at the pole all hundred and fifty-eight walls stack and the whisper accumulates into the shell's luminous heart; the rims are painted over them all in a second pass, because rims painted with their own walls end up buried under the rooms built later, and the oldest teal edge should stay as legible as the newest pearl one. The page builds the shell chamber by chamber — the building is the poem — and the capture takes it finished. The envelope centring is unchanged: the anchor is nowhere near the middle of the figure, so what is centred is the measured bounding box, filling 88 per cent of the shorter side.

Ammonite keeps its construction — bands of a triangle strip, each sweeping one turn while its radius runs linearly to twice itself, each band starting where the last ended, sampled every twelve degrees, the triangles built explicitly so nothing depends on how a renderer treats strip mode — and is recreated as the loop that construction always implied. Doubling every coordinate of a band gives the next band exactly, vertex for vertex, and multiplying by two only moves a float's exponent, so a test asserts the identity to the last bit. The clip pulls the camera back by one doubling over its ten seconds: every whorl slides into its elder's place, a new greatest whorl swings in from beyond the rim — which is where an ammonite does its growing — and the last frame is the first.

Underneath the bands lies the smooth law they sample, r(θ) = 2^(θ/2π), for which scaling is rotation — s · r(θ) = r(θ + 2π · log₂ s), pinned as the artwork's identity — so the retreat reads as one slow turn of the shell though nothing rotates anywhere in the code. Everything the amber ink does is keyed to distance from the pole on screen: line width, and the fade that stands in for the bottomless regress of ever-smaller whorls at the centre. Only rules that are themselves self-similar can let one loop's end coincide with the next one's start, and the tests hold the generation range, the coverage past the corner, and the closure shifted by exactly one generation.

Herringbone works in grid units as it always has — ten across, tiles three units long, runs four apart, each drifting one unit per row — and is recreated as the laying of the weave those numbers describe. Sixty tiles, thirty of each direction, arrive along one diagonal sweep, every plank driven in along its own axis beside the crosswise planks it locks with. The tests pin the laying as total, deterministic and never retreating, and hold that every quarter of it carries both directions: the harmony is of opposites arriving together, never of one family finished before the other begins. Warm ochre runs one way and cool slate the other, on a dark loom in place of the default grey the port used to state; the weave holds whole for a stretch, then lets go, so the clip loops back to the empty loom it began on.

Pinwheel keeps its three changed constants — runs five apart, drifts of two and three — and its recreation begins by not knowing where the squares are. The construction mentions only tiles. The paving of large and small squares is what the plane is left divided into, so the module floods the plan the tiles wall off and finds the regions; every region comes out a square of side two or of side one, and the tests assert the two sizes, the fullness of every square, and that no cell is claimed twice. The clip lays the walls first, quickly, then seats the squares one by one along the sweep — terracotta for the large family, gold for the small, each in the place the construction left for it, which is the artwork's sentence from Augustine made procedural. The sand-pale walls stay legible over the fills as the paving's joints; the whole holds, then returns to bare ground.

The Processing sketch called this one HerringboneSquare, after the construction it shares with its sibling. The result is not a herringbone, though — it is squares of two sizes in rotation, which paving calls a pinwheel, and the recreation takes the name of the figure rather than of the method.

Hex Triangle keeps the Processing sketch's two triangular paths, its six triangles, and the sixth of a turn between the paths that points their triangles opposite ways and makes the hexagram — and its recreation finds out what the walk was for. Halfway along every walk the six arrive: they close into one regular hexagon, exactly. Each triangle brings one vertex to the centre and two to the hexagon's corners, where they are shared pairwise with its neighbours, so the twelve outer vertices stand on a circle of exactly sin sixty of the path radius — three quarters of the hexagon radius the whole figure is built from — at exactly six bearings sixty degrees apart. That is the classical dissection of a hexagon into six equilateral triangles, and it is the artwork's line from the Timaeus — one figure come to be out of six in number — arrived at rather than drawn. The tests hold every part of it, and hold as well that the six never overlap anywhere in the walk, because a closing that was a pile rather than a tiling would leave the hexagon a coincidence of outlines.

Colour is that arrival. It keys to how gathered the six are, which is a distance the module measures rather than a number handed to each triangle: a walk carries a triangle from a corner at the full path radius to the midpoint of an edge at exactly half of it, the inradius of an equilateral triangle being half its circumradius. So the figure stands dark, in violet and steel, when it is open as a hexagram, and is lit amber and aqua at the moment it is one shape. The six are identical; what changes is only how close they have come, and that is the one thing the palette is allowed to know.

The loop closes for a reason worth stating plainly. At the end of a cycle each triangle stands on the corner its neighbour started from, and the next cycle puts it back at its own — a jump for the triangle and none at all for the picture, because the six places are the same six places and the triangles of a family cannot be told apart. The clip is five gatherings in exactly ten seconds: the original advanced by 0.05 radians a frame, which put 125.66 steps in a walk and never closed, and a whole 120 both loops seamlessly and fills the clip, at a twentieth more speed than the original ran.

Its path radius comes from an expression that did not mean what it looks like. The sketch computed `(1 + 1/2) * hexagonRadius * sin(PI/3)`, but in Java that `1/2` is integer division, so the factor was 1 rather than 1.5. The value it actually produced is what makes the figure fit — at 1.5 the triangles would reach a third of the way past the canvas edge — so the port keeps the effective radius and drops the expression. A test pins that the figure fits at 1 and would not at 1.5.

The sketch also advanced a second angle every frame that only a commented-out `rotate` ever read. It does not survive the port.

Kanizsa Square is recreated so that the square cannot be drawn. Everything the module emits is a wedge — a disc with a bite taken out of it — and there is no line in its vocabulary and no polygon, so the sketch has nothing it could stroke an edge with. The tests hold that at every step of the clip: while the figure is only implying, there are four marks and all four are wedges, and the one mark that is not a wedge arrives in its own kind and is counted. Whatever closes those four bites into a square is therefore guaranteed to be the viewer's, which is what the figure has always claimed and what a picture can now be checked for.

What is really on the canvas can be said exactly. Each bite's two straight edges lie along the two sides of the square that meet at that corner, so every side carries a real segment at each end and nothing whatever in between. The tests walk the sides and ask, at each point, whether there is ink on one side of the line, on both, or on neither — an eye can only see an edge where exactly one side is inked — and find that away from the corners there is no ink within reach at all. The contour reported there is not a faint mark; it is nothing. A side never runs through ink either: it bounds a bite or lies in the blank.

That survey also settles how much of the square is real, and it is not a number anyone chose. The discs sit a quarter of the canvas from the middle and are a third of the canvas across, so each side of the square carries one bite edge from each of its two corners and the inked share works out at 0.943 — the sides are almost entirely real, with a fourteen-pixel gap in the middle of each that no ink comes near. The picture's own survey is held to the figure's proportions rather than to a value written beside them. This is a strongly supported figure, then, and it is worth being exact about which part of it is illusory: not the corners, which are real ink and most of each side, but the fourteen pixels in the middle that close over nothing at all, and the surface they enclose, which is a brightness the page does not have.

The motion is the original's and is left alone. The whole group of inducers turns one way while every mouth turns four times the other, so relative to the square a mouth travels a full turn over the state: alignment is destroyed in the middle — the surveyed contour falls from 0.94 to under a twentieth while not one disc has moved or changed size — and is restored exactly at the end, which the tests check by comparing the marks rather than the angles. Then the figure owns up. The mouths fill in, so the inducers become plain discs and nothing is implying anything any more, and the quadrilateral the bites had been describing is drawn for real on the same four centres, pulling away from them at twice the rate either one moves.

Whether that square is there at all is meant to be hard to catch, and two things do the hiding. A square maps onto itself at a quarter turn, and the reveal's relative rotation runs from nought to a half turn, so the drawn quadrilateral lies exactly on the illusory one both as it arrives and as it goes — its position never gives it away. And it is faded rather than switched, up through the whole resting state before the reveal and down through the whole one after, so no single frame is the one where it appeared. What is left to give it away is only the fill, which is painted at the brightness the square was already being seen at: a Kanizsa surface looks lighter than the ground it is cut from, and there is no measurement that fixes how much lighter, so that lift is a chosen number and the boundary it makes is a difference of lightness with no outline anywhere.

Twelve steps spread across the four states were rendered at the original's own placement and compared with the Processing frames pixel by pixel. Each differs by under 0.05 of a grey level on average, with no pixel flipped between black and white. That was worth checking because of one detail: the original turned the coordinate system again between placing the discs and closing the quadrilateral, and whether that turn reached the shape decided whether the square pulls away from the discs or stays pinned to them. It reaches it, and the square turns at twice the rate of either.

Eyes Pattern still draws nothing but circles, and for a third of the clip there are no eyes at all. The integer lattice ripples out from the centre and stands tangent — within one family the closest circles just touch, at exactly one diameter, so every circle is sealed — and only when the second lattice arrives on the half points do the lenses open: sixteen arriving circles each cut four with their neighbours, sixty-four eyes, none of them drawn. The tests count the eyes rather than admire them, and pin the tangency that makes a lone family eyeless. Cream for the first family, gold for the second, on the indigo the shippō tradition dyes its cloth — the lattice is the tiling Japanese pattern books call *shippō tsunagi*, and the artwork keeps the original sketch's name for it. The pattern holds, then lets go for the loop.

Necker Cube is a real cube now, turned in three dimensions and flattened by throwing depth away — and throwing depth away is exactly what makes the drawing ambiguous. The ambiguity has a precise form. Reflecting a scene front to back leaves every projected point where it was; it also turns a rotation into its opposite and a lean towards the eye into a lean away, and it carries each corner to the one behind it. So the other world casting this same shadow is this cube turning the other way, seen from the other side, with its front and back corners exchanged. The tests hold that as an identity rather than a resemblance: corner for corner, the two shadows are the same numbers, compared with strict equality and not a tolerance.

What the two readings do disagree about is which face is nearest, and that is the only thing the drawing is allowed to show when it declares one. The wireframe is a function of how far round the cube stands and of nothing else — there is no reading to pass it — so a declaration cannot quietly redraw the figure it claims only to be interpreting. The clip states one reading, lets it go, states the other, and lets that go too, tinting the near face warm for the first and cool for the second while the lines themselves never move. The tests check that the two readings never once agree on which face that is.

The cube rocks about a corner-on view rather than turning all the way round. A whole turn passes four times through a face-on view, where four faces project to lines and there is no near corner to read either way; rocking a twentieth of a turn either side keeps the figure a Necker cube at every frame, and the smallest face on the wall never falls below a third of a full one. The step is wrapped into the clip before the rock's sine is taken, so the closing frame is the opening one exactly rather than to within the last bit of a sine of two pi. On the page the pointer still rocks the cube through the same span, and pressing declares a reading — first one, then the other, then neither — so a reader can hold the cube whichever way round they like instead of waiting to be told.

The figure repeats every quarter turn, which is the cube's own symmetry rather than a fault in the sampling, and a test pins it. Between those positions the cube flattens to a plain rectangle divided in three, which is the moment a face comes square to the viewer.

The original relied on `QUAD_STRIP`; the port builds the four quads from the strip explicitly, so the drawing does not depend on how a renderer treats the strip mode. Rendered at the original's own placement, seven pointer positions differ from the Processing frames by about 0.3 of a grey level each. The one deliberate change is the anchor: every far corner trails one radius behind its near corner, so the envelope of the whole rotation reaches a radius further one way than the other, and the original's anchor left the figure a little above centre. The port measures that envelope and centres it.

The Processing sketch was called SpinCube. What it draws is the classical reversible figure, so the port takes its established name.

Harriss Spiral keeps its construction unchanged — a rectangle in the plastic ratio splits into one square and two smaller rectangles of the same proportion, both children recursing, the identity rho^3 = rho + 1 checked on all 405 subdivisions — and is recreated as the cascade watched happening. One wave per generation: a cell's partition lines appear, then its arc sweeps through the square just cut, the waves arriving a settled share faster each time and landing exactly on the build's frame budget. Generation is read off each cell's own size — the large branch divides by one power of rho and the small by three, so every cell's short side is the root's over an exact integer power, a theorem the tests hold to nine decimals — and each generation wears its own step of a garden gradient, deep moss at the root to pale spring at the leaves, which is the artwork's sentence from Leibniz made visible.

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

Hilbert Curve holds each degree of the curve and then eases it into the next. The morph is a correspondence rather than a crossfade: both curves are sampled at the same four thousand and ninety-six parameters of their arc — as many as the finest curve has vertices, so degree six is drawn exactly — and each sample slides to where its own moment of the walk now lives. The line is never cut, which is the point; it visibly grows room for the detail it is about to have. Koch Curves refines a line too, so this artwork's protagonists are deliberately the other two facts, pinned by test across every degree shown: the curve visits every cell of its grid exactly once, and consecutive cells are always edge-neighbours, even across the quadrant seams the bit-recursion glues.

The line is coloured by its own parameter, warm gold to cool steel, and the gradient is the locality made visible: it lies in orderly bands on the page because points close along the line stay close in the square at every degree — a shuffled visit of the same cells would scatter it into confetti. The clip's schedule — five morphs between six degrees, each eased with the cubic that starts and ends without a kick — lands exactly on the clip's three hundred frames, and the thumbnail is taken on a hold, where a degree stands finished.

Café Wall is the illusion with its two levers pulled one at a time. Rows of alternating tiles read as wedges when two things hold at once: alternate courses sit about half a tile out of phase, and the mortar lines between them carry a luminance between the tiles' own. The clip starts with the offset at zero — vertical stripes, nothing to see — builds it to the half tile where the wedges are strongest, and then kills the illusion twice, once each way. First the mortar alone is lightened until it vanishes into the light tiles and the courses flatten, with the geometry frozen; brought back, the wedges return. Then the offset slides on to a whole tile, where the checkerboard's own symmetry kills the illusion with the mortar untouched — and on to two tiles, which the two-tile pattern cannot tell from zero, so the loop closes on its opening frame.

The figure was first described by Hugo Münsterberg in 1897 as the shifted chequerboard, half a century before the café in Bristol lent it the modern name. What the tests pin is the dissection: each parameter's sweep happens while the other provably holds still, the checkerboard moment is actually crossed, and the courses' vertical positions come from a layout function that cannot even be asked about a frame — the lines the illusion bends are horizontal by construction, every frame of the clip.

DLA Frost grows six thousand walkers into a crystal. Each wanders in from outside the cluster — leaping the empty distance while far away, stepping the lattice when near — and freezes at the first cell where it touches something already frozen. Nothing chooses the shape: the branches are the shadow the tips cast, since a wanderer is far more likely to meet the outermost points than to thread a fjord to the interior. The tests measure that openness instead of admiring it — the reach is more than twice a solid disc's radius for the same cell count, the inner third is more than twice as dense as the outer, and the last-arrived tenth lands, on average, three times as far out as the first — along with the growth's honesty: same seed, same crystal, byte for byte; every particle adjacent to an earlier one; one particle per cell.

Colour is age, glacial depths at the heart to a pale growing edge, so the crystal wears its own history as its light. The page grows it in arrival order, because the growth is the phenomenon; the capture takes the finished pane. A grown thing is not obliged to grow symmetrically, so as with the shells and the cube it is the figure's envelope that is centred, and the cell size gives way only if a seed's particular reach would not otherwise fit the margins.

Circle Packing throws thirty thousand darts at a square and keeps what fits: each dart grows the largest circle its landing allows — found exactly, as the least of its distances to the walls and to every rim already placed, rather than by trial inflation — and a dart whose largest is below the minimum is discarded. Nothing chooses the hierarchy. The early circles claim the open country, the late ones make do with the gaps between gaps, and colouring by arrival shows it: ember giants first, near-white grains last, the packing wearing its own clock the way the frost does. The tests hold the two constraints with the packer's exact margin, and one thing more: every circle is flush against whatever stopped it — a wall, an earlier neighbour, or the size cap — so no room is left on the table.

Moiré Rings draws two families of concentric rings, one fixed to the canvas, one carried by the pointer, and computes no interference whatsoever. The fringes that sweep the picture as the centres part are the beat between the two gratings, and they are hyperbolas — the locus of constant difference of distances to two foci — which is the same figure two wave sources cast. The pattern coarsens as the centres approach and vanishes when they coincide, so the capture begins and ends there: it slides the wandering centre out, carries it once around its fixed twin, and brings it home, the abstract dot of the shared indicator riding exactly where the hand would be. The tests pin what the fringes emerge from rather than the fringes themselves: ring families deep enough to have no visible edge from anywhere on the canvas, a journey that never steps further than a ring spacing per frame, and the two-regime geometry of the difference of distances the hyperbolas live on.

Lorenz Ribbons integrates Lorenz's three equations with fourth-order Runge-Kutta and lets two orbits run from starts one part in ten thousand apart, closer than any pixel will show. The clip grows both ribbons side by side: together through the first turns — the braid alternating gold and steel where they overlap — then parting onto different wings for good. Nothing in the code is random; the parting is the equations' own. The stepper's order is measured (halving the step cuts the local error thirty-two-fold), Lorenz's equilibria are checked to be exactly fixed, the orbit is held to the attractor's bounded box, and the separation is measured as the artwork's whole claim: still within a hundredth two time units in, a sustained macroscopic gulf across the closing stretch. The ribbons are shaded by height alone, and their side vectors stay level, so each banks like a road and the figure's depth reads without any lighting machinery.

Platonic Duals closes its loop on a proposition of Hypsicles'. Dualizing a solid — putting a vertex at the centre of every face — carries the icosahedron to the dodecahedron and back, and the sizes are taken from that operation rather than from anyone's bookkeeping: from circumradius one, one dualization lands the dual at the original's inradius, so two land the icosahedron on itself, smaller by the square of the ratio both solids share. That the ratio is shared at all is the proposition, and it is what makes the nesting one geometric sequence instead of two — the same circle circumscribes the dodecahedron's pentagon and the icosahedron's triangle when both are inscribed in a single sphere, so inradius over circumradius is one number, 0.79465…, for either solid. The camera closes in at exactly that number squared over the clip, and the stage turns a fifth of a turn about the vertical five-fold axis, so the last frame is the first: same figure, same bearing, one dual cycle deeper. Nothing is patched at the seam; it closes because the two dualizations shrink by the same ratio.

What the clip shows is that operation caught in the act. Each solid in turn ignites a spark at the centre of every face, and the sparks are already the next solid's corners — so when its edges close around them, nothing has been constructed, only named, and the old solid thins to a ghost and goes. Everything is drawn as crystal, translucent faces with the depth test off and layered inner to outer, because nested convex solids cannot share a depth buffer without one of them losing, and the nesting is the whole point. On the page a drag turns the stage under the motion it already has. The proposition is quoted as it stands in Book XIV, whose text says in the next breath that Aristaeus had written it before, in a book called the Comparison of the Five Figures.

Thirty Spokes is the first artwork here to have started from a saying rather than from a theorem. Laozi's eleventh chapter says that thirty spokes share one hub and it is the hole that gives the cart its use; the chapter is about usefulness and makes no claim about curves, and what is drawn is a claim about curves that happens to turn on the same hole. A closed curve that avoids the hub has a winding number — how many times it goes round — and that number is an integer no deformation can shift, so a loop threaded through a wheel is caught on it for good. The quotation is where the work began, and is not its authority.

Nothing here declares how often a loop winds. Seven loops are seeded noise, generated from random centres and radii and kept only if they clear the hub, and each one's number is measured off it before anything moves — twice, by two calculations with no arithmetic in common. Counting signed crossings of a ray from the centre is integer work; adding up the angle turned about the centre is not; they are held to each other at every step of the clip and never differ by more than a part in a quadrillion. The colour is that measured number: warm for loops caught one way round, cool for the other, deeper for the ones caught twice, and bare white for the loop that encloses nothing at all, which is the only one the wheel has no hold over.

That the numbers are measured and not declared is a claim worth being careful about, because it is easy to write a generator that gives itself away. The seed does draw each loop a direction and a number of laps to make about its own centre; if the curve were then a star about a fixed centre it would enclose every interior point exactly once per lap, the winding number could only come out as the lap count or nought, and the measurement would be theatre. So the centre drifts as the curve is drawn, one cycle over the whole curve however many laps that is, and the second lap is laid over ground the first one missed. One of these seven shows what that buys: it goes round twice, crosses itself once, and the hub falls inside one of its lobes and outside the other, so its number is one — neither its lap count nor nought, and warm rather than deep. Being caught twice and going round twice are different things, and the picture has to be able to tell them apart before the colours mean anything.

The stirring is built so that it cannot change any of them, which is why the invariance is structural rather than lucky. Each step is a twist that turns every point about the centre by an amount depending only on its distance — so no distance changes — followed by a breathing that scales each point's distance *from the hub's rim* by a strictly positive number, so a point outside stays outside. Neither can carry a curve across the hub. The tests hold the other side of it too, because an invariant nothing could disturb is not worth reporting: dragging a loop bodily sideways until the centre falls outside it moves the number, and every move is by exactly one, at the moment a strand passes over the middle. A loop caught twice has two strands round the hub and they are cut one at a time, so its number falls from two to one to nought at two separate places rather than dropping straight to nothing. The hub itself is never drawn — it is the ground showing through where the spokes stop.

The text is the received Wang Bi recension, punctuated as that edition punctuates it; a second edition agrees on all thirteen characters and differs only in its pointing, placing one more comma after the first three. The Mawangdui silk manuscripts are reported to read this chapter differently and have not been collated here.

No Common Measure also started from a saying. The Gītā's second chapter opens a line about being and non-being — of what is not, there is no coming to be — and that is where the work began and not what it rests on; the verse is about being and makes no claim about numbers. What is drawn is a claim about numbers: that no unit measures both the leg and the hypotenuse of a right isosceles triangle a whole number of times. Suppose one did, q times along the leg and p times along the hypotenuse. Fold the triangle — swing a leg onto the hypotenuse and drop a perpendicular where it lands — and the corner cut off is a right isosceles triangle again, whose leg is p − q and whose hypotenuse is 2q − p. Both are whole, both positive, and the leg count has strictly dropped. That triangle yields a smaller one, and so on without end, which whole positive numbers cannot do.

What is on the paper is the shortfall. Every pair of whole numbers has one — p squared minus twice q squared — and it is nought exactly for the pair the argument supposes. There is a curve for every whole shortfall from minus seventeen to plus seventeen, warm where the hypotenuse count runs long and cool where it runs short, and a bead wherever a pair of whole numbers sits on one. The curves are all drawn by the same rule and the beads fall where they fall. Some curves come out strung with beads and some come out bare: seventeen has pairs and fifteen has none, and nor have thirteen, twelve, eleven, ten, six, five or three. Those stay bare however far the search is pushed — none of them has a pair out to a leg count of four thousand — because they are not values the expression takes at all, and not because the picture stops where it does. Nought is one of the bare ones. That is the point of drawing the bare ones at all — if only the empty curve were empty it would look chosen, and it is not chosen, it is one absence among several under a rule that plays no favourites.

The bare curve of nought is the straight one, and it is the line the others crowd towards. It is straight because a pair with no shortfall at all would be a triangle with no size. It passes between the beads and through none of them, and the tests check that of the drawing and not only of the arithmetic: the nearest bead to it is the pair seven and five, and it stands clear. Further out the pairs come nearer the line than a bead is wide and still never touch it, which is the difference between an approximation that can be made as good as you like and a ratio that exists. The grey threads are the descent — each pair joined to the pair its fold gives, landing on the curve of the opposite shortfall, always nearer the corner. Every thread runs out. A thread that began on the bare line would be the one that never did, and there is nothing on the bare line to begin it.

The arithmetic is done in BigInt throughout, which cannot hold a non-integer at all, so nothing here can pass by being nearly right; ordinary numbers appear only where curves are being drawn. The fold is shown to negate the shortfall exactly, over every pair in a grid, so a pair that measured the triangle would keep measuring it all the way down and its shortfall could never wear away. The descent is shown to be forced rather than lucky, because the condition for it re-reads as a condition on the shortfall alone and nought satisfies that condition for every positive leg count. And descents are shown to run out. The control changes one number: the same search that finds no pair for the square root of two, and none for three, finds two hundred of them the moment the two becomes a four — under the same rule, over the same range, with the curve of nought strung with beads like any other.

The verse is registered as Sanskrit Wikisource prints it in the chapter Sāṅkhya-yoga, numbered two-sixteen, with the space it sets before the daṇḍa closed up. Other recensions have not been collated here.

Turn It and Turn It started from Ben Bag Bag's line on the Torah in Pirkei Avot: turn it and turn it, for everything is in it. The saying is about study and makes no claim about circles. What is drawn is a claim about circles. Turn by the same share of a whole turn again and again, marking where you land, and the marks cut the circle into arcs; however many turns you have made, those arcs come in at most three lengths, and the longest is exactly the sum of the other two. The share turned here is the square root of three, less one, and what matters about it is that it is irrational: no number of turns ever lands back at the start, so the marks never stop being new.

Every ring is one more turn. The innermost has been turned once and is cut into two arcs, and each ring outward has one more arc than the ring inside it. An arc's colour is its length and nothing else — the shortest of the lengths present at that stage, the middle one, or the longest. Three colours is the whole of the palette, and it is not arranged: the lengths are measured off each ring and however many distinct ones turn up is how many colours that ring gets. A ring needing a fourth would be drawn in a fourth, and none ever is.

The colour is keyed to which length an arc is and not to how long it is, which is what keeps three colours from becoming a gradient — the three lengths themselves shrink as the rings go out. It is keyed by role rather than by rank for a subtler reason. A few rings come out with only two lengths, and numbering those one and two would hand the longer of them the colour that means "the middle one" everywhere else. Here the two are shortest and longest, and the middle colour is simply absent, which is the honest picture of a stage with no middle length.

Reading outward shows the mechanism as well as the result. Adding one mark cuts exactly one arc in two and leaves every other arc alone, which is why the boundaries run outward as unbroken walls with a new one appearing here and there rather than everything rearranging at each ring. What gets cut is always a longest arc, and it is always cut into the other two lengths — which is the same fact as the longest being their sum, seen from the side. The tests hold all of it as whole-number arithmetic: a mark is exactly the whole square root of three k squared subtracted from k times the square root of three, so every mark and every gap is a pair of whole numbers, and two lengths are equal only when both parts agree. There is no tolerance anywhere and a fourth length could not hide in a rounding error. The control turns by a whole ratio instead: three eighths closes after eight marks with every arc the same length, and then nothing new ever happens again.

The rings that lose a colour are the piece's own discovery rather than anything asked of it. Counted by how many arcs they carry, they fall at 2, 3, 4, 7, 11, 15, 26, 41, 56, 97, 153, 209, 362 — all of them out to four hundred turns, of which the first ten are inside the drawing and the last three lie past its edge. That is exactly the list of turn counts which come nearer to landing back at the start than any turn count before them, counting the two ways round separately. The two lists are counted in different things, arcs against turns, and share no calculation: one asks how far a single mark falls short of the start, the other how many distinct arc lengths a whole ring has. They agree anyway, because a ring with only two lengths is one where the marks have cut the circle about as evenly as that many marks can, and cutting evenly is what coming round almost exactly means. Nothing in the drawing marks those rings. They are where they are.

The text is the vocalised Torat Emet 357 reading, which is what the linked edition prints. The Kaufmann manuscript reads the passage differently and numbers it 25.

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

`npm run thumbnails` writes one JPEG per artwork into `site/thumbnails/`, for the gallery to show. It is much cheaper than a full render: everything is captured at the logical size rather than the export scale, and a moving artwork gives up one frame instead of a whole encoded clip, so the whole set takes about twenty seconds and under a megabyte between them. The frame chosen is halfway through by default, because several clips open and close on a resting state; an artwork whose telling moment lies elsewhere sets `thumbnail.frame` in the manifest, and twenty-three do — Recursive Pentagram is still drawing itself at its middle and is shown finished instead, Temple Bell is shown mid-toll with a ring in flight, Loader is shown at its opening frontier with the bright arc standing over the oldest stretch of its own track, Spring Polygon is shown at the instant of release, when the pulled star turns from strain to motion, and Bounding Spots is shown a moment after the release, where the ladder has opened into a single clean fan. A test counts them, because a number written in prose is a number nobody updates.

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

#generativeart

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
- Titus Lucretius Carus, *De rerum natura* II.221–222: [the Perseus digital library text](https://scaife.perseus.org/reader/urn:cts:latinLit:phi0550.phi001.perseus-lat1:2.221-2.222/). Its date is recorded as unknown, since the poem was left unfinished at Lucretius's death and is dated only by inference. [IV.385](https://scaife.perseus.org/reader/urn:cts:latinLit:phi0550.phi001.perseus-lat1:4.385/) — that the eyes cannot know the nature of things, whose judging the surrounding lines assign to reason — is quoted from the same text for Café Wall.
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
- David Hilbert, “Ueber die stetige Abbildung einer Linie auf ein Flächenstück”, *Mathematische Annalen* 38 (1891), 459–460: [the scanned volume, page 460](https://archive.org/details/sim_mathematische-annalen_1891_38/page/460). The sentence is the note's own statement of what the artwork animates — that a point can move continuously so as to meet, in a finite time, every point of a surface — printed in emphasis and read from the page rather than its OCR, which loses the umlauts.
- Johannes Kepler, *Strena seu De niue sexangula* (Frankfurt, 1611): [the scanned first edition](https://archive.org/details/ioanniskepleriss00kepl), page 5, beside the printed margin note *Stellulæ niuales*. The question quoted — why do the first elements of snow not fall five-cornered or seven-cornered, why always six — is the one the whole tract is written to answer. The transcription resolves the long s and a line-break hyphen (*ſex⸗angula*) and keeps the print's own letters and accents, *æquè* included; the sentence runs on, so it ends with an ellipsis the edition does not have, as with the Lucretius.
- René Descartes, letter to Princess Elisabeth of November 1643, in the *Œuvres de Descartes*, Adam–Tannery edition, volume IV: [the scanned edition, page 47](https://archive.org/details/oeuvresdedesca04desc/page/47). The letter works Elisabeth's three-circles problem into the relation now called Descartes' circle theorem, and the sentence quoted is the letter's own reason for liking it — quantities standing in like relation make the theorem more beautiful and shorter. The scan prints *Theoreme* without accents, and the transcription follows the page; this is the catalog's second Descartes, admitted because the letter is the theorem's own source rather than a general fit.
- Christiaan Huygens, *Traité de la lumière* (Leiden, 1690): [the scanned first edition, page 15](https://archive.org/details/bub_gb_X9PKaZlChggC/page/n26) — the page whose candle figure draws concentric circles about the points of a flame. The sentence is the principle itself, every small spot of a luminous body engendering its waves with that spot as their centre, transcribed from the page with the long s resolved.
- Henri Poincaré, *Science et méthode* (Paris: Flammarion, 1908), book I, § IV: [French Wikisource transcription of the édition définitive](https://fr.wikisource.org/wiki/Science_et_m%C3%A9thode/Livre_premier,_%C2%A7_IV). The sentence is where sensitive dependence is stated as a law of prediction — small differences in the initial conditions engendering very great ones in the final phenomena — half a century before Lorenz's equations gave it a picture.

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

Eight artworks answer to the reader, and none of them said so, which left the interaction discoverable only by reading the source. Each page now prints a single line at the foot of its canvas:

| Artwork | Control | The line it prints |
| --- | --- | --- |
| `fibonacci-spiral` | arrow keys | `→` add a section · `←` remove the newest |
| `windmill` | K | `K` hold to raise the wind · `release` let it fall |
| `atan2` | pointer | `move` the pointer carries the point |
| `necker-cube` | pointer | `move` the pointer turns the cube |
| `pulse-button` | click | `click` the bell tolls |
| `spring-polygon` | drag | `drag` pull a bob; the ring answers |
| `moire-rings` | pointer | `move` the pointer carries the second centre |
| `platonic-duals` | drag | `drag` the stage turns in your hand |

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

**The mark on artworks that move**, from the orbit in `2026-05-02/tips-4.html`, where a small body circles a larger one and its own turn finishes at 80 per cent of the cycle, so it comes to rest for the last fifth before setting off again — that pause is what stops a loop from reading as a spinner. Here it is the badge itself. A mark that says an artwork moves may as well move, and this site's artworks are made of orbits and spirals. It makes one lap as the card arrives and only keeps going under the pointer: twenty-six of the thirty-seven carry it, and twenty-six things circling on their own is a page that will not sit still.

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
