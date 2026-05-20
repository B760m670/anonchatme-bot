import { Fighter, BattleState, BattleLogEntry, ClanId, StatusEffect } from "./types";
import { getClan } from "./clans";
import { getSkill } from "./skills";

let logIdCounter = 0;

function mkLog(turn: number, message: string, type: BattleLogEntry["type"]): BattleLogEntry {
  return { id: logIdCounter++, turn, message, type };
}

export function createFighter(id: string, name: string, clan: ClanId, level: number): Fighter {
  const c = getClan(clan);
  const scale = 1 + (level - 1) * 0.12;
  return {
    id, name, clan, level,
    hp: Math.floor(c.stats.hp * scale),
    maxHp: Math.floor(c.stats.hp * scale),
    ki: 40,
    maxKi: 100,
    atk: Math.floor(c.stats.atk * scale),
    def: Math.floor(c.stats.def * scale),
    spd: c.stats.spd,
    statuses: [],
    isDefending: false,
    atkBuff: 0,
  };
}

export function initBattle(player: Fighter, enemy: Fighter): BattleState {
  const first = player.spd >= enemy.spd ? player.name : enemy.name;
  return {
    fighters: [player, enemy],
    turn: 1,
    log: [mkLog(0, `⚔️ Дуэль начинается! ${first} ходит первым!`, "info")],
    phase: player.spd >= enemy.spd ? "player_turn" : "enemy_turn",
    ap: 3,
    maxAp: 3,
  };
}

function rollDamage(atk: number, def: number, mult: number, defending: boolean): { dmg: number; crit: boolean } {
  const defReduction = defending ? 0.3 : 1.0;
  const base = Math.max(1, atk * mult - def * 0.35 * defReduction);
  const variance = 0.88 + Math.random() * 0.24;
  const crit = Math.random() < 0.15;
  return { dmg: Math.floor(base * variance * (crit ? 1.5 : 1)), crit };
}

function applyStatuses(fighter: Fighter, turn: number, log: BattleLogEntry[]): void {
  const dmgPerStatus: Partial<Record<StatusEffect, number>> = { burn: 8, poison: 6, bleed: 10 };
  for (const s of fighter.statuses) {
    if (s.type === "freeze" || s.type === "stun") continue;
    const dmg = dmgPerStatus[s.type];
    if (dmg) {
      fighter.hp = Math.max(0, fighter.hp - dmg);
      const label: Record<StatusEffect, string> = { burn: "огня", poison: "яда", bleed: "кровотечения", freeze: "", stun: "" };
      log.push(mkLog(turn, `🩸 ${fighter.name} теряет ${dmg} HP от ${label[s.type]}`, "damage"));
    }
    s.turns--;
  }
  fighter.statuses = fighter.statuses.filter((s) => s.turns > 0);
}

export type ActionType = "attack" | "defend" | { skill: string };

