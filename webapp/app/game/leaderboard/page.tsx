"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getClan } from "@/lib/game/clans";
import { ClanId } from "@/lib/game/types";
import { levelFromXp } from "@/lib/game/engine";

interface LeaderboardRow {
  tg_id: number;
  clan: ClanId;
  elo: number;
  wins: number;
  losses: number;
  xp: number;
}

export default function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTgId, setMyTgId] = useState<number | null>(null);

  useEffect(() => {
    const id = window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? null;
    setMyTgId(id);
    supabase
      .from("game_characters")
      .select("tg_id, clan, elo, wins, losses, xp")
      .order("elo", { ascending: false })
      .limit(50)
      .then(({ data }) => { setRows((data ?? []) as LeaderboardRow[]); setLoading(false); });
  }, []);

  const rankMedal = (i: number) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;

  return (
    <div className="game-screen">
      <div className="sakura-bg" />
      <div style={{ position: "relative", zIndex: 1, padding: "28px 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <a href="/game" style={{ color: "#fff", opacity: 0.6, fontSize: 22, textDecoration: "none" }}>←</a>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Рейтинг самураев</h1>
            <p style={{ fontSize: 12, opacity: 0.5 }}>По рейтингу ELO</p>
          </div>
        </div>

        {loading ? (
          <p style={{ opacity: 0.5, textAlign: "center" }}>Загрузка…</p>
        ) : rows.length === 0 ? (
          <p style={{ opacity: 0.5, textAlign: "center" }}>Пока никого нет</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((row, i) => {
              const clan = getClan(row.clan);
              const level = levelFromXp(row.xp);
              const isMe = row.tg_id === myTgId;
              return (
                <div key={row.tg_id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: isMe ? `${clan.color}22` : "rgba(255,255,255,0.05)",
                  border: `1px solid ${isMe ? clan.color + "55" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 12, padding: "10px 14px",
                }}>
                  <div style={{ fontSize: i < 3 ? 22 : 14, minWidth: 28, textAlign: "center", opacity: i >= 3 ? 0.5 : 1 }}>
                    {rankMedal(i)}
                  </div>
                  <div style={{ fontSize: 24 }}>{clan.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      Клан {clan.name} {isMe ? <span style={{ fontSize: 11, opacity: 0.6 }}>(ты)</span> : null}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.5 }}>Ур. {level} · {row.wins}W / {row.losses}L</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#fbbf24" }}>{row.elo}</div>
                    <div style={{ fontSize: 10, opacity: 0.4 }}>ELO</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
