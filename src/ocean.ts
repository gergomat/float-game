import * as THREE from 'three';
import { wavesGLSL } from './waves';

const SIZE = 600;
const SEGMENTS = 300;
const CELL = SIZE / SEGMENTS;

export class Ocean {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(sunDirection: THREE.Vector3, fogColor: THREE.Color) {
    const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
    geometry.rotateX(-Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: sunDirection.clone().normalize() },
        uFogColor: { value: fogColor.clone() },
        uFogNear: { value: 60 },
        uFogFar: { value: 280 },
        uDeep: { value: new THREE.Color('#0b3d5c') },
        uShallow: { value: new THREE.Color('#1f8a9e') },
        uSkyTop: { value: new THREE.Color('#5d9fd6') },
        uSkyHorizon: { value: new THREE.Color('#cfe6f2') },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vWorld;
        ${wavesGLSL()}
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          world.y = waveHeight(world.xz, uTime);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uSkyTop;
        uniform vec3 uSkyHorizon;
        varying vec3 vWorld;
        ${wavesGLSL()}

        // Small ripples layered on top of the big swell for sparkle.
        vec2 ripple(vec2 p, float t) {
          vec2 d = vec2(0.0);
          d += vec2(0.8, 0.6) * cos(dot(p, vec2(2.1, 1.3)) + t * 2.3);
          d += vec2(-0.5, 0.9) * cos(dot(p, vec2(-1.4, 2.6)) + t * 1.9);
          d += vec2(0.3, -1.0) * cos(dot(p, vec2(3.7, -2.2)) + t * 3.1);
          return d * 0.04;
        }

        void main() {
          vec3 n = waveNormal(vWorld.xz, uTime);
          n = normalize(n + vec3(ripple(vWorld.xz, uTime).x, 0.0, ripple(vWorld.xz, uTime).y));

          vec3 viewDir = normalize(cameraPosition - vWorld);
          bool below = cameraPosition.y < vWorld.y;
          if (below) n = -n;

          float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0);
          fresnel = mix(0.04, 1.0, fresnel);

          vec3 r = reflect(-viewDir, n);
          vec3 sky = mix(uSkyHorizon, uSkyTop, clamp(r.y * 1.6, 0.0, 1.0));

          float facing = max(dot(n, uSunDir), 0.0);
          vec3 water = mix(uDeep, uShallow, 0.35 + 0.65 * pow(facing, 3.0));
          // Light through wave crests.
          water += vec3(0.05, 0.18, 0.16) * smoothstep(0.15, 0.55, vWorld.y);

          vec3 col = mix(water, sky, fresnel * 0.85);
          float spec = pow(max(dot(r, uSunDir), 0.0), 220.0);
          col += vec3(1.0, 0.95, 0.85) * spec * 2.5;

          // Foam streaks on the highest crests.
          float foam = smoothstep(0.42, 0.6, vWorld.y + 0.05 * sin(vWorld.x * 3.0 + uTime) * sin(vWorld.z * 2.7));
          col = mix(col, vec3(0.92, 0.97, 1.0), foam * 0.55);

          if (below) col = mix(uShallow * 0.8, col, 0.4);

          float dist = length(cameraPosition - vWorld);
          float fog = smoothstep(uFogNear, uFogFar, dist);
          gl_FragColor = vec4(mix(col, uFogColor, fog), 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  update(time: number, camera: THREE.Camera): void {
    this.material.uniforms.uTime.value = time;
    // Keep the grid centred under the camera so the ocean feels endless.
    // Snapping to whole cells stops the vertices from swimming.
    this.mesh.position.x = Math.round(camera.position.x / CELL) * CELL;
    this.mesh.position.z = Math.round(camera.position.z / CELL) * CELL;
  }
}
