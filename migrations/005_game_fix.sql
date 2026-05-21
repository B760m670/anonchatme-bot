-- Fix game_characters: drop FK constraint so game works independently of users table
-- Also enable RLS with permissive policies so the webapp anon key can read/write.
-- NOTE: PostgreSQL has no "CREATE POLICY IF NOT EXISTS" — use DROP + CREATE for idempotency.

ALTER TABLE game_characters DROP CONSTRAINT IF EXISTS game_characters_tg_id_fkey;

-- game_characters
ALTER TABLE game_characters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_game_characters" ON game_characters;
CREATE POLICY "allow_all_game_characters" ON game_characters FOR ALL USING (true) WITH CHECK (true);

-- game_battles
ALTER TABLE game_battles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_game_battles" ON game_battles;
CREATE POLICY "allow_all_game_battles" ON game_battles FOR ALL USING (true) WITH CHECK (true);

-- game_pvp_queue
ALTER TABLE game_pvp_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_game_pvp_queue" ON game_pvp_queue;
CREATE POLICY "allow_all_game_pvp_queue" ON game_pvp_queue FOR ALL USING (true) WITH CHECK (true);
