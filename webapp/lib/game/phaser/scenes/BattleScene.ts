// /home/user/anonchatme-bot/webapp/lib/game/phaser/scenes/BattleScene.ts
import Phaser from "phaser";
import { GameState } from "../GameState";
import { getClan } from "../../clans";
import { getSkill } from "../../skills";
import { createFighter, initBattle, applyPlayerAction, applyEnemyTurn } from "../../engine";
import { BattleState, ClanId } from "../../types";
import { STORY } from "../../story";

const ENEMY_CLANS: Record<string, ClanId> = {
  humans: "kaze", samurai: "hono", fallen: "kage", hell: "tetsu", heaven: "koori",
};

export default class BattleScene extends Phaser.Scene {
  private battle!: BattleState;
  private callerScene!: string;
  private world!: string;

  // UI elements
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private enemyHpBar!: Phaser.GameObjects.Graphics;
  private playerKiBar!: Phaser.GameObjects.Graphics;
  private enemyKiBar!: Phaser.GameObjects.Graphics;
  private logTexts: Phaser.GameObjects.Text[] = [];
  private apDots: Phaser.GameObjects.Graphics[] = [];
  private actionBtns: Phaser.GameObjects.Container[] = [];
  private playerFig!: Phaser.GameObjects.Graphics;
  private enemyFig!: Phaser.GameObjects.Graphics;
  private processing = false;

  constructor() { super("Battle"); }

  init(data: { callerScene: string; world: string }) {
    this.callerScene = data.callerScene ?? "WorldMap";
    this.world = data.world ?? "samurai";
  }

  create() {
    const { width: w, height: h } = this.scale;
    const enemyClan = ENEMY_CLANS[this.world] ?? "kaze";
    const playerClan = (GameState.clan || "kaze") as ClanId;

    const player = createFighter("player", "Ты", playerClan, GameState.level);
    const enemy = createFighter("enemy", this.getEnemyName(), enemyClan, Math.max(1, GameState.level - 1 + Math.floor(Math.random() * 3)));
    this.battle = initBattle(player, enemy);

    this.buildBattleBg(w, h);
    this.buildFighters(w, h, playerClan, enemyClan);
    this.buildBars(w, h);
    this.buildLog(w, h);
    this.buildApDots(w, h);
    this.buildActions(w, h, playerClan);
    this.updateBars();
  }

  private getEnemyName(): string {
    const names = ["Кагэ-но-Кен", "Ронин", "Стражник", "Демон", "Падший", "Призрак"];
    return names[Math.floor(Math.random() * names.length)];
  }

