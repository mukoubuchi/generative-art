import {
  CANOPY_LAYOUT,
  CANOPY_MARGIN,
  CROWN_LAYER,
  DURATION_SECONDS,
  EARTH,
  GROUND_SIZE,
  LAYER_HEIGHTS,
  LIT_EXPOSURE,
  LOGICAL_SIZE,
  PLACEMENT_STRIDE,
  PLAYBACK_FPS,
  SHADE_COLOUR,
  SHADE_LIGHT,
  SKY_LIGHT,
  SUB_ROWS,
  SUN_ANGULAR_RADIUS,
  SUN_COLOUR,
  TOTAL_FRAMES,
  buildLeaves,
  canopyAt,
  groundAlbedo,
  leafPlacement,
  moonAt,
  sunShowing,
  timeOf,
  toneAt
} from "./little-moons.js";

/**
 * The ground under the edge of a tree's crown while the moon crosses the sun, and gusts
 * cross the crown. Every gap in the leaves throws an image of the sky, and the sky here is
 * the eclipsed sun; so the ground is covered in little moons, each turned the other way
 * from the one overhead.
 *
 * All of it is worked out on the graphics card, in the same steps the module takes: the
 * leaves are laid on a fine grid where the wind has them, each cell's open share is counted
 * from its four fine points, the rows are summed, and the light at each pixel is the bright
 * sky laid over the canopy there, its open part measured row by row. The card does it
 * because the module's version takes seconds a frame; the module's version stays, as the
 * reference the card is held to.
 */
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;
const P5 = window.p5;

const BASE = buildLeaves();
const ALBEDO = groundAlbedo();

/** A quad over the whole target, for every pass that works cell by cell or pixel by pixel. */
const SCREEN_VERTEX = `#version 300 es
in vec2 corner;
void main() {
  gl_Position = vec4(corner, 0.0, 1.0);
}`;

/** One quad per leaf, over the leaf's reach, on the fine grid: two fine points to a cell. */
const LEAF_VERTEX = `#version 300 es
in vec2 corner;
in vec2 centre;
in vec2 reach;
in vec2 turn;
in vec2 inverse;
uniform float canopySize;
flat out vec2 leafCentre;
flat out vec2 leafTurn;
flat out vec2 leafInverse;
void main() {
  leafCentre = centre;
  leafTurn = turn;
  leafInverse = inverse;
  gl_Position = vec4((centre + corner * reach) / canopySize * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * Whether a fine point is under the leaf, in the steps and the order the module's
 * `underLeaf` rounds them in. The point's centre, in cells, is a multiple of a quarter.
 */
const LEAF_FRAGMENT = `#version 300 es
precision highp float;
flat in vec2 leafCentre;
flat in vec2 leafTurn;
flat in vec2 leafInverse;
out uint covered;
void main() {
  vec2 at = gl_FragCoord.xy * 0.5;
  float dx = at.x - leafCentre.x;
  float dy = at.y - leafCentre.y;
  float along = dx * leafTurn.x + dy * leafTurn.y;
  float across = dy * leafTurn.x - dx * leafTurn.y;
  float u = along * leafInverse.x;
  float v = across * leafInverse.y;
  if (u * u + v * v > 1.0) discard;
  covered = 1u;
}`;

/**
 * Each cell's open share, in quarters, in the channel of its layer, one column to the right:
 * the first column is nought, so that summing along the row leaves in each column the open
 * area to the left of it.
 */
const CELL_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler2D coverage;
uniform highp usampler2D layers;
out uvec4 open;
void main() {
  ivec2 at = ivec2(gl_FragCoord.xy);
  if (at.x == 0) {
    open = uvec4(0u);
    return;
  }
  ivec2 cell = ivec2(at.x - 1, at.y);
  ivec2 fine = 2 * cell;
  uint covered = texelFetch(coverage, fine, 0).r + texelFetch(coverage, fine + ivec2(1, 0), 0).r
    + texelFetch(coverage, fine + ivec2(0, 1), 0).r + texelFetch(coverage, fine + ivec2(1, 1), 0).r;
  uint quarters = 4u - covered;
  uint layer = texelFetch(layers, cell, 0).r;
  open = uvec4(layer == 0u ? quarters : 0u, layer == 1u ? quarters : 0u, layer == 2u ? quarters : 0u, 0u);
}`;

