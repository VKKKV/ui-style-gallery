// Fixed-step damped springs; all distances are in source-image pixels.
export function stepParticles(positions, homes, velocity, pointer, radius, strength) {
  let energy = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i] - pointer.x;
    const dy = positions[i + 1] - pointer.y;
    const distance = Math.hypot(dx, dy);
    const force = pointer.active && distance < radius ? (1 - distance / radius) * strength : 0;
    const ux = distance > .001 ? dx / distance : 1;
    const uy = distance > .001 ? dy / distance : 0;
    velocity[i] = (velocity[i] + (homes[i] - positions[i]) * .025 + ux * force) * .86;
    velocity[i + 1] = (velocity[i + 1] + (homes[i + 1] - positions[i + 1]) * .025 + uy * force) * .86;
    velocity[i + 2] = (velocity[i + 2] - positions[i + 2] * .025 + force * .65) * .86;
    for (let axis = 0; axis < 3; axis++) {
      positions[i + axis] += velocity[i + axis];
      energy += Math.abs(velocity[i + axis]) + Math.abs(positions[i + axis] - homes[i + axis]);
    }
  }
  return energy / positions.length;
}
