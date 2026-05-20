// /home/user/anonchatme-bot/webapp/lib/game/phaser/ui/Joystick.ts

import Phaser from 'phaser';

export default class Joystick extends Phaser.GameObjects.Container {
  private outerRing: Phaser.GameObjects.Graphics;
  private thumb: Phaser.GameObjects.Graphics;

  private readonly outerRadius: number = 50;
  private readonly thumbRadius: number = 22;

  private baseX: number;
  private baseY: number;

  private vectorX: number = 0;
  private vectorY: number = 0;

  private activePointerId: number = -1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.baseX = x;
    this.baseY = y;

    // Outer ring
    this.outerRing = scene.add.graphics();
    this.drawOuter();
    this.add(this.outerRing);

    // Inner thumb
    this.thumb = scene.add.graphics();
    this.drawThumb(0, 0);
    this.add(this.thumb);

    // Fix to camera so it doesn't scroll with the world
    this.setScrollFactor(0);
    this.setDepth(100);

    scene.add.existing(this);

    this.setupInput();
  }

  private drawOuter(): void {
    this.outerRing.clear();
    this.outerRing.lineStyle(2, 0xffffff, 0.35);
    this.outerRing.fillStyle(0xffffff, 0.07);
    this.outerRing.fillCircle(0, 0, this.outerRadius);
    this.outerRing.strokeCircle(0, 0, this.outerRadius);
  }

  private drawThumb(dx: number, dy: number): void {
    this.thumb.clear();
    this.thumb.fillStyle(0xffffff, 0.7);
    this.thumb.fillCircle(dx, dy, this.thumbRadius);
    // Subtle inner highlight
    this.thumb.fillStyle(0xffffff, 0.3);
    this.thumb.fillCircle(dx - 4, dy - 4, this.thumbRadius * 0.45);
  }

  private setupInput(): void {
    const scene = this.scene;

    scene.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (pointer: Phaser.Input.Pointer) => {
        if (this.activePointerId !== -1) return;

        const px = pointer.x;
        const py = pointer.y;

        // Only activate if touch is within the joystick area (generous hit zone)
        const dx = px - this.x;
        const dy = py - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this.outerRadius * 1.5) {
          this.activePointerId = pointer.id;
          this.handleMove(px, py);
        }
      }
    );

    scene.input.on(
      Phaser.Input.Events.POINTER_MOVE,
      (pointer: Phaser.Input.Pointer) => {
        if (pointer.id !== this.activePointerId) return;
        this.handleMove(pointer.x, pointer.y);
      }
    );

    scene.input.on(
      Phaser.Input.Events.POINTER_UP,
      (pointer: Phaser.Input.Pointer) => {
        if (pointer.id !== this.activePointerId) return;
        this.activePointerId = -1;
        this.vectorX = 0;
        this.vectorY = 0;
        this.drawThumb(0, 0);
      }
    );

    scene.input.on(
      Phaser.Input.Events.POINTER_UP_OUTSIDE,
      (pointer: Phaser.Input.Pointer) => {
        if (pointer.id !== this.activePointerId) return;
        this.activePointerId = -1;
        this.vectorX = 0;
        this.vectorY = 0;
        this.drawThumb(0, 0);
      }
    );
  }

  private handleMove(px: number, py: number): void {
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = this.outerRadius - this.thumbRadius;

    let clampedX: number;
    let clampedY: number;

    if (dist <= maxDist) {
      clampedX = dx;
      clampedY = dy;
    } else {
      const angle = Math.atan2(dy, dx);
      clampedX = Math.cos(angle) * maxDist;
      clampedY = Math.sin(angle) * maxDist;
    }

    this.drawThumb(clampedX, clampedY);

    // Normalize to -1..1
    if (dist > 4) {
      this.vectorX = clampedX / maxDist;
      this.vectorY = clampedY / maxDist;
    } else {
      this.vectorX = 0;
      this.vectorY = 0;
    }
  }

  /** Returns normalized joystick direction, each axis -1 to 1. */
  getVector(): { x: number; y: number } {
    return { x: this.vectorX, y: this.vectorY };
  }

  /** Call from scene update to keep thumb snapped to center when idle. */
  update(): void {
    // Intentionally left as hook for future per-frame logic.
  }

  /** Reposition the joystick base (e.g. on screen resize). */
  setBase(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.setPosition(x, y);
  }
}
