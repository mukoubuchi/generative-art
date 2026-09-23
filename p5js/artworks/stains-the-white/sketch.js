import {
  BLACK_EDGE,
  BLACK_FILM,
  BLACK_ONSET,
  DRAINAGE,
  DURATION_SECONDS,
  EXPOSURE,
  GROUND,
  HOLD,
  LOGICAL_SIZE,
  PLAYBACK_FPS,
  SATURATION,
  START_THICKNESS,
  SWIRL,
  TILT,
  TONE,
  TOTAL_FRAMES,
  WAVES,
  createBubbles,
  QUARTERS,
  pixelAt,
  sceneAt,
  thicknessSeen
} from "./bubbles.js";
import { COSINE_STEPS, OPD_STEP, WATER, colourTable, lookUp, pathDifference } from "./film.js";

/**
 * Soap bubbles against black, each thinning until a black film opens at its top and it
 * bursts. The films' colour is worked out per pixel on the graphics card from the same
 * formulas the modules hold: thickness from `thicknessAt` at the point `upright` gives,
 * colour from the table `colourTable` bakes.
 */
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;
const MAX_BUBBLES = 24;
const P5 = window.p5;

const BUBBLES = createBubbles();
const TABLE = colourTable();

const VERTEX_SHADER = `#version 300 es
in vec2 corner;
void main() {
  gl_Position = vec4(corner, 0.0, 1.0);
}`;

const number = (value) => (Number.isInteger(value) ? `${value}.0` : String(value));
const waveTerms = WAVES.map(({ amplitude, frequency, direction, phase }) =>
  `${number(amplitude)} * sin(${number(frequency)} * dot(vec3(${direction.map(number).join(", ")}), q) + ${number(phase)})`
).join(" + ");

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D table;
uniform int count;
uniform vec4 place[${MAX_BUBBLES}];
uniform vec4 film[${MAX_BUBBLES}];
uniform float lightScale;
uniform float logicalSize;
uniform vec3 ground;
out vec4 colour;

const float WATER = ${number(WATER)};
const float OPD_STEP = ${number(OPD_STEP)};
const float COSINE_STEPS = ${number(COSINE_STEPS)};
const float START = ${number(START_THICKNESS)};
const float DRAINAGE = ${number(DRAINAGE)};
const float HOLD = ${number(HOLD)};
const float BLACK_ONSET = ${number(BLACK_ONSET)};
const float BLACK_FILM = ${number(BLACK_FILM)};
const float BLACK_LOW = ${number(BLACK_ONSET * (1 - BLACK_EDGE))};
const float SWIRL = ${number(SWIRL)};
const float EXPOSURE = ${number(EXPOSURE)};
const float TONE = ${number(TONE)};
const float SATURATION = ${number(SATURATION)};
const vec2 QUARTERS[4] = vec2[4](${QUARTERS.map(([dx, dy]) => `vec2(${number(dx)}, ${number(dy)})`).join(", ")});
const float COS_TILT = ${number(Math.cos(TILT))};
const float SIN_TILT = ${number(Math.sin(TILT))};

float swirling(vec3 q) {
  return ${waveTerms};
}

// A bubble's thickness at a point of its unit sphere, as thicknessAt has it.
float thickness(vec4 f, vec3 p, float age) {
  float w = (1.0 + p.y) / 2.0;
  float drained = START * (1.0 + DRAINAGE * w) * exp(-(1.0 - HOLD * w) * age / f.x);
  float angle = f.z + f.y * age;
  float c = cos(angle);
  float s = sin(angle);
  vec3 q = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  float film = drained * exp(SWIRL * w * swirling(q));
  // Opened into black, as blackened has it; smoothstep is the same cubic.
  return BLACK_FILM + smoothstep(BLACK_LOW, BLACK_ONSET, film) * (film - BLACK_FILM);
}

vec3 fetch(int row, int column) {
  return texelFetch(table, ivec2(column, row), 0).rgb;
}

// The table's colour for a path difference and a viewing cosine, interpolated as lookUp does.
vec3 look(float opd, float cosAir) {
  float rows = float(textureSize(table, 0).y);
  float columns = float(textureSize(table, 0).x);
  float u = clamp(opd / OPD_STEP, 0.0, rows - 1.0);
  float v = clamp(sqrt(cosAir) * COSINE_STEPS, 0.0, columns - 1.0);
  int r0 = int(min(rows - 2.0, floor(u)));
  int c0 = int(min(columns - 2.0, floor(v)));
  float fu = u - float(r0);
  float fv = v - float(c0);
  vec3 a = mix(fetch(r0, c0), fetch(r0 + 1, c0), fu);
  vec3 b = mix(fetch(r0, c0 + 1), fetch(r0 + 1, c0 + 1), fu);
  return mix(a, b, fv);
}

// The point the eye sees, in the bubble's upright frame, as upright has it.
vec3 upright(vec3 p) {
  return vec3(p.x, COS_TILT * p.y - SIN_TILT * p.z, SIN_TILT * p.y + COS_TILT * p.z);
}

vec3 filmColour(vec4 f, vec3 p, float age) {
  float cosAir = abs(p.z);
  float cosWater = sqrt(1.0 - (1.0 - cosAir * cosAir) / (WATER * WATER));
  return look(2.0 * WATER * thickness(f, upright(p), age) * cosWater, cosAir);
}

