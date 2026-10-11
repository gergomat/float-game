import * as THREE from 'three';
import { Input } from './input';
import { Raft } from './raft';
import { waveHeight } from './waves';

const EYE = 1.65;
const RADIUS = 0.3;
const GRAVITY = 18;
const WALK = 3.2;
const SPRINT = 5.2;
const SWIM = 2.4;
const JUMP = 5.6;
const CLIMB_REACH = 0.75;

export type PlayerState = 'deck' | 'air' | 'swim';

export class Player {
  /** Feet position in world space. */
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  state: PlayerState = 'deck';
  yaw = Math.PI * 0.75;
  pitch = -0.35;

  private readonly local = new THREE.Vector3();

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly raft: Raft) {}

  spawnOnRaft(): void {
    this.raft.toWorld(new THREE.Vector3(0.75, 0, 0.75), this.position);
    this.velocity.set(0, 0, 0);
    this.state = 'deck';
  }

  update(dt: number, input: Input, time: number): void {
    // Look
    this.yaw -= input.mouseDX * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch - input.mouseDY * 0.0022, -1.5, 1.5);

    // Desired horizontal direction from WASD, relative to where we look.
    const f = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
    const s = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = forward.multiplyScalar(f).add(right.multiplyScalar(s));
    if (wish.lengthSq() > 1) wish.normalize();

    const surface = waveHeight(this.position.x, this.position.z, time);

    switch (this.state) {
      case 'deck': {
        const speed = input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? SPRINT : WALK;
        this.position.addScaledVector(wish, speed * dt);
        this.raft.toLocal(this.position, this.local);
        if (this.raft.isOverDeck(this.local.x, this.local.z)) {
          this.local.y = this.raft.deckY;
          this.raft.toWorld(this.local, this.position);
          this.velocity.set(wish.x * speed, 0, wish.z * speed);
          if (input.wasPressed('Space')) {
            this.velocity.y = JUMP;
            this.state = 'air';
          }
        } else {
          // Walked off the edge.
          this.velocity.set(wish.x * speed, 0, wish.z * speed);
          this.state = 'air';
        }
        break;
      }
      case 'air': {
        // Keep most horizontal momentum, allow a little steering.
        const steer = 0.12;
        this.velocity.x += (wish.x * WALK - this.velocity.x) * steer;
        this.velocity.z += (wish.z * WALK - this.velocity.z) * steer;
        this.velocity.y -= GRAVITY * dt;
        this.position.addScaledVector(this.velocity, dt);
        this.raft.toLocal(this.position, this.local);
        const overDeck = this.raft.isOverDeck(this.local.x, this.local.z);
        if (this.velocity.y <= 0 && overDeck && this.local.y <= this.raft.deckY && this.local.y > this.raft.deckY - 0.6) {
          this.local.y = this.raft.deckY;
          this.raft.toWorld(this.local, this.position);
          this.velocity.y = 0;
          this.state = 'deck';
        } else if (this.position.y < surface - 0.6) {
          this.velocity.multiplyScalar(0.35); // splash
          this.state = 'swim';
        }
        break;
      }
      case 'swim': {
        this.velocity.x += (wish.x * SWIM - this.velocity.x) * Math.min(1, dt * 4);
        this.velocity.z += (wish.z * SWIM - this.velocity.z) * Math.min(1, dt * 4);
        // Buoyancy: spring the head towards the surface, damped.
        const target = surface - EYE + 0.32;
        this.velocity.y += ((target - this.position.y) * 30 - this.velocity.y * 8) * dt;
        this.position.addScaledVector(this.velocity, dt);

        this.raft.toLocal(this.position, this.local);
        const d = this.raft.distanceToDeck(this.local.x, this.local.z);
        if (d === 0) {
          // Surfaced under the raft somehow: put them on top.
          this.climb();
          break;
        }
        if (d < RADIUS) {
          // Don't swim through the raft: push outward.
          const p = this.raft.nearestDeckPoint(this.local.x, this.local.z, 0);
          const away = new THREE.Vector2(this.local.x - p.x, this.local.z - p.y).normalize().multiplyScalar(RADIUS);
          this.local.x = p.x + away.x;
          this.local.z = p.y + away.y;
          const y = this.position.y;
          this.raft.toWorld(this.local, this.position);
          this.position.y = y;
        }
        if (input.isDown('Space') && d < CLIMB_REACH) this.climb();
        break;
      }
    }

    this.camera.position.set(this.position.x, this.position.y + EYE, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  private climb(): void {
    this.raft.toLocal(this.position, this.local);
    const p = this.raft.nearestDeckPoint(this.local.x, this.local.z, 0.35);
    this.raft.toWorld(new THREE.Vector3(p.x, this.raft.deckY, p.y), this.position);
    this.velocity.set(0, 0, 0);
    this.state = 'deck';
  }
}
