/**
 * Shared live-audio bus: the player publishes its AnalyserNode once the
 * user presses play, and the 3D scene reads frequency data every frame.
 * Null until first playback, so the mesh idles gracefully before that.
 */

let analyser: AnalyserNode | null = null;

export function publishAnalyser(node: AnalyserNode | null): void {
  analyser = node;
}

export function readAnalyser(): AnalyserNode | null {
  return analyser;
}
