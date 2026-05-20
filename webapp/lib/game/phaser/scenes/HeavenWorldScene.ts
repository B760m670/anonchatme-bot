// /home/user/anonchatme-bot/webapp/lib/game/phaser/scenes/HeavenWorldScene.ts
import Phaser from "phaser";
import Player from "../objects/Player";
import Enemy from "../objects/Enemy";
import Joystick from "../ui/Joystick";
import { GameState } from "../GameState";

const WORLD_W = 3200;

export default class HeavenWorldScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: Phaser.GameObjects.Group;
  private joystick!: Joystick;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys | null;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private groundY!: number;
  private inBattle = false;

  constructor() { super("HeavenWorld"); }

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
    sky.fillGradientStyle(0x1e3a5f, 0x1e3a5f, 0xfef3c7, 0xfef3c7, 1);
    sky.fillRect(0, 0, w, h);

    // Layered clouds far
    const cloudsFar = this.add.graphics().setScrollFactor(0.05, 0);
    cloudsFar.fillStyle(0xffffff, 0.12);
    for (let i = 0; i < 15; i++) {
      cloudsFar.fillEllipse(i * 250 + 80, h * 0.15 + Math.sin(i) * 40, 220, 70);
    }

    // Mid clouds
    const cloudsMid = this.add.graphics().setScrollFactor(0.18, 0);
    cloudsMid.fillStyle(0xffffff, 0.2);
    for (let i = 0; i < 10; i++) {
      cloudsMid.fillEllipse(i * 380 + 60, h * 0.3 + Math.cos(i * 1.3) * 30, 300, 90);
    }

    // Golden ground (cloud platform)
    const ground = this.add.graphics().setScrollFactor(1, 0);
    ground.fillGradientStyle(0xfde68a, 0xfde68a, 0xf59e0b, 0xf59e0b, 1);
    ground.fillRect(0, this.groundY, WORLD_W, h - this.groundY + 10);
    ground.lineStyle(3, 0xfbbf24, 0.9);
    ground.lineBetween(0, this.groundY, WORLD_W, this.groundY);

    // Golden cloud puffs on ground edge
    ground.fillStyle(0xfef3c7, 0.5);
    for (let i = 0; i < 30; i++) {
      ground.fillEllipse(i * 120 + 40, this.groundY, 100, 35);
    }
  }

  private buildPlatforms(h: number) {
    this.platforms = this.physics.add.staticGroup();
    const g = this.add.graphics();
    g.fillStyle(0xfde68a, 0.01);
    g.fillRect(0, this.groundY, WORLD_W, 10);
    this.physics.add.existing(g, true);
    (g.body as Phaser.Physics.Arcade.StaticBody).setSize(WORLD_W, 10).setOffset(0, 0);
    this.platforms.add(g);

    const platData = [
      { x: 420, y: h * 0.55, w: 200 },
      { x: 950, y: h * 0.44, w: 180 },
      { x: 1500, y: h * 0.57, w: 220 },
      { x: 2100, y: h * 0.48, w: 190 },
      { x: 2700, y: h * 0.54, w: 210 },
    ];
    for (const p of platData) {
      const pg = this.add.graphics();
      pg.fillStyle(0xfef3c7, 0.9);
      pg.fillRoundedRect(p.x, p.y, p.w, 18, 9);
      pg.lineStyle(2, 0xfbbf24, 0.8);
      pg.strokeRoundedRect(p.x, p.y, p.w, 18, 9);
      this.physics.add.existing(pg, true);
      (pg.body as Phaser.Physics.Arcade.StaticBody).setSize(p.w, 18).setOffset(p.x, p.y);
      this.platforms.add(pg);
    }
  }

  private buildAtmosphere(w: number, h: number) {
    // Golden light particles
    this.add.particles(0, 0, "star", {
      x: { min: 0, max: WORLD_W },
      y: { min: 0, max: h * 0.7 },
      speedX: { min: -5, max: 5 },
      speedY: { min: 10, max: 30 },
      lifespan: 7000,
      scale: { min: 0.5, max: 1.5 },
      tint: [0xfbbf24, 0xfde68a, 0xfef9c3],
      alpha: { start: 0.8, end: 0 },
      frequency: 150,
      gravityY: 0,
    });

    // Rays of light from top
    const rays = this.add.graphics().setScrollFactor(0.03, 0);
    rays.fillStyle(0xfbbf24, 0.04);
    for (let i = 0; i < 8; i++) {
      const rx = w * 0.5 + Math.sin(i * 0.9) * w * 0.5;
      rays.fillTriangle(rx, 0, rx - 60, h, rx + 60, h);
    }

    // Glowing sun
    const sun = this.add.graphics().setScrollFactor(0.05, 0);
    [120, 80, 50, 30].forEach((r, i) => {
      sun.fillStyle(0xfbbf24, [0.06, 0.1, 0.2, 0.9][i]);
      sun.fillCircle(w * 0.5, h * 0.12, r);
    });
  }

  private spawnPlayer(h: number) {
    this.player = new Player(this, 200, this.groundY - 40, GameState.clan);
    this.physics.add.existing(this.player as any, false);
    ((this.player as any).body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
  }

  private spawnEnemies(h: number) {
    this.enemies = this.add.group();
    // Fallen angels as enemies
    const positions = [650, 1300, 2000, 2650];
    for (let i = 0; i < positions.length; i++) {
      const e = new Enemy(this, positions[i], this.groundY - 35, 6 + i, 200);
      this.physics.add.existing(e as any, false);
      ((e as any).body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
      this.enemies.add(e as any);
    }
  }

  private buildGate(h: number) {
    const gate = this.add.graphics();
    gate.setPosition(WORLD_W - 120, this.groundY - 100);
    gate.fillStyle(0xfbbf24, 0.15);
    gate.fillRoundedRect(0, 0, 80, 100, 10);
    gate.lineStyle(3, 0xfbbf24, 0.9);
    gate.strokeRoundedRect(0, 0, 80, 100, 10);
    this.add.text(WORLD_W - 80, this.groundY - 118, "🌀 Выход", { fontSize: "13px", color: "#fbbf24" }).setOrigin(0.5);
    this.add.particles(WORLD_W - 80, this.groundY - 50, "star", {
      speed: { min: 10, max: 40 }, lifespan: 1500,
      scale: { min: 0.5, max: 1.5 }, tint: 0xfbbf24, alpha: { start: 0.9, end: 0 }, frequency: 80,
    });
    const zone = this.add.zone(WORLD_W - 120, this.groundY - 100, 90, 110).setOrigin(0);
    this.physics.add.existing(zone, true);
    this.physics.add.overlap(this.player as any, zone, () => {
      this.cameras.main.fade(600, 255, 240, 200);
      this.time.delayedCall(600, () => this.scene.start("WorldMap"));
    });
    this.tweens.add({ targets: gate, alpha: { from: 0.7, to: 1 }, duration: 1800, yoyo: true, repeat: -1 });
  }

  private buildHUD(w: number) {
    const hp = this.add.graphics().setScrollFactor(0).setDepth(100);
    hp.fillStyle(0x000000, 0.3);
    hp.fillRoundedRect(12, 12, 140, 16, 8);
    hp.fillStyle(0xfbbf24, 1);
    hp.fillRoundedRect(14, 14, 136, 12, 6);
    this.add.text(14, 32, `Lv.${GameState.level} · Рай`, { fontSize: "11px", color: "rgba(0,0,0,0.55)" }).setScrollFactor(0).setDepth(100);
    this.add.text(w - 14, 14, "✨ Рай", { fontSize: "12px", color: "#78350f" }).setScrollFactor(0).setDepth(100).setOrigin(1, 0);
  }

  private triggerBattle() {
    if (this.inBattle) return;
    this.inBattle = true;
    this.cameras.main.flash(400, 255, 240, 150);
    this.time.delayedCall(400, () => {
      this.scene.pause();
      this.scene.launch("Battle", { callerScene: "HeavenWorld", world: "heaven" });
    });
  }

  update() {
    this.player.update(this.joystick, this.cursors);
    this.enemies.getChildren().forEach((e) => (e as unknown as Enemy).update(this.player.x, this.player.y));
    this.joystick.update();
  }
}
