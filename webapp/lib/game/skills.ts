import { Skill } from "./types";

// По дизайн-доку: у каждого клана 2 клановых навыка + 1 ульта (раз за бой).
// Базовая Атака и Блок встроены в движок и здесь не описываются.
export const SKILLS: Record<string, Skill> = {
  // ─── Кагэ (Тень / Ассасин) ───
  shadow_strike: {
    id: "shadow_strike", name: "Удар тени", emoji: "🌑",
    apCost: 2, kiCost: 20,
    description: "Молниеносный удар из темноты",
    effect: { type: "damage", multiplier: 1.8 },
  },
  poison_blade: {
    id: "poison_blade", name: "Клинок яда", emoji: "💀",
    apCost: 3, kiCost: 40,
    description: "Урон + яд на 3 хода (копится до 5 стаков)",
    effect: { type: "status", multiplier: 1.3, status: "poison", statusDuration: 3 },
  },
  death_shadow: {
    id: "death_shadow", name: "Смертная тень", emoji: "🗡",
    apCost: 3, kiCost: 80, isUlta: true,
    description: "Урон ×2.5, удваивается если враг не атаковал в прошлом ходу",
    effect: { type: "damage", multiplier: 2.5, condNoAttack: true },
  },

  // ─── Хоно (Пламя / Берсерк) ───
  flame_slash: {
    id: "flame_slash", name: "Огненный разрез", emoji: "🔥",
    apCost: 2, kiCost: 20,
    description: "Урон + поджигает врага на 3 хода",
    effect: { type: "status", multiplier: 1.4, status: "burn", statusDuration: 3 },
  },
  berserk_rage: {
    id: "berserk_rage", name: "Ярость берсерка", emoji: "😡",
    apCost: 3, kiCost: 40,
    description: "+45 к атаке до конца хода",
    effect: { type: "buff", atkBonus: 45 },
  },
  blazing_fury: {
    id: "blazing_fury", name: "Пылающая ярость", emoji: "💥",
    apCost: 3, kiCost: 80, isUlta: true,
    description: "Урон растёт за каждый % потерянного HP",
    effect: { type: "damage", multiplier: 1.5, scaleLostHp: true },
  },

  // ─── Коори (Лёд / Контролёр) ───
  ice_shard: {
    id: "ice_shard", name: "Осколок льда", emoji: "🧊",
    apCost: 2, kiCost: 20,
    description: "Острый кристалл пронзает врага",
    effect: { type: "damage", multiplier: 1.5 },
  },
  frost_barrier: {
    id: "frost_barrier", name: "Ледяной барьер", emoji: "🛡",
    apCost: 3, kiCost: 40,
    description: "+80% защиты и отражает 30% урона",
    effect: { type: "defend", defBonus: 80, reflectPct: 30 },
  },
  frozen_chains: {
    id: "frozen_chains", name: "Ледяные оковы", emoji: "❄️",
    apCost: 3, kiCost: 80, isUlta: true,
    description: "Урон + враг пропускает следующий ход",
    effect: { type: "status", multiplier: 1.2, status: "freeze", statusDuration: 1 },
  },

  // ─── Кадзэ (Ветер / Мастер) ───
  wind_slash: {
    id: "wind_slash", name: "Порыв ветра", emoji: "💨",
    apCost: 2, kiCost: 20,
    description: "Стремительный рассекающий удар",
    effect: { type: "damage", multiplier: 1.5 },
  },
  swift_step: {
    id: "swift_step", name: "Быстрый шаг", emoji: "⚡",
    apCost: 3, kiCost: 40,
    description: "Уклонение от следующей атаки + 25 Ki",
    effect: { type: "status", status: "dodge", statusDuration: 1, kiGain: 25 },
  },
  wind_arrow: {
    id: "wind_arrow", name: "Стрела ветра", emoji: "🌪",
    apCost: 3, kiCost: 80, isUlta: true,
    description: "Три удара подряд, каждый копит Ki",
    effect: { type: "damage", multiplier: 0.95, hits: 3, kiGain: 10 },
  },

  // ─── Тэцу (Железо / Страж) ───
  iron_strike: {
    id: "iron_strike", name: "Удар стали", emoji: "⚔️",
    apCost: 2, kiCost: 20,
    description: "Тяжёлый пробивающий удар",
    effect: { type: "damage", multiplier: 1.6 },
  },
  counter_strike: {
    id: "counter_strike", name: "Контрудар", emoji: "🔄",
    apCost: 3, kiCost: 40,
    description: "Защита + контратака при получении удара",
    effect: { type: "defend", defBonus: 60, counter: true },
  },
  steel_citadel: {
    id: "steel_citadel", name: "Стальная цитадель", emoji: "🏯",
    apCost: 3, kiCost: 80, isUlta: true,
    description: "−80% урона на 2 хода + контратака при блоке",
    effect: { type: "defend", defBonus: 400, defendTurns: 2, counter: true },
  },
};

export function getSkill(id: string): Skill {
  return SKILLS[id] ?? SKILLS["iron_strike"];
}