/** One step of a running sum: each texel adds the one `step` behind it. Ten steps sum a row of 731. */
const SCAN_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler2D source;
uniform ivec2 step;
out uvec4 total;
void main() {
  ivec2 at = ivec2(gl_FragCoord.xy);
  uvec4 sum = texelFetch(source, at, 0);
  ivec2 back = at - step;
  if (back.x >= 0 && back.y >= 0) sum += texelFetch(source, back, 0);
  total = sum;
}`;

/** The row sums moved down a row, with a row of noughts on top: the start of the summed-area table. */
const SHIFT_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler2D source;
out uvec4 value;
void main() {
  ivec2 at = ivec2(gl_FragCoord.xy);
  value = at.y == 0 ? uvec4(0u) : texelFetch(source, ivec2(at.x, at.y - 1), 0);
}`;

/**
 * One pixel of ground. For each layer: lay the sun's disk, at that layer's scale, over the
 * canopy at this pixel; take each row of canopy cells it crosses at several heights; cut
 * the moon's chord out of the sun's; and read the open length of what is left from the
 * row's running sums, interpolating between cells where a chord ends inside one. Then the
 * ground's colour, as `litTone` has it.
 */
const LIGHT_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
const int SUB_ROWS = ${SUB_ROWS};
uniform highp usampler2D sums;
uniform highp usampler2D areas;
uniform highp sampler2D albedo;
uniform float canopySize;
uniform float margin;
uniform float lightScale;
uniform float logicalSize;
uniform vec3 heights;
uniform vec3 moon;
uniform float shadeLight;
uniform float skyLight;
uniform float showing;
uniform vec3 sunColour;
uniform vec3 shadeColour;
uniform vec3 earth;
uniform vec3 crown;
uniform vec3 lobes[3];
uniform float crownHeight;
uniform float litExposure;
out vec4 colour;

float sumAt(int column, int row, int layer) {
  return float(texelFetch(sums, ivec2(column, row), 0)[layer]) * 0.25;
}

float before(int row, float position, int layer) {
  if (position <= 0.0) return 0.0;
  if (position >= canopySize) return sumAt(int(canopySize), row, layer);
  int column = int(floor(position));
  float low = sumAt(column, row, layer);
  float high = sumAt(column + 1, row, layer);
  return low + (position - float(column)) * (high - low);
}

/**
 * Whether any cell of the layer is open in the square of cells from (left, top) to
 * (right, bottom), inclusive: four reads of the layer's summed-area table, in quarters.
 */
bool anyOpen(int left, int top, int right, int bottom, int layer) {
  uint inside = texelFetch(areas, ivec2(right + 1, bottom + 1), 0)[layer] + texelFetch(areas, ivec2(left, top), 0)[layer];
  uint outside = texelFetch(areas, ivec2(left, bottom + 1), 0)[layer] + texelFetch(areas, ivec2(right + 1, top), 0)[layer];
  return inside > outside;
}

