// /home/user/anonchatme-bot/webapp/lib/game/phaser/scenes/SamuraiWorldScene.ts

import Phaser from 'phaser';
import { GameState } from '../GameState';
import Player from '../objects/Player';
import Enemy  from '../objects/Enemy';
import Joystick from '../ui/Joystick';

const WORLD_WIDTH  = 3200;
const GROUND_THICK = 80;

// NPC definitions
interface NpcDef { x: number; name: string; color: number; }
const NPC_DEFS: NpcDef[] = [
  { x: 600,  name: 'Торговец Кен',   color: 0x6b7280 },
  { x: 2400, name: 'Мастер Хироши', color: 0x78350f },
];

// Enemy spawn definitions
interface EnemySpawnDef { x: number; level: number; range: number; }
const ENEMY_SPAWNS: EnemySpawnDef[] = [
  { x: 800,  level: 2, range: 120 },
  { x: 1400, level: 3, range: 160 },
  { x: 2000, level: 3, range: 120 },
  { x: 2700, level: 4, range: 200 },
];

// Platform definitions [x, y, width, height] — y is from top
interface PlatformDef { rx: number; ry: number; rw: number; rh: number; }
const PLATFORM_DEFS: PlatformDef[] = [
  { rx: 0.22, ry: 0.60, rw: 0.08, rh: 0.025 },
  { rx: 0.40, ry: 0.52, rw: 0.07, rh: 0.025 },
  { rx: 0.58, ry: 0.58, rw: 0.09, rh: 0.025 },
  { rx: 0.74, ry: 0.50, rw: 0.06, rh: 0.025 },
];

export default class SamuraiWorldScene extends Phaser.Scene {
  // Parallax background layers
  private skyLayer!:     Phaser.GameObjects.Graphics;
  private farMtnLayer!:  Phaser.GameObjects.Graphics;
  private midMtnLayer!:  Phaser.GameObjects.Graphics;
  private castleLayer!:  Phaser.GameObjects.Graphics;
  private treeLayer!:    Phaser.GameObjects.Graphics;
  private groundLayer!:  Phaser.GameObjects.Graphics;

  // Atmosphere
  private moonGraphics!: Phaser.GameObjects.Graphics;
  private emberEmitter!: Phaser.GameObjects.Particles.ParticleEmitter | null;

  // Physics groups
  private platformGroup!: Phaser.Physics.Arcade.StaticGroup;
  private groundGroup!:   Phaser.Physics.Arcade.StaticGroup;

  // Game objects
  private player!:   Player;
  private enemies:   Enemy[] = [];
  private joystick!: Joystick;
  private cursors:   Phaser.Types.Input.Keyboard.CursorKeys | null = null;

  // HUD
  private hudHpBar!:       Phaser.GameObjects.Graphics;
  private hudHpBarFg!:     Phaser.GameObjects.Graphics;
  private hudWorldLabel!:  Phaser.GameObjects.Text;
  private hudClanText!:    Phaser.GameObjects.Text;
  private miniMapBg!:      Phaser.GameObjects.Graphics;
  private miniMapDot!:     Phaser.GameObjects.Graphics;

  // World gate
  private worldGateGraphics!: Phaser.GameObjects.Graphics;
  private gateAngle: number = 0;

  // State
  private playerHp:    number = 100;
  private maxPlayerHp: number = 100;
  private inBattle:    boolean = false;
  private timeAcc:     number = 0;

  constructor() {
    super({ key: 'SamuraiWorld' });
  }

  create(): void {
    const { width: vw, height: vh } = this.scale;
    const groundY = Math.round(vh * 0.85);

    // Physics world bounds
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, vh);

    // ── Background layers ──────────────────────────────────────────────────
    this.skyLayer    = this.createParallaxLayer(0, 0.0);
    this.farMtnLayer = this.createParallaxLayer(1, 0.1);
    this.midMtnLayer = this.createParallaxLayer(2, 0.2);
    this.castleLayer = this.createParallaxLayer(3, 0.3);
    this.treeLayer   = this.createParallaxLayer(4, 0.5);
    this.groundLayer = this.createParallaxLayer(5, 1.0);
    this.moonGraphics = this.add.graphics();
    this.moonGraphics.setScrollFactor(0.05).setDepth(1);

    this.drawAllLayers(vw, vh);

