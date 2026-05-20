// /home/user/anonchatme-bot/webapp/lib/game/phaser/scenes/HumanWorldScene.ts
import Phaser from "phaser";
import Player from "../objects/Player";
import Enemy from "../objects/Enemy";
import Joystick from "../ui/Joystick";
import { GameState } from "../GameState";

const WORLD_W = 3200;

export default class HumanWorldScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: Phaser.GameObjects.Group;
  private joystick!: Joystick;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys | null;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private groundY!: number;
  private bgLayers: Phaser.GameObjects.Graphics[] = [];
  private inBattle = false;

  constructor() { super("HumanWorld"); }

  create() {
    const { width, height } = this.scale;
    this.groundY = height * 0.82;
    this.cameras.main.setBounds(0, 0, WORLD_W, height);
    this.physics.world.setBounds(0, 0, WORLD_W, height);

    this.buildBackground(width, height);
    this.buildPlatforms(height);
    this.buildAtmosphere(width, height);
    this.spawnPlayer(height);
    this.spawnEnemies(height);
    this.buildHUD(width);
    this.buildGate(height);

    this.joystick = new Joystick(this, 80, height - 80);
    this.cursors = this.input.keyboard?.createCursorKeys() ?? null;
    this.cameras.main.startFollow(this.player as any, true, 0.1, 0.1);

    this.physics.add.collider(this.player as any, this.platforms);
    this.physics.add.overlap(this.player as any, this.enemies, () => this.triggerBattle());
  }

  private buildBackground(w: number, h: number) {
    // Sky - dawn blue-green
    const sky = this.add.graphics().setScrollFactor(0, 0);
    sky.fillGradientStyle(0x0a1628, 0x0a1628, 0x1a4a3a, 0x1a4a3a, 1);
    sky.fillRect(0, 0, w, h);

    // Far mountains (teal/dark)
    const mtFar = this.add.graphics().setScrollFactor(0.08, 0);
    for (let i = 0; i < 10; i++) {
      const mx = i * 340 - 100;
      const mh = h * 0.3 + Math.sin(i * 1.7) * h * 0.08;
      mtFar.fillStyle(0x0d2d1f, 1);
      mtFar.fillTriangle(mx, h * 0.7, mx + 200, h * 0.7 - mh, mx + 400, h * 0.7);
    }

    // Mid hills (green)
    const hills = this.add.graphics().setScrollFactor(0.2, 0);
    for (let i = 0; i < 8; i++) {
      const hx = i * 500 - 100;
      hills.fillStyle(0x14532d, 1);
      hills.fillEllipse(hx + 200, h * 0.72, 500, 180);
    }

    // Village silhouettes
    const village = this.add.graphics().setScrollFactor(0.4, 0);
    village.fillStyle(0x052e16, 1);
    for (let i = 0; i < 12; i++) {
      const bx = i * 280 + 50;
      const bh = 60 + Math.sin(i * 2.3) * 30;
      village.fillRect(bx, h * 0.75 - bh, 40, bh);
      village.fillTriangle(bx - 10, h * 0.75 - bh, bx + 20, h * 0.75 - bh - 30, bx + 50, h * 0.75 - bh);
    }

    // Ground
    const ground = this.add.graphics().setScrollFactor(1, 0);
    ground.fillGradientStyle(0x14532d, 0x14532d, 0x052e16, 0x052e16, 1);
    ground.fillRect(0, this.groundY, WORLD_W, h - this.groundY + 10);

    // Ground detail line
    ground.lineStyle(2, 0x4ade80, 0.3);
    ground.lineBetween(0, this.groundY, WORLD_W, this.groundY);

    this.bgLayers = [sky, mtFar, hills, village, ground];
  }

  private buildPlatforms(h: number) {
    this.platforms = this.physics.add.staticGroup();
    // Main ground
    const ground = this.add.graphics();
    ground.fillStyle(0x14532d, 0.01);
    ground.fillRect(0, this.groundY, WORLD_W, 10);
    this.physics.add.existing(ground, true);
    (ground.body as Phaser.Physics.Arcade.StaticBody).setSize(WORLD_W, 10).setOffset(0, 0);
    this.platforms.add(ground);

    // Floating platforms
    const platData = [
      { x: 500, y: h * 0.6, w: 200 },
      { x: 900, y: h * 0.5, w: 160 },
      { x: 1400, y: h * 0.62, w: 220 },
      { x: 2000, y: h * 0.55, w: 180 },
      { x: 2600, y: h * 0.6, w: 200 },
    ];

    for (const p of platData) {
      const g = this.add.graphics();
      g.fillStyle(0x14532d, 1);
      g.fillRoundedRect(p.x, p.y, p.w, 18, 6);
      g.lineStyle(2, 0x4ade80, 0.5);
      g.strokeRoundedRect(p.x, p.y, p.w, 18, 6);
      this.physics.add.existing(g, true);
      (g.body as Phaser.Physics.Arcade.StaticBody).setSize(p.w, 18).setOffset(p.x, p.y);
      this.platforms.add(g);
    }
  }

  private buildAtmosphere(w: number, h: number) {
    // Sakura petals
    this.add.particles(0, -20, "pixel", {
      x: { min: 0, max: WORLD_W },
      y: { min: -20, max: -10 },
      speedX: { min: -15, max: 30 },
      speedY: { min: 25, max: 60 },
      lifespan: 9000,
      scale: { min: 1, max: 3 },
      tint: [0xffb7c5, 0xff69b4, 0xfce7f3],
      alpha: { start: 0.8, end: 0 },
      frequency: 200,
      gravityY: 5,
    });

    // Sun glow
    const sun = this.add.graphics().setScrollFactor(0.05, 0);
    sun.fillStyle(0xfbbf24, 0.15);
    sun.fillCircle(w * 0.25, h * 0.2, 80);
    sun.fillStyle(0xfbbf24, 0.08);
    sun.fillCircle(w * 0.25, h * 0.2, 130);
    sun.fillStyle(0xfde68a, 0.6);
    sun.fillCircle(w * 0.25, h * 0.2, 30);
  }

  private spawnPlayer(h: number) {
    this.player = new Player(this, 200, this.groundY - 40, GameState.clan);
    this.physics.add.existing(this.player as any, false);
    const body = (this.player as any).body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
  }

  private spawnEnemies(h: number) {
    this.enemies = this.add.group();
    const positions = [600, 1100, 1800, 2400];
    for (let i = 0; i < positions.length; i++) {
      const e = new Enemy(this, positions[i], this.groundY - 35, i + 1, 180);
      this.physics.add.existing(e as any, false);
      ((e as any).body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
      this.enemies.add(e as any);
    }
  }

  private buildGate(h: number) {
    const gate = this.add.graphics();
    gate.setPosition(WORLD_W - 120, this.groundY - 100);
    gate.fillStyle(0x10b981, 0.2);
    gate.fillRoundedRect(0, 0, 80, 100, 10);
    gate.lineStyle(3, 0x10b981, 0.9);
    gate.strokeRoundedRect(0, 0, 80, 100, 10);

    this.add.text(WORLD_W - 100, this.groundY - 120, "🌀 Выход", {
      fontSize: "13px", color: "#10b981",
    }).setOrigin(0.5);

    this.add.particles(WORLD_W - 80, this.groundY - 50, "pixel", {
      speed: { min: 10, max: 40 }, lifespan: 1200,
      scale: { min: 1, max: 2 }, tint: 0x10b981, alpha: { start: 0.8, end: 0 }, frequency: 80,
    });

    const gateZone = this.add.zone(WORLD_W - 120, this.groundY - 100, 90, 110).setOrigin(0);
    this.physics.add.existing(gateZone, true);
    this.physics.add.overlap(this.player as any, gateZone, () => {
      this.cameras.main.fade(500, 0, 0, 0);
      this.time.delayedCall(500, () => this.scene.start("WorldMap"));
    });

    this.tweens.add({ targets: gate, alpha: { from: 0.7, to: 1 }, duration: 1200, yoyo: true, repeat: -1 });
  }

  private buildHUD(w: number) {
    const hp = this.add.graphics().setScrollFactor(0).setDepth(100);
    hp.fillStyle(0x000000, 0.5);
    hp.fillRoundedRect(12, 12, 140, 16, 8);
    hp.fillStyle(0x4ade80, 1);
    hp.fillRoundedRect(14, 14, 136, 12, 6);

    this.add.text(14, 32, `Lv.${GameState.level} · Мир людей`, {
      fontSize: "11px", color: "rgba(255,255,255,0.55)",
    }).setScrollFactor(0).setDepth(100);

    this.add.text(w - 14, 14, "🌿 Мир людей", {
      fontSize: "12px", color: "#4ade80",
    }).setScrollFactor(0).setDepth(100).setOrigin(1, 0);
  }

  private triggerBattle() {
    if (this.inBattle) return;
    this.inBattle = true;
    this.cameras.main.flash(300, 255, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.pause();
      this.scene.launch("Battle", { callerScene: "HumanWorld", world: "humans" });
    });
  }

  update() {
    this.player.update(this.joystick, this.cursors);
    this.enemies.getChildren().forEach((e) => {
      (e as unknown as Enemy).update(this.player.x, this.player.y);
    });
    this.joystick.update();
  }
}
