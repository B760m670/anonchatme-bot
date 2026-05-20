import Phaser from 'phaser';
import type Joystick from '../ui/Joystick';

const CLAN_COLORS: Record<string, number> = {
  kage:  0xa855f7,
  hono:  0xef4444,
  koori: 0x38bdf8,
  kaze:  0x10b981,
  tetsu: 0x94a3b8,
};

const SPEED = 160;

function darkenColor(color: number, amount: number): number {
  const r = ((color >> 16) & 0xff);
  const g = ((color >> 8) & 0xff);
  const b = (color & 0xff);
  const f = (100 - amount) / 100;
  return (Math.floor(r * f) << 16) | (Math.floor(g * f) << 8) | Math.floor(b * f);
}

export default class Player extends Phaser.GameObjects.Container {
  private bodyGraphics: Phaser.GameObjects.Graphics;
  private trail: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private readonly clanColor: number;
  private readonly clan: string;
  private facingRight: boolean = true;
  private walkPhase: number = 0;
  private isMoving: boolean = false;

  declare body: Phaser.Physics.Arcade.Body;

  constructor(scene: Phaser.Scene, x: number, y: number, clan: string) {
    super(scene, x, y);

    this.clan = clan;
    this.clanColor = CLAN_COLORS[clan] ?? 0xffffff;

    this.bodyGraphics = scene.add.graphics();
    this.drawCharacter(0);

    this.add([this.bodyGraphics]);
    scene.add.existing(this);

    scene.physics.add.existing(this, false);
    // Body centered at container origin; character drawn head up, feet down
    this.body.setSize(28, 64);
    this.body.setOffset(-14, -32);
    this.body.setCollideWorldBounds(false);
    this.body.setMaxVelocity(SPEED, 800);

    this.setDepth(10);
    this.createTrail();
  }

  private drawCharacter(walkPhase: number): void {
    const g = this.bodyGraphics;
    g.clear();

    const cc  = this.clanColor;
    const dcc = darkenColor(cc, 35);

    // Walk-cycle offsets
    const sw  = Math.sin(walkPhase) * 9;   // leg stride
    const aw  = Math.sin(walkPhase) * 6;   // arm counter-swing

    // ── Ground shadow ──────────────────────────────────────────────────────
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(0, 30, 28, 7);

    // ── BACK LEG ──────────────────────────────────────────────────────────
    g.fillStyle(0x150800, 1);
    g.fillRect(-6 - sw, 4, 10, 22);
    g.fillStyle(0x0a0400, 1);
    g.fillRect(-8 - sw, 24, 14, 5);   // back boot

    // ── FRONT LEG ─────────────────────────────────────────────────────────
    g.fillStyle(0x241000, 1);
    g.fillRect(-3 + sw, 4, 10, 22);
    g.fillStyle(0x0d0600, 1);
    g.fillRect(-5 + sw, 24, 14, 5);   // front boot

    // ── HAKAMA (wide cloth over upper legs) ───────────────────────────────
    g.fillStyle(dcc, 0.88);
    g.fillRect(-12, 2, 24, 10);

    // ── TORSO / CHEST ARMOUR ──────────────────────────────────────────────
    g.fillStyle(cc, 0.92);
    g.fillRect(-10, -18, 20, 22);

    // Armour chest lines
    g.lineStyle(1, 0x000000, 0.2);
    g.strokeRect(-10, -18, 20, 22);
    g.lineStyle(1, 0xffffff, 0.12);
    g.beginPath(); g.moveTo(-8, -10); g.lineTo(8, -10); g.strokePath();
    g.beginPath(); g.moveTo(-8, -3);  g.lineTo(8, -3);  g.strokePath();

    // ── SHOULDER PADS ─────────────────────────────────────────────────────
    g.fillStyle(cc, 1);
    g.fillRect(-17, -18, 8, 7);
    g.fillRect(9, -18, 8, 7);

    // ── LEFT ARM (counter-swing) ──────────────────────────────────────────
    g.fillStyle(cc, 0.85);
    g.fillRect(-15, -15 + aw, 7, 16);

    // ── RIGHT ARM (sword grip arm) ────────────────────────────────────────
    g.fillStyle(cc, 0.85);
    g.fillRect(8, -15 - aw * 0.4, 7, 13);

    // ── KATANA ────────────────────────────────────────────────────────────
    // Tsuka (handle) - right hip
    const hx = 14, hy = -6;
    g.fillStyle(0x282018, 1);
    g.fillRect(hx - 2, hy, 5, 16);
    // Handle binding (gold)
    g.fillStyle(0xfbbf24, 0.9);
    g.fillRect(hx - 2, hy + 2, 5, 3);
    g.fillRect(hx - 2, hy + 8, 5, 3);
    // Tsuba (guard)
    g.fillStyle(0x1e1a14, 1);
    g.fillRect(hx - 5, hy - 2, 11, 4);
    // Habaki (gold collar)
    g.fillStyle(0xfbbf24, 1);
    g.fillRect(hx - 3, hy - 6, 7, 5);
    // Blade – diagonal pointing upper-right
    g.fillStyle(0xcacaca, 0.96);
    g.fillTriangle(hx - 3, hy - 6,  hx + 4, hy - 6,  hx + 24, hy - 38);
    // Edge shimmer
    g.lineStyle(1, 0xffffff, 0.65);
    g.beginPath();
    g.moveTo(hx, hy - 6);
    g.lineTo(hx + 24, hy - 38);
    g.strokePath();
    // Blade spine (darker)
    g.lineStyle(0.5, 0x888888, 0.4);
    g.beginPath();
    g.moveTo(hx - 2, hy - 6);
    g.lineTo(hx + 20, hy - 38);
    g.strokePath();

    // ── NECK ──────────────────────────────────────────────────────────────
    g.fillStyle(0xdaa87a, 1);
    g.fillRect(-3, -22, 6, 6);

    // ── HEAD ──────────────────────────────────────────────────────────────
    // Back-of-head (hair)
    const hairColor = cc === 0x94a3b8 ? 0x2d3f55 : 0x140a00;
    g.fillStyle(hairColor, 1);
    g.fillCircle(1, -30, 12);

    // Spiky anime hair (clan-tinted tips)
    g.fillStyle(cc, 0.9);
    g.fillTriangle(-9, -34, -3, -29, -7, -44);
    g.fillTriangle(-3, -32, 3, -32,  0, -46);
    g.fillTriangle( 3, -34,  9, -30,  7, -44);
    // Hair base cover
    g.fillStyle(hairColor, 1);
    g.fillRect(-11, -38, 22, 9);
    // Forehead band
    g.fillStyle(darkenColor(cc, 20), 0.7);
    g.fillRect(-10, -35, 20, 5);

    // Face skin
    g.fillStyle(0xdaa87a, 1);
    g.fillCircle(2, -29, 10);

    // ── ANIME EYES ────────────────────────────────────────────────────────
    // Eye whites
    g.fillStyle(0xf0e8d8, 1);
    g.fillEllipse(-3, -29, 6, 7);
    g.fillEllipse(5, -29, 6, 7);
    // Iris (clan-colored)
    g.fillStyle(cc, 0.85);
    g.fillEllipse(-3, -29, 4, 5);
    g.fillEllipse(5, -29, 4, 5);
    // Pupil
    g.fillStyle(0x0a0000, 1);
    g.fillCircle(-3, -29, 1.5);
    g.fillCircle(5, -29, 1.5);
    // Shine
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(-2, -30, 1);
    g.fillCircle(6, -30, 1);

    // Eyebrows (determined, slightly furrowed)
    g.lineStyle(1.5, hairColor, 1);
    g.beginPath(); g.moveTo(-7, -34); g.lineTo(-0.5, -32); g.strokePath();
    g.beginPath(); g.moveTo(8, -34);  g.lineTo(1.5, -32);  g.strokePath();

    // Mouth (firm, determined)
    g.lineStyle(1.2, 0x7a4a22, 0.8);
    g.beginPath(); g.moveTo(-2, -23); g.lineTo(2.5, -23); g.strokePath();

    // Nose bridge hint
    g.lineStyle(0.8, 0xb08050, 0.4);
    g.beginPath(); g.moveTo(1, -26); g.lineTo(0, -24); g.strokePath();

    // ── SUBTLE CLAN AURA ──────────────────────────────────────────────────
    g.fillStyle(cc, 0.05);
    g.fillCircle(0, -5, 36);
    g.fillStyle(cc, 0.07);
    g.fillCircle(0, -5, 24);
  }

