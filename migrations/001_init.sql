-- Anonymous chat bot — initial schema
-- Run in Supabase SQL Editor

create table if not exists users (
    id              bigserial primary key,
    tg_id           bigint unique not null,
    username        text,
    gender          text check (gender in ('male', 'female')),
    age             int check (age between 14 and 99),
    premium_until   timestamptz,
    likes_count     int default 0,
    dislikes_count  int default 0,
    dialogs_count   int default 0,
    banned          boolean default false,
    settings        jsonb default '{
        "hide_media": false,
        "allow_calls": true,
        "allow_gifts": true,
        "hide_likes": false
    }'::jsonb,
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);

create index if not exists users_tg_id_idx on users (tg_id);
create index if not exists users_gender_age_idx on users (gender, age) where banned = false;

create table if not exists dialogs (
    id              bigserial primary key,
    user_a          bigint references users(id) on delete cascade,
    user_b          bigint references users(id) on delete cascade,
    mode            text check (mode in ('random', 'by_gender', 'flirt')) not null,
    started_at      timestamptz default now(),
    ended_at        timestamptz,
    ended_by        bigint references users(id)
);

create index if not exists dialogs_users_idx on dialogs (user_a, user_b);
create index if not exists dialogs_active_idx on dialogs (id) where ended_at is null;

create table if not exists ratings (
    id              bigserial primary key,
    dialog_id       bigint references dialogs(id) on delete cascade,
    from_user       bigint references users(id) on delete cascade,
    to_user         bigint references users(id) on delete cascade,
    value           smallint check (value in (-1, 1)) not null,
    created_at      timestamptz default now(),
    unique (dialog_id, from_user)
);

create index if not exists ratings_to_user_idx on ratings (to_user);

create table if not exists gifts (
    id              bigserial primary key,
    from_user       bigint references users(id) on delete cascade,
    to_user         bigint references users(id) on delete cascade,
    gift_code       text not null,
    stars_amount    int not null,
    sent_at         timestamptz default now()
);

create table if not exists reports (
    id              bigserial primary key,
    from_user       bigint references users(id) on delete cascade,
    to_user         bigint references users(id) on delete cascade,
    dialog_id       bigint references dialogs(id) on delete set null,
    reason          text,
    created_at      timestamptz default now(),
    resolved        boolean default false
);

create or replace function set_updated_at() returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists users_updated_at on users;
create trigger users_updated_at
    before update on users
    for each row execute function set_updated_at();