float layerLight(int layer, float height, vec2 ground) {
  vec2 at = ground + margin;
  int size = int(canopySize);
  int firstRow = max(0, int(floor(at.y - height)));
  int lastRow = min(size - 1, int(floor(at.y + height)));
  int left = max(0, int(floor(at.x - height)));
  int right = min(size - 1, int(floor(at.x + height)));
  // Most of the ground is far from any hole of a given layer; there the answer is nought
  // and nothing below needs asking.
  if (!anyOpen(left, firstRow, right, lastRow, layer)) return 0.0;
  float open = 0.0;
  float sun = 0.0;
  float moonRadius = height * moon.z;
  // The cells the sun's full width crosses, whole ones, and whether they are all on the grid.
  int first = int(floor(at.x - height));
  int last = int(ceil(at.x + height));
  bool onGrid = first >= 0 && last <= size;
  int from = max(0, first);
  int to = min(size, last);
  for (int row = firstRow; row <= lastRow; row++) {
    // If none of them is open, the row adds only to the sun's own area. If every one is,
    // the open length of a stretch is its length, and no more need be read.
    float rowOpen = sumAt(to, row, layer) - sumAt(from, row, layer);
    bool empty = rowOpen <= 0.0;
    bool whole = onGrid && rowOpen >= float(to - from);
    for (int sub = 0; sub < SUB_ROWS; sub++) {
      float dy = float(row) + (float(sub) + 0.5) / float(SUB_ROWS) - at.y;
      if (abs(dy) >= height) continue;
      float half_ = sqrt(height * height - dy * dy);
      sun += 2.0 * half_;
      if (empty) continue;
      float moonDy = dy - height * moon.y;
      if (abs(moonDy) >= moonRadius) {
        open += whole ? 2.0 * half_ : before(row, at.x + half_, layer) - before(row, at.x - half_, layer);
        continue;
      }
      float moonHalf = sqrt(moonRadius * moonRadius - moonDy * moonDy);
      float moonLeft = height * moon.x - moonHalf;
      float moonRight = height * moon.x + moonHalf;
      if (moonLeft > -half_) {
        float end = min(half_, moonLeft);
        open += whole ? end + half_ : before(row, at.x + end, layer) - before(row, at.x - half_, layer);
      }
      if (moonRight < half_) {
        float start = max(-half_, moonRight);
        open += whole ? half_ - start : before(row, at.x + half_, layer) - before(row, at.x + start, layer);
      }
    }
  }
  return sun > 0.0 ? open / sun : 0.0;
}

void main() {
  vec2 ground = vec2(gl_FragCoord.x, logicalSize * lightScale - gl_FragCoord.y) / lightScale;
  float light = layerLight(0, heights.x, ground)
    + layerLight(1, heights.y, ground)
    + layerLight(2, heights.z, ground);
  float a = texelFetch(albedo, ivec2(int(floor(ground.x)), int(floor(ground.y))), 0).r;
  // The sky past the crown's edge, as skyPastCrown has it, and the shade's light, as shadeLightAt.
  vec2 d = ground - crown.xy;
  float angle = atan(d.y, d.x);
  float radius = crown.z;
  for (int k = 0; k < 3; k++) radius *= 1.0 + lobes[k].y * sin(lobes[k].x * angle + lobes[k].z);
  float depth = radius - length(d);
  float sky = (1.0 - depth / sqrt(depth * depth + crownHeight * crownHeight)) / 2.0;
  float shade = (shadeLight * (1.0 - sky) + skyLight * sky) * showing;
  vec3 linear = a * earth * (sunColour * light + shadeColour * shade);
  vec3 exposed = clamp(1.0 - exp(-litExposure * linear), 0.0, 1.0);
  vec3 low = 12.92 * exposed;
  vec3 high = 1.055 * pow(exposed, vec3(1.0 / 2.4)) - 0.055;
  colour = vec4(mix(high, low, step(exposed, vec3(0.0031308))), 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader did not compile");
  }
  return shader;
}

function program(gl, vertex, fragment) {
  const linked = gl.createProgram();
  gl.attachShader(linked, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(linked, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(linked);
  if (!gl.getProgramParameter(linked, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(linked) ?? "program did not link");
  }
  return linked;
}

/** A texture of unsigned integers the card can draw into, with the frame buffer that draws into it. */
function target(gl, width, height, internalFormat, format) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format,
    internalFormat === gl.R8UI ? gl.UNSIGNED_BYTE : gl.UNSIGNED_INT, null);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("an integer target is not complete");
  }
  return { texture, framebuffer, width, height };
}

