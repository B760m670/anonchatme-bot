"use client";

import { useState } from "react";
import { ClanId } from "./types";
import { getClan } from "./clans";

/**
 * Портрет клана. Пытается показать /game/clans/<clanId>.png.
 * Если файла нет (или не загрузился) — откат на emoji клана.
 * Достаточно положить картинку в webapp/public/game/clans/<clanId>.png.
 */
export function ClanPortrait({
  clan,
  size = 48,
  rounded = 12,
}: {
  clan: ClanId;
  size?: number;
  rounded?: number;
}) {
  const [failed, setFailed] = useState(false);
  const c = getClan(clan);

  if (failed) {
    return (
      <span
        style={{
          fontSize: size * 0.7,
          width: size,
          height: size,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {c.emoji}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/game/clans/${clan}.png`}
      alt={c.name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{
        width: size,
        height: size,
        objectFit: "cover",
        borderRadius: rounded,
        border: `2px solid ${c.color}55`,
        background: "#0d0d1a",
      }}
    />
  );
}
