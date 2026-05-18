-- Stage 4: room concept + relaxed age constraint
-- Run in Supabase SQL Editor (idempotent)

-- 1) Age range: 6..20
alter table users drop constraint if exists users_age_check;
alter table users add constraint users_age_check check (age between 6 and 20);

-- 2) Rooms — add `room` column to dialogs to distinguish general vs flirt
alter table dialogs add column if not exists room text default 'general';
alter table dialogs drop constraint if exists dialogs_room_check;
alter table dialogs add constraint dialogs_room_check check (room in ('general', 'flirt'));

create index if not exists dialogs_room_idx on dialogs (room);
