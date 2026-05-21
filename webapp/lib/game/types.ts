export type ClanId = "kage" | "hono" | "koori" | "kaze" | "tetsu";
export type Element = "fire" | "ice" | "wind" | "lightning" | "dark";
export type StatusEffect = "burn" | "poison" | "freeze" | "bleed" | "stun" | "dodge";
export type BattlePhase = "player_turn" | "enemy_turn" | "animating" | "win" | "lose";

export interface ClanStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

export interface Clan {
  id: ClanId;
  name: string;
  emoji: string;
  element: Element;
  color: string;
  gradient: string;
  tagline: string;
  style: string;
  stats: ClanStats;
  /** [skill1, skill2, ulta] — последний помечен isUlta */
  skillIds: string[];
}

export interface SkillEffect {
  type: "damage" | "heal" | "status" | "defend" | "buff";
  multiplier?: number;
  heal?: number;
  status?: StatusEffect;
  statusDuration?: number;
  defBonus?: number;
  atkBonus?: number;
  // ── расширения для сигнатурных навыков ──
  /** число ударов (мульти-хит, Кадзэ) */
  hits?: number;
  /** урон растёт на % потерянного HP бойца (Хоно) */
  scaleLostHp?: boolean;
  /** множитель удваивается, если враг не атаковал в прошлом ходу (Кагэ) */
  condNoAttack?: boolean;
  /** % отражения входящего урона (Коори) */
  reflectPct?: number;
  /** держать сниженный урон N ходов (Тэцу «Цитадель») */
  defendTurns?: number;
  /** контратака при получении урона в защите (Тэцу) */
  counter?: boolean;
  /** восстановление Ki при применении */
  kiGain?: number;
}

export interface Skill {
  id: string;
  name: string;
  emoji: string;
  apCost: number;
  kiCost: number;
  description: string;
  effect: SkillEffect;
  isUlta?: boolean;
}

export interface ActiveStatus {
  type: StatusEffect;
  turns: number;
}

export interface Fighter {
  id: string;
  name: string;
  clan: ClanId;
  level: number;
  hp: number;
  maxHp: number;
  ki: number;
  maxKi: number;
  atk: number;
  def: number;
  spd: number;
  statuses: ActiveStatus[];
  isDefending: boolean;
  atkBuff: number;
  // ── расширения боевого ядра ──
  ultaUsed: boolean;
  attackedLastTurn: boolean;
  /** ходов осталось со сниженным уроном (Тэцу «Цитадель») */
  defendTurnsLeft: number;
  /** % отражения урона, активный пока боец защищается */
  reflectPct: number;
  /** активна контратака при блоке */
  counterReady: boolean;
}

export interface BattleLogEntry {
  id: number;
  turn: number;
  message: string;
  type: "damage" | "heal" | "status" | "info" | "critical";
}

export interface BattleState {
  fighters: [Fighter, Fighter];
  turn: number;
  log: BattleLogEntry[];
  phase: BattlePhase;
  ap: number;
  maxAp: number;
}

export interface GameCharacter {
  id?: number;
  tg_id: number;
  clan: ClanId;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  elo: number;
  story_chapter: number;
  story_enemy_idx: number;
}

export interface StoryEnemy {
  name: string;
  clan: ClanId;
  level: number;
  title: string;
}

export interface StoryChapter {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  enemies: StoryEnemy[];
  reward: { xp: number };
}
