-- Stage 6: tighten age to 13-25
-- Run in Supabase SQL Editor (idempotent)

-- 1) Clamp any existing rows so the new constraint can be applied
update users set age = 13 where age is not null and age < 13;
update users set age = 25 where age is not null and age > 25;

-- 2) Replace the age check
alter table users drop constraint if exists users_age_check;
alter table users add constraint users_age_check check (age between 13 and 25);
