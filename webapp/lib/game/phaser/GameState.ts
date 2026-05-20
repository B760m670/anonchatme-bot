// /home/user/anonchatme-bot/webapp/lib/game/phaser/GameState.ts

export type ClanId = 'kage' | 'hono' | 'koori' | 'kaze' | 'tetsu';
export type WorldId =
  | 'humans'
  | 'samurai'
  | 'fallen'
  | 'hell'
  | 'heaven';

export interface GameStateData {
  tgId: number;
  clan: ClanId;
  characterName: string;
  level: number;
  currentWorld: WorldId;
  unlockedWorlds: WorldId[];
}

class GameStateClass {
  tgId: number = 0;
  clan: ClanId = 'kage';
  characterName: string = 'Воин';
  level: number = 1;
  currentWorld: WorldId = 'samurai';
  unlockedWorlds: WorldId[] = ['humans', 'samurai'];

  /** Replace all fields at once (e.g. when loading from server). */
  set(data: Partial<GameStateData>): void {
    if (data.tgId !== undefined) this.tgId = data.tgId;
    if (data.clan !== undefined) this.clan = data.clan;
    if (data.characterName !== undefined) this.characterName = data.characterName;
    if (data.level !== undefined) this.level = data.level;
    if (data.currentWorld !== undefined) this.currentWorld = data.currentWorld;
    if (data.unlockedWorlds !== undefined) this.unlockedWorlds = [...data.unlockedWorlds];
  }

  isWorldUnlocked(worldId: WorldId): boolean {
    return this.unlockedWorlds.includes(worldId);
  }

  unlockWorld(worldId: WorldId): void {
    if (!this.isWorldUnlocked(worldId)) {
      this.unlockedWorlds.push(worldId);
    }
  }

  toJSON(): GameStateData {
    return {
      tgId: this.tgId,
      clan: this.clan,
      characterName: this.characterName,
      level: this.level,
      currentWorld: this.currentWorld,
      unlockedWorlds: [...this.unlockedWorlds],
    };
  }
}

// Singleton instance
export const GameState = new GameStateClass();

/** Convenience helper used by React/Next.js integration code. */
export function setGameState(data: Partial<GameStateData>): void {
  GameState.set(data);
}

export default GameState;
