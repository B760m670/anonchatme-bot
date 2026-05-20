// /home/user/anonchatme-bot/webapp/lib/game/phaser/scenes/BootScene.ts

import Phaser from 'phaser';

/**
 * BootScene – creates all programmatic textures used throughout the game,
 * then immediately starts the Menu scene.
 *
 * No assets are loaded from disk; everything is drawn via Phaser's Graphics
 * API and baked into textures with generateTexture().
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create(): void {
    this.createPixelTexture();
    this.createCircle8Texture();
    this.createStarTexture();
    this.scene.start('Menu');
  }

  // ── Texture factories ──────────────────────────────────────────────────────

  /** 4×4 solid white pixel — used as the base for coloured particles. */
  private createPixelTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('pixel', 4, 4);
    g.destroy();
  }

  /** 8×8 anti-aliased white circle — for small glowing dots / particles. */
  private createCircle8Texture(): void {
    const size = 16;      // work at double-res, then sample at 8px
    const g = this.add.graphics();
    // Soft halo
    g.fillStyle(0xffffff, 0.25);
    g.fillCircle(size / 2, size / 2, size / 2);
    // Core
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(size / 2, size / 2, size / 2 - 2);
    // Bright centre
    g.fillStyle(0xffffff, 1);
    g.fillCircle(size / 2, size / 2, size / 4);
    g.generateTexture('circle8', size, size);
    g.destroy();
  }

  /** 12×12 six-point star shape — for sparkle effects. */
  private createStarTexture(): void {
    const g = this.add.graphics();
    const cx = 12;
    const cy = 12;
    const outerR = 10;
    const innerR = 4;
    const points = 6;

    g.fillStyle(0xffffff, 1);
    g.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const r     = i % 2 === 0 ? outerR : innerR;
      const px    = cx + Math.cos(angle) * r;
      const py    = cy + Math.sin(angle) * r;
      if (i === 0) {
        g.moveTo(px, py);
      } else {
        g.lineTo(px, py);
      }
    }
    g.closePath();
    g.fillPath();

    g.generateTexture('star', 24, 24);
    g.destroy();
  }
}