    // ── Physics groups ─────────────────────────────────────────────────────
    this.groundGroup   = this.physics.add.staticGroup();
    this.platformGroup = this.physics.add.staticGroup();

    // Ground body (invisible rect at bottom)
    const groundBody = this.add.rectangle(
      WORLD_WIDTH / 2,
      groundY + GROUND_THICK / 2,
      WORLD_WIDTH,
      GROUND_THICK,
      0x000000,
      0,
    );
    this.physics.add.existing(groundBody, true);
    this.groundGroup.add(groundBody);

    // Floating platforms
    PLATFORM_DEFS.forEach((pd) => {
      const px = Math.round(WORLD_WIDTH * pd.rx);
      const py = Math.round(vh * pd.ry);
      const pw = Math.round(WORLD_WIDTH * pd.rw);
      const ph = Math.round(vh * pd.rh);
      const platBody = this.add.rectangle(px, py, pw, ph, 0x1a0a00, 0);
      this.physics.add.existing(platBody, true);
      this.platformGroup.add(platBody);
    });

    // Draw visible platforms on top of layers
    this.drawPlatforms(vw, vh);

    // ── NPCs ───────────────────────────────────────────────────────────────
    NPC_DEFS.forEach((n) => this.spawnNpc(n, groundY));

    // ── World gate ─────────────────────────────────────────────────────────
    this.worldGateGraphics = this.add.graphics().setDepth(6);
    this.drawWorldGate(WORLD_WIDTH - 140, groundY - 70);

    // ── Enemies ────────────────────────────────────────────────────────────
    ENEMY_SPAWNS.forEach((s) => {
      const e = new Enemy(this, s.x, groundY - 28, s.level, s.range);
      this.enemies.push(e);
    });

    // ── Player ─────────────────────────────────────────────────────────────
    this.player = new Player(this, 200, groundY - 40, GameState.clan);

