export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  /** True while the game is being played (not on the menu). */
  active = false;

  constructor(private readonly target: HTMLElement) {
    addEventListener('keydown', (e) => {
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    // With pointer lock, any mouse movement looks around. Where the browser
    // refuses pointer lock (e.g. inside an embedded frame), drag to look.
    addEventListener('mousemove', (e) => {
      if (!this.locked && !(this.active && e.buttons & 1)) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
  }

  get locked(): boolean {
    return document.pointerLockElement === this.target;
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True once per key press. */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** Call at the end of every frame. */
  endFrame(): void {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
