/** Closed Catmull–Rom contour shared by the mask and visible liquid surface. */
export function orbContour(phase: number, level: number): string {
  'worklet';
  const v = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0));
  const t = Number.isFinite(phase) ? phase : 0;
  const amplitude = 4 + v * 10, stretch = Math.sin(t + .5) * (.025 + v * .075);
  const points: number[][] = [];
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const radius = 86 + amplitude * (.68 * Math.sin(angle * 2 + t) + .32 * Math.sin(angle * 3 - t * 2));
    points.push([100 + Math.cos(angle) * radius * (1 + stretch), 100 + Math.sin(angle) * radius * (1 - stretch * .7)]);
  }
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < 12; i++) {
    const p0 = points[(i + 11) % 12], p1 = points[i], p2 = points[(i + 1) % 12], p3 = points[(i + 2) % 12];
    d += `C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6},${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6},${p2[0]} ${p2[1]}`;
  }
  return d + 'Z';
}
