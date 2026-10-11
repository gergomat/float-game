import * as THREE from 'three';

export const SKY_TOP = new THREE.Color('#5d9fd6');
export const SKY_HORIZON = new THREE.Color('#cfe6f2');

/** Gradient sky dome with a sun disc. Follows the camera. */
export function createSky(sunDir: THREE.Vector3): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: SKY_TOP },
      uHorizon: { value: SKY_HORIZON },
      uSunDir: { value: sunDir.clone().normalize() },
      uUnder: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uSunDir;
      uniform float uUnder;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = mix(uHorizon, uTop, clamp(d.y * 1.6, 0.0, 1.0));
        float s = max(dot(d, uSunDir), 0.0);
        col += vec3(1.0, 0.9, 0.7) * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.25);
        // Seen from underwater: murky blue, brighter towards the surface.
        vec3 water = mix(vec3(0.02, 0.12, 0.18), vec3(0.1, 0.42, 0.5), clamp(d.y * 0.5 + 0.5, 0.0, 1.0));
        gl_FragColor = vec4(mix(col, water, uUnder), 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}
