import { Clan, ClanId } from "./types";

export const CLANS: Record<ClanId, Clan> = {
  kage: {
    id: "kage",
    name: "Кагэ",
    emoji: "🌑",
    element: "dark",
    color: "#A855F7",
    gradient: "linear-gradient(135deg, #1a0533 0%, #4c1d95 60%, #7c3aed 100%)",
    tagline: "Тени не лгут",
    style: "Ассасин",
    stats: { hp: 85, atk: 120, def: 60, spd: 130 },
    skillIds: ["shadow_strike", "poison_blade", "death_shadow"],
  },
  hono: {
    id: "hono",
    name: "Хоно",
    emoji: "🔥",
    element: "fire",
    color: "#EF4444",
    gradient: "linear-gradient(135deg, #450a0a 0%, #991b1b 60%, #ef4444 100%)",
    tagline: "Огонь не знает пощады",
    style: "Берсерк",
    stats: { hp: 130, atk: 130, def: 75, spd: 90 },
    skillIds: ["flame_slash", "berserk_rage", "blazing_fury"],
  },
  koori: {
    id: "koori",
    name: "Коори",
    emoji: "❄️",
    element: "ice",
    color: "#38BDF8",
    gradient: "linear-gradient(135deg, #0c1a4a 0%, #1e3a8a 60%, #0ea5e9 100%)",
    tagline: "Холод острее стали",
    style: "Контролёр",
    stats: { hp: 110, atk: 85, def: 120, spd: 80 },
    skillIds: ["ice_shard", "frost_barrier", "frozen_chains"],
  },
  kaze: {
    id: "kaze",
    name: "Кадзэ",
    emoji: "💨",
    element: "wind",
    color: "#10B981",
    gradient: "linear-gradient(135deg, #022c22 0%, #065f46 60%, #10b981 100%)",
    tagline: "Ветер не знает преград",
    style: "Мастер",
    stats: { hp: 100, atk: 100, def: 100, spd: 110 },
    skillIds: ["wind_slash", "swift_step", "wind_arrow"],
  },
  tetsu: {
    id: "tetsu",
    name: "Тэцу",
    emoji: "⚔️",
    element: "lightning",
    color: "#94A3B8",
    gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #475569 100%)",
    tagline: "Сталь не сгибается",
    style: "Страж",
    stats: { hp: 150, atk: 85, def: 140, spd: 70 },
    skillIds: ["iron_strike", "counter_strike", "steel_citadel"],
  },
};

export const CLAN_LIST: Clan[] = Object.values(CLANS);

export function getClan(id: ClanId): Clan {
  return CLANS[id];
}