export function applyPlayerAction(state: BattleState, action: ActionType): BattleState {
  const s: BattleState = JSON.parse(JSON.stringify(state));
  const [player, enemy] = s.fighters;

  if (s.phase !== "player_turn") return s;

  // Check if player is frozen/stunned
  const frozen = player.statuses.find((st) => st.type === "freeze" || st.type === "stun");
  if (frozen) {
    s.log.push(mkLog(s.turn, `🧊 ${player.name} скован льдом и не может двигаться!`, "status"));
    player.statuses = player.statuses.filter((st) => st !== frozen);
    endPlayerTurn(s);
    return s;
  }

  if (action === "attack") {
    const { dmg, crit } = rollDamage(player.atk + player.atkBuff, enemy.def, 1.0, enemy.isDefending);
    enemy.hp = Math.max(0, enemy.hp - dmg);
    s.log.push(mkLog(s.turn, crit ? `💥 КРИТ! ${player.name} наносит ${dmg} урона!` : `⚔️ ${player.name} атакует — ${dmg} урона`, crit ? "critical" : "damage"));
    s.ap -= 1;
  } else if (action === "defend") {
    player.isDefending = true;
    player.ki = Math.min(player.maxKi, player.ki + 15);
    s.log.push(mkLog(s.turn, `🛡 ${player.name} принимает защитную стойку (+15 Ki)`, "info"));
    s.ap -= 1;
  } else {
    const skill = getSkill(action.skill);
    if (player.ki < skill.kiCost) {
      s.log.push(mkLog(s.turn, `❌ Недостаточно Ki для "${skill.name}"`, "info"));
      return s;
    }
    player.ki = Math.max(0, player.ki - skill.kiCost);
    const ef = skill.effect;

    if (ef.type === "damage") {
      const { dmg, crit } = rollDamage(player.atk + player.atkBuff, enemy.def, ef.multiplier!, enemy.isDefending);
      enemy.hp = Math.max(0, enemy.hp - dmg);
      if (ef.heal) player.hp = Math.min(player.maxHp, player.hp + ef.heal);
      s.log.push(mkLog(s.turn, crit ? `💥 КРИТ! ${skill.emoji} "${skill.name}" — ${dmg} урона!` : `${skill.emoji} "${skill.name}" — ${dmg} урона`, crit ? "critical" : "damage"));
    } else if (ef.type === "heal") {
      player.hp = Math.min(player.maxHp, player.hp + ef.heal!);
      s.log.push(mkLog(s.turn, `💚 ${skill.emoji} "${skill.name}" — восстановлено ${ef.heal} HP`, "heal"));
    } else if (ef.type === "status") {
      if (ef.multiplier && ef.multiplier > 0) {
        const { dmg } = rollDamage(player.atk + player.atkBuff, enemy.def, ef.multiplier, enemy.isDefending);
        enemy.hp = Math.max(0, enemy.hp - dmg);
      }
      if (ef.status) {
        enemy.statuses.push({ type: ef.status, turns: ef.statusDuration! });
        const label: Record<string, string> = { burn: "горит", poison: "отравлен", freeze: "заморожен", bleed: "кровоточит", stun: "оглушён" };
        s.log.push(mkLog(s.turn, `${skill.emoji} "${skill.name}" — ${enemy.name} ${label[ef.status]}!`, "status"));
      }
    } else if (ef.type === "defend") {
      player.isDefending = true;
      if (ef.defBonus) player.def = Math.floor(player.def * (1 + ef.defBonus / 100));
      s.log.push(mkLog(s.turn, `${skill.emoji} "${skill.name}" — усиленная защита!`, "info"));
    } else if (ef.type === "buff") {
      if (ef.atkBonus) player.atkBuff += ef.atkBonus;
      s.log.push(mkLog(s.turn, `${skill.emoji} "${skill.name}" — мощь возрастает!`, "info"));
    }

    s.ap -= skill.apCost;
  }

  if (enemy.hp <= 0) {
    s.phase = "win";
    s.log.push(mkLog(s.turn, `🏆 Победа! ${player.name} одержал победу!`, "info"));
    return s;
  }

  if (s.ap <= 0) endPlayerTurn(s);
  return s;
}

function endPlayerTurn(s: BattleState): void {
  const [player, enemy] = s.fighters;
  player.isDefending = false;
  player.atkBuff = 0;
  s.phase = "enemy_turn";

  applyStatuses(enemy, s.turn, s.log);
  if (enemy.hp <= 0) {
    s.phase = "win";
    s.log.push(mkLog(s.turn, `🏆 Победа! ${player.name} одержал победу!`, "info"));
  }
}

