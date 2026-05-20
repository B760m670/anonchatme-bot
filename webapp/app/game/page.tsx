"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GameCharacter } from "@/lib/game/types";
import { getClan } from "@/lib/game/clans";
import { levelFromXp } from "@/lib/game/engine";
import { STORY } from "@/lib/game/story";

export default function GameHome() {
  const [tgId, setTgId] = useState<number | null>(null);
  const [char, setChar] = useState<GameCharacter | null | undefined>(undefined);

  useEffect(() => {
    try { window.Telegram?.WebApp?.ready?.(); window.Telegram?.WebApp?.expand?.(); } catch {}
    const id = window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? null;
    setTgId(id);
    if (!id) { setChar(null); return; }
    supabase
      .from("game_characters")
      .select("*")
      .eq("tg_id", id)
      .maybeSingle()
      .then(({ data }) => setChar(data ?? null));
  }, []);

  if (char === undefined) {
    return <Screen><p style={{ opacity: 0.6 }}>Загрузка…</p></Screen>;
  }

  if (!char) {
    return (
      <Screen>
        <div className="game-logo">⚔️</div>
        <h1 className="game-title">Тени Эдо</h1>
        <p className="game-sub">Аниме RPG про самураев</p>
        <p style={{ opacity: 0.55, fontSize: 14, marginBottom: 32, textAlign: "center", padding: "0 24px" }}>
          Феодальная Япония. Пять кланов. Один ронин без прошлого.
        </p>
        <a href="/game/create" className="game-btn game-btn-primary">Начать путь</a>
      </Screen>
    );
  }

  const clan = getClan(char.clan);
  const level = levelFromXp(char.xp);
  const chapter = STORY.find((c) => c.id === char.story_chapter);
  const chaptersDone = char.story_chapter > STORY.length ? STORY.length : char.story_chapter - 1;

  return (
    <Screen>
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Character card */}
        <div className="game-card" style={{ background: clan.gradient, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 48 }}>{clan.emoji}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>Клан {clan.name}</div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>{clan.style} · Уровень {level}</div>
              <div style={{ fontSize: 12, opacity: 0.55, fontStyle: "italic" }}>«{clan.tagline}»</div>
            </div>
          </div>
          <div className="game-stat-row" style={{ marginTop: 16 }}>
            <Stat label="Победы" value={char.wins} color="#4ade80" />
            <Stat label="Поражения" value={char.losses} color="#f87171" />
            <Stat label="ELO" value={char.elo} color="#fbbf24" />
          </div>
          <XpBar xp={char.xp} level={level} />
        </div>

        {/* Сюжет */}
        <div className="game-card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.55, marginBottom: 4 }}>Сюжет</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {chaptersDone === STORY.length ? "✅ Завершён" : chapter ? chapter.title : "—"}
          </div>
          {chaptersDone < STORY.length && (
            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>
              {chaptersDone} / {STORY.length} глав
            </div>
          )}
        </div>

        {/* Menu */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a href="/game/story" className="game-btn game-btn-primary">📖 Сюжетный режим</a>
          <a href="/game/pvp" className="game-btn game-btn-secondary">⚔️ PvP — вызов самурая</a>
          <a href="/game/leaderboard" className="game-btn game-btn-ghost">🏆 Рейтинг самураев</a>
        </div>
      </div>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="game-screen">
      <div className="sakura-bg" />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px 40px" }}>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.55 }}>{label}</div>
    </div>
  );
}

function XpBar({ xp, level }: { xp: number; level: number }) {
  const prevXp = level === 1 ? 0 : Math.pow(level - 1, 2) * 60;
  const nextXp = Math.pow(level, 2) * 60;
  const pct = Math.min(100, ((xp - prevXp) / (nextXp - prevXp)) * 100);
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.55, marginBottom: 4 }}>
        <span>Опыт</span><span>{xp} / {nextXp} XP</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 99 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#fbbf24", borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}
