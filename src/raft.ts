import * as THREE from 'three';
import { waveHeight } from './waves';

export const TILE = 1.5; // metres per foundation tile
const THICKNESS = 0.16;
const FREEBOARD = 0.14; // how far the deck sits above the local water level

function plankTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const planks = 5;
  const w = c.width / planks;
  for (let i = 0; i < planks; i++) {
    const shade = 0.85 + Math.random() * 0.2;
    g.fillStyle = `rgb(${Math.round(150 * shade)}, ${Math.round(105 * shade)}, ${Math.round(62 * shade)})`;
    g.fillRect(i * w, 0, w, c.height);
    // grain
    g.strokeStyle = 'rgba(70, 40, 20, 0.25)';
    for (let k = 0; k < 7; k++) {
      g.beginPath();
      const x = i * w + 4 + Math.random() * (w - 8);
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 6, 80, x - 6, 170, x + 3, 256);
      g.stroke();
    }
    g.fillStyle = 'rgba(40, 22, 10, 0.8)';
    g.fillRect(i * w, 0, 3, c.height);
  }
  // nails
  g.fillStyle = '#3a3a3a';
  for (let i = 0; i < planks; i++) {
    for (const y of [18, 238]) {
      g.beginPath();
      g.arc(i * w + w / 2, y, 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const key = (i: number, j: number) => `${i},${j}`;

export class Raft {
  readonly group = new THREE.Group();
  private readonly tiles = new Map<string, THREE.Object3D>();
  private readonly deckMaterial: THREE.MeshStandardMaterial;
  private readonly sideMaterial: THREE.MeshStandardMaterial;
  private readonly floatMaterial: THREE.MeshStandardMaterial;
  private readonly inverse = new THREE.Matrix4();
  private pitch = 0;
  private roll = 0;

  constructor() {
    this.deckMaterial = new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.9 });
    this.sideMaterial = new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.95 });
    this.floatMaterial = new THREE.MeshStandardMaterial({ color: '#2f6fa8', roughness: 0.6 });
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this.addTile(i, j);
  }

  hasTile(i: number, j: number): boolean {
    return this.tiles.has(key(i, j));
  }

  addTile(i: number, j: number): void {
    if (this.hasTile(i, j)) return;
    const tile = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(TILE, THICKNESS, TILE), [
      this.sideMaterial, this.sideMaterial, this.deckMaterial, this.sideMaterial, this.sideMaterial, this.sideMaterial,
    ]);
    top.position.y = -THICKNESS / 2;
    top.castShadow = top.receiveShadow = true;
    tile.add(top);
    // Two plastic drums under each tile keep it afloat.
    for (const dx of [-0.38, 0.38]) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, TILE * 0.85, 14), this.floatMaterial);
      drum.rotation.x = Math.PI / 2;
      drum.position.set(dx, -THICKNESS - 0.14, 0);
      tile.add(drum);
    }
    tile.position.set(i * TILE, 0, j * TILE);
    this.tiles.set(key(i, j), tile);
    this.group.add(tile);
  }

  /** Centre of all tiles in raft-local space. */
  private centre(): THREE.Vector2 {
    const c = new THREE.Vector2();
    for (const t of this.tiles.values()) c.add(new THREE.Vector2(t.position.x, t.position.z));
    return c.divideScalar(Math.max(this.tiles.size, 1));
  }

  update(time: number, dt: number): void {
    // Sample the water at four points around the raft and float on them.
    const c = this.centre();
    const half = TILE * 1.2;
    const ox = this.group.position.x + c.x;
    const oz = this.group.position.z + c.y;
    const hF = waveHeight(ox, oz + half, time);
    const hB = waveHeight(ox, oz - half, time);
    const hR = waveHeight(ox + half, oz, time);
    const hL = waveHeight(ox - half, oz, time);
    const avg = (hF + hB + hR + hL) / 4;

    const targetPitch = Math.atan2(hB - hF, half * 2) * 0.7; // rotation about X
    const targetRoll = Math.atan2(hR - hL, half * 2) * 0.7; // rotation about Z
    const k = 1 - Math.exp(-dt * 3);
    this.pitch += (targetPitch - this.pitch) * k;
    this.roll += (targetRoll - this.roll) * k;

    const targetY = avg + FREEBOARD;
    this.group.position.y += (targetY - this.group.position.y) * (1 - Math.exp(-dt * 4));

    // Rotate around the raft's centre, not its first tile.
    const pivot = new THREE.Vector3(c.x, 0, c.y);
    const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(this.pitch, 0, this.roll));
    const m = new THREE.Matrix4()
      .makeTranslation(this.group.position.x, this.group.position.y, this.group.position.z)
      .multiply(new THREE.Matrix4().makeTranslation(pivot.x, 0, pivot.z))
      .multiply(rot)
      .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, 0, -pivot.z));
    this.group.matrixAutoUpdate = false;
    this.group.matrix.copy(m);
    this.group.matrixWorldNeedsUpdate = true;
    this.inverse.copy(m).invert();
  }

  toLocal(world: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(world).applyMatrix4(this.inverse);
  }

  toWorld(local: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(local).applyMatrix4(this.group.matrix);
  }

  /** True if raft-local (x, z) is over a tile, shrunk inward by `margin`. */
  isOverDeck(x: number, z: number, margin = 0): boolean {
    const i = Math.round(x / TILE);
    const j = Math.round(z / TILE);
    if (!this.hasTile(i, j)) return false;
    const fx = Math.abs(x - i * TILE);
    const fz = Math.abs(z - j * TILE);
    const h = TILE / 2 - margin;
    // Edges shared with a neighbouring tile are not real edges.
    const okX = fx <= h || this.hasTile(i + Math.sign(x - i * TILE), j);
    const okZ = fz <= h || this.hasTile(i, j + Math.sign(z - j * TILE));
    return okX && okZ;
  }

  /** Nearest point on the deck to raft-local (x, z), pulled `inset` metres inside the edge. */
  nearestDeckPoint(x: number, z: number, inset: number): THREE.Vector2 {
    let best = new THREE.Vector2();
    let bestD = Infinity;
    const h = TILE / 2 - inset;
    for (const t of this.tiles.values()) {
      const px = THREE.MathUtils.clamp(x, t.position.x - h, t.position.x + h);
      const pz = THREE.MathUtils.clamp(z, t.position.z - h, t.position.z + h);
      const d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = new THREE.Vector2(px, pz);
      }
    }
    return best;
  }

  /** Horizontal distance from raft-local (x, z) to the raft's edge (0 when over the deck). */
  distanceToDeck(x: number, z: number): number {
    const p = this.nearestDeckPoint(x, z, 0);
    return Math.hypot(p.x - x, p.y - z);
  }

  get deckY(): number {
    return 0;
  }

  get bottomY(): number {
    return -THICKNESS - 0.34;
  }
}
