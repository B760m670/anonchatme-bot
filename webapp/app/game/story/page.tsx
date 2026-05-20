"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GameCharacter } from "@/lib/game/types";
import { getClan } from "@/lib/game/clans";
import { STORY } from "@/lib/game/story";

export default function StoryMode() {
  const [tgId, setTgId] = useState<number | null>(null);
  const [char, setChar] = useState<GameCharacter | null>(null);

  useEffect(() => {
    const id = window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? null;
    setTgId(id);
    if (!id) return;
    supabase.from("game_characters").select("*").eq("tg_id", id).maybeSingle()
      .then(({ data }) => setChar(data ?? null));
  }, []);

  if (!char) {
    return (
      <div className="game-screen" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ opacity: 0.6 }}>{char === null ? "Сначала создай персонажа" : "Загрузка…"}</p>
      </div>
    );
  }

  const currentChapter = char.story_chapter;

  return (
    <div className="game-screen">
      <div className="sakura-bg" />
      <div style={{ position: "relative", zIndex: 1, padding: "28px 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <a href="/game" style={{ color: "#fff", opacity: 0.6, fontSize: 22, textDecoration: "none" }}>←</a>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Сюжетный режим</h1>
            <p style={{ fontSize: 12, opacity: 0.5 }}>История ронина</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {STORY.map((chapter) => {
            const unlocked = chapter.id <= currentChapter;
            const completed = chapter.id < currentChapter;
            const active = chapter.id === currentChapter;

            return (
              <div
                key={chapter.id}
                style={{
                  background: completed
                    ? "rgba(74,222,128,0.08)"
                    : active
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${completed ? "rgba(74,222,128,0.3)" : active ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 16, padding: "16px",
                  opacity: unlocked ? 1 : 0.4,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 2 }}>{chapter.subtitle}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{chapter.title}</div>
                    <div style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.5 }}>{chapter.description}</div>
                    <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                      {chapter.enemies.map((e, i) => {
                        const ec = getClan(e.clan);
                        return (
                          <div key={i} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, opacity: 0.7 }}>
                            <span>{ec.emoji}</span>
                            <span>{e.name}</span>
                            <span style={{ opacity: 0.5 }}>Lv.{e.level}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ marginLeft: 12, fontSize: 24 }}>
                    {completed ? "✅" : active ? "▶️" : "🔒"}
                  </div>
                </div>

                {active && (
                  <a
                    href={`/game/battle?mode=story&chapter=${chapter.id}&enemy=0&tg=${tgId}`}
                    className="game-btn game-btn-primary"
                    style={{ marginTop: 14, display: "block", textAlign: "center" }}
                  >
                    ⚔️ Начать главу
                  </a>
                )}
                {completed && (
                  <a
                    href={`/game/battle?mode=story&chapter=${chapter.id}&enemy=0&tg=${tgId}&replay=1`}
                    style={{ marginTop: 10, display: "block", fontSize: 12, opacity: 0.5, textAlign: "center", textDecoration: "none" }}
                  >
                    Повторить
                  </a>
                )}

                {unlocked && (
                  <div style={{ marginTop: 10, fontSize: 11, opacity: 0.5 }}>
                    +{chapter.reward.xp} XP за победу
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
