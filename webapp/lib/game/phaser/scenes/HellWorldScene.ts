// /home/user/anonchatme-bot/webapp/lib/game/phaser/scenes/HellWorldScene.ts
import Phaser from "phaser";
import Player from "../objects/Player";
import Enemy from "../objects/Enemy";
import Joystick from "../ui/Joystick";
import { GameState } from "../GameState";

const WORLD_W = 3200;

export default class HellWorldScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: Phaser.GameObjects.Group;
  private joystick!: Joystick;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys | null;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private groundY!: number;
  private inBattle = false;

  constructor() { super("HellWorld"); }

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
    sky.fillGradientStyle(0x0a0000, 0x0a0000, 0x5c0000, 0x5c0000, 1);
    sky.fillRect(0, 0, w, h);

    // Volcanic mountains
    const mtFar = this.add.graphics().setScrollFactor(0.08, 0);
    mtFar.fillStyle(0x1a0000, 1);
    for (let i = 0; i < 10; i++) {
      const mx = i * 360 - 80;
      const mh = h * 0.35 + Math.sin(i * 1.3) * h * 0.1;
      mtFar.fillTriangle(mx, h * 0.72, mx + 180, h * 0.72 - mh, mx + 360, h * 0.72);
      // Lava glow at tips
      mtFar.fillStyle(0xff2200, 0.15);
      mtFar.fillCircle(mx + 180, h * 0.72 - mh, 20);
      mtFar.fillStyle(0x1a0000, 1);
    }

    // Lava pools on ground
    const lava = this.add.graphics().setScrollFactor(0.6, 0);
    lava.fillStyle(0xff4500, 0.3);
    for (let i = 0; i < 15; i++) {
      lava.fillEllipse(i * 220 + 50, this.groundY + 20, 120, 30);
    }

    // Ground
    const ground = this.add.graphics().setScrollFactor(1, 0);
    ground.fillGradientStyle(0x5c0000, 0x5c0000, 0x1a0000, 0x1a0000, 1);
    ground.fillRect(0, this.groundY, WORLD_W, h - this.groundY + 10);
    ground.lineStyle(3, 0xff4500, 0.6);
    ground.lineBetween(0, this.groundY, WORLD_W, this.groundY);

    // Cracks with lava glow
    ground.lineStyle(1, 0xff2200, 0.5);
    for (let i = 0; i < 25; i++) {
      const cx = Math.random() * WORLD_W;
      ground.lineBetween(cx, this.groundY + 5, cx + (Math.random() - 0.5) * 100, this.groundY + 35);
    }
  }

  private buildPlatforms(h: number) {
    this.platforms = this.physics.add.staticGroup();
    const g = this.add.graphics();
    g.fillStyle(0x5c0000, 0.01);
    g.fillRect(0, this.groundY, WORLD_W, 10);
    this.physics.add.existing(g, true);
    (g.body as Phaser.Physics.Arcade.StaticBody).setSize(WORLD_W, 10).setOffset(0, 0);
    this.platforms.add(g);

    const platData = [
      { x: 400, y: h * 0.56, w: 200 },
      { x: 900, y: h * 0.46, w: 160 },
      { x: 1500, y: h * 0.58, w: 220 },
      { x: 2100, y: h * 0.5, w: 180 },
      { x: 2650, y: h * 0.57, w: 200 },
    ];
    for (const p of platData) {
      const pg = this.add.graphics();
      pg.fillStyle(0x7f1d1d, 1);
      pg.fillRoundedRect(p.x, p.y, p.w, 16, 4);
      pg.lineStyle(2, 0xff4500, 0.7);
      pg.strokeRoundedRect(p.x, p.y, p.w, 16, 4);
      this.physics.add.existing(pg, true);
      (pg.body as Phaser.Physics.Arcade.StaticBody).setSize(p.w, 16).setOffset(p.x, p.y);
      this.platforms.add(pg);
    }
  }

  private buildAtmosphere(w: number, h: number) {
    // Embers rising
    this.add.particles(0, h, "pixel", {
      x: { min: 0, max: WORLD_W },
      speedX: { min: -20, max: 20 },
      speedY: { min: -80, max: -30 },
      lifespan: 3000,
      scale: { min: 1, max: 3 },
      tint: [0xff4500, 0xff6600, 0xffa500],
      alpha: { start: 0.9, end: 0 },
      frequency: 60,
      gravityY: -20,
    });

    // Large fire columns at edges
    for (const fx of [100, 500, 1000, 1600, 2200, 2800]) {
      this.add.particles(fx, this.groundY, "pixel", {
        speedX: { min: -15, max: 15 },
        speedY: { min: -60, max: -20 },
        lifespan: 800,
        scale: { min: 2, max: 5 },
        tint: [0xff4500, 0xff0000],
        alpha: { start: 0.8, end: 0 },
        frequency: 40,
      });
    }

    // Red moon
    const moon = this.add.graphics().setScrollFactor(0.04, 0);
    moon.fillStyle(0xff0000, 0.08);
    moon.fillCircle(w * 0.6, h * 0.15, 100);
    moon.fillStyle(0xcc0000, 0.5);
    moon.fillCircle(w * 0.6, h * 0.15, 50);
  }

  private spawnPlayer(h: number) {
    this.player = new Player(this, 200, this.groundY - 40, GameState.clan);
    this.physics.add.existing(this.player as any, false);
    ((this.player as any).body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
  }

  private spawnEnemies(h: number) {
    this.enemies = this.add.group();
    const positions = [600, 1200, 1900, 2500];
    for (let i = 0; i < positions.length; i++) {
      const e = new Enemy(this, positions[i], this.groundY - 35, 5 + i, 220);
      this.physics.add.existing(e as any, false);
      ((e as any).body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
      this.enemies.add(e as any);
    }
  }

  private buildGate(h: number) {
    const gate = this.add.graphics();
    gate.setPosition(WORLD_W - 120, this.groundY - 100);
    gate.fillStyle(0xff4500, 0.15);
    gate.fillRoundedRect(0, 0, 80, 100, 8);
    gate.lineStyle(3, 0xff4500, 0.9);
    gate.strokeRoundedRect(0, 0, 80, 100, 8);
    this.add.text(WORLD_W - 80, this.groundY - 118, "🌀 Выход", { fontSize: "13px", color: "#ff4500" }).setOrigin(0.5);
    this.add.particles(WORLD_W - 80, this.groundY - 50, "pixel", {
      speed: { min: 10, max: 40 }, lifespan: 900,
      scale: { min: 1, max: 3 }, tint: 0xff4500, alpha: { start: 0.9, end: 0 }, frequency: 50,
    });
    const zone = this.add.zone(WORLD_W - 120, this.groundY - 100, 90, 110).setOrigin(0);
    this.physics.add.existing(zone, true);
    this.physics.add.overlap(this.player as any, zone, () => {
      this.cameras.main.fade(500, 0, 0, 0);
      this.time.delayedCall(500, () => this.scene.start("WorldMap"));
    });
    this.tweens.add({ targets: gate, alpha: { from: 0.6, to: 1 }, duration: 800, yoyo: true, repeat: -1 });
  }

  private buildHUD(w: number) {
    const hp = this.add.graphics().setScrollFactor(0).setDepth(100);
    hp.fillStyle(0x000000, 0.5);
    hp.fillRoundedRect(12, 12, 140, 16, 8);
    hp.fillStyle(0xff4500, 1);
    hp.fillRoundedRect(14, 14, 136, 12, 6);
    this.add.text(14, 32, `Lv.${GameState.level} · Ад`, { fontSize: "11px", color: "rgba(255,255,255,0.55)" }).setScrollFactor(0).setDepth(100);
    this.add.text(w - 14, 14, "🔥 Ад", { fontSize: "12px", color: "#ff4500" }).setScrollFactor(0).setDepth(100).setOrigin(1, 0);
  }

  private triggerBattle() {
    if (this.inBattle) return;
    this.inBattle = true;
    this.cameras.main.flash(300, 255, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.pause();
      this.scene.launch("Battle", { callerScene: "HellWorld", world: "hell" });
    });
  }

  update() {
    this.player.update(this.joystick, this.cursors);
    this.enemies.getChildren().forEach((e) => (e as unknown as Enemy).update(this.player.x, this.player.y));
    this.joystick.update();
  }
}
