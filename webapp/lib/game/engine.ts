import { Fighter, BattleState, BattleLogEntry, ClanId, StatusEffect } from "./types";
import { getClan } from "./clans";
import { getSkill } from "./skills";
import { elementMultiplier } from "./elements";

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
    ultaUsed: false,
    attackedLastTurn: false,
    defendTurnsLeft: 0,
    reflectPct: 0,
    counterReady: false,
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

const STATUS_LABEL: Record<StatusEffect, string> = {
  burn: "горит", poison: "отравлен", freeze: "заморожен",
  bleed: "кровоточит", stun: "оглушён", dodge: "уклоняется",
};

/** Базовый расчёт урона с учётом стихий, защиты, цитадели и крита. */
function rollDamage(
  attacker: Fighter, defender: Fighter, mult: number,
): { dmg: number; crit: boolean } {
  const elMult = elementMultiplier(getClan(attacker.clan).element, getClan(defender.clan).element);
  // снижение урона: обычная защита 0.35; «цитадель» (defendTurnsLeft) даёт −80%
  let incomingScale = 1.0;
  if (defender.defendTurnsLeft > 0) incomingScale = 0.2;
  else if (defender.isDefending) incomingScale = 0.5;

  const base = Math.max(1, (attacker.atk + attacker.atkBuff) * mult * elMult - defender.def * 0.35);
  const variance = 0.88 + Math.random() * 0.24;
  const crit = Math.random() < 0.15;
  const dmg = Math.floor(base * variance * (crit ? 1.5 : 1) * incomingScale);
  return { dmg: Math.max(1, dmg), crit };
}

/** Наносит урон цели, обрабатывая уклонение и отражение. Возвращает фактический урон. */
function dealDamage(
  attacker: Fighter, defender: Fighter, dmg: number, turn: number, log: BattleLogEntry[],
): number {
  // уклонение
  const dodge = defender.statuses.find((s) => s.type === "dodge");
  if (dodge) {
    defender.statuses = defender.statuses.filter((s) => s !== dodge);
    log.push(mkLog(turn, `💨 ${defender.name} уклоняется от атаки!`, "status"));
    return 0;
  }
  defender.hp = Math.max(0, defender.hp - dmg);

  // отражение урона (Коори «Ледяной барьер»)
  if (defender.reflectPct > 0 && dmg > 0) {
    const reflected = Math.floor(dmg * defender.reflectPct / 100);
    if (reflected > 0) {
      attacker.hp = Math.max(0, attacker.hp - reflected);
      log.push(mkLog(turn, `🔃 ${defender.name} отражает ${reflected} урона!`, "status"));
    }
  }
  // контратака (Тэцу)
  if (defender.counterReady && dmg > 0 && defender.hp > 0) {
    const counter = Math.floor((defender.atk) * 0.6);
    attacker.hp = Math.max(0, attacker.hp - counter);
    log.push(mkLog(turn, `🔄 ${defender.name} контратакует — ${counter} урона!`, "damage"));
  }
  return dmg;
}

function applyStatuses(fighter: Fighter, turn: number, log: BattleLogEntry[]): void {
  const dmgPerStatus: Partial<Record<StatusEffect, number>> = { burn: 8, poison: 5, bleed: 10 };
  for (const s of fighter.statuses) {
    if (s.type === "freeze" || s.type === "stun" || s.type === "dodge") continue;
    const dmg = dmgPerStatus[s.type];
    if (dmg) {
      fighter.hp = Math.max(0, fighter.hp - dmg);
      log.push(mkLog(turn, `🩸 ${fighter.name} теряет ${dmg} HP (${STATUS_LABEL[s.type]})`, "damage"));
    }
    s.turns--;
  }
  fighter.statuses = fighter.statuses.filter((s) => s.turns > 0);
}

/** Добавляет статус, для яда — копит стаки до 5. */
function addStatus(target: Fighter, type: StatusEffect, duration: number): void {
  if (type === "poison") {
    const stacks = target.statuses.filter((s) => s.type === "poison").length;
    if (stacks >= 5) return;
  }
  target.statuses.push({ type, turns: duration });
}

export type ActionType = "attack" | "defend" | { skill: string };

