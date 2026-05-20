// /home/user/anonchatme-bot/webapp/lib/game/phaser/scenes/MenuScene.ts

import Phaser from 'phaser';

const STAR_COUNT   = 120;
const SAKURA_COUNT = 38;

interface StarData {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
}

interface SakuraData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  scale: number;
  alpha: number;
}

export default class MenuScene extends Phaser.Scene {
  private stars: StarData[] = [];
  private sakuras: SakuraData[] = [];

  private bgGraphics!: Phaser.GameObjects.Graphics;
  private swordGraphics!: Phaser.GameObjects.Graphics;
  private sakuraGraphics!: Phaser.GameObjects.Graphics;
  private starGraphics!: Phaser.GameObjects.Graphics;

  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private startBtn!: Phaser.GameObjects.Container;

  private time_acc: number = 0;

  constructor() {
    super({ key: 'Menu' });
  }

  create(): void {
    const { width, height } = this.scale;

    // ── Static background ────────────────────────────────────────────────────
    this.bgGraphics = this.add.graphics();
    this.drawBackground(width, height);

    // ── Star field ───────────────────────────────────────────────────────────
    this.starGraphics = this.add.graphics();
    this.buildStars(width, height);

    // ── Sword silhouette ─────────────────────────────────────────────────────
    this.swordGraphics = this.add.graphics();
    this.drawSword(width, height);

    // ── Sakura particle system ────────────────────────────────────────────────
    this.sakuraGraphics = this.add.graphics();
    this.buildSakuras(width, height);

    // ── UI ────────────────────────────────────────────────────────────────────
    this.createUI(width, height);

    // ── Tweens ────────────────────────────────────────────────────────────────
    this.setupTweens();

    // ── Resize handler ────────────────────────────────────────────────────────
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.onResize(gameSize.width, gameSize.height);
    });
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(w: number, h: number): void {
    const g = this.bgGraphics;
    g.clear();
    // Vertical gradient: deep navy → dark indigo
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const r = Math.round(Phaser.Math.Linear(0x0a, 0x12, t));
      const gb = Math.round(Phaser.Math.Linear(0x0a, 0x08, t));
      const color = (r << 16) | (gb << 8) | gb;
      g.lineStyle(1, color, 1);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.strokePath();
    }

    // Subtle bottom fog
    g.fillStyle(0x1a0030, 0.25);
    g.fillRect(0, h * 0.7, w, h * 0.3);
  }

  // ── Stars ──────────────────────────────────────────────────────────────────

  private buildStars(w: number, h: number): void {
    this.stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      this.stars.push({
        x: Phaser.Math.FloatBetween(0, w),
        y: Phaser.Math.FloatBetween(0, h * 0.85),
        r: Phaser.Math.FloatBetween(0.5, 2.0),
        baseAlpha: Phaser.Math.FloatBetween(0.3, 0.9),
        twinkleSpeed: Phaser.Math.FloatBetween(0.4, 1.8),
        phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      });
    }
  }

  private drawStars(t: number): void {
    const g = this.starGraphics;
    g.clear();
    for (const s of this.stars) {
      const alpha = s.baseAlpha * (0.6 + 0.4 * Math.sin(s.phase + t * s.twinkleSpeed));
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(s.x, s.y, s.r);
    }
  }

  // ── Sword ──────────────────────────────────────────────────────────────────

  private drawSword(w: number, h: number): void {
    const g = this.swordGraphics;
    g.clear();

    const cx = w * 0.5;
    const topY = h * 0.10;
    const botY = h * 0.72;
    const midY = Phaser.Math.Linear(topY, botY, 0.5);

    // Glow layers (concentric vertical ellipses)
    const glowColors: Array<[number, number]> = [
      [0xfbbf24, 0.04],
      [0xfbbf24, 0.07],
      [0xffd700, 0.10],
      [0xffd700, 0.18],
    ];
    const glowWidths = [70, 50, 30, 16];
    for (let i = 0; i < glowColors.length; i++) {
      g.fillStyle(glowColors[i][0], glowColors[i][1]);
      const gw = glowWidths[i];
      g.fillEllipse(cx, midY, gw, botY - topY + 20);
    }

    // Blade body
    g.fillStyle(0xc0c0c0, 0.75);
    g.fillTriangle(cx - 3, topY, cx + 3, topY, cx, botY - 40);

    // Blade gold edge shine
    g.fillStyle(0xffd700, 0.55);
    g.fillTriangle(cx - 1, topY, cx + 1, topY, cx, botY - 40);

    // Tip highlight
    g.fillStyle(0xffffff, 0.8);
    g.fillTriangle(cx - 2, topY, cx + 2, topY + 10, cx, topY);

    // Tsuba (guard)
    g.fillStyle(0x92400e, 1);
    g.fillRect(cx - 14, botY - 40, 28, 8);
    g.fillStyle(0xfbbf24, 1);
    g.fillRect(cx - 12, botY - 38, 24, 4);

    // Handle
    g.fillStyle(0x292524, 1);
    g.fillRect(cx - 5, botY - 32, 10, 34);
    g.fillStyle(0xfbbf24, 0.8);
    for (let i = 0; i < 5; i++) {
      g.fillRect(cx - 5, botY - 30 + i * 7, 10, 3);
    }

    // Pommel
    g.fillStyle(0x78350f, 1);
    g.fillCircle(cx, botY, 7);
    g.fillStyle(0xfbbf24, 0.9);
    g.fillCircle(cx, botY, 4);
  }

  // ── Sakura ─────────────────────────────────────────────────────────────────

  private buildSakuras(w: number, h: number): void {
    this.sakuras = [];
    for (let i = 0; i < SAKURA_COUNT; i++) {
      this.sakuras.push({
        x: Phaser.Math.FloatBetween(0, w),
        y: Phaser.Math.FloatBetween(-20, h),
        vx: Phaser.Math.FloatBetween(-18, 18),
        vy: Phaser.Math.FloatBetween(18, 50),
        rot: Phaser.Math.FloatBetween(0, Math.PI * 2),
        rotSpeed: Phaser.Math.FloatBetween(-1.5, 1.5),
        scale: Phaser.Math.FloatBetween(0.4, 1.1),
        alpha: Phaser.Math.FloatBetween(0.3, 0.8),
      });
    }
  }

  private drawSakuraPetal(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    scale: number,
    rot: number,
    alpha: number,
  ): void {
    g.fillStyle(0xffb7c5, alpha);
    // Five petal ellipses rotated around center
    for (let i = 0; i < 5; i++) {
      const angle = rot + (Math.PI * 2 * i) / 5;
      const px = x + Math.cos(angle) * 4 * scale;
      const py = y + Math.sin(angle) * 4 * scale;
      g.fillEllipse(px, py, 7 * scale, 4 * scale);
    }
    // Tiny center
    g.fillStyle(0xffeef3, alpha * 0.9);
    g.fillCircle(x, y, 2 * scale);
  }

  private updateSakuras(dt: number, w: number, h: number): void {
    const dtS = dt / 1000;
    for (const s of this.sakuras) {
      s.x   += s.vx * dtS;
      s.y   += s.vy * dtS;
      s.rot += s.rotSpeed * dtS;

      if (s.y > h + 20) {
        s.y  = -20;
        s.x  = Phaser.Math.FloatBetween(0, w);
      }
      if (s.x < -20) s.x = w + 20;
      if (s.x > w + 20) s.x = -20;
    }

    const g = this.sakuraGraphics;
    g.clear();
    for (const s of this.sakuras) {
      this.drawSakuraPetal(g, s.x, s.y, s.scale, s.rot, s.alpha);
    }
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  private createUI(w: number, h: number): void {
    // Title
    this.titleText = this.add.text(w / 2, h * 0.30, 'ТЕНИ ЭДО', {
      fontFamily: '"Georgia", serif',
      fontSize: '52px',
      color: '#fbbf24',
      stroke: '#78350f',
      strokeThickness: 4,
      shadow: { color: '#ffd700', blur: 20, offsetX: 0, offsetY: 0, fill: true },
    }).setOrigin(0.5, 0.5).setDepth(5);

    // Subtitle
    this.subtitleText = this.add.text(w / 2, h * 0.30 + 56, 'アニメRPG', {
      fontFamily: '"Georgia", serif',
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5).setDepth(5).setAlpha(0.5);

    // Start button
    this.startBtn = this.createStartButton(w / 2, h * 0.72);
  }

  private createStartButton(cx: number, cy: number): Phaser.GameObjects.Container {
    const btn = this.add.container(cx, cy);

    const bg = this.add.graphics();
    const bw = 220;
    const bh = 52;

    const drawBtn = (hover: boolean) => {
      bg.clear();
      // Shadow
      bg.fillStyle(0x000000, 0.35);
      bg.fillRoundedRect(-bw / 2 + 3, -bh / 2 + 4, bw, bh, 14);
      // Body gradient (simulate with two rects)
      bg.fillStyle(hover ? 0xfcd34d : 0xfbbf24, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 14);
      bg.fillStyle(hover ? 0xf59e0b : 0xd97706, 0.45);
      bg.fillRoundedRect(-bw / 2, 0, bw, bh / 2, 14);
      // Border
      bg.lineStyle(1.5, 0x92400e, 0.7);
      bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 14);
      // Top shine
      bg.fillStyle(0xffffff, 0.18);
      bg.fillRoundedRect(-bw / 2 + 6, -bh / 2 + 4, bw - 12, bh * 0.3, 8);
    };

    drawBtn(false);

    const label = this.add.text(0, 0, 'Начать путь', {
      fontFamily: '"Georgia", serif',
      fontSize: '20px',
      color: '#1c0a00',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    btn.add([bg, label]);
    btn.setDepth(10);
    btn.setSize(bw, bh);
    btn.setInteractive({ useHandCursor: true });

    btn.on('pointerover',  () => { drawBtn(true);  });
    btn.on('pointerout',   () => { drawBtn(false); });
    btn.on('pointerdown',  () => {
      this.cameras.main.fadeOut(380, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('WorldMap');
      });
    });

    return btn;
  }

  // ── Tweens ─────────────────────────────────────────────────────────────────

  private setupTweens(): void {
    // Title pulse
    this.tweens.add({
      targets: this.titleText,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Button gentle glow pulse via alpha tween on the container
    this.tweens.add({
      targets: this.startBtn,
      scaleX: 1.025,
      scaleY: 1.025,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Fade-in on start
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  update(time: number, delta: number): void {
    this.time_acc += delta / 1000;

    this.drawStars(this.time_acc);
    this.updateSakuras(delta, this.scale.width, this.scale.height);
  }

  private onResize(w: number, h: number): void {
    this.drawBackground(w, h);
    this.buildStars(w, h);
    this.buildSakuras(w, h);
    this.drawSword(w, h);

    this.titleText.setPosition(w / 2, h * 0.30);
    this.subtitleText.setPosition(w / 2, h * 0.30 + 56);
    this.startBtn.setPosition(w / 2, h * 0.72);
  }
}
