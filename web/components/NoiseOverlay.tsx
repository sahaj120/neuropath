"use client";

/**
 * Tactile film grain: a fixed SVG-noise veil over the viewport at 40%
 * opacity with an overlay blend, giving the digital UI a physical finish.
 * Pointer events pass straight through.
 */
const NOISE_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

export default function NoiseOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[120]"
      style={{ backgroundImage: NOISE_URI, mixBlendMode: "overlay", opacity: 0.4 }}
    />
  );
}
