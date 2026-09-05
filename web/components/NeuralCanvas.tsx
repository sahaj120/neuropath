"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { readAnalyser } from "../lib/audioBus";

const COUNT = 2600;
const RADIUS = 1.6;

/** Fibonacci sphere with organic jitter: an abstract neural mesh. */
function useNeuralPositions() {
  return useMemo(() => {
    const base = new Float32Array(COUNT * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < COUNT; i++) {
      const y = 1 - (i / (COUNT - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      const j = () => (Math.random() - 0.5) * 0.3;
      base[i * 3] = Math.cos(theta) * r * RADIUS + j();
      base[i * 3 + 1] = y * RADIUS + j();
      base[i * 3 + 2] = Math.sin(theta) * r * RADIUS + j();
    }
    return base;
  }, []);
}

function NeuralMesh({ color }: { color: string }) {
  const points = useRef<THREE.Points>(null);
  const bass = useRef(0);
  const treble = useRef(0);
  const data = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const target = useRef(new THREE.Color(color));
  const base = useNeuralPositions();

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
    return g;
  }, [base]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.02,
        color,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    target.current.set(color);
  }, [color]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state, rawDelta) => {
    const pts = points.current;
    if (!pts) return;
    const delta = Math.min(rawDelta, 0.05);

    // Read live frequency data; decay to an idle float when silent.
    let bassTarget = 0;
    let trebleTarget = 0;
    const analyser = readAnalyser();
    if (analyser) {
      if (!data.current || data.current.length !== analyser.frequencyBinCount) {
        data.current = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(data.current);
      const d = data.current;
      const n = d.length;
      const bassBins = Math.max(2, Math.floor(n * 0.06));
      let b = 0;
      for (let i = 1; i <= bassBins; i++) b += d[i];
      bassTarget = b / (bassBins * 255);
      const trebleStart = Math.floor(n * 0.55);
      let t = 0;
      for (let i = trebleStart; i < n; i++) t += d[i];
      trebleTarget = t / (Math.max(1, n - trebleStart) * 255);
    }
    const k = 1 - Math.exp(-delta * 6);
    bass.current += (bassTarget - bass.current) * k;
    treble.current += (trebleTarget - treble.current) * k;

    // Ease particle color toward the triage mood.
    material.color.lerp(target.current, 1 - Math.exp(-delta * 3));

    // Bass pumps overall scale; treble ripples individual vertices.
    const s = 1 + bass.current * 0.15;
    pts.scale.setScalar(s);
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const t = state.clock.elapsedTime;
    const wobble = 0.02 + treble.current * 0.1;
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      const bx = base[ix];
      const by = base[ix + 1];
      const bz = base[ix + 2];
      const w = Math.sin(t * 0.6 + bx * 3 + by * 2 + bz * 2.4) * wobble;
      arr[ix] = bx + bx * w;
      arr[ix + 1] = by + by * w;
      arr[ix + 2] = bz + bz * w;
    }
    pos.needsUpdate = true;
    pts.rotation.y += delta * (0.05 + bass.current * 0.12);
    pts.rotation.x = Math.sin(t * 0.12) * 0.08;
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

/**
 * Full-screen GPU neural mesh fixed behind the UI. Bass scales the mesh,
 * treble displaces particles, and the triage color steers the mood.
 */
export default function NeuralCanvas({ color }: { color: string }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0" style={{ zIndex: -1 }}>
      <Canvas
        camera={{ position: [0, 0, 4.2], fov: 55 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <NeuralMesh color={color} />
      </Canvas>
    </div>
  );
}
