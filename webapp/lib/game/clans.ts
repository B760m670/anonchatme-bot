import { Clan, ClanId } from "./types";

export const CLANS: Record<ClanId, Clan> = {
  kage: {
    id: "kage",
    name: "Кагэ",
    emoji: "🌑",
    color: "#A855F7",
    gradient: "linear-gradient(135deg, #1a0533 0%, #4c1d95 60%, #7c3aed 100%)",
    tagline: "Тени не лгут",
    style: "Ассассин",
    stats: { hp: 80, atk: 95, def: 65, spd: 115 },
    skillIds: ["shadow_strike", "poison_blade", "vanish", "night_slash"],
  },
  hono: {
    id: "hono",
    name: "Хоно",
    emoji: "🔥",
    color: "#EF4444",
    gradient: "linear-gradient(135deg, #450a0a 0%, #991b1b 60%, #ef4444 100%)",
    tagline: "Огонь не знает пощады",
    style: "Берсерк",
    stats: { hp: 95, atk: 115, def: 55, spd: 80 },
    skillIds: ["flame_slash", "inferno_burst", "berserk_rage", "ember"],
  },
  koori: {
    id: "koori",
    name: "Коори",
    emoji: "❄️",
    color: "#38BDF8",
    gradient: "linear-gradient(135deg, #0c1a4a 0%, #1e3a8a 60%, #0ea5e9 100%)",
    tagline: "Холод острее стали",
    style: "Контроль",
    stats: { hp: 100, atk: 70, def: 110, spd: 75 },
    skillIds: ["ice_shard", "blizzard", "frost_barrier", "freeze_strike"],
  },
  kaze: {
    id: "kaze",
    name: "Кадзэ",
    emoji: "💨",
    color: "#10B981",
    gradient: "linear-gradient(135deg, #022c22 0%, #065f46 60%, #10b981 100%)",
    tagline: "Ветер не знает преград",
    style: "Мастер",
    stats: { hp: 88, atk: 88, def: 80, spd: 100 },
    skillIds: ["wind_slash", "gale_combo", "swift_step", "tempest"],
  },
  tetsu: {
    id: "tetsu",
    name: "Тэцу",
    emoji: "⚔️",
    color: "#94A3B8",
    gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #475569 100%)",
    tagline: "Сталь не сгибается",
    style: "Страж",
    stats: { hp: 130, atk: 75, def: 120, spd: 55 },
    skillIds: ["iron_strike", "steel_wall", "counter_strike", "fortress"],
  },
};

export const CLAN_LIST: Clan[] = Object.values(CLANS);

export function getClan(id: ClanId): Clan {
  return CLANS[id];
}
