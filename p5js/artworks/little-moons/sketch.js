import {
  CANOPY_MARGIN,
  DURATION_SECONDS,
  EXPOSURE,
  LAYER_HEIGHTS,
  LOGICAL_SIZE,
  PALETTE,
  PLAYBACK_FPS,
  SUB_ROWS,
  TOTAL_FRAMES,
  buildCanopy,
  holePieces,
  lightAt,
  moonAt,
  swayAt,
  toneOf
} from "./little-moons.js";

/**
 * The ground under a tree while the moon crosses the sun. Every gap in the leaves throws an
 * image of the sky, and the sky here is the eclipsed sun; so the ground is covered in
 * little moons, each turned the other way from the one overhead.
 *
 * The light is worked out per pixel on the graphics card, by the same sum the module does
 * in `layerLight`: the bright sky laid over the canopy at that pixel, its open part
 * measured row by row. The card does it because the module's version takes a second and a
 * half for one frame; the module's version stays, as the reference the card is held to.
 */
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;
const P5 = window.p5;

const CANOPY = buildCanopy();
const HOLES = CANOPY.layers.map((layer) => holePieces(layer.mask, CANOPY.size).length);

const VERTEX_SHADER = `#version 300 es
in vec2 corner;
void main() {
  gl_Position = vec4(corner, 0.0, 1.0);
}`;

/**
 * One pixel of ground. For each layer: lay the sun's disk, at that layer's scale, over the
 * canopy at this pixel; take each row of canopy cells it crosses at the row's middle; cut
 * the moon's chord out of the sun's; and read the open length of what is left from the
 * row's running sums, interpolating between cells where a chord ends inside one.
 */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
const int SUB_ROWS = ${SUB_ROWS};
uniform highp sampler2D sums;
uniform highp sampler2D areas;
uniform float canopySize;
uniform float margin;
uniform float lightScale;
uniform float logicalSize;
uniform vec3 heights;
uniform vec3 moon;
uniform vec2 sway[3];
uniform float exposure;
uniform vec3 shade;
uniform vec3 warm;
uniform vec3 hot;
out vec4 colour;

float before(int row, float position, int layer) {
  if (position <= 0.0) return 0.0;
  if (position >= canopySize) return texelFetch(sums, ivec2(int(canopySize), row), 0)[layer];
  int column = int(floor(position));
  float low = texelFetch(sums, ivec2(column, row), 0)[layer];
  float high = texelFetch(sums, ivec2(column + 1, row), 0)[layer];
  return low + (position - float(column)) * (high - low);
}

float cell(int row, int column, int layer) {
  return texelFetch(sums, ivec2(column, row), 0)[layer];
}

/**
 * Whether any cell of the layer is open in the square of cells from (left, top) to
 * (right, bottom), inclusive: four reads of the layer's summed-area table. Open areas are
 * multiples of a quarter, so the sums are exact and the test is exact.
 */
bool anyOpen(int left, int top, int right, int bottom, int layer) {
  float total = texelFetch(areas, ivec2(right + 1, bottom + 1), 0)[layer]
    - texelFetch(areas, ivec2(left, bottom + 1), 0)[layer]
    - texelFetch(areas, ivec2(right + 1, top), 0)[layer]
    + texelFetch(areas, ivec2(left, top), 0)[layer];
  return total > 0.0;
}

