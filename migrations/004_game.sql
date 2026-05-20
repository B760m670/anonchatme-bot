-- Тени Эдо — game schema
-- Run in Supabase SQL Editor

create table if not exists game_characters (
    id              bigserial primary key,
    tg_id           bigint unique not null references users(tg_id) on delete cascade,
    clan            text not null check (clan in ('kage','hono','koori','kaze','tetsu')),
    level           int default 1,
    xp              int default 0,
    wins            int default 0,
    losses          int default 0,
    elo             int default 1000,
    story_chapter   int default 1,
    story_enemy_idx int default 0,
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);

create index if not exists game_characters_tg_id_idx on game_characters (tg_id);
create index if not exists game_characters_elo_idx on game_characters (elo desc);

create table if not exists game_battles (
    id              bigserial primary key,
    player_tg_id    bigint not null references users(tg_id) on delete cascade,
    opponent_tg_id  bigint references users(tg_id) on delete set null,
    battle_type     text not null check (battle_type in ('story','pvp')),
    chapter         int,
    winner_tg_id    bigint,
    xp_gained       int default 0,
    elo_change      int default 0,
    created_at      timestamptz default now()
);

create index if not exists game_battles_player_idx on game_battles (player_tg_id);

create table if not exists game_pvp_queue (
    tg_id           bigint primary key references users(tg_id) on delete cascade,
    clan            text not null,
    elo             int not null,
    joined_at       timestamptz default now()
);

drop trigger if exists game_characters_updated_at on game_characters;
create trigger game_characters_updated_at
    before update on game_characters
    for each row execute function set_updated_at();
