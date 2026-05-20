import Phaser from "phaser";
import { GameState } from "./GameState";

// Scenes imported lazily to avoid SSR issues
import BootScene from "./scenes/BootScene";
import MenuScene from "./scenes/MenuScene";
import WorldMapScene from "./scenes/WorldMapScene";
import SamuraiWorldScene from "./scenes/SamuraiWorldScene";
import HumanWorldScene from "./scenes/HumanWorldScene";
import FallenWorldScene from "./scenes/FallenWorldScene";
import HellWorldScene from "./scenes/HellWorldScene";
import HeavenWorldScene from "./scenes/HeavenWorldScene";
import BattleScene from "./scenes/BattleScene";

export function initGame(parent: HTMLElement, tgId: number, clan: string, level: number): Phaser.Game {
  GameState.tgId = tgId;
  GameState.clan = clan as import('./GameState').ClanId;
  GameState.level = level;

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#0a0a1a",
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 600 }, debug: false },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [
      BootScene,
      MenuScene,
      WorldMapScene,
      SamuraiWorldScene,
      HumanWorldScene,
      FallenWorldScene,
      HellWorldScene,
      HeavenWorldScene,
      BattleScene,
    ],
    render: { antialias: true, pixelArt: false },
    input: { activePointers: 3 },
  };

  return new Phaser.Game(config);
}