export function applyEnemyTurn(state: BattleState): BattleState {
  const s: BattleState = JSON.parse(JSON.stringify(state));
  const [player, enemy] = s.fighters;

  if (s.phase !== "enemy_turn") return s;

  const frozen = enemy.statuses.find((st) => st.type === "freeze" || st.type === "stun");
  if (frozen) {
    s.log.push(mkLog(s.turn, `🧊 ${enemy.name} скован льдом и пропускает ход!`, "status"));
    enemy.statuses = enemy.statuses.filter((st) => st !== frozen);
  } else {
    const clan = getClan(enemy.clan);
    const afk = enemyChooseAction(enemy, player, clan.skillIds);

    if (afk === "attack") {
      const { dmg, crit } = rollDamage(enemy.atk + enemy.atkBuff, player.def, 1.0, player.isDefending);
      player.hp = Math.max(0, player.hp - dmg);
      s.log.push(mkLog(s.turn, crit ? `💥 КРИТ! ${enemy.name} — ${dmg} урона!` : `⚔️ ${enemy.name} атакует — ${dmg} урона`, crit ? "critical" : "damage"));
    } else if (afk === "defend") {
      enemy.isDefending = true;
      enemy.ki = Math.min(enemy.maxKi, enemy.ki + 15);
      s.log.push(mkLog(s.turn, `🛡 ${enemy.name} уходит в оборону`, "info"));
    } else {
      const skill = getSkill(afk.skill);
      enemy.ki = Math.max(0, enemy.ki - skill.kiCost);
      const ef = skill.effect;
      if (ef.type === "damage") {
        const { dmg, crit } = rollDamage(enemy.atk + enemy.atkBuff, player.def, ef.multiplier!, player.isDefending);
        player.hp = Math.max(0, player.hp - dmg);
        if (ef.heal) enemy.hp = Math.min(enemy.maxHp, enemy.hp + ef.heal);
        s.log.push(mkLog(s.turn, crit ? `💥 КРИТ! ${skill.emoji} "${skill.name}" — ${dmg} урона!` : `${skill.emoji} "${skill.name}" — ${dmg} урона`, crit ? "critical" : "damage"));
      } else if (ef.type === "heal") {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + ef.heal!);
        s.log.push(mkLog(s.turn, `💚 ${skill.emoji} "${skill.name}" — ${enemy.name} восстанавливает ${ef.heal} HP`, "heal"));
      } else if (ef.type === "status") {
        if (ef.multiplier && ef.multiplier > 0) {
          const { dmg } = rollDamage(enemy.atk, player.def, ef.multiplier, player.isDefending);
          player.hp = Math.max(0, player.hp - dmg);
        }
        if (ef.status) {
          player.statuses.push({ type: ef.status, turns: ef.statusDuration! });
          const label: Record<string, string> = { burn: "горит", poison: "отравлен", freeze: "заморожен", bleed: "кровоточит", stun: "оглушён" };
          s.log.push(mkLog(s.turn, `${skill.emoji} "${skill.name}" — ${player.name} ${label[ef.status]}!`, "status"));
        }
      } else if (ef.type === "buff") {
        if (ef.atkBonus) enemy.atkBuff += ef.atkBonus;
        s.log.push(mkLog(s.turn, `${skill.emoji} "${skill.name}" — ${enemy.name} усиливается!`, "info"));
      } else if (ef.type === "defend") {
        enemy.isDefending = true;
        s.log.push(mkLog(s.turn, `${skill.emoji} "${skill.name}" — усиленная защита!`, "info"));
      }
    }
  }

  if (player.hp <= 0) {
    s.phase = "lose";
    s.log.push(mkLog(s.turn, `💀 Поражение... ${enemy.name} оказался сильнее.`, "info"));
    return s;
  }

  applyStatuses(player, s.turn, s.log);
  if (player.hp <= 0) {
    s.phase = "lose";
    s.log.push(mkLog(s.turn, `💀 Поражение... Яд сделал своё дело.`, "info"));
    return s;
  }

  // Ki regen
  enemy.isDefending = false;
  enemy.atkBuff = 0;
  player.ki = Math.min(player.maxKi, player.ki + 10);
  enemy.ki = Math.min(enemy.maxKi, enemy.ki + 10);

  s.turn++;
  s.ap = s.maxAp;
  s.phase = "player_turn";
  return s;
}

function enemyChooseAction(enemy: Fighter, player: Fighter, skillIds: string[]): ActionType {
  const affordable = skillIds.filter((id) => {
    const sk = getSkill(id);
    return enemy.ki >= sk.kiCost;
  });

  // Heal when low
  if (enemy.hp < enemy.maxHp * 0.3) {
    const healId = affordable.find((id) => getSkill(id).effect.type === "heal");
    if (healId) return { skill: healId };
  }

  // Occasionally defend
  if (Math.random() < 0.15) return "defend";

  // Use skill randomly
  const damageSkills = affordable.filter((id) => {
    const t = getSkill(id).effect.type;
    return t === "damage" || t === "status";
  });
  if (damageSkills.length > 0 && Math.random() > 0.35) {
    return { skill: damageSkills[Math.floor(Math.random() * damageSkills.length)] };
  }

  return "attack";
}

export function xpForKill(enemyLevel: number): number {
  return enemyLevel * 25 + 10;
}

export function levelFromXp(xp: number): number {
  return Math.floor(1 + Math.sqrt(xp / 60));
}
