"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { BattleState, Fighter, GameCharacter } from "@/lib/game/types";
import { getClan } from "@/lib/game/clans";
import { getSkill } from "@/lib/game/skills";
import { createFighter, initBattle, applyPlayerAction, applyEnemyTurn, xpForKill, levelFromXp, ActionType } from "@/lib/game/engine";
import { getChapter, STORY } from "@/lib/game/story";

function useQuery() {
  const [p, setP] = useState<URLSearchParams | null>(null);
  useEffect(() => { setP(new URLSearchParams(window.location.search)); }, []);
  return p;
}

export default function BattlePage() {
  const q = useQuery();
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [char, setChar] = useState<GameCharacter | null>(null);
  const [animating, setAnimating] = useState(false);
  const [shakeSide, setShakeSide] = useState<"player" | "enemy" | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const mode = q?.get("mode") ?? "story";
  const chapterId = parseInt(q?.get("chapter") ?? "1");
  const enemyIdx = parseInt(q?.get("enemy") ?? "0");
  const tgId = parseInt(q?.get("tg") ?? "0");

  useEffect(() => {
    if (!tgId) return;
    supabase.from("game_characters").select("*").eq("tg_id", tgId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setChar(data);
        const chapter = getChapter(chapterId);
        if (!chapter) return;
        const enemy = chapter.enemies[enemyIdx];
        if (!enemy) return;

        const playerFighter = createFighter("player", "Ты", data.clan, levelFromXp(data.xp));
        const enemyFighter = createFighter("enemy", enemy.name, enemy.clan, enemy.level);
        setBattle(initBattle(playerFighter, enemyFighter));
      });
  }, [tgId, chapterId, enemyIdx]);

  // Auto-run enemy turn
  useEffect(() => {
    if (!battle || battle.phase !== "enemy_turn" || animating) return;
    setAnimating(true);
    const timeout = setTimeout(() => {
      const next = applyEnemyTurn(battle);
      const prevPlayerHp = battle.fighters[0].hp;
      if (next.fighters[0].hp < prevPlayerHp) setShakeSide("player");
      else if (next.fighters[1].hp < battle.fighters[1].hp) setShakeSide("enemy");
      setBattle(next);
      setAnimating(false);
      setTimeout(() => setShakeSide(null), 500);
    }, 900);
    return () => clearTimeout(timeout);
  }, [battle, animating]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [battle?.log.length]);

  const act = useCallback((action: ActionType) => {
    if (!battle || battle.phase !== "player_turn" || animating) return;
    const prevEnemyHp = battle.fighters[1].hp;
    const next = applyPlayerAction(battle, action);
    if (next.fighters[1].hp < prevEnemyHp) setShakeSide("enemy");
    setBattle(next);
    setTimeout(() => setShakeSide(null), 400);
  }, [battle, animating]);

  async function handleVictory() {
    if (!char || !tgId) return;
    const chapter = getChapter(chapterId);
    const nextEnemyIdx = enemyIdx + 1;
    const hasMoreEnemies = chapter && nextEnemyIdx < chapter.enemies.length;
    const xpGain = chapter ? xpForKill(chapter.enemies[enemyIdx].level) : 20;
    const newXp = char.xp + xpGain;

    let updateData: Partial<GameCharacter> = { xp: newXp, wins: char.wins + 1 };
    if (!hasMoreEnemies && chapterId >= char.story_chapter) {
      updateData.story_chapter = chapterId + 1;
      updateData.story_enemy_idx = 0;
    }
    await supabase.from("game_characters").update(updateData).eq("tg_id", tgId);

    if (hasMoreEnemies) {
      window.location.href = `/game/battle?mode=story&chapter=${chapterId}&enemy=${nextEnemyIdx}&tg=${tgId}`;
    } else {
      window.location.href = `/game/story`;
    }
  }

  async function handleDefeat() {
    if (!char || !tgId) return;
    await supabase.from("game_characters").update({ losses: char.losses + 1 }).eq("tg_id", tgId);
    window.location.href = `/game/story`;
  }

  if (!battle) {
    return <div className="game-screen" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ opacity: 0.6 }}>Загрузка…</p></div>;
  }

  const [player, enemy] = battle.fighters;
  const playerClan = getClan(player.clan);
  const enemyClan = getClan(enemy.clan);
  const chapter = getChapter(chapterId);
  const enemyData = chapter?.enemies[enemyIdx];
  const skills = playerClan.skillIds.map(getSkill);

  const isOver = battle.phase === "win" || battle.phase === "lose";
  const isWin = battle.phase === "win";

  return (
    <div className="game-screen game-battle-bg">
      {/* Header: fighters */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 8, padding: "16px 12px 0" }}>
        <FighterCard fighter={player} side="left" shake={shakeSide === "player"} clan={playerClan} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, minWidth: 36 }}>
          <div style={{ fontSize: 11, opacity: 0.4 }}>Ход</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fbbf24" }}>{battle.turn}</div>
          <div style={{ fontSize: 18, opacity: 0.5 }}>⚔️</div>
        </div>
        <FighterCard fighter={enemy} side="right" shake={shakeSide === "enemy"} clan={enemyClan} title={enemyData?.title} />
      </div>

      {/* AP dots */}
      {battle.phase === "player_turn" && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "10px 0" }}>
          {Array.from({ length: battle.maxAp }).map((_, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i < battle.ap ? "#fbbf24" : "rgba(255,255,255,0.15)" }} />
          ))}
        </div>
      )}
      {battle.phase === "enemy_turn" && (
        <div style={{ textAlign: "center", padding: "10px 0", fontSize: 12, opacity: 0.5 }}>
          {enemy.name} думает…
        </div>
      )}

      {/* Battle log */}
      <div ref={logRef} style={{ flex: 1, overflowY: "auto", padding: "0 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        {battle.log.slice(-12).map((entry) => (
          <div key={entry.id} className={`battle-log-entry log-${entry.type}`}>
            {entry.message}
          </div>
        ))}
      </div>

      {/* Actions */}
      {!isOver && battle.phase === "player_turn" && (
        <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <ActionBtn label="⚔️ Атака" sub="1 AP" color="#ef4444" onClick={() => act("attack")} disabled={battle.ap < 1 || animating} />
            <ActionBtn label="🛡 Защита" sub="1 AP · +Ki" color="#38bdf8" onClick={() => act("defend")} disabled={battle.ap < 1 || animating} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {skills.map((skill) => (
              <ActionBtn
                key={skill.id}
                label={`${skill.emoji} ${skill.name}`}
                sub={`${skill.apCost} AP · ${skill.kiCost} Ki`}
                color={playerClan.color}
                onClick={() => act({ skill: skill.id })}
                disabled={battle.ap < skill.apCost || player.ki < skill.kiCost || animating}
              />
            ))}
          </div>
        </div>
      )}

      {/* End screen */}
      {isOver && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)", zIndex: 20 }}>
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 72, marginBottom: 12 }}>{isWin ? "🏆" : "💀"}</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{isWin ? "Победа!" : "Поражение"}</div>
            <div style={{ fontSize: 15, opacity: 0.6, marginBottom: 28 }}>
              {isWin
                ? `+${chapter ? xpForKill(chapter.enemies[enemyIdx].level) : 20} XP`
                : "Восстанови силы и попробуй снова"}
            </div>
            <button
              className="game-btn game-btn-primary"
              style={{ minWidth: 180 }}
              onClick={isWin ? handleVictory : handleDefeat}
            >
              {isWin ? (chapter && enemyIdx + 1 < chapter.enemies.length ? "Следующий враг ⚔️" : "Завершить главу") : "К главам"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FighterCard({ fighter, side, shake, clan, title }: {
  fighter: Fighter; side: "left" | "right"; shake: boolean; clan: ReturnType<typeof getClan>; title?: string;
}) {
  const hpPct = (fighter.hp / fighter.maxHp) * 100;
  const kiPct = (fighter.ki / fighter.maxKi) * 100;
  const hpColor = hpPct > 50 ? "#4ade80" : hpPct > 25 ? "#fbbf24" : "#f87171";

  return (
    <div
      style={{
        flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 14,
        border: `1px solid ${clan.color}44`, padding: "10px 10px 12px",
        transform: shake ? (side === "left" ? "translateX(-6px)" : "translateX(6px)") : "none",
        transition: shake ? "none" : "transform 0.3s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>{clan.emoji}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{fighter.name}</div>
          {title && <div style={{ fontSize: 10, opacity: 0.45, marginTop: 1 }}>{title}</div>}
        </div>
      </div>

      {/* HP */}
      <div style={{ marginBottom: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.6, marginBottom: 2 }}>
          <span>HP</span><span>{fighter.hp}/{fighter.maxHp}</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.12)", borderRadius: 99 }}>
          <div style={{ height: "100%", width: `${hpPct}%`, background: hpColor, borderRadius: 99, transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* Ki */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.6, marginBottom: 2 }}>
          <span>Ki</span><span>{fighter.ki}/{fighter.maxKi}</span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99 }}>
          <div style={{ height: "100%", width: `${kiPct}%`, background: "#a78bfa", borderRadius: 99, transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* Statuses */}
      {fighter.statuses.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          {fighter.statuses.map((s, i) => {
            const icons: Record<string, string> = { burn: "🔥", poison: "💀", freeze: "❄️", bleed: "🩸", stun: "⚡" };
            return (
              <span key={i} style={{ fontSize: 10, background: "rgba(255,255,255,0.1)", borderRadius: 6, padding: "1px 5px" }}>
                {icons[s.type]}{s.turns}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, sub, color, onClick, disabled }: {
  label: string; sub: string; color: string; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "rgba(255,255,255,0.04)" : `${color}22`,
        border: `1px solid ${disabled ? "rgba(255,255,255,0.08)" : `${color}55`}`,
        borderRadius: 10, padding: "8px 10px", color: "#fff", cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1, transition: "all 0.15s", textAlign: "left",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 10, opacity: 0.5, marginTop: 1 }}>{sub}</div>
    </button>
  );
}
