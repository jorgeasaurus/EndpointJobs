// Slow cloud noise drawn at low resolution with a 4x4 ordered (Bayer) dither,
// quantised to a few dark teal tones and scaled up with crisp pixels.

/** CSS pixels per dither pixel. The canvas renders at 1/cellSize resolution. */
const cellSize = 3;
/** The clouds drift slowly, so 24 fps is enough and saves battery. */
const frameIntervalMs = 1000 / 24;

/** Darkest to brightest. The top tone stays dark enough for white text on top. */
const palette = ["#030506", "#071311", "#0c2622", "#13423b", "#1d6457"];

const vertexSource = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentSource = `
precision mediump float;
uniform vec2 resolution;
uniform float time;
uniform vec3 palette[5];

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 5; octave++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    amplitude *= 0.5;
  }
  return value;
}

float bayer2(vec2 a) {
  a = floor(a);
  return fract(dot(a, vec2(0.5, a.y * 0.75)));
}

// 4x4 ordered-dither threshold in [0, 1).
float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.y;
  vec2 warp = vec2(fbm(uv * 1.6 + time * 0.02), fbm(uv * 1.6 - time * 0.015 + 5.0));
  float density = smoothstep(0.25, 0.85, fbm(uv * 2.2 + warp * 1.4 + vec2(time * 0.012, 0.0)));
  float level = clamp(floor(density * 4.0 + bayer4(gl_FragCoord.xy)), 0.0, 4.0);

  vec3 color = palette[0];
  if (level > 0.5) color = palette[1];
  if (level > 1.5) color = palette[2];
  if (level > 2.5) color = palette[3];
  if (level > 3.5) color = palette[4];
  gl_FragColor = vec4(color, 1.0);
}`;

function hexToRgb(hex: string) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Mounts the dithered cloud canvas into `hostElement` and marks `fieldElement`
 * live once it draws. Returns a cleanup function, or undefined when WebGL is
 * unavailable (the CSS backdrop then stays on its own).
 */
export function mountDitherField(hostElement: HTMLDivElement, fieldElement: HTMLDivElement) {
  const canvas = document.createElement("canvas");
  canvas.dataset.endpointDitherCanvas = "true";
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false });
  if (!gl) return undefined;

  const vertexShader = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertexShader || !fragmentShader || !program) return undefined;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined;
  gl.useProgram(program);

  // One triangle that covers the whole viewport.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  gl.uniform3fv(gl.getUniformLocation(program, "palette"), new Float32Array(palette.flatMap(hexToRgb)));
  const resolution = gl.getUniformLocation(program, "resolution");
  const time = gl.getUniformLocation(program, "time");

  function resize() {
    if (!gl) return;
    canvas.width = Math.max(1, Math.ceil(hostElement.clientWidth / cellSize));
    canvas.height = Math.max(1, Math.ceil(hostElement.clientHeight / cellSize));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolution, canvas.width, canvas.height);
  }

  // Start mid-drift so the first frame is not the noise origin.
  const startOffsetSeconds = 40;
  let frame = 0;
  let lastDraw = -Infinity;
  function draw(now: number) {
    frame = requestAnimationFrame(draw);
    if (!gl || now - lastDraw < frameIntervalMs) return;
    lastDraw = now;
    gl.uniform1f(time, now / 1000 + startOffsetSeconds);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  hostElement.appendChild(canvas);
  resize();
  window.addEventListener("resize", resize);
  frame = requestAnimationFrame(draw);
  fieldElement.classList.add("parallax-field--live");

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", resize);
    fieldElement.classList.remove("parallax-field--live");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
  };
}