  private createTrail(): void {
    if (!this.scene.textures.exists('pixel')) return;

    this.trail = this.scene.add.particles(this.x, this.y, 'pixel', {
      speed: { min: 5, max: 25 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.0, end: 0 },
      alpha: { start: 0.4, end: 0 },
      tint: this.clanColor,
      lifespan: 220,
      frequency: 45,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.trail.setDepth(9);
  }

  update(
    joystick: Joystick,
    cursors: Phaser.Types.Input.Keyboard.CursorKeys | null,
  ): void {
    const vec = joystick.getVector();

    let vx = vec.x * SPEED;
    let vy = vec.y * SPEED;

    if (cursors) {
      if (cursors.left.isDown)  vx = -SPEED;
      else if (cursors.right.isDown) vx = SPEED;
      if (cursors.up.isDown)    vy = -SPEED;
      else if (cursors.down.isDown)  vy = SPEED;
    }

    this.body.setVelocityX(vx);
    if (Math.abs(vy) > 10) {
      this.body.setVelocityY(vy);
    }

    this.isMoving = Math.abs(vx) > 5;

    if (this.isMoving) {
      this.walkPhase += 0.14;
    }

    // Redraw with current walk phase (neutral when stopped)
    this.drawCharacter(this.isMoving ? this.walkPhase : 0);

    // Flip container to face movement direction
    if (vx < -5 && this.facingRight) {
      this.facingRight = false;
      this.setScale(-1, 1);
    } else if (vx > 5 && !this.facingRight) {
      this.facingRight = true;
      this.setScale(1, 1);
    }

    if (this.trail) {
      this.trail.setPosition(this.x, this.y);
      this.trail.setFrequency(this.isMoving ? 30 : -1);
    }
  }

  destroy(fromScene?: boolean): void {
    this.trail?.destroy();
    super.destroy(fromScene);
  }
}