float layerLight(int layer, float height, vec2 ground) {
  vec2 at = ground + margin - sway[layer];
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
  for (int row = firstRow; row <= lastRow; row++) {
    // Whole cells under the sun's full width: if none is open, the row adds only to the
    // sun's own area, and that is all it adds.
    int from = max(0, int(floor(at.x - height)));
    int to = min(size, int(ceil(at.x + height)));
    bool empty = cell(row, to, layer) - cell(row, from, layer) <= 0.0;
    for (int sub = 0; sub < SUB_ROWS; sub++) {
      float dy = float(row) + (float(sub) + 0.5) / float(SUB_ROWS) - at.y;
      if (abs(dy) >= height) continue;
      float half_ = sqrt(height * height - dy * dy);
      sun += 2.0 * half_;
      if (empty) continue;
      float moonDy = dy - height * moon.y;
      if (abs(moonDy) >= moonRadius) {
        open += before(row, at.x + half_, layer) - before(row, at.x - half_, layer);
        continue;
      }
      float moonHalf = sqrt(moonRadius * moonRadius - moonDy * moonDy);
      float moonLeft = height * moon.x - moonHalf;
      float moonRight = height * moon.x + moonHalf;
      if (moonLeft > -half_) {
        float end = min(half_, moonLeft);
        open += before(row, at.x + end, layer) - before(row, at.x - half_, layer);
      }
      if (moonRight < half_) {
        float start = max(-half_, moonRight);
        open += before(row, at.x + half_, layer) - before(row, at.x + start, layer);
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
  float exposed = 1.0 - exp(-exposure * light);
  vec3 tone = exposed < 0.5
    ? mix(shade, warm, exposed / 0.5)
    : mix(warm, hot, (exposed - 0.5) / 0.5);
  colour = vec4(tone / 255.0, 1.0);
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

/**
 * The card's half: its own canvas, never put in the page, which the p5 canvas draws from.
 * The running sums of the three layers go up once, as one float texture with a layer in
 * each of three channels.
 */
function createLightField(lightScale) {
  const canvas = document.createElement("canvas");
  canvas.width = LOGICAL_SIZE * lightScale;
  canvas.height = LOGICAL_SIZE * lightScale;
  const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
  if (!gl) {
    throw new Error("WebGL2 is not available");
  }
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "program did not link");
  }
  gl.useProgram(program);

  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, "corner");
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

  const size = CANOPY.size;
  const stride = size + 1;
  const texels = new Float32Array(stride * size * 4);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < stride; column += 1) {
      for (let layer = 0; layer < CANOPY.layers.length; layer += 1) {
        texels[(row * stride + column) * 4 + layer] = CANOPY.layers[layer].sums[row * stride + column];
      }
    }
  }
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, stride, size, 0, gl.RGBA, gl.FLOAT, texels);

  // The summed-area table of each layer, for the test that skips ground no hole can reach.
  const corner_ = size + 1;
  const table = new Float32Array(corner_ * corner_ * 4);
  for (let layer = 0; layer < CANOPY.layers.length; layer += 1) {
    const { mask } = CANOPY.layers[layer];
    for (let row = 1; row <= size; row += 1) {
      let across = 0;
      for (let column = 1; column <= size; column += 1) {
        across += mask[(row - 1) * size + column - 1];
        table[(row * corner_ + column) * 4 + layer] = table[((row - 1) * corner_ + column) * 4 + layer] + across;
      }
    }
  }
  const areas = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, areas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, corner_, corner_, 0, gl.RGBA, gl.FLOAT, table);

  const uniform = (name) => gl.getUniformLocation(program, name);
  gl.uniform1i(uniform("sums"), 0);
  gl.uniform1i(uniform("areas"), 1);
  gl.uniform1f(uniform("canopySize"), size);
  gl.uniform1f(uniform("margin"), CANOPY_MARGIN);
  gl.uniform1f(uniform("lightScale"), lightScale);
  gl.uniform1f(uniform("logicalSize"), LOGICAL_SIZE);
  gl.uniform3f(uniform("heights"), ...LAYER_HEIGHTS);
  gl.uniform1f(uniform("exposure"), EXPOSURE);
  gl.uniform3f(uniform("shade"), ...PALETTE.shade);
  gl.uniform3f(uniform("warm"), ...PALETTE.warm);
  gl.uniform3f(uniform("hot"), ...PALETTE.hot);
  const moonAt_ = uniform("moon");
  const swayAt_ = uniform("sway");
  gl.viewport(0, 0, canvas.width, canvas.height);

  return {
    canvas,
    draw(frameIndex) {
      const moon = moonAt(frameIndex);
      gl.uniform3f(moonAt_, moon.x, moon.y, moon.ratio);
      const sway = LAYER_HEIGHTS.flatMap((height, layer) => {
        const { x, y } = swayAt(frameIndex, layer);
        return [x, y];
      });
      gl.uniform2fv(swayAt_, new Float32Array(sway));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return moon;
    },
    /** The card's colour at one pixel of its own canvas, top-left origin. */
    read(column, row) {
      const pixel = new Uint8Array(4);
      gl.readPixels(column, canvas.height - 1 - row, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return [pixel[0], pixel[1], pixel[2]];
    }
  };
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
      holesPerLayer: HOLES,
      leaves: CANOPY.leaves,
      lightScale: field.canvas.width / LOGICAL_SIZE,
      palette: "sun on shade",
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
      // The card is held to the module: the same pixels, worked out both ways.
      window.__lightProbe = (frameIndex, points) => {
        drawFrame(frameIndex);
        const scale = field.canvas.width / LOGICAL_SIZE;
        return points.map(([column, row]) => ({
          column,
          row,
          card: field.read(column, row),
          module: toneOf(lightAt(CANOPY, (column + 0.5) / scale, (row + 0.5) / scale, frameIndex))
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
