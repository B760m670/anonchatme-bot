import { Skill } from "./types";

export const SKILLS: Record<string, Skill> = {
  // ─── Кагэ ───
  shadow_strike: {
    id: "shadow_strike", name: "Удар тени", emoji: "🌑",
    apCost: 2, kiCost: 20,
    description: "Молниеносный удар из темноты",
    effect: { type: "damage", multiplier: 1.8 },
  },
  poison_blade: {
    id: "poison_blade", name: "Клинок яда", emoji: "💀",
    apCost: 2, kiCost: 15,
    description: "Отравляет врага на 3 хода",
    effect: { type: "status", multiplier: 0.7, status: "poison", statusDuration: 3 },
  },
  vanish: {
    id: "vanish", name: "Исчезновение", emoji: "👻",
    apCost: 1, kiCost: 10,
    description: "Уходишь в тень, +50% защиты",
    effect: { type: "defend", defBonus: 50 },
  },
  night_slash: {
    id: "night_slash", name: "Ночной разрез", emoji: "🌙",
    apCost: 3, kiCost: 30,
    description: "Серия молниеносных ударов",
    effect: { type: "damage", multiplier: 2.3 },
  },

  // ─── Хоно ───
  flame_slash: {
    id: "flame_slash", name: "Огненный разрез", emoji: "🔥",
    apCost: 2, kiCost: 15,
    description: "Поджигает врага на 2 хода",
    effect: { type: "status", multiplier: 1.1, status: "burn", statusDuration: 2 },
  },
  inferno_burst: {
    id: "inferno_burst", name: "Взрыв пламени", emoji: "💥",
    apCost: 3, kiCost: 35,
    description: "Мощнейший огненный удар",
    effect: { type: "damage", multiplier: 2.5 },
  },
  berserk_rage: {
    id: "berserk_rage", name: "Ярость берсерка", emoji: "😡",
    apCost: 2, kiCost: 20,
    description: "+40 к атаке на этот ход",
    effect: { type: "buff", atkBonus: 40 },
  },
  ember: {
    id: "ember", name: "Искра", emoji: "✨",
    apCost: 1, kiCost: 8,
    description: "Быстрый огненный выпад",
    effect: { type: "damage", multiplier: 0.9 },
  },

  // ─── Коори ───
  ice_shard: {
    id: "ice_shard", name: "Осколок льда", emoji: "🧊",
    apCost: 2, kiCost: 15,
    description: "Острый кристалл пронзает врага",
    effect: { type: "damage", multiplier: 1.4 },
  },
  blizzard: {
    id: "blizzard", name: "Метель", emoji: "🌨",
    apCost: 3, kiCost: 30,
    description: "Замораживает врага на 1 ход",
    effect: { type: "status", multiplier: 1.4, status: "freeze", statusDuration: 1 },
  },
  frost_barrier: {
    id: "frost_barrier", name: "Ледяной барьер", emoji: "🛡",
    apCost: 2, kiCost: 20,
    description: "+80% защиты на этот ход",
    effect: { type: "defend", defBonus: 80 },
  },
  freeze_strike: {
    id: "freeze_strike", name: "Ледяной удар", emoji: "❄️",
    apCost: 2, kiCost: 18,
    description: "Сковывает врага, пропускает ход",
    effect: { type: "status", multiplier: 0.6, status: "freeze", statusDuration: 1 },
  },

  // ─── Кадзэ ───
  wind_slash: {
    id: "wind_slash", name: "Порыв ветра", emoji: "💨",
    apCost: 2, kiCost: 12,
    description: "Стремительный рассекающий удар",
    effect: { type: "damage", multiplier: 1.5 },
  },
  gale_combo: {
    id: "gale_combo", name: "Шквальное комбо", emoji: "🌪",
    apCost: 3, kiCost: 25,
    description: "5 молниеносных ударов подряд",
    effect: { type: "damage", multiplier: 2.1 },
  },
  swift_step: {
    id: "swift_step", name: "Быстрый шаг", emoji: "⚡",
    apCost: 1, kiCost: 10,
    description: "Уклонение и восстановление Ki",
    effect: { type: "defend", defBonus: 30 },
  },
  tempest: {
    id: "tempest", name: "Шторм", emoji: "🌩",
    apCost: 3, kiCost: 35,
    description: "Атака + восстанавливает 15 HP",
    effect: { type: "damage", multiplier: 1.8, heal: 15 },
  },

  // ─── Тэцу ───
  iron_strike: {
    id: "iron_strike", name: "Удар стали", emoji: "⚔️",
    apCost: 2, kiCost: 15,
    description: "Тяжёлый пробивающий удар",
    effect: { type: "damage", multiplier: 1.6 },
  },
  steel_wall: {
    id: "steel_wall", name: "Стальная стена", emoji: "🏯",
    apCost: 2, kiCost: 20,
    description: "+100% защиты на этот ход",
    effect: { type: "defend", defBonus: 100 },
  },
  counter_strike: {
    id: "counter_strike", name: "Контрудар", emoji: "🔄",
    apCost: 2, kiCost: 18,
    description: "Защита + мощный ответный удар",
    effect: { type: "damage", multiplier: 1.4, defBonus: 60 },
  },
  fortress: {
    id: "fortress", name: "Крепость", emoji: "🏰",
    apCost: 3, kiCost: 30,
    description: "Восстанавливает 35 HP",
    effect: { type: "heal", heal: 35 },
  },
};

export function getSkill(id: string): Skill {
  return SKILLS[id] ?? SKILLS["ember"];
}
