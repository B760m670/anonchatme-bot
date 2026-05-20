// /home/user/anonchatme-bot/webapp/lib/game/phaser/scenes/WorldMapScene.ts

import Phaser from 'phaser';
import { GameState } from '../GameState';

interface PortalDef {
  key:       string;          // world key matching GameState.unlockedWorlds
  label:     string;          // display name
  sceneKey:  string;          // Phaser scene key to launch
  relX:      number;          // 0..1 relative X position
  relY:      number;          // 0..1 relative Y position
  ringColor: number;
  glowColor: number;
  iconChar:  string;
}

const PORTALS: PortalDef[] = [
  { key: 'samurai', label: 'Мир самураев', sceneKey: 'SamuraiWorld', relX: 0.50, relY: 0.50, ringColor: 0xef4444, glowColor: 0xfbbf24, iconChar: '⚔️' },
  { key: 'humans',  label: 'Мир людей',    sceneKey: 'HumanWorld',   relX: 0.18, relY: 0.50, ringColor: 0x10b981, glowColor: 0x38bdf8, iconChar: '🌿' },
  { key: 'heaven',  label: 'Рай',          sceneKey: 'HeavenWorld',  relX: 0.50, relY: 0.18, ringColor: 0xfbbf24, glowColor: 0xffffff, iconChar: '✨' },
  { key: 'hell',    label: 'Ад',           sceneKey: 'HellWorld',    relX: 0.50, relY: 0.82, ringColor: 0xcc0000, glowColor: 0xff4400, iconChar: '🔥' },
  { key: 'fallen',  label: 'Мир падших',   sceneKey: 'FallenWorld',  relX: 0.82, relY: 0.50, ringColor: 0xa855f7, glowColor: 0x7c3aed, iconChar: '💀' },
];

const RING_RADIUS = 48;

export default class WorldMapScene extends Phaser.Scene {
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private lineGraphics!: Phaser.GameObjects.Graphics;
  private portalGraphics!: Phaser.GameObjects.Graphics;

  // Per-portal ring rotation angles (for tween)
  private ringAngles: number[] = PORTALS.map(() => 0);

  // Per-portal emitters (unlocked only)
  private emitters: Array<Phaser.GameObjects.Particles.ParticleEmitter | null> = PORTALS.map(() => null);

  // Text elements updated on resize
  private portalLabels: Phaser.GameObjects.Text[] = [];
  private lockLabels:   Phaser.GameObjects.Text[] = [];

  private flashText!: Phaser.GameObjects.Text;
  private backBtn!: Phaser.GameObjects.Text;

  private timeAcc: number = 0;

  constructor() {
    super({ key: 'WorldMap' });
  }

