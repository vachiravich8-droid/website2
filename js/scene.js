// 3D terrain flyover in raw WebGL2. Scroll lifts the camera from the valley floor to a top-down map view.

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
uniform mat4 uViewProj;
uniform float uTravel;
uniform float uCell;
out float vHeight;
out vec3 vLocal;
out vec2 vWorld;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 5; i++) { sum += amp * noise(p); p = p * 2.03 + 11.7; amp *= 0.5; }
  return sum;
}
float terrain(vec2 w) {
  float hills = fbm(w * 0.05);
  float ridge = 1.0 - abs(2.0 * noise(w * 0.021 + 7.3) - 1.0);
  float h = hills * hills * 11.0 + ridge * ridge * 5.5;
  float valley = smoothstep(1.5, 17.0, abs(w.x + sin(w.y * 0.03) * 3.0));
  return h * mix(0.1, 1.0, valley);
}
void main() {
  // The mesh only slides by one cell and snaps back; the noise coordinate carries the real travel.
  vec2 local = vec2(aPos.x, aPos.y + mod(uTravel, uCell));
  vWorld = vec2(local.x, local.y - uTravel);
  vHeight = terrain(vWorld);
  vLocal = vec3(local.x, vHeight, local.y);
  gl_Position = uViewProj * vec4(vLocal, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in float vHeight;
in vec3 vLocal;
in vec2 vWorld;
uniform vec3 uCam;
uniform float uTime;
uniform float uLift;
out vec4 outColor;

const vec3 INK = vec3(0.043, 0.063, 0.051);
const vec3 LINE = vec3(0.27, 0.38, 0.31);
const vec3 PAPER = vec3(0.66, 0.65, 0.56);
const vec3 HOT = vec3(1.0, 0.353, 0.122);
const vec3 LIVE = vec3(0.725, 0.95, 0.294);

float band(float v, float width) {
  float d = abs(fract(v - 0.5) - 0.5) / fwidth(v);
  return 1.0 - clamp(d / width, 0.0, 1.0);
}
void main() {
  vec3 normal = normalize(cross(dFdx(vLocal), dFdy(vLocal)));
  float light = clamp(dot(normal, normalize(vec3(-0.5, 0.75, 0.35))), 0.0, 1.0);
  vec3 color = INK * (0.75 + light * 1.5) + vec3(0.0, 0.012, 0.006) * vHeight;

  float level = vHeight / 0.85;
  float minor = band(level, 1.0);
  float major = band(level / 5.0, 1.6);
  float peak = smoothstep(7.5, 11.5, vHeight);
  color = mix(color, mix(LINE, HOT, peak), minor * 0.7);
  color = mix(color, mix(PAPER, HOT, peak), major * 0.85);

  vec2 cell = vWorld / 8.8;
  vec2 gridDist = abs(fract(cell - 0.5) - 0.5) / fwidth(cell);
  color += LINE * (1.0 - clamp(min(gridDist.x, gridDist.y), 0.0, 1.0)) * 0.22 * uLift;

  float ground = length(vLocal.xz - uCam.xz);
  float radius = fract(uTime / 7.0) * 150.0;
  float pulse = exp(-pow((ground - radius) / 2.2, 2.0)) * (1.0 - radius / 150.0);
  color += LIVE * pulse * (0.1 + 0.9 * max(minor, major));

  float fog = smoothstep(26.0, 118.0, length(vLocal - uCam) - uCam.y * 0.92);
  outColor = vec4(mix(color, INK, fog), 1.0);
}`;

const COLS = 168, ROWS = 200, CELL = 1.1, FAR_Z = -172;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}
function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0]);
}
const rotateX = (a) => new Float32Array([1, 0, 0, 0, 0, Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1]);
const rotateY = (a) => new Float32Array([Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1]);
const rotateZ = (a) => new Float32Array([Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const translate = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);

export function createScene(canvas, calm) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (err) {
    console.warn('3D background disabled:', err.message);
    return null;
  }
  gl.useProgram(program);
  const uniform = (name) => gl.getUniformLocation(program, name);
  const uViewProj = uniform('uViewProj'), uTravel = uniform('uTravel'), uCam = uniform('uCam'), uTime = uniform('uTime'), uLift = uniform('uLift');
  gl.uniform1f(uniform('uCell'), CELL);

  const positions = new Float32Array(COLS * ROWS * 2);
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    positions[(j * COLS + i) * 2] = (i - (COLS - 1) / 2) * CELL;
    positions[(j * COLS + i) * 2 + 1] = FAR_Z + j * CELL;
  }
  const indices = new Uint32Array((COLS - 1) * (ROWS - 1) * 6);
  for (let j = 0, k = 0; j < ROWS - 1; j++) for (let i = 0; i < COLS - 1; i++) {
    const a = j * COLS + i, b = a + 1, c = a + COLS, d = c + 1;
    indices.set([a, c, b, b, c, d], k); k += 6;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.043, 0.063, 0.051, 1);

  const state = { target: 0, lift: 0, boost: 0, travel: 0, time: 0, px: 0, py: 0, sx: 0, sy: 0 };
  let last = performance.now();

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.6);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }

  function draw() {
    resize();
    const e = state.lift * state.lift * (3 - 2 * state.lift);
    const cam = [state.sx * 1.4 * (1 - e), 5.6 + e * 78, -e * 62];
    const pitch = -0.1 - e * 1.36 + state.sy * 0.05 * (1 - e);
    const yaw = -state.sx * 0.13 * (1 - e) + Math.sin(state.time * 0.11) * 0.035 + e * 0.38;
    const view = multiply(rotateZ(state.sx * 0.035), multiply(rotateX(-pitch), multiply(rotateY(-yaw), translate(-cam[0], -cam[1], -cam[2]))));
    gl.uniformMatrix4fv(uViewProj, false, multiply(perspective(0.96, canvas.width / canvas.height, 0.5, 400), view));
    gl.uniform3f(uCam, cam[0], cam[1], cam[2]);
    gl.uniform1f(uTravel, state.travel);
    gl.uniform1f(uTime, state.time);
    gl.uniform1f(uLift, e);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden) {
      state.lift += (state.target - state.lift) * Math.min(1, dt * 4.5);
      state.sx += (state.px - state.sx) * Math.min(1, dt * 3);
      state.sy += (state.py - state.sy) * Math.min(1, dt * 3);
      if (!calm) {
        state.time += dt;
        state.travel += dt * (2.4 * (1 - state.lift * 0.65) + state.boost);
        state.boost *= Math.pow(0.02, dt);
      }
      draw();
    }
    requestAnimationFrame(frame);
  }

  if (!calm) {
    addEventListener('pointermove', (ev) => {
      state.px = (ev.clientX / innerWidth) * 2 - 1;
      state.py = (ev.clientY / innerHeight) * 2 - 1;
    });
  }
  draw();
  requestAnimationFrame(frame);

  return {
    /** progress: 0 at the top of the page, 1 at the bottom. velocity: scroll pixels per frame. */
    set(progress, velocity) {
      state.target = progress;
      state.boost = Math.min(26, Math.max(state.boost, Math.abs(velocity) * 0.5));
    },
  };
}