/**
 * The card's half: its own canvas, never put in the page, which the p5 canvas draws from.
 * The leaves go up every frame, as a list of numbers; the canopy's layers, their running
 * sums and summed-area tables are made on the card from them.
 */
function createLightField(lightScale) {
  const canvas = document.createElement("canvas");
  canvas.width = LOGICAL_SIZE * lightScale;
  canvas.height = LOGICAL_SIZE * lightScale;
  const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
  if (!gl) {
    throw new Error("WebGL2 is not available");
  }
  const size = BASE.size;
  const fine = 2 * size;
  const stride = size + 1;
  const leafCount = BASE.leaves.length;

  const screen = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, screen);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  /** A vertex array drawing the quad over the whole target, for a program that reads `corner`. */
  function screenFor(linked) {
    const vertices = gl.createVertexArray();
    gl.bindVertexArray(vertices);
    gl.bindBuffer(gl.ARRAY_BUFFER, screen);
    const corner = gl.getAttribLocation(linked, "corner");
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vertices;
  }

  const leafProgram = program(gl, LEAF_VERTEX, LEAF_FRAGMENT);
  const cellProgram = program(gl, SCREEN_VERTEX, CELL_FRAGMENT);
  const scanProgram = program(gl, SCREEN_VERTEX, SCAN_FRAGMENT);
  const shiftProgram = program(gl, SCREEN_VERTEX, SHIFT_FRAGMENT);
  const lightProgram = program(gl, SCREEN_VERTEX, LIGHT_FRAGMENT);

  // The leaves: four corners, and eight numbers a leaf, as leafPlacement lays them out.
  const leaves = gl.createVertexArray();
  gl.bindVertexArray(leaves);
  gl.bindBuffer(gl.ARRAY_BUFFER, screen);
  const corner = gl.getAttribLocation(leafProgram, "corner");
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
  const placementBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, placementBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, leafCount * PLACEMENT_STRIDE * 4, gl.DYNAMIC_DRAW);
  [["centre", 0], ["reach", 2], ["turn", 4], ["inverse", 6]].forEach(([name, offset]) => {
    const location = gl.getAttribLocation(leafProgram, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, PLACEMENT_STRIDE * 4, offset * 4);
    gl.vertexAttribDivisor(location, 1);
  });
  gl.bindVertexArray(null);

  const cellScreen = screenFor(cellProgram);
  const scanScreen = screenFor(scanProgram);
  const shiftScreen = screenFor(shiftProgram);
  const lightScreen = screenFor(lightProgram);

  const coverage = target(gl, fine, fine, gl.R8UI, gl.RED_INTEGER);
  const rows = [target(gl, stride, size, gl.RGBA32UI, gl.RGBA_INTEGER), target(gl, stride, size, gl.RGBA32UI, gl.RGBA_INTEGER)];
  const table = [target(gl, stride, stride, gl.RGBA32UI, gl.RGBA_INTEGER), target(gl, stride, stride, gl.RGBA32UI, gl.RGBA_INTEGER)];

  // Which layer each cell belongs to, and the ground's texture: both the same every frame.
  const layers = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, layers);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, size, size, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, BASE.layerOf);
  const ground = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, ground);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, GROUND_SIZE, GROUND_SIZE, 0, gl.RED, gl.FLOAT, ALBEDO);

  const uniform = (linked, name) => gl.getUniformLocation(linked, name);
  gl.useProgram(leafProgram);
  gl.uniform1f(uniform(leafProgram, "canopySize"), size);
  gl.useProgram(cellProgram);
  gl.uniform1i(uniform(cellProgram, "coverage"), 0);
  gl.uniform1i(uniform(cellProgram, "layers"), 1);
  gl.useProgram(scanProgram);
  gl.uniform1i(uniform(scanProgram, "source"), 0);
  const scanStep = uniform(scanProgram, "step");
  gl.useProgram(shiftProgram);
  gl.uniform1i(uniform(shiftProgram, "source"), 0);
  gl.useProgram(lightProgram);
  gl.uniform1i(uniform(lightProgram, "sums"), 0);
  gl.uniform1i(uniform(lightProgram, "areas"), 1);
  gl.uniform1i(uniform(lightProgram, "albedo"), 2);
  gl.uniform1f(uniform(lightProgram, "canopySize"), size);
  gl.uniform1f(uniform(lightProgram, "margin"), CANOPY_MARGIN);
  gl.uniform1f(uniform(lightProgram, "lightScale"), lightScale);
  gl.uniform1f(uniform(lightProgram, "logicalSize"), LOGICAL_SIZE);
  gl.uniform3f(uniform(lightProgram, "heights"), ...LAYER_HEIGHTS);
  gl.uniform1f(uniform(lightProgram, "shadeLight"), SHADE_LIGHT);
  gl.uniform1f(uniform(lightProgram, "skyLight"), SKY_LIGHT);
  gl.uniform3f(uniform(lightProgram, "sunColour"), ...SUN_COLOUR);
  gl.uniform3f(uniform(lightProgram, "shadeColour"), ...SHADE_COLOUR);
  gl.uniform3f(uniform(lightProgram, "earth"), ...EARTH);
  const { crown } = CANOPY_LAYOUT;
  gl.uniform3f(uniform(lightProgram, "crown"), crown.x, crown.y, crown.radius);
  gl.uniform3fv(uniform(lightProgram, "lobes"), new Float32Array(crown.lobes.flat()));
  gl.uniform1f(uniform(lightProgram, "crownHeight"), LAYER_HEIGHTS[CROWN_LAYER] / SUN_ANGULAR_RADIUS);
  gl.uniform1f(uniform(lightProgram, "litExposure"), LIT_EXPOSURE);
  const moonAt_ = uniform(lightProgram, "moon");
  const showingAt = uniform(lightProgram, "showing");

  function bind(unit, texture) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  }

  function drawInto(destination, vertices) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, destination.framebuffer);
    gl.viewport(0, 0, destination.width, destination.height);
    gl.bindVertexArray(vertices);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Summing along x or y, in steps of doubling reach, swapping the pair each step. Returns the one holding the sums. */
  function scan(pair, along) {
    gl.useProgram(scanProgram);
    let from = 0;
    for (let reach = 1; reach < stride; reach *= 2) {
      gl.uniform2i(scanStep, along === "x" ? reach : 0, along === "y" ? reach : 0);
      bind(0, pair[from].texture);
      drawInto(pair[1 - from], scanScreen);
      from = 1 - from;
    }
    return pair[from];
  }

  /** The canopy at a frame, from where the wind has the leaves: its running sums and summed-area table. */
  function layCanopy(frameIndex) {
    gl.bindBuffer(gl.ARRAY_BUFFER, placementBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, leafPlacement(BASE, timeOf(frameIndex)));
    gl.bindFramebuffer(gl.FRAMEBUFFER, coverage.framebuffer);
    gl.viewport(0, 0, fine, fine);
    gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([0, 0, 0, 0]));
    gl.useProgram(leafProgram);
    gl.bindVertexArray(leaves);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, leafCount);
    gl.useProgram(cellProgram);
    bind(0, coverage.texture);
    bind(1, layers);
    drawInto(rows[0], cellScreen);
    const sums = scan(rows, "x");
    gl.useProgram(shiftProgram);
    bind(0, sums.texture);
    drawInto(table[0], shiftScreen);
    const areas = scan(table, "y");
    return { sums, areas };
  }

  let laid = null;
  return {
    canvas,
    draw(frameIndex) {
      laid = layCanopy(frameIndex);
      const moon = moonAt(frameIndex);
      gl.useProgram(lightProgram);
      gl.uniform3f(moonAt_, moon.x, moon.y, moon.ratio);
      gl.uniform1f(showingAt, sunShowing(moon));
      bind(0, laid.sums.texture);
      bind(1, laid.areas.texture);
      bind(2, ground);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindVertexArray(lightScreen);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return moon;
    },
    /** The card's colour at one pixel of its own canvas, top-left origin. */
    read(column, row) {
      const pixel = new Uint8Array(4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(column, canvas.height - 1 - row, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return [pixel[0], pixel[1], pixel[2]];
    },
    /** The running sums and the summed-area table the card made for the last frame drawn, in quarters. */
    readCanopy() {
      const read = (made) => {
        const values = new Uint32Array(made.width * made.height * 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, made.framebuffer);
        gl.readPixels(0, 0, made.width, made.height, gl.RGBA_INTEGER, gl.UNSIGNED_INT, values);
        return values;
      };
      return { sums: read(laid.sums), areas: read(laid.areas) };
    }
  };
}

/**
 * How far the card's canopy for a frame is from the module's: the running sums and the
 * summed-area table, value by value, in quarters.
 */
function canopyApart(made, canopy) {
  const size = canopy.size;
  const stride = size + 1;
  let sumsApart = 0;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < stride; column += 1) {
      for (let layer = 0; layer < 3; layer += 1) {
        if (made.sums[(row * stride + column) * 4 + layer] !== 4 * canopy.layers[layer].sums[row * stride + column]) sumsApart += 1;
      }
    }
  }
  let areasApart = 0;
  for (let layer = 0; layer < 3; layer += 1) {
    const above = new Float64Array(stride);
    for (let row = 0; row <= size; row += 1) {
      for (let column = 0; column <= size; column += 1) {
        // The summed-area table is the column sums of the row sums, one row down.
        if (row > 0) above[column] += 4 * canopy.layers[layer].sums[(row - 1) * stride + column];
        if (made.areas[(row * stride + column) * 4 + layer] !== above[column]) areasApart += 1;
      }
    }
  }
  return { sumsApart, areasApart };
}