    // Camera follows player
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, vh);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // ── Physics colliders ──────────────────────────────────────────────────
    this.physics.add.collider(this.player, this.groundGroup);
    this.physics.add.collider(this.player, this.platformGroup);
    this.enemies.forEach((e) => {
      this.physics.add.collider(e, this.groundGroup);
    });

    // Enemy overlap → battle
    this.enemies.forEach((e) => {
      this.physics.add.overlap(this.player, e, () => {
        this.triggerBattle(e);
      });
    });

    // World gate overlap → back to WorldMap
    this.physics.add.overlap(
      this.player,
      this.add.zone(WORLD_WIDTH - 140, groundY - 70, 80, 120).setRectangleDropZone(80, 120),
      () => {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('WorldMap');
        });
      },
    );

    // ── Atmosphere ─────────────────────────────────────────────────────────
    this.createEmbers();

    // ── Input ──────────────────────────────────────────────────────────────
    this.joystick = new Joystick(this, 80, vh - 100);
    this.cursors  = this.input.keyboard?.createCursorKeys() ?? null;

    // ── HUD ────────────────────────────────────────────────────────────────
    this.buildHUD(vw, vh);

    // ── Fade in ────────────────────────────────────────────────────────────
    this.cameras.main.fadeIn(500, 0, 0, 0);

    // ── Resize ─────────────────────────────────────────────────────────────
    this.scale.on('resize', (gs: Phaser.Structs.Size) => {
      this.onResize(gs.width, gs.height);
    });
  }

  // ── Layer factory ──────────────────────────────────────────────────────────

  private createParallaxLayer(depth: number, scrollFactor: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.setScrollFactor(scrollFactor);
    g.setDepth(depth);
    return g;
  }

  // ── Draw all background layers ─────────────────────────────────────────────

  private drawAllLayers(vw: number, vh: number): void {
    this.drawSky(vw, vh);
    this.drawFarMountains(vw, vh);
    this.drawMidMountains(vw, vh);
    this.drawCastle(vw, vh);
    this.drawTrees(vw, vh);
    this.drawGround(vw, vh);
    this.drawMoon(vw, vh);
  }

  // Layer 0 – Sky gradient
  private drawSky(vw: number, vh: number): void {
    const g = this.skyLayer;
    g.clear();
    // Tall sky — needs to cover parallax-shifted area
    const W = vw + 200;
    const H = vh;
    for (let y = 0; y < H; y++) {
      const t = y / H;
      const r = Math.round(Phaser.Math.Linear(0x0d, 0x8b, t));
      const gr2 = Math.round(Phaser.Math.Linear(0x00, 0x1a, t));
      const b  = Math.round(Phaser.Math.Linear(0x20, 0x1a, t));
      g.lineStyle(1, (r << 16) | (gr2 << 8) | b, 1);
      g.beginPath();
      g.moveTo(-100, y);
      g.lineTo(W, y);
      g.strokePath();
    }
  }

  // Layer 1 – Far silhouette mountains (purple)
  private drawFarMountains(vw: number, vh: number): void {
    const g = this.farMtnLayer;
    g.clear();
    g.fillStyle(0x2d1b4e, 0.85);

    // The layer scrolls at 0.1x, so draw it 10x wide to always fill screen
    const W = WORLD_WIDTH * 1.2;
    const H = vh;
    const horizY = H * 0.55;

    g.beginPath();
    g.moveTo(0, H);
    // Gentle large mountain chain
    const peaks = [
      [0,       horizY + 10],
      [W * 0.08, horizY - H * 0.18],
      [W * 0.15, horizY + 20],
      [W * 0.25, horizY - H * 0.25],
      [W * 0.32, horizY - H * 0.05],
      [W * 0.42, horizY - H * 0.30],
      [W * 0.52, horizY],
      [W * 0.62, horizY - H * 0.22],
      [W * 0.72, horizY + 15],
      [W * 0.80, horizY - H * 0.27],
      [W * 0.88, horizY - H * 0.10],
      [W * 0.95, horizY - H * 0.19],
      [W,        horizY + 10],
      [W,        H],
    ];
    for (const [px, py] of peaks) g.lineTo(px, py);
    g.closePath();
    g.fillPath();
  }

  // Layer 2 – Mid mountains (darker red-brown)
  private drawMidMountains(vw: number, vh: number): void {
    const g = this.midMtnLayer;
    g.clear();
    g.fillStyle(0x3b1a1a, 0.90);

    const W = WORLD_WIDTH * 1.1;
    const H = vh;
    const horizY = H * 0.62;

    g.beginPath();
    g.moveTo(0, H);
    const peaks = [
      [0,        horizY + 20],
      [W * 0.06, horizY - H * 0.12],
      [W * 0.14, horizY + 10],
      [W * 0.22, horizY - H * 0.18],
      [W * 0.30, horizY - H * 0.04],
      [W * 0.38, horizY - H * 0.20],
      [W * 0.46, horizY + 5],
      [W * 0.55, horizY - H * 0.15],
      [W * 0.63, horizY + 12],
      [W * 0.72, horizY - H * 0.22],
      [W * 0.80, horizY + 8],
      [W * 0.90, horizY - H * 0.13],
      [W,        horizY + 15],
      [W,        H],
    ];
    for (const [px, py] of peaks) g.lineTo(px, py);
    g.closePath();
    g.fillPath();
  }

  // Layer 3 – Castle/pagoda silhouette
  private drawCastle(vw: number, vh: number): void {
    const g = this.castleLayer;
    g.clear();
    g.fillStyle(0x0a0005, 1);

    const H = vh;
    const baseY = H * 0.68;

    // Draw repeating pagoda towers along the world
    for (let cx = 400; cx < WORLD_WIDTH; cx += 900) {
      this.drawPagodaAt(g, cx, baseY, H * 0.22);
    }
  }

  private drawPagodaAt(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    baseY: number,
    totalH: number,
  ): void {
    // Stacked tiers, each narrower going up
    const tiers = 5;
    let tw = 90;
    let ty = baseY;
    for (let t = 0; t < tiers; t++) {
      const tierH = totalH / (tiers * 1.2);
      // Body
      g.fillRect(cx - tw / 2, ty - tierH, tw, tierH);
      // Roof overhang
      const roofW = tw + 18;
      g.beginPath();
      g.moveTo(cx - roofW / 2, ty - tierH);
      g.lineTo(cx + roofW / 2, ty - tierH);
      g.lineTo(cx + tw / 2 - 2, ty - tierH - 12);
      g.lineTo(cx - tw / 2 + 2, ty - tierH - 12);
      g.closePath();
      g.fillPath();
      ty    -= tierH + 8;
      tw    = Math.round(tw * 0.72);
    }
    // Finial (pointed top)
    g.fillTriangle(cx - 5, ty, cx + 5, ty, cx, ty - totalH * 0.18);
  }

  // Layer 4 – Near pine-tree silhouettes
  private drawTrees(vw: number, vh: number): void {
    const g = this.treeLayer;
    g.clear();
    g.fillStyle(0x050505, 1);

    const H     = vh;
    const baseY = H * 0.85;

    for (let tx = -40; tx < WORLD_WIDTH + 40; tx += 70 + ((tx * 7) % 40)) {
      const treeH = 80 + ((tx * 3) % 60);
      const treeW = 22 + ((tx * 2) % 16);
      // Pine shape: 3 stacked triangles
      for (let tier = 0; tier < 3; tier++) {
        const tierW = treeW * (1 - tier * 0.18);
        const tierY = baseY - treeH * (0.3 * tier);
        g.fillTriangle(
          tx - tierW,        tierY,
          tx + tierW,        tierY,
          tx,                tierY - treeH * 0.38,
        );
      }
      // Trunk
      g.fillRect(tx - 3, baseY - treeH * 0.12, 6, treeH * 0.12);
    }
  }

  // Layer 5 – Ground
  private drawGround(vw: number, vh: number): void {
    const g = this.groundLayer;
    g.clear();

    const H      = vh;
    const groundY = Math.round(H * 0.85);

    // Main ground
    g.fillStyle(0x1a1008, 1);
    g.fillRect(0, groundY, WORLD_WIDTH, GROUND_THICK * 2);

    // Top edge highlight
    g.fillStyle(0x3d2a12, 1);
    g.fillRect(0, groundY, WORLD_WIDTH, 5);

    // Subtle dirt texture lines
    g.lineStyle(1, 0x2a1c0a, 0.4);
    for (let lx = 0; lx < WORLD_WIDTH; lx += 30) {
      const jitter = ((lx * 17) % 11) - 5;
      g.beginPath();
      g.moveTo(lx, groundY + 14 + jitter);
      g.lineTo(lx + 22, groundY + 14 + jitter);
      g.strokePath();
    }
  }

  // Moon (fixed in sky, very slow parallax)
  private drawMoon(vw: number, vh: number): void {
    const g = this.moonGraphics;
    g.clear();
    const mx = vw * 0.82;
    const my = vh * 0.14;

    // Glow rings
    g.fillStyle(0xcc2200, 0.08); g.fillCircle(mx, my, 68);
    g.fillStyle(0xcc2200, 0.14); g.fillCircle(mx, my, 52);
    g.fillStyle(0xcc2200, 0.22); g.fillCircle(mx, my, 40);

    // Moon body
    g.fillStyle(0xcc2200, 0.60);
    g.fillCircle(mx, my, 30);

    // Surface craters (dark spots)
    g.fillStyle(0x880000, 0.4);
    g.fillCircle(mx - 9, my + 5, 7);
    g.fillCircle(mx + 10, my - 6, 5);
    g.fillCircle(mx + 3,  my + 12, 4);
  }

  // ── Visible platforms ──────────────────────────────────────────────────────

  private drawPlatforms(vw: number, vh: number): void {
    PLATFORM_DEFS.forEach((pd) => {
      const px  = Math.round(WORLD_WIDTH * pd.rx);
      const py  = Math.round(vh * pd.ry);
      const pw  = Math.round(WORLD_WIDTH * pd.rw);
      const ph  = Math.round(vh * pd.rh);
      const g   = this.add.graphics().setDepth(5.5);
      g.fillStyle(0x1a0a00, 0.92);
      g.fillRect(px - pw / 2, py - ph / 2, pw, ph);
      g.fillStyle(0x3d2a12, 1);
      g.fillRect(px - pw / 2, py - ph / 2, pw, 4);
      g.lineStyle(1, 0x5a3e1e, 0.6);
      g.strokeRect(px - pw / 2, py - ph / 2, pw, ph);
    });
  }

  // ── NPCs ───────────────────────────────────────────────────────────────────

  private spawnNpc(def: NpcDef, groundY: number): void {
    const g = this.add.graphics().setDepth(7);

    // Body circle
    g.fillStyle(def.color, 0.9);
    g.fillCircle(def.x, groundY - 30, 18);
    g.fillStyle(0xffffff, 0.15);
    g.fillCircle(def.x - 5, groundY - 36, 7);

    // Simple robe
    g.fillStyle(def.color, 0.7);
    g.fillTriangle(
      def.x - 14, groundY,
      def.x + 14, groundY,
      def.x,      groundY - 14,
    );

    // Name label
    this.add.text(def.x, groundY - 56, def.name, {
      fontFamily: '"Georgia", serif',
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(8);

    // "Talk" indicator (pulsing dot)
    const dot = this.add.graphics().setDepth(8);
    dot.fillStyle(0xfbbf24, 1);
    dot.fillCircle(def.x, groundY - 68, 4);
    this.tweens.add({
      targets: dot,
      alpha: 0.2,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
  }

  // ── World gate ─────────────────────────────────────────────────────────────

  private drawWorldGate(gx: number, gy: number): void {
    const g = this.worldGateGraphics;
    g.clear();

    // Outer glow
    g.fillStyle(0x7c3aed, 0.08); g.fillCircle(gx, gy, 72);
    g.fillStyle(0x7c3aed, 0.15); g.fillCircle(gx, gy, 56);
    g.fillStyle(0xa855f7, 0.20); g.fillCircle(gx, gy, 40);

    // Portal interior
    g.fillStyle(0x0d0020, 0.85);
    g.fillCircle(gx, gy, 34);

    // Spinning ring is drawn in update() via gateAngle — here draw static ring
    g.lineStyle(3, 0xa855f7, 0.8);
    g.strokeCircle(gx, gy, 42);

    // Stars inside portal
    g.fillStyle(0xffffff, 0.6);
    const rng = new Phaser.Math.RandomDataGenerator(['gate']);
    for (let i = 0; i < 8; i++) {
      const sx = gx + rng.between(-28, 28);
      const sy = gy + rng.between(-28, 28);
      g.fillCircle(sx, sy, rng.frac() * 2 + 0.5);
    }

    // Label
    this.add.text(gx, gy + 56, '↩ Карта мира', {
      fontFamily: '"Georgia", serif',
      fontSize: '13px',
      color: '#c4b5fd',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(8);
  }

  // ── Embers ─────────────────────────────────────────────────────────────────

  private createEmbers(): void {
    if (!this.textures.exists('pixel')) return;

    this.emberEmitter = this.add.particles(
      WORLD_WIDTH / 2,
      this.scale.height * 0.9,
      'pixel',
      {
        speed:    { min: 10, max: 50 },
        angle:    { min: 240, max: 300 },   // upward spread
        scale:    { start: 1.5, end: 0 },
        alpha:    { start: 0.8, end: 0 },
        tint:     [0xff4500, 0xff6600, 0xffaa00],
        lifespan: 4000,
        frequency: 80,
        quantity:  3,
        x:        { min: -WORLD_WIDTH / 2, max: WORLD_WIDTH / 2 },
        blendMode: Phaser.BlendModes.ADD,
      },
    );
    this.emberEmitter.setDepth(9).setScrollFactor(1);
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private buildHUD(vw: number, vh: number): void {
    const depth = 50;

    // HP bar background
    this.hudHpBar = this.add.graphics().setScrollFactor(0).setDepth(depth);
    this.hudHpBar.fillStyle(0x000000, 0.65);
    this.hudHpBar.fillRoundedRect(16, 16, 124, 18, 5);

    // HP bar foreground
    this.hudHpBarFg = this.add.graphics().setScrollFactor(0).setDepth(depth);
    this.updateHpBar();

    // Clan emoji
    this.hudClanText = this.add.text(16, 40, this.getClanEmoji(), {
      fontSize: '18px',
    }).setScrollFactor(0).setDepth(depth);

    // World label (top-right)
    this.hudWorldLabel = this.add.text(vw - 16, 16, '⚔️ Мир самураев', {
      fontFamily: '"Georgia", serif',
      fontSize: '14px',
      color: '#fbbf24',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(depth);

    // Mini-map
    this.miniMapBg  = this.add.graphics().setScrollFactor(0).setDepth(depth);
    this.miniMapDot = this.add.graphics().setScrollFactor(0).setDepth(depth + 1);
    this.drawMiniMap(vw, vh);
  }

  private updateHpBar(): void {
    const g = this.hudHpBarFg;
    g.clear();
    const pct   = Math.max(0, this.playerHp / this.maxPlayerHp);
    const color = pct > 0.5 ? 0xef4444 : (pct > 0.25 ? 0xf97316 : 0xfbbf24);
    g.fillStyle(color, 1);
    g.fillRoundedRect(17, 17, 122 * pct, 16, 4);
  }

  private drawMiniMap(vw: number, vh: number): void {
    const mmW = 80;
    const mmH = 14;
    const mmX = vw - 16 - mmW;
    const mmY = 38;

    this.miniMapBg.clear();
    this.miniMapBg.fillStyle(0x000000, 0.55);
    this.miniMapBg.fillRect(mmX, mmY, mmW, mmH);
    this.miniMapBg.lineStyle(1, 0x4a4a6a, 0.6);
    this.miniMapBg.strokeRect(mmX, mmY, mmW, mmH);

    // Enemy dots
    this.miniMapBg.fillStyle(0xef4444, 0.7);
    this.enemies.forEach((e) => {
      if (e.active && e.isAlive) {
        const ex = mmX + (e.x / WORLD_WIDTH) * mmW;
        this.miniMapBg.fillCircle(ex, mmY + mmH / 2, 2);
      }
    });
  }

  private updateMiniMapDot(vw: number, vh: number): void {
    const mmW = 80;
    const mmH = 14;
    const mmX = vw - 16 - mmW;
    const mmY = 38;

    this.miniMapDot.clear();
    if (this.player?.active) {
      const px  = mmX + (this.player.x / WORLD_WIDTH) * mmW;
      this.miniMapDot.fillStyle(0xfbbf24, 1);
      this.miniMapDot.fillCircle(px, mmY + mmH / 2, 2.5);
    }
  }

  private getClanEmoji(): string {
    const map: Record<string, string> = {
      kage:  '🌑', hono: '🔥', koori: '❄️', kaze: '💨', tetsu: '⚔️',
    };
    return map[GameState.clan] ?? '⚔️';
  }

  // ── Battle trigger ─────────────────────────────────────────────────────────

  private triggerBattle(enemy: Enemy): void {
    if (this.inBattle || !enemy.active || !enemy.isAlive) return;
    this.inBattle = true;

    // Pause physics briefly, then launch Battle scene on top
    this.physics.pause();
    this.cameras.main.flash(180, 200, 0, 0);

    this.time.delayedCall(200, () => {
      this.scene.launch('Battle', {
        enemyLevel: enemy.level,
        enemyHp:    enemy.hp,
        clan:       GameState.clan,
        onWin:  () => {
          enemy.destroy();
          this.enemies = this.enemies.filter((e) => e !== enemy);
          this.physics.resume();
          this.inBattle = false;
        },
        onLose: () => {
          this.physics.resume();
          this.inBattle = false;
        },
      });
      this.scene.pause();
    });
  }

  // ── Resize ─────────────────────────────────────────────────────────────────

  private onResize(vw: number, vh: number): void {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, vh);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, vh);
    this.drawAllLayers(vw, vh);
    this.drawMiniMap(vw, vh);

    // Reposition joystick
    if (this.joystick) {
      this.joystick.setBase(80, vh - 100);
    }

    // Reposition world label
    if (this.hudWorldLabel) {
      this.hudWorldLabel.setX(vw - 16);
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    this.timeAcc += delta / 1000;

    if (this.inBattle) return;

    // Player movement
    if (this.player?.active) {
      this.player.update(this.joystick, this.cursors);
    }

    // Enemies
    if (this.player?.active) {
      this.enemies.forEach((e) => {
        if (e.active && e.isAlive) {
          e.update(this.player.x, this.player.y);
        }
      });
    }

    // Animated gate ring
    this.gateAngle += delta * 0.001;
    const gx = WORLD_WIDTH - 140;
    const gy = this.scale.height * 0.85 - 70;
    const g  = this.worldGateGraphics;
    // Overdraw spinning dashes on top of the static gate
    g.lineStyle(2, 0xc4b5fd, 0.55 + Math.sin(this.timeAcc * 2) * 0.2);
    const dashCount = 6;
    for (let d = 0; d < dashCount; d++) {
      const a0 = this.gateAngle + (Math.PI * 2 * d) / dashCount;
      const a1 = a0 + 0.35;
      g.beginPath();
      g.arc(gx, gy, 50, a0, a1, false);
      g.strokePath();
    }

    // HUD mini-map dot
    this.updateMiniMapDot(this.scale.width, this.scale.height);

    // Rebuild mini-map occasionally (enemies can die)
    if (Math.floor(this.timeAcc * 2) % 2 === 0) {
      this.drawMiniMap(this.scale.width, this.scale.height);
    }
  }
}
