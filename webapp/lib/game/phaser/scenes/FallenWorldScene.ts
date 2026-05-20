// /home/user/anonchatme-bot/webapp/lib/game/phaser/scenes/FallenWorldScene.ts
import Phaser from "phaser";
import Player from "../objects/Player";
import Enemy from "../objects/Enemy";
import Joystick from "../ui/Joystick";
import { GameState } from "../GameState";

const WORLD_W = 3200;

export default class FallenWorldScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: Phaser.GameObjects.Group;
  private joystick!: Joystick;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys | null;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private groundY!: number;
  private inBattle = false;

  constructor() { super("FallenWorld"); }

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
    const sky = this.add.graphics().setScrollFactor(0, 0);
    sky.fillGradientStyle(0x0a0015, 0x0a0015, 0x2d0057, 0x2d0057, 1);
    sky.fillRect(0, 0, w, h);

    // Cracked/dead landscape silhouettes
    const farLayer = this.add.graphics().setScrollFactor(0.1, 0);
    farLayer.fillStyle(0x1a0030, 1);
    for (let i = 0; i < 12; i++) {
      const mx = i * 300 - 50;
      const mh = h * 0.25 + Math.sin(i * 2.1) * h * 0.1;
      farLayer.fillTriangle(mx, h * 0.7, mx + 150, h * 0.7 - mh, mx + 300, h * 0.7);
    }

    // Dead trees
    const trees = this.add.graphics().setScrollFactor(0.35, 0);
    trees.lineStyle(2, 0x3b0764, 1);
    for (let i = 0; i < 20; i++) {
      const tx = i * 180 + 30;
      const th = 60 + Math.random() * 50;
      trees.lineBetween(tx, this.groundY, tx, this.groundY - th);
      trees.lineBetween(tx, this.groundY - th * 0.6, tx - 25, this.groundY - th * 0.85);
      trees.lineBetween(tx, this.groundY - th * 0.6, tx + 25, this.groundY - th * 0.85);
    }

    // Corrupted ground
    const ground = this.add.graphics().setScrollFactor(1, 0);
    ground.fillGradientStyle(0x2d0057, 0x2d0057, 0x0a0015, 0x0a0015, 1);
    ground.fillRect(0, this.groundY, WORLD_W, h - this.groundY + 10);
    ground.lineStyle(2, 0xa855f7, 0.4);
    ground.lineBetween(0, this.groundY, WORLD_W, this.groundY);

    // Cracks on ground
    ground.lineStyle(1, 0xa855f7, 0.25);
    for (let i = 0; i < 30; i++) {
      const cx = Math.random() * WORLD_W;
      const cy = this.groundY + Math.random() * 40;
      ground.lineBetween(cx, cy, cx + (Math.random() - 0.5) * 80, cy + Math.random() * 30);
    }
  }

  private buildPlatforms(h: number) {
    this.platforms = this.physics.add.staticGroup();
    const g = this.add.graphics();
    g.fillStyle(0x2d0057, 0.01);
    g.fillRect(0, this.groundY, WORLD_W, 10);
    this.physics.add.existing(g, true);
    (g.body as Phaser.Physics.Arcade.StaticBody).setSize(WORLD_W, 10).setOffset(0, 0);
    this.platforms.add(g);

    const platData = [
      { x: 450, y: h * 0.58, w: 180 },
      { x: 1000, y: h * 0.48, w: 150 },
      { x: 1600, y: h * 0.6, w: 200 },
      { x: 2200, y: h * 0.52, w: 170 },
      { x: 2700, y: h * 0.58, w: 190 },
    ];
    for (const p of platData) {
      const pg = this.add.graphics();
      pg.fillStyle(0x4c1d95, 1);
      pg.fillRoundedRect(p.x, p.y, p.w, 16, 5);
      pg.lineStyle(2, 0xa855f7, 0.6);
      pg.strokeRoundedRect(p.x, p.y, p.w, 16, 5);
      this.physics.add.existing(pg, true);
      (pg.body as Phaser.Physics.Arcade.StaticBody).setSize(p.w, 16).setOffset(p.x, p.y);
      this.platforms.add(pg);
    }
  }

  private buildAtmosphere(w: number, h: number) {
    // Dark floating spores
    this.add.particles(0, 0, "pixel", {
      x: { min: 0, max: WORLD_W },
      y: { min: 0, max: h },
      speedX: { min: -8, max: 8 },
      speedY: { min: -20, max: -5 },
      lifespan: 6000,
      scale: { min: 1, max: 2 },
      tint: [0xa855f7, 0x7c3aed, 0xc084fc],
      alpha: { start: 0.6, end: 0 },
      frequency: 120,
    });

    // Purple moon
    const moon = this.add.graphics().setScrollFactor(0.06, 0);
    moon.fillStyle(0x4c1d95, 0.5);
    moon.fillCircle(w * 0.7, h * 0.18, 55);
    moon.fillStyle(0xa855f7, 0.15);
    moon.fillCircle(w * 0.7, h * 0.18, 80);
    moon.fillStyle(0x7c3aed, 0.7);
    moon.fillCircle(w * 0.7, h * 0.18, 35);
  }

  private spawnPlayer(h: number) {
    this.player = new Player(this, 200, this.groundY - 40, GameState.clan);
    this.physics.add.existing(this.player as any, false);
    ((this.player as any).body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
  }

  private spawnEnemies(h: number) {
    this.enemies = this.add.group();
    const positions = [700, 1300, 2000, 2600];
    for (let i = 0; i < positions.length; i++) {
      const e = new Enemy(this, positions[i], this.groundY - 35, 3 + i, 200);
      this.physics.add.existing(e as any, false);
      ((e as any).body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
      this.enemies.add(e as any);
    }
  }

  private buildGate(h: number) {
    const gate = this.add.graphics();
    gate.setPosition(WORLD_W - 120, this.groundY - 100);
    gate.fillStyle(0xa855f7, 0.2);
    gate.fillRoundedRect(0, 0, 80, 100, 10);
    gate.lineStyle(3, 0xa855f7, 0.9);
    gate.strokeRoundedRect(0, 0, 80, 100, 10);
    this.add.text(WORLD_W - 80, this.groundY - 118, "🌀 Выход", { fontSize: "13px", color: "#a855f7" }).setOrigin(0.5);
    this.add.particles(WORLD_W - 80, this.groundY - 50, "pixel", {
      speed: { min: 10, max: 35 }, lifespan: 1000,
      scale: { min: 1, max: 2 }, tint: 0xa855f7, alpha: { start: 0.7, end: 0 }, frequency: 70,
    });
    const zone = this.add.zone(WORLD_W - 120, this.groundY - 100, 90, 110).setOrigin(0);
    this.physics.add.existing(zone, true);
    this.physics.add.overlap(this.player as any, zone, () => {
      this.cameras.main.fade(500, 0, 0, 0);
      this.time.delayedCall(500, () => this.scene.start("WorldMap"));
    });
    this.tweens.add({ targets: gate, alpha: { from: 0.7, to: 1 }, duration: 1400, yoyo: true, repeat: -1 });
  }

  private buildHUD(w: number) {
    const hp = this.add.graphics().setScrollFactor(0).setDepth(100);
    hp.fillStyle(0x000000, 0.5);
    hp.fillRoundedRect(12, 12, 140, 16, 8);
    hp.fillStyle(0xa855f7, 1);
    hp.fillRoundedRect(14, 14, 136, 12, 6);
    this.add.text(14, 32, `Lv.${GameState.level} · Мир падших`, { fontSize: "11px", color: "rgba(255,255,255,0.55)" }).setScrollFactor(0).setDepth(100);
    this.add.text(w - 14, 14, "💀 Мир падших", { fontSize: "12px", color: "#a855f7" }).setScrollFactor(0).setDepth(100).setOrigin(1, 0);
  }

  private triggerBattle() {
    if (this.inBattle) return;
    this.inBattle = true;
    this.cameras.main.flash(300, 100, 0, 150);
    this.time.delayedCall(300, () => {
      this.scene.pause();
      this.scene.launch("Battle", { callerScene: "FallenWorld", world: "fallen" });
    });
  }

  update() {
    this.player.update(this.joystick, this.cursors);
    this.enemies.getChildren().forEach((e) => (e as unknown as Enemy).update(this.player.x, this.player.y));
    this.joystick.update();
  }
}