new P5((p) => {
  let field;
  let playbackStartedAt = 0;

  function drawFrame(frameIndex) {
    const moon = field.draw(frameIndex);
    p.push();
    p.scale(RENDER_SCALE);
    p.drawingContext.imageSmoothingEnabled = true;
    p.drawingContext.drawImage(field.canvas, 0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    p.pop();
    return moon;
  }

  function publishState(frameIndex, moon) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      eclipse: "partial",
      moon,
      layerHeights: LAYER_HEIGHTS,
      leaves: BASE.leaves.length,
      lightScale: field.canvas.width / LOGICAL_SIZE,
      palette: "sun and shade on earth",
      logicalSize: { width: LOGICAL_SIZE, height: LOGICAL_SIZE },
      outputSize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_SIZE, OUTPUT_SIZE).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(PLAYBACK_FPS);
    // The light is worked out at the display's own density, or the export's scale, so an
    // image's edge is as fine on the page as the canopy's cells allow.
    field = createLightField(CAPTURE_MODE ? RENDER_SCALE : Math.min(2, p.pixelDensity()));
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) => Promise.resolve(publishState(frameIndex, drawFrame(frameIndex)));
      // The card is held to the module: the same canopy and the same pixels, worked out both ways.
      window.__canopyProbe = (frameIndex) => {
        drawFrame(frameIndex);
        return canopyApart(field.readCanopy(), canopyAt(BASE, frameIndex));
      };
      window.__lightProbe = (frameIndex, points) => {
        drawFrame(frameIndex);
        const canopy = canopyAt(BASE, frameIndex);
        const scale = field.canvas.width / LOGICAL_SIZE;
        return points.map(([column, row]) => ({
          column,
          row,
          card: field.read(column, row),
          module: toneAt(canopy, ALBEDO, (column + 0.5) / scale, (row + 0.5) / scale, frameIndex)
        }));
      };
    }
    publishState(0, drawFrame(0));
    playbackStartedAt = window.performance.now();
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const elapsed = window.performance.now() - playbackStartedAt;
    const frameIndex = Math.floor(elapsed * PLAYBACK_FPS / 1000) % TOTAL_FRAMES;
    publishState(frameIndex, drawFrame(frameIndex));
  };
});
