"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { CLAN_LIST, getClan } from "@/lib/game/clans";
import { ClanPortrait } from "@/lib/game/ClanPortrait";
import { ClanId } from "@/lib/game/types";

function getTgId(): number | null {
  // 1. URL param (passed by bot handler)
  const urlId = new URLSearchParams(window.location.search).get("tg");
  if (urlId) return parseInt(urlId);
  // 2. Telegram WebApp API
  const id = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return id ?? null;
}

export default function CreateCharacter() {
  const [tgId, setTgId] = useState<number | null>(null);
  const [selected, setSelected] = useState<ClanId | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try { window.Telegram?.WebApp?.ready?.(); window.Telegram?.WebApp?.expand?.(); } catch {}
    setTgId(getTgId());
  }, []);

  async function confirm() {
    if (!selected || saving) return;
    if (!tgId) {
      setError("Не удалось определить твой ID. Открой игру через бота.");
      return;
    }
    setSaving(true);
    setError(null);

    const { error: dbErr } = await supabase.from("game_characters").upsert(
      { tg_id: tgId, clan: selected, level: 1, xp: 0, wins: 0, losses: 0, elo: 1000, story_chapter: 1, story_enemy_idx: 0 },
      { onConflict: "tg_id" }
    );

    if (dbErr) {
      setSaving(false);
      setError(`Ошибка сохранения: ${dbErr.message}`);
      return;
    }

    setDone(true);
    setTimeout(() => {
      window.location.href = `/game?tg=${tgId}`;
    }, 1200);
  }

  const clan = selected ? getClan(selected) : null;

  if (done) {
    return (
      <div className="game-screen" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{clan?.emoji}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Путь начат!</div>
          <div style={{ fontSize: 14, opacity: 0.6, marginTop: 8 }}>Клан {clan?.name} принял тебя</div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-screen">
      <div className="sakura-bg" />
      <div style={{ position: "relative", zIndex: 1, padding: "28px 16px 40px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, textAlign: "center" }}>Выбери клан</h1>
        <p style={{ fontSize: 13, opacity: 0.55, textAlign: "center", marginBottom: 24 }}>
          Это определит твой стиль боя навсегда
        </p>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#fca5a5" }}>
            ⚠️ {error}
          </div>
        )}

        {!tgId && (
          <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#fde68a" }}>
            ⚠️ Открой игру через кнопку в боте для корректной работы
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {CLAN_LIST.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              style={{
                background: selected === c.id ? c.gradient : "rgba(255,255,255,0.06)",
                border: `2px solid ${selected === c.id ? c.color : "transparent"}`,
                borderRadius: 16, padding: "14px 16px", textAlign: "left", cursor: "pointer",
                transition: "all 0.2s ease", color: "#fff",
                boxShadow: selected === c.id ? `0 0 20px ${c.color}44` : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ClanPortrait clan={c.id} size={52} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 17, fontWeight: 700 }}>Клан {c.name}</span>
                    <span style={{ fontSize: 11, background: `${c.color}33`, color: c.color, padding: "2px 8px", borderRadius: 99 }}>{c.style}</span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.55, fontStyle: "italic", marginTop: 2 }}>«{c.tagline}»</div>
                </div>
              </div>
              {selected === c.id && (
                <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                  {(["hp", "atk", "def", "spd"] as const).map((stat) => (
                    <StatBar key={stat} label={stat.toUpperCase()} value={c.stats[stat]} max={150} color={c.color} />
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={confirm}
          disabled={!selected || saving}
          className="game-btn game-btn-primary"
          style={{ opacity: selected ? 1 : 0.4, width: "100%" }}
        >
          {saving ? "Сохраняем…" : selected ? `Вступить в клан ${getClan(selected).name}` : "Выбери клан"}
        </button>
      </div>
    </div>
  );
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 3 }}>{label}</div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99 }} />
      </div>
      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{value}</div>
    </div>
  );
}
