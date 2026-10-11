// Wave field shared by the ocean shader (GLSL) and gameplay code (TS),
// so the raft and the swimmer float on exactly the surface you see.

export interface Wave {
  dirX: number;
  dirZ: number;
  amplitude: number; // metres
  wavelength: number; // metres
  speed: number; // metres / second
}

const norm = (x: number, z: number): [number, number] => {
  const l = Math.hypot(x, z);
  return [x / l, z / l];
};

const make = (dx: number, dz: number, amplitude: number, wavelength: number, speed: number): Wave => {
  const [dirX, dirZ] = norm(dx, dz);
  return { dirX, dirZ, amplitude, wavelength, speed };
};

export const WAVES: Wave[] = [
  make(1.0, 0.3, 0.32, 22, 4.2),
  make(0.6, 1.0, 0.18, 13, 3.1),
  make(-0.4, 0.9, 0.09, 7, 2.4),
  make(0.9, -0.7, 0.05, 3.5, 1.7),
];

/** Water surface height at world (x, z) and time t. */
export function waveHeight(x: number, z: number, t: number): number {
  let h = 0;
  for (const w of WAVES) {
    const k = (2 * Math.PI) / w.wavelength;
    h += w.amplitude * Math.sin(k * (w.dirX * x + w.dirZ * z - w.speed * t));
  }
  return h;
}

/** GLSL snippet defining waveHeight() and waveNormal() with the same waves. */
export function wavesGLSL(): string {
  const f = (n: number) => n.toFixed(5);
  const terms = WAVES.map((w) => {
    const k = (2 * Math.PI) / w.wavelength;
    return { ...w, k };
  });
  const hLines = terms
    .map((w) => `  h += ${f(w.amplitude)} * sin(${f(w.k)} * (dot(vec2(${f(w.dirX)}, ${f(w.dirZ)}), p) - ${f(w.speed)} * t));`)
    .join('\n');
  const nLines = terms
    .map((w) => {
      const c = `${f(w.amplitude * w.k)} * cos(${f(w.k)} * (dot(vec2(${f(w.dirX)}, ${f(w.dirZ)}), p) - ${f(w.speed)} * t))`;
      return `  d += vec2(${f(w.dirX)}, ${f(w.dirZ)}) * ${c};`;
    })
    .join('\n');
  return `
float waveHeight(vec2 p, float t) {
  float h = 0.0;
${hLines}
  return h;
}
vec3 waveNormal(vec2 p, float t) {
  vec2 d = vec2(0.0);
${nLines}
  return normalize(vec3(-d.x, 1.0, -d.y));
}
`;
}
