import Phaser from 'phaser';

const DETECTION_RADIUS = 120;
const PATROL_SPEED     = 50;
const CHASE_SPEED      = 85;

export default class Enemy extends Phaser.GameObjects.Container {
  private bodyGraphics: Phaser.GameObjects.Graphics;
  private healthBarBg:  Phaser.GameObjects.Graphics;
  private healthBarFg:  Phaser.GameObjects.Graphics;

  private readonly maxHp: number;
  private currentHp:  number;
  private readonly enemyLevel: number;

  private patrolLeft:  number;
  private patrolRight: number;
  private patrolDir:   number = 1;
  private chasing:     boolean = false;
  private timeAcc:     number = 0;
  private walkPhase:   number = 0;
  private facingRight: boolean = true;
  private isMoving:    boolean = false;

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

    this.bodyGraphics = scene.add.graphics();
    this.drawCharacter(0, 0);

    this.healthBarBg = scene.add.graphics();
    this.healthBarFg = scene.add.graphics();
    this.drawHealthBar();

    this.add([this.bodyGraphics, this.healthBarBg, this.healthBarFg]);
    scene.add.existing(this);

    scene.physics.add.existing(this, false);
    this.body.setSize(26, 56);
    this.body.setOffset(-13, -28);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(CHASE_SPEED, 800);