  create(): void {
    const { width: w, height: h } = this.scale;

    this.bgGraphics     = this.add.graphics();
    this.lineGraphics   = this.add.graphics();
    this.portalGraphics = this.add.graphics();

    this.drawBackground(w, h);
    this.drawConnectingLines(w, h);
    this.buildPortals(w, h);
    this.buildHUD(w, h);

    // Tween each ring rotation
    PORTALS.forEach((_, i) => {
      this.tweens.add({
        targets: this.ringAngles,
        [i]: Math.PI * 2,
        duration: 4000 + i * 700,
        repeat: -1,
        ease: 'Linear',
      });
    });

    this.cameras.main.fadeIn(400, 0, 0, 0);

    this.scale.on('resize', (gs: Phaser.Structs.Size) => {
      this.onResize(gs.width, gs.height);
    });
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(w: number, h: number): void {
    const g = this.bgGraphics;
    g.clear();

    // Deep space base
    g.fillStyle(0x040412, 1);
    g.fillRect(0, 0, w, h);

    // Nebula blobs
    const nebulae: Array<[number, number, number, number, number]> = [
      [w * 0.2,  h * 0.3,  160, 0x3b0764, 0.15],
      [w * 0.75, h * 0.65, 140, 0x0f172a, 0.20],
      [w * 0.55, h * 0.2,  120, 0x450a0a, 0.12],
      [w * 0.3,  h * 0.75, 100, 0x14532d, 0.10],
      [w * 0.82, h * 0.35, 130, 0x1e1b4b, 0.18],
    ];
    for (const [nx, ny, nr, nc, na] of nebulae) {
      for (let ring = 5; ring >= 1; ring--) {
        g.fillStyle(nc, na * (ring / 5));
        g.fillCircle(nx, ny, nr * (ring / 5));
      }
    }

    // Star field
    const rng = new Phaser.Math.RandomDataGenerator(['worldmap']);
    for (let i = 0; i < 180; i++) {
      const sx = rng.between(0, w);
      const sy = rng.between(0, h);
      const sr = rng.frac() * 1.5 + 0.3;
      const sa = rng.frac() * 0.7 + 0.2;
      g.fillStyle(0xffffff, sa);
      g.fillCircle(sx, sy, sr);
    }
  }

  // ── Connecting lines ────────────────────────────────────────────────────────

  private drawConnectingLines(w: number, h: number): void {
    const g = this.lineGraphics;
    g.clear();

    const center = PORTALS[0]; // samurai is center
    const cx     = w * center.relX;
    const cy     = h * center.relY;

    for (let i = 1; i < PORTALS.length; i++) {
      const px  = w * PORTALS[i].relX;
      const py  = h * PORTALS[i].relY;
      const col = PORTALS[i].ringColor;

      // Dashed glow line (simulate with many small dots along the line)
      const steps  = 24;
      const unlock = GameState.isWorldUnlocked(PORTALS[i].key as any);
      for (let s = 0; s <= steps; s++) {
        const t  = s / steps;
        const lx = Phaser.Math.Linear(cx, px, t);
        const ly = Phaser.Math.Linear(cy, py, t);
        if (s % 2 === 0) {
          g.fillStyle(col, unlock ? 0.35 : 0.12);
          g.fillCircle(lx, ly, 2);
        }
      }
    }
  }

  // ── Portals ─────────────────────────────────────────────────────────────────

  private buildPortals(w: number, h: number): void {
    this.portalLabels = [];
    this.lockLabels   = [];

    PORTALS.forEach((p, i) => {
      const px      = w * p.relX;
      const py      = h * p.relY;
      const unlocked = GameState.isWorldUnlocked(p.key as any);

      // Label
      const lbl = this.add.text(px, py + RING_RADIUS + 20, p.label, {
        fontFamily: '"Georgia", serif',
        fontSize: '13px',
        color: unlocked ? '#ffffff' : '#666688',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5, 0).setDepth(5);
      this.portalLabels.push(lbl);

      // Lock icon
      if (!unlocked) {
        const lockTxt = this.add.text(px, py - 14, '🔒', {
          fontSize: '22px',
        }).setOrigin(0.5, 0.5).setDepth(6);
        this.lockLabels.push(lockTxt);
      } else {
        this.lockLabels.push(this.add.text(-9999, -9999, ''));
        // Icon inside portal
        this.add.text(px, py - 8, p.iconChar, {
          fontSize: '26px',
        }).setOrigin(0.5, 0.5).setDepth(6);
      }

      // Unlocked portal particles
      if (unlocked && this.textures.exists('circle8')) {
        const emitter = this.add.particles(px, py, 'circle8', {
          speed: { min: 15, max: 40 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.4, end: 0 },
          alpha: { start: 0.7, end: 0 },
          tint: p.glowColor,
          lifespan: 900,
          frequency: 80,
          quantity: 2,
          blendMode: Phaser.BlendModes.ADD,
        });
        emitter.setDepth(4);
        this.emitters[i] = emitter;
      } else {
        this.emitters[i] = null;
      }

      // Hit area for tap
      const hitZone = this.add.circle(px, py, RING_RADIUS + 10, 0x000000, 0)
        .setInteractive({ useHandCursor: unlocked });
      hitZone.setDepth(7);

      hitZone.on('pointerdown', () => {
        if (unlocked) {
          this.cameras.main.fadeOut(380, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            GameState.currentWorld = p.key as any;
            this.scene.start(p.sceneKey);
          });
        } else {
          this.showLockedMessage(px, py - RING_RADIUS - 30);
          // Shake the portal label
          this.tweens.add({
            targets: lbl,
            x: `+=${4}`,
            duration: 50,
            yoyo: true,
            repeat: 5,
            ease: 'Linear',
            onComplete: () => { lbl.setX(px); },
          });
        }
      });
    });
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private buildHUD(w: number, h: number): void {
    // Flash text (shown on locked portal tap)
    this.flashText = this.add.text(w / 2, h * 0.12, '', {
      fontFamily: '"Georgia", serif',
      fontSize: '16px',
      color: '#ff4444',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(20).setAlpha(0);

    // Back button
    this.backBtn = this.add.text(22, 22, '← Меню', {
      fontFamily: '"Georgia", serif',
      fontSize: '15px',
      color: '#fbbf24',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0, 0).setDepth(20).setInteractive({ useHandCursor: true });

    this.backBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('Menu');
      });
    });

    // Title
    this.add.text(w / 2, 28, 'Выбор мира', {
      fontFamily: '"Georgia", serif',
      fontSize: '20px',
      color: '#fbbf24',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(20);
  }

  private showLockedMessage(x: number, y: number): void {
    this.flashText.setText('🔒 Пока недоступно');
    this.flashText.setPosition(x, y);
    this.flashText.setAlpha(1);

    this.tweens.killTweensOf(this.flashText);
    this.tweens.add({
      targets: this.flashText,
      alpha: 0,
      duration: 1200,
      delay: 600,
      ease: 'Linear',
    });
  }

  // ── Render loop ────────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    this.timeAcc += delta / 1000;
    this.drawPortalRings();
  }

  private drawPortalRings(): void {
    const g = this.portalGraphics;
    const { width: w, height: h } = this.scale;
    g.clear();

    PORTALS.forEach((p, i) => {
      const px       = w * p.relX;
      const py       = h * p.relY;
      const unlocked = GameState.isWorldUnlocked(p.key as any);
      const angle    = this.ringAngles[i];
      const pulse    = (Math.sin(this.timeAcc * 2 + i) + 1) / 2;

      // Inner glow fill
      if (unlocked) {
        g.fillStyle(p.glowColor, 0.07 + pulse * 0.06);
        g.fillCircle(px, py, RING_RADIUS - 4);
      }

      // Portal base (dark interior)
      g.fillStyle(0x0a0a2a, unlocked ? 0.75 : 0.88);
      g.fillCircle(px, py, RING_RADIUS - 6);

      // Outer ring glow
      const ringAlpha = unlocked ? (0.55 + pulse * 0.3) : 0.22;
      g.lineStyle(unlocked ? 3 : 1.5, p.ringColor, ringAlpha);
      g.strokeCircle(px, py, RING_RADIUS);

      // Spinning dashes — 8 short arcs
      if (unlocked) {
        g.lineStyle(2, p.glowColor, 0.5 + pulse * 0.35);
        const dashCount = 8;
        for (let d = 0; d < dashCount; d++) {
          const a0 = angle + (Math.PI * 2 * d) / dashCount;
          const a1 = a0 + 0.25;
          const r  = RING_RADIUS + 8;
          g.beginPath();
          g.arc(px, py, r, a0, a1, false);
          g.strokePath();
        }
      }

      // Center glow blob (unlocked only)
      if (unlocked) {
        g.fillStyle(p.glowColor, 0.12 + pulse * 0.10);
        g.fillCircle(px, py, RING_RADIUS * 0.55);
        g.fillStyle(p.glowColor, 0.22 + pulse * 0.15);
        g.fillCircle(px, py, RING_RADIUS * 0.28);
      }
    });
  }

  // ── Resize ─────────────────────────────────────────────────────────────────

  private onResize(w: number, h: number): void {
    this.drawBackground(w, h);
    this.drawConnectingLines(w, h);

    PORTALS.forEach((p, i) => {
      const px = w * p.relX;
      const py = h * p.relY;
      if (this.portalLabels[i]) {
        this.portalLabels[i].setPosition(px, py + RING_RADIUS + 20);
      }
      if (this.lockLabels[i]) {
        this.lockLabels[i].setPosition(px, py - 14);
      }
      if (this.emitters[i]) {
        this.emitters[i]!.setPosition(px, py);
      }
    });

    this.flashText.setPosition(w / 2, h * 0.12);
  }
}