function executeSkillEffect(
  actor: Fighter, target: Fighter, skillId: string, turn: number, log: BattleLogEntry[],
): void {
  const skill = getSkill(skillId);
  const ef = skill.effect;

  if (ef.kiGain) actor.ki = Math.min(actor.maxKi, actor.ki + ef.kiGain);

  if (ef.type === "damage") {
    let mult = ef.multiplier ?? 1;
    if (ef.condNoAttack && !target.attackedLastTurn) {
      mult *= 2;
      log.push(mkLog(turn, `🌑 Враг был пассивен — ${skill.name} усилен вдвое!`, "critical"));
    }
    if (ef.scaleLostHp) {
      const lostPct = 1 - actor.hp / actor.maxHp;
      mult *= 1 + lostPct; // до ×2 при почти нулевом HP
    }
    const hits = ef.hits ?? 1;
    let total = 0;
    let anyCrit = false;
    for (let i = 0; i < hits; i++) {
      const { dmg, crit } = rollDamage(actor, target, mult, );
      total += dealDamage(actor, target, dmg, turn, log);
      anyCrit = anyCrit || crit;
      if (ef.kiGain && hits > 1) actor.ki = Math.min(actor.maxKi, actor.ki + ef.kiGain);
      if (target.hp <= 0) break;
    }
    if (ef.heal) actor.hp = Math.min(actor.maxHp, actor.hp + ef.heal);
    const label = hits > 1 ? `${skill.emoji} "${skill.name}" ×${hits} — ${total} урона` : `${skill.emoji} "${skill.name}" — ${total} урона`;
    log.push(mkLog(turn, anyCrit ? `💥 КРИТ! ${label}` : label, anyCrit ? "critical" : "damage"));
  } else if (ef.type === "heal") {
    actor.hp = Math.min(actor.maxHp, actor.hp + (ef.heal ?? 0));
    log.push(mkLog(turn, `💚 ${skill.emoji} "${skill.name}" — +${ef.heal} HP`, "heal"));
  } else if (ef.type === "status") {
    if (ef.multiplier && ef.multiplier > 0) {
      const { dmg } = rollDamage(actor, target, ef.multiplier);
      dealDamage(actor, target, dmg, turn, log);
    }
    if (ef.status) {
      if (ef.status === "dodge") {
        addStatus(actor, "dodge", ef.statusDuration ?? 1);
        log.push(mkLog(turn, `${skill.emoji} "${skill.name}" — ${actor.name} готов уклониться!`, "status"));
      } else {
        addStatus(target, ef.status, ef.statusDuration ?? 1);
        log.push(mkLog(turn, `${skill.emoji} "${skill.name}" — ${target.name} ${STATUS_LABEL[ef.status]}!`, "status"));
      }
    }
  } else if (ef.type === "defend") {
    actor.isDefending = true;
    if (ef.defBonus) actor.def = Math.floor(actor.def * (1 + ef.defBonus / 100));
    if (ef.reflectPct) actor.reflectPct = ef.reflectPct;
    if (ef.counter) actor.counterReady = true;
    if (ef.defendTurns) actor.defendTurnsLeft = ef.defendTurns;
    log.push(mkLog(turn, `${skill.emoji} "${skill.name}" — стойка укреплена!`, "info"));
  } else if (ef.type === "buff") {
    if (ef.atkBonus) actor.atkBuff += ef.atkBonus;
    log.push(mkLog(turn, `${skill.emoji} "${skill.name}" — мощь возрастает!`, "info"));
  }
}

export function applyPlayerAction(state: BattleState, action: ActionType): BattleState {
  const s: BattleState = JSON.parse(JSON.stringify(state));
  const [player, enemy] = s.fighters;
  if (s.phase !== "player_turn") return s;

  const frozen = player.statuses.find((st) => st.type === "freeze" || st.type === "stun");
  if (frozen) {
    s.log.push(mkLog(s.turn, `🧊 ${player.name} скован и пропускает ход!`, "status"));
    player.statuses = player.statuses.filter((st) => st !== frozen);
    player.attackedLastTurn = false;
    endPlayerTurn(s);
    return s;
  }

  if (action === "attack") {
    const { dmg, crit } = rollDamage(player, enemy, 1.0);
    dealDamage(player, enemy, dmg, s.turn, s.log);
    player.ki = Math.min(player.maxKi, player.ki + 10);
    player.attackedLastTurn = true;
    s.log.push(mkLog(s.turn, crit ? `💥 КРИТ! ${player.name} — ${dmg} урона!` : `⚔️ ${player.name} атакует — ${dmg} урона (+10 Ki)`, crit ? "critical" : "damage"));
    s.ap -= 1;
  } else if (action === "defend") {
    player.isDefending = true;
    player.ki = Math.min(player.maxKi, player.ki + 15);
    s.log.push(mkLog(s.turn, `🛡 ${player.name} в защитной стойке (+15 Ki)`, "info"));
    s.ap -= 1;
  } else {
    const skill = getSkill(action.skill);
    if (skill.isUlta && player.ultaUsed) {
      s.log.push(mkLog(s.turn, `❌ Ульта уже использована в этом бою`, "info"));
      return s;
    }
    if (player.ki < skill.kiCost) {
      s.log.push(mkLog(s.turn, `❌ Недостаточно Ki для "${skill.name}"`, "info"));
      return s;
    }
    if (s.ap < skill.apCost) {
      s.log.push(mkLog(s.turn, `❌ Недостаточно AP для "${skill.name}"`, "info"));
      return s;
    }
    player.ki = Math.max(0, player.ki - skill.kiCost);
    if (skill.isUlta) player.ultaUsed = true;
    executeSkillEffect(player, enemy, action.skill, s.turn, s.log);
    if (skill.effect.type === "damage" || skill.effect.type === "status") player.attackedLastTurn = true;
    s.ap -= skill.apCost;
  }

  if (enemy.hp <= 0) {
    s.phase = "win";
    s.log.push(mkLog(s.turn, `🏆 Победа! ${player.name} одержал верх!`, "info"));
    return s;
  }
  if (player.hp <= 0) {
    s.phase = "lose";
    s.log.push(mkLog(s.turn, `💀 Поражение... отражённый урон оказался смертельным.`, "info"));
    return s;
  }
  if (s.ap <= 0) endPlayerTurn(s);
  return s;
}

