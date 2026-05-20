// /home/user/anonchatme-bot/webapp/lib/game/phaser/objects/Player.ts

import Phaser from 'phaser';
import type Joystick from '../ui/Joystick';

const CLAN_COLORS: Record<string, number> = {
  kage:  0xa855f7,
  hono:  0xef4444,
  koori: 0x38bdf8,
  kaze:  0x10b981,
  tetsu: 0x94a3b8,
};

const CLAN_EMOJI: Record<string, string> = {
  kage:  '🌑',
  hono:  '🔥',
  koori: '❄️',
  kaze:  '💨',
  tetsu: '⚔️',
};

const SPEED = 160;

export default class Player extends Phaser.GameObjects.Container {
  private bodyGraphics: Phaser.GameObjects.Graphics;
  private katanaGraphics: Phaser.GameObjects.Graphics;
  private emojiText: Phaser.GameObjects.Text;
  private trail: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private readonly clanColor: number;
  private readonly clan: string;
  private facingRight: boolean = true;

  declare body: Phaser.Physics.Arcade.Body;

  constructor(scene: Phaser.Scene, x: number, y: number, clan: string) {
    super(scene, x, y);

    this.clan = clan;
    this.clanColor = CLAN_COLORS[clan] ?? 0xffffff;

    // ── Body circle ────────────────────────────────────────────────────────
    this.bodyGraphics = scene.add.graphics();
    this.drawBody();

    // ── Katana silhouette ──────────────────────────────────────────────────
    this.katanaGraphics = scene.add.graphics();
    this.drawKatana();

    // ── Clan emoji label ───────────────────────────────────────────────────
    this.emojiText = scene.add.text(20, -38, CLAN_EMOJI[clan] ?? '⚔️', {
      fontSize: '14px',
    }).setOrigin(0.5, 0.5);

    this.add([this.bodyGraphics, this.katanaGraphics, this.emojiText]);
    scene.add.existing(this);

    // ── Physics ────────────────────────────────────────────────────────────
    scene.physics.add.existing(this, false);
    this.body.setSize(64, 64);
    this.body.setOffset(-32, -32);
    this.body.setCollideWorldBounds(false);
    this.body.setMaxVelocity(SPEED, 800);

    this.setDepth(10);

    // ── Particle trail ─────────────────────────────────────────────────────
    this.createTrail();
  }

  // ── Drawing helpers ──────────────────────────────────────────────────────

  private drawBody(): void {
    const g = this.bodyGraphics;
    g.clear();

    // Soft glow (large, low-alpha circles behind)
    g.fillStyle(this.clanColor, 0.12);
    g.fillCircle(0, 0, 48);
    g.fillStyle(this.clanColor, 0.22);
    g.fillCircle(0, 0, 38);

    // Main body circle
    g.fillStyle(this.clanColor, 0.85);
    g.fillCircle(0, 0, 32);

    // Inner highlight
    g.fillStyle(0xffffff, 0.18);
    g.fillCircle(-8, -10, 14);

    // Dark border
    g.lineStyle(2, 0x000000, 0.6);
    g.strokeCircle(0, 0, 32);

    // Face: two white eyes
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(-9, -5, 4);
    g.fillCircle(9, -5, 4);

    // Pupils
    g.fillStyle(0x000000, 1);
    g.fillCircle(-8, -4, 2);
    g.fillCircle(10, -4, 2);

    // Determined scowl line
    g.lineStyle(1.5, 0x000000, 0.7);
    g.beginPath();
    g.moveTo(-8, 10);
    g.lineTo(8, 10);
    g.strokePath();
  }

  private drawKatana(): void {
    const g = this.katanaGraphics;
    g.clear();

    // Katana blade (long thin trapezoid to the right)
    g.fillStyle(0xd4d4d4, 0.95);
    g.fillTriangle(34, -2, 80, -1, 80, 1);   // blade face
    g.fillTriangle(34, 2, 80, -1, 80, 1);

    // Gold habaki (collar)
    g.fillStyle(0xfbbf24, 1);
    g.fillRect(30, -4, 8, 8);

    // Tsuba (guard) — small dark diamond
    g.fillStyle(0x1e1e1e, 1);
    g.fillRect(22, -5, 10, 10);

    // Handle wrapping (tsuka)
    g.fillStyle(0x292524, 1);
    g.fillRect(0, -4, 24, 8);
    // Handle binding diamonds
    g.fillStyle(0xfbbf24, 0.8);
    for (let i = 0; i < 4; i++) {
      g.fillRect(3 + i * 6, -2, 3, 4);
    }

    // Blade edge highlight
    g.lineStyle(1, 0xffffff, 0.5);
    g.beginPath();
    g.moveTo(34, -1);
    g.lineTo(80, -1);
    g.strokePath();
  }

  // ── Particle trail ────────────────────────────────────────────────────────

  private createTrail(): void {
    // Only create trail if the 'pixel' texture was registered in BootScene
    if (!this.scene.textures.exists('pixel')) return;

    this.trail = this.scene.add.particles(this.x, this.y, 'pixel', {
      speed: { min: 5, max: 20 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 0.55, end: 0 },
      tint: this.clanColor,
      lifespan: 320,
      frequency: 30,
      quantity: 2,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.trail.setDepth(9);
  }

  // ── Update (called every frame from the scene) ────────────────────────────

  update(
    joystick: Joystick,
    cursors: Phaser.Types.Input.Keyboard.CursorKeys | null,
  ): void {
    const vec = joystick.getVector();

    let vx = vec.x * SPEED;
    let vy = vec.y * SPEED;

    // Keyboard fallback
    if (cursors) {
      if (cursors.left.isDown) vx = -SPEED;
      else if (cursors.right.isDown) vx = SPEED;

      if (cursors.up.isDown) vy = -SPEED;
      else if (cursors.down.isDown) vy = SPEED;
    }

    this.body.setVelocityX(vx);

    // Only override vertical velocity when using joystick/keyboard horizontally
    // (gravity handles vertical; jump logic can be added later)
    if (Math.abs(vy) > 10) {
      // Allow up/down movement only when no gravity world (or flying world)
      // For samurai world with gravity we only set horizontal; comment out vy if needed
      this.body.setVelocityY(vy);
    }

    // Flip katana/emoji when changing direction
    if (vx < -5 && this.facingRight) {
      this.facingRight = false;
      this.katanaGraphics.setScale(-1, 1);
      this.emojiText.setX(-20);
    } else if (vx > 5 && !this.facingRight) {
      this.facingRight = true;
      this.katanaGraphics.setScale(1, 1);
      this.emojiText.setX(20);
    }

    // Update trail emitter position
    if (this.trail) {
      this.trail.setPosition(this.x, this.y);
      const moving = Math.abs(vx) > 5 || Math.abs(vy) > 5;
      this.trail.setFrequency(moving ? 30 : -1);
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy(fromScene?: boolean): void {
    this.trail?.destroy();
    super.destroy(fromScene);
  }
}
