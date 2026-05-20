"use client";

import dynamic from "next/dynamic";

const GameCanvas = dynamic(
  () => import("@/lib/game/phaser/GameCanvas"),
  { ssr: false, loading: () => (
    <div style={{ height: "100vh", background: "#0a0a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Загружаем мир…</p>
    </div>
  )}
);

export default function GamePage() {
  return <GameCanvas />;
}
