"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GameCharacter } from "@/lib/game/types";
import { getClan } from "@/lib/game/clans";

export default function PvpPage() {
  const [tgId, setTgId] = useState<number | null>(null);
  const [char, setChar] = useState<GameCharacter | null>(null);
  const [status, setStatus] = useState<"idle" | "searching" | "found">("idle");
  const [opponent, setOpponent] = useState<GameCharacter | null>(null);

  useEffect(() => {
    const id = window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? null;
    setTgId(id);
    if (!id) return;
    supabase.from("game_characters").select("*").eq("tg_id", id).maybeSingle()
      .then(({ data }) => setChar(data ?? null));
  }, []);

  useEffect(() => {
    if (status !== "searching" || !tgId || !char) return;

    // Add to queue
    supabase.from("game_pvp_queue").upsert({ tg_id: tgId, clan: char.clan, elo: char.elo });

    // Poll for opponent every 2s
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("game_pvp_queue")
        .select("*")
        .neq("tg_id", tgId)
        .order("joined_at")
        .limit(1)
        .maybeSingle();

      if (data) {
        clearInterval(interval);
        await supabase.from("game_pvp_queue").delete().in("tg_id", [tgId, data.tg_id]);
        setOpponent(data as unknown as GameCharacter);
        setStatus("found");
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      if (tgId) supabase.from("game_pvp_queue").delete().eq("tg_id", tgId);
    };
  }, [status, tgId, char]);

  if (!char) {
    return (
      <div className="game-screen" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ opacity: 0.6 }}>Загрузка…</p>
      </div>
    );
  }

  const clan = getClan(char.clan);

  if (status === "found" && opponent) {
    const oppClan = getClan(opponent.clan as any);
    return (
      <div className="game-screen" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Соперник найден!</div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>{clan.emoji}</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Ты</div>
            <div style={{ fontSize: 12, opacity: 0.55 }}>Клан {clan.name}</div>
            <div style={{ fontSize: 11, opacity: 0.4 }}>ELO {char.elo}</div>
          </div>
          <div style={{ fontSize: 28, opacity: 0.5 }}>VS</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>🎭</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>???</div>
            <div style={{ fontSize: 12, opacity: 0.55 }}>Клан {oppClan.name}</div>
            <div style={{ fontSize: 11, opacity: 0.4 }}>ELO {opponent.elo}</div>
          </div>
        </div>
        <a
          href={`/game/battle?mode=pvp&chapter=1&enemy=0&tg=${tgId}`}
          className="game-btn game-btn-primary"
          style={{ minWidth: 200, textAlign: "center" }}
        >
          ⚔️ В бой!
        </a>
      </div>
    );
  }

  return (
    <div className="game-screen">
      <div className="sakura-bg" />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px" }}>
        <a href="/game" style={{ alignSelf: "flex-start", color: "#fff", opacity: 0.6, fontSize: 22, textDecoration: "none", marginBottom: 24 }}>←</a>

        <div style={{ fontSize: 56, marginBottom: 12 }}>{clan.emoji}</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>PvP Дуэль</div>
        <div style={{ fontSize: 13, opacity: 0.55, marginBottom: 4 }}>Клан {clan.name} · ELO {char.elo}</div>
        <div style={{ fontSize: 12, opacity: 0.4, marginBottom: 32, fontStyle: "italic" }}>«{clan.tagline}»</div>

        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, width: "100%", marginBottom: 24, textAlign: "center" }}>
          <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 12 }}>Твои характеристики</div>
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            <div><div style={{ fontSize: 20, fontWeight: 700, color: "#4ade80" }}>{char.wins}</div><div style={{ fontSize: 11, opacity: 0.5 }}>Победы</div></div>
            <div><div style={{ fontSize: 20, fontWeight: 700, color: "#f87171" }}>{char.losses}</div><div style={{ fontSize: 11, opacity: 0.5 }}>Поражения</div></div>
            <div><div style={{ fontSize: 20, fontWeight: 700, color: "#fbbf24" }}>{char.elo}</div><div style={{ fontSize: 11, opacity: 0.5 }}>ELO</div></div>
          </div>
        </div>

        {status === "idle" && (
          <button className="game-btn game-btn-primary" style={{ width: "100%" }} onClick={() => setStatus("searching")}>
            ⚔️ Искать соперника
          </button>
        )}

        {status === "searching" && (
          <div style={{ textAlign: "center" }}>
            <div className="pvp-searching-ring" />
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 16 }}>Ищем соперника…</div>
            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>Ждём другого самурая в очереди</div>
            <button
              style={{ marginTop: 20, fontSize: 12, opacity: 0.5, background: "none", border: "none", color: "#fff", cursor: "pointer" }}
              onClick={() => setStatus("idle")}
            >
              Отмена
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
