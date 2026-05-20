-- Fix game_characters: drop FK constraint so game works independently of users table
-- Also disable RLS to allow anon inserts from webapp

ALTER TABLE game_characters DROP CONSTRAINT IF EXISTS game_characters_tg_id_fkey;

-- Allow anon key to read/write game data (webapp uses anon key)
ALTER TABLE game_characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow_all_game_characters" ON game_characters FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE game_battles ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow_all_game_battles" ON game_battles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE game_pvp_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow_all_game_pvp_queue" ON game_pvp_queue FOR ALL USING (true) WITH CHECK (true);