    this.setDepth(8);
  }

  private drawCharacter(walkPhase: number, glowPulse: number): void {
    const g = this.bodyGraphics;
    g.clear();

    const sw = Math.sin(walkPhase) * 7;   // leg stride
    const aw = Math.sin(walkPhase) * 5;   // arm swing

    // ── Ground shadow ──────────────────────────────────────────────────────
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(0, 27, 26, 7);

    // ── BACK LEG ──────────────────────────────────────────────────────────
    g.fillStyle(0x1a0808, 1);
    g.fillRect(-5 - sw, 4, 9, 20);
    g.fillStyle(0x3a0000, 1);
    g.fillRect(-7 - sw, 22, 12, 5);   // back boot (dark red)

    // ── FRONT LEG ─────────────────────────────────────────────────────────
    g.fillStyle(0x280d0d, 1);
    g.fillRect(-2 + sw, 4, 9, 20);
    g.fillStyle(0x4a0000, 1);
    g.fillRect(-4 + sw, 22, 12, 5);   // front boot

    // ── LOWER ROBE (tattered hem) ─────────────────────────────────────────
    g.fillStyle(0x200808, 0.9);
    g.fillRect(-11, 2, 22, 9);
    // Tattered hem triangles
    g.fillStyle(0x0a0000, 1);
    for (let i = 0; i < 4; i++) {
      const tx = -10 + i * 6;
      g.fillTriangle(tx, 10, tx + 5, 10, tx + 2, 14);
    }

    // ── TORSO / BONE ARMOUR ───────────────────────────────────────────────
    g.fillStyle(0x1c1020, 1);
    g.fillRect(-9, -17, 18, 20);

    // Armour cracks / bone detail
    g.lineStyle(1, 0x3a2040, 0.6);
    g.strokeRect(-9, -17, 18, 20);
    g.lineStyle(0.8, 0xff0000, 0.15 + glowPulse * 0.1);  // red glow seams
    g.beginPath();
    g.moveTo(-7, -10); g.lineTo(7, -10); g.strokePath();
    g.beginPath();
    g.moveTo(-5, -4);  g.lineTo(5, -4);  g.strokePath();
    // Bone shoulder design
    g.fillStyle(0x282030, 0.9);
    g.fillRect(-15, -17, 7, 6);
    g.fillRect(8, -17, 7, 6);

    // ── LEFT ARM ──────────────────────────────────────────────────────────
    g.fillStyle(0x1c1020, 0.9);
    g.fillRect(-14, -14 + aw, 6, 16);

    // ── RIGHT ARM (heavy weapon) ──────────────────────────────────────────
    g.fillStyle(0x1c1020, 0.9);
    g.fillRect(8, -14 - aw * 0.5, 6, 13);

    // ── HEAVY CLEAVER / NODACHI ───────────────────────────────────────────
    // Handle (thick grip)
    const hx = 13, hy = -5;
    g.fillStyle(0x1a1410, 1);
    g.fillRect(hx - 2, hy, 6, 15);
    g.fillStyle(0x8b0000, 0.7);
    g.fillRect(hx - 2, hy + 3, 6, 3);
    g.fillRect(hx - 2, hy + 9, 6, 3);
    // Guard (wider than player's)
    g.fillStyle(0x2a0000, 1);
    g.fillRect(hx - 6, hy - 2, 14, 5);
    // Blade - wider, darker than player's blade (more menacing)
    g.fillStyle(0x5a3a3a, 0.95);
    g.fillTriangle(hx - 5, hy - 2, hx + 7, hy - 2, hx + 22, hy - 36);
    // Chipped/cracked edge
    g.lineStyle(1, 0x7a5a5a, 0.6);
    g.beginPath();
    g.moveTo(hx + 1, hy - 2);
    g.lineTo(hx + 22, hy - 36);
    g.strokePath();
    // Rust/blood on blade
    g.lineStyle(1, 0x8b0000, 0.35);
    g.beginPath();
    g.moveTo(hx - 3, hy - 2);
    g.lineTo(hx + 18, hy - 36);
    g.strokePath();

    // ── NECK ──────────────────────────────────────────────────────────────
    g.fillStyle(0x2a1a28, 1);
    g.fillRect(-3, -21, 6, 6);

    // ── HEAD (demonic) ────────────────────────────────────────────────────
    // Back of head (spiky dark hair)
    g.fillStyle(0x0a0010, 1);
    g.fillCircle(0, -28, 11);
    // Wild demonic spikes (asymmetric)
    g.fillStyle(0x1a0030, 1);
    g.fillTriangle(-10, -32, -3, -27, -8, -43);
    g.fillTriangle(-2, -30,  4, -30,  0, -44);
    g.fillTriangle( 4, -32, 10, -27,  8, -40);
    g.fillTriangle(10, -30, 14, -24, 12, -36); // extra side spike
    // Horns (small demonic)
    g.fillStyle(0x5a2000, 1);
    g.fillTriangle(-8, -36, -5, -36, -6, -44);
    g.fillTriangle( 5, -36,  8, -36,  6, -44);

    // Face (pale purple-gray)
    g.fillStyle(0x3a2845, 1);
    g.fillCircle(1, -27, 10);

    // ── GLOWING RED EYES ──────────────────────────────────────────────────
    const eyeGlow = 0.6 + glowPulse * 0.4;
    // Left eye glow halo
    g.fillStyle(0xff0000, eyeGlow * 0.25);
    g.fillCircle(-4, -27, 7);
    g.fillStyle(0xff2200, eyeGlow * 0.5);
    g.fillCircle(-4, -27, 5);
    g.fillStyle(0xff4400, eyeGlow * 0.85);
    g.fillCircle(-4, -27, 3);
    g.fillStyle(0xff8800, 1);
    g.fillCircle(-4, -27, 1.5);
    // Right eye
    g.fillStyle(0xff0000, eyeGlow * 0.25);
    g.fillCircle(5, -27, 7);
    g.fillStyle(0xff2200, eyeGlow * 0.5);
    g.fillCircle(5, -27, 5);
    g.fillStyle(0xff4400, eyeGlow * 0.85);
    g.fillCircle(5, -27, 3);
    g.fillStyle(0xff8800, 1);
    g.fillCircle(5, -27, 1.5);
    // Eye shine
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(-3, -28, 0.8);
    g.fillCircle(6, -28, 0.8);

    // Jagged mouth
    g.lineStyle(1.5, 0x8b0000, 0.85 + glowPulse * 0.15);
    g.beginPath();
    g.moveTo(-6, -20);
    g.lineTo(-3, -18);
    g.lineTo(-1, -21);
    g.lineTo(1, -18);
    g.lineTo(3, -21);
    g.lineTo(6, -19);
    g.strokePath();

    // Level badge (floating above)
    g.fillStyle(0x8b0000, 1);
    g.fillCircle(16, -36, 8);
    g.lineStyle(1, 0xff4444, 0.7);
    g.strokeCircle(16, -36, 8);

    // ── RED AURA GLOW (pulsing) ───────────────────────────────────────────
    g.fillStyle(0xff0000, 0.04 + glowPulse * 0.06);
    g.fillCircle(0, 0, 38);
    g.fillStyle(0xff2200, 0.05 + glowPulse * 0.07);
    g.fillCircle(0, 0, 26);
  }

  private drawHealthBar(): void {
    const barW = 58;
    const barH = 5;
    const barY = -46;
    const barX = -barW / 2;
    const pct  = Math.max(0, this.currentHp / this.maxHp);

    this.healthBarBg.clear();
    this.healthBarBg.fillStyle(0x000000, 0.75);
    this.healthBarBg.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    this.healthBarFg.clear();
    if (pct > 0) {
      const color = pct > 0.5 ? 0xef4444 : (pct > 0.25 ? 0xf97316 : 0xfbbf24);
      this.healthBarFg.fillStyle(color, 1);
      this.healthBarFg.fillRect(barX, barY, barW * pct, barH);
    }
  }

  update(playerX: number, playerY: number): void {
    if (!this.active || this.currentHp <= 0) return;

    this.timeAcc += 0.05;
    const glowPulse = (Math.sin(this.timeAcc * 3) + 1) / 2;

    const dx   = playerX - this.x;
    const dy   = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < DETECTION_RADIUS) {
      this.chasing = true;
      const angle = Math.atan2(dy, dx);
      this.body.setVelocityX(Math.cos(angle) * CHASE_SPEED);
    } else {
      this.chasing = false;
      this.body.setVelocityX(this.patrolDir * PATROL_SPEED);
      if (this.x >= this.patrolRight) this.patrolDir = -1;
      else if (this.x <= this.patrolLeft) this.patrolDir = 1;
    }

    const vx = this.body.velocity.x;
    this.isMoving = Math.abs(vx) > 5;
    if (this.isMoving) this.walkPhase += 0.12;

    // Flip container for movement direction
    if (vx < -5 && this.facingRight) {
      this.facingRight = false;
      this.setScale(-1, 1);
    } else if (vx > 5 && !this.facingRight) {
      this.facingRight = true;
      this.setScale(1, 1);
    }

    this.drawCharacter(this.isMoving ? this.walkPhase : 0, glowPulse);
  }

  takeDamage(amount: number): boolean {
    if (this.currentHp <= 0) return true;

    this.currentHp = Math.max(0, this.currentHp - amount);
    this.drawHealthBar();

    this.scene.tweens.add({
      targets: this.bodyGraphics,
      alpha: 0.3,
      duration: 75,
      yoyo: true,
      onComplete: () => { this.bodyGraphics.setAlpha(1); },
    });

    if (this.currentHp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  get hp(): number  { return this.currentHp; }
  get level(): number { return this.enemyLevel; }
  get isAlive(): boolean { return this.currentHp > 0; }

  private die(): void {
    this.body.setVelocity(0, 0);
    this.body.setEnable(false);

    if (this.scene.textures.exists('pixel')) {
      const burst = this.scene.add.particles(this.x, this.y, 'pixel', {
        speed: { min: 80, max: 200 },
        angle: { min: 0, max: 360 },
        scale: { start: 2.5, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xff2200, 0xff6600, 0xcc0000, 0x550000],
        lifespan: 550,
        quantity: 32,
        frequency: -1,
        blendMode: Phaser.BlendModes.ADD,
      });
      burst.setDepth(20);
      this.scene.time.delayedCall(650, () => burst.destroy());
    }

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y - 24,
      duration: 450,
      ease: 'Power2',
      onComplete: () => { this.destroy(); },
    });
  }

  destroy(fromScene?: boolean): void {
    super.destroy(fromScene);
  }
}
