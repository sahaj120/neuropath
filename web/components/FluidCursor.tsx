"use client";

import { useEffect, useRef } from "react";

type RGB = [number, number, number];

const SIM = 128;
const DYE_RES = 256;
const DYE_DECAY = 0.985;
const VEL_DECAY = 0.94;
const SPLAT_RADIUS = 0.012;
const SPLAT_FORCE = 140;

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const SPLAT_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform float uAspect;
uniform float uRadius;
uniform vec3 uValue;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  float g = exp(-dot(p, p) / (uRadius * uRadius));
  vec3 base = texture2D(uTarget, vUv).rgb;
  gl_FragColor = vec4(base + g * uValue, 1.0);
}`;

const ADVECT_DYE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform float uDt;
uniform float uDecay;
void main() {
  vec2 vel = texture2D(uVelocity, vUv).rg * 2.0 - 1.0;
  vec2 uv = vUv - vel * uDt;
  vec3 c = texture2D(uSource, uv).rgb;
  gl_FragColor = vec4(c * uDecay, 1.0);
}`;

const ADVECT_VEL_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform float uDt;
uniform float uDecay;
void main() {
  vec2 vel = texture2D(uVelocity, vUv).rg * 2.0 - 1.0;
  vec2 uv = vUv - vel * uDt;
  vec3 c = texture2D(uSource, uv).rgb;
  gl_FragColor = vec4(mix(vec3(0.5), c, uDecay), 1.0);
}`;

const DISPLAY_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uDye;
void main() {
  vec3 c = texture2D(uDye, vUv).rgb;
  float a = clamp(max(max(c.r, c.g), c.b) * 1.4, 0.0, 0.9);
  gl_FragColor = vec4(c * 1.1, a);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("shader alloc failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`shader: ${gl.getShaderInfoLog(sh) ?? "unknown"}`);
  }
  return sh;
}

function program(gl: WebGLRenderingContext, frag: string): WebGLProgram {
  const pr = gl.createProgram();
  if (!pr) throw new Error("program alloc failed");
  gl.attachShader(pr, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(pr, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
    throw new Error(`link: ${gl.getProgramInfoLog(pr) ?? "unknown"}`);
  }
  return pr;
}

interface Target {
  tex: WebGLTexture | null;
  fbo: WebGLFramebuffer | null;
  w: number;
  h: number;
}

function makeTarget(gl: WebGLRenderingContext, w: number, h: number): Target {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.clearColor(0.5, 0.5, 0.5, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo, w, h };
}

function clearTarget(gl: WebGLRenderingContext, t: Target, r: number, g: number, b: number) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
  gl.clearColor(r, g, b, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

/**
 * GPU smoke trail that follows the cursor. Dye and velocity live in small
 * float-free byte textures, advected every frame with heavy dissipation so
 * the trail blooms then melts away. Palette follows the AI triage state.
 */
export default function FluidCursor({ palette }: { palette: [RGB, RGB] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteRef = useRef(palette);
  paletteRef.current = palette;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    let raf = 0;
    let dead = false;
    const disposables: Array<() => void> = [];
    const on = <K extends keyof WindowEventMap>(
      type: K,
      fn: (e: WindowEventMap[K]) => void,
      opts?: AddEventListenerOptions
    ) => {
      window.addEventListener(type, fn, opts);
      disposables.push(() => window.removeEventListener(type, fn, opts));
    };

    try {
      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

      const splatP = program(gl, SPLAT_FRAG);
      const advDyeP = program(gl, ADVECT_DYE_FRAG);
      const advVelP = program(gl, ADVECT_VEL_FRAG);
      const showP = program(gl, DISPLAY_FRAG);

      const bindQuad = (pr: WebGLProgram) => {
        const loc = gl.getAttribLocation(pr, "aPos");
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      };
      const texUnit = (pr: WebGLProgram, name: string, unit: number, tex: WebGLTexture | null) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(gl.getUniformLocation(pr, name), unit);
      };
      const drawTo = (t: Target | null) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
        gl.viewport(0, 0, t ? t.w : canvas.width, t ? t.h : canvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      let vel = makeTarget(gl, SIM, SIM);
      let vel2 = makeTarget(gl, SIM, SIM);
      let dye = makeTarget(gl, DYE_RES, DYE_RES);
      let dye2 = makeTarget(gl, DYE_RES, DYE_RES);
      clearTarget(gl, vel, 0.5, 0.5, 0.5);
      clearTarget(gl, vel2, 0.5, 0.5, 0.5);
      clearTarget(gl, dye, 0, 0, 0);
      clearTarget(gl, dye2, 0, 0, 0);

      const resize = () => {
        const w = Math.min(window.innerWidth, 1600);
        const h = Math.min(window.innerHeight, 1000);
        canvas.width = Math.floor(w);
        canvas.height = Math.floor(h);
      };
      resize();

      const pointer = { x: 0.5, y: 0.5, dx: 0, dy: 0, down: false, moved: false };
      let lastX = -1;
      let lastY = -1;
      on("mousemove", (e: MouseEvent) => {
        const x = e.clientX / window.innerWidth;
        const y = 1 - e.clientY / window.innerHeight;
        if (lastX >= 0) {
          pointer.dx += x - lastX;
          pointer.dy += y - lastY;
        }
        lastX = x;
        lastY = y;
        pointer.x = x;
        pointer.y = y;
        pointer.moved = true;
      });
      on("mousedown", () => {
        pointer.down = true;
      });
      on("mouseup", () => {
        pointer.down = false;
      });
      on("resize", resize);
      on("blur", () => {
        lastX = -1;
      });
      const onVis = () => {
        if (document.hidden) {
          lastX = -1;
          pointer.dx = 0;
          pointer.dy = 0;
        }
      };
      document.addEventListener("visibilitychange", onVis);
      disposables.push(() => document.removeEventListener("visibilitychange", onVis));

      const aspect = () => canvas.width / Math.max(1, canvas.height);
      let tick = 0;

      const splat = (
        pr: WebGLProgram,
        target: Target,
        read: WebGLTexture | null,
        px: number,
        py: number,
        v: [number, number, number]
      ) => {
        gl.useProgram(pr);
        bindQuad(pr);
        texUnit(pr, "uTarget", 0, read);
        gl.uniform2f(gl.getUniformLocation(pr, "uPoint"), px, py);
        gl.uniform1f(gl.getUniformLocation(pr, "uAspect"), aspect());
        gl.uniform1f(gl.getUniformLocation(pr, "uRadius"), SPLAT_RADIUS);
        gl.uniform3f(gl.getUniformLocation(pr, "uValue"), v[0], v[1], v[2]);
        drawTo(target);
      };

      const frame = () => {
        if (dead) return;
        raf = requestAnimationFrame(frame);
        if (document.hidden) return;
        tick++;

        // Pointer splats: velocity from cursor travel, dye tinted by palette.
        if (pointer.moved) {
          const pal = paletteRef.current;
          const mix = (Math.sin(tick * 0.05) + 1) / 2;
          const c: RGB = [
            pal[0][0] * (1 - mix) + pal[1][0] * mix,
            pal[0][1] * (1 - mix) + pal[1][1] * mix,
            pal[0][2] * (1 - mix) + pal[1][2] * mix,
          ];
          const boost = pointer.down ? 2.2 : 1;
          splat(splatP, vel2, vel.tex, pointer.x, pointer.y, [
            pointer.dx * SPLAT_FORCE * 0.5 + 0.5,
            pointer.dy * SPLAT_FORCE * 0.5 + 0.5,
            0.5,
          ]);
          [vel, vel2] = [vel2, vel];
          splat(splatP, dye2, dye.tex, pointer.x, pointer.y, [
            c[0] * 0.32 * boost,
            c[1] * 0.32 * boost,
            c[2] * 0.32 * boost,
          ]);
          [dye, dye2] = [dye2, dye];
          pointer.dx = 0;
          pointer.dy = 0;
          pointer.moved = false;
        }

        // Advect velocity, then dye through it.
        gl.useProgram(advVelP);
        bindQuad(advVelP);
        texUnit(advVelP, "uVelocity", 0, vel.tex);
        texUnit(advVelP, "uSource", 1, vel.tex);
        gl.uniform1f(gl.getUniformLocation(advVelP, "uDt"), 0.016);
        gl.uniform1f(gl.getUniformLocation(advVelP, "uDecay"), VEL_DECAY);
        drawTo(vel2);
        [vel, vel2] = [vel2, vel];

        gl.useProgram(advDyeP);
        bindQuad(advDyeP);
        texUnit(advDyeP, "uVelocity", 0, vel.tex);
        texUnit(advDyeP, "uSource", 1, dye.tex);
        gl.uniform1f(gl.getUniformLocation(advDyeP, "uDt"), 0.016);
        gl.uniform1f(gl.getUniformLocation(advDyeP, "uDecay"), DYE_DECAY);
        drawTo(dye2);
        [dye, dye2] = [dye2, dye];

        // Composite softly over the page.
        gl.useProgram(showP);
        bindQuad(showP);
        texUnit(showP, "uDye", 0, dye.tex);
        drawTo(null);
      };
      raf = requestAnimationFrame(frame);

      return () => {
        dead = true;
        cancelAnimationFrame(raf);
        disposables.forEach((fn) => fn());
        try {
          const ext = gl.getExtension("WEBGL_lose_context");
          ext?.loseContext();
        } catch {
          /* already gone */
        }
      };
    } catch {
      /* WebGL unavailable: fail silent, the page stays fully usable */
      disposables.forEach((fn) => fn());
      return undefined;
    }
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }}>
      <canvas ref={canvasRef} className="h-full w-full opacity-70" />
    </div>
  );
}
