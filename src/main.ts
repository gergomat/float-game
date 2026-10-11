import * as THREE from 'three';
import { Input } from './input';
import { Ocean } from './ocean';
import { Player } from './player';
import { Raft } from './raft';
import { createSky, SKY_HORIZON } from './sky';
import { waveHeight } from './waves';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(SKY_HORIZON, 60, 280);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 2000);

const sunDir = new THREE.Vector3(0.5, 0.45, -0.6).normalize();
const sky = createSky(sunDir);
scene.add(sky);

scene.add(new THREE.HemisphereLight('#cfe9ff', '#1d5a73', 1.1));
const sun = new THREE.DirectionalLight('#fff3dd', 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = sun.shadow.camera.bottom = -8;
sun.shadow.camera.right = sun.shadow.camera.top = 8;
scene.add(sun, sun.target);

const ocean = new Ocean(sunDir, SKY_HORIZON);
scene.add(ocean.mesh);

const raft = new Raft();
scene.add(raft.group);
raft.update(0, 1);

const input = new Input(renderer.domElement);
const player = new Player(camera, raft);
player.spawnOnRaft();

// UI
const overlay = document.getElementById('overlay')!;
const playButton = document.getElementById('play')!;
const stateLabel = document.getElementById('state')!;
const underwater = document.getElementById('underwater')!;

const setPlaying = (playing: boolean) => {
  input.active = playing;
  overlay.classList.toggle('hidden', playing);
};
playButton.addEventListener('click', () => {
  setPlaying(true);
  // Pointer lock can be refused (embedded frames); drag-to-look still works then.
  Promise.resolve(renderer.domElement.requestPointerLock()).catch(() => {});
});
document.addEventListener('pointerlockchange', () => {
  if (!input.locked) setPlaying(false); // Esc releases the lock: show the menu
});
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && !input.locked) setPlaying(false);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const STATE_TEXT = { deck: 'On the raft', air: 'In the air', swim: 'Swimming: Space near the raft to climb up' };

const clock = new THREE.Clock();
let time = 0;

function tick(dt: number): void {
  time += dt;

  raft.update(time, dt);
  player.update(dt, input, time);
  ocean.update(time, camera);
  sky.position.copy(camera.position);

  sun.position.copy(player.position).addScaledVector(sunDir, 30);
  sun.target.position.copy(player.position);

  const under = camera.position.y < waveHeight(camera.position.x, camera.position.z, time);
  underwater.style.opacity = under ? '1' : '0';
  (sky.material as THREE.ShaderMaterial).uniforms.uUnder.value = under ? 1 : 0;
  stateLabel.textContent = STATE_TEXT[player.state];

  input.endFrame();
}

function frame(): void {
  tick(Math.min(clock.getDelta(), 1 / 20));
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handle for automated tests and debugging from the console.
(window as unknown as { game: unknown }).game = { player, raft, input, get time() { return time; },
  /** Advance the simulation by fixed 1/60 s steps (for tests). */
  step(seconds: number) { for (let i = 0; i < Math.round(seconds * 60); i++) tick(1 / 60); },
};