function endPlayerTurn(s: BattleState): void {
  const [player, enemy] = s.fighters;
  s.phase = "enemy_turn";
  applyStatuses(enemy, s.turn, s.log);
  if (enemy.hp <= 0) {
    s.phase = "win";
    s.log.push(mkLog(s.turn, `🏆 Победа! ${player.name} одержал верх!`, "info"));
  }
}

export function applyEnemyTurn(state: BattleState): BattleState {
  const s: BattleState = JSON.parse(JSON.stringify(state));
  const [player, enemy] = s.fighters;
  if (s.phase !== "enemy_turn") return s;

  const frozen = enemy.statuses.find((st) => st.type === "freeze" || st.type === "stun");
  if (frozen) {
    s.log.push(mkLog(s.turn, `🧊 ${enemy.name} скован и пропускает ход!`, "status"));
    enemy.statuses = enemy.statuses.filter((st) => st !== frozen);
    enemy.attackedLastTurn = false;
  } else {
    const clan = getClan(enemy.clan);
    const act = enemyChooseAction(enemy, player, clan.skillIds, s.ap);

    if (act === "attack") {
      const { dmg, crit } = rollDamage(enemy, player, 1.0);
      dealDamage(enemy, player, dmg, s.turn, s.log);
      enemy.ki = Math.min(enemy.maxKi, enemy.ki + 10);
      enemy.attackedLastTurn = true;
      s.log.push(mkLog(s.turn, crit ? `💥 КРИТ! ${enemy.name} — ${dmg} урона!` : `⚔️ ${enemy.name} атакует — ${dmg} урона`, crit ? "critical" : "damage"));
    } else if (act === "defend") {
      enemy.isDefending = true;
      enemy.ki = Math.min(enemy.maxKi, enemy.ki + 15);
      enemy.attackedLastTurn = false;
      s.log.push(mkLog(s.turn, `🛡 ${enemy.name} уходит в оборону`, "info"));
    } else {
      const skill = getSkill(act.skill);
      enemy.ki = Math.max(0, enemy.ki - skill.kiCost);
      if (skill.isUlta) enemy.ultaUsed = true;
      executeSkillEffect(enemy, player, act.skill, s.turn, s.log);
      enemy.attackedLastTurn = skill.effect.type === "damage" || skill.effect.type === "status";
    }
  }

  if (player.hp <= 0) {
    s.phase = "lose";
    s.log.push(mkLog(s.turn, `💀 Поражение... ${enemy.name} оказался сильнее.`, "info"));
    return s;
  }
  if (enemy.hp <= 0) {
    s.phase = "win";
    s.log.push(mkLog(s.turn, `🏆 Победа!`, "info"));
    return s;
  }

  applyStatuses(player, s.turn, s.log);
  if (player.hp <= 0) {
    s.phase = "lose";
    s.log.push(mkLog(s.turn, `💀 Поражение... статус-эффект добил тебя.`, "info"));
    return s;
  }

  // конец раунда: сброс временных состояний, тик «цитадели», реген Ki
  for (const f of [player, enemy]) {
    f.isDefending = false;
    f.atkBuff = 0;
    f.reflectPct = 0;
    f.counterReady = false;
    if (f.defendTurnsLeft > 0) f.defendTurnsLeft--;
    f.ki = Math.min(f.maxKi, f.ki + 8);
  }

  s.turn++;
  s.ap = s.maxAp;
  s.phase = "player_turn";
  return s;
}

function enemyChooseAction(
  enemy: Fighter, player: Fighter, skillIds: string[], _ap: number,
): ActionType {
  const affordable = skillIds.filter((id) => {
    const sk = getSkill(id);
    if (sk.isUlta && enemy.ultaUsed) return false;
    return enemy.ki >= sk.kiCost;
  });

  // ульта при удачном моменте
  const ulta = affordable.find((id) => getSkill(id).isUlta);
  if (ulta && enemy.ki >= 80 && Math.random() < 0.6) return { skill: ulta };

  if (enemy.hp < enemy.maxHp * 0.3) {
    const healId = affordable.find((id) => getSkill(id).effect.type === "heal" || getSkill(id).effect.type === "defend");
    if (healId && Math.random() < 0.5) return { skill: healId };
  }

  if (Math.random() < 0.12) return "defend";

  const offensive = affordable.filter((id) => {
    const t = getSkill(id).effect.type;
    return t === "damage" || t === "status";
  });
  if (offensive.length > 0 && Math.random() > 0.3) {
    return { skill: offensive[Math.floor(Math.random() * offensive.length)] };
  }
  return "attack";
}

export function xpForKill(enemyLevel: number): number {
  return enemyLevel * 25 + 10;
}

export function levelFromXp(xp: number): number {
  return Math.floor(1 + Math.sqrt(xp / 60));
}
