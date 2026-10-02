// One particle is always one rectangle (two triangles), never additional dots.
// Full length/width use world units; the caller converts CSS px by stage height.
export function writeLine(positions, offset, cx, cy, angle, length, width) {
  const dx = Math.cos(angle) * length / 2, dy = Math.sin(angle) * length / 2;
  const nx = -Math.sin(angle) * width / 2, ny = Math.cos(angle) * width / 2;
  positions.set([
    cx - dx - nx, cy - dy - ny, 0,
    cx - dx + nx, cy - dy + ny, 0,
    cx + dx + nx, cy + dy + ny, 0,
    cx - dx - nx, cy - dy - ny, 0,
    cx + dx + nx, cy + dy + ny, 0,
    cx + dx - nx, cy + dy - ny, 0,
  ], offset);
}
