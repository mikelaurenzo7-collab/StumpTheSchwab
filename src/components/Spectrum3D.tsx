"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * WebGL 3D Spectrum Visualizer
 *
 * Renders a floating-bar 3D spectrum using raw WebGL.
 * Bars rise from a "floor" with perspective projection, color-coded by
 * frequency (low = warm, high = cool), with a subtle glow and reflection.
 *
 * This is a self-contained WebGL renderer — no Three.js needed.
 */

const VERT_SHADER = `
  attribute vec2 a_position;
  attribute float a_height;
  attribute vec3 a_color;

  uniform mat4 u_projection;
  uniform mat4 u_view;
  uniform float u_time;

  varying vec3 v_color;
  varying float v_height;

  void main() {
    vec3 pos = vec3(a_position.x, a_position.y + a_height * 0.5, 0.0);
    // Slight perspective tilt
    pos.z = -pos.y * 0.15;
    gl_Position = u_projection * u_view * vec4(pos, 1.0);
    v_color = a_color;
    v_height = a_height;
  }
`;

const FRAG_SHADER = `
  precision mediump float;
  varying vec3 v_color;
  varying float v_height;

  uniform float u_time;

  void main() {
    // Glow effect — brighter at top of bar
    float glow = 0.6 + 0.4 * smoothstep(0.0, 1.0, v_height);
    vec3 col = v_color * glow;
    // Subtle pulse
    col += vec3(0.02, 0.01, 0.03) * sin(u_time * 2.0);
    gl_FragColor = vec4(col, 0.92);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const vShader = compileShader(gl, gl.VERTEX_SHADER, vs);
  const fShader = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!vShader || !fShader) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vShader);
  gl.attachShader(program, fShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function lookAt(eye: [number, number, number], center: [number, number, number], up: [number, number, number]): Float32Array {
  let z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
  let len = Math.hypot(z0, z1, z2);
  z0 /= len; z1 /= len; z2 /= len;
  let x0 = up[1] * z2 - up[2] * z1;
  let x1 = up[2] * z0 - up[0] * z2;
  let x2 = up[0] * z1 - up[1] * z0;
  len = Math.hypot(x0, x1, x2);
  x0 /= len; x1 /= len; x2 /= len;
  const y0 = z1 * x2 - z2 * x1;
  const y1 = z2 * x0 - z0 * x2;
  const y2 = z0 * x1 - z1 * x0;
  return new Float32Array([
    x0, y0, z0, 0,
    x1, y1, z1, 0,
    x2, y2, z2, 0,
    -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]),
    -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]),
    -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]),
    1,
  ]);
}

const BAR_COUNT = 64;

interface Spectrum3DProps {
  getSpectrum: () => Float32Array | null;
}

export function Spectrum3D({ getSpectrum }: Spectrum3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const buffersRef = useRef<{
    position: WebGLBuffer;
    height: WebGLBuffer;
    color: WebGLBuffer;
    indices: WebGLBuffer;
  } | null>(null);
  const uniformsRef = useRef<{
    projection: WebGLUniformLocation | null;
    view: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
  } | null>(null);
  const startTimeRef = useRef(Date.now());

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) return;
    glRef.current = gl;

    const program = createProgram(gl, VERT_SHADER, FRAG_SHADER);
    if (!program) return;
    programRef.current = program;
    gl.useProgram(program);

    // Attribute locations
    const aPos = gl.getAttribLocation(program, "a_position");
    const aHeight = gl.getAttribLocation(program, "a_height");
    const aColor = gl.getAttribLocation(program, "a_color");

    // Create geometry: quads for each bar
    const positions: number[] = [];
    const heights: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const barWidth = 1.8 / BAR_COUNT;
    const gap = barWidth * 0.15;
    const actualWidth = barWidth - gap;

    for (let i = 0; i < BAR_COUNT; i++) {
      const x = -0.9 + i * barWidth + gap / 2;
      const baseIdx = i * 4;

      // Four corners per bar (bottom-left, bottom-right, top-right, top-left)
      positions.push(x, 0, x + actualWidth, 0, x + actualWidth, 1, x, 1);
      heights.push(0, 0, 1, 1);

      // Color by frequency: low=red/orange, mid=yellow/green, high=blue/purple
      const t = i / BAR_COUNT;
      const r = Math.max(0, 1 - t * 1.5) + t * 0.3;
      const g = Math.max(0, 1 - Math.abs(t - 0.5) * 2) * 0.8;
      const b = t * 1.2;
      for (let c = 0; c < 4; c++) {
        colors.push(r, g, b);
      }

      // Two triangles per bar
      indices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
    }

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const heightBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, heightBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(heights), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aHeight);
    gl.vertexAttribPointer(aHeight, 1, gl.FLOAT, false, 0, 0);

    const colorBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);

    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    buffersRef.current = { position: posBuf!, height: heightBuf!, color: colorBuf!, indices: idxBuf! };

    uniformsRef.current = {
      projection: gl.getUniformLocation(program, "u_projection"),
      view: gl.getUniformLocation(program, "u_view"),
      time: gl.getUniformLocation(program, "u_time"),
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  }, []);

  useEffect(() => {
    init();
    const canvas = canvasRef.current;
    const gl = glRef.current;
    if (!canvas || !gl || !programRef.current || !buffersRef.current || !uniformsRef.current) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      if (!gl || !uniformsRef.current || !buffersRef.current) return;

      const spectrum = getSpectrum();
      const freqs = spectrum ? Array.from(spectrum) : [];

      // Smooth and reduce FFT bins to BAR_COUNT
      const smoothed = new Float32Array(BAR_COUNT);
      const binsPerBar = Math.max(1, Math.floor(freqs.length / BAR_COUNT));
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        let count = 0;
        for (let j = 0; j < binsPerBar; j++) {
          const idx = i * binsPerBar + j;
          if (idx < freqs.length) {
            const db = freqs[idx];
            // Convert dB-ish FFT values (usually -100..0) to 0..1
            const normalized = Math.max(0, Math.min(1, (db + 100) / 80));
            sum += normalized;
            count++;
          }
        }
        smoothed[i] = count > 0 ? sum / count : 0;
      }

      // Update heights buffer
      const newHeights: number[] = [];
      for (let i = 0; i < BAR_COUNT; i++) {
        const h = smoothed[i] * 0.7; // Scale to fit view
        newHeights.push(0, 0, h, h);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.height);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(newHeights));

      // Matrices
      const aspect = canvas.width / canvas.height;
      const proj = perspective(Math.PI / 4, aspect, 0.1, 100);
      const view = lookAt([0, 0.3, 1.2], [0, 0.15, 0], [0, 1, 0]);

      gl.uniformMatrix4fv(uniformsRef.current.projection, false, proj);
      gl.uniformMatrix4fv(uniformsRef.current.view, false, view);
      gl.uniform1f(uniformsRef.current.time, (Date.now() - startTimeRef.current) / 1000);

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, BAR_COUNT * 6, gl.UNSIGNED_SHORT, 0);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [getSpectrum, init]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}
