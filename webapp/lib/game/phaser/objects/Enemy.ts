// /home/user/anonchatme-bot/webapp/lib/game/phaser/objects/Enemy.ts

import Phaser from 'phaser';

const DETECTION_RADIUS = 120;
const PATROL_SPEED     = 55;
const CHASE_SPEED      = 90;

export default class Enemy extends Phaser.GameObjects.Container {
  private bodyGraphics: Phaser.GameObjects.Graphics;
  private healthBarBg: Phaser.GameObjects.Graphics;
  private healthBarFg: Phaser.GameObjects.Graphics;

  private readonly maxHp: number;
  private currentHp: number;
  private readonly enemyLevel: number;

  private patrolLeft: number;
  private patrolRight: number;
  private patrolDir: number = 1;          // 1 = moving right, -1 = moving left
  private chasing: boolean = false;
  private eyeGlowTime: number = 0;        // accumulated time for pulsing eye

  declare body: Phaser.Physics.Arcade.Body;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    level: number,
    patrolRange: number,
  ) {
    super(scene, x, y);

    this.enemyLevel = level;
    this.maxHp      = 60 + level * 20;
    this.currentHp  = this.maxHp;

    this.patrolLeft  = x - patrolRange;
    this.patrolRight = x + patrolRange;

    // ── Main body graphic ──────────────────────────────────────────────────
    this.bodyGraphics = scene.add.graphics();
    this.drawBody(0);

    // ── Health-bar (fixed above head) ──────────────────────────────────────
    this.healthBarBg = scene.add.graphics();
    this.healthBarFg = scene.add.graphics();
    this.drawHealthBar();

    this.add([this.bodyGraphics, this.healthBarBg, this.healthBarFg]);
    scene.add.existing(this);

    // ── Physics ────────────────────────────────────────────────────────────
    scene.physics.add.existing(this, false);
    this.body.setSize(56, 56);
    this.body.setOffset(-28, -28);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(CHASE_SPEED, 800);

    this.setDepth(8);
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  private drawBody(glowPulse: number): void {
    const g = this.bodyGraphics;
    g.clear();

    // Dark outer glow (pulsing red)
    const glowAlpha = 0.08 + glowPulse * 0.12;
    g.fillStyle(0xff0000, glowAlpha);
    g.fillCircle(0, 0, 44);
    g.fillStyle(0xff2200, glowAlpha * 0.7);
    g.fillCircle(0, 0, 36);

    // Body — dark charcoal circle
    g.fillStyle(0x1a1a2e, 1);
    g.fillCircle(0, 0, 28);

    // Armour plate texture lines
    g.lineStyle(1, 0x3a3a5a, 0.7);
    g.strokeCircle(0, 0, 28);
    g.lineStyle(1, 0x2a2a4a, 0.5);
    g.strokeCircle(0, 0, 22);

    // Glowing red eye (single, centered, anime style)
    const eyeGlow = 0.65 + glowPulse * 0.35;
    g.fillStyle(0xff0000, eyeGlow * 0.4);
    g.fillCircle(0, -4, 14);
    g.fillStyle(0xff2200, eyeGlow * 0.7);
    g.fillCircle(0, -4, 9);
    g.fillStyle(0xff4400, eyeGlow);
    g.fillCircle(0, -4, 5);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(-2, -6, 1.5);   // specular highlight

    // Mouth — jagged menacing line
    g.lineStyle(1.5, 0x550000, 0.9);
    g.beginPath();
    g.moveTo(-10, 12);
    g.lineTo(-5,  10);
    g.lineTo(-2,  14);
    g.lineTo(2,   10);
    g.lineTo(5,   14);
    g.lineTo(10,  12);
    g.strokePath();

    // Level indicator — small number badge
    g.fillStyle(0xcc0000, 1);
    g.fillCircle(18, -18, 9);
    g.lineStyle(1, 0xff4444, 0.8);
    g.strokeCircle(18, -18, 9);
  }

  private drawHealthBar(): void {
    const barW    = 60;
    const barH    = 6;
    const barY    = -46;
    const barX    = -barW / 2;
    const pct     = Math.max(0, this.currentHp / this.maxHp);

    this.healthBarBg.clear();
    this.healthBarBg.fillStyle(0x000000, 0.7);
    this.healthBarBg.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    this.healthBarFg.clear();
    if (pct > 0) {
      const color = pct > 0.5 ? 0xef4444 : (pct > 0.25 ? 0xf97316 : 0xfbbf24);
      this.healthBarFg.fillStyle(color, 1);
      this.healthBarFg.fillRect(barX, barY, barW * pct, barH);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Call from the scene's update() method every frame.
   */
  update(playerX: number, playerY: number): void {
    if (!this.active || this.currentHp <= 0) return;

    // Animate eye glow
    this.eyeGlowTime += 0.05;
    const pulse = (Math.sin(this.eyeGlowTime * 3) + 1) / 2;
    this.drawBody(pulse);

    // AI
    const dx   = playerX - this.x;
    const dy   = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < DETECTION_RADIUS) {
      // Chase player
      this.chasing = true;
      const angle  = Math.atan2(dy, dx);
      this.body.setVelocityX(Math.cos(angle) * CHASE_SPEED);
      // Only chase vertically in worlds without gravity; here keep y from physics
    } else {
      // Patrol
      this.chasing = false;
      this.body.setVelocityX(this.patrolDir * PATROL_SPEED);

      if (this.x >= this.patrolRight) {
        this.patrolDir = -1;
      } else if (this.x <= this.patrolLeft) {
        this.patrolDir = 1;
      }
    }

    // Flip graphic to face movement direction
    const vx = this.body.velocity.x;
    if (Math.abs(vx) > 5) {
      this.bodyGraphics.setScale(vx > 0 ? 1 : -1, 1);
    }
  }

  /**
   * Apply damage. Returns true if the enemy has died.
   */
  takeDamage(amount: number): boolean {
    if (this.currentHp <= 0) return true;

    this.currentHp = Math.max(0, this.currentHp - amount);
    this.drawHealthBar();

    // Brief red flash
    this.scene.tweens.add({
      targets: this.bodyGraphics,
      alpha: 0.3,
      duration: 80,
      yoyo: true,
      onComplete: () => { this.bodyGraphics.setAlpha(1); },
    });

    if (this.currentHp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  get hp(): number { return this.currentHp; }
  get level(): number { return this.enemyLevel; }
  get isAlive(): boolean { return this.currentHp > 0; }

  // ── Death ─────────────────────────────────────────────────────────────────

  private die(): void {
    this.body.setVelocity(0, 0);
    this.body.setEnable(false);

    // Particle burst on death
    if (this.scene.textures.exists('pixel')) {
      const burst = this.scene.add.particles(this.x, this.y, 'pixel', {
        speed: { min: 60, max: 180 },
        angle: { min: 0, max: 360 },
        scale: { start: 2, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xff2200, 0xff6600, 0xcc0000],
        lifespan: 500,
        quantity: 28,
        frequency: -1,    // emit all at once
        blendMode: Phaser.BlendModes.ADD,
      });
      burst.setDepth(20);
      // Auto-destroy emitter after particles die
      this.scene.time.delayedCall(600, () => burst.destroy());
    }

    // Fade out and destroy
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y - 20,
      duration: 450,
      ease: 'Power2',
      onComplete: () => { this.destroy(); },
    });
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  destroy(fromScene?: boolean): void {
    super.destroy(fromScene);
  }
}
