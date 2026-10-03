import { LOGICAL_SIZE, PLATE_INSET, PLATE_SIZE, SUBSTEPS } from "./field.js";

export const GROUND = [15, 14, 13];
export const GRAIN = [239, 225, 197];
export const EXPOSURE = 0.8;
export const GRAIN_DIAMETER = 1.35;

function shader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function program(gl, vertex, fragment) {
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

/** Light is accumulated from the grains themselves. No nodal line is stroked. */
export function createGrainView(scale) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = LOGICAL_SIZE * scale;
  const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error("WebGL2 is not available.");
  if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("Floating-point colour buffers are not available.");

  const points = program(gl, `#version 300 es
    in vec2 position;
    void main() {
      vec2 pixel = ${PLATE_INSET}.0 + ${PLATE_SIZE}.0 * position;
      gl_Position = vec4(2.0 * pixel.x / ${LOGICAL_SIZE}.0 - 1.0, 1.0 - 2.0 * pixel.y / ${LOGICAL_SIZE}.0, 0.0, 1.0);
      gl_PointSize = ${GRAIN_DIAMETER * scale};
    }`, `#version 300 es
    precision highp float;
    out vec4 light;
    void main() {
      float radius = length(2.0 * gl_PointCoord - 1.0);
      float cover = pow(max(0.0, 1.0 - radius), 1.5);
      light = vec4(cover / ${SUBSTEPS}.0, 0.0, 0.0, 1.0);
    }`);
  const paper = program(gl, `#version 300 es
    in vec2 corner;
    void main() { gl_Position = vec4(corner, 0.0, 1.0); }`, `#version 300 es
    precision highp float;
    uniform sampler2D grains;
    out vec4 colour;
    void main() {
      float amount = texelFetch(grains, ivec2(gl_FragCoord.xy), 0).r;
      float light = 1.0 - exp(-${EXPOSURE} * amount);
      vec3 ground = vec3(${GROUND.map((value) => (value / 255).toFixed(10)).join(", ")});
      vec3 grain = vec3(${GRAIN.map((value) => (value / 255).toFixed(10)).join(", ")});
      colour = vec4(mix(ground, grain, light), 1.0);
    }`);

  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, canvas.width, canvas.height, 0, gl.RGBA, gl.HALF_FLOAT, null);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("Grain buffer is incomplete.");

  const pointArray = gl.createVertexArray();
  gl.bindVertexArray(pointArray);
  const positions = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positions);
  const position = gl.getAttribLocation(points, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const paperArray = gl.createVertexArray();
  gl.bindVertexArray(paperArray);
  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(paper, "corner");
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(paper);
  gl.uniform1i(gl.getUniformLocation(paper, "grains"), 0);
  gl.viewport(0, 0, canvas.width, canvas.height);

  return {
    canvas,
    gl,
    draw(state) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(points);
      gl.bindVertexArray(pointArray);
      gl.bindBuffer(gl.ARRAY_BUFFER, positions);
      for (const sample of state.shutter) {
        gl.bufferData(gl.ARRAY_BUFFER, sample, gl.STREAM_DRAW);
        gl.drawArrays(gl.POINTS, 0, state.count);
      }
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(paper);
      gl.bindVertexArray(paperArray);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };
}
