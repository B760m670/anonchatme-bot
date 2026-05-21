import { Element } from "./types";

// Цикл стихий: Огонь > Лёд > Ветер > Молния > Тьма > Огонь
export const ELEMENT_BEATS: Record<Element, Element> = {
  fire: "ice",
  ice: "wind",
  wind: "lightning",
  lightning: "dark",
  dark: "fire",
};

export const ELEMENT_LABEL: Record<Element, string> = {
  fire: "Огонь",
  ice: "Лёд",
  wind: "Ветер",
  lightning: "Молния",
  dark: "Тьма",
};

export const ADVANTAGE_BONUS = 0.25;   // +25% урона по слабости
export const RESIST_PENALTY = 0.15;    // -15% урона по сопротивлению

/** Множитель урона атакующей стихии против защитной. */
export function elementMultiplier(attacker: Element, defender: Element): number {
  if (ELEMENT_BEATS[attacker] === defender) return 1 + ADVANTAGE_BONUS;
  if (ELEMENT_BEATS[defender] === attacker) return 1 - RESIST_PENALTY;
  return 1;
}

/** "advantage" | "resist" | "neutral" — для подсветки в UI. */
export function matchupKind(attacker: Element, defender: Element): "advantage" | "resist" | "neutral" {
  if (ELEMENT_BEATS[attacker] === defender) return "advantage";
  if (ELEMENT_BEATS[defender] === attacker) return "resist";
  return "neutral";
}