  private buildBattleBg(w: number, h: number) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0014, 0x0a0014, 0x1a0000, 0x1a0000, 1);
    bg.fillRect(0, 0, w, h);

    // Decorative lines
    bg.lineStyle(1, 0xffffff, 0.04);
    for (let i = 0; i < 8; i++) {
      bg.lineBetween(0, h * i / 8, w, h * i / 8);
    }

    // VS divider
    const divider = this.add.graphics();
    divider.lineStyle(1, 0xff4444, 0.3);
    divider.lineBetween(w / 2, 0, w / 2, h * 0.65);

    this.add.text(w / 2, h * 0.32, "VS", {
      fontSize: "28px", color: "#ff4444", fontStyle: "bold",
    }).setOrigin(0.5).setAlpha(0.4);

    // Particles
    this.add.particles(w / 2, h * 0.32, "pixel", {
      speedX: { min: -60, max: 60 }, speedY: { min: -20, max: 20 },
      lifespan: 1200, scale: { min: 1, max: 2 },
      tint: [0xff4444, 0xfbbf24], alpha: { start: 0.6, end: 0 }, frequency: 200,
    });
  }

  private buildFighters(w: number, h: number, playerClan: ClanId, enemyClan: ClanId) {
    const pClan = getClan(playerClan);
    const eClan = getClan(enemyClan);

    // Player figure (left side)
    this.playerFig = this.add.graphics();
    this.drawFigure(this.playerFig, w * 0.25, h * 0.3, Phaser.Display.Color.HexStringToColor(pClan.color).color, false);

    // Enemy figure (right side)
    this.enemyFig = this.add.graphics();
    this.drawFigure(this.enemyFig, w * 0.75, h * 0.3, Phaser.Display.Color.HexStringToColor(eClan.color).color, true);

    // Names
    const [player, enemy] = this.battle.fighters;
    this.add.text(w * 0.25, h * 0.14, player.name, { fontSize: "14px", color: "#fff", fontStyle: "bold" }).setOrigin(0.5);
    this.add.text(w * 0.25, h * 0.17, `Клан ${pClan.name}`, { fontSize: "11px", color: pClan.color }).setOrigin(0.5);
    this.add.text(w * 0.75, h * 0.14, enemy.name, { fontSize: "14px", color: "#fff", fontStyle: "bold" }).setOrigin(0.5);
    this.add.text(w * 0.75, h * 0.17, `Клан ${eClan.name}`, { fontSize: "11px", color: eClan.color }).setOrigin(0.5);
  }

  private drawFigure(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, flip: boolean) {
    g.clear();
    const d = flip ? -1 : 1;   // direction: 1 = facing right, -1 = facing left

    // ── Ground shadow ─────────────────────────────────────────────────────
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(x, y + 68, 44, 10);

    const dkColor = (() => {
      const r = ((color >> 16) & 0xff); const gv = ((color >> 8) & 0xff); const b = color & 0xff;
      const f = 0.65;
      return (Math.floor(r * f) << 16) | (Math.floor(gv * f) << 8) | Math.floor(b * f);
    })();

    // ── BACK LEG ──────────────────────────────────────────────────────────
    g.fillStyle(0x1a0a00, 1);
    g.fillRect(x - 9, y + 14, 14, 32);
    g.fillStyle(0x0a0500, 1);
    g.fillRect(x - 12, y + 43, 18, 8);

    // ── FRONT LEG ─────────────────────────────────────────────────────────
    g.fillStyle(0x2a1200, 1);
    g.fillRect(x - 4, y + 14, 14, 32);
    g.fillStyle(0x0d0700, 1);
    g.fillRect(x - 5, y + 43, 18, 8);

    // ── HAKAMA ────────────────────────────────────────────────────────────
    g.fillStyle(dkColor, 0.88);
    g.fillRect(x - 17, y + 10, 34, 14);

    // ── TORSO ─────────────────────────────────────────────────────────────
    g.fillStyle(color, 0.9);
    g.fillRect(x - 15, y - 18, 30, 30);

    // Armour panels
    g.lineStyle(1, 0x000000, 0.2);
    g.strokeRect(x - 15, y - 18, 30, 30);
    g.lineStyle(1, 0xffffff, 0.1);
    g.beginPath(); g.moveTo(x - 12, y - 6); g.lineTo(x + 12, y - 6); g.strokePath();

    // ── SHOULDER PADS ─────────────────────────────────────────────────────
    g.fillStyle(color, 1);
    g.fillRect(x - 24, y - 18, 11, 9);
    g.fillRect(x + 13, y - 18, 11, 9);

    // ── LEFT ARM ──────────────────────────────────────────────────────────
    g.fillStyle(color, 0.85);
    g.fillRect(x - 22, y - 15, 9, 24);

    // ── RIGHT ARM ─────────────────────────────────────────────────────────
    g.fillStyle(color, 0.85);
    g.fillRect(x + 13, y - 15, 9, 20);

    // ── KATANA ────────────────────────────────────────────────────────────
    const hx = x + d * 20, hy = y - 4;
    // Handle
    g.fillStyle(0x282018, 1);
    g.fillRect(hx - 3, hy, 6, 22);
    g.fillStyle(0xfbbf24, 0.85);
    g.fillRect(hx - 3, hy + 4, 6, 4);
    g.fillRect(hx - 3, hy + 12, 6, 4);
    // Guard
    g.fillStyle(0x1e1a14, 1);
    g.fillRect(hx - 7, hy - 3, 14, 5);
    // Gold collar
    g.fillStyle(0xfbbf24, 1);
    g.fillRect(hx - 4, hy - 8, 8, 6);
    // Blade (diagonal)
    g.fillStyle(0xc8c8c8, 0.95);
    g.fillTriangle(hx - 4, hy - 8,  hx + 3, hy - 8,  hx + d * 36, hy - 52);
    g.lineStyle(1, 0xffffff, 0.6);
    g.beginPath();
    g.moveTo(hx, hy - 8);
    g.lineTo(hx + d * 36, hy - 52);
    g.strokePath();

    // ── NECK ──────────────────────────────────────────────────────────────
    g.fillStyle(0xdaa87a, 1);
    g.fillRect(x - 4, y - 24, 8, 8);

    // ── HEAD ──────────────────────────────────────────────────────────────
    const hairColor = color === 0x94a3b8 ? 0x2d3f55 : 0x140a00;
    g.fillStyle(hairColor, 1);
    g.fillCircle(x, y - 38, 16);
    // Spiky anime hair
    g.fillStyle(color, 0.9);
    g.fillTriangle(x - 13, y - 46, x - 5, y - 38, x - 10, y - 58);
    g.fillTriangle(x - 4,  y - 44, x + 4,  y - 44, x,     y - 62);
    g.fillTriangle(x + 5,  y - 46, x + 13, y - 38, x + 10, y - 58);
    // Hair base
    g.fillStyle(hairColor, 1);
    g.fillRect(x - 16, y - 50, 32, 14);
    // Face
    g.fillStyle(0xdaa87a, 1);
    g.fillCircle(x, y - 38, 14);

    // ── ANIME EYES ────────────────────────────────────────────────────────
    const eyeOff = flip ? 2 : -2;
    g.fillStyle(0xf0e8d8, 1);
    g.fillEllipse(x + eyeOff - 5, y - 38, 7, 9);
    g.fillEllipse(x + eyeOff + 5, y - 38, 7, 9);
    g.fillStyle(color, 0.85);
    g.fillEllipse(x + eyeOff - 5, y - 38, 5, 7);
    g.fillEllipse(x + eyeOff + 5, y - 38, 5, 7);
    g.fillStyle(0x0a0000, 1);
    g.fillCircle(x + eyeOff - 5, y - 38, 2);
    g.fillCircle(x + eyeOff + 5, y - 38, 2);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x + eyeOff - 4, y - 39, 1);
    g.fillCircle(x + eyeOff + 6, y - 39, 1);

    // Eyebrows
    g.lineStyle(2, hairColor, 0.9);
    g.beginPath(); g.moveTo(x + eyeOff - 9, y - 44); g.lineTo(x + eyeOff - 2, y - 42); g.strokePath();
    g.beginPath(); g.moveTo(x + eyeOff + 9, y - 44); g.lineTo(x + eyeOff + 2, y - 42); g.strokePath();

    // Mouth
    g.lineStyle(1.2, 0x7a4a22, 0.75);
    g.beginPath(); g.moveTo(x - 3, y - 30); g.lineTo(x + 3, y - 30); g.strokePath();

    // ── AURA GLOW ─────────────────────────────────────────────────────────
    g.fillStyle(color, 0.06);
    g.fillCircle(x, y, 52);
    g.fillStyle(color, 0.1);
    g.fillCircle(x, y - 10, 36);
    g.lineStyle(1.5, color, 0.3);
    g.strokeCircle(x, y - 10, 36);
  }

  private buildBars(w: number, h: number) {
    const barY = h * 0.2;
    const barW = w * 0.35;

    // Player HP
    const playerHpBg = this.add.graphics();
    playerHpBg.fillStyle(0x000000, 0.5);
    playerHpBg.fillRoundedRect(12, barY, barW, 14, 7);
    this.playerHpBar = this.add.graphics();

    // Player Ki
    const playerKiBg = this.add.graphics();
    playerKiBg.fillStyle(0x000000, 0.4);
    playerKiBg.fillRoundedRect(12, barY + 18, barW, 8, 4);
    this.playerKiBar = this.add.graphics();

    this.add.text(12, barY - 14, "HP", { fontSize: "10px", color: "rgba(255,255,255,0.5)" });
    this.add.text(12, barY + 30, "Ki", { fontSize: "10px", color: "rgba(168,139,250,0.7)" });

    // Enemy HP
    const enemyHpBg = this.add.graphics();
    enemyHpBg.fillStyle(0x000000, 0.5);
    enemyHpBg.fillRoundedRect(w - 12 - barW, barY, barW, 14, 7);
    this.enemyHpBar = this.add.graphics();

    const enemyKiBg = this.add.graphics();
    enemyKiBg.fillStyle(0x000000, 0.4);
    enemyKiBg.fillRoundedRect(w - 12 - barW, barY + 18, barW, 8, 4);
    this.enemyKiBar = this.add.graphics();

    this.add.text(w - 12 - barW, barY - 14, "HP", { fontSize: "10px", color: "rgba(255,255,255,0.5)" });
    this.add.text(w - 12 - barW, barY + 30, "Ki", { fontSize: "10px", color: "rgba(168,139,250,0.7)" });
  }

  private updateBars() {
    const { width: w, height: h } = this.scale;
    const barY = h * 0.2;
    const barW = w * 0.35;
    const [player, enemy] = this.battle.fighters;

    const hpColor = (pct: number) => pct > 0.5 ? 0x4ade80 : pct > 0.25 ? 0xfbbf24 : 0xf87171;

    const pHpPct = player.hp / player.maxHp;
    this.playerHpBar.clear();
    this.playerHpBar.fillStyle(hpColor(pHpPct), 1);
    this.playerHpBar.fillRoundedRect(14, barY + 2, Math.max(0, (barW - 4) * pHpPct), 10, 5);

    this.playerKiBar.clear();
    this.playerKiBar.fillStyle(0xa78bfa, 1);
    this.playerKiBar.fillRoundedRect(14, barY + 20, Math.max(0, (barW - 4) * (player.ki / player.maxKi)), 4, 2);

    const eHpPct = enemy.hp / enemy.maxHp;
    this.enemyHpBar.clear();
    this.enemyHpBar.fillStyle(hpColor(eHpPct), 1);
    this.enemyHpBar.fillRoundedRect(w - 12 - barW + 2, barY + 2, Math.max(0, (barW - 4) * eHpPct), 10, 5);

    this.enemyKiBar.clear();
    this.enemyKiBar.fillStyle(0xa78bfa, 1);
    this.enemyKiBar.fillRoundedRect(w - 12 - barW + 2, barY + 20, Math.max(0, (barW - 4) * (enemy.ki / enemy.maxKi)), 4, 2);
  }

  private buildLog(w: number, h: number) {
    const logY = h * 0.63;
    const logBg = this.add.graphics();
    logBg.fillStyle(0x000000, 0.4);
    logBg.fillRoundedRect(10, logY, w - 20, 60, 10);

    for (let i = 0; i < 3; i++) {
      this.logTexts.push(
        this.add.text(w / 2, logY + 8 + i * 18, "", {
          fontSize: "12px", color: "#fff", wordWrap: { width: w - 40 },
        }).setOrigin(0.5, 0)
      );
    }
  }

  private updateLog() {
    const last = this.battle.log.slice(-3);
    for (let i = 0; i < 3; i++) {
      const entry = last[i];
      if (!entry) { this.logTexts[i].setText(""); continue; }
      const colors: Record<string, string> = { damage: "#f87171", critical: "#fbbf24", heal: "#4ade80", status: "#c084fc", info: "rgba(255,255,255,0.7)" };
      this.logTexts[i].setText(entry.message).setColor(colors[entry.type] ?? "#fff");
    }
  }

  private buildApDots(w: number, h: number) {
    const dotY = h * 0.6;
    for (let i = 0; i < 3; i++) {
      const g = this.add.graphics();
      this.apDots.push(g);
      g.setPosition(w / 2 - 20 + i * 20, dotY);
    }
    this.updateApDots();
  }

  private updateApDots() {
    this.apDots.forEach((g, i) => {
      g.clear();
      g.fillStyle(i < this.battle.ap ? 0xfbbf24 : 0x374151, 1);
      g.fillCircle(0, 0, 6);
    });
  }

  private buildActions(w: number, h: number, clan: ClanId) {
    const btnY = h * 0.73;
    const clanData = getClan(clan);

    const actions = [
      { label: "⚔️ Атака", sub: "1 AP", action: () => this.doAction("attack") },
      { label: "🛡 Защита", sub: "1 AP", action: () => this.doAction("defend") },
      ...clanData.skillIds.map((id) => {
        const sk = getSkill(id);
        return { label: `${sk.emoji} ${sk.name}`, sub: `${sk.apCost}AP·${sk.kiCost}Ki`, action: () => this.doAction({ skill: id }) };
      }),
    ];

    const cols = 2;
    const btnW = (w - 24) / cols - 6;
    const btnH = 46;

    actions.forEach((a, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = 12 + col * (btnW + 6);
      const by = btnY + row * (btnH + 6);

      const container = this.add.container(bx, by);
      const bg = this.add.graphics();
      bg.fillStyle(0x1f2937, 0.9);
      bg.fillRoundedRect(0, 0, btnW, btnH, 10);
      bg.lineStyle(1, 0x374151, 1);
      bg.strokeRoundedRect(0, 0, btnW, btnH, 10);

      const label = this.add.text(10, 8, a.label, { fontSize: "13px", color: "#fff", fontStyle: "bold" });
      const sub = this.add.text(10, 26, a.sub, { fontSize: "10px", color: "rgba(255,255,255,0.4)" });

      container.add([bg, label, sub]);
      container.setSize(btnW, btnH).setInteractive();
      container.on("pointerdown", () => {
        if (this.processing || this.battle.phase !== "player_turn") return;
        this.tweens.add({ targets: container, scaleX: 0.95, scaleY: 0.95, duration: 80, yoyo: true });
        a.action();
      });
      container.on("pointerover", () => { bg.clear(); bg.fillStyle(0x374151, 0.95); bg.fillRoundedRect(0, 0, btnW, btnH, 10); });
      container.on("pointerout", () => { bg.clear(); bg.fillStyle(0x1f2937, 0.9); bg.fillRoundedRect(0, 0, btnW, btnH, 10); });

      this.actionBtns.push(container);
    });
  }

  private doAction(action: "attack" | "defend" | { skill: string }) {
    if (this.processing) return;
    this.processing = true;

    this.battle = applyPlayerAction(this.battle, action);
    this.updateBars();
    this.updateLog();
    this.updateApDots();

    // Attack animation
    this.tweens.add({
      targets: this.playerFig, x: "+=" + 30,
      duration: 120, yoyo: true,
      onComplete: () => { this.tweens.add({ targets: this.enemyFig, x: "+=" + 10, duration: 80, yoyo: true }); },
    });

    if (this.battle.phase === "win" || this.battle.phase === "lose") {
      this.time.delayedCall(600, () => this.showEndScreen());
      return;
    }

    if (this.battle.phase === "enemy_turn") {
      this.time.delayedCall(800, () => {
        this.battle = applyEnemyTurn(this.battle);
        this.updateBars();
        this.updateLog();
        this.updateApDots();

        // Enemy attack animation
        this.tweens.add({
          targets: this.enemyFig, x: "-=" + 30,
          duration: 120, yoyo: true,
          onComplete: () => { this.tweens.add({ targets: this.playerFig, x: "-=" + 10, duration: 80, yoyo: true }); },
        });

        this.processing = false;

        if (this.battle.phase === "win" || this.battle.phase === "lose") {
          this.time.delayedCall(600, () => this.showEndScreen());
        }
      });
    } else {
      this.processing = false;
    }
  }

  private showEndScreen() {
    const { width: w, height: h } = this.scale;
    const isWin = this.battle.phase === "win";

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, w, h);
    overlay.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 400 });

    this.add.text(w / 2, h * 0.3, isWin ? "🏆" : "💀", { fontSize: "72px" }).setOrigin(0.5).setAlpha(0)
      .setAlpha(0);

    const emoji = this.add.text(w / 2, h * 0.3, isWin ? "🏆" : "💀", { fontSize: "72px" }).setOrigin(0.5).setAlpha(0);
    const title = this.add.text(w / 2, h * 0.48, isWin ? "Победа!" : "Поражение", {
      fontSize: "32px", color: isWin ? "#fbbf24" : "#f87171", fontStyle: "bold",
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: [emoji, title], alpha: 1, duration: 500, delay: 300 });

    // Return button
    this.time.delayedCall(800, () => {
      const btn = this.add.graphics();
      const bx = w / 2 - 80, by = h * 0.6;
      btn.fillStyle(0xfbbf24, 1);
      btn.fillRoundedRect(bx, by, 160, 48, 12);
      const btnText = this.add.text(w / 2, by + 24, "Вернуться", {
        fontSize: "16px", color: "#000", fontStyle: "bold",
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: [btn, btnText], alpha: 1, duration: 300 });

      btn.setInteractive(new Phaser.Geom.Rectangle(bx, by, 160, 48), Phaser.Geom.Rectangle.Contains);
      btn.on("pointerdown", () => {
        this.scene.stop();
        this.scene.resume(this.callerScene);
      });
    });
  }
}