void main() {
  vec2 at = vec2(gl_FragCoord.x, logicalSize * lightScale - gl_FragCoord.y) / lightScale;
  vec3 light = ground;
  for (int i = 0; i < ${MAX_BUBBLES}; i++) {
    if (i >= count) break;
    vec4 b = place[i];
    vec2 uv = (at - b.xy) / b.z;
    float distance = length(uv);
    float cover = clamp((1.0 - distance) * b.z * lightScale + 0.5, 0.0, 1.0);
    if (cover <= 0.0) continue;
    float inward = min(1.0, 1.0 - 0.5 / (b.z * lightScale) + 1e-9);
    // The film read at four points of the pixel and averaged, as lightAt does.
    vec3 reflected = vec3(0.0);
    vec3 through = vec3(0.0);
    for (int k = 0; k < 4; k++) {
      vec2 s = (at + QUARTERS[k] / lightScale - b.xy) / b.z;
      float reach = length(s);
      if (reach > inward) s *= inward / reach;
      float z = sqrt(max(0.0, 1.0 - dot(s, s)));
      vec3 near = filmColour(film[i], vec3(s, z), b.w);
      vec3 far = filmColour(film[i], vec3(s, -z), b.w);
      reflected += (near + (1.0 - near) * far) / 4.0;
      through += ((1.0 - near) * (1.0 - far)) / 4.0;
    }
    float luminance = dot(reflected, vec3(0.2126, 0.7152, 0.0722));
    vec3 shown = luminance + SATURATION * (reflected - luminance);
    light = mix(light, shown + through * light, cover);
  }
  vec3 exposed = 1.0 - exp(-pow(max(EXPOSURE * light, vec3(0.0)), vec3(TONE)));
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

/** The card's canvas, never put in the page; the p5 canvas draws from it. */
function createFilmView(lightScale) {
  const canvas = document.createElement("canvas");
  canvas.width = LOGICAL_SIZE * lightScale;
  canvas.height = LOGICAL_SIZE * lightScale;
  const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error("WebGL2 is not available");
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
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB32F, TABLE.columns, TABLE.rows, 0, gl.RGB, gl.FLOAT, TABLE.table);
  const uniform = (name) => gl.getUniformLocation(program, name);
  gl.uniform1i(uniform("table"), 0);
  gl.uniform1f(uniform("lightScale"), lightScale);
  gl.uniform1f(uniform("logicalSize"), LOGICAL_SIZE);
  gl.uniform3f(uniform("ground"), ...GROUND);
  const countAt = uniform("count");
  const placeAt = uniform("place");
  const filmAt = uniform("film");
  gl.viewport(0, 0, canvas.width, canvas.height);
  return {
    canvas,
    draw(scene) {
      const place = new Float32Array(4 * MAX_BUBBLES);
      const film = new Float32Array(4 * MAX_BUBBLES);
      scene.slice(0, MAX_BUBBLES).forEach((bubble, k) => {
        place.set([bubble.cx, bubble.cy, bubble.radius, bubble.age], 4 * k);
        film.set([bubble.timeScale, bubble.turn, bubble.offset, 0], 4 * k);
      });
      gl.uniform1i(countAt, Math.min(MAX_BUBBLES, scene.length));
      gl.uniform4fv(placeAt, place);
      gl.uniform4fv(filmAt, film);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    read(column, row) {
      const pixel = new Uint8Array(4);
      gl.readPixels(column, canvas.height - 1 - row, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return [pixel[0], pixel[1], pixel[2]];
    }
  };
}

const colourAt = (bubble, u, v, z) => {
  const cosAir = Math.abs(z);
  return lookUp(TABLE, pathDifference(thicknessSeen(bubble, u, v, z, bubble.age), cosAir), cosAir);
};

new P5((p) => {
  let view;
  let playbackStartedAt = 0;

  function drawFrame(frameIndex) {
    const scene = sceneAt(BUBBLES, frameIndex);
    view.draw(scene);
    p.push();
    p.scale(RENDER_SCALE);
    p.drawingContext.imageSmoothingEnabled = true;
    p.drawingContext.drawImage(view.canvas, 0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    p.pop();
    return scene;
  }

  function publishState(frameIndex, scene) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      bubbles: scene.length,
      ages: scene.map((bubble) => bubble.age),
      lightScale: view.canvas.width / LOGICAL_SIZE,
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
    view = createFilmView(CAPTURE_MODE ? RENDER_SCALE : Math.min(2, p.pixelDensity()));
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) => Promise.resolve(publishState(frameIndex, drawFrame(frameIndex)));
      // The card is held to the modules: the same pixels, worked out both ways.
      window.__filmProbe = (frameIndex, points) => {
        const scene = drawFrame(frameIndex);
        const scale = view.canvas.width / LOGICAL_SIZE;
        return points.map(([column, row]) => ({
          column,
          row,
          card: view.read(column, row),
          module: pixelAt(scene, (column + 0.5) / scale, (row + 0.5) / scale, colourAt, scale)
        }));
      };
    }
    publishState(0, drawFrame(0));
    playbackStartedAt = window.performance.now();
  };

  p.draw = () => {
    if (CAPTURE_MODE) return;
    const elapsed = window.performance.now() - playbackStartedAt;
    const frameIndex = Math.floor(elapsed * PLAYBACK_FPS / 1000) % TOTAL_FRAMES;
    publishState(frameIndex, drawFrame(frameIndex));
  };
});
