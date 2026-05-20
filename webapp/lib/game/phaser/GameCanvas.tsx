"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GameCharacter } from "@/lib/game/types";
import { levelFromXp } from "@/lib/game/engine";

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [noChar, setNoChar] = useState(false);

  useEffect(() => {
    try { window.Telegram?.WebApp?.ready?.(); window.Telegram?.WebApp?.expand?.(); } catch {}

    const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!tgId) { setNoChar(true); setLoading(false); return; }

    supabase
      .from("game_characters")
      .select("*")
      .eq("tg_id", tgId)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) { setNoChar(true); setLoading(false); return; }
        const char = data as GameCharacter;
        setLoading(false);

        // dynamic import keeps Phaser out of SSR
        const { initGame } = await import("./index");
        if (containerRef.current && !gameRef.current) {
          gameRef.current = initGame(
            containerRef.current,
            char.tg_id,
            char.clan,
            levelFromXp(char.xp),
          );
        }
      });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ height: "100vh", background: "#0a0a1a", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 48 }}>⚔️</div>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Загружаем мир…</p>
      </div>
    );
  }

  if (noChar) {
    return (
      <div style={{ height: "100vh", background: "#0a0a1a", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, padding: 24 }}>
        <div style={{ fontSize: 64 }}>⚔️</div>
        <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 800, textAlign: "center" }}>Тени Эдо</h1>
        <p style={{ color: "rgba(255,255,255,0.55)", textAlign: "center", fontSize: 14 }}>
          Сначала создай своего самурая
        </p>
        <a href="/game/create" style={{
          background: "linear-gradient(135deg, #f59e0b, #ef4444)",
          color: "#fff", padding: "14px 32px", borderRadius: 14,
          fontWeight: 700, fontSize: 16, textDecoration: "none",
        }}>
          Выбрать клан
        </a>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#0a0a1a" }}
    />
  );
}
